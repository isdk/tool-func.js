import {beforeEach, describe, expect, it, vi as jest} from 'vitest'
import { ToolFunc } from '../tool-func'
import { AsyncTaskId, CancelableAbility, makeToolFuncCancelable, TaskAbortController, TaskAbortControllers, TaskPromise } from './cancelable-ability'
import { AsyncFeatureBits, AsyncFeatures, ToolAsyncCancelableBit, ToolAsyncMultiTaskBit } from './async-features'
import { sleep } from '@isdk/util'
import { uuid } from '@isdk/hash'
import { AbortError } from '@isdk/common-error'

declare namespace TestSingleTask {
  function hasAsyncFeature(feature: AsyncFeatureBits): boolean;
}
interface TestSingleTask extends CancelableAbility {}
class TestSingleTask {
  run(params: any) {
    return this.runAsyncCancelableTask(params, async (params: any, aborter: TaskAbortController) => {
      const lastTick = Date.now() + (params?.waitTime ?? 10)
      while (Date.now() < lastTick) {
        if (aborter.throwRejected()) { return }
        await sleep(1)
      }
      return params
    })
  }
}
makeToolFuncCancelable(TestSingleTask)

class TestSingleTaskFunc extends ToolFunc {
  func(params: any) {
    return this.runAsyncCancelableTask(params, async (params: any, aborter: TaskAbortController) => {
      const lastTick = Date.now() + (params?.waitTime ?? 10)
      while (Date.now() < lastTick) {
        if (aborter.throwRejected()) { return }
        await sleep(1)
      }
      return params
    })
  }
}

makeToolFuncCancelable(TestSingleTaskFunc)

class TestMultiTaskFunc extends ToolFunc {
  func(params: any) {
    return this.runAsyncCancelableTask(params, async (params: any, aborter: TaskAbortController) => {
      for (let i = 0; i < 5; i++) {
        if (aborter.throwRejected()) { return }
        await sleep(10)
      }
      return params
    })
  }
}
const maxTaskConcurrency = 3
makeToolFuncCancelable(TestMultiTaskFunc,{asyncFeatures: AsyncFeatures.MultiTask, maxTaskConcurrency})

function getStream() {
  const readableStream = new ReadableStream({
    start(controller) {
      // called by constructor
      // console.log('[start]');
      controller.enqueue({content: 'a'});
      controller.enqueue({content: 'b'});
      controller.enqueue({content: 'c'});
    },
    pull(controller) {
      // called read when controller's queue is empty
      // console.log('[pull]');
      controller.enqueue({content: 'd'});
      controller.enqueue({content: 'e'});
      controller.close(); // or controller.error();
    },
    cancel(reason) {
      // called when rs.cancel(reason)
      // console.log('[cancel]', reason);
    },
  });
  return readableStream
}

class TestStreamTaskFunc extends ToolFunc {
  func(params: any) {
    return this.runAsyncCancelableTask(params, async (params: any) => {
      return getStream()
    })
  }
}

makeToolFuncCancelable(TestStreamTaskFunc,{asyncFeatures: AsyncFeatures.MultiTask, maxTaskConcurrency})

const testSingleTask = new TestSingleTaskFunc('testSingleTask')
const testMultiTask = new TestMultiTaskFunc('testMultiTask')
const testStreamTask = new TestStreamTaskFunc('testStreamTask')

