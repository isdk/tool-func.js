
import { ToolFunc, funcWithMeta } from '../src/tool-func';
import { describe, it, expect, beforeEach } from 'vitest';

describe('ToolFunc Normalization Coverage', () => {

  beforeEach(() => {
    for (const n of Object.keys(ToolFunc.items)) {
      ToolFunc.unregister(n, { force: true });
    }
  });

  describe('Constructor Normalization', () => {
    it('should deep merge params in constructor', () => {
      const func = new ToolFunc(
        {
          name: 'test',
          params: { a: { type: 'string' } }
        },
        {
          params: { b: { type: 'number' } },
          description: 'default desc'
        }
      );

      expect(func.params).toEqual({
        a: { type: 'string' },
        b: { type: 'number' }
      });
      expect(func.description).toBe('default desc');
    });

    it('should prioritize string name over name in options', () => {
      const func = new ToolFunc('primary-name', { name: 'fallback-name' } as any);
      expect(func.name).toBe('primary-name');
    });

    it('should extract name from function and merge options', () => {
      function myFunc() { return 1; }
      const func = new ToolFunc(myFunc, { title: 'My Title' });
      expect(func.name).toBe('myFunc');
      expect(typeof func.func).toBe('function');
      // ToolFunc converts function to string and re-creates it, so we compare toString()
      expect(func.func!.toString()).toBe(myFunc.toString());
      expect(func.title).toBe('My Title');
    });

    it('should allow renaming function via name in options', () => {
      function myFunc() {}
      const func = new ToolFunc(myFunc, { name: 'otherName' });
      expect(func.name).toBe('otherName');
    });
  });

  describe('Static _normalizeArguments Edge Cases', () => {
    it('should handle undefined/null as first argument', () => {
      // @ts-ignore
      const options = (ToolFunc as any)._normalizeArguments(undefined, { name: 'foo' });
      expect(options.name).toBe('foo');
    });

    it('should handle empty objects', () => {
      // @ts-ignore
      const options = (ToolFunc as any)._normalizeArguments({}, { name: 'foo', title: 'bar' });
      expect(options.name).toBe('foo');
      expect(options.title).toBe('bar');
    });

    it('should NOT overwrite existing property with undefined in options', () => {
      const options = (ToolFunc as any)._normalizeArguments(
        { name: 'foo' },
        { name: undefined, title: 'bar' }
      );
      expect(options.name).toBe('foo');
      expect(options.title).toBe('bar');
    });

    it('should handle deep merge of tags array (defaultsDeep behavior)', () => {
      // Note: defaultsDeep merges arrays by index if they exist
      const options = (ToolFunc as any)._normalizeArguments(
        { name: 'foo', tags: ['a'] },
        { tags: ['b', 'c'] }
      );
      // defaultsDeep: ['a'] merged with ['b', 'c'] -> ['a', 'c']
      expect(options.tags).toEqual(['a', 'c']);
    });

    it('should merge deep result schemas', () => {
      const options = (ToolFunc as any)._normalizeArguments(
        { name: 'res-test', result: { type: 'object', properties: { id: { type: 'string' } } } },
        { result: { properties: { name: { type: 'string' } }, additionalProperties: false } }
      );
      expect(options.result.properties).toHaveProperty('id');
      expect(options.result.properties).toHaveProperty('name');
      expect(options.result.additionalProperties).toBe(false);
    });
  });

  describe('Registration Instruction Extraction', () => {
    it('should extract allowOverride from first argument object', () => {
      const regArgs = (ToolFunc as any)._normalizeRegisterArguments(
        { name: 'over-test', func: () => 'v2', allowOverride: true },
        {}
      );
      expect(regArgs.override).toEqual({ name: true });
      expect(regArgs.allowOverride).toBeUndefined();
    });

    it('should handle allowOverride as an object { name, alias }', () => {
      const regArgs = (ToolFunc as any)._normalizeRegisterArguments(
        'over-test',
        { allowOverride: { name: true, alias: true } } as any
      );
      expect(regArgs.override).toEqual({ name: true, alias: true });
    });

    it('should prioritize allowOverride in first arg over second arg', () => {
      // Though unlikely in practice, ensure priority is consistent
      const regArgs = (ToolFunc as any)._normalizeRegisterArguments(
        { name: 'over-test', allowOverride: false },
        { allowOverride: true } as any
      );
      expect(regArgs.override).toEqual({ name: false });
    });
  });

  describe('Complex Instance & Options Interactions', () => {
    it('should fill missing defaults in an existing ToolFunc instance during registration', () => {
      const inst = new ToolFunc({ name: 'inst-test', title: 'Original' });
      // Registration with defaults
      ToolFunc.register(inst, { title: 'Default', description: 'Added Desc' } as any);

      expect(inst.title).toBe('Original'); // Priority 1 (inst) wins
      expect(inst.description).toBe('Added Desc'); // Priority 2 (defaults) fills missing
    });

    it('should merge nested depends in registration', () => {
      const d1 = new ToolFunc({ name: 'd1', func: () => 1 });
      const d2 = new ToolFunc({ name: 'd2', func: () => 2 });

      const main = new ToolFunc({ name: 'main', depends: { d1 } });
      ToolFunc.register(main, { depends: { d2 } } as any);

      expect(main.depends).toHaveProperty('d1', d1);
      expect(main.depends).toHaveProperty('d2', d2);
      expect(ToolFunc.get('d1')).toBeDefined();
      expect(ToolFunc.get('d2')).toBeDefined();
    });
  });

  describe('Alias Merging (defaultsDeep Characteristic)', () => {
    it('should merge alias arrays by index', () => {
      const options = (ToolFunc as any)._normalizeArguments(
        { name: 'alias-test', alias: ['a1'] },
        { alias: ['a2', 'a3'] }
      );
      // defaultsDeep: ['a1'] + ['a2', 'a3'] -> ['a1', 'a3']
      expect(options.alias).toEqual(['a1', 'a3']);
    });

    it('should merge string alias with array defaults', () => {
      const options = (ToolFunc as any)._normalizeArguments(
        { name: 'alias-test', alias: 'a1' },
        { alias: ['a2', 'a3'] }
      );
      // 'a1' is not an object/array to be merged by defaultsDeep into the array,
      // actually 'a1' (string) will completely override the defaultsDeep target if it's there?
      // Let's verify defaultsDeep behavior:
      // _.defaultsDeep({alias: 'a1'}, {alias: ['a2']}) -> {alias: 'a1'}
      expect(options.alias).toBe('a1');
    });
  });

  describe('Property Specific Merging', () => {
    it('should NOT merge asyncFeatures bitmasks (first one wins)', () => {
      // asyncFeatures are numbers, defaultsDeep doesn't merge primitives
      const options = (ToolFunc as any)._normalizeArguments(
        { name: 'feat-test', asyncFeatures: 1 }, // Feature A
        { asyncFeatures: 2 } // Feature B
      );
      expect(options.asyncFeatures).toBe(1);
    });

    it('should handle params type mismatch (object vs array)', () => {
      // arg1: Positional params, arg2: Named params defaults
      const options = (ToolFunc as any)._normalizeArguments(
        { name: 'param-test', params: [{ name: 'p1' }] },
        { params: { p2: 'string' } }
      );
      // defaultsDeep: Array [{name: 'p1'}] merged with Object {p2: 'string'}
      // Since array index 0 exists, it might merge with property '0' of the object if it exists?
      // In this case, 'p2' is a new property.
      expect(Array.isArray(options.params)).toBe(true);
      expect(options.params[0]).toEqual({ name: 'p1' });
      expect((options.params as any).p2).toBe('string');
    });

    it('should prioritize setup hook in first argument', () => {
      const s1 = () => {};
      const s2 = () => {};
      const options = (ToolFunc as any)._normalizeArguments(
        { name: 'setup-test', setup: s1 },
        { setup: s2 }
      );
      expect(options.setup).toBe(s1);
    });
  });
describe('funcWithMeta Interaction', () => {
  it('should respect metadata attached via funcWithMeta in register', () => {
    const myFunc = () => 'val';
    funcWithMeta(myFunc, { title: 'Meta Title', custom: 'data' });

    const regArgs = (ToolFunc as any)._normalizeRegisterArguments(myFunc, { title: 'Default Title' });

    // Meta Title from FuncMetaSymbol should win over Default Title from arg2
    expect(regArgs.title).toBe('Meta Title');
    expect(regArgs.custom).toBe('data');
    expect(regArgs.func).toBe(myFunc);
  });
});


  describe('Re-registration effects', () => {
    it('should update instance properties on re-registration with new defaults', () => {
      const inst = new ToolFunc({ name: 're-reg', title: 'T1' });
      ToolFunc.register(inst);

      // Re-register with new defaults for missing properties
      ToolFunc.register(inst, { description: 'New Desc', title: 'T2' } as any);

      expect(inst.title).toBe('T1'); // Still T1
      expect(inst.description).toBe('New Desc'); // Absorbed new default
    });
  });

  describe('Edge Cases & Robustness', () => {
    it('should NOT overwrite empty strings or false with defaults', () => {
      const options = (ToolFunc as any)._normalizeArguments(
        { name: 'edge-test', title: '', isApi: false },
        { title: 'Default Title', isApi: true, description: 'D' }
      );
      // defaultsDeep: empty string is a value, false is a value.
      expect(options.title).toBe('');
      expect(options.isApi).toBe(false);
      expect(options.description).toBe('D');
    });

    it('should handle non-object options gracefully', () => {
      const arg1 = { name: 'test', title: 'T' };
      // @ts-ignore
      expect((ToolFunc as any)._normalizeArguments(arg1, null).title).toBe('T');
      // @ts-ignore
      expect((ToolFunc as any)._normalizeArguments(arg1, undefined).title).toBe('T');
      // @ts-ignore
      expect((ToolFunc as any)._normalizeArguments(arg1, "not-an-object").title).toBe('T');
    });

    it('should handle result type mismatch (string vs object)', () => {
      // Priority 1: string, Priority 2: object
      const o1 = (ToolFunc as any)._normalizeArguments(
        { name: 't1', result: 'string' },
        { result: { type: 'string', description: 'desc' } }
      );
      expect(o1.result).toBe('string');

      // Priority 1: object, Priority 2: string
      const o2 = (ToolFunc as any)._normalizeArguments(
        { name: 't2', result: { type: 'number' } },
        { result: 'string' }
      );
      expect(o2.result).toEqual({ type: 'number' });
    });

    it('should merge nested depends properly', () => {
      const d1 = { name: 'd1', func: () => {} };
      const d2 = new ToolFunc({ name: 'd2', func: () => {} });

      const options = (ToolFunc as any)._normalizeArguments(
        { name: 'main', depends: { dep1: d1 } },
        { depends: { dep2: d2 } }
      );

      expect(options.depends.dep1).toBe(d1);
      expect(options.depends.dep2).toBe(d2);
    });

    it('should handle alias merging when one is string and other is array', () => {
      // arg1: array, arg2: string
      const o1 = (ToolFunc as any)._normalizeArguments(
        { name: 'a1', alias: ['alias1'] },
        { alias: 'alias2' }
      );
      expect(o1.alias).toEqual(['alias1']);

      // arg1: string, arg2: array
      const o2 = (ToolFunc as any)._normalizeArguments(
        { name: 'a2', alias: 'alias1' },
        { alias: ['alias2'] }
      );
      expect(o2.alias).toBe('alias1');
    });
  });
  });

