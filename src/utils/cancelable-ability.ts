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
  declare streamController?: ReadableStreamDefaultController
  declare parent: CancelableAbility

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
      result = host.__task_semaphore = new Semaphore(maxTaskConcurrency-1, {isReadyFn})
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
      result = aborters && Object.entries(aborters).filter(([id, aborter]) => {
        if (aborter?.signal.aborted) {aborters[id]=undefined} else {return true}
      }).length
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
      taskId = superGenerateAsyncTaskId.call(that, taskId)
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
    if (!(result instanceof TaskAbortController)) {
      if ((result as any) instanceof AbortController) {
        Object.setPrototypeOf(result, TaskAbortController.prototype)
        defineProperty(result, 'parent', host)
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

    // 2) 链接外部信号
    const extSignals = [
      ...toSignalArray(params?.signal),
      ...toSignalArray(params?.signals),
      ...toSignalArray(ctx?.signal),
      ...toSignalArray(ctx?.signals),
    ];
    if (extSignals.length) {
      linkAnyAbort(result, extSignals);
    }

    const timeout = params?.timeout || ctx?.timeout
    if (timeout > 0) {
      if (ctx) { ctx.timeout = timeout }
      result.timeoutId = setTimeout(() => {
        result.timeoutId = undefined
        const data: any = {timeout}
        if (isMultiTask) { data.taskId = result.id }
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
        try { result.streamController?.error?.(signal.reason) } catch {}
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

  cleanTaskAborter(aborter: TaskAbortController) {
    const isMultiTask = this.hasAsyncFeature(ToolAsyncMultiTaskBit)
    const host = (this as any)._origin || this
    if (isMultiTask) {
      const aborters = host.__task_aborter as unknown as TaskAbortControllers
      this.cleanMultiTaskAborter(aborter.id!, aborters)
    } else {
      host.__task_aborter = undefined
    }
  }

  _cleanMultiTaskAborter(id: AsyncTaskId, aborters: TaskAbortControllers) {
    if (typeof id === 'number') { aborters[id] = undefined } else { delete aborters[id] }
  }

  createTaskPromise<Output = any>(runTask: (params: Record<string, any>, aborter: TaskAbortController) => Promise<Output>, params: Record<string, any>, options?: {taskId?: AsyncTaskId, raiseError?: boolean}) {
    // 优先从 this.ctx 获取
    const aborter = this.createAborter(params, options?.taskId, options?.raiseError, (this as any).ctx);
    if (params === undefined) {params = {}}
    if (typeof params === 'object') {
      params.aborter = aborter
    }

    let taskPromise: TaskPromise<Output> = runTask(params, aborter)
    .then((result: any) => {
      if (result && result instanceof ReadableStream) {
        const onStart = (controller) => { defineProperty(aborter, 'streamController', controller) }
        const onCleanAborter = () => {this.cleanTaskAborter(aborter)}
        const onTransform = (chunk: any, controller: TransformStreamDefaultController) => {
          if (chunk && typeof chunk === 'object') {
            chunk.taskId = aborter.id
          }
          return chunk
        }
        const transformer = createCallbacksTransformer({onStart, onFinal: onCleanAborter, onError: onCleanAborter, onTransform})
        result = result.pipeThrough(transformer)
      } else {
        this.cleanTaskAborter(aborter)
      }
      return result
    }).catch((err) => {
      this.cleanTaskAborter(aborter)
      throw err
    }).finally(() => {
      if (aborter.timeoutId) {
        clearTimeout(aborter.timeoutId)
        aborter.timeoutId = undefined
      }
    })
    taskPromise.task = aborter

    return taskPromise
  }

  runAsyncCancelableTask<Output = any>(params: Record<string, any> = {}, runTask: (params: Record<string, any>, aborter: TaskAbortController) => Promise<Output>, options?: {taskId?: AsyncTaskId, raiseError?: boolean, isReadyFn?: SemaphoreIsReadyFuncType}) {
    let taskPromise = this.createTaskPromise(runTask, params, options)

    const semaphore = this.getSemaphore(options?.isReadyFn)
    if (semaphore) {
      const _taskPromise = taskPromise
      const task = _taskPromise.task!
      taskPromise = semaphore.acquire({signal: task.signal}).then(() => _taskPromise).finally(() => {
        semaphore.release()
      })
      taskPromise.task = task
    }
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
        linkAnyAbort(aborter, extSignals);
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
    return; // 内部 abort 会触发 handleAborterAborted 清理
  }

  // 监听任一外部 signal
  for (const s of externalSignals) {
    const fn = () => {
      const reason = (s as any).reason;
      try { aborter.abort(reason || 'aborted'); } catch(e) {console.log(e)}
    };
    s.addEventListener('abort', fn, { once: true });
    offs.push(() => s.removeEventListener('abort', fn));
  }

  // 当内部 abort 时，移除全部外部监听
  const onInner = () => handleAborterAborted();
  aborter.signal.addEventListener('abort', onInner, { once: true });
  offs.push(() => aborter.signal.removeEventListener('abort', onInner));
}

function toSignalArray(sig?: AbortSignal | AbortSignal[] | null): AbortSignal[] {
  if (!sig) return [];
  return Array.isArray(sig) ? sig.filter(Boolean) as AbortSignal[] : [sig];
}

// type ToolFuncCancelableFn<T extends { new (...args: any[]): any } = typeof ToolFunc> = (Tool: T, options?: CancelableAbilityOptions) => T

export const makeToolFuncCancelable = createAbilityInjector(CancelableAbility, 'abort', {afterInjection: onInjectionSuccess as any});
