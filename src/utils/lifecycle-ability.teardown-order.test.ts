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
 * Teardown order between a tool and the dependencies it declares.
 *
 * A dependency is acquired — and therefore declared — before the tools that use it, and it must be
 * released after them, so the release sequence is the acquisition sequence reversed: declare a
 * dependency before the tool that uses it and every dependency outlives its user. The tool itself
 * is torn down first of all, while its dependencies are still alive.
 */
describe('dependency teardown order: holder first, dependencies last-declared first', () => {
  it('orders dependencies for release as the reverse of their declaration', () => {
    const d1 = new ToolFunc({ name: 'd1', func: () => 1 })
    const d2 = new ToolFunc({ name: 'd2', func: () => 2 })
    const app = new ToolFunc({ name: 'app', depends: { d1, d2 }, func: () => 3 })

    expect((ToolFunc as any)._dependencyReleaseOrder(app)).toEqual([d2, d1])
  })

  it('has no dependencies to order for a tool without `depends`', () => {
    const plain = new ToolFunc({ name: 'plain', func: () => 1 })
    const empty = new ToolFunc({ name: 'empty', depends: {}, func: () => 1 })

    expect((ToolFunc as any)._dependencyReleaseOrder(plain)).toEqual([])
    expect((ToolFunc as any)._dependencyReleaseOrder(empty)).toEqual([])
  })

  it('tears the dependent down before its dependency, so dispose can give back what setup took', () => {
    const Tools = makeTools()
    const events: string[] = []

    const pool = new Tools({
      name: 'pool',
      setup() { (pool as any).closed = false },
      dispose() { (pool as any).closed = true; events.push('pool.dispose') },
      func() { return 'pool' },
    })
    const app = new Tools({
      name: 'app',
      depends: { pool },
      setup() { events.push('app.setup') },
      dispose() { events.push(`app.dispose(poolClosed=${(pool as any).closed === true})`) },
      func() { return 'app' },
    })

    Tools.register(app)
    expect(events).toEqual(['app.setup'])

    Tools.unregister('app')
    expect(events).toEqual([
      'app.setup',
      'app.dispose(poolClosed=false)',
      'pool.dispose',
    ])
    expect(Tools.get('pool')).toBeUndefined()
  })

  it('stops the timer before closing the pool it queries (reverse declaration order)', () => {
    const Tools = makeTools()
    const events: string[] = []

    const pool = new Tools({
      name: 'pool',
      setup() { events.push('pool.setup'); (pool as any).closed = false },
      dispose() { (pool as any).closed = true; events.push('pool.dispose') },
      func() { return 'pool' },
    })
    const timer = new Tools({
      name: 'timer',
      setup() { events.push('timer.setup') },
      dispose() { events.push(`timer.dispose(poolClosed=${(pool as any).closed === true})`) },
      func() { return 'timer' },
    })
    const app = new Tools({
      name: 'app',
      depends: { pool, timer },
      setup() { events.push('app.setup') },
      dispose() { events.push('app.dispose') },
      func() { return 'app' },
    })

    Tools.register(app)
    // acquisition keeps the declaration order: a dependency comes up before its user
    expect(events).toEqual(['pool.setup', 'timer.setup', 'app.setup'])

    Tools.unregister('app')
    expect(events).toEqual([
      'pool.setup', 'timer.setup', 'app.setup',
      'app.dispose',
      'timer.dispose(poolClosed=false)',
      'pool.dispose',
    ])
  })

  it('releases a transitive dependency only after the tool that uses it', () => {
    const Tools = makeTools()
    const events: string[] = []

    const b = new Tools({
      name: 'b',
      setup() { events.push('b.setup') },
      dispose() { events.push('b.dispose') },
      func() { return 'b' },
    })
    const a = new Tools({
      name: 'a',
      depends: { b },
      setup() { events.push('a.setup') },
      // `b` is still held by `app` at this point; `a` must not outlive a torn-down `b`
      dispose() { events.push(`a.dispose(bAlive=${Tools.get('b') !== undefined})`) },
      func() { return 'a' },
    })
    const app = new Tools({
      name: 'app',
      // the declaration is a topological order of the use graph: `b` comes up before `a`, which
      // uses it, and `app` comes up last
      depends: { b, a },
      setup() { events.push('app.setup') },
      dispose() { events.push('app.dispose') },
      func() { return 'app' },
    })

    Tools.register(app)
    expect(events).toEqual(['b.setup', 'a.setup', 'app.setup'])

    Tools.unregister('app')
    expect(events).toEqual([
      'b.setup', 'a.setup', 'app.setup',
      'app.dispose',
      'a.dispose(bAlive=true)',
      'b.dispose',
    ])
  })

  it('keeps a dependency alive while another registered tool still holds it', () => {
    const Tools = makeTools()
    const events: string[] = []

    const shared = new Tools({
      name: 'shared',
      setup() { events.push('shared.setup') },
      dispose() { events.push('shared.dispose') },
      func() { return 'shared' },
    })
    const t1 = new Tools({
      name: 't1',
      depends: { shared },
      setup() { events.push('t1.setup') },
      dispose() { events.push('t1.dispose') },
      func() { return 't1' },
    })
    const t2 = new Tools({
      name: 't2',
      depends: { shared },
      setup() { events.push('t2.setup') },
      dispose() { events.push('t2.dispose') },
      func() { return 't2' },
    })

    Tools.register(t1)
    Tools.register(t2)
    expect(events).toEqual(['shared.setup', 't1.setup', 't2.setup'])

    Tools.unregister('t1')
    expect(events).toEqual(['shared.setup', 't1.setup', 't2.setup', 't1.dispose'])
    expect(Tools.get('shared')).toBeDefined()

    Tools.unregister('t2')
    expect(events).toEqual([
      'shared.setup', 't1.setup', 't2.setup',
      't1.dispose',
      't2.dispose',
      'shared.dispose',
    ])
  })

  it('still releases the dependencies when the dependent\'s dispose throws', () => {
    const Tools = makeTools()
    const events: string[] = []
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const dep = new Tools({
      name: 'dep',
      setup() {},
      dispose() { events.push('dep.dispose') },
      func() { return 'dep' },
    })
    const app = new Tools({
      name: 'app',
      depends: { dep },
      setup() {},
      dispose() { throw new Error('app teardown boom') },
      func() { return 'app' },
    })

    Tools.register(app)

    // a failing dispose is best-effort: it must not strand the dependencies
    expect(() => Tools.unregister('app')).not.toThrow()
    expect(events).toEqual(['dep.dispose'])
    expect(Tools.get('app')).toBeUndefined()
    expect(Tools.get('dep')).toBeUndefined()

    errSpy.mockRestore()
  })
})
