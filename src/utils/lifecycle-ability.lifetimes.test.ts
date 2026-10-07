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
 * `setup` and `dispose` are a pair that re-arms per registration lifetime: the hooks are strictly
 * inverse, so an unregister/register cycle runs `setup` again *and* is torn down again in turn.
 * `disposeStarted` only guards against tearing the *same* lifetime down twice.
 */
describe('registration lifetimes', () => {
  it('isSetupDone() is false right after unregister', () => {
    const Tools = makeTools()

    const tool = new Tools({
      name: 'rearmState',
      setup() {},
      dispose() {},
      func() { return 'ok' },
    })

    Tools.register(tool)
    expect(tool.isSetupDone()).toBe(true)

    Tools.unregister('rearmState')
    expect(tool.isSetupDone()).toBe(false)
  })

  it('ready resolves immediately after dispose re-arms setup', async () => {
    const Tools = makeTools()

    const tool = new Tools({
      name: 'readyRearm',
      setup() {},
      dispose() {},
      func() { return 'ok' },
    })

    Tools.register(tool)
    await tool.ready

    Tools.unregister('readyRearm')
    await expect(tool.ready).resolves.toBe(tool)
    expect(tool.isSetupDone()).toBe(false)
  })

  it('re-arms both setup and dispose on every lifetime', () => {
    const Tools = makeTools()
    const events: string[] = []

    const tool = new Tools({
      name: 'cycle',
      setup() { events.push('setup') },
      dispose() { events.push('dispose') },
      func() { return 'ok' },
    })

    Tools.register(tool)
    Tools.unregister('cycle')
    Tools.register(tool)
    Tools.unregister('cycle')
    Tools.register(tool)
    Tools.unregister('cycle')

    expect(events).toEqual(['setup', 'dispose', 'setup', 'dispose', 'setup', 'dispose'])
  })
})
