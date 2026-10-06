import { describe, expect, it } from 'vitest'
import { ToolFunc } from '../tool-func'
import { makeToolFuncLifecycle } from './lifecycle-ability'

describe('LifecycleAbility smoke', () => {
  it('wires statics, initialize and runSync through AOP', async () => {
    const Tools = makeToolFuncLifecycle(ToolFunc)
    Tools.clear()

    const events: string[] = []
    const tool = new Tools({
      name: 'smoke',
      title: 'raw',
      setup(options: any) {
        events.push('setup')
        expect((this as any).name).toBe('smoke')
        // the instance is fully initialized by the time setup runs
        expect(typeof this.func).toBe('function')
        if (options) options.title = 'patched'
      },
      dispose() { events.push('dispose') },
      func() { events.push('func'); return 'ok' },
    })

    expect(events).toEqual([])            // not in the constructor
    expect(tool.title).toBe('raw')

    // has dispose -> running before register must fail loudly
    expect(() => tool.runSync()).toThrow(/has not been set up/)

    Tools.register(tool)
    expect(events).toEqual(['setup'])
    expect(tool.title).toBe('patched')    // options mutation replayed through assign()

    expect(tool.runSync()).toBe('ok')
    expect(events).toEqual(['setup', 'func'])

    Tools.unregister('smoke')
    expect(events).toEqual(['setup', 'func', 'dispose'])

    // re-register re-runs setup (dispose re-armed it)
    Tools.register(tool)
    expect(events).toEqual(['setup', 'func', 'dispose', 'setup'])
    Tools.unregister('smoke')
  })

  it('awaits async setup through run() and exposes ready', async () => {
    const Tools = makeToolFuncLifecycle(ToolFunc)
    Tools.clear()
    let released: () => void = () => {}
    const gate = new Promise<void>(r => { released = r })

    const tool = new Tools({
      name: 'asyncSmoke',
      async setup() { await gate; (this as any).ready2 = true },
      func() { return (this as any).ready2 === true },
    })

    Tools.register(tool)
    expect(tool.isSetupPending()).toBe(true)
    expect(() => tool.runSync()).toThrow(/still pending/)

    const pending = tool.run()
    released()
    expect(await pending).toBe(true)
    expect(tool.isSetupPending()).toBe(false)
    await tool.ready
    Tools.unregister('asyncSmoke')
  })
})
