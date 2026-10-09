import { describe, expect, it, beforeEach, vi } from 'vitest'
import { ToolFunc } from '../tool-func'
import { makeToolFuncLifecycle } from './lifecycle-ability'

/** Creates a fresh, isolated enhanced ToolFunc class for each test. */
function makeTools() {
  const Tools = makeToolFuncLifecycle(ToolFunc)
  Tools.clear()
  return Tools
}

/**
 * Builds a real two-level registry hierarchy for the lifecycle tests.
 *
 * `createAbilityInjector` mutates its target in place and hands back any
 * ancestor that already carries the ability (`isInjectedOnParent`), so the
 * parent/child layers must be plain subclasses of the enhanced base —
 * re-injecting on a subclass would silently return the base class and
 * collapse both "layers" into a single registry.
 */
function makeHierarchy() {
  const Base = makeToolFuncLifecycle(ToolFunc)
  class Parent extends (Base as any) {}
  class Child extends Parent {}
  // Parent/Child 继承自 `Base as any`，静态侧没有 ability 的类型，只能 as any
  ;(Parent as any).isolateRegistry()
  ;(Child as any).isolateRegistry()
  return { P: Parent as any, C: Child as any }
}

describe('LifecycleAbility', () => {
  beforeEach(() => {
    ToolFunc.clear()
  })

  describe('synchronous setup', () => {
    it('does not run setup in the constructor', () => {
      const Tools = makeTools()
      const events: string[] = []

      const tool = new Tools({
        name: 'sync',
        setup() { events.push('setup') },
        func() { return 'ok' },
      })

      expect(events).toEqual([])
      expect(tool.title).toBeUndefined()
    })

    it('runs setup via register() and replays touched options', () => {
      const Tools = makeTools()
      const events: string[] = []

      const tool = new Tools({
        name: 'sync',
        title: 'raw',
        setup(options: any) {
          events.push('setup')
          if (options) options.title = 'patched'
        },
        func() { events.push('func'); return 'ok' },
      })

      Tools.register(tool)

      expect(events).toEqual(['setup'])
      expect(tool.title).toBe('patched')
      expect(tool.runSync()).toBe('ok')
      expect(events).toEqual(['setup', 'func'])
    })

    it('runs setup on instance.register() too', () => {
      const Tools = makeTools()
      const events: string[] = []

      const tool = new Tools({
        name: 'instanceReg',
        setup() { events.push('setup') },
        func() { return 'ok' },
      })

      tool.register()
      expect(events).toEqual(['setup'])
      expect(tool.runSync()).toBe('ok')
    })
  })

  describe('lazy setup (tool without dispose)', () => {
    it('auto-runs setup on first runSync when no dispose hook', () => {
      const Tools = makeTools()
      const events: string[] = []

      const tool = new Tools({
        name: 'lazy',
        setup() { events.push('setup') },
        func() { events.push('func'); return 'lazy' },
      })

      // Do NOT register - runSync auto-runs setup (lazy path)
      expect(tool.runSync()).toBe('lazy')
      expect(events).toEqual(['setup', 'func'])
    })

    it('still returns correct value after lazy setup', () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'lazy2',
        setup() { (this as any).val = 42 },
        func() { return (this as any).val },
      })

      tool.register()
      expect(tool.runSync()).toBe(42)
    })
  })

  describe('strict setup (tool with dispose)', () => {
    it('throws on runSync before register when dispose hook exists', () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'strict',
        setup() {},
        dispose() {},
        func() { return 'ok' },
      })

      expect(() => tool.runSync()).toThrow(/has not been set up/)
    })

    it('throws on runWithPosSync before register when dispose hook exists', () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'strictPos',
        setup() {},
        dispose() {},
        func(val: string) { return val },
      })

      expect(() => tool.runWithPosSync('x')).toThrow(/has not been set up/)
    })
  })

  describe('async setup', () => {
    it('exposes isSetupPending and ready while async setup is in flight', async () => {
      const Tools = makeTools()
      let release!: () => void
      const gate = new Promise<void>(r => { release = r })

      const tool = new Tools({
        name: 'async',
        async setup() { await gate; (this as any).__ready = true },
        func() { return (this as any).__ready === true },
      })

      Tools.register(tool)

      expect(tool.isSetupPending()).toBe(true)
      expect(() => tool.runSync()).toThrow(/still pending/)

      const pending = tool.run()
      release()
      expect(await pending).toBe(true)

      expect(tool.isSetupPending()).toBe(false)
      await expect(tool.ready).resolves.toBe(tool)
    })

    it('runSync works after async setup settles', async () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'asyncDone',
        async setup() { await Promise.resolve(); (this as any).v = 'set' },
        func() { return (this as any).v },
      })

      Tools.register(tool)
      await tool.ready

      expect(tool.runSync()).toBe('set')
    })

    it('replays touched options after async setup resolves', async () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'asyncOpts',
        title: 'raw',
        async setup(options: any) {
          await Promise.resolve()
          if (options) options.title = 'patched'
        },
        func() { return this.title },
      })

      Tools.register(tool)
      await tool.ready
      expect(tool.title).toBe('patched')
    })
  })

  describe('dispose', () => {
    it('calls dispose on unregister', () => {
      const Tools = makeTools()
      const events: string[] = []

      const tool = new Tools({
        name: 'dispose',
        setup() { events.push('setup') },
        dispose() { events.push('dispose') },
        func() { return 'ok' },
      })

      Tools.register(tool)
      Tools.register(tool) // bump refCount to 2
      expect(events).toEqual(['setup'])

      Tools.unregister('dispose')
      expect(events).toEqual(['setup']) // refCount still > 0

      Tools.unregister('dispose')
      expect(events).toEqual(['setup', 'dispose'])
    })

    it('re-runs setup on re-register after dispose', () => {
      const Tools = makeTools()
      const events: string[] = []

      const tool = new Tools({
        name: 'rearm',
        setup() { events.push('setup') },
        dispose() { events.push('dispose') },
        func() { return 'ok' },
      })

      Tools.register(tool)
      Tools.unregister('rearm')
      expect(events).toEqual(['setup', 'dispose'])

      Tools.register(tool)
      expect(events).toEqual(['setup', 'dispose', 'setup'])
      Tools.unregister('rearm')
    })

    it('dispose is async, awaiting via unregisterAsync', async () => {
      const Tools = makeTools()
      let disposed = false

      const tool = new Tools({
        name: 'asyncDispose',
        setup() {},
        async dispose() { await new Promise(r => setTimeout(r, 10)); disposed = true },
        func() { return 'ok' },
      })

      Tools.register(tool)
      await Tools.unregisterAsync('asyncDispose')
      expect(disposed).toBe(true)
    })

    it('unregisterAsync propagates dispose errors', async () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'errDispose',
        setup() {},
        dispose() { throw new Error('dispose failed') },
        func() { return 'ok' },
      })

      Tools.register(tool)
      await expect(Tools.unregisterAsync('errDispose')).rejects.toThrow('dispose failed')
    })
  })

  describe('hierarchical lifecycle: dispose tied to true per-layer ownership loss', () => {
    it('child shadowing an existing tool does not create an independent lifecycle', () => {
      const { P, C } = makeHierarchy()

      const events: string[] = []

      const parentTool = new P({
        name: 'shared',
        setup() { events.push('parent-setup') },
        dispose() { events.push('parent-dispose') },
        func() { return 'parent' },
      })
      P.register(parentTool)

      const shadow = new C({
        name: 'shared',
        func() { return 'child' },
      })
      C.register(shadow)

      expect(events).toEqual(['parent-setup'])
      expect(C.get('shared')!.func!()).toBe('child')
      expect(P.get('shared')!.func!()).toBe('parent')

      C.unregister('shared')
      expect(events).toEqual(['parent-setup'])
    })

    it('a shared dependency is disposed only when its owning layer loses the last physical hold', async () => {
      const { P, C } = makeHierarchy()

      const events: string[] = []

      const shared = new P({
        name: 'shared-dep',
        setup() { events.push('shared-setup') },
        dispose() { events.push('shared-dispose') },
        func() { return 'shared' },
      })

      const parent = new P({
        name: 'parent',
        depends: { s: shared },
        func() { return 'parent' },
      })
      P.register(parent)

      const child = new C({
        name: 'child',
        depends: { s: shared },
        func() { return 'child' },
      })
      C.register(child)

      expect(Object.prototype.hasOwnProperty.call(P._refCounts, 'shared-dep')).toBe(true)
      expect(Object.prototype.hasOwnProperty.call(C._refCounts, 'shared-dep')).toBe(true)
      expect(events).toEqual(['shared-setup'])

      C.unregister('child')
      expect(events).toEqual(['shared-setup'])
      expect(P.get('shared-dep')!.func!()).toBe('shared')

      P.unregister('parent')
      expect(events).toEqual(['shared-setup', 'shared-dispose'])
      expect(P.get('shared-dep')).toBeUndefined()
    })

    it('dispose runs once per physical ownership loss, not per layer', () => {
      const { P, C } = makeHierarchy()

      const events: string[] = []

      const parentTool = new P({
        name: 'shared-instance',
        setup() { events.push('parent-setup') },
        dispose() { events.push('parent-dispose') },
        func() { return 'parent' },
      })
      P.register(parentTool)

      const child = new C({
        name: 'shared-instance',
        depends: { d: parentTool },
        func() { return 'child' },
      })
      C.register(child)

      C.unregister('shared-instance')
      expect(events).toEqual(['parent-setup'])
      expect(P.get('shared-instance')!.func!()).toBe('parent')

      P.unregister('shared-instance')
      expect(events).toEqual(['parent-setup', 'parent-dispose'])
    })

    it('unregisterAsync awaits only the dispose of the layer that physically removed the tool', async () => {
      const { P, C } = makeHierarchy()

      const events: string[] = []

      const parentTool = new P({
        name: 'gated-shared',
        setup() { events.push('parent-setup') },
        dispose() { events.push('parent-dispose') },
        func() { return 'parent' },
      })
      P.register(parentTool)

      const childTool = new C({
        name: 'gated-shared',
        setup() { events.push('child-setup') },
        dispose() { events.push('child-dispose') },
        func() { return 'child' },
      })
      C.register(childTool)

      await C.unregisterAsync('gated-shared')
      expect(events).toEqual(['parent-setup', 'child-setup', 'child-dispose'])
      expect(P.get('gated-shared')!.func!()).toBe('parent')
    })

    it('a parent force-remove still disposes an instance a child shadow holds (known limitation)', () => {
      const { P, C } = makeHierarchy()

      const events: string[] = []

      const parentTool = new P({
        name: 'force-shared',
        setup() { events.push('parent-setup') },
        dispose() { events.push('parent-dispose') },
        func() { return 'parent' },
      })
      P.register(parentTool)

      const shadow = new C({
        name: 'force-shared',
        func() { return 'child' },
      })
      C.register(shadow)

      expect(events).toEqual(['parent-setup'])
      expect(C.get('force-shared')).toBe(shadow)

      P.unregister('force-shared', { force: true, scope: 'local' })

      // KNOWN LIMITATION (documented, not a regression): the lookup used to decide whether the
      // instance is still reachable only walks *up* the prototype chain, so a parent layer
      // cannot see a child layer's shadow hold. The parent therefore observes "nothing resolves
      // to it here anymore" and disposes the instance even though the child still uses it. Fixing
      // this needs a registry reverse index (name -> holding layers); `disposeStarted` at least
      // keeps it from disposing twice.
      expect(events).toEqual(['parent-setup', 'parent-dispose'])
      expect(P.get('force-shared')).toBeUndefined()
      expect(C.get('force-shared')).toBe(shadow)
    })
  })

  describe('ensureSetup / ensureDispose', () => {
    it('ensureSetup runs setup and resolves', async () => {
      const Tools = makeTools()
      const events: string[] = []

      const tool = new Tools({
        name: 'ensure',
        setup() { events.push('setup') },
        func() { return 'ok' },
      })

      await tool.ensureSetup()
      expect(events).toEqual(['setup'])
    })

    it('ensureSetup is idempotent', async () => {
      const Tools = makeTools()
      let count = 0

      const tool = new Tools({
        name: 'ensureIdem',
        setup() { count++ },
        func() { return 'ok' },
      })

      await tool.ensureSetup()
      await tool.ensureSetup()
      expect(count).toBe(1)
    })

    it('ensureDispose runs dispose and resolves', async () => {
      const Tools = makeTools()
      let disposed = false

      const tool = new Tools({
        name: 'ensureDisp',
        setup() {},
        dispose() { disposed = true },
        func() { return 'ok' },
      })

      Tools.register(tool)
      await tool.ensureDispose()
      expect(disposed).toBe(true)
    })
  })

  describe('registerAsync / unregisterAsync', () => {
    it('registerAsync resolves after setup and dependency tree', async () => {
      const Tools = makeTools()
      let depReady = false

      const dep = new Tools({
        name: 'dep',
        async setup() { await Promise.resolve(); depReady = true },
        func() { return 'dep' },
      })

      const parent = new Tools({
        name: 'parent',
        depends: { d: dep },
        func() { return this.runAsSync('d') },
      })

      await Tools.registerAsync(parent)
      expect(depReady).toBe(true)
      expect(parent.isSetupDone()).toBe(true)
      expect(dep.isSetupDone()).toBe(true)
    })

    it('registerAsync rejects when setup throws (tool is un-registered)', async () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'errSetup',
        setup() { throw new Error('setup boom') },
        func() { return 'ok' },
      })

      await expect(Tools.registerAsync(tool)).rejects.toThrow('setup boom')
      expect(Tools.get('errSetup')).toBeUndefined()
    })

    it('registerAsync rejects when async setup rejects', async () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'asyncErrSetup',
        async setup() { throw new Error('async boom') },
        func() { return 'ok' },
      })

      await expect(Tools.registerAsync(tool)).rejects.toThrow('async boom')
    })
  })

  describe('static helpers', () => {
    it('awaitReady resolves a registered tool', async () => {
      const Tools = makeTools()
      let setupDone = false

      const tool = new Tools({
        name: 'ready',
        async setup() { await new Promise(r => setTimeout(r, 5)); setupDone = true },
        func() { return 'ok' },
      })

      Tools.register(tool)
      await Tools.awaitReady('ready')
      expect(setupDone).toBe(true)
    })

    it('awaitReady throws for unknown tool', async () => {
      const Tools = makeTools()
      await expect(Tools.awaitReady('nope')).rejects.toThrow()
    })

    it('createAsync creates and sets up without registering', async () => {
      const Tools = makeTools()

      const tool = await Tools.createAsync({
        name: 'created',
        setup() { (this as any).v = 99 },
        func() { return (this as any).v },
      })

      expect(Tools.get('created')).toBeUndefined()
      expect(tool.runSync()).toBe(99)
    })

    it('whenAllReady resolves when all registered tools are ready', async () => {
      const Tools = makeTools()
      let done1 = false, done2 = false

      const t1 = new Tools({
        name: 't1',
        async setup() { await Promise.resolve(); done1 = true },
        func() { return 1 },
      })
      const t2 = new Tools({
        name: 't2',
        async setup() { await Promise.resolve(); done2 = true },
        func() { return 2 },
      })

      Tools.register(t1)
      Tools.register(t2)

      await Tools.whenAllReady()
      expect(done1).toBe(true)
      expect(done2).toBe(true)
    })
  })

  describe('state sharing across shadow instances', () => {
    it('lifecycle state lives on the root instance', () => {
      const Tools = makeTools()
      const events: string[] = []

      const tool = new Tools({
        name: 'shadow',
        setup() { events.push('setup') },
        dispose() { events.push('dispose') },
        func() { return 'ok' },
      })

      const shadow = tool.with({ extra: 'ctx' })
      expect(shadow._origin).toBe(tool)

      Tools.register(tool)
      expect(events).toEqual(['setup'])

      expect(shadow.runSync()).toBe('ok')
    })

    it('dispose is not double-run for shadow instances', () => {
      const Tools = makeTools()
      const events: string[] = []

      const tool = new Tools({
        name: 'shadowDisp',
        setup() { events.push('setup') },
        dispose() { events.push('dispose') },
        func() { return 'ok' },
      })

      tool.register()
      tool.unregister()
      expect(events).toEqual(['setup', 'dispose'])
    })
  })

  describe('isSetupDone / isSetupPending', () => {
    it('reports setup state correctly for sync setup', () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'state',
        setup() {},
        func() { return 'ok' },
      })

      expect(tool.isSetupDone()).toBe(false)
      tool.register()
      expect(tool.isSetupDone()).toBe(true)
      expect(tool.isSetupPending()).toBe(false)
    })

    it('reports pending correctly for async setup', () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'stateAsync',
        async setup() { await new Promise(r => setTimeout(r, 10)) },
        func() { return 'ok' },
      })

      tool.register()
      expect(tool.isSetupPending()).toBe(true)
    })
  })

  describe('run override applies readiness gate', () => {
    it('run() does not call super before async setup settles', async () => {
      const Tools = makeTools()
      let funcCalled = false
      let release!: () => void
      const gate = new Promise<void>(r => { release = r })

      const tool = new Tools({
        name: 'gate',
        async setup() { await gate },
        func() { funcCalled = true; return 'done' },
      })

      Tools.register(tool)

      const result = tool.run()
      expect(funcCalled).toBe(false)

      release()
      expect(await result).toBe('done')
      expect(funcCalled).toBe(true)
    })

    it('run() passes through immediately when no pending setup', async () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'gateSync',
        setup() {},
        func() { return 'immediate' },
      })

      tool.register()
      const result = await tool.run()
      expect(result).toBe('immediate')
    })
  })

  describe('setup without dispose is idempotent', () => {
    it('multiple registers do not re-run setup', () => {
      const Tools = makeTools()
      const events: string[] = []

      const tool = new Tools({
        name: 'idem',
        setup() { events.push('setup') },
        func() { return 'ok' },
      })

      tool.register()
      tool.register()
      expect(events).toEqual(['setup'])
    })

    it('setup runs even if no setup call in constructor', () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'noSetup',
        func() { return 'no-setup-needed' },
      })

      tool.register()
      expect(tool.runSync()).toBe('no-setup-needed')
      expect(tool.isSetupDone()).toBe(true)
    })
  })

  describe('error handling', () => {
    it('sync setup error unregisters the tool', () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'errSync',
        setup() { throw new Error('sync boom') },
        func() { return 'ok' },
      })

      expect(() => tool.register()).toThrow('sync boom')
      expect(Tools.get('errSync')).toBeUndefined()
    })

    it('failed setup can be retried', () => {
      const Tools = makeTools()
      let attempts = 0

      const tool = new Tools({
        name: 'retry',
        setup() {
          attempts++
          if (attempts === 1) throw new Error('first fail')
        },
        func() { return 'ok' },
      })

      expect(() => tool.register()).toThrow('first fail')
      expect(attempts).toBe(1)

      expect(() => tool.register()).not.toThrow()
      expect(attempts).toBe(2)
      expect(Tools.get('retry')).toBeDefined()
    })

    it('async setup error is observable via ready promise', async () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'asyncErr',
        async setup() { throw new Error('async fail') },
        func() { return 'ok' },
      })

      Tools.register(tool)

      await expect(tool.ready).rejects.toThrow('async fail')
      expect(tool.isSetupPending()).toBe(false)
    })
  })

  describe('clear', () => {
    it('clear works with lifecycle-enhanced registry', () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'clear',
        setup() {},
        dispose() {},
        func() { return 'ok' },
      })

      Tools.register(tool)
      expect(Tools.get('clear')).toBeDefined()

      Tools.clear()
      expect(Tools.get('clear')).toBeUndefined()
    })
  })

  describe('setup hook integration', () => {
    it('should call setup hook and allow modifying options at registration time', () => {
      const Tools = makeTools()
      const tool = new Tools({
        name: 'setupTool',
        title: 'Initial Title',
        setup(options) {
          // setup runs at register time (after initialization), so we modify options
          // and the touched values are replayed through assign()
          if (options) {
            options.title = 'Configured Title';
          }
          (this as any).internalState = 'ready';
        },
        func: function() {
          return `${this.title}-${(this as any).internalState}`;
        }
      })
      // setup has not run yet (it runs at register time, not in constructor)
      expect(tool.title).toBe('Initial Title');

      tool.register();
      // title should be 'Configured Title' because setup modified the options object
      expect(tool.title).toBe('Configured Title');
      expect(tool.runSync()).toBe('Configured Title-ready');
    })

    it('should run setup() hook on the new instance during override', () => {
      const Tools = makeTools()
      let setupCalled = 0
      Tools.register({ name: 'test', func: () => { } })

      Tools.register({
        name: 'test',
        setup() { setupCalled++ },
        func: () => { },
        allowOverride: true
      })

      expect(setupCalled).toBe(1)
    })
  })

  describe('runWithPos override applies readiness gate', () => {
    it('runWithPos() awaits a pending async setup', async () => {
      const Tools = makeTools()
      let release!: () => void
      const gate = new Promise<void>(r => { release = r })
      let funcCalled = false

      const tool = new Tools({
        name: 'posGate',
        async setup() { await gate },
        func(value: string) { funcCalled = true; return value },
      })

      Tools.register(tool)
      expect(tool.isSetupPending()).toBe(true)

      const result = tool.runWithPos('hi')
      expect(funcCalled).toBe(false)

      release()
      expect(await result).toBe('hi')
      expect(funcCalled).toBe(true)
    })

    it('runWithPosSync() still refuses while pending', () => {
      const Tools = makeTools()
      let release!: () => void
      const gate = new Promise<void>(r => { release = r })

      const tool = new Tools({
        name: 'posGateSync',
        async setup() { await gate },
        func(value: string) { return value },
      })

      Tools.register(tool)
      expect(() => tool.runWithPosSync('x')).toThrow(/still pending/)
      release()
    })

    it('runWithPos() refuses before register when dispose hook exists', () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'strictPosAsync',
        setup() {},
        dispose() {},
        func(value: string) { return value },
      })

      expect(() => tool.runWithPos('x')).toThrow(/has not been set up/)
    })

    it('runWithPos() lazily runs setup when no dispose hook exists', () => {
      const Tools = makeTools()
      const events: string[] = []

      const tool = new Tools({
        name: 'lazyPos',
        setup() { events.push('setup') },
        func(value: string) { events.push('func'); return value },
      })

      expect(tool.runWithPos('x')).toBe('x')
      expect(events).toEqual(['setup', 'func'])
    })

    it('runWithPos() passes through when nothing is pending', async () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'posImmediate',
        setup() {},
        func(value: string) { return value },
      })

      tool.register()
      expect(await tool.runWithPos('now')).toBe('now')
    })
  })

  describe('static entry points under pending async setup', () => {
    it('Tools.run(name) awaits a pending async setup', async () => {
      const Tools = makeTools()
      let release!: () => void
      const gate = new Promise<void>(r => { release = r })

      const tool = new Tools({
        name: 'staticRun',
        async setup() { await gate },
        func() { return 'ran' },
      })

      Tools.register(tool)
      const result = Tools.run('staticRun')
      release()
      expect(await result).toBe('ran')
    })

    it('Tools.runSync(name) refuses while pending', () => {
      const Tools = makeTools()
      let release!: () => void
      const gate = new Promise<void>(r => { release = r })

      const tool = new Tools({
        name: 'staticRunSync',
        async setup() { await gate },
        func() { return 'ran' },
      })

      Tools.register(tool)
      expect(() => Tools.runSync('staticRunSync')).toThrow(/still pending/)
      release()
    })

    it('Tools.runWithPos(name) awaits a pending async setup', async () => {
      const Tools = makeTools()
      let release!: () => void
      const gate = new Promise<void>(r => { release = r })

      const tool = new Tools({
        name: 'staticRunWithPos',
        async setup() { await gate },
        func(value: string) { return value },
      })

      Tools.register(tool)
      const result = Tools.runWithPos('staticRunWithPos', 'pos')
      release()
      expect(await result).toBe('pos')
    })

    it('Tools.runWithPosSync(name) refuses while pending', () => {
      const Tools = makeTools()
      let release!: () => void
      const gate = new Promise<void>(r => { release = r })

      const tool = new Tools({
        name: 'staticRunWithPosSync',
        async setup() { await gate },
        func(value: string) { return value },
      })

      Tools.register(tool)
      expect(() => Tools.runWithPosSync('staticRunWithPosSync', 'x')).toThrow(/still pending/)
      release()
    })
  })

  describe('disposed getter', () => {
    it('resolves to the instance before any dispose', async () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'disposedFresh',
        setup() {},
        func() { return 'ok' },
      })

      await expect(tool.disposed).resolves.toBe(tool)
    })

    it('exposes the in-flight dispose promise', async () => {
      const Tools = makeTools()
      let disposed = false

      const tool = new Tools({
        name: 'disposedInFlight',
        setup() {},
        async dispose() { await new Promise(r => setTimeout(r, 10)); disposed = true },
        func() { return 'ok' },
      })

      Tools.register(tool)
      const unregisterResult = Tools.unregister('disposedInFlight')
      expect(disposed).toBe(false)

      await tool.disposed
      expect(disposed).toBe(true)
      expect(unregisterResult).toBe(tool)
    })
  })

  describe('ensureDispose error propagation', () => {
    it('rethrows a synchronous dispose error', async () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'ensureDispSyncErr',
        setup() {},
        dispose() { throw new Error('sync dispose boom') },
        func() { return 'ok' },
      })

      Tools.register(tool)
      await expect(tool.ensureDispose()).rejects.toThrow('sync dispose boom')
    })

    it('rethrows an async dispose error', async () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'ensureDispAsyncErr',
        setup() {},
        async dispose() { throw new Error('async dispose boom') },
        func() { return 'ok' },
      })

      Tools.register(tool)
      await expect(tool.ensureDispose()).rejects.toThrow('async dispose boom')
    })
  })

  describe('dispose failure does not abort unregister cleanup', () => {
    it('records the error, logs it, and still removes the tool', async () => {
      const Tools = makeTools()
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const tool = new Tools({
        name: 'badDispose',
        setup() {},
        dispose() { throw new Error('teardown boom') },
        func() { return 'ok' },
      })

      Tools.register(tool)

      expect(() => Tools.unregister('badDispose')).not.toThrow()
      expect(Tools.get('badDispose')).toBeUndefined()
      expect(errSpy).toHaveBeenCalled()

      // The failure stays observable through the async surface.
      await expect(tool.ensureDispose()).rejects.toThrow('teardown boom')
      errSpy.mockRestore()
    })

    it('records async dispose errors without breaking unregister', async () => {
      const Tools = makeTools()
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const tool = new Tools({
        name: 'badAsyncDispose',
        setup() {},
        async dispose() { throw new Error('async teardown boom') },
        func() { return 'ok' },
      })

      Tools.register(tool)

      expect(() => Tools.unregister('badAsyncDispose')).not.toThrow()
      expect(Tools.get('badAsyncDispose')).toBeUndefined()

      await expect(tool.ensureDispose()).rejects.toThrow('async teardown boom')
      errSpy.mockRestore()
    })
  })

  describe('registerAsync waits for a truly pending dependency', () => {
    it('blocks until the dependency\'s async setup settles', async () => {
      const Tools = makeTools()
      let release!: () => void
      const gate = new Promise<void>(r => { release = r })
      let depReady = false

      const dep = new Tools({
        name: 'gatedDep',
        async setup() { await gate; depReady = true },
        func() { return 'dep' },
      })

      const parent = new Tools({
        name: 'gatedParent',
        depends: { d: dep },
        func() { return 'parent' },
      })

      const ready = Tools.registerAsync(parent)
      expect(depReady).toBe(false)

      release()
      await ready
      expect(depReady).toBe(true)
      expect(parent.isSetupDone()).toBe(true)
      expect(dep.isSetupDone()).toBe(true)
    })
  })

  describe('shadow instances propagate pending state', () => {
    it('shadow.run() awaits the root\'s pending async setup', async () => {
      const Tools = makeTools()
      let release!: () => void
      const gate = new Promise<void>(r => { release = r })

      const tool = new Tools({
        name: 'shadowPending',
        async setup() { await gate; (this as any).v = 'ready' },
        func() { return (this as any).v },
      })

      const shadow = tool.with({ tag: 'ctx' })
      Tools.register(tool)

      expect(shadow.isSetupPending()).toBe(true)
      expect(() => shadow.runSync()).toThrow(/still pending/)

      const result = shadow.run()
      release()
      expect(await result).toBe('ready')
    })
  })

  describe('runSetup re-entrancy', () => {
    it('setup re-registering its own tool does not recurse', () => {
      const Tools = makeTools()
      let setupCount = 0

      const tool = new Tools({
        name: 'reentrant',
        setup() {
          setupCount++
          // A re-entrant registration from inside setup must be a no-op,
          // not infinite recursion.
          Tools.register(tool)
        },
        func() { return 'ok' },
      })

      Tools.register(tool)
      expect(setupCount).toBe(1)
      expect(tool.isSetupDone()).toBe(true)
      expect(Tools.get('reentrant')).toBe(tool)
    })
  })

  describe('whenAllReady with a mixed registry', () => {
    it('handles tools without setup, sync setup and async setup together', async () => {
      const Tools = makeTools()
      let asyncDone = false

      const plain = new Tools({ name: 'plain', func() { return 'plain' } })
      const syncTool = new Tools({ name: 'syncT', setup() {}, func() { return 's' } })
      const asyncTool = new Tools({
        name: 'asyncT',
        async setup() { await new Promise(r => setTimeout(r, 5)); asyncDone = true },
        func() { return 'a' },
      })

      Tools.register(plain)
      Tools.register(syncTool)
      Tools.register(asyncTool)

      await Tools.whenAllReady()
      expect(asyncDone).toBe(true)
    })
  })

  describe('createAsync teardown combo', () => {
    it('an unregistered created tool can be torn down via ensureDispose', async () => {
      const Tools = makeTools()
      let disposed = false

      const tool = await Tools.createAsync({
        name: 'createdDisp',
        setup() {},
        dispose() { disposed = true },
        func() { return 'ok' },
      })

      expect(Tools.get('createdDisp')).toBeUndefined()
      await tool.ensureDispose()
      expect(disposed).toBe(true)
    })
  })

  describe('awaitReady under pending setup', () => {
    it('waits for a pending async setup', async () => {
      const Tools = makeTools()
      let release!: () => void
      const gate = new Promise<void>(r => { release = r })
      let ready = false

      const tool = new Tools({
        name: 'awaitPending',
        async setup() { await gate; ready = true },
        func() { return 'ok' },
      })

      Tools.register(tool)
      const pending = Tools.awaitReady('awaitPending')
      expect(ready).toBe(false)

      release()
      await pending
      expect(ready).toBe(true)
    })
  })
})