describe('CancelableAbility', () => {
  beforeEach(() =>{
    // restore all mocks to original
    jest.restoreAllMocks()
  })

  it('should run single async task without ToolFunc', async () => {
    const testSingleTask = new TestSingleTask()
    expect(testSingleTask.hasAsyncFeature(AsyncFeatureBits.Cancelable)).toBeTruthy()
    expect(TestSingleTaskFunc.hasAsyncFeature(ToolAsyncCancelableBit)).toBeTruthy()
    const taskInfo = testSingleTask.run('12345') as TaskPromise<string>
    expect(taskInfo.task).toBeInstanceOf(AbortController)

    await expect(async () => {await sleep(1); testSingleTask.run('345');}).rejects.toThrow('The task is running')
    const result = await taskInfo
    expect(result).toBe('12345')
  })

  it('should run single async task only', async () => {
    expect(testSingleTask.hasAsyncFeature(AsyncFeatureBits.Cancelable)).toBeTruthy()
    expect(TestSingleTaskFunc.hasAsyncFeature(ToolAsyncCancelableBit)).toBeTruthy()
    const taskInfo = testSingleTask.run('12345') as TaskPromise<string>
    expect(taskInfo.task).toBeInstanceOf(AbortController)

    await expect(async () => {await sleep(1); testSingleTask.run('345');}).rejects.toThrow('The task is running')
    const result = await taskInfo
    expect(result).toBe('12345')
  })

  it('should run multi async tasks', async () => {
    expect(testMultiTask.hasAsyncFeature(AsyncFeatureBits.Cancelable)).toBeTruthy()
    expect(testMultiTask.hasAsyncFeature(ToolAsyncMultiTaskBit)).toBeTruthy()
    expect(TestMultiTaskFunc.hasAsyncFeature(AsyncFeatureBits.MultiTask)).toBeTruthy()
    const taskInfo = testMultiTask.run('12345') as TaskPromise<string>
    expect(taskInfo.task).toBeInstanceOf(AbortController)
    expect(taskInfo.task).toHaveProperty('id')

    await expect(testMultiTask.run('345')).resolves.toBe('345')
    const result = await taskInfo
    expect(result).toBe('12345')
  })

  it('should run multi async tasks with maxTaskConcurrency limit', async () => {
    expect(testMultiTask.hasAsyncFeature(AsyncFeatureBits.Cancelable)).toBeTruthy()
    expect(testMultiTask.hasAsyncFeature(ToolAsyncMultiTaskBit)).toBeTruthy()
    expect(TestMultiTaskFunc.hasAsyncFeature(AsyncFeatureBits.MultiTask)).toBeTruthy()
    expect(testMultiTask.semaphore).toBeDefined()

    const taskCount = 10;
    const tasks = Array.from({ length: taskCount }, (_, index) => '' + index);


    const orgAcquire = testMultiTask.semaphore.acquire.bind(testMultiTask.semaphore);
    const orgRelease = testMultiTask.semaphore.release.bind(testMultiTask.semaphore);
    const acquireMock = jest.spyOn(testMultiTask.semaphore, 'acquire').mockImplementation(orgAcquire);
    const releaseMock = jest.spyOn(testMultiTask.semaphore, 'release').mockImplementation(orgRelease);

    const pendingCountsBefore = [] as number[];
    const pendingCountsAfter = [] as number[];
    const asyncTask = async (item: string, ix: number) => {
      const semaphore = testMultiTask.semaphore;
      let pendingCount = semaphore.pendingCount;
      pendingCountsBefore.push(pendingCount)
      // console.log('🚀 ~ asyncTask ~ pendingCount before:', ix, pendingCount, ix < maxTaskConcurrency ? 0 : ix - maxTaskConcurrency+1)
      // expect(pendingCount).toBe(ix < maxTaskConcurrency ? 0 : ix - maxTaskConcurrency)
      await testMultiTask.run(item)
      pendingCount = semaphore.pendingCount;
      pendingCountsAfter.push(pendingCount)
      // console.log('🚀 ~ asyncTask ~ pendingCount:', ix, pendingCount)
    };
    await Promise.all(tasks.map(asyncTask));

    // all tasks should be executed matched
    expect(acquireMock).toHaveBeenCalledTimes(taskCount);
    expect(releaseMock).toHaveBeenCalledTimes(taskCount);

    // check maxTaskConcurrency limit
    // maxTaskConcurrency=3 → 允许 3 个并发（修复 off-by-one 后不再少 1 个）
    expect(pendingCountsBefore).toEqual([0, 0, 0, 0, 1, 2, 3, 4, 5, 6])
    expect(pendingCountsAfter).toEqual([6, 5, 4, 3, 2, 1, 0, 0, 0, 0])
  })

  it('should run async multi tasks with stream', async () => {
    const taskInfo = testStreamTask.run() as TaskPromise<ReadableStream>
    expect(taskInfo.task).toBeInstanceOf(AbortController)
    expect(taskInfo.task).toHaveProperty('id')

    await expect(testMultiTask.run('345')).resolves.toBe('345')
    const result = await taskInfo
    expect(result).toBeInstanceOf(ReadableStream)
    const reader = result.getReader()
    const chunks = [] as any[]
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      const value = chunk.value
      chunks.push(value)
    }

    expect(chunks).toHaveLength(5)
    expect(chunks.map(chunk => chunk.content)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(chunks.map(chunk => chunk.taskId)).toEqual([0, 0, 0, 0, 0])
  })

  it('should run async task with custom generation task Id', async () => {
    const ids = [] as string[]
    const rmIds = [] as string[]
    interface TestTaskIdFunc extends CancelableAbility {}
    class TestTaskIdFunc extends ToolFunc {
      generateAsyncTaskId(taskId?: AsyncTaskId, aborters?: TaskAbortControllers) {
        if (!taskId) {
          taskId = uuid()
        }
        ids.push(taskId as string)
        return taskId
      }

      cleanMultiTaskAborter(id: AsyncTaskId, aborters: TaskAbortControllers) {
        rmIds.push(id as string)
        delete aborters[id]
      }

      func(params: any) {
        return this.runAsyncCancelableTask(params, async (params: any) => {
          await sleep(10)
          return params
        })
      }
    }
    makeToolFuncCancelable(TestTaskIdFunc, {asyncFeatures: AsyncFeatures.MultiTask})

    const testTaskId = new TestTaskIdFunc('testTaskId')

    expect(testTaskId.hasAsyncFeature(AsyncFeatureBits.MultiTask)).toBeTruthy()
    expect(TestTaskIdFunc.hasAsyncFeature(ToolAsyncCancelableBit)).toBeTruthy()
    const taskInfo = testTaskId.run('12345') as TaskPromise<string>
    expect(taskInfo.task).toBeInstanceOf(AbortController)
    const aborter = taskInfo.task!
    expect(ids).toHaveLength(1)
    expect(rmIds).toHaveLength(0)
    expect(aborter).toHaveProperty('id', ids[0])
    expect(typeof aborter.id).toBe('string')
    const result = await taskInfo
    expect(rmIds).toHaveLength(1)
    expect(aborter.id).toBe(rmIds[0])
    expect(result).toBe('12345')
  })

  it('should clean task aborter if task raise error', async () => {
    const ids = [] as AsyncTaskId[]
    const rmIds = [] as AsyncTaskId[]
    interface TestTaskErrorFunc extends CancelableAbility {}
    class TestTaskErrorFunc extends ToolFunc {
      generateAsyncTaskId(taskId?: AsyncTaskId, aborters?: TaskAbortControllers) {
        taskId = this._generateAsyncTaskId(taskId, aborters)
        ids.push(taskId as string)
        return taskId
      }

      cleanMultiTaskAborter(id: AsyncTaskId, aborters: TaskAbortControllers) {
        rmIds.push(id)
        this._cleanMultiTaskAborter(id, aborters)
      }

      func(params: any) {
        return this.runAsyncCancelableTask(params, async (params: any) => {
          await sleep(10)
          if (params === 'error') {throw new Error('test')}
          return params
        })
      }
    }
    makeToolFuncCancelable(TestTaskErrorFunc, {asyncFeatures: AsyncFeatures.MultiTask})

    const testTask = new TestTaskErrorFunc('testTaskError')

    const taskInfo = testTask.run('error') as TaskPromise<string>
    expect(taskInfo.task).toBeInstanceOf(AbortController)
    const aborter = taskInfo.task!
    expect(ids).toHaveLength(1)
    expect(rmIds).toHaveLength(0)
    expect(aborter).toHaveProperty('id', ids[0])
    expect(typeof aborter.id).toBe('number')
    await expect(taskInfo).rejects.toThrow('test')
    await sleep(10)
    expect(rmIds).toHaveLength(1)
    expect(aborter.id).toBe(rmIds[0])
  })

  it('should clean task aborter if stream raise error', async () => {
    const ids = [] as AsyncTaskId[]
    const rmIds = [] as AsyncTaskId[]
    const emits = [] as any[]
    interface TestTaskErrorFunc extends CancelableAbility {}
    class TestTaskErrorFunc extends ToolFunc {
      emit(...args: any[]) {
        emits.push(args)
      }

      generateAsyncTaskId(taskId?: AsyncTaskId, aborters?: TaskAbortControllers) {
        taskId = this._generateAsyncTaskId(taskId, aborters)
        ids.push(taskId as string)
        return taskId
      }

      cleanMultiTaskAborter(id: AsyncTaskId, aborters: TaskAbortControllers) {
        rmIds.push(id)
        this._cleanMultiTaskAborter(id, aborters)
      }

      func(params: any) {
        return this.runAsyncCancelableTask(params, async (params: any) => {
          return getStream()
        })
      }
    }
    makeToolFuncCancelable(TestTaskErrorFunc, {asyncFeatures: AsyncFeatures.MultiTask})

    const testTask = new TestTaskErrorFunc('testTaskError')

    const taskInfo = testTask.run('error') as TaskPromise<ReadableStream>
    expect(taskInfo.task).toBeInstanceOf(AbortController)
    const task = taskInfo.task!
    expect(ids).toHaveLength(1)
    expect(rmIds).toHaveLength(0)
    expect(task).toHaveProperty('id', ids[0])
    expect(typeof task.id).toBe('number')
    const stream = (await taskInfo)
    const reader = stream.getReader()
    let chunk = await reader.read()
    let error:any

    const data = {a:1}
    task.abort('test', data)
    await expect(reader.read()).rejects.toThrow(AbortError)
    try {
      chunk = await reader.read()
    } catch (err) {
      error = err
    }
    expect(error).toHaveProperty('data')
    expect(error.data).toHaveProperty('what', 'test')

    expect(rmIds).toHaveLength(1)
    expect(task.id).toBe(rmIds[0])
    expect(emits).toHaveLength(1)
    expect(emits[0]).toHaveLength(3)
    expect(emits[0][0]).toBe('aborting')
    expect(emits[0][1].toJSON()).toMatchObject({data: {what: 'test', a: 1}, code: 499})
    expect(emits[0][2]).toMatchObject(data)
  })

  it('should pass an aborter into task', async () => {
    const aborter = new AbortController()

    const taskInfo = testSingleTask.run({content: '12345', waitTime: 100, aborter}) as TaskPromise<string>
    expect(taskInfo.task).toBeInstanceOf(TaskAbortController)
    // 外部 AbortController 不再被篡改原型，而是被包装为内部 TaskAbortController
    expect(taskInfo.task).not.toBe(aborter)
    expect(taskInfo.task).toHaveProperty('parent', testSingleTask)
    expect(aborter.signal.aborted).toBeFalsy()
    // 中止外部 controller 会联动中止任务
    aborter.abort('external abort')
    await expect(taskInfo).rejects.toThrow(/external abort/)
    expect(taskInfo.task!.signal.aborted).toBeTruthy()
  })

  it('should run multi async tasks and abort waiting task', async () => {
    expect(testMultiTask.hasAsyncFeature(AsyncFeatureBits.Cancelable)).toBeTruthy()
    expect(testMultiTask.hasAsyncFeature(ToolAsyncMultiTaskBit)).toBeTruthy()
    expect(TestMultiTaskFunc.hasAsyncFeature(AsyncFeatureBits.MultiTask)).toBeTruthy()

    const taskCount = 10;
    const tasks = Array.from({ length: taskCount }, (_, index) => '' + index);


    const pendingCountsBefore = [] as number[];
    const pendingCountsAfter = [] as number[];
    const errs = {} as any
    const asyncTask = async (item: string, ix: number) => {
      const semaphore = testMultiTask.semaphore;
      let pendingCount = semaphore.pendingCount;
      pendingCountsBefore.push(pendingCount)

      const taskInfo = testMultiTask.run(item) as TaskPromise
      if (ix === 3 || ix === 7) {
        taskInfo.task?.abort('test'+ix)
      }
      try {
        await taskInfo
      } catch(e) {
        errs[item] = e
      }
      pendingCount = semaphore.pendingCount;
      pendingCountsAfter.push(pendingCount)
    };

    await Promise.all(tasks.map(asyncTask));

    expect(Object.keys(errs)).toEqual(['3','7'])
    expect(Object.values(errs)).toMatchObject([{data: {what: 'test3'}}, {data: {what: 'test7'}}])
    // check maxTaskConcurrency limit
    expect(pendingCountsBefore).toEqual([0, 0, 0, 0, 1, 2, 3, 4, 5, 6])
    // expect(pendingCountsAfter).toEqual([6, 5, 4, 3, 2, 1, 0, 0, 0, 0])
  })

  it('should run multi async tasks and abort running task', async () => {
    expect(testMultiTask.hasAsyncFeature(AsyncFeatureBits.Cancelable)).toBeTruthy()
    expect(testMultiTask.hasAsyncFeature(ToolAsyncMultiTaskBit)).toBeTruthy()
    expect(TestMultiTaskFunc.hasAsyncFeature(AsyncFeatureBits.MultiTask)).toBeTruthy()

    const taskCount = 3;
    const tasks = Array.from({ length: taskCount }, (_, index) => '' + index);


    const pendingCountsBefore = [] as number[];
    const pendingCountsAfter = [] as number[];
    const errs = {} as any
    const asyncTask = async (item: string, ix: number) => {
      const semaphore = testMultiTask.semaphore;
      let pendingCount = semaphore.pendingCount;
      pendingCountsBefore.push(pendingCount)

      const taskInfo = testMultiTask.run(item) as TaskPromise
      if (ix === 1) {
        taskInfo.task?.abort('test'+ix)
      }
      try {
        await taskInfo
      } catch(e) {
        errs[item] = e
      }
      pendingCount = semaphore.pendingCount;
      pendingCountsAfter.push(pendingCount)
    };

    await Promise.all(tasks.map(asyncTask));

    expect(Object.keys(errs)).toEqual(['1'])
    expect(Object.values(errs)).toMatchObject([{data: {what: 'test1'}}])
    // check maxTaskConcurrency limit
    expect(pendingCountsBefore).toEqual([0, 0, 0])
    // expect(pendingCountsAfter).toEqual([7, 6, 5, 4, 3, 2, 1, 0, 0, 0])
  })

  it('should respect isReadyFn to control task execution', async () => {
    let ready = false;
    let called = 0;
    let readyFnThis;
    const isReadyFn = async function(this: any) {
      readyFnThis = this;
      called++;
      let maxCount = 100;
      while (!ready && maxCount--) {
        await sleep(5)
      }
      return true;
    }

    // 创建一个带有自定义 isReadyFn 的测试类
    class TestIsReadyFunc extends ToolFunc {
      func(params: any) {
        return this.runAsyncCancelableTask(params, async (params: any) => {
          await sleep(10);
          return params;
        });
      }
    }
    const testInstance = new TestIsReadyFunc('testIsReady');
    makeToolFuncCancelable(TestIsReadyFunc, {
      asyncFeatures: AsyncFeatures.MultiTask,
      maxTaskConcurrency: 1,
      isReadyFn,
    });
    expect(TestIsReadyFunc.prototype._isReadyFn).toBe(isReadyFn)

    const taskPromise = testInstance.run('first');
    const semaphore = testInstance.semaphore!;
    expect(called).toBe(1);
    expect(readyFnThis).toBe(testInstance);
    // expect(semaphore).toBeDefined();
    // 确保任务未完成且 pendingCount 正确
    // await wait(15); // 等待超过任务执行时间

    expect((taskPromise as any).task!.signal.aborted).toBeFalsy();

    // 修改条件为 true 后任务应继续执行
    ready = true;
    await sleep(15);
    const result = await taskPromise;
    expect(result).toBe('first');
    expect(semaphore.pendingCount).toBe(0);

    // 第二次任务应立即执行
    const secondPromise = testInstance.run('second');
    await sleep(15);
    expect(semaphore.pendingCount).toBe(0);
    expect(await secondPromise).toBe('second');
  });

  it('should support multiple external signals for cancellation', async () => {
    // Case 1: One of the signals is aborted during execution
    const extAborter1 = new AbortController();
    const extAborter2 = new AbortController();
    let taskPromise = testSingleTask.run({
      waitTime: 50,
      content: 'test1',
      signals: [extAborter1.signal, extAborter2.signal],
    }) as TaskPromise<string>;

    await sleep(5); // wait a bit
    extAborter1.abort('external abort 1');
    await expect(taskPromise).rejects.toThrow(AbortError);
    await expect(taskPromise).rejects.toHaveProperty('message',  expect.stringMatching(/external abort 1/));

    // Case 2: A signal is already aborted before starting
    const extAborter3 = new AbortController();
    extAborter3.abort('already aborted');
    taskPromise = testSingleTask.run({
      waitTime: 50,
      content: 'test2',
      signals: [extAborter2.signal, extAborter3.signal],
    }) as TaskPromise<string>;

    await expect(taskPromise).rejects.toThrow(AbortError);
    await expect(taskPromise).rejects.toHaveProperty('message', expect.stringMatching(/already aborted/));

    // Case 3: Using singular `signal` property
    const extAborter4 = new AbortController();
    taskPromise = testSingleTask.run({
      waitTime: 50,
      content: 'test3',
      signal: extAborter4.signal,
    }) as TaskPromise<string>;

    await sleep(5);
    extAborter4.abort('external abort 2');
    await expect(taskPromise).rejects.toThrow(AbortError);
    await expect(taskPromise).rejects.toHaveProperty('message', expect.stringMatching(/external abort 2/));

    // Case 4: Mix of `signal` and `signals`
    const extAborter5 = new AbortController();
    const extAborter6 = new AbortController();
    taskPromise = testSingleTask.run({
      waitTime: 50,
      content: 'test4',
      signal: extAborter5.signal,
      signals: [extAborter6.signal],
    }) as TaskPromise<string>;

    await sleep(5);
    extAborter6.abort('external abort 3');
    await expect(taskPromise).rejects.toThrow(AbortError);
    await expect(taskPromise).rejects.toHaveProperty('message', expect.stringMatching(/external abort 3/));
  });

  it('should perform lazy cleanup in getRunningTaskCount and getRunningTask', async () => {
    const p1 = testMultiTask.run({ waitTime: 100 }) as TaskPromise
    const taskId = p1.task!.id!
    const host = (testMultiTask as any)._origin || testMultiTask
    const aborters = host.__task_aborter as any

    expect(aborters[taskId]).toBeDefined()

    // 手动中止任务，但不清理 Map
    p1.task!.abort('test-cleanup')

    // getRunningTask 应该返回 undefined 并触发清理 Map
    expect(testMultiTask.getRunningTask(taskId)).toBeUndefined()
    expect(aborters[taskId]).toBeUndefined()

    // getRunningTaskCount 也应触发清理
    const p2 = testMultiTask.run({ waitTime: 100 }) as TaskPromise
    const id2 = p2.task!.id!
    p2.task!.abort('test-cleanup-2')

    expect(testMultiTask.getRunningTaskCount()).toBe(0)
    expect(aborters[id2]).toBeUndefined()

    await expect(p1).rejects.toThrow()
    await expect(p2).rejects.toThrow()
  })

  it('should abort specific task via instance method and throw on missing taskId', async () => {
    const p1 = testMultiTask.run({ waitTime: 100 }) as TaskPromise
    const id1 = p1.task!.id

    // 测试精准中止
    testMultiTask.abort('targeted', { taskId: id1 })
    await expect(p1).rejects.toThrow(/targeted/)

    // 多任务模式下缺失 taskId 应抛错
    expect(() => testMultiTask.abort('no-id')).toThrow('Missing data.taskId')

    // isAborted 缺失 taskId 应抛错
    expect(() => testMultiTask.isAborted()).toThrow('Missing taskId')
  })

  it('should handle alreadyRejected flag in throwIfAborted', () => {
    const aborter = new TaskAbortController(testSingleTask as any)
    aborter.abort('initial')

    // 标准抛出
    expect(() => aborter.throwIfAborted()).toThrow('initial')

    // 当 signal 标记为 alreadyRejected 时，不抛出异常而是返回 true
    const signal = aborter.signal as any
    signal.alreadyRejected = true
    expect(aborter.throwIfAborted()).toBe(true)
    expect(() => aborter.throwIfAborted()).not.toThrow()

    // 显式传参测试
    signal.alreadyRejected = false
    expect(aborter.throwIfAborted(true)).toBe(true)
  })

  it('should handle errors in isReadyFn and release semaphore', async () => {
    const isReadyFn = async () => {
      throw new Error('ready-fail')
    }

    class TestFailReadyFunc extends ToolFunc {
      func(params: any) {
        return this.runAsyncCancelableTask(params, async () => 'ok', { isReadyFn })
      }
    }
    makeToolFuncCancelable(TestFailReadyFunc, { maxTaskConcurrency: 1 })
    const tool = new TestFailReadyFunc('testFailReady')

    await expect(tool.run({})).rejects.toThrow('ready-fail')

    // 即使 isReadyFn 失败，信号量也应被正确释放（通过 finally 机制）
    expect(tool.semaphore!.activeCount).toBe(0)
  })

  it('should clean up external signal listeners when task finishes', async () => {
    const extAborter = new AbortController()
    const removeSpy = jest.spyOn(extAborter.signal, 'removeEventListener')

    await testSingleTask.run({ signal: extAborter.signal, waitTime: 10 })

    // 任务结束后应移除对外部信号的监听，防止内存泄漏
    expect(removeSpy).toHaveBeenCalled()
    })

    it('should find the next free numeric taskId', () => {
    const aborters: any = { 0: {}, 1: {}, 2: {} }
    const id = (testMultiTask as any)._generateAsyncTaskId(null, aborters)
    expect(id).toBe(3)
    })

    it('should not leak listeners when multiple links occur (context + params)', async () => {
    const extSignal = new AbortController().signal
    const addSpy = jest.spyOn(extSignal, 'addEventListener')
    const removeSpy = jest.spyOn(extSignal, 'removeEventListener')

    // 同时在 context 和 params 中传入同一个 signal，触发双重链接
    // Note: tool.run(params, ctx) will call _prepareContext then createAborter
    await testSingleTask.run({ signal: extSignal }, { signal: extSignal })

    // 验证 add 和 remove 的调用次数是否相等（确保清理无死角）
    expect(addSpy).toHaveBeenCalled()
    expect(removeSpy).toHaveBeenCalledTimes(addSpy.mock.calls.length)
    })

    it('should delete key for string taskId in _cleanMultiTaskAborter', () => {
    const aborters: any = { 'id-1': {} }
    ;(testMultiTask as any)._cleanMultiTaskAborter('id-1', aborters)
    expect(aborters).not.toHaveProperty('id-1')
    expect(Object.keys(aborters)).toHaveLength(0)
    })

    it('should throw AbortError with custom reason string in throwIfAborted', () => {
    const aborter = new TaskAbortController(testSingleTask as any)
    // 模拟非 Error 对象的 abort
    aborter.abort('just a string')
    try {
      aborter.throwIfAborted()
    } catch (e: any) {
      expect(e).toBeInstanceOf(AbortError)
      expect(e.message).toContain('just a string')
    }
    })

    it('should limit real concurrent execution to maxTaskConcurrency (P0 regression)', async () => {
    let running = 0
    let maxSeen = 0
    class ConcLimitTool extends ToolFunc {
      func(params: any) {
        return this.runAsyncCancelableTask(params, async (params: any) => {
          running++
          maxSeen = Math.max(maxSeen, running)
          await sleep(30)
          running--
          return params
        })
      }
    }
    makeToolFuncCancelable(ConcLimitTool, {asyncFeatures: AsyncFeatures.MultiTask, maxTaskConcurrency: 2})
    const tool = new ConcLimitTool('concLimit')

    await Promise.all(Array.from({length: 6}, (_, i) => tool.run('t' + i)))

    // 信号量必须先于任务执行被获取：maxTaskConcurrency=2 时最多同时执行 2 个任务
    expect(maxSeen).toBe(2)
    })

    it('should pass the aborters map into a custom generateAsyncTaskId (P1 regression)', async () => {
    const seenAborters: any[] = []
    interface TestAbortersArgTool extends CancelableAbility {}
    class TestAbortersArgTool extends ToolFunc {
      generateAsyncTaskId(taskId?: AsyncTaskId, aborters?: TaskAbortControllers) {
        seenAborters.push(aborters)
        return this._generateAsyncTaskId(taskId, aborters)
      }
      func(params: any) {
        return this.runAsyncCancelableTask(params, async (params: any) => {
          await sleep(5)
          return params
        })
      }
    }
    makeToolFuncCancelable(TestAbortersArgTool, {asyncFeatures: AsyncFeatures.MultiTask})
    const tool = new TestAbortersArgTool('abortersArgTest')

    const taskInfo = tool.run('x') as TaskPromise
    // 自定义 generateAsyncTaskId 必须能收到 aborters 映射表
    expect(seenAborters).toHaveLength(1)
    expect(seenAborters[0]).toBeDefined()
    expect(typeof (taskInfo.task as any).id).toBe('number')
    await taskInfo
    })

    it('should keep per-task id and timeout isolated when sharing an external AbortController (P2 regression)', async () => {
    interface TestWaitMultiTool extends CancelableAbility {}
    class TestWaitMultiTool extends ToolFunc {
      func(params: any) {
        return this.runAsyncCancelableTask(params, async (params: any, aborter: TaskAbortController) => {
          const end = Date.now() + (params?.waitTime ?? 100)
          while (Date.now() < end) {
            aborter.throwIfAborted()
            await sleep(1)
          }
          return params
        })
      }
    }
    makeToolFuncCancelable(TestWaitMultiTool, {asyncFeatures: AsyncFeatures.MultiTask})
    const tool = new TestWaitMultiTool('sharedAborterTest')

    const shared = new AbortController()
    const p1 = tool.run({waitTime: 500, aborter: shared}) as TaskPromise
    const p2 = tool.run({waitTime: 500, aborter: shared}) as TaskPromise
    const a1 = p1.task!
    const a2 = p2.task!

    // 每个任务拿到独立的包装 aborter，id 互不覆盖，外部 controller 原型不被篡改
    expect(a1).toBeInstanceOf(TaskAbortController)
    expect(a1).not.toBe(shared)
    expect(a2).not.toBe(shared)
    expect(a1).not.toBe(a2)
    expect(a1.id).not.toBe(a2.id)
    expect(shared.signal.aborted).toBeFalsy()

    // 中止共享的外部 controller → 两个任务都被联动中止
    shared.abort('shared cancel')
    await expect(p1).rejects.toThrow(/shared cancel/)
    await expect(p2).rejects.toThrow(/shared cancel/)
    })

    it('should isolate timeout per task when sharing an external AbortController (P2 regression)', async () => {
    interface TestWaitMultiTool2 extends CancelableAbility {}
    class TestWaitMultiTool2 extends ToolFunc {
      func(params: any) {
        return this.runAsyncCancelableTask(params, async (params: any, aborter: TaskAbortController) => {
          const end = Date.now() + (params?.waitTime ?? 100)
          while (Date.now() < end) {
            aborter.throwIfAborted()
            await sleep(1)
          }
          return params
        })
      }
    }
    makeToolFuncCancelable(TestWaitMultiTool2, {asyncFeatures: AsyncFeatures.MultiTask})
    const tool = new TestWaitMultiTool2('sharedTimeoutTest')

    const shared = new AbortController()
    const p1 = tool.run({waitTime: 500, timeout: 40, aborter: shared}) as TaskPromise
    await sleep(10)
    const p2 = tool.run({waitTime: 500, aborter: shared}) as TaskPromise

    // 只有 p1 超时中止，p2 不受影响
    await expect(p1).rejects.toThrow(/timeout/)
    expect(p2.task!.signal.aborted).toBeFalsy()

    shared.abort('cleanup')
    await expect(p2).rejects.toThrow(/cleanup/)
    })

    it('should clean the task aborter when the stream reader cancels the stream (P2 regression)', async () => {
    const host = (testStreamTask as any)._origin || testStreamTask
    const taskInfo = testStreamTask.run() as TaskPromise<ReadableStream>
    const aborter = taskInfo.task!
    const id = aborter.id!

    const stream = await taskInfo
    const reader = stream.getReader()
    await reader.read()
    await reader.cancel('client disconnected')
    await sleep(10)

    // 消费者取消流后，任务应从任务池注销
    expect((host.__task_aborter as any)[id]).toBeUndefined()
    expect(aborter.signal.aborted).toBeFalsy()
    })

    it('should not leave ghost pool entries when concurrent tasks share one ctx aborter (方案2 regression)', async () => {
    class GhostTool extends ToolFunc {
      func(params: any) {
        return this.runAsyncCancelableTask(params, async (params: any) => {
          await sleep(20)
          return params
        })
      }
    }
    makeToolFuncCancelable(GhostTool, {asyncFeatures: AsyncFeatures.MultiTask})
    const tool = new GhostTool('ghostTool')
    const host = (tool as any)._origin || tool
    const runner = tool.with({})

    const p1 = runner.run('a') as TaskPromise
    const p2 = runner.run('b') as TaskPromise
    // 共享灯语义保留：并发任务仍然共享同一个 ctx.aborter（方案2 不做派生）
    expect(p1.task).toBe(p2.task)

    await Promise.allSettled([p1, p2])
    await sleep(10)

    // 修复前：aborter.id 被覆盖 → 先完成的任务清错槽位 → 残留 1 个幽灵条目
    expect((tool as any).getRunningTaskCount()).toBe(0)
    expect(Object.keys(host.__task_aborter).filter(k => host.__task_aborter[k])).toHaveLength(0)
    })

    it('should not leave ghost pool entries when sharing an internal TaskAbortController across concurrent tasks (方案2 regression)', async () => {
    class GhostParamTool extends ToolFunc {
      func(params: any) {
        return this.runAsyncCancelableTask(params, async (params: any) => {
          await sleep(20)
          return params
        })
      }
    }
    makeToolFuncCancelable(GhostParamTool, {asyncFeatures: AsyncFeatures.MultiTask})
    const tool = new GhostParamTool('ghostParam')
    const host = (tool as any)._origin || tool
    const shared = new TaskAbortController(tool as any)

    const p1 = tool.run({aborter: shared}) as TaskPromise
    const p2 = tool.run({aborter: shared}) as TaskPromise
    await Promise.allSettled([p1, p2])
    await sleep(10)

    expect((tool as any).getRunningTaskCount()).toBe(0)
    expect(Object.keys(host.__task_aborter).filter(k => host.__task_aborter[k])).toHaveLength(0)
    })

    it('should error all streams when concurrent stream tasks share one aborter (方案2 regression)', async () => {
    class StreamShareTool extends ToolFunc {
      func(params: any) {
        return this.runAsyncCancelableTask(params, async (params: any) => {
          return getStream()
        })
      }
    }
    makeToolFuncCancelable(StreamShareTool, {asyncFeatures: AsyncFeatures.MultiTask})
    const tool = new StreamShareTool('streamShare')
    const runner = tool.with({})

    const p1 = runner.run() as TaskPromise<ReadableStream>
    const p2 = runner.run() as TaskPromise<ReadableStream>
    const s1 = await p1
    const s2 = await p2
    const r1 = s1.getReader()
    const r2 = s2.getReader()

    // 先各读一个 chunk：证明两个 transform 的 onStart 都已注册 controller（消除时序抖动）
    expect((await r1.read()).value).toHaveProperty('content', 'a')
    expect((await r2.read()).value).toHaveProperty('content', 'a')

    // 修复前：streamController 单值被后注册者覆盖 → 只有一个流被 error
    runner.ctx!.aborter!.abort('shared stream abort')

    await expect(r1.read()).rejects.toThrow(/shared stream abort/)
    await expect(r2.read()).rejects.toThrow(/shared stream abort/)
    })

    it('should target the right pool slot when a shared aborter group times out (方案2 regression)', async () => {
    class TimeoutShareTool extends ToolFunc {
      func(params: any) {
        return this.runAsyncCancelableTask(params, async (params: any, aborter: TaskAbortController) => {
          const end = Date.now() + (params?.waitTime ?? 100)
          while (Date.now() < end) {
            aborter.throwIfAborted()
            await sleep(1)
          }
          return params
        })
      }
    }
    makeToolFuncCancelable(TimeoutShareTool, {asyncFeatures: AsyncFeatures.MultiTask})
    const tool = new TimeoutShareTool('timeoutShare')
    const host = (tool as any)._origin || tool
    const runner = tool.with({})

    const p1 = runner.run({waitTime: 500, timeout: 40}) as TaskPromise
    const p2 = runner.run({waitTime: 500}) as TaskPromise

    // 组级 deadline + 共享 signal：T1 超时 → 整组中止
    await expect(p1).rejects.toThrow(/timeout/)
    await expect(p2).rejects.toThrow(/timeout/)
    await sleep(10)

    // 超时回调必须用闭包捕获的 taskId 清对槽位（修复前读被覆盖的 aborter.id → 残留幽灵条目）
    expect((tool as any).getRunningTaskCount()).toBe(0)
    expect(Object.keys(host.__task_aborter).filter(k => host.__task_aborter[k])).toHaveLength(0)
    })

    it('should clear the group timeout when the last started task ends, leaving queued siblings unprotected (refcount boundary)', async () => {
    class QueueDeadlineTool extends ToolFunc {
      func(params: any) {
        return this.runAsyncCancelableTask(params, async (params: any, aborter: TaskAbortController) => {
          const end = Date.now() + (params?.waitTime ?? 100)
          while (Date.now() < end) {
            aborter.throwIfAborted()
            await sleep(1)
          }
          return params
        })
      }
    }
    makeToolFuncCancelable(QueueDeadlineTool, {asyncFeatures: AsyncFeatures.MultiTask, maxTaskConcurrency: 1})
    const tool = new QueueDeadlineTool('queueDeadline')
    const host = (tool as any)._origin || tool
    const runner = tool.with({})

    // 场景：共享 runner ctx 的 aborter + 信号量容量 1。
    // p1 先启动（无 timeout）；p2 排队中，其 createAborter 在提交时刻（t≈0）设置组定时器
    // （timeout=200，set-once）。提交时刻引用计数只有 1（p1 已启动），p2 尚未运行不计入。
    const p1 = runner.run({waitTime: 50}) as TaskPromise
    const p2 = runner.run({waitTime: 400, timeout: 200}) as TaskPromise

    await expect(p1).resolves.toMatchObject({waitTime: 50})

    // 边界：最后一个“已启动”的任务（p1）结束时引用计数归零 → 组定时器被清理。
    // 若计数改为“含排队任务”，此处 timeoutId 应仍存在（回归信号）。
    expect((runner as any).ctx.aborter.timeoutId).toBeUndefined()

    // p2 随后启动（≈t=50ms），不再受组 deadline 约束：即便运行超过提交时刻+200ms
    // 也不会被超时中止（修复前定时器若未被清理，p2 会在 t=200 被 /timeout/ 中止）。
    await expect(p2).resolves.toMatchObject({waitTime: 400})
    expect(p2.task!.signal.aborted).toBeFalsy()

    // 池与信号量均干净
    expect((tool as any).getRunningTaskCount()).toBe(0)
    expect(Object.keys(host.__task_aborter).filter(k => host.__task_aborter[k])).toHaveLength(0)
    })
    });
