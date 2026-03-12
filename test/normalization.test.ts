
import { ToolFunc } from '../src/tool-func';
import { describe, it, expect, beforeEach } from 'vitest';

describe('ToolFunc registration modularization', () => {
  beforeEach(() => {
    for (const n of Object.keys(ToolFunc.items)) {
      ToolFunc.unregister(n, { force: true });
    }
  });

  it('should support register({ name, func }, { allowOverride })', () => {
    ToolFunc.register({ name: 'my-tool', func: () => 'first' });

    // This should fail without allowOverride if it already exists,
    // but register returns the existing one if it can't override.
    // Wait, the original code:
    // const existing = this.get(realName)
    // if (result && override.name) { ... unregister ... result = false }
    // if (!result) { ... new ... }

    const result1 = ToolFunc.register({ name: 'my-tool', func: () => 'second' }, { allowOverride: true });
    expect(result1).toBeInstanceOf(ToolFunc);
    expect(ToolFunc.runSync('my-tool')).toBe('second');
  });

  it('should support register(name, { func })', () => {
    ToolFunc.register('my-tool', { func: () => 'abc' } as any);
    expect(ToolFunc.runSync('my-tool')).toBe('abc');
  });

  it('should support register(func, { name })', () => {
    const myFunc = () => 'def';
    ToolFunc.register(myFunc, { name: 'my-tool' });
    expect(ToolFunc.runSync('my-tool')).toBe('def');
  });

  it('should support register(ToolFuncInstance)', () => {
    const inst = new ToolFunc({ name: 'my-tool', func: () => 'ghi' });
    ToolFunc.register(inst);
    expect(ToolFunc.runSync('my-tool')).toBe('ghi');
  });

  it('should support register({ name: "foo" }, { func: bar })', () => {
     ToolFunc.register({ name: 'my-tool' } as any, { func: () => 'jkl' } as any);
     expect(ToolFunc.runSync('my-tool')).toBe('jkl');
  });

  it('should use function name if no name is provided', () => {
    function namedFunc() { return 'named'; }
    ToolFunc.register(namedFunc);
    expect(ToolFunc.runSync('namedFunc')).toBe('named');
  });

  it('should override name if name is provided with function', () => {
    function namedFunc() { return 'named'; }
    ToolFunc.register(namedFunc, { name: 'customName' });
    expect(ToolFunc.runSync('customName')).toBe('named');
    expect(ToolFunc.get('namedFunc')).toBeUndefined();
  });

  it('should handle alias overrides correctly', () => {
    ToolFunc.register({ name: 'tool1', func: () => 'one', alias: 'common' });

    // Should throw if alias is taken and no override
    expect(() => {
      ToolFunc.register({ name: 'tool2', func: () => 'two', alias: 'common' });
    }).toThrow(/Alias common already exists/);

    // Should succeed with allowOverride: { alias: true }
    ToolFunc.register({ name: 'tool2', func: () => 'two', alias: 'common' }, { allowOverride: { alias: true } } as any);
    expect(ToolFunc.aliases['common']).toBe('tool2');
  });

  it('should handle complex object merges in first argument', () => {
    // Now: arg1 wins, arg2 is defaults
    const firstArg = { name: 'complex-tool', description: 'desc1' };
    const secondArg = { func: () => 'complex', description: 'desc2' };

    ToolFunc.register(firstArg as any, secondArg as any);
    const inst = ToolFunc.get('complex-tool');
    expect(inst?.description).toBe('desc1');
    expect(ToolFunc.runSync('complex-tool')).toBe('complex');
  });

  it('should not modify original ToolFunc instance properties unless intended', () => {
    const inst = new ToolFunc({ name: 'orig', func: () => 'orig' });
    const options = { title: 'new title' };
    ToolFunc.register(inst, options as any);

    expect(inst.title).toBe('new title');
    expect(ToolFunc.get('orig')).toBe(inst);
  });

  it('should handle allowOverride as boolean true', () => {
    ToolFunc.register({ name: 'override-me', func: () => 'old' });
    ToolFunc.register({ name: 'override-me', func: () => 'new' }, { allowOverride: true });
    expect(ToolFunc.runSync('override-me')).toBe('new');
  });

  it('should prioritize name in first argument object over name in options', () => {
    const firstArg = { name: 'name-in-first', func: () => 'result' };
    const secondArg = { name: 'name-in-second' };

    ToolFunc.register(firstArg as any, secondArg as any);
    expect(ToolFunc.get('name-in-first')).toBeDefined();
    expect(ToolFunc.get('name-in-second')).toBeUndefined();
  });

  it('should handle allowOverride: { name: true } specifically', () => {
    ToolFunc.register({ name: 'name-only-override', func: () => 'old' });
    ToolFunc.register({ name: 'name-only-override', func: () => 'new' }, { allowOverride: { name: true } } as any);
    expect(ToolFunc.runSync('name-only-override')).toBe('new');
  });

  it('should support multiple aliases via array', () => {
    ToolFunc.register({ name: 'multi-alias', func: () => 'multi', alias: ['a1', 'a2', 'a3'] });
    expect(ToolFunc.runSync('a1')).toBe('multi');
    expect(ToolFunc.runSync('a2')).toBe('multi');
    expect(ToolFunc.runSync('a3')).toBe('multi');
  });

  it('should handle registration with only name and options containing alias', () => {
    ToolFunc.register('only-name', { func: () => 'val', alias: 'my-alias' } as any);
    expect(ToolFunc.runSync('my-alias')).toBe('val');
  });

  it('should handle unregister with alias correctly', () => {
    ToolFunc.register({ name: 'to-unreg', func: () => 'val', alias: 'unreg-alias' });
    expect(ToolFunc.get('unreg-alias')).toBeDefined();
    ToolFunc.unregister('to-unreg');
    expect(ToolFunc.get('unreg-alias')).toBeUndefined();
    expect(ToolFunc.get('to-unreg')).toBeUndefined();
  });

  it('should inherit name from func property in object if name is missing', () => {
    function myNamedFunc() { return 'val'; }
    ToolFunc.register({ func: myNamedFunc });
    expect(ToolFunc.get('myNamedFunc')).toBeDefined();
    expect(ToolFunc.runSync('myNamedFunc')).toBe('val');
  });

  it('should throw error if no name can be determined', () => {
    const namelessFunc = () => {};
    Object.defineProperty(namelessFunc, 'name', { value: '' });
    expect(() => {
      ToolFunc.register({ func: namelessFunc } as any);
    }).toThrow('Function name is required for registration');
  });

  it('should increment reference count on redundant registration', () => {
    const name = 'ref-test';
    const func = () => 'ref';
    ToolFunc.register({ name, func });
    // @ts-ignore
    expect(ToolFunc._refCounts[name]).toBe(1);

    ToolFunc.register({ name, func });
    // @ts-ignore
    expect(ToolFunc._refCounts[name]).toBe(2);

    ToolFunc.unregister(name);
    // @ts-ignore
    expect(ToolFunc._refCounts[name]).toBe(1);
    expect(ToolFunc.get(name)).toBeDefined();

    ToolFunc.unregister(name);
    // @ts-ignore
    expect(ToolFunc._refCounts[name]).toBeUndefined();
    expect(ToolFunc.get(name)).toBeUndefined();
  });

  it('should register dependencies automatically', () => {
    const dep = new ToolFunc({ name: 'dep-func', func: () => 'dep' });
    ToolFunc.register({
      name: 'main-func',
      func: () => 'main',
      depends: { myDep: dep }
    });

    expect(ToolFunc.get('main-func')).toBeDefined();
    expect(ToolFunc.get('dep-func')).toBeDefined();
    expect(ToolFunc.runSync('dep-func')).toBe('dep');
  });

  it('should handle registration with empty options', () => {
    function someFunc() { return 'some'; }
    ToolFunc.register(someFunc, {} as any);
    expect(ToolFunc.get('someFunc')).toBeDefined();
  });

  it('should handle registration where first arg is ToolFunc and second arg provides defaults', () => {
    const inst = new ToolFunc({ name: 'original-name', func: () => 'old' });
    ToolFunc.register(inst, { title: 'new-title' } as any);

    expect(ToolFunc.get('original-name')).toBe(inst);
    expect(inst.title).toBe('new-title');
  });
});
