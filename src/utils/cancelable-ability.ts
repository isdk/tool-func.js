import { AbilityOptions, createAbilityInjector } from 'custom-ability'
import { AbortError, CommonError, ErrorCode } from '@isdk/common-error'
import { defineProperty } from 'util-ex';
import { IntSet, Semaphore, SemaphoreIsReadyFuncType } from '@isdk/util';
import { ToolFunc, ToolFuncContext } from '../tool-func';
import { createCallbacksTransformer } from './stream';
import { AsyncFeatureBits, AsyncFeatures, ToolAsyncMultiTaskBit } from './async-features';

export type AsyncTaskId = string|number

export interface CancelableAbilityOptions extends AbilityOptions {
  asyncFeatures?: AsyncFeatures
  maxTaskConcurrency?: number
  isReadyFn?: SemaphoreIsReadyFuncType
}

export class TaskAbortController extends AbortController {
  declare id?: AsyncTaskId
  declare timeoutId?: any
  /** 兼容性展示字段（last-wins），流的错误通知已改由 streamControllers 集合驱动 */
  declare streamController?: ReadableStreamDefaultController
  /** 共享该 aborter 的并发任务各自的流控制器（避免单值字段互相覆盖） */
  declare streamControllers?: any[]
  declare parent: CancelableAbility
  /** 共享该 aborter 的嵌套任务引用计数，用于决定何时清理 timeout 定时器 */
  declare _taskCount?: number

  constructor(parent: CancelableAbility) {
    super()
    defineProperty(this, 'parent', parent)
  }

  abort(reason?: string|Error|CommonError, data?: any) {
    if (this.signal.aborted) {return}
    if (typeof reason === 'string') {
      reason = new AbortError(reason)
    }
    if (reason && data && typeof reason === 'object') {
      const reasonData = (reason as any).data || ((reason as any).data = {})
      Object.assign(reasonData, data)
    }
    super.abort(reason)
  }

  throwIfAborted(alreadyRejected?: boolean) {
    const signal = this.signal as any
    if (signal.aborted) {
      if (alreadyRejected === undefined) alreadyRejected = signal.alreadyRejected
      if (alreadyRejected) {return true}
      const reason = (signal.reason instanceof Error) ? signal.reason : new AbortError(signal.reason || 'aborted')
      throw reason
    }
  }

  /**
   * @deprecated use throwIfAborted instead
   */
  throwRejected(alreadyRejected?: boolean) {
    return this.throwIfAborted(alreadyRejected)
  }
}

export interface TaskAbortControllers {
  [k: AsyncTaskId]: TaskAbortController|undefined
}

export interface TaskPromise<T = any> extends Promise<T> {
  task?: TaskAbortController;
}

export declare interface CancelableAbility {
  _asyncFeatures?: number
  _maxTaskConcurrency: number|undefined
  _isReadyFn?: SemaphoreIsReadyFuncType
  [name: string]: any;
}


export class CancelableAbility {
  declare generateAsyncTaskId: (taskId?: AsyncTaskId, aborters?: TaskAbortControllers) => AsyncTaskId
  declare cleanMultiTaskAborter: (id: AsyncTaskId, aborters: TaskAbortControllers) => void

  __task_aborter: TaskAbortController|TaskAbortControllers|undefined
  __task_semaphore: Semaphore|undefined

  get maxTaskConcurrency() {
    return this._maxTaskConcurrency
  }

  get semaphore() {
    return this.getSemaphore()
  }

  getSemaphore(isReadyFn = this._isReadyFn) {
    let maxTaskConcurrency = this._maxTaskConcurrency!
    const host = (this as any)._origin || this
    let result = host.__task_semaphore
    if (maxTaskConcurrency > 0 && !result) {
      if (isReadyFn) {isReadyFn = isReadyFn.bind(host)}
      // maxTaskConcurrency 即最大并发数（不再 -1，修复有效并发恒少一个的问题）
      result = host.__task_semaphore = new Semaphore(maxTaskConcurrency, {isReadyFn})
    }
    return result
  }

