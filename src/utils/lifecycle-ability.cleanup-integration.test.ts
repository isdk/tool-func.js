import { describe, expect, it } from 'vitest'
import { sleep } from '@isdk/util'
import { ToolFunc } from '../tool-func'
import { makeToolFuncLifecycle } from './lifecycle-ability'
import { makeToolFuncCancelable } from './cancelable-ability'
import { AsyncFeatures } from './async-features'

/** Creates a fresh, isolated enhanced ToolFunc class for each test. */
function makeTools() {
  const Tools = makeToolFuncLifecycle(ToolFunc)
  Tools.clear()
  return Tools as any
}

/** A ToolFunc class carrying both the lifecycle (cleanup) and the cancelable ability. */
function makeCombined(cancelableOptions?: any) {
  class Combined extends ToolFunc {}
  makeToolFuncLifecycle(Combined as any)
  makeToolFuncCancelable(Combined as any, cancelableOptions)
  ;(Combined as any).clear()
  return Combined as any
}

// The stream is delivered through the framework abilities, so the probe's own scheduling is not
// in play: `tick()` only lets the transformer's async close hook run.
const tick = () => sleep(0)

function streamOf(chunks: any[]): ReadableStream {
  let i = 0
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(chunks[i++])
      else controller.close()
    },
  })
}

async function readAll(stream: ReadableStream) {
  const reader = stream.getReader()
  const result: any[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    result.push(value)
  }
  return result
}

describe('LifecycleAbility: cleanup with streams', () => {
  it('keeps the scope open until the returned stream is fully consumed', async () => {
    const Tools = makeTools()
    const cleaned: any[] = []
    const tool = new Tools({
      name: 'streamTool',
      func() { (this as any).tx = 'open'; return streamOf(['a', 'b', 'c']) },
      cleanup() { cleaned.push((this as any).tx) },
    })

    const stream = tool.runSync() as ReadableStream
    expect(stream).toBeInstanceOf(ReadableStream)
    // the value is produced but not yet consumed: `finally` would already have fired here
    expect(cleaned).toEqual([])

    expect(await readAll(stream)).toEqual(['a', 'b', 'c'])
    await tick()
    expect(cleaned).toEqual(['open'])
  })

  it('runs the cleanup when the consumer cancels the stream', async () => {
    const Tools = makeTools()
    const cleaned: any[] = []
    const tool = new Tools({
      name: 'cancelStream',
      func() { (this as any).tx = 'open'; return streamOf(['a', 'b', 'c']) },
      cleanup() { cleaned.push('open') },
    })

    const reader = (tool.runSync() as ReadableStream).getReader()
    expect((await reader.read()).value).toBe('a')
    expect(cleaned).toEqual([])

    await reader.cancel('client disconnected')
    await tick()
    expect(cleaned).toEqual(['open'])
  })

  it('runs the cleanup when the stream errors', async () => {
    const Tools = makeTools()
    const cleaned: any[] = []
    const tool = new Tools({
      name: 'errorStream',
      func() {
        (this as any).tx = 'open'
        return new ReadableStream({
          start(controller) { controller.enqueue('a'); controller.error(new Error('boom')) },
        })
      },
      cleanup() { cleaned.push('open') },
    })

    const reader = (tool.runSync() as ReadableStream).getReader()
    await expect(reader.read()).rejects.toThrow('boom')
    await tick()
    expect(cleaned).toEqual(['open'])
  })

  it('runs the cleanup when the call signal aborts while the stream is still open', async () => {
    const Tools = makeTools()
    const cleaned: any[] = []
    const controller = new AbortController()
    const tool = new Tools({
      name: 'abortedStream',
      func() { (this as any).tx = 'open'; return streamOf(['a', 'b', 'c']) },
      cleanup() { cleaned.push('open') },
    })

    const stream = tool.runSync(undefined, { signal: controller.signal }) as ReadableStream
    expect(cleaned).toEqual([])

    controller.abort('gone')
    await tick()
    expect(cleaned).toEqual(['open'])

    // The scope is already closed: consuming the stream afterwards must not release again.
    await expect(readAll(stream)).resolves.toEqual(['a', 'b', 'c'])
    await tick()
    expect(cleaned).toEqual(['open'])
  })

  it('releases exactly once when the abort races the stream close', async () => {
    const Tools = makeTools()
    let cleaned = 0
    const controller = new AbortController()
    const tool = new Tools({
      name: 'raceStream',
      func() { return streamOf(['a']) },
      cleanup() { cleaned++ },
    })

    const stream = tool.runSync(undefined, { signal: controller.signal }) as ReadableStream
    const reader = stream.getReader()
    await reader.read()
    controller.abort('race')
    await reader.cancel('race')
    await tick()
    await tick()
    expect(cleaned).toBe(1)
  })
})

