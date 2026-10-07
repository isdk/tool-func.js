import { describe, expect, it, vi } from 'vitest'
import { ToolFunc } from '../tool-func'
import { makeToolFuncLifecycle } from './lifecycle-ability'

/** Creates a fresh, isolated enhanced ToolFunc class for each test. */
function makeTools() {
  const Tools = makeToolFuncLifecycle(ToolFunc)
  Tools.clear()
  return Tools
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * An asynchronous teardown is chained, never started in parallel: `unregisterAsync()` resolves only
 * once the whole chain — the tool's own `dispose` *and* the dependency releases behind it — has
 * settled. Running them concurrently would make the release order a property of invocation only,
 * leaving the actual completion order indeterminate.
 */
describe('asynchronous teardown is serialized', () => {
  it('unregisterAsync awaits the dependent, then its dependency, without overlap', async () => {
    const Tools = makeTools()
    const events: string[] = []

    const dep = new Tools({
      name: 'dep',
      setup() {},
      async dispose() { events.push('dep.start'); await delay(30); events.push('dep.done') },
      func() { return 'dep' },
    })
    const app = new Tools({
      name: 'app',
      depends: { dep },
      setup() {},
      async dispose() { events.push('app.start'); await delay(10); events.push('app.done') },
      func() { return 'app' },
    })

    Tools.register(app)
    await Tools.unregisterAsync('app')

    // the dependency's teardown only starts once the dependent's has finished, and awaiting the
    // unregister means awaiting the whole chain — not just the target's own dispose
    expect(events).toEqual(['app.start', 'app.done', 'dep.start', 'dep.done'])
    expect(Tools.get('dep')).toBeUndefined()
  })

  it('releases several asynchronous dependencies one at a time, last declared first', async () => {
    const Tools = makeTools()
    const events: string[] = []

    const d1 = new Tools({
      name: 'd1',
      setup() {},
      async dispose() { events.push('d1.start'); await delay(10); events.push('d1.done') },
      func() { return 'd1' },
    })
    const d2 = new Tools({
      name: 'd2',
      setup() {},
      async dispose() { events.push('d2.start'); await delay(5); events.push('d2.done') },
      func() { return 'd2' },
    })
    const app = new Tools({
      name: 'app',
      depends: { d1, d2 },
      setup() {},
      async dispose() { events.push('app.start'); await delay(5); events.push('app.done') },
      func() { return 'app' },
    })

    Tools.register(app)
    await Tools.unregisterAsync('app')

    expect(events).toEqual([
      'app.start', 'app.done',
      'd2.start', 'd2.done',
      'd1.start', 'd1.done',
    ])
  })

  it('still releases the dependencies when an asynchronous dispose rejects', async () => {
    const Tools = makeTools()
    const events: string[] = []
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const dep = new Tools({
      name: 'dep',
      setup() {},
      async dispose() { events.push('dep.dispose') },
      func() { return 'dep' },
    })
    const app = new Tools({
      name: 'app',
      depends: { dep },
      setup() {},
      async dispose() {
        await delay(5)
        throw new Error('app async teardown boom')
      },
      func() { return 'app' },
    })

    Tools.register(app)

    await expect(Tools.unregisterAsync('app')).rejects.toThrow('app async teardown boom')
    expect(events).toEqual(['dep.dispose'])
    expect(Tools.get('dep')).toBeUndefined()

    errSpy.mockRestore()
  })
})
