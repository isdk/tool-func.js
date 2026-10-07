import { describe, expect, it, vi } from 'vitest'
import { ToolFunc } from '../tool-func'
import { makeToolFuncLifecycle } from './lifecycle-ability'

/** Creates a fresh, isolated enhanced ToolFunc class for each test. */
function makeTools() {
  const Tools = makeToolFuncLifecycle(ToolFunc)
  Tools.clear()
  return Tools
}

/**
 * `clear()` drops everything a layer owns, so it has to run the lifecycle on the way out: a
 * registered tool holds real resources, and swapping the tables alone leaks every one of them.
 *
 * The order follows the declared dependency edges — a tool that another live tool still names in
 * its `depends` waits — because neither `items` order nor its reverse expresses it: a tool is
 * inserted *before* the dependencies it declares, while a dependency registered separately may
 * well come first.
 */
describe('clear() runs the lifecycle', () => {
  it('disposes the tools it drops, dependents before their dependencies', () => {
    const Tools = makeTools()
    const events: string[] = []

    const pool = new Tools({
      name: 'pool',
      setup() { events.push('pool.setup') },
      dispose() { events.push('pool.dispose') },
      func() { return 'pool' },
    })
    const app = new Tools({
      name: 'app',
      depends: { pool },
      setup() { events.push('app.setup') },
      dispose() { events.push('app.dispose') },
      func() { return 'app' },
    })

    Tools.register(app)
    Tools.clear()

    expect(events).toEqual(['pool.setup', 'app.setup', 'app.dispose', 'pool.dispose'])
    expect(Tools.get('app')).toBeUndefined()
    expect(Tools.get('pool')).toBeUndefined()
  })

  it('disposes a dependency that was registered before its user', () => {
    const Tools = makeTools()
    const events: string[] = []

    const pool = new Tools({
      name: 'pool',
      setup() { events.push('pool.setup') },
      dispose() { events.push('pool.dispose') },
      func() { return 'pool' },
    })
    const app = new Tools({
      name: 'app',
      depends: { pool },
      setup() { events.push('app.setup') },
      dispose() { events.push('app.dispose') },
      func() { return 'app' },
    })

    // the dependency is already there when its user arrives, so registration order alone would
    // tear the pool down first
    Tools.register(pool)
    Tools.register(app)
    Tools.clear()

    expect(events).toEqual(['pool.setup', 'app.setup', 'app.dispose', 'pool.dispose'])
    expect(Tools.get('app')).toBeUndefined()
    expect(Tools.get('pool')).toBeUndefined()
  })

  it('disposes a tool registered on its own', () => {
    const Tools = makeTools()
    const events: string[] = []

    const tool = new Tools({
      name: 'solo',
      setup() { events.push('setup') },
      dispose() { events.push('dispose') },
      func() { return 'ok' },
    })

    Tools.register(tool)
    Tools.clear()

    expect(events).toEqual(['setup', 'dispose'])
    expect(Tools.get('solo')).toBeUndefined()
  })
})

/**
 * `clearAsync()` is the async twin of `clear()`, and the difference is not convenience: a synchronous
 * entry point cannot know that a `dispose` is still in flight — that bookkeeping lives in the
 * lifecycle — so `clear()` drops a dependency as soon as its holder leaves the registry, overlapping
 * the two teardowns. `clearAsync()` awaits each tool's whole chain instead, in the same reverse
 * dependency order.
 */
