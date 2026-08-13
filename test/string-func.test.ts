import { describe, expect, it, beforeEach } from 'vitest';
import { ToolFunc } from '../src/tool-func';
import { getRefCount } from './test-util';

describe('ToolFunc string func support', () => {
  beforeEach(() => {
    for (const n of Object.keys(ToolFunc.items)) {
      ToolFunc.unregister(n, { force: true });
    }
    for (const a of Object.keys(ToolFunc.aliases)) {
      delete ToolFunc.aliases[a];
    }
  });

  describe('register(name, { func: string })', () => {
    it('should compile an arrow-function string into a real function', () => {
      ToolFunc.register('add', { func: '(a, b) => a + b' });
      const tool = ToolFunc.get('add')!;
      expect(typeof tool.func).toBe('function');
      // positional-style string func requires positional params declared
      expect(tool.runWithPosSync(1, 2)).toBe(3);
    });

    it('should map named params when params array is declared', () => {
      ToolFunc.register('add', {
        func: '(a, b) => a + b',
        params: [{ name: 'a' }, { name: 'b' }],
      });
      expect(ToolFunc.runSync('add', { a: 1, b: 2 })).toBe(3);
    });

    it('should work with a single named-param arrow', () => {
      ToolFunc.register('nameOf', { func: '(p) => `Hi ${p.name}`' });
      expect(ToolFunc.runSync('nameOf', { name: 'Buffy' })).toBe('Hi Buffy');
    });

    it('should compile a function-expression string', () => {
      ToolFunc.register('sub', { func: 'function(a, b) { return a - b; }' });
      expect(ToolFunc.get('sub')!.runWithPosSync(5, 2)).toBe(3);
    });

    it('should keep working with scope-bound arrows', () => {
      const scope = { secretValue: 42 };
      ToolFunc.register('scopeTool', { func: '() => secretValue', scope });
      expect(ToolFunc.runSync('scopeTool')).toBe(42);
    });
  });

  describe('register(name, funcString)', () => {
    it('should treat the 2nd string arg as the func body', () => {
      ToolFunc.register('mul', '(a, b) => a * b');
      expect(ToolFunc.get('mul')!.runWithPosSync(3, 4)).toBe(12);
    });

    it('should throw when the string is an invalid expression', () => {
      expect(() => ToolFunc.register('bad', 'not an expression ((')).toThrow(/failed to create the func of "bad"/);
      expect(ToolFunc.get('bad')).toBeUndefined();
    });
  });

  describe('register(name, funcString, config)', () => {
    it('should merge config metadata and map params', () => {
      ToolFunc.register('div', '(a, b) => a / b', {
        params: [{ name: 'a' }, { name: 'b' }],
        description: 'Divides two numbers',
        title: 'Divide',
      });
      const tool = ToolFunc.get('div')!;
      expect(tool.description).toBe('Divides two numbers');
      expect(tool.title).toBe('Divide');
      expect(ToolFunc.runSync('div', { a: 8, b: 2 })).toBe(4);
    });

    it('should honor allowOverride passed in the config object', () => {
      ToolFunc.register('ovr', '() => "v1"');
      ToolFunc.register('ovr', '() => "v2"', { allowOverride: true });
      expect(ToolFunc.runSync('ovr')).toBe('v2');
    });

    it('should let the func string win over config.func', () => {
      ToolFunc.register('win', '() => "body"', { func: '() => "config"' } as any);
      expect(ToolFunc.runSync('win')).toBe('body');
    });
  });

  describe('new ToolFunc(name, funcString)', () => {
    it('should support the 2-string constructor form', () => {
      const tool = new ToolFunc('pow', '(a, b) => a ** b');
      expect(tool.name).toBe('pow');
      expect(typeof tool.func).toBe('function');
      expect(tool.runWithPosSync(2, 3)).toBe(8);
    });

    it('should support the 3-arg form with a config object', () => {
      const tool = new ToolFunc('pow', '(a, b) => a ** b', {
        params: [{ name: 'a' }, { name: 'b' }],
        description: 'Computes a to the power of b',
      });
      expect(tool.name).toBe('pow');
      expect(tool.description).toBe('Computes a to the power of b');
      expect(tool.runSync({ a: 2, b: 3 })).toBe(8);
      expect(tool.runWithPosSync(3, 2)).toBe(9);
    });

    it('should let the func string win over config.func', () => {
      const tool = new ToolFunc('win', '() => "body"', { func: '() => "config"' } as any);
      expect(tool.runSync()).toBe('body');
    });
  });

  describe('name derivation from string funcs', () => {
    it('should derive the name from a named function expression', () => {
      ToolFunc.register({ func: 'function greet(name) { return `Hi ${name}`; }' });
      expect(ToolFunc.get('greet')).toBeDefined();
      expect(ToolFunc.runWithPosSync('greet', 'X')).toBe('Hi X');
    });

    it('should derive the name from an async named function expression', () => {
      ToolFunc.register({ func: 'async function fetchData() { return "data"; }' });
      expect(ToolFunc.get('fetchData')).toBeDefined();
    });

    it('should not override an explicitly configured name', () => {
      ToolFunc.register({ name: 'explicit', func: 'function otherName() { return 1; }' });
      expect(ToolFunc.get('explicit')).toBeDefined();
      expect(ToolFunc.get('otherName')).toBeUndefined();
    });

    it('should throw for an anonymous arrow string without a name', () => {
      expect(() => ToolFunc.register({ func: '(a) => a' })).toThrow(/name is required/);
    });
  });

  describe('error handling', () => {
    it('should reject bare expressions that evaluate to a value', () => {
      expect(() => ToolFunc.register('bad', { func: 'a + b', scope: { a: 1, b: 2 } })).toThrow(
        /must be a function expression/
      );
      expect(ToolFunc.get('bad')).toBeUndefined();
    });

    it('should wrap syntax errors with the tool name', () => {
      expect(() => ToolFunc.register('broken', { func: 'function ( { }' })).toThrow(
        /failed to create the func of "broken"/
      );
    });

    it('should reject an empty string func', () => {
      expect(() => ToolFunc.register('empty', { func: '' })).toThrow(/must be a function expression/);
    });
  });

  describe('export round-trip', () => {
    it('should export the string func back and re-register from it', () => {
      ToolFunc.register('add', '(a, b) => a + b');
      const exported = ToolFunc.get('add')!.toObject();
      expect(typeof exported.func).toBe('string');
      ToolFunc.unregister('add', { force: true });
      ToolFunc.register('add', exported);
      expect(ToolFunc.get('add')!.runWithPosSync(2, 5)).toBe(7);
    });
  });

  describe('expression varieties', () => {
    it('should compile arrow strings with default parameter values', () => {
      ToolFunc.register('def', '(a, b = 10) => a + b');
      expect(ToolFunc.get('def')!.runWithPosSync(5)).toBe(15);
    });

    it('should compile arrow strings with a destructured object parameter', () => {
      ToolFunc.register('dest', '({a, b}) => a * b');
      expect(ToolFunc.runSync('dest', { a: 3, b: 4 })).toBe(12);
    });

    it('should compile async string funcs that return a promise', async () => {
      ToolFunc.register('asyncFn', 'async (a) => a * 2');
      const result = await ToolFunc.runWithPos('asyncFn', 21);
      expect(result).toBe(42);
    });

    it('should compile generator function expressions', () => {
      ToolFunc.register('gen', 'function* gen() { yield 1; yield 2; }');
      const iter = ToolFunc.get('gen')!.runWithPosSync() as Generator;
      expect([...iter]).toEqual([1, 2]);
    });
  });

  describe('precedence and registration semantics', () => {
    it('should let a first-arg object func win over a 2nd-arg func string', () => {
      const realFn = () => 'real';
      ToolFunc.register({ name: 'prec', func: realFn }, '() => "string"' as any);
      // The first-arg func wins: the compiled body must be realFn's, not the 2nd-arg string's.
      // (Note: ToolFunc re-compiles every function via toString, so compare the compiled source.)
      expect(ToolFunc.get('prec')!.func.toString()).toBe(realFn.toString());
      expect(ToolFunc.runSync('prec')).toBe('real');
    });

    it('should keep the existing func on re-registration (increment) with a string func', () => {
      ToolFunc.register('inc', { func: () => 'v1' });
      ToolFunc.register('inc', { func: '() => "v2"' });
      expect(ToolFunc.runSync('inc')).toBe('v1'); // not replaced
      expect(getRefCount('inc')).toBe(2);
    });

    it('should not let config.name override the first-arg name', () => {
      ToolFunc.register('first', '() => "x"', { name: 'second' });
      expect(ToolFunc.get('first')).toBeDefined();
      expect(ToolFunc.get('second')).toBeUndefined();
    });

    it('should register the derived name together with an alias', () => {
      ToolFunc.register({ func: 'function namedAlias() { return 1; }', alias: 'na' });
      expect(ToolFunc.get('namedAlias')).toBeDefined();
      expect(ToolFunc.runSync('na')).toBe(1);
    });

    it('should keep an instance func when registered with a 2nd-arg string', () => {
      const inst = new ToolFunc({ name: 'instStr', func: () => 'inst' });
      ToolFunc.register(inst, '() => "string"' as any);
      expect(ToolFunc.get('instStr')).toBe(inst);
      expect(inst.func.toString()).toBe((() => 'inst').toString());
      expect(ToolFunc.runSync('instStr')).toBe('inst');
    });
  });

  describe('hierarchical registries', () => {
    it('should support string funcs in an isolated registry (shadowing)', () => {
      class PluginTools extends ToolFunc {
        static { this.isolateRegistry(); }
      }
      ToolFunc.register('shadow', { func: () => 'parent' });
      PluginTools.register('shadow', '(a) => `child-${a}`');
      expect(ToolFunc.runSync('shadow')).toBe('parent');
      expect(PluginTools.runWithPosSync('shadow', 1)).toBe('child-1');
    });
  });

  describe('constructor derivation and round-trip', () => {
    it('should derive the name in the constructor path', () => {
      const tool = new ToolFunc({ func: 'function ctorDerived() { return 1; }' });
      expect(tool.name).toBe('ctorDerived');
      expect(typeof tool.func).toBe('function');
    });

    it('should round-trip a constructor string func through toObject and register', () => {
      const tool = new ToolFunc({ name: 'rt', func: '(a, b) => a + b' });
      const exported = tool.toObject();
      expect(typeof exported.func).toBe('string');
      ToolFunc.register('rt', exported);
      expect(ToolFunc.get('rt')!.runWithPosSync(1, 2)).toBe(3);
    });
  });

  describe('edge errors', () => {
    it('should reject an empty 2nd-arg func string without leaving residue', () => {
      expect(() => ToolFunc.register('empty2', '')).toThrow(/must be a function expression/);
      expect(ToolFunc.get('empty2')).toBeUndefined();
      expect(getRefCount('empty2')).toBeUndefined();
    });

    it('should not leave refCount residue after a failed string-func registration', () => {
      expect(() => ToolFunc.register('failReg', { func: 'not an expression ((' })).toThrow();
      expect(ToolFunc.get('failReg')).toBeUndefined();
      expect(getRefCount('failReg')).toBeUndefined();
    });

    it('should roll back atomically when a 3-arg form has an invalid func string', () => {
      const dep = new ToolFunc({ name: 'depRoll', func: () => 'dep' });
      expect(() => ToolFunc.register('mainRoll', 'not an expression ((', { depends: { d: dep } })).toThrow(
        /failed to create/
      );
      expect(ToolFunc.get('mainRoll')).toBeUndefined();
      expect(ToolFunc.get('depRoll')).toBeUndefined();
      expect(getRefCount('mainRoll')).toBeUndefined();
      expect(getRefCount('depRoll')).toBeUndefined();
    });
  });
});
