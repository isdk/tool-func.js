import { vi as jest } from 'vitest'
import { ToolFunc } from '../tool-func'
import { makeToolFuncCancelable, TaskAbortController, TaskPromise } from './cancelable-ability'
import { AsyncFeatures } from './async-features'
import { sleep } from '@isdk/util'
import { AbortError } from '@isdk/common-error'

// 定义一个基础的测试工具类
class TestCtxTool extends ToolFunc {
  func(params: any) {
    return this.runAsyncCancelableTask(params, async (params: any, aborter: TaskAbortController) => {
      const waitTime = params?.waitTime ?? 10
      const start = Date.now()
      while (Date.now() - start < waitTime) {
        aborter.throwIfAborted()
        await sleep(1)
      }
      return { params, ctx: this.ctx }
    })
  }
}

makeToolFuncCancelable(TestCtxTool, { asyncFeatures: AsyncFeatures.MultiTask })

describe('CancelableAbility Context Support', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
  })

  it('should automatically isolate and inject aborter when using with(ctx)', async () => {
    const tool = new TestCtxTool('contextTest')
    const ctx = { traceId: 'T-123' }
    const runner = tool.with(ctx)

    // 验证影子实例机制
    expect(Object.getPrototypeOf(runner)).toBe(tool)
    expect(runner.ctx).toBeDefined()
    expect(runner.ctx!.traceId).toBe('T-123')
    expect(runner.ctx!.aborter).toBeInstanceOf(TaskAbortController)

    const result = await (runner.run({ waitTime: 5 }) as TaskPromise<any>)
    expect(result.ctx.traceId).toBe('T-123')
    expect(result.ctx.aborter).toBeInstanceOf(TaskAbortController)
  })

  it('should link external signal from context to the injected aborter', async () => {
    const tool = new TestCtxTool('contextSignalTest')
    const controller = new AbortController()
    const runner = tool.with({ signal: controller.signal })

    const taskInfo = runner.run({ waitTime: 100 }) as TaskPromise<any>
    const aborter = runner.ctx!.aborter

    expect(aborter.signal.aborted).toBeFalsy()

    // 模拟异步中止
    setTimeout(() => controller.abort('aborted via context signal'), 10)

    await expect(taskInfo).rejects.toThrow(AbortError)
    expect(aborter.signal.aborted).toBeTruthy()
    expect(aborter.signal.reason.message).toContain('aborted via context signal')
  })

  it('should inherit context properties across multiple .with() calls', async () => {
    const tool = new TestCtxTool('inheritanceTest')
    const runner1 = tool.with({ parentId: 'P-1', common: 'root' })
    const runner2 = runner1.with({ childId: 'C-1', common: 'child' })

    expect(runner2.ctx!.childId).toBe('C-1')
    expect(runner2.ctx!.parentId).toBe('P-1')
    expect(runner2.ctx!.common).toBe('child')
    expect(runner2.ctx!.aborter).toBeInstanceOf(TaskAbortController)
  })

  it('should allow params.aborter to override ctx.aborter', async () => {
    const tool = new TestCtxTool('priorityTest')
    const ctxAborter = new TaskAbortController(tool as any)
    const paramAborter = new TaskAbortController(tool as any)

    const runner = tool.with({ aborter: ctxAborter })
    const taskInfo = runner.run({ aborter: paramAborter }) as TaskPromise<any>

    expect(taskInfo.task).toBe(paramAborter)
    expect(taskInfo.task).not.toBe(ctxAborter)
  })

  it('should handle multiple signals in context via "signals" property', async () => {
    const tool = new TestCtxTool('multiSignalCtx')
    const ctrl1 = new AbortController()
    const ctrl2 = new AbortController()
    const runner = tool.with({ signals: [ctrl1.signal, ctrl2.signal] })

    const taskInfo = runner.run({ waitTime: 50 }) as TaskPromise<any>

    setTimeout(() => ctrl2.abort('second signal'), 10)

    await expect(taskInfo).rejects.toThrow('second signal')
  })

  it('should support static ToolFunc.with(ctx) and pass context to executed tool', async () => {
    const tool = new TestCtxTool('staticWithTest')
    tool.register()

    const CustomRunner = ToolFunc.with({ globalId: 'G-1' })
    const result = await (CustomRunner.run('staticWithTest', { waitTime: 5 }) as TaskPromise<any>)

    expect(result.ctx.globalId).toBe('G-1')
    expect(result.ctx.aborter).toBeInstanceOf(TaskAbortController)

    ToolFunc.unregister('staticWithTest')
  })

  it('should not leak context between concurrent runs with different contexts', async () => {
    const tool = new TestCtxTool('concurrencyTest')

    const run1 = tool.with({ requestId: 'REQ-1' }).run({ waitTime: 20 }) as TaskPromise<any>
    const run2 = tool.with({ requestId: 'REQ-2' }).run({ waitTime: 20 }) as TaskPromise<any>

    const [res1, res2] = await Promise.all([run1, run2])

    expect(res1.ctx.requestId).toBe('REQ-1')
    expect(res2.ctx.requestId).toBe('REQ-2')
  })

  it('should respect inheritContext: false to isolate from parent context', async () => {
    const tool = new TestCtxTool('isolationTest')
    const runner1 = tool.with({ parentId: 'P-1' })

    // 显式传入 inheritContext: false
    const runner2 = runner1.with({ childId: 'C-1', inheritContext: false })

    expect(runner2.ctx!.childId).toBe('C-1')
    expect(runner2.ctx!.parentId).toBeUndefined()
  })

  it('should propagate context through runAs calls', async () => {
    const subTool = new TestCtxTool('subTool')
    subTool.register()

    class MainTool extends ToolFunc {
      func(params: any) {
        return this.runAsyncCancelableTask(params, async () => {
          const res = await (this.runAs('subTool', { waitTime: 5 }) as TaskPromise<any>)
          return { mainCtx: this.ctx, subCtx: res.ctx }
        })
      }
    }
    makeToolFuncCancelable(MainTool)
    const mainTool = new MainTool('mainTool')
    mainTool.depends = { subTool }

    const result = await (mainTool.with({ traceId: 'T-999' }).run() as TaskPromise<any>)
    expect(result.mainCtx.traceId).toBe('T-999')
    expect(result.subCtx.traceId).toBe('T-999')
    // 验证 aborter 也是继承关系
    expect(Object.getPrototypeOf(result.subCtx.aborter)).toBeDefined()

    ToolFunc.unregister('mainTool')
    ToolFunc.unregister('subTool')
  })

  it('should support timeout in context', async () => {
    const tool = new TestCtxTool('timeoutCtxTest')
    const runner = tool.with({ timeout: 20 })

    // 任务需要 100ms，但 context 设置了 20ms 超时
    const taskInfo = runner.run({ waitTime: 100 }) as TaskPromise<any>
    await expect(taskInfo).rejects.toThrow(/timeout/)
  })

  it('should fail immediately if context signal is already aborted', async () => {
    const tool = new TestCtxTool('preAbortedTest')
    const controller = new AbortController()
    controller.abort('already dead')

    const runner = tool.with({ signal: controller.signal })
    const taskInfo = runner.run() as TaskPromise<any>

    await expect(taskInfo).rejects.toThrow('already dead')
  })

  it('should flatten non-pure objects used as context', async () => {
    class CustomContext {
      appId = 'MY-APP'
      getRole() { return 'admin' }
    }
    const tool = new TestCtxTool('flattenTest')
    const myCtx = new CustomContext()
    const runner = tool.with(myCtx as any)

    // 验证属性被提取到 ctx 顶层（根据 ToolFunc._prepareContext 逻辑）
    expect(runner.ctx!.appId).toBe('MY-APP')
    const result = await (runner.run() as TaskPromise<any>)
    expect(result.ctx.appId).toBe('MY-APP')
  })

  it('should maintain a deep prototype chain for multiple nested with calls', async () => {
    const tool = new TestCtxTool('deepInheritTest')
    const r1 = tool.with({ level: 1, a: 1 })
    const r2 = r1.with({ level: 2, b: 2 })
    const r3 = r2.with({ level: 3, a: 3 }) // 覆盖 a

    expect(r3.ctx!.level).toBe(3)
    expect(r3.ctx!.a).toBe(3)
    expect(r3.ctx!.b).toBe(2)

    const result = await (r3.run() as TaskPromise<any>)
    expect(result.ctx.level).toBe(3)
    expect(result.ctx.a).toBe(3)
    expect(result.ctx.b).toBe(2)
  })

  it('should support context in runWithPos', async () => {
    class PosCtxTool extends ToolFunc {
      constructor(options: any) {
        super(options)
        // 定义位置参数
        this.params = [{ name: 'val', type: 'string' }]
      }
      func(val: string) {
        return this.runAsyncCancelableTask({}, async () => {
          return { val, traceId: this.ctx?.traceId }
        })
      }
    }
    makeToolFuncCancelable(PosCtxTool)
    const tool = new PosCtxTool({ name: 'posCtx' })

    // 显式通过 .with() 注入上下文，因为 runWithPos 不直接接受 ctx 参数
    const result = await (tool.with({ traceId: 'POS-123' }).runWithPos('hello') as TaskPromise<any>)
    expect(result.val).toBe('hello')
    expect(result.traceId).toBe('POS-123')
  })

  it('should merge context from with() and run()', async () => {
    const tool = new TestCtxTool('mergeTest')
    const runner = tool.with({ a: 1, b: 1 })

    // run 时的 ctx 会覆盖 with 时的 ctx
    const result = await (runner.run({ waitTime: 5 }, { b: 2, c: 3 }) as TaskPromise<any>)

    expect(result.ctx.a).toBe(1)
    expect(result.ctx.b).toBe(2)
    expect(result.ctx.c).toBe(3)
  })

  it('should propagate context through deep recursion (A -> B -> C)', async () => {
    const toolC = new TestCtxTool('toolC')
    toolC.register()

    class ToolBClass extends ToolFunc {
      func(params: any) {
        return this.runAsyncCancelableTask(params, async () => {
          return this.runAs('toolC', params)
        })
      }
    }
    makeToolFuncCancelable(ToolBClass)
    const toolB = new ToolBClass({ name: 'toolB' })
    toolB.depends = { toolC }
    toolB.register()

    class ToolAClass extends ToolFunc {
      func(params: any) {
        return this.runAsyncCancelableTask(params, async () => {
          return this.runAs('toolB', params)
        })
      }
    }
    makeToolFuncCancelable(ToolAClass)
    const toolA = new ToolAClass({ name: 'toolA' })
    toolA.depends = { toolB }
    toolA.register()

    const result = await (toolA.with({ deepId: 'D-1' }).run({ waitTime: 5 }) as TaskPromise<any>)
    expect(result.ctx.deepId).toBe('D-1')

    ToolFunc.unregister('toolA')
    ToolFunc.unregister('toolB')
    ToolFunc.unregister('toolC')
  })

  it('should contain timeout data in AbortError from context timeout', async () => {
    const tool = new TestCtxTool('errorDataTest')
    const runner = tool.with({ timeout: 10 })

    let error: any
    try {
      await runner.run({ waitTime: 100 })
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(AbortError)
    expect(error.data).toMatchObject({
      what: 'timeout',
      timeout: 10
    })
  })

  it('should allow runAs to override context explicitly', async () => {
    const sub = new TestCtxTool('subOverride')
    sub.register()

    class MainOverrideClass extends ToolFunc {
      func(params: any) {
        return this.runAsyncCancelableTask(params, async () => {
          // 显式传入新上下文覆盖父级
          return this.runAs('subOverride', params, { traceId: 'NEW' })
        })
      }
    }
    makeToolFuncCancelable(MainOverrideClass)
    const main = new MainOverrideClass({ name: 'mainOverride' })
    main.depends = { sub }
    main.register()

    const result = await (main.with({ traceId: 'OLD' }).run() as TaskPromise<any>)
    expect(result.ctx.traceId).toBe('NEW')

    ToolFunc.unregister('mainOverride')
    ToolFunc.unregister('subOverride')
  })
})
