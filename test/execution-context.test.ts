// @vitest-environment node
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ToolFunc, FuncItem } from '../src/tool-func';

// --- Subclassing Test Utility ---
interface MyToolFuncItem extends FuncItem {
  customState?: string;
}
// Declaration merging: use class, interface and namespace together
class MySubTool extends ToolFunc {}
interface MySubTool {
  customState: string;
}
namespace MySubTool {
  export type Item = MyToolFuncItem;
}
// --- End Subclassing Test Utility ---

describe('ToolFunc Execution Context', () => {
  beforeEach(() => {
    // Clear global registry
    for (const n of Object.keys(ToolFunc.items)) {
      delete ToolFunc.items[n];
    }
    // Reset static context
    (ToolFunc as any).ctx = undefined;
  });

  describe('Instance .with(ctx)', () => {
    it('should create a shadow instance with the provided context', async () => {
      const tool = new ToolFunc({
        name: 'testTool',
        func: function() {
          return this.ctx?.user;
        }
      });

      const runner = tool.with({ user: 'Alice' });
      
      expect(runner).not.toBe(tool);
      expect(Object.getPrototypeOf(runner)).toBe(tool);
      expect(runner.ctx?.user).toBe('Alice');
      
      const result = await runner.run();
      expect(result).toBe('Alice');
    });

    it('should maintain access to original properties via prototype chain', () => {
      const tool = new ToolFunc({
        name: 'testTool',
        title: 'Original Title',
        func: () => 'ok'
      });

      const runner = tool.with({ user: 'Bob' });
      
      expect(runner.name).toBe('testTool');
      expect(runner.title).toBe('Original Title');
    });

    it('should isolate concurrent calls with different contexts', async () => {
      const tool = new ToolFunc({
        name: 'concurrentTool',
        func: async function() {
          await new Promise(resolve => setTimeout(resolve, 10));
          return this.ctx?.id;
        }
      });

      const runner1 = tool.with({ id: 1 });
      const runner2 = tool.with({ id: 2 });

      const [res1, res2] = await Promise.all([
        runner1.run(),
        runner2.run()
      ]);

      expect(res1).toBe(1);
      expect(res2).toBe(2);
    });
  });

  describe('Static ToolFunc.with(ctx)', () => {
    it('should return a proxy class with preset context', async () => {
      const tool = new ToolFunc({
        name: 'globalTool',
        func: function() {
          return this.ctx?.appId;
        }
      });
      tool.register();

      const AppRunner = ToolFunc.with({ appId: 'MY_APP' });
      
      expect(AppRunner.ctx?.appId).toBe('MY_APP');
      
      const result = await AppRunner.run('globalTool');
      expect(result).toBe('MY_APP');
    });

    it('should allow nested with() calls', async () => {
      const tool = new ToolFunc({
        name: 'nestedTool',
        func: function() {
          return `${this.ctx?.a}-${this.ctx?.b}`;
        }
      });
      tool.register();

      const RunnerA = ToolFunc.with({ a: '1' });
      const RunnerAB = RunnerA.with({ b: '2' });

      expect(await RunnerAB.run('nestedTool')).toBe('1-2');
    });
  });

  describe('Context Propagation and Merging', () => {
    it('should propagate context to nested calls (runAs)', async () => {
      const toolB = new ToolFunc({
        name: 'toolB',
        func: function() {
          return this.ctx?.traceId;
        }
      });
      toolB.register();

      const toolA = new ToolFunc({
        name: 'toolA',
        func: function() {
          return this.runAsSync('toolB');
        }
      });
      toolA.register();

      const result = await toolA.with({ traceId: 'T123' }).run();
      expect(result).toBe('T123');
    });

    it('should allow overriding context in nested runAs call', async () => {
      const toolB = new ToolFunc({
        name: 'toolB',
        func: function() {
          return `${this.ctx?.parentVal}-${this.ctx?.childVal}`;
        }
      });
      toolB.register();

      const toolA = new ToolFunc({
        name: 'toolA',
        func: function() {
          return this.runAsSync('toolB', {}, { childVal: 'child' });
        }
      });
      toolA.register();

      const result = await toolA.with({ parentVal: 'parent' }).run();
      expect(result).toBe('parent-child');
    });

    it('should allow overriding context in run/runSync', () => {
      const tool = new ToolFunc({
        name: 'overrideTool',
        func: function() {
          return this.ctx?.val;
        }
      });

      const runner = tool.with({ val: 'initial' });
      const result = runner.runSync({}, { val: 'overridden' });
      
      expect(result).toBe('overridden');
    });

    it('should respect inheritContext: false', () => {
      const tool = new ToolFunc({
        name: 'noInheritTool',
        func: function() {
          return this.ctx?.parentVal;
        }
      });

      const runner = tool.with({ parentVal: 'exists' });
      const result = runner.runSync({}, { inheritContext: false, other: 'val' });
      
      expect(result).toBeUndefined();
    });

    it('should allow blocking inheritance at any level in deep nesting', () => {
      const tool = new ToolFunc({
        name: 'layerTool',
        func: function() { return `${this.ctx?.a}-${this.ctx?.b}`; }
      });

      const runner = tool.with({ a: 1 })
                         .with({ b: 2, inheritContext: false });

      expect(runner.ctx?.a).toBeUndefined();
      expect(runner.ctx?.b).toBe(2);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle deep nesting of .with()', async () => {
      const tool = new ToolFunc({
        name: 'deepTool',
        func: function() {
          return `${this.ctx?.a}${this.ctx?.b}${this.ctx?.c}`;
        }
      });

      const result = await tool.with({ a: '1' })
                               .with({ b: '2' })
                               .with({ c: '3' })
                               .run();
      expect(result).toBe('123');
    });

    it('should handle custom class instances in context (safety check)', async () => {
      class CustomCtx {
        constructor(public val: string) {}
      }
      const custom = new CustomCtx('hello');

      const tool = new ToolFunc({
        name: 'customCtxTool',
        func: function() {
          return (this.ctx as any).val;
        }
      });

      const result = await tool.with(custom).run();
      expect(result).toBe('hello');
    });

    it('should propagate context to runWithPos via .with()', async () => {
      const tool = new ToolFunc({
        name: 'posTool',
        params: [{ name: 'val' }],
        func: function(val: string) {
          return `${val}-${this.ctx?.user}`;
        }
      });

      const result = await tool.with({ user: 'Alice' }).runWithPos('data');
      expect(result).toBe('data-Alice');
    });

    it('should propagate static context to runWithPos via proxy class', async () => {
      const tool = new ToolFunc({
        name: 'staticPosTool',
        params: [{ name: 'val' }],
        func: function(val: string) {
          return `${val}-${this.ctx?.user}`;
        }
      });
      tool.register();

      const ProxyRunner = ToolFunc.with({ user: 'Bob' });
      const result = await ProxyRunner.runWithPos('staticPosTool', 'data');
      expect(result).toBe('data-Bob');
    });

    it('should avoid re-parenting if already in chain', () => {
      const parentCtx = { root: true };
      const childCtx = Object.create(parentCtx);
      childCtx.leaf = true;

      const result = (ToolFunc as any)._prepareContext(parentCtx, childCtx);
      
      expect(result).toBe(childCtx);
      expect(Object.getPrototypeOf(result)).toBe(parentCtx);
    });

    it('should not overwrite ToolFunc metadata with context properties', () => {
      const tool = new ToolFunc({
        name: 'originalName',
        func: function() {
          return {
            name: this.name,
            ctxName: this.ctx?.name
          };
        }
      });

      const result = tool.with({ name: 'maliciousName' }).runSync();
      expect(result.name).toBe('originalName');
      expect(result.ctxName).toBe('maliciousName');
    });
  });

  describe('Isolated Execution', () => {
    it('should always isolate if ctx is provided even if same as current', () => {
      const tool = new ToolFunc({ name: 'test', func: () => 'ok' });
      const runner = tool.with({ a: 1 });
      
      const spy = vi.spyOn(runner as any, '_shouldIsolate');
      runner.runSync({}, { a: 1 });
      expect(spy).toReturnWith(true);
    });

    it('should correctly handle null or empty ctx', () => {
      const tool = new ToolFunc({
        name: 'emptyCtxTool',
        func: function() { return !!this.ctx; }
      });

      expect(tool.runSync({})).toBe(false);
      expect(tool.runSync({}, {})).toBe(true);
    });

    it('should force isolation when isolated: true is provided in context', () => {
      const tool = new ToolFunc({ name: 'test', func: () => 'ok' });
      const spy = vi.spyOn(tool as any, '_shouldIsolate');
      
      tool.runSync({}, { isolated: true });
      expect(spy).toReturnWith(true);
    });

    it('should NOT isolate if isolated: false is explicitly provided, even with ctx', () => {
      const tool = new ToolFunc({ name: 'test', func: () => 'ok' });
      const spy = vi.spyOn(tool as any, '_shouldIsolate');
      
      // Explicitly passing isolated: false should have highest priority
      const result = tool.runSync({}, { val: 1, isolated: false });
      expect(spy).toReturnWith(false);
      // Since it's not isolated, 'this' in func would be the tool itself, 
      // but runSync applies the ctx to the runner it creates. 
      // If no runner is created, ctx passed to runSync is not applied to 'this'.
    });
  });

  describe('Object Safety and Rationale Checks', () => {
    it('should protect the original ctx object from prototype pollution', () => {
      const tool = new ToolFunc({ name: 'test', func: () => {} });
      const myCtx = { a: 1 };
      const originalProto = Object.getPrototypeOf(myCtx);
      
      tool.runSync({}, myCtx);
      
      // Ensure the framework didn't call setPrototypeOf on our original object
      expect(Object.getPrototypeOf(myCtx)).toBe(originalProto);
    });

    it('should ensure _origin always points to the Root instance across deep shadows', () => {
      const tool = new ToolFunc({ name: 'rootTool', func: () => {} });
      const shadow1 = tool.with({ a: 1 });
      const shadow2 = shadow1.with({ b: 2 });
      const shadow3 = shadow2.with({ c: 3 });

      expect(shadow1._origin).toBe(tool);
      expect(shadow2._origin).toBe(tool);
      expect(shadow3._origin).toBe(tool);
      
      // Even if someone tries to overwrite it (due to empty setter)
      (shadow3 as any)._origin = { fake: true };
      expect(shadow3._origin).toBe(tool);
    });
  });

  describe('Context and Dependencies', () => {
    it('should flow context to auto-registered dependencies', async () => {
      const toolB = new ToolFunc({
        name: 'toolB',
        func: function() { return this.ctx?.val; }
      });

      const toolA = new ToolFunc({
        name: 'toolA',
        depends: { b: toolB },
        func: function() { return this.runAsSync('b'); }
      });
      toolA.register();

      const result = await toolA.with({ val: 'flowed' }).run();
      expect(result).toBe('flowed');
    });
  });

  describe('Function Binding with Context', () => {
    it('should return a bound function that preserves context (getFunc)', async () => {
      const tool = new ToolFunc({
        name: 'boundTool',
        func: function() { return this.ctx?.val; }
      });
      
      const runner = tool.with({ val: 'bound' });
      const fn = runner.getFunc();
      
      expect(await fn({})).toBe('bound');
    });

    it('should return a bound function that preserves context (getFuncWithPos)', async () => {
      const tool = new ToolFunc({
        name: 'boundPosTool',
        params: [{name: 'p'}],
        func: function(p: string) { return `${p}-${this.ctx?.val}`; }
      });
      
      const runner = tool.with({ val: 'bound' });
      const fn = runner.getFuncWithPos();
      
      expect(await fn('hello')).toBe('hello-bound');
    });
  });

  describe('Context Stability in Async Functions', () => {
    it('should maintain stable this.ctx across await points', async () => {
      const tool = new ToolFunc({
        name: 'asyncStableTool',
        func: async function() {
          const val1 = this.ctx?.val;
          await new Promise(resolve => setTimeout(resolve, 10));
          const val2 = this.ctx?.val;
          return val1 === val2 && val1 === 'stable';
        }
      });

      const result = await tool.with({ val: 'stable' }).run();
      expect(result).toBe(true);
    });
  });

  describe('Setup Hook', () => {
    it('should call setup hook and allow modifying options before initialization', () => {
      const tool = new ToolFunc({
        name: 'setupTool',
        title: 'Initial Title',
        setup(options) {
          // setup runs before initialize(options), so we can modify options
          if (options) {
            options.title = 'Configured Title';
          }
          (this as any).internalState = 'ready';
        },
        func: function() {
          return `${this.title}-${(this as any).internalState}`;
        }
      });
      // title should be 'Configured Title' because setup modified the options object
      expect(tool.title).toBe('Configured Title');
      expect(tool.runSync()).toBe('Configured Title-ready');
    });

    it('should support custom properties via subclassing and defineProperties', () => {
      // Correct way to add managed properties using the subclass defined at top-level
      MySubTool.defineProperties(MySubTool, {
        customState: { type: 'string' }
      });

      const options: any = {
        name: 'customPropTool',
        customState: 'initial',
        func: function(this: MySubTool) { return this.customState; }
      };
      const tool = new MySubTool(options);

      expect(tool.customState).toBe('initial');
      expect(tool.runSync()).toBe('initial');
    });
  });

  describe('Streaming capability (isStream)', () => {
    it('should correctly identify stream request based on params and capability', () => {
      const tool = new ToolFunc({
        name: 'streamTool',
        stream: true,
        params: { stream: { type: 'boolean' } },
        func: () => {}
      });
      
      expect(tool.isStream({ stream: true })).toBe(true);
      expect(tool.isStream({ stream: false })).toBe(false);
      expect(tool.isStream({})).toBeUndefined(); // Because params.stream is not set
    });

    it('should return static stream capability if no stream param is defined', () => {
      const tool = new ToolFunc({
        name: 'staticStreamTool',
        stream: true,
        func: () => {}
      });
      expect(tool.isStream({})).toBe(true);
    });
  });

  describe('Internal Hooks: _shouldIsolate and _prepareContext', () => {
    it('should isolate when explicit ctx is passed to runSync', () => {
      const tool = new ToolFunc({ name: 'test', func: () => {} });
      const spy = vi.spyOn(tool as any, '_shouldIsolate');
      
      tool.runSync({}, { some: 'ctx' });
      expect(spy).toReturnWith(true);
    });

    it('should not isolate again if already isolated and no new ctx passed', () => {
      const tool = new ToolFunc({ name: 'test', func: () => {} });
      const runner = tool.with({ first: 'ctx' });
      
      const spy = vi.spyOn(runner as any, '_shouldIsolate');
      runner.runSync({});
      expect(spy).toReturnWith(false);
    });

    it('should correctly prepare context with inheritance', () => {
      const tool = new ToolFunc({ name: 'test', func: () => {} });
      (tool as any).ctx = { parent: 'p' };
      
      const prepared = (tool as any)._prepareContext({}, { child: 'c' });
      expect(prepared.child).toBe('c');
      expect(prepared.parent).toBe('p');
      expect(Object.getPrototypeOf(prepared)).toBe((tool as any).ctx);
    });
  });

  describe('AbortSignal Support', () => {
    it('should propagate AbortSignal via context', async () => {
      const controller = new AbortController();
      const tool = new ToolFunc({
        name: 'abortableTool',
        func: function() {
          return this.ctx?.signal;
        }
      });

      const result = await tool.run({}, { signal: controller.signal });
      expect(result).toBe(controller.signal);
    });
  });
});
