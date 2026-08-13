import { ToolFunc } from "../src/tool-func"
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { getRefCount } from './test-util'

describe('ToolFunc Registration & Reference Counting', () => {
  beforeEach(() => {
    ToolFunc.clear()
  })

  it('should increment refCount on registration', () => {
    ToolFunc.register({ name: 'test', func: () => 'v1' })
    expect(getRefCount('test')).toBe(1)
  })

  it('should not allow override by default', () => {
    ToolFunc.register({ name: 'test', func: () => 'v1' })
    const result = ToolFunc.register({ name: 'test', func: () => 'v2' })
    expect(result).toBe(false)
    expect(ToolFunc.runSync('test')).toBe('v1')
    expect(getRefCount('test')).toBe(2) // 计数仍会增加，表示有多次注册尝试/需求
  })

  it('should allow override when allowOverride is true', () => {
    ToolFunc.register({ name: 'test', func: () => 'v1' })
    ToolFunc.register({ name: 'test', func: () => 'v2', allowOverride: true })
    expect(ToolFunc.runSync('test')).toBe('v2')
    expect(getRefCount('test')).toBe(1) // 覆盖会替换槽位，计数应保持为1
  })

  it('should handle dependencies refCount', () => {
    const sub = new ToolFunc({ name: 'sub', func: () => 'sub' })
    const parent = new ToolFunc({
      name: 'parent',
      depends: { mySub: sub },
      func: function () { return this.runAsSync('mySub') }
    })

    parent.register()
    expect(getRefCount('parent')).toBe(1)
    expect(getRefCount('sub')).toBe(1)

    // 再次手动注册 sub
    ToolFunc.register(sub)
    expect(getRefCount('sub')).toBe(2)

    ToolFunc.unregister('parent')
    expect(ToolFunc.get('parent')).toBeUndefined()
    expect(getRefCount('sub')).toBe(1) // sub 还没被彻底卸载，因为还有手动注册的引用
    expect(ToolFunc.get('sub')).toBeDefined()

    ToolFunc.unregister('sub')
    expect(ToolFunc.get('sub')).toBeUndefined()
  })

  it('should warn when overriding a function with multiple references', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

    // 模拟一个依赖
    const sub = new ToolFunc({ name: 'sub', func: () => 'v1' })
    new ToolFunc({ name: 'parent', depends: { s: sub }, func: () => { } }).register()

    // 此时 sub refCount 为 1 (来自 parent)
    // 再次覆盖 sub
    ToolFunc.register({ name: 'sub', func: () => 'v2', allowOverride: true })

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Overriding "sub" which is held by'))
    warnSpy.mockRestore()
  })

  it('should support safe shadowing (old instance lives if referenced)', () => {
    const subV1 = new ToolFunc({ name: 'sub', func: () => 'v1' })
    const parent = new ToolFunc({
      name: 'parent',
      depends: { mySub: subV1 },
      func: function () { return this.runAsSync('mySub') }
    })
    parent.register()

    // 覆盖全局 sub
    ToolFunc.register({ name: 'sub', func: () => 'v2', allowOverride: true })

    expect(ToolFunc.runSync('sub')).toBe('v2') // 全局拿到 v2
    expect(ToolFunc.runSync('parent')).toBe('v1') // parent 内部引用的实例依然是 v1 (影子模式)
  })

  it('should remove old aliases during override', () => {
    ToolFunc.register({ name: 'test', alias: 'oldAlias', func: () => 'v1' })
    expect(ToolFunc.get('oldAlias')).toBeDefined()

    ToolFunc.register({ name: 'test', alias: 'newAlias', func: () => 'v2', allowOverride: true })
    expect(ToolFunc.get('newAlias')).toBeDefined()
    expect(ToolFunc.get('oldAlias')).toBeUndefined() // Should be removed
  })

  it('should handle deep dependency chains (A -> B -> C)', () => {
    const c = new ToolFunc({ name: 'c', func: () => 'c' })
    const b = new ToolFunc({ name: 'b', depends: { c }, func: () => 'b' })
    const a = new ToolFunc({ name: 'a', depends: { b }, func: () => 'a' })

    a.register()
    expect(getRefCount('a')).toBe(1)
    expect(getRefCount('b')).toBe(1)
    expect(getRefCount('c')).toBe(1)

    ToolFunc.unregister('a')
    expect(ToolFunc.get('a')).toBeUndefined()
    expect(ToolFunc.get('b')).toBeUndefined()
    expect(ToolFunc.get('c')).toBeUndefined()
  })

  it('should handle multiple parents for one dependency', () => {
    const common = new ToolFunc({ name: 'common', func: () => 'common' })
    const p1 = new ToolFunc({ name: 'p1', depends: { common }, func: () => 'p1' })
    const p2 = new ToolFunc({ name: 'p2', depends: { common }, func: () => 'p2' })

    p1.register()
    p2.register()
    expect(getRefCount('common')).toBe(2)

    ToolFunc.unregister('p1')
    expect(ToolFunc.get('common')).toBeDefined()
    expect(getRefCount('common')).toBe(1)

    ToolFunc.unregister('p2')
    expect(ToolFunc.get('common')).toBeUndefined()
  })

  it('should update dependencies when overriding (A(V1)->B to A(V2)->C)', () => {
    const b = new ToolFunc({ name: 'b', func: () => 'b' })
    const c = new ToolFunc({ name: 'c', func: () => 'c' })

    // V1 depends on b
    ToolFunc.register({
      name: 'a',
      depends: { dep: b },
      func: () => 'v1'
    })
    expect(getRefCount('b')).toBe(1)
    expect(getRefCount('c')).toBeUndefined()

    // V2 depends on c
    ToolFunc.register({
      name: 'a',
      depends: { dep: c },
      func: () => 'v2',
      allowOverride: true
    })

    expect(getRefCount('b')).toBeUndefined() // b should be released
    expect(getRefCount('c')).toBe(1) // c should be acquired
    expect(ToolFunc.get('a')?.depends?.dep).toBe(c)
  })

  it('should handle circular dependencies safely', () => {
    const a = new ToolFunc({ name: 'a', func: () => 'a' })
    const b = new ToolFunc({ name: 'b', func: () => 'b' })
    a.depends = { b }
    b.depends = { a }

    a.register()
    expect(getRefCount('a')).toBe(1)
    expect(getRefCount('b')).toBe(1)

    // Force unregister to break cycle
    ToolFunc.unregister('a', true)
    expect(ToolFunc.get('a')).toBeUndefined()
    expect(ToolFunc.get('b')).toBeUndefined()
  })

  it('should honor the internal _stack passed via options (back-edge detection)', () => {
    const dep = new ToolFunc({ name: 'stackDep', func: () => 'dep' })
    // Simulate a recursive registration where 'stackDep' is already in the call stack
    const result = ToolFunc.register(dep, { _stack: new Set(['stackDep']) } as any)
    expect(result).toBe(false) // Back-edge: ignored, no re-entry
    expect(ToolFunc.get('stackDep')).toBeUndefined()
    expect(getRefCount('stackDep')).toBeUndefined()
  })

  it('should honor the internal _stack carried in the first-arg config object', () => {
    // The stack may arrive inside the 1st-arg object (not only in the 2nd-arg options),
    // and must still be extracted before normalization/instance construction.
    const stack = new Set(['stackArg1'])
    const arg = { name: 'stackArg1', func: () => 'x', _stack: stack } as any
    const result = ToolFunc.register(arg)
    expect(result).toBe(false) // Back-edge: ignored, no re-entry
    expect(ToolFunc.get('stackArg1')).toBeUndefined()
    expect(getRefCount('stackArg1')).toBeUndefined()
    // The caller's first-arg object must stay untouched (normalization copies it)
    expect(arg._stack).toBe(stack)

    // A non-back-edge stack in the 1st-arg object must not leak onto the instance either
    ToolFunc.register({ name: 'stackArg1', func: () => 'x', _stack: new Set() } as any)
    const inst = ToolFunc.get('stackArg1')!
    expect(inst.func!()).toBe('x')
    expect((inst as any)._stack).toBeUndefined()
    expect(getRefCount('stackArg1')).toBe(1)
  })

  it('should strip a _stack passed to direct construction (no leak onto the instance)', () => {
    // register() is not involved here: the constructor must still consume the
    // internal stack so it never becomes instance state.
    const stack = new Set(['ctorDirect'])
    const arg = { name: 'ctorDirect', func: () => 'c', _stack: stack } as any
    const inst = new ToolFunc(arg)
    expect(inst.func!()).toBe('c')
    expect((inst as any)._stack).toBeUndefined()
    // The caller's construction object must stay untouched too
    expect(arg._stack).toBe(stack)
  })

  it('should not mutate a caller-provided options object when extracting _stack', () => {
    const stack = new Set()
    const opts = { title: 'Keep', _stack: stack } as any
    const dep = new ToolFunc({ name: 'stackNoMut', func: () => 'd' })

    ToolFunc.register(dep, opts)

    // The caller's object must stay untouched: extraction works on the normalized copy.
    expect(opts._stack).toBe(stack)
    expect(opts.title).toBe('Keep')
    expect(ToolFunc.get('stackNoMut')).toBe(dep)
    expect(dep.title).toBe('Keep')
    expect((dep as any)._stack).toBeUndefined()
  })

  it('should consume options._stack without leaking it onto the instance', () => {
    ToolFunc.register('stackDep2', { func: '() => 1', _stack: new Set() } as any)
    const inst = ToolFunc.get('stackDep2')!
    expect(inst.func!()).toBe(1)
    expect((inst as any)._stack).toBeUndefined()
  })

  it('should merge other options alongside the internal _stack', () => {
    const dep = new ToolFunc({ name: 'stackMix', func: () => 'dep' })
    const r = ToolFunc.register(dep, { title: 'Mixed', _stack: new Set() } as any)
    expect(r).toBe(dep)
    expect(ToolFunc.get('stackMix')).toBe(dep)
    expect(dep.title).toBe('Mixed')
    expect((dep as any)._stack).toBeUndefined()
    expect(getRefCount('stackMix')).toBe(1)
  })

  it('should register dependencies declared in the 3-arg config (name, funcString, config)', () => {
    const dep = new ToolFunc({ name: 'depCfg', func: () => 'dep' })
    ToolFunc.register('mainCfg', '() => "main"', { depends: { d: dep } })
    expect(ToolFunc.get('mainCfg')).toBeDefined()
    expect(ToolFunc.get('depCfg')).toBeDefined()
    expect(getRefCount('depCfg')).toBe(1)
    expect(ToolFunc.runSync('mainCfg')).toBe('main')
  })

  it('should unregister via alias', () => {
    ToolFunc.register({ name: 'test', alias: 'myAlias', func: () => 'val' })
    expect(getRefCount('test')).toBe(1)

    ToolFunc.unregister('myAlias')
    expect(ToolFunc.get('test')).toBeUndefined()
    expect(getRefCount('test')).toBeUndefined()
  })

  it('should cleanup all aliases during multi-alias override', () => {
    ToolFunc.register({ name: 'test', alias: ['a1', 'a2'], func: () => 'v1' })
    expect(ToolFunc.get('a1')).toBeDefined()
    expect(ToolFunc.get('a2')).toBeDefined()

    ToolFunc.register({ name: 'test', alias: ['a3'], func: () => 'v2', allowOverride: true })
    expect(ToolFunc.get('a3')).toBeDefined()
    expect(ToolFunc.get('a1')).toBeUndefined()
    expect(ToolFunc.get('a2')).toBeUndefined()
  })

  it('should handle circular dependency override (A<->B, override A to A->C)', () => {
    const aV1 = new ToolFunc({ name: 'a', func: () => 'av1' })
    const b = new ToolFunc({ name: 'b', func: () => 'b' })
    const c = new ToolFunc({ name: 'c', func: () => 'c' })
    aV1.depends = { b }
    b.depends = { a: aV1 }

    aV1.register()
    expect(getRefCount('a')).toBe(1)
    expect(getRefCount('b')).toBe(1)

    // Override A with A->C
    ToolFunc.register({
      name: 'a',
      depends: { c },
      func: () => 'av2',
      allowOverride: true
    })

    // Global 'a' is now V2
    // V2 depends on C, so C ref is 1
    // V2 no longer depends on B, but OldV1 (still in memory via B's reference) depended on B.
    // Wait, the override logic calls unregister(name, true) on the OLD global entry.
    // Unregister(a, true) will decrement refCount, see force=true, and call _releaseDependencies(OldV1).
    // _releaseDependencies(OldV1) will unregister(b).
    // So B's refCount becomes 0 and B is removed.
    // Since B is removed, its _releaseDependencies(OldV1) is called, decrementing A's refCount.

    expect(ToolFunc.get('b')).toBeUndefined()
    expect(getRefCount('b')).toBeUndefined()
    expect(getRefCount('c')).toBe(1)
    expect(getRefCount('a')).toBe(1) // Only the new direct registration
  })

  it('should maintain consistent refCounts across different registration overloads', () => {
    // Overload 1: Named function
    function test() { }
    ToolFunc.register(test, {})
    expect(getRefCount('test')).toBe(1)

    // Overload 2: Config object
    ToolFunc.register({ name: 'test', func: () => { } })
    expect(getRefCount('test')).toBe(2)

    // Overload 3: ToolFunc instance
    const inst = new ToolFunc({ name: 'test', func: () => { } })
    ToolFunc.register(inst)
    expect(getRefCount('test')).toBe(3)
  })

  it('should force unregister even if shared by multiple parents', () => {
    const dep = new ToolFunc({ name: 'dep', func: () => 'dep' })
    const p1 = new ToolFunc({ name: 'p1', depends: { dep }, func: () => { } })
    const p2 = new ToolFunc({ name: 'p2', depends: { dep }, func: () => { } })
    p1.register()
    p2.register()

    expect(getRefCount('dep')).toBe(2)

    // Force unregister dep
    ToolFunc.unregister('dep', true)

    expect(ToolFunc.get('dep')).toBeUndefined()
    expect(getRefCount('dep')).toBeUndefined()

    // Parents are still there but their dependency is missing in registry
    expect(ToolFunc.get('p1')).toBeDefined()
  })

  it('should handle very deep recursive registration stablely', () => {
    const depth = 10
    let last = new ToolFunc({ name: 'level' + depth, func: () => depth })
    for (let i = depth - 1; i >= 0; i--) {
      last = new ToolFunc({
        name: 'level' + i,
        depends: { next: last },
        func: () => i
      })
    }

    last.register()
    for (let i = 0; i <= depth; i++) {
      expect(ToolFunc.get('level' + i)).toBeDefined()
      expect((ToolFunc as any)._refCounts['level' + i]).toBe(1)
    }

    ToolFunc.unregister('level0')
    for (let i = 0; i <= depth; i++) {
      expect(ToolFunc.get('level' + i)).toBeUndefined()
    }
  })

  it('should handle unregister options {force: true, decrement: "once"} for override-like behavior', () => {
    const dep = new ToolFunc({ name: 'dep', func: () => 'dep' })
    ToolFunc.register(dep)
    ToolFunc.register(dep) // refCount = 2
    expect(getRefCount('dep')).toBe(2)

    // 模拟覆盖：强制物理删除但仅减一
    ToolFunc.unregister('dep', { force: true, decrement: 'once' })

    expect(ToolFunc.get('dep')).toBeUndefined()
    expect(getRefCount('dep')).toBe(1)
  })

  it('should handle unregister options {force: false, decrement: "all"}', () => {
    const dep = new ToolFunc({ name: 'dep', func: () => 'dep' })
    ToolFunc.register(dep)
    ToolFunc.register(dep) // refCount = 2

    // 不强制物理删除，但清空计数。由于计数清空后被视为0，它应该也会触发物理删除。
    ToolFunc.unregister('dep', { force: false, decrement: 'all' })

    expect(ToolFunc.get('dep')).toBeUndefined()
    expect(getRefCount('dep')).toBeUndefined()
  })

  it('should completely release dependencies when an override removes them', () => {
    const b = new ToolFunc({ name: 'b', func: () => 'b' })
    const aV1 = new ToolFunc({ name: 'a', depends: { b }, func: () => 'v1' })
    aV1.register()
    expect(ToolFunc.get('b')).toBeDefined()

    // Override A with NO dependencies
    ToolFunc.register({ name: 'a', func: () => 'v2', allowOverride: true })

    expect(ToolFunc.get('b')).toBeUndefined()
    expect(getRefCount('b')).toBeUndefined()
  })

  it('should handle dependencies registered via alias', () => {
    const b = new ToolFunc({ name: 'b', alias: 'bAlias', func: () => 'b' })
    const a = new ToolFunc({ name: 'a', depends: { dep: b }, func: () => 'a' })

    a.register()
    expect(getRefCount('b')).toBe(1)

    ToolFunc.unregister('bAlias') // Should decrement 'b' refCount
    expect(getRefCount('b')).toBeUndefined()
    expect(ToolFunc.get('b')).toBeUndefined()
  })

  it('should handle dynamic alias removal via override', () => {
    ToolFunc.register({ name: 'test', alias: ['a1', 'a2'], func: () => 'v1' })

    // Override and remove a2, keep a1, add a3
    ToolFunc.register({ name: 'test', alias: ['a1', 'a3'], func: () => 'v2', allowOverride: true })

    expect(ToolFunc.get('a1')).toBeDefined()
    expect(ToolFunc.get('a3')).toBeDefined()
    expect(ToolFunc.get('a2')).toBeUndefined()
  })

  it('should handle deep complex DAG (Directed Acyclic Graph)', () => {
    //   A
    //  / \
    // B   C
    //  \ / \
    //   D   E
    const e = new ToolFunc({ name: 'e', func: () => 'e' })
    const d = new ToolFunc({ name: 'd', func: () => 'd' })
    const c = new ToolFunc({ name: 'c', depends: { d, e }, func: () => 'c' })
    const b = new ToolFunc({ name: 'b', depends: { d }, func: () => 'b' })
    const a = new ToolFunc({ name: 'a', depends: { b, c }, func: () => 'a' })

    a.register()
    expect(getRefCount('d')).toBe(2) // from B and C
    expect(getRefCount('e')).toBe(1) // from C

    ToolFunc.unregister('a')
    expect(ToolFunc.get('a')).toBeUndefined()
    expect(ToolFunc.get('b')).toBeUndefined()
    expect(ToolFunc.get('c')).toBeUndefined()
    expect(ToolFunc.get('d')).toBeUndefined()
    expect(ToolFunc.get('e')).toBeUndefined()
  })

  it('should handle sequential overrides (V1 -> V2 -> V3)', () => {
    const d1 = new ToolFunc({ name: 'd1', func: () => 'd1' })
    const d2 = new ToolFunc({ name: 'd2', func: () => 'd2' })
    const d3 = new ToolFunc({ name: 'd3', func: () => 'd3' })

    // V1 depends on d1
    ToolFunc.register({ name: 'main', depends: { d: d1 }, func: () => 'v1' })
    expect(getRefCount('d1')).toBe(1)

    // V2 depends on d2
    ToolFunc.register({ name: 'main', depends: { d: d2 }, func: () => 'v2', allowOverride: true })
    expect(getRefCount('d1')).toBeUndefined()
    expect(getRefCount('d2')).toBe(1)

    // V3 depends on d3
    ToolFunc.register({ name: 'main', depends: { d: d3 }, func: () => 'v3', allowOverride: true })
    expect(getRefCount('d2')).toBeUndefined()
    expect(getRefCount('d3')).toBe(1)
    expect(getRefCount('main')).toBe(1)
  })

  it('should be atomic if a dependency fails to register', () => {
    ToolFunc.register({ name: 'other', alias: 'collision', func: () => { } })

    const depWithCollision = new ToolFunc({
      name: 'dep',
      alias: 'collision',
      func: () => { }
    })

    const parent = new ToolFunc({
      name: 'parent',
      depends: { sub: depWithCollision },
      func: () => { }
    })

    // Registration of 'parent' should fail because its dependency 'dep' has an alias collision
    expect(() => parent.register()).toThrow('Alias "collision" already exists')

    expect(ToolFunc.get('parent')).toBeUndefined()
    expect(ToolFunc.get('dep')).toBeUndefined()
    expect(getRefCount('parent')).toBeUndefined()
  })

  it('should run setup() hook on the new instance during override', () => {
    let setupCalled = 0
    ToolFunc.register({ name: 'test', func: () => { } })

    ToolFunc.register({
      name: 'test',
      setup() { setupCalled++ },
      func: () => { },
      allowOverride: true
    })

    expect(setupCalled).toBe(1)
  })

  it('should maintain DAG integrity when a middle node is replaced', () => {
    // A -> B -> C
    const c = new ToolFunc({ name: 'c', func: () => 'c' })
    const b1 = new ToolFunc({ name: 'b', depends: { c }, func: () => 'b1' })
    const a = new ToolFunc({ name: 'a', depends: { b: b1 }, func: () => 'a' })

    a.register()

    // Replace B with B2 (which still depends on C)
    const b2 = new ToolFunc({ name: 'b', depends: { c }, func: () => 'b2' })
    ToolFunc.register(b2, { allowOverride: true })

    expect(ToolFunc.runSync('b')).toBe('b2')
    expect(ToolFunc.runSync('a')).toBe('a')
    // In shadow mode, 'a' still uses 'b1'
    const aInst = ToolFunc.get('a')!
    expect(aInst.runAsSync('b')).toBe('b1')

    // C's refCount should be 1 (now only held by the official b2)
    // b1 survives via shadowing but does not occupy a registry slot for C anymore
    expect(getRefCount('c')).toBe(1)

    ToolFunc.unregister('a')
    expect(ToolFunc.get('b')).toBeUndefined()
    expect(getRefCount('c')).toBeUndefined()
  })

  it('should update metadata properties during override', () => {
    ToolFunc.register({ name: 'meta', isApi: false, stream: false })

    ToolFunc.register({
      name: 'meta',
      isApi: true,
      stream: true,
      allowOverride: true
    })

    const inst = ToolFunc.get('meta')!
    expect(inst.isApi).toBe(true)
    expect(inst.stream).toBe(true)
  })

  it('should support allowOverride in all register overloads', () => {
    // 1. (func, options)
    const f1 = () => 'f1'
    ToolFunc.register(f1, { name: 'f' })
    ToolFunc.register(() => 'f2', { name: 'f', allowOverride: true })
    expect(ToolFunc.runSync('f')).toBe('f2')

    // 2. (name, options)
    ToolFunc.register('g', { func: () => 'g1' })
    ToolFunc.register('g', { func: () => 'g2', allowOverride: true })
    expect(ToolFunc.runSync('g')).toBe('g2')

    // 3. (options)
    ToolFunc.register({ name: 'h', func: () => 'h1' })
    ToolFunc.register({ name: 'h', func: () => 'h2', allowOverride: true })
    expect(ToolFunc.runSync('h')).toBe('h2')
  })

  it('should increment refCount when registering the same instance multiple times', () => {
    const inst = new ToolFunc({ name: 'same', func: () => { } })
    inst.register()
    inst.register()
    expect(getRefCount('same')).toBe(2)
  })

  it('should be atomic on alias collision during override', () => {
    ToolFunc.register({ name: 'other', alias: 'collision', func: () => 'other' })
    ToolFunc.register({ name: 'target', func: () => 'v1' })

    // Attempt to override target with an alias that collides with 'other'
    expect(() => {
      ToolFunc.register({
        name: 'target',
        alias: 'collision',
        func: () => 'v2',
        allowOverride: true
      })
    }).toThrow('Alias "collision" already exists')

    // Target should still be v1 because the registration failed before implementation replacement
    // Wait, in current logic, unregister(name, true) happens BEFORE alias check.
    // Let's verify if we need to improve atomicity.
    expect(ToolFunc.runSync('target')).toBe('v1')
  })

  it('should allow stealing aliases when allowOverride.alias is true', () => {
    ToolFunc.register({ name: 'other', alias: 'collision', func: () => 'other' })
    ToolFunc.register({ name: 'target', alias: 'collision', func: () => 'target', allowOverride: { alias: true } })

    expect(ToolFunc.runSync('collision')).toBe('target')
    expect(ToolFunc.aliases['collision']).toBe('target')
  })

  it('should register proxy instances correctly (.with)', () => {
    const inst = new ToolFunc({ name: 'proxyTest', func: () => 'base' })
    const proxy = inst.with({ isolated: true })

    ToolFunc.register(proxy)
    expect(ToolFunc.get('proxyTest')).toBeDefined()
    expect(getRefCount('proxyTest')).toBe(1)
  })

  it('should release dependencies when overriding with an empty depends object', () => {
    const dep = new ToolFunc({ name: 'dep', func: () => { } })
    ToolFunc.register({ name: 'test', depends: { d: dep }, func: () => { } })
    expect(getRefCount('dep')).toBe(1)

    // Override with explicit empty depends
    ToolFunc.register({ name: 'test', depends: {}, func: () => { }, allowOverride: true })
    expect(getRefCount('dep')).toBeUndefined()
  })

  it('should increment refCount when registering via an existing alias', () => {
    ToolFunc.register({ name: 'real', alias: 'alias', func: () => 'val' })
    expect(getRefCount('real')).toBe(1)

    // Registering using the alias should find the real name and increment its count
    ToolFunc.register('alias', { func: () => 'val' })
    expect(getRefCount('real')).toBe(2)
  })

  it('should support stealing aliases ONLY with { name: false, alias: true }', () => {
    ToolFunc.register({ name: 'victim', alias: 'stolen', func: () => 'victim' })
    ToolFunc.register({ name: 'thief', func: () => 'thief' })

    // Thief wants the alias but NOT to override its own implementation (though thief is new)
    ToolFunc.register({
      name: 'thief',
      alias: 'stolen',
      func: () => 'thief_new',
      allowOverride: { name: false, alias: true }
    })

    expect(ToolFunc.aliases['stolen']).toBe('thief')
    expect(ToolFunc.runSync('thief')).toBe('thief') // Should NOT have overridden 'thief' because name: false
    // Wait, if result is true (exists), and override.name is false, it just increments refCount.
  })

  it('should maintain list() and getByTag() consistency after complex operations', () => {
    ToolFunc.register({ name: 't1', tags: 'group1', func: () => { } })
    ToolFunc.register({ name: 't1', tags: 'group2', func: () => { }, allowOverride: true })

    const list = ToolFunc.list()
    expect(list['t1']).toBeDefined()
    expect(list['t1'].tags).toBe('group2')

    const tags = ToolFunc.getAllByTag('group2')
    expect(tags.find(it => it.name === 't1')).toBeDefined()
    expect(ToolFunc.getByTag('group1')).toBeUndefined()
  })

  it('should start refCount from 1 for re-registered functions after total unregistration', () => {
    ToolFunc.register({ name: 'reset', func: () => { } })
    ToolFunc.unregister('reset')
    expect(getRefCount('reset')).toBeUndefined()

    ToolFunc.register({ name: 'reset', func: () => { } })
    expect(getRefCount('reset')).toBe(1)
  })

  it('should handle non-ToolFunc values in depends gracefully', () => {
    // Should not throw even if a dependency is just a string (runtime resolution)
    expect(() => {
      ToolFunc.register({
        name: 'stringDep',
        depends: { legacy: 'someOtherFunc' as any },
        func: () => { }
      })
    }).not.toThrow()

    expect(getRefCount('someOtherFunc')).toBeUndefined()
  })

  it('should handle sequential overrides (V1 -> V2 -> V3)', () => {
    const d1 = new ToolFunc({ name: 'd1', func: () => 'd1' })
    const d2 = new ToolFunc({ name: 'd2', func: () => 'd2' })
    const d3 = new ToolFunc({ name: 'd3', func: () => 'd3' })

    // V1 depends on d1
    ToolFunc.register({ name: 'main', depends: { d: d1 }, func: () => 'v1' })
    expect(getRefCount('d1')).toBe(1)

    // V2 depends on d2
    ToolFunc.register({ name: 'main', depends: { d: d2 }, func: () => 'v2', allowOverride: true })
    expect(getRefCount('d1')).toBeUndefined()
    expect(getRefCount('d2')).toBe(1)

    // V3 depends on d3
    ToolFunc.register({ name: 'main', depends: { d: d3 }, func: () => 'v3', allowOverride: true })
    expect(getRefCount('d2')).toBeUndefined()
    expect(getRefCount('d3')).toBe(1)
    expect(getRefCount('main')).toBe(1)
  })

  it('should be atomic if a dependency fails to register', () => {
    ToolFunc.register({ name: 'other', alias: 'collision', func: () => { } })

    const depWithCollision = new ToolFunc({
      name: 'dep',
      alias: 'collision',
      func: () => { }
    })

    const parent = new ToolFunc({
      name: 'parent',
      depends: { sub: depWithCollision },
      func: () => { }
    })

    // Registration of 'parent' should fail because its dependency 'dep' has an alias collision
    expect(() => parent.register()).toThrow('Alias "collision" already exists')

    expect(ToolFunc.get('parent')).toBeUndefined()
    expect(ToolFunc.get('dep')).toBeUndefined()
    expect(getRefCount('parent')).toBeUndefined()
  })
})