describe('clearAsync() releases the layer and waits for it', () => {
  const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

  it('serializes the teardown chain, which the synchronous clear() cannot', async () => {
    const Tools = makeTools()
    const events: string[] = []

    const pool = new Tools({
      name: 'pool',
      setup() {},
      async dispose() { events.push('pool.start'); await delay(30); events.push('pool.done') },
      func() { return 'pool' },
    })
    const app = new Tools({
      name: 'app',
      depends: { pool },
      setup() {},
      async dispose() { events.push('app.start'); await delay(10); events.push('app.done') },
      func() { return 'app' },
    })

    Tools.register(app)
    await Tools.clearAsync()

    // the dependency's teardown starts only after its holder's has settled
    expect(events).toEqual(['app.start', 'app.done', 'pool.start', 'pool.done'])
    expect(Tools.get('app')).toBeUndefined()
    expect(Tools.get('pool')).toBeUndefined()
  })

  it('releases a layer whose dependency was registered before its user', async () => {
    const Tools = makeTools()
    const events: string[] = []

    const pool = new Tools({
      name: 'pool',
      setup() { events.push('pool.setup') },
      dispose() { events.push('pool.dispose') },
      func() { return 'pool' },
    })
    const app = new Tools({
      name: 'app',
      depends: { pool },
      setup() { events.push('app.setup') },
      dispose() { events.push('app.dispose') },
      func() { return 'app' },
    })

    Tools.register(pool)
    Tools.register(app)
    await Tools.clearAsync()

    expect(events).toEqual(['pool.setup', 'app.setup', 'app.dispose', 'pool.dispose'])
    expect(Tools.get('app')).toBeUndefined()
    expect(Tools.get('pool')).toBeUndefined()
  })

  it('initiates an asynchronous teardown without waiting when clear() is used', async () => {
    const Tools = makeTools()
    const events: string[] = []

    const pool = new Tools({
      name: 'pool',
      setup() {},
      async dispose() { events.push('pool.start'); await delay(30); events.push('pool.done') },
      func() { return 'pool' },
    })
    const app = new Tools({
      name: 'app',
      depends: { pool },
      setup() {},
      async dispose() { events.push('app.start'); await delay(10); events.push('app.done') },
      func() { return 'app' },
    })

    Tools.register(app)
    Tools.clear()

    // the registry is empty straight away, but both teardowns were only started — this overlap is
    // the contract `clearAsync()` exists for
    expect(Tools.get('app')).toBeUndefined()
    expect(Tools.get('pool')).toBeUndefined()
    expect(events).toEqual(['app.start', 'pool.start'])

    await app.disposed
    await pool.disposed
    expect(events).toEqual(['app.start', 'pool.start', 'app.done', 'pool.done'])
  })

  it('releases the whole layer and aggregates the failures', async () => {
    const Tools = makeTools()
    const events: string[] = []
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const alpha = new Tools({
      name: 'alpha',
      setup() {},
      dispose() { throw new Error('alpha teardown boom') },
      func() { return 'alpha' },
    })
    const beta = new Tools({
      name: 'beta',
      setup() {},
      async dispose() { await delay(5); throw new Error('beta teardown boom') },
      func() { return 'beta' },
    })
    const gamma = new Tools({
      name: 'gamma',
      setup() {},
      dispose() { events.push('gamma.dispose') },
      func() { return 'gamma' },
    })

    Tools.register(alpha)
    Tools.register(beta)
    Tools.register(gamma)

    const error = await Tools.clearAsync().catch((e) => e)

    // one failure must not strand the rest of the layer
    expect(error).toBeInstanceOf(AggregateError)
    expect((error as AggregateError).errors).toHaveLength(2)
    expect(events).toEqual(['gamma.dispose'])
    expect(Tools.get('alpha')).toBeUndefined()
    expect(Tools.get('beta')).toBeUndefined()
    expect(Tools.get('gamma')).toBeUndefined()

    errSpy.mockRestore()
  })

  it('reports a failure of a tool released as a dependency, not only of the roots', async () => {
    const Tools = makeTools()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const dep = new Tools({
      name: 'dep',
      setup() {},
      dispose() { throw new Error('dep teardown boom') },
      func() { return 'dep' },
    })
    const app = new Tools({
      name: 'app',
      depends: { dep },
      setup() {},
      dispose() {},
      func() { return 'app' },
    })

    Tools.register(app)

    const error = await Tools.clearAsync().catch((e) => e)

    expect(error).toBeInstanceOf(AggregateError)
    expect((error as AggregateError).errors).toHaveLength(1)
    expect(String((error as AggregateError).errors[0])).toContain('dep teardown boom')
    expect(Tools.get('app')).toBeUndefined()
    expect(Tools.get('dep')).toBeUndefined()

    errSpy.mockRestore()
  })
})