describe('LifecycleAbility: cleanup with cancellation', () => {
  function makeAbortableTool(Tools: any, cleaned: any[]) {
    return new Tools({
      name: 'abortable',
      func(params: any) {
        (this as any).tx = 'open'
        return this.runAsyncCancelableTask(params, async (p: any, aborter: any) => {
          const end = Date.now() + (p?.wait ?? 100)
          while (Date.now() < end) {
            aborter.throwIfAborted()
            await sleep(1)
          }
          return 'done'
        })
      },
      cleanup() { cleaned.push((this as any).tx) },
    })
  }

  it('preserves the task handle of the wrapped promise', async () => {
    const Tools = makeCombined()
    const cleaned: any[] = []
    const tool = makeAbortableTool(Tools, cleaned)

    const pending: any = tool.run({ wait: 5 })
    // the scope wrapper must not strip the capability metadata the ability attaches
    expect(pending.task).toBeInstanceOf(AbortController)

    await expect(pending).resolves.toBe('done')
    expect(cleaned).toEqual(['open'])
  })

  it('runs the cleanup when the task is aborted mid-flight', async () => {
    const Tools = makeCombined()
    const cleaned: any[] = []
    const tool = makeAbortableTool(Tools, cleaned)

    const pending: any = tool.run({ wait: 500 })
    expect(cleaned).toEqual([])

    pending.task.abort('stop')
    await expect(pending).rejects.toThrow(/stop/)
    expect(cleaned).toEqual(['open'])
  })

  it('releases exactly once when the abort races the task settling', async () => {
    const Tools = makeCombined()
    let cleaned = 0
    const tool = new Tools({
      name: 'shortAbort',
      func(params: any) {
        return this.runAsyncCancelableTask(params, async (p: any, aborter: any) => {
          const end = Date.now() + (p?.wait ?? 1)
          while (Date.now() < end) {
            aborter.throwIfAborted()
            await sleep(1)
          }
          return 'done'
        })
      },
      cleanup() { cleaned++ },
    })

    const pending: any = tool.run({ wait: 5 })
    pending.task.abort('race')
    await pending.catch(() => {})
    await tick()
    expect(cleaned).toBe(1)
  })

  it('does not release again when a reused external signal aborts after the call ended', async () => {
    const Tools = makeCombined()
    let cleaned = 0
    const controller = new AbortController()
    const tool = new Tools({
      name: 'reusedSignal',
      func(params: any) {
        return this.runAsyncCancelableTask(params, async () => 'done')
      },
      cleanup() { cleaned++ },
    })

    await expect(tool.run(undefined, { signal: controller.signal })).resolves.toBe('done')
    expect(cleaned).toBe(1)

    controller.abort('late')
    await tick()
    expect(cleaned).toBe(1)
  })

  it('releases a cancellable stream exactly once when the consumer cancels it', async () => {
    const Tools = makeCombined()
    const cleaned: any[] = []
    const tool = new Tools({
      name: 'cancelableStream',
      func(params: any) {
        (this as any).tx = 'open'
        return this.runAsyncCancelableTask(params, async () => streamOf(['a', 'b', 'c']))
      },
      cleanup() { cleaned.push('open') },
    })

    const pending: any = tool.run()
    expect(pending.task).toBeInstanceOf(AbortController)
    const stream = (await pending) as ReadableStream
    expect(stream).toBeInstanceOf(ReadableStream)

    const reader = stream.getReader()
    expect((await reader.read()).value).toBe('a')
    await reader.cancel('client disconnected')
    await tick()
    await tick()

    expect(cleaned).toEqual(['open'])
    // the ability's own task-pool cleanup still happened as well
    const host = (tool as any)._origin || tool
    expect((host.__task_aborter as any)?.[pending.task.id]).toBeUndefined()
  })

  it('leaves a tool without cleanup untouched when the cancelable ability is combined', async () => {
    const Tools = makeCombined()
    let produced: any
    const tool = new Tools({
      name: 'plainCombo',
      func(params: any) {
        produced = this.runAsyncCancelableTask(params, async () => 'done')
        return produced
      },
    })

    const pending: any = tool.run()
    // no cleanup hook -> no scope wrapper at all, so the ability's own promise survives by identity
    expect(pending).toBe(produced)
    await expect(pending).resolves.toBe('done')
  })

  it('still runs the cleanup when the cancelable ability is combined', async () => {
    const Tools = makeCombined()
    const events: string[] = []
    const tool = new Tools({
      name: 'combo',
      setup() { events.push('setup') },
      dispose() { events.push('dispose') },
      func() { events.push('func'); return 'ok' },
      cleanup() { events.push('cleanup') },
    })

    Tools.register(tool)
    expect(tool.runSync()).toBe('ok')
    Tools.unregister('combo')

    expect(events).toEqual(['setup', 'func', 'cleanup', 'dispose'])
  })

  it('keeps async cleanup ordering with multi-task concurrency', async () => {
    const Tools = makeCombined({ asyncFeatures: AsyncFeatures.MultiTask })
    const cleaned: number[] = []
    const tool = new Tools({
      name: 'multiTask',
      func(params: any) {
        (this as any).id = params.id
        return this.runAsyncCancelableTask(params, async () => {
          await sleep(params.id === 1 ? 5 : 1)
          return params.id
        })
      },
      cleanup() { cleaned.push((this as any).id) },
    })

    const results = await Promise.all([tool.run({ id: 1 }), tool.run({ id: 2 })])
    expect(results).toEqual([1, 2])
    expect(cleaned.sort()).toEqual([1, 2])
  })
})