  static hasAsyncFeature(feature: AsyncFeatureBits) {
    const proto = this.prototype
    let features = proto.asyncFeatures || 0
    if (proto._asyncFeatures) { features |= proto._asyncFeatures }
    return IntSet.has(features, feature)
  }

  hasAsyncFeature(feature: AsyncFeatureBits) {
    let features = this.asyncFeatures || 0
    if (this._asyncFeatures) { features |= this._asyncFeatures }
    return IntSet.has(features, feature)
  }

  isAborted(taskId?: AsyncTaskId) {
    const isMultiTask = this.hasAsyncFeature(ToolAsyncMultiTaskBit)
    const host = (this as any)._origin || this
    let aborter = host.__task_aborter as AbortController
    if (aborter) {
      if (isMultiTask) {
        if (taskId != null) {
          aborter = (aborter as any)[taskId]
        } else {
          throw new CommonError('Missing taskId', this.name + '.isAborted', ErrorCode.InvalidArgument)
        }
      }
    }
    return !aborter || aborter.signal.aborted
  }

  getRunningTask(taskId?: AsyncTaskId) {
    const isMultiTask = this.hasAsyncFeature(ToolAsyncMultiTaskBit)
    const host = (this as any)._origin || this
    let aborter: TaskAbortController|undefined = host.__task_aborter as TaskAbortController
    if (aborter) {
      if (isMultiTask) {
        if (taskId != null) {
          aborter = (aborter as any)[taskId]
        } else {
          throw new CommonError('Missing taskId', this.name + '.getRunningTask', ErrorCode.InvalidArgument)
        }
      }
    }
    if (aborter?.signal.aborted) {
      if (isMultiTask) {
        (host.__task_aborter as any)[taskId!] = undefined
      } else {
        host.__task_aborter = undefined
      }
      aborter = undefined
    }
    return aborter
  }

  getRunningTaskCount() {
    let result: number
    const isMultiTask = this.hasAsyncFeature(ToolAsyncMultiTaskBit)
    const host = (this as any)._origin || this
    if (isMultiTask) {
      const aborters = host.__task_aborter as {[id: string]:TaskAbortController|undefined}
      result = aborters ? Object.entries(aborters).filter(([id, aborter]) => {
        if (!aborter) return false
        if (aborter.signal.aborted) {
          aborters[id] = undefined
          return false
        }
        return true
      }).length : 0
    } else {
      const aborter = host.__task_aborter as TaskAbortController
      result = aborter?.signal.aborted ? 0 : 1
    }
    return result
  }

  _generateAsyncTaskId(taskId?: AsyncTaskId, aborters?: TaskAbortControllers) {
    if (!aborters) {
      const host = (this as any)._origin || this
      aborters = host.__task_aborter as unknown as TaskAbortControllers
    }
    if (taskId == null) {
      // find a free taskId in aborters
      taskId = 0
      if (aborters) while (aborters[taskId]) {
        (taskId as number)++
      }
      // taskId = Object.keys(aborters).length
    }
    return taskId
  }

  $generateAsyncTaskId(taskId?: AsyncTaskId, aborters?: TaskAbortControllers) {
    const superGenerateAsyncTaskId = (this as any).super
    const that = (this as any).self || this
    if (superGenerateAsyncTaskId) {
      // 必须把 aborters 透传给自定义实现，否则其无法感知任务池
      taskId = superGenerateAsyncTaskId.call(that, taskId, aborters)
    } else {
      taskId = this._generateAsyncTaskId(taskId, aborters)
    }
    return taskId
  }

