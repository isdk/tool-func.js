// @vitest-environment node
import { describe, expect, it, beforeEach } from 'vitest';
import { ToolFunc, ToolFuncSchema } from '../src/tool-func';
import { AsyncFeatures, AsyncFeatureBits } from '../src/utils/async-features';
import { NotFoundError } from '@isdk/common-error';

describe('ToolFunc Additional Features', () => {
  beforeEach(() => {
    // Clear global registry
    for (const n of Object.keys(ToolFunc.items)) {
      delete ToolFunc.items[n];
    }
    for (const a of Object.keys(ToolFunc.aliases)) {
      delete ToolFunc.aliases[a];
    }
  });

  describe('Async Features', () => {
    it('should correctly set and check instance async features', () => {
      const tool = new ToolFunc({
        name: 'asyncTool',
        asyncFeatures: AsyncFeatures.Cancelable | AsyncFeatures.MultiTask,
        func: () => {}
      });

      expect(tool.hasAsyncFeature(AsyncFeatureBits.Cancelable)).toBe(true);
      expect(tool.hasAsyncFeature(AsyncFeatureBits.MultiTask)).toBe(true);
      expect(tool.hasAsyncFeature(AsyncFeatureBits.Priority)).toBe(false);
    });

    it('should correctly check static async features from prototype', () => {
      class CustomTool extends ToolFunc {}
      CustomTool.prototype.asyncFeatures = AsyncFeatures.Priority;

      expect(CustomTool.hasAsyncFeature(AsyncFeatureBits.Priority)).toBe(true);
      expect(CustomTool.hasAsyncFeature(AsyncFeatureBits.Cancelable)).toBe(false);
    });

    it('should correctly handle _asyncFeatures override/addition', () => {
      const tool = new ToolFunc({
        name: 'overrideAsyncTool',
        asyncFeatures: AsyncFeatures.Cancelable,
        func: () => {}
      });
      // @ts-ignore - simulating internal/plugin behavior
      tool._asyncFeatures = AsyncFeatures.MultiTask;

      expect(tool.hasAsyncFeature(AsyncFeatureBits.Cancelable)).toBe(true);
      expect(tool.hasAsyncFeature(AsyncFeatureBits.MultiTask)).toBe(true);
    });
  });

  describe('Alias Management', () => {
    it('should throw error when registering a duplicate alias', () => {
      ToolFunc.register({
        name: 'tool1',
        alias: 'commonAlias',
        func: () => 'one'
      });

      expect(() => {
        ToolFunc.register({
          name: 'tool2',
          alias: 'commonAlias',
          func: () => 'two'
        });
      }).toThrow(/Alias "commonAlias" already exists/);
    });

    it('should throw error when registering an array of aliases with duplicates', () => {
        ToolFunc.register({
          name: 'tool1',
          alias: ['alias1', 'alias2'],
          func: () => 'one'
        });

        expect(() => {
          ToolFunc.register({
            name: 'tool2',
            alias: ['alias3', 'alias1'],
            func: () => 'two'
          });
        }).toThrow(/Alias "alias1" already exists/);
      });
  });

  describe('Dependency Management', () => {
    it('should automatically register dependencies', () => {
      const depTool = new ToolFunc({
        name: 'depTool',
        func: () => 'dependency'
      });

      const mainTool = new ToolFunc({
        name: 'mainTool',
        depends: { myDep: depTool },
        func: function() {
          return this.runAsSync('myDep');
        }
      });

      // depTool is NOT registered yet
      expect(ToolFunc.get('depTool')).toBeUndefined();

      mainTool.register();

      // Now both should be registered
      expect(ToolFunc.get('mainTool')).toBeDefined();
      expect(ToolFunc.get('depTool')).toBeDefined();
      expect(mainTool.runSync()).toBe('dependency');
    });

    it('should handle nested dependencies', () => {
        const dep2 = new ToolFunc({ name: 'dep2', func: () => '2' });
        const dep1 = new ToolFunc({ name: 'dep1', depends: { d2: dep2 }, func: () => '1' });
        const main = new ToolFunc({ name: 'main', depends: { d1: dep1 }, func: () => 'M' });

        main.register();

        expect(ToolFunc.get('main')).toBeDefined();
        expect(ToolFunc.get('dep1')).toBeDefined();
        expect(ToolFunc.get('dep2')).toBeDefined();
    });
  });

  describe('Static Runner Error Handling', () => {
    it('should throw NotFoundError for ToolFunc.run when function is missing', () => {
      expect(() => ToolFunc.run('nonExistent')).toThrow(NotFoundError);
    });

    it('should throw NotFoundError for ToolFunc.runSync when function is missing', () => {
      expect(() => ToolFunc.runSync('nonExistent')).toThrow(NotFoundError);
    });

    it('should throw NotFoundError for ToolFunc.runWithPos when function is missing', () => {
      expect(() => ToolFunc.runWithPos('nonExistent')).toThrow(NotFoundError);
    });

    it('should throw NotFoundError for instance runAsSync when function is missing', () => {
        const tool = new ToolFunc({ name: 'test', func: () => {} });
        expect(() => tool.runAsSync('missing')).toThrow(NotFoundError);
    });
  });

  describe('ToolFuncSchema Function Assignment', () => {
    it('should convert string to function using _createFunction', () => {
      const tool = new ToolFunc('stringFunc', {});
      const funcStr = '(params) => params.a + params.b';

      // Use the schema's assign logic manually or via defineProperties
      const assignedFunc = (ToolFuncSchema.func.assign as any)(funcStr, tool, undefined, 'func', {});

      expect(assignedFunc).toBeInstanceOf(Function);
      expect(assignedFunc({ a: 1, b: 2 })).toBe(3);
    });

    it('should return function as string when exporting', () => {
      const tool = new ToolFunc('exportTest', {});
      const myFunc = (p: any) => p;

      const assigned = (ToolFuncSchema.func.assign as any)(myFunc, tool, undefined, 'func', { isExported: true });

      expect(typeof assigned).toBe('string');
      expect(assigned).toContain('p');
    });
  });

  describe('Parameter Conversion Edge Cases', () => {
    it('should handle positional to object conversion with single non-object param', () => {
      const tool = new ToolFunc({
        name: 'paramTool',
        params: { x: 'number' },
        func: (p: any) => p.x
      });

      // arr2ObjParams called internally by runWithPosSync
      expect(tool.runWithPosSync(10)).toBe(10);
    });

    it('should handle object to positional conversion', () => {
      const tool = new ToolFunc({
        name: 'posTool',
        params: [{ name: 'x' }, { name: 'y' }],
        func: (x: number, y: number) => x + y
      });

      // obj2ArrParams called internally by runSync
      expect(tool.runSync({ x: 5, y: 7 })).toBe(12);
    });
  });

  describe('Advanced Registry & Identity', () => {
    it('should maintain _origin pointing to root across deep shadows', () => {
      const root = new ToolFunc({ name: 'root', func: () => {} });
      const shadow1 = root.with({ a: 1 });
      const shadow2 = shadow1.with({ b: 2 });
      const shadow3 = Object.create(shadow2);

      expect(shadow1._origin).toBe(root);
      expect(shadow2._origin).toBe(root);
      expect(shadow3._origin).toBe(root);
    });

    it('should retrieve items by tags correctly (array and string)', () => {
      ToolFunc.register({ name: 't1', tags: ['common', 'special'], func: () => {} });
      ToolFunc.register({ name: 't2', tags: 'common', func: () => {} });

      const commonItems = ToolFunc.getAllByTag('common');
      expect(commonItems.length).toBe(2);
      expect(commonItems.map(i => i.name)).toContain('t1');
      expect(commonItems.map(i => i.name)).toContain('t2');

      const specialItem = ToolFunc.getByTag('special');
      expect(specialItem?.name).toBe('t1');
    });

    it('should avoid redundant context wrapping if already in chain', () => {
      const parent = { root: true };
      const child = Object.create(parent);

      const result = (ToolFunc as any)._prepareContext(parent, child);
      expect(result).toBe(child); // Identity preserved
    });

    it('should correctly unregister root item when passing an alias (Bug Fixed)', () => {
      ToolFunc.register({
        name: 'primary',
        alias: 'myAlias',
        func: () => 'ok'
      });

      expect(ToolFunc.get('primary')).toBeDefined();

      // Attempt to unregister via alias
      ToolFunc.unregister('myAlias');

      // Now it should be successfully removed
      expect(ToolFunc.get('primary')).toBeUndefined();
      expect(ToolFunc.get('myAlias')).toBeUndefined();
    });

    it('should handle circular dependencies without infinite recursion', () => {
      const toolA = new ToolFunc({ name: 'A', func: () => 'A' });
      const toolB = new ToolFunc({ name: 'B', func: () => 'B' });

      toolA.depends = { b: toolB };
      toolB.depends = { a: toolA };

      // Should not throw
      toolA.register();

      expect(ToolFunc.get('A')).toBeDefined();
      expect(ToolFunc.get('B')).toBeDefined();
    });

    it('should handle partial parameter mapping (less args than params)', () => {
      const tool = new ToolFunc({
        name: 'partialParams',
        params: { a: 'string', b: 'number' },
        func: (p: any) => p
      });

      const result = tool.runWithPosSync('hello');
      expect(result).toEqual({ a: 'hello' });
      expect(result.b).toBeUndefined();
    });

    it('should return undefined when isStream is false even if params has stream:true', () => {
      const tool = new ToolFunc({
        name: 'noStreamTool',
        stream: false,
        params: { stream: 'boolean' },
        func: () => {}
      });

      expect(tool.isStream({ stream: true })).toBe(false);
    });

    it('should infer name from function name if missing in options', () => {
      function myNamedFunc() { return 'ok'; }
      const tool = ToolFunc.register(myNamedFunc) as ToolFunc;
      expect(tool.name).toBe('myNamedFunc');
      expect(ToolFunc.get('myNamedFunc')).toBe(tool);
    });

    it('should throw error if no name can be inferred during registration', () => {
      // Use an object that truly has no name and no named function
      expect(() => ToolFunc.register({ description: 'no name here' } as any)).toThrow(/name is required/);
    });
    });

    describe('Scope and Registry List', () => {
    it('should use scope when creating function from string', () => {
      const scope = { secretValue: 42 };
      const tool = new ToolFunc({
        name: 'scopeTool',
        scope,
        func: '() => secretValue' as any
      });

      expect(tool.runSync()).toBe(42);
    });

    it('should return all registered items via ToolFunc.list()', () => {
        ToolFunc.register({ name: 'list1', func: () => {} });
        ToolFunc.register({ name: 'list2', func: () => {} });

        const list = ToolFunc.list();
        expect(list).toHaveProperty('list1');
        expect(list).toHaveProperty('list2');
    });
    });
    });
