import { describe, expect, it } from 'vitest'
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