  createAborter(params?: any, taskId?: AsyncTaskId, raiseError = true, ctx?: ToolFuncContext) {
    const isMultiTask = this.hasAsyncFeature(ToolAsyncMultiTaskBit)
    const host = (this as any)._origin || this
    if (!isMultiTask && raiseError && this.getRunningTask()) { throw new CommonError('The task is running', this.name, ErrorCode.TooManyRequests)}

    // 优先级：params.aborter > ctx.aborter > new
    let result: TaskAbortController = params?.aborter || ctx?.aborter || new TaskAbortController(host)
    const externalAborterSignals: AbortSignal[] = []
    if (!(result instanceof TaskAbortController)) {
      const extAborter = result as unknown as AbortController
      if (extAborter instanceof AbortController) {
        // 外部传入的原生 AbortController：不篡改其原型，而是包装一个内部 TaskAbortController，
        // 并把外部 controller 的 signal 当作普通外部信号链接。
        // 这样每个任务拥有独立的 id/timeout/streamController，多个任务共享同一个外部
        // controller 时互不覆盖；中止外部 controller 依然会联动中止所有相关任务。
        externalAborterSignals.push(extAborter.signal)
        result = new TaskAbortController(host)
      } else {
        throw new CommonError('aborter should be an AbortController', this.name, ErrorCode.InvalidArgument)
      }
    }

    if (isMultiTask) {
      if (host.__task_aborter == null) { host.__task_aborter = {} }
      const aborters = host.__task_aborter as unknown as TaskAbortControllers

      if (taskId == null) {
        taskId = this.generateAsyncTaskId(taskId, aborters)
      }
      result.id = taskId
      if (ctx) { ctx.taskId = taskId }

      aborters[taskId] = result
    } else {
      host.__task_aborter = result
    }

    // 2) 链接外部信号（含被包装的外部 aborter 的 signal）
    const extSignals = [
      ...externalAborterSignals,
      ...toSignalArray(params?.signal),
      ...toSignalArray(params?.signals),
      ...toSignalArray(ctx?.signal),
      ...toSignalArray(ctx?.signals),
    ];
    if (extSignals.length) {
      const cleanup = linkAnyAbort(result, extSignals);
      if (ctx) {
        const oldCleanup = (ctx as any)._linkCleanup;
        (ctx as any)._linkCleanup = oldCleanup ? () => { cleanup?.(); oldCleanup(); } : cleanup;
      }
    }

    // 优先级：params.timeout > ctx.timeout；params.timeout=0 可显式关闭继承的超时
    const timeout = params?.timeout ?? ctx?.timeout
    // timeout 是“整个任务链”的最大执行时间：只在首次（最外层）设置，
    // 嵌套任务复用同一个 aborter 时不会重置或延长该定时器
    if (timeout > 0 && result.timeoutId == null) {
      if (ctx) { ctx.timeout = timeout }
      // 闭包捕获本次调用的 taskId（并发共享 aborter 时 result.id 会被覆盖，不可读）
      const thisTaskId = taskId
      result.timeoutId = setTimeout(() => {
        result.timeoutId = undefined
        const data: any = {timeout}
        if (isMultiTask) { data.taskId = thisTaskId }
        this.abort('timeout', data)
      }, timeout)
    }

    result.signal.addEventListener('abort', () => {
      const timeoutId = result.timeoutId
      if (timeoutId) {
        result.timeoutId = undefined
        clearTimeout(timeoutId)
      }
      const signal = result.signal
      try {
        if (this.emit) {
          this.emit('aborting', signal.reason, (signal.reason as any)?.data)
        }
      } finally {
        try {
          // 并发共享同一 aborter 的流任务各自持有独立 controller，中止时全部 error
          const controllers = result.streamControllers
          if (controllers?.length) {
            for (const c of [...controllers]) {
              try { c.error?.(signal.reason) } catch {}
            }
          }
        } catch {}
      }

    })

    return result
  }

  $cleanMultiTaskAborter(id: AsyncTaskId, aborters: TaskAbortControllers) {
    const superCleanMultiTaskAborter = (this as any).super
    const that = (this as any).self || this
    if (superCleanMultiTaskAborter) {
      superCleanMultiTaskAborter.call(that, id, aborters)
    } else {
      that._cleanMultiTaskAborter(id, aborters)
    }
  }

  cleanTaskAborter(aborter: TaskAbortController, taskId?: AsyncTaskId) {
    const isMultiTask = this.hasAsyncFeature(ToolAsyncMultiTaskBit)
    const host = (this as any)._origin || this
    if (isMultiTask) {
      const aborters = host.__task_aborter as unknown as TaskAbortControllers
      // 权威身份：本次调用闭包捕获的 taskId（并发共享 ctx/aborter 时 aborter.id 不可靠，仅作兜底）
      const id = taskId ?? aborter.id!
      this.cleanMultiTaskAborter(id, aborters)
    } else {
      host.__task_aborter = undefined
    }
  }

