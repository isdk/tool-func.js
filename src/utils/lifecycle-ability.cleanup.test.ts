import { describe, expect, it, vi } from 'vitest'
import { ToolFunc } from '../tool-func'
import { makeToolFuncLifecycle } from './lifecycle-ability'

/** Creates a fresh, isolated enhanced ToolFunc class for each test. */
function makeTools() {
  const Tools = makeToolFuncLifecycle(ToolFunc)
  Tools.clear()
  return Tools
}

const tick = () => new Promise<void>(r => setTimeout(r, 0))

describe('LifecycleAbility: per-call cleanup', () => {
  describe('basics', () => {
    it('runs once per call, after the synchronous body', () => {
      const Tools = makeTools()
      const events: string[] = []
      const tool = new Tools({
        name: 'sync',
        func() { events.push('func'); return 'ok' },
        cleanup() { events.push('cleanup') },
      })

      expect(events).toEqual([])
      expect(tool.runSync()).toBe('ok')
      expect(events).toEqual(['func', 'cleanup'])

      // every call gets its own scope
      expect(tool.runSync()).toBe('ok')
      expect(events).toEqual(['func', 'cleanup', 'func', 'cleanup'])
    })

    it('runs for an unregistered tool (lazy setup path)', () => {
      const Tools = makeTools()
      let cleaned = 0
      const tool = new Tools({
        name: 'lazy',
        func() { return 'lazy' },
        cleanup() { cleaned++ },
      })

      expect(Tools.get('lazy')).toBeUndefined()
      expect(tool.runSync()).toBe('lazy')
      expect(cleaned).toBe(1)
    })

    it('coexists with the registration-scoped dispose', () => {
      const Tools = makeTools()
      const events: string[] = []
      const tool = new Tools({
        name: 'both',
        func() { events.push('func'); return 1 },
        cleanup() { events.push('cleanup') },
        dispose() { events.push('dispose') },
      })

      Tools.register(tool)
      tool.runSync()
      tool.runSync()
      Tools.unregister('both')

      expect(events).toEqual(['func', 'cleanup', 'func', 'cleanup', 'dispose'])
    })

    it('runs for the positional entry points too', () => {
      const Tools = makeTools()
      const cleaned: any[] = []
      const tool = new Tools({
        name: 'pos',
        params: [{ name: 'a' }],
        func(a: any) { (this as any).a = a; return a },
        cleanup() { cleaned.push((this as any).a) },
      })

      expect(tool.runWithPosSync('x')).toBe('x')
      expect(cleaned).toEqual(['x'])
      expect(tool.runWithPos('y')).toBe('y')
      expect(cleaned).toEqual(['x', 'y'])
    })
  })

  describe('the call scope is isolated per call', () => {
    it('binds the body and the cleanup to a shadow instance, not the root', () => {
      const Tools = makeTools()
      let bodyThis: any
      let cleanupThis: any
      const tool = new Tools({
        name: 'bound',
        func() { bodyThis = this; return 1 },
        cleanup() { cleanupThis = this },
      })

      tool.runSync()

      expect(bodyThis).not.toBe(tool)
      expect(bodyThis._origin).toBe(tool)
      expect(cleanupThis).toBe(bodyThis)
    })

    it('gives each call its own shadow instance', () => {
      const Tools = makeTools()
      const seen: any[] = []
      const tool = new Tools({
        name: 'fresh',
        func() { seen.push(this); return 1 },
        cleanup() {},
      })

      tool.runSync()
      tool.runSync()

      expect(seen).toHaveLength(2)
      expect(seen[0]).not.toBe(seen[1])
    })

    it('does not force isolation on a tool without cleanup', () => {
      const Tools = makeTools()
      let bodyThis: any
      const tool = new Tools({ name: 'plain', func() { bodyThis = this; return 1 } })

      tool.runSync()
      expect(bodyThis).toBe(tool)
    })

    it('keeps concurrent async calls from sharing the resources on `this`', async () => {
      const Tools = makeTools()
      let release!: () => void
      const gate = new Promise<void>(r => { release = r })
      const seen: any[] = []
      const cleaned: any[] = []
      const tool = new Tools({
        name: 'concurrent',
        async func(params: any) {
          (this as any).mine = params.id
          await gate
          seen.push((this as any).mine)
          return (this as any).mine
        },
        cleanup() { cleaned.push((this as any).mine) },
      })

      const p1 = tool.run({ id: 1 })
      const p2 = tool.run({ id: 2 })
      release()

      await expect(p1).resolves.toBe(1)
      await expect(p2).resolves.toBe(2)
      expect(seen.sort()).toEqual([1, 2])     // neither call saw the other's value
      expect(cleaned.sort()).toEqual([1, 2])  // and each released its own
    })
  })

  describe('async bodies', () => {
    it('waits for the body and resolves the call only after the cleanup settled', async () => {
      const Tools = makeTools()
      const events: string[] = []
      const tool = new Tools({
        name: 'async',
        async func() {
          events.push('func:start')
          await Promise.resolve()
          events.push('func:end')
          return 'v'
        },
        async cleanup() {
          events.push('cleanup:start')
          await Promise.resolve()
          events.push('cleanup:end')
        },
      })

      const pending = tool.run()
      expect(events).toEqual(['func:start'])
      await expect(pending).resolves.toBe('v')
      expect(events).toEqual(['func:start', 'func:end', 'cleanup:start', 'cleanup:end'])
    })

    it('runs on rejection and rethrows the body error', async () => {
      const Tools = makeTools()
      let cleaned = 0
      const tool = new Tools({
        name: 'reject',
        async func() { throw new Error('body failed') },
        cleanup() { cleaned++ },
      })

      await expect(tool.run()).rejects.toThrow('body failed')
      expect(cleaned).toBe(1)
    })

    it('rejects the call when only the async cleanup fails', async () => {
      const Tools = makeTools()
      const tool = new Tools({
        name: 'lateCleanup',
        async func() { return 'v' },
        async cleanup() { throw new Error('cleanup failed') },
      })

      await expect(tool.run()).rejects.toThrow('cleanup failed')
    })

    it('aggregates both errors when the body and the cleanup fail', async () => {
      const Tools = makeTools()
      const tool = new Tools({
        name: 'bothFail',
        async func() { throw new Error('body failed') },
        async cleanup() { throw new Error('cleanup failed') },
      })

      let error: any
      try { await tool.run() } catch (e) { error = e }
      expect(error).toBeInstanceOf(AggregateError)
      expect(error.errors.map((e: any) => e.message)).toEqual(['body failed', 'cleanup failed'])
    })

    it('runs exactly once when the body both throws and returns a rejected promise', async () => {
      const Tools = makeTools()
      let cleaned = 0
      const tool = new Tools({
        name: 'once',
        func() { return Promise.reject(new Error('nope')) },
        cleanup() { cleaned++ },
      })

      await expect(tool.run()).rejects.toThrow('nope')
      expect(cleaned).toBe(1)
    })
  })

  describe('boundaries', () => {
    it('does not run when the call never starts (strictly paired tool not registered)', () => {
      const Tools = makeTools()
      let cleaned = 0
      const tool = new Tools({
        name: 'unregistered',
        // setup + dispose make it strictly paired: executing it before register() is a bug
        setup() {},
        dispose() {},
        func() { return 1 },
        cleanup() { cleaned++ },
      })

      expect(() => tool.runSync()).toThrow(/has not been set up/)
      expect(() => tool.runWithPosSync()).toThrow(/has not been set up/)
      expect(cleaned).toBe(0)
    })

    it('does not run when an async setup is still pending', async () => {
      const Tools = makeTools()
      let release!: () => void
      const gate = new Promise<void>(r => { release = r })
      let cleaned = 0
      const tool = new Tools({
        name: 'pending',
        async setup() { await gate },
        func() { return 'ok' },
        cleanup() { cleaned++ },
      })

      Tools.register(tool)
      expect(() => tool.runSync()).toThrow(/still pending/)
      expect(cleaned).toBe(0)

      release()
      await tool.ready
      expect(tool.runSync()).toBe('ok')
      expect(cleaned).toBe(1)
    })

    it('propagates a synchronous cleanup error', () => {
      const Tools = makeTools()
      const tool = new Tools({
        name: 'badCleanup',
        func() { return 'ok' },
        cleanup() { throw new Error('cleanup failed') },
      })

      expect(() => tool.runSync()).toThrow('cleanup failed')
    })

    it('reports a body error and a synchronous cleanup error together', () => {
      const Tools = makeTools()
      const tool = new Tools({
        name: 'bothSyncFail',
        func() { throw new Error('body failed') },
        cleanup() { throw new Error('cleanup failed') },
      })

      let error: any
      try { tool.runSync() } catch (e) { error = e }
      expect(error).toBeInstanceOf(AggregateError)
      expect(error.errors.map((e: any) => e.message)).toEqual(['body failed', 'cleanup failed'])
    })

    it('runs the cleanup even when the body threw before acquiring anything', () => {
      const Tools = makeTools()
      const events: string[] = []
      const tool = new Tools({
        name: 'threwEarly',
        func() { throw new Error('early') },
        // defensive, as the docs require: it may be invoked without anything acquired
        cleanup() { events.push((this as any).conn === undefined ? 'no-conn' : 'conn') },
      })

      expect(() => tool.runSync()).toThrow('early')
      expect(events).toEqual(['no-conn'])
    })

    it('logs (instead of throwing) an async cleanup rejection on a synchronous path', async () => {
      const Tools = makeTools()
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        const tool = new Tools({
          name: 'asyncCleanupSyncCall',
          func() { return 'ok' },
          cleanup() { return Promise.reject(new Error('late failure')) },
        })

        expect(tool.runSync()).toBe('ok')
        await tick()
        expect(spy).toHaveBeenCalled()
        expect(String(spy.mock.calls[0]?.[0])).toContain('async cleanup')
      } finally {
        spy.mockRestore()
      }
    })

    it('does not wrap the result of a tool without cleanup', () => {
      const Tools = makeTools()
      const original = Promise.resolve('untouched')
      const tool = new Tools({ name: 'untouched', func() { return original } })

      expect(tool.runSync()).toBe(original)
    })

    it('inherits extra promise properties onto the scoped result', async () => {
      const Tools = makeTools()
      const original: any = Promise.resolve('v')
      original.task = { id: 7 }
      let cleaned = 0
      const tool = new Tools({
        name: 'props',
        func() { return original },
        cleanup() { cleaned++ },
      })

      const result: any = tool.run()
      expect(result).not.toBe(original)
      expect(result.task).toEqual({ id: 7 })
      await expect(result).resolves.toBe('v')
      expect(cleaned).toBe(1)
    })
  })
})
