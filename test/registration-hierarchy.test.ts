import { ToolFunc } from "../src/tool-func"
import { describe, it, expect, beforeEach } from 'vitest'

describe('ToolFunc Hierarchical Registry', () => {
  beforeEach(() => {
    // Clear the global registry
    for (const n of Object.keys(ToolFunc.items)) {
      ToolFunc.unregister(n, { force: true })
    }
    if ((ToolFunc as any)._refCounts) {
      (ToolFunc as any)._refCounts = {}
    }
    if ((ToolFunc as any).aliases) {
      (ToolFunc as any).aliases = {}
    }
  })

  it('should isolate registry using isolateRegistry()', () => {
    class MyParent extends ToolFunc { }
    class MyChild extends MyParent { }

    MyChild.isolateRegistry()

    MyParent.register({ name: 'p1-h', func: () => 'parent' })
    MyChild.register({ name: 'c1-h', func: () => 'child' })

    expect(MyParent.get('p1-h')).toBeDefined()
    expect(MyParent.get('c1-h')).toBeUndefined()

    expect(MyChild.get('p1-h')).toBeDefined() // Inherited
    expect(MyChild.get('c1-h')).toBeDefined() // Own
  })

  it('should support shadowing (override inherited tools)', () => {
    class MyParent extends ToolFunc { }
    class MyChild extends MyParent { }
    MyChild.isolateRegistry()

    MyParent.register({ name: 'foo-h', func: () => 'parent' })
    MyChild.register({ name: 'foo-h', func: () => 'child' }) // Should shadow without error

    expect(MyParent.runSync('foo-h')).toBe('parent')
    expect(MyChild.runSync('foo-h')).toBe('child')
  })

  it('should protect namespace when allowOverride is false', () => {
    class MyParent extends ToolFunc { }
    class MyChild extends MyParent { }
    MyChild.isolateRegistry()

    MyParent.register({ name: 'foo-h', func: () => 'parent' })

    // Should throw if shadowing is explicitly disabled via allowOverride: false
    expect(() => {
      MyChild.register({ name: 'foo-h', func: () => 'child', allowOverride: false })
    }).toThrow(/already defined in parent registry/)
  })

  it('should restore parent tool after unregistering shadow', () => {
    class MyParent extends ToolFunc { }
    class MyChild extends MyParent { }
    MyChild.isolateRegistry()

    MyParent.register({ name: 'foo-h', func: () => 'parent' })
    MyChild.register({ name: 'foo-h', func: () => 'child' })

    expect(MyChild.runSync('foo-h')).toBe('child')

    MyChild.unregister('foo-h')
    expect(MyChild.get('foo-h')).toBeDefined()
    expect(MyChild.runSync('foo-h')).toBe('parent') // Parent's tool re-emerges
  })

  it('should handle hierarchical reference counting', () => {
    class MyParent extends ToolFunc { }
    class MyChild extends MyParent { }
    MyChild.isolateRegistry()

    MyParent.register({ name: 'foo-rc', func: () => 'parent' })
    // Parent ref count is 1

    MyChild.register({ name: 'foo-rc', func: () => 'child' })
    // Child ref count is 1 (new own property)

    const getChildRefCount = (name: string) => (MyChild as any)._refCounts[name]
    const getParentRefCount = (name: string) => (MyParent as any)._refCounts[name]

    expect(getParentRefCount('foo-rc')).toBe(1)
    expect(getChildRefCount('foo-rc')).toBe(1)

    MyChild.register('foo-rc') // Increment child's ref count
    expect(getChildRefCount('foo-rc')).toBe(2)
    expect(getParentRefCount('foo-rc')).toBe(1)

    MyChild.unregister('foo-rc')
    expect(getChildRefCount('foo-rc')).toBe(1)

    MyChild.unregister('foo-rc')
    // When local ref count reaches 0, it should be deleted
    expect(Object.prototype.hasOwnProperty.call((MyChild as any)._refCounts, 'foo-rc')).toBe(false)
    expect(getChildRefCount('foo-rc')).toBe(1) // Still 1 because it's inherited from Parent
  })

  it('should support alias polymorphism', () => {
    class MyParent extends ToolFunc { }
    class MyChild extends MyParent { }
    MyChild.isolateRegistry()

    MyParent.register({ name: 'foo-a', alias: 'f-a', func: () => 'parent' })
    MyChild.register({ name: 'foo-a', func: () => 'child' })

    expect(MyChild.get('f-a')).toBeDefined()
    expect(MyChild.runSync('f-a')).toBe('child') // Alias 'f' points to child's shadowed 'foo'
  })

  it('should support partial isolation', () => {
    class MyParent extends ToolFunc { }
    class MyChild extends MyParent { }

    // Only isolate items, share aliases and refCounts
    MyChild.isolateRegistry({ aliases: false, refCounts: false })

    MyParent.register({ name: 'foo-p', alias: 'f-p', func: () => 'parent' })

    expect(MyChild.get('f-p')).toBeDefined()

    // Since aliases are shared, modifying it in Child affects Parent's alias map
    MyChild.register('bar-p', { alias: 'f-p', func: () => 'bar', allowOverride: { alias: true } })

    // Parent's alias map IS updated because it's shared
    expect(MyParent.aliases['f-p']).toBe('bar-p')

    // BUT Parent cannot 'get' it because 'bar-p' only exists in Child's isolated items
    expect(MyParent.get('bar-p')).toBeUndefined()
    expect(MyParent.get('f-p')).toBeUndefined()

    // Child can get it
    expect(MyChild.get('f-p')).toBeDefined()
    expect(MyChild.runSync('f-p')).toBe('bar')
  })

  it('should support multiple levels of shadowing (Grandparent -> Parent -> Child)', () => {
    class G extends ToolFunc { }
    class P extends G { }
    class C extends P { }

    P.isolateRegistry()
    C.isolateRegistry()

    G.register({ name: 'foo-m', func: () => 'g' })
    P.register({ name: 'foo-m', func: () => 'p' })
    C.register({ name: 'foo-m', func: () => 'c' })

    expect(G.runSync('foo-m')).toBe('g')
    expect(P.runSync('foo-m')).toBe('p')
    expect(C.runSync('foo-m')).toBe('c')

    C.unregister('foo-m')
    expect(C.runSync('foo-m')).toBe('p') // Falls back to Parent

    P.unregister('foo-m')
    expect(C.runSync('foo-m')).toBe('g') // Falls back to Grandparent
  })

  it('should handle child tool depending on parent tool', () => {
    class P extends ToolFunc { }
    class C extends P { }
    C.isolateRegistry()

    const pTool = new ToolFunc({ name: 'pTool-d', func: () => 'p' })
    P.register(pTool)

    C.register({
      name: 'cTool-d',
      depends: { p: pTool },
      func: function (this: ToolFunc) { return 'c' + this.runAsSync('p') }
    })

    expect(C.runSync('cTool-d')).toBe('cp')

    // In an isolated registry, C shadows the dependency.
    // P's count remains 1, C gets its own count of 1.
    const getChildRefCount = (name: string) => (C as any)._refCounts[name]
    const getParentRefCount = (name: string) => (P as any)._refCounts[name]

    expect(getParentRefCount('pTool-d')).toBe(1)
    expect(getChildRefCount('pTool-d')).toBe(1)
    expect(Object.prototype.hasOwnProperty.call((C as any)._refCounts, 'pTool-d')).toBe(true)
  })

  it('should handle unregister with scope: inherited', () => {
    class P extends ToolFunc { }
    class C extends P { }
    C.isolateRegistry()

    P.register({ name: 'foo-i', func: () => 'p' })

    // Attempt to unregister from Child with scope 'local' (default)
    C.unregister('foo-i')
    expect(P.get('foo-i')).toBeDefined() // Still there

    // Use scope 'inherited'
    C.unregister('foo-i', { scope: 'inherited' })
    expect(P.get('foo-i')).toBeUndefined() // Removed from Parent!
  })

  it('should handle unregister with scope: all', () => {
    class P extends ToolFunc { }
    class C extends P { }
    C.isolateRegistry()

    P.register({ name: 'foo-all', func: () => 'p' })
    C.register({ name: 'foo-all', func: () => 'c' })

    C.unregister('foo-all', { scope: 'all' })
    expect(C.get('foo-all')).toBeUndefined()
    expect(P.get('foo-all')).toBeUndefined()
  })

  it('should protect against alias collisions from parent', () => {
    class P extends ToolFunc { }
    class C extends P { }
    C.isolateRegistry()

    P.register({ name: 'foo-ac', alias: 'f-ac', func: () => 'p' })

    // Child tries to register a new tool with the same alias 'f-ac'
    expect(() => {
      C.register({ name: 'bar-ac', alias: 'f-ac', func: () => 'b' })
    }).toThrow(/Alias "f-ac" already exists for "foo-ac"/)

    // Unless allowed
    C.register({ name: 'bar-ac', alias: 'f-ac', func: () => 'b', allowOverride: { alias: true } })
    expect(C.runSync('f-ac')).toBe('b')
    expect(P.aliases['f-ac']).toBe('foo-ac') // Parent is untouched because aliases are isolated
  })
  it('should force unregister all occurrences in the chain', () => {
    class G extends ToolFunc { }
    class P extends G { }
    class C extends P { }
    P.isolateRegistry()
    C.isolateRegistry()

    G.register({ name: 'foo-f', func: () => 'g' })
    P.register({ name: 'foo-f', func: () => 'p' })
    C.register({ name: 'foo-f', func: () => 'c' })

    C.unregister('foo-f', { force: true, scope: 'all' })
    expect(C.get('foo-f')).toBeUndefined()
    expect(P.get('foo-f')).toBeUndefined()
    expect(G.get('foo-f')).toBeUndefined()
  })

  it('should handle circular dependencies across layers', () => {
    class P extends ToolFunc { }
    class C extends P { }
    C.isolateRegistry()

    const toolA = new ToolFunc({ name: 'A-circ' })
    const toolB = new ToolFunc({ name: 'B-circ', depends: { a: toolA } })
    toolA.depends = { b: toolB }

    P.register(toolA) // P has A (1) and B (1)

    // Shadow A in Child
    C.register({ name: 'A-circ', func: () => 'shadow-a' })

    expect(C.runSync('A-circ')).toBe('shadow-a')

    // Check counts: P's A should still be 1 (held by P's B), B is 1
    // C's A is 1
    expect((P as any)._refCounts['A-circ']).toBe(1)
    expect((C as any)._refCounts['A-circ']).toBe(1)
  })

  it('should restore parent alias after unregistering shadowed alias', () => {
    class P extends ToolFunc { }
    class C extends P { }
    C.isolateRegistry()

    P.register({ name: 'foo-ra', alias: 'f-ra', func: () => 'p' })
    // Child shadows only the alias - must specify allowOverride for safety
    C.register({ name: 'bar-ra', alias: 'f-ra', func: () => 'c', allowOverride: { alias: true } })

    expect(C.runSync('f-ra')).toBe('c')

    C.unregister('f-ra') // Should remove local alias 'f-ra' -> 'bar-ra'
    expect(C.runSync('f-ra')).toBe('p') // Should fall back to P's alias 'f-ra' -> 'foo-ra'
  })

  it('should prefer shadowed dependency over parent dependency', () => {
    class P extends ToolFunc { }
    class C extends P { }
    C.isolateRegistry()

    P.register({ name: 'dep', func: () => 'p-dep' })
    P.register({
      name: 'main',
      func: function (this: ToolFunc) { return this.runAsSync('dep') }
    })

    // C shadows 'dep'
    C.register({ name: 'dep', func: () => 'c-dep' })

    // When running 'main' from C, it should use C's 'dep' due to polymorphism
    expect(C.runSync('main')).toBe('c-dep')
    expect(P.runSync('main')).toBe('p-dep')
  })

  describe('Binding Strategies (Early/Late/Auto)', () => {
    class G extends ToolFunc { } // Grandparent
    class P extends G { }        // Parent
    class C extends P { }        // Child

    beforeEach(() => {
      G.clear(); P.clear(); C.clear();
      P.isolateRegistry();
      C.isolateRegistry();
    })

    it('should use early binding for same-scope overrides (Stability)', () => {
      const depV1 = new ToolFunc({ name: 'dep', func: () => 'v1' })
      P.register(depV1)
      P.register({
        name: 'main',
        depends: { dep: depV1 }, // Explicitly bind to v1
        func: function (this: ToolFunc) { return this.runAsSync('dep') }
      })

      // Override dep in the SAME registry with v2
      P.register({ name: 'dep', func: () => 'v2', allowOverride: true })

      expect(P.runSync('dep')).toBe('v2')
      // Existing tool 'main' should STILL use its pre-bound 'v1' instance
      expect(P.runSync('main')).toBe('v1')
    })

    it('should support explicit late binding even in same scope', () => {
      const depV1 = new ToolFunc({ name: 'dep', func: () => 'v1' })
      P.register(depV1)
      P.register({
        name: 'main',
        depends: { dep: depV1 },
        func: function (this: ToolFunc, p, ctx) {
          return this.runAsSync('dep', p, { ...ctx, binding: 'late' })
        }
      })

      P.register({ name: 'dep', func: () => 'v2', allowOverride: true })

      // Forced late binding picks up the new 'v2' even though we have a pre-bound v1
      expect(P.runSync('main')).toBe('v2')
    })

    it('should support explicit early binding even in shadowed subclass', () => {
      const depP = new ToolFunc({ name: 'dep', func: () => 'p-dep' })
      P.register(depP)
      P.register({
        name: 'main',
        depends: { dep: depP },
        func: function (this: ToolFunc, p, ctx) {
          return this.runAsSync('dep', p, { ...ctx, binding: 'early' })
        }
      })

      C.register({ name: 'dep', func: () => 'c-dep' })

      // Even though C has a shadow, we forced 'early' binding
      expect(C.runSync('main')).toBe('p-dep')
    })

    it('should respect grandparent-child lineage in auto mode', () => {
      const depG = new ToolFunc({ name: 'dep', func: () => 'g-dep' })
      G.register(depG)
      G.register({
        name: 'main',
        depends: { dep: depG },
        func: function () { return this.runAsSync('dep') }
      })

      // Child shadows dep (Grandparent's main is called from Child)
      C.register({ name: 'dep', func: () => 'c-dep' })

      // G is G, P is G's child, C is G's grandchild. Auto mode should work.
      expect(C.runSync('main')).toBe('c-dep')
    })

    it('should NOT shadow for unrelated registries (No lineage)', () => {
      class Unrelated extends ToolFunc { }
      Unrelated.isolateRegistry()

      const depP = new ToolFunc({ name: 'dep', func: () => 'p-dep' })
      P.register(depP)
      P.register({
        name: 'main',
        depends: { dep: depP },
        func: function () { return this.runAsSync('dep') }
      })

      Unrelated.register({ name: 'dep', func: () => 'u-dep' })

      // Running P's main from an unrelated context (if forced)
      // It should NOT use Unrelated's dep because there is no lineage.
      expect(P.runSync('main', {}, { rootRegistry: Unrelated })).toBe('p-dep')
    })

    it('should support multi-level shadowing (G->P->C) where P is the active shadow', () => {
      const depG = new ToolFunc({ name: 'dep', func: () => 'g-dep' })
      G.register(depG)
      G.register({
        name: 'main',
        depends: { dep: depG },
        func: function () { return this.runAsSync('dep') }
      })

      // P shadows dep
      P.register({ name: 'dep', func: () => 'p-dep' })

      // C inherits from P, does NOT shadow dep
      // Running C.runSync('main') should find P's shadow because C is descendant of G,
      // and P (as part of C's lookup chain) has the shadow.
      expect(C.runSync('main')).toBe('p-dep')
    })

    it('should maintain binding context across asynchronous calls', async () => {
      const depP = new ToolFunc({ name: 'dep', func: async () => 'p-dep' })
      P.register(depP)
      P.register({
        name: 'asyncMain',
        depends: { dep: depP },
        func: async function (this: ToolFunc) {
          const res = await this.runAs('dep')
          return `main-${res}`
        }
      })

      C.register({ name: 'dep', func: async () => 'c-dep' })

      const result = await C.run('asyncMain')
      expect(result).toBe('main-c-dep')
    })

    it('should allow manual rootRegistry injection to cross-pollinate', () => {
      class OtherBranch extends ToolFunc { }
      OtherBranch.isolateRegistry()
      OtherBranch.register({ name: 'dep', func: () => 'other-dep' })

      const depP = new ToolFunc({ name: 'dep', func: () => 'p-dep' })
      P.register(depP)
      P.register({ name: 'main', depends: { dep: depP }, func: function () { return this.runAsSync('dep') } })

      // Explicitly forcing P's main to resolve dependencies from OtherBranch
      expect(P.runSync('main', {}, { rootRegistry: OtherBranch, binding: 'late' })).toBe('other-dep')
    })

    it('should support alias-based shadowing in auto mode', () => {
      P.register({ name: 'dep-impl', alias: 'dep-a', func: () => 'p-dep' })
      P.register({ name: 'main', func: function (this: ToolFunc) { return this.runAsSync('dep-a') } })

      // Child shadows only the ALIAS, pointing to a new tool
      C.register({ name: 'c-new-dep', alias: 'dep-a', func: () => 'c-dep', allowOverride: { alias: true } })

      // Auto mode should detect the local shadow in aliases map
      expect(C.runSync('main')).toBe('c-dep')
    })
  })

  it('should be safe to call isolateRegistry multiple times', () => {
    class MyTools extends ToolFunc { }
    MyTools.isolateRegistry()
    const items1 = MyTools.items

    MyTools.isolateRegistry()
    expect(MyTools.items).not.toBe(items1) // It creates a new layer on top of the previous isolation

    MyTools.register({ name: 'test-iso', func: () => 'ok' })
    expect(Object.prototype.hasOwnProperty.call(MyTools.items, 'test-iso')).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(items1, 'test-iso')).toBe(false)
  })
})