  _cleanMultiTaskAborter(id: AsyncTaskId, aborters: TaskAbortControllers) {
    if (typeof id === 'number') { aborters[id] = undefined } else { delete aborters[id] }
  }

  /**
   * 为本次调用解析每任务 taskId（multitask 模式下预生成并返回）。
   *
   * 并发任务可能共享同一个 ctx（如同一个 `with()` runner 上的并发 `run()`）与同一个 aborter，
   * 因此 taskId 必须在调用方作为局部变量持有、通过闭包传递，
   * 而不能存到共享对象上（`ctx.taskId` / `aborter.id` 都会被覆盖）。
   */
  _resolveTaskId(taskId?: AsyncTaskId): AsyncTaskId|undefined {
    if (this.hasAsyncFeature(ToolAsyncMultiTaskBit)) {
      if (taskId == null) {
        const host = (this as any)._origin || this
        if (host.__task_aborter == null) { host.__task_aborter = {} }
        taskId = this.generateAsyncTaskId(taskId, host.__task_aborter as unknown as TaskAbortControllers)
      }
    }
    return taskId
  }

  createTaskPromise<Output = any>(runTask: (params: Record<string, any>, aborter: TaskAbortController) => Promise<Output>, params: Record<string, any>, options?: {taskId?: AsyncTaskId, raiseError?: boolean}) {
    // 优先从 this.ctx 获取
    const taskId = this._resolveTaskId(options?.taskId)
    const aborter = this.createAborter(params, taskId, options?.raiseError, (this as any).ctx);
    if (params === undefined) {params = {}}
    if (typeof params === 'object') {
      params.aborter = aborter
    }

    const taskPromise: TaskPromise<Output> = this._runCancelableTask(runTask, params, aborter, taskId)
    taskPromise.task = aborter

    return taskPromise
  }

  /**
   * 执行任务并绑定清理逻辑（任务池注销 / 流管道 / timeout 清理 / 外部信号监听清理）。
   *
   * - 通过 Promise.resolve().then 延迟调用 runTask，使同步 throw 也走 reject 路径，
   *   保证 .catch/.finally 清理逻辑必然执行，避免 aborter 泄漏。
   * - 引用计数：嵌套任务复用同一个 aborter 时，只有最后一个任务结束时才清理 timeout
   *   定时器，保证 timeout 覆盖整个任务链。计数以“已启动”的任务为准（排队中尚未
   *   运行的任务不计入），故并发共享 aborter + 信号量排队时，最后一个启动的任务
   *   结束即清理定时器，组级 deadline 以启动阶段为界。
   */
  _runCancelableTask<Output = any>(runTask: (params: Record<string, any>, aborter: TaskAbortController) => Promise<Output>, params: Record<string, any>, aborter: TaskAbortController, taskId?: AsyncTaskId): Promise<Output> {
    aborter._taskCount = (aborter._taskCount || 0) + 1

    return Promise.resolve().then(() => runTask(params, aborter))
    .then((result: any) => {
      if (result && result instanceof ReadableStream) {
        let streamController: any
        const onStart = (controller: TransformStreamDefaultController) => {
          streamController = controller
          defineProperty(aborter, 'streamController', controller)
          let controllers = aborter.streamControllers
          if (!controllers) { controllers = aborter.streamControllers = [] }
          controllers.push(controller)
        }
        const onCleanAborter = () => {
          const controllers = aborter.streamControllers
          if (streamController && controllers) {
            const i = controllers.indexOf(streamController)
            if (i >= 0) { controllers.splice(i, 1) }
            if (!controllers.length) { aborter.streamControllers = undefined }
          }
          this.cleanTaskAborter(aborter, taskId)
        }
        const onTransform = (chunk: any, controller: TransformStreamDefaultController) => {
          if (chunk && typeof chunk === 'object') {
            // 每任务身份：闭包捕获的 taskId（共享 ctx/aborter 时 aborter.id 不可靠）
            chunk.taskId = taskId ?? aborter.id
          }
          return chunk
        }
        // onCancel：消费者取消流时（如 RPC 客户端断开）也必须注销任务
        const transformer = createCallbacksTransformer({onStart, onFinal: onCleanAborter, onError: onCleanAborter, onCancel: onCleanAborter, onTransform})
        result = result.pipeThrough(transformer)
      } else {
        this.cleanTaskAborter(aborter, taskId)
      }
      return result
    }).catch((err) => {
      this.cleanTaskAborter(aborter, taskId)
      throw err
    }).finally(() => {
      aborter._taskCount = (aborter._taskCount || 1) - 1
      if (aborter._taskCount <= 0) {
        if (aborter.timeoutId) {
          clearTimeout(aborter.timeoutId)
          aborter.timeoutId = undefined
        }
      }
      const ctx = (this as any).ctx
      if (ctx?._linkCleanup) {
        ctx._linkCleanup()
        ctx._linkCleanup = undefined
      }
    })
  }

