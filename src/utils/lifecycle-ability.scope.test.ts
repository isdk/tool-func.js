import { describe, expect, it } from 'vitest'
import { ToolFunc } from '../tool-func'
import { makeToolFuncLifecycle } from './lifecycle-ability'

// The funcs below deliberately read a *free variable*: it is `scope` that binds it, at compile
// time.
declare const secretValue: number

/** Creates a fresh, isolated enhanced ToolFunc class for each test. */
function makeTools() {
  const Tools = makeToolFuncLifecycle(ToolFunc)
  Tools.clear()
  return Tools
}

/**
 * `scope` is a *compile-time* input of a string `func`: `_createFunction` captures the scope's
 * values while compiling the function-expression string. `setup` therefore has to be able to
 * provide or replace the scope *before* the func is compiled — which is what it did when it ran
 * in the constructor. These tests pin that ordering down for every entry point.
 */
describe('LifecycleAbility scope', () => {
  describe('scope provided by setup', () => {
    it('compiles a string func against a scope assigned to `this`', () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'thisScope',
        func: '() => secretValue',
        setup() { this.scope = { secretValue: 42 } },
      })
      tool.register()

      expect(tool.runSync()).toBe(42)
    })

    it('applies a scope written into the received options', () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'optionsScope',
        func: '() => secretValue',
        setup(options: any) { options.scope = { secretValue: 42 } },
      })
      tool.register()

      expect(tool.runSync()).toBe(42)
    })

    it('waits for an async setup before compiling the func', async () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'asyncScope',
        func: '() => secretValue',
        async setup() {
          await Promise.resolve()
          this.scope = { secretValue: 42 }
        },
      })

      const registered = Tools.registerAsync(tool)
      await registered

      expect(tool.runSync()).toBe(42)
    })

    it('sets up lazily on first run when the tool was never registered', () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'lazyScope',
        func: '() => secretValue',
        setup() { this.scope = { secretValue: 42 } },
      })

      expect(tool.runSync()).toBe(42)
    })

    it('rebuilds the func again on every registration lifetime', () => {
      const Tools = makeTools()
      let n = 0

      const tool = new Tools({
        name: 'reScope',
        func: '() => secretValue',
        setup() { this.scope = { secretValue: ++n } },
        dispose() {},
      })

      tool.register()
      expect(tool.runSync()).toBe(1)

      tool.unregister()
      tool.register()
      expect(tool.runSync()).toBe(2)
    })
  })

  describe('scope already carried by the options', () => {
    it('rebinds a function func to a scope that setup provides', () => {
      const Tools = makeTools()

      const tool = new Tools({
        name: 'fnFuncScope',
        func: () => secretValue,
        setup() { this.scope = { secretValue: 42 } },
      })
      tool.register()

      expect(tool.runSync()).toBe(42)
    })

    it('applies a new scope before compiling the func in the same assign()', () => {
      const Tools = makeTools()

      const tool = new Tools({ name: 'reassignedScope', func: '() => secretValue', scope: { secretValue: 1 } })
      expect(tool.runSync()).toBe(1)

      tool.assign({ scope: { secretValue: 42 }, func: '() => secretValue' })
      expect(tool.runSync()).toBe(42)
    })

  })

  describe('scope changes that must not clobber the tool', () => {
    it('keeps a `func` that setup replaced directly', () => {
      const Tools = makeTools()
      const replacement = () => 'replacement'

      const tool = new Tools({
        name: 'directFunc',
        func: '() => secretValue',
        setup() {
          this.scope = { secretValue: 42 }
          this.func = replacement
        },
      })
      tool.register()

      expect(tool.func).toBe(replacement)
      expect(tool.runSync()).toBe('replacement')
    })

    it('leaves the func untouched when setup does not change the scope', () => {
      const Tools = makeTools()
      const impl = () => 'impl'

      const tool = new Tools({
        name: 'plainFunc',
        func: impl,
        setup() { this.title = 'patched' },
      })
      tool.register()

      expect(tool.func).toBe(impl)
      expect(tool.runSync()).toBe('impl')
    })
  })
})