describe('LifecycleAbility: cleanup with nested runAs calls', () => {
  it('releases the child before the parent for synchronous nesting', () => {
    const Tools = makeTools()
    const events: string[] = []
    const child = new Tools({
      name: 'child',
      func() { events.push('child:func'); return 'c' },
      cleanup() { events.push('child:cleanup') },
    })
    const parent = new Tools({
      name: 'parent',
      depends: { child },
      func() {
        events.push('parent:func')
        const result = this.runAsSync('child')
        events.push(`parent:got:${result}`)
        return result
      },
      cleanup() { events.push('parent:cleanup') },
    })

    Tools.register(parent)
    expect(parent.runSync()).toBe('c')
    // the child's call ends before the parent's body does, so the parent scope is still open then
    expect(events).toEqual([
      'parent:func',
      'child:func', 'child:cleanup',
      'parent:got:c',
      'parent:cleanup',
    ])
  })

  it('awaits an async child release before the parent continues, when the parent awaits it', async () => {
    const Tools = makeTools()
    const events: string[] = []
    const child = new Tools({
      name: 'child',
      async func() { events.push('child:func'); return 'c' },
      async cleanup() { await sleep(2); events.push('child:cleanup') },
    })
    const parent = new Tools({
      name: 'parent',
      depends: { child },
      async func() {
        events.push('parent:func')
        await this.runAs('child')
        events.push('parent:after-child')
        return 'done'
      },
      async cleanup() { events.push('parent:cleanup') },
    })

    await expect(parent.run()).resolves.toBe('done')
    // `runAs` resolves only after the child's cleanup settled, so the order is child-before-parent
    expect(events).toEqual([
      'parent:func',
      'child:func', 'child:cleanup',
      'parent:after-child',
      'parent:cleanup',
    ])
  })

  it('releases each nested child call separately', () => {
    const Tools = makeTools()
    const events: string[] = []
    const child = new Tools({
      name: 'child',
      func() { events.push('child:func') },
      cleanup() { events.push('child:cleanup') },
    })
    const parent = new Tools({
      name: 'parent',
      depends: { child },
      func() {
        this.runAsSync('child')
        this.runAsSync('child')
      },
      cleanup() { events.push('parent:cleanup') },
    })

    Tools.register(parent)
    parent.runSync()
    expect(events).toEqual([
      'child:func', 'child:cleanup',
      'child:func', 'child:cleanup',
      'parent:cleanup',
    ])
  })

  it('releases the child when the parent body throws after it', () => {
    const Tools = makeTools()
    const events: string[] = []
    const child = new Tools({
      name: 'child',
      func() { events.push('child:func') },
      cleanup() { events.push('child:cleanup') },
    })
    const parent = new Tools({
      name: 'parent',
      depends: { child },
      func() {
        this.runAsSync('child')
        throw new Error('parent boom')
      },
      cleanup() { events.push('parent:cleanup') },
    })

    Tools.register(parent)
    expect(() => parent.runSync()).toThrow('parent boom')
    expect(events).toEqual(['child:func', 'child:cleanup', 'parent:cleanup'])
  })

  it('lets the parent publish a per-call resource the child shares through ctx', () => {
    const Tools = makeTools()
    const seen: any[] = []
    const released: any[] = []
    const child = new Tools({
      name: 'child',
      func() { seen.push((this as any).ctx.tx) },
    })
    const parent = new Tools({
      name: 'parent',
      depends: { child },
      func() {
        // the call context is inherited by nested calls, so the child can borrow the resource...
        ;(this as any).ctx.tx = 'open'
        this.runAsSync('child')
        return 'ok'
      },
      // ...while only the call that acquired it releases it
      cleanup() { released.push((this as any).ctx.tx) },
    })

    Tools.register(parent)
    expect(parent.runSync()).toBe('ok')
    expect(seen).toEqual(['open'])
    expect(released).toEqual(['open'])
  })

  it('keeps the parent and child resources on their own shadow instances', () => {
    const Tools = makeTools()
    const seen: any[] = []
    const child = new Tools({
      name: 'child',
      func() { (this as any).mark = 'child'; seen.push((this as any).mark) },
      cleanup() { seen.push(`child:${(this as any).mark}`) },
    })
    const parent = new Tools({
      name: 'parent',
      depends: { child },
      func() {
        (this as any).mark = 'parent'
        this.runAsSync('child')
        // the child's own field never leaks back onto the parent's scope
        seen.push((this as any).mark)
      },
      cleanup() { seen.push(`parent:${(this as any).mark}`) },
    })

    Tools.register(parent)
    parent.runSync()
    expect(seen).toEqual(['child', 'child:child', 'parent', 'parent:parent'])
  })
})