  runAsyncCancelableTask<Output = any>(params: Record<string, any> = {}, runTask: (params: Record<string, any>, aborter: TaskAbortController) => Promise<Output>, options?: {taskId?: AsyncTaskId, raiseError?: boolean, isReadyFn?: SemaphoreIsReadyFuncType}) {
    // 先解析每任务 taskId、创建 aborter（注册任务、设置 timeout），再获取信号量，
    // 最后才真正执行 runTask——排队中的任务不会提前开始执行
    const taskId = this._resolveTaskId(options?.taskId)
    const aborter = this.createAborter(params, taskId, options?.raiseError, (this as any).ctx);
    if (params === undefined) {params = {}}
    if (typeof params === 'object') {
      params.aborter = aborter
    }

    const semaphore = this.getSemaphore(options?.isReadyFn)
    let taskPromise: TaskPromise<Output>
    if (semaphore) {
      // 惰性执行：acquire 成功后才启动任务，maxTaskConcurrency 才能真正限制并发；
      // 若在排队期间被中止，acquire 会 reject，任务不会被执行
      taskPromise = semaphore.acquire({signal: aborter.signal}).then(() => this._runCancelableTask(runTask, params, aborter, taskId)).finally(() => {
        semaphore.release()
      }) as TaskPromise<Output>
    } else {
      taskPromise = this._runCancelableTask(runTask, params, aborter, taskId) as TaskPromise<Output>
    }
    taskPromise.task = aborter
    return taskPromise
  }

  abort(reason?: string, data?: any) {
    const host = (this as any)._origin || this
    let aborter = host.__task_aborter as TaskAbortController
    if (aborter) {
      const isMultiTask = this.hasAsyncFeature(ToolAsyncMultiTaskBit)
      if (isMultiTask) {
        const aborters = aborter as unknown as {[id: string]:TaskAbortController|undefined}
        const taskId = data?.taskId
        if (taskId != null) {
          aborter = aborters[taskId] as TaskAbortController
          this.cleanMultiTaskAborter(taskId, aborters)
        } else {
          throw new CommonError('Missing data.taskId', this.name + '.abort', ErrorCode.InvalidArgument)
        }
      } else {
        host.__task_aborter = undefined
      }

      if (aborter && !aborter.signal.aborted) {
        aborter.abort(reason, data)
      }
    }
  }

  /**
   * Method overloading for ToolFunc._shouldIsolate
   */
  $_shouldIsolate(params?: any, ctx?: ToolFuncContext): boolean {
    const Super = (this as any).super;
    const that = (this as any).self || this;
    if (Super && Super.call(that, params, ctx)) return true;
    if (Object.prototype.hasOwnProperty.call(that, 'ctx')) return false;
    return that.hasAsyncFeature(AsyncFeatureBits.Cancelable);
  }

  /**
   * Method overloading for ToolFunc._prepareContext
   */
  $_prepareContext(params?: any, ctx?: ToolFuncContext): ToolFuncContext {
    const Super = (this as any).super;
    const that = (this as any).self || this;
    const result = Super ? Super.call(that, params, ctx) : (ctx || {});

    if (that.hasAsyncFeature(AsyncFeatureBits.Cancelable)) {
      // Reuse existing aborter if available in params or inherited context
      let aborter = params?.aborter || result.aborter;
      if (!aborter) {
        aborter = new TaskAbortController(that as any);
      }
      result.aborter = aborter;

      // Link external signals if any
      const extSignals = [
        ...toSignalArray(params?.signal),
        ...toSignalArray(params?.signals),
        ...toSignalArray(result.signal),
        ...toSignalArray(result.signals),
      ];
      if (extSignals.length) {
        const cleanup = linkAnyAbort(aborter, extSignals);
        const oldCleanup = result._linkCleanup;
        result._linkCleanup = oldCleanup ? () => { cleanup?.(); oldCleanup(); } : cleanup;
      }
    }
    return result;
  }
}
CancelableAbility.prototype.generateAsyncTaskId = function(this: CancelableAbility, taskId?: AsyncTaskId, aborters?: TaskAbortControllers): AsyncTaskId {
  return this._generateAsyncTaskId(taskId, aborters)
}

CancelableAbility.prototype.cleanMultiTaskAborter = function(this: CancelableAbility, id: AsyncTaskId, aborters: TaskAbortControllers) {
  return this._cleanMultiTaskAborter(id, aborters)
}

function onInjectionSuccess(Tool: typeof ToolFunc, options?: CancelableAbilityOptions) {
  let asyncFeatures = Tool.prototype._asyncFeatures || 0
  asyncFeatures |= AsyncFeatures.Cancelable
  if (options) {
    if (options.asyncFeatures) {
      asyncFeatures |= options.asyncFeatures
    }
    if (options.maxTaskConcurrency! > 0) {
      Tool.prototype._maxTaskConcurrency = options.maxTaskConcurrency
    }
    if (options.isReadyFn && typeof options.isReadyFn === 'function') {
      Tool.prototype._isReadyFn = options.isReadyFn
    }
  }

  // 动态扩展属性 Schema，使构造函数能识别并初始化这些属性
  if (Tool.defineProperties) Tool.defineProperties(Tool, {
    _maxTaskConcurrency: {
      type: 'number',
      alias: 'maxTaskConcurrency',
    },
    _isReadyFn: {
      type: 'function',
      alias: 'isReadyFn',
    },
  })

  Tool.prototype._asyncFeatures = asyncFeatures
}

function linkAnyAbort(aborter: TaskAbortController, externalSignals: AbortSignal[]) {
  if (!externalSignals.length) return;

  const offs: Array<() => void> = [];
  const handleAborterAborted = () => {
    // 内部已中止时，清理所有外部监听
    for (const off of offs) { try { off(); } catch {} }
    offs.length = 0;
  };

  // 如果任一外部 signal 已经中止，立即触发内部 abort
  const already = externalSignals.find(s => s.aborted);
  if (already) {
    const reason = (already as any).reason;
    try { aborter.abort(reason || 'aborted'); } catch {}
    return handleAborterAborted; // 内部 abort 会触发 handleAborterAborted 清理
  }

  // 监听任一外部 signal
  for (const s of externalSignals) {
    const fn = () => {
      const reason = (s as any).reason;
      try { aborter.abort(reason || 'aborted'); } catch(e) {console.error(e)}
    };
    s.addEventListener('abort', fn, { once: true });
    offs.push(() => s.removeEventListener('abort', fn));
  }

  // 当内部 abort 时，移除全部外部监听
  const onInner = () => handleAborterAborted();
  aborter.signal.addEventListener('abort', onInner, { once: true });
  offs.push(() => aborter.signal.removeEventListener('abort', onInner));

  return handleAborterAborted;
}

function toSignalArray(sig?: AbortSignal | AbortSignal[] | null): AbortSignal[] {
  if (!sig) return [];
  return Array.isArray(sig) ? sig.filter(Boolean) as AbortSignal[] : [sig];
}

// type ToolFuncCancelableFn<T extends { new (...args: any[]): any } = typeof ToolFunc> = (Tool: T, options?: CancelableAbilityOptions) => T

export const makeToolFuncCancelable = createAbilityInjector(CancelableAbility, 'abort', {afterInjection: onInjectionSuccess as any});
