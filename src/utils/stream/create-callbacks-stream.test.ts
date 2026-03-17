import { vi as jest } from 'vitest'
import { createCallbacksTransformer, StreamCallbacksAndOptions } from './create-callbacks-stream'

describe('createCallbacksTransformer', () => {
  // 1. 基础生命周期测试 (Start, Transform, Final, Close)
  it('should trigger basic lifecycle callbacks (onStart, onTransform, onFinal, onClose)', async () => {
    const onStart = jest.fn()
    const onTransform = jest.fn()
    const onFinal = jest.fn()
    const onClose = jest.fn()

    const transformer = createCallbacksTransformer({ onStart, onTransform, onFinal, onClose })

    const rs = new ReadableStream({
      start(controller) {
        controller.enqueue('a')
        controller.enqueue('b')
        controller.close()
      }
    })

    const reader = rs.pipeThrough(transformer).getReader()
    const result: string[] = []
    
    let chunk = await reader.read()
    while (!chunk.done) {
      result.push(chunk.value)
      chunk = await reader.read()
    }

    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onTransform).toHaveBeenCalledTimes(2)
    expect(onFinal).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledWith('final', undefined)
    expect(result.join('')).toBe('ab')
  })

  // 2. 取消流测试 (onCancel, onClose)
  it('should trigger onCancel and onClose when stream is cancelled', async () => {
    const onCancel = jest.fn()
    const onClose = jest.fn()
    const transformer = createCallbacksTransformer({ onCancel, onClose })
    
    const rs = new ReadableStream({
      start(controller) {
        controller.enqueue('a')
      }
    })

    const reader = rs.pipeThrough(transformer).getReader()
    await reader.read()
    await reader.cancel('user-abort')

    expect(onCancel).toHaveBeenCalledWith('user-abort')
    expect(onClose).toHaveBeenCalledWith('cancel', 'user-abort')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // 3. 异步竞态验证：Transform 过程中被取消
  it('should handle cancel during an ongoing async onTransform', async () => {
    const onClose = jest.fn()
    let transformStarted = false
    
    const transformer = createCallbacksTransformer({
      onTransform: async (chunk, controller) => {
        transformStarted = true
        // 模拟一个较长的异步操作
        await new Promise(resolve => setTimeout(resolve, 100))
        controller.enqueue(chunk)
      },
      onClose
    })

    const rs = new ReadableStream({
      start(controller) {
        controller.enqueue('slow-data')
      }
    })

    const reader = rs.pipeThrough(transformer).getReader()
    
    // 启动读取（会进入 onTransform 的 await 阶段）
    const readPromise = reader.read()
    
    // 稍等片刻确保 transform 已经开始，但未完成
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(transformStarted).toBe(true)

    // 在 transform 过程中取消流
    await reader.cancel('aborted-midway')

    // 验证 onClose 是否被调用
    expect(onClose).toHaveBeenCalledWith('cancel', 'aborted-midway')
    expect(onClose).toHaveBeenCalledTimes(1)

    try { await readPromise } catch (e) {}
  })

  // 4. 错误处理测试 (onError, onClose)
  it('should trigger onError and onClose when transform fails', async () => {
    const onError = jest.fn()
    const onClose = jest.fn()
    const error = new Error('transform-error')
    const transformer = createCallbacksTransformer({ 
      onTransform: () => { throw error },
      onError, 
      onClose 
    })

    const rs = new ReadableStream({
      start(controller) {
        controller.enqueue('data')
      }
    })

    const reader = rs.pipeThrough(transformer).getReader()
    await expect(reader.read()).rejects.toThrow('transform-error')

    expect(onError).toHaveBeenCalledWith(error)
    expect(onClose).toHaveBeenCalledWith('error', error)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // 5. onStart 失败测试
  it('should trigger onClose("error") if onStart fails', async () => {
    const startError = new Error('start-failed')
    const onClose = jest.fn()
    const transformer = createCallbacksTransformer({
      onStart: () => { throw startError },
      onClose
    })

    const rs = new ReadableStream({ start(c) { c.enqueue('x') } })
    const reader = rs.pipeThrough(transformer).getReader()

    await expect(reader.read()).rejects.toThrow('start-failed')
    expect(onClose).toHaveBeenCalledWith('error', startError)
  })

  // 6. 零拷贝 (Identity Transform) 路径行为验证
  it('should support identity transform when onTransform is missing', async () => {
    const transformer = createCallbacksTransformer({})
    const rs = new ReadableStream({
      start(controller) {
        controller.enqueue('hello')
        controller.close()
      }
    })

    const reader = rs.pipeThrough(transformer).getReader()
    const { value } = await reader.read()
    expect(value).toBe('hello')
  })

  // 7. 优化验证：确保在没有 onTransform 时，不向 TransformStream 传递 transform 钩子
  it('should optimize performance by not defining transform hook when onTransform is missing', () => {
    const originalTransformStream = global.TransformStream;
    const transformStreamSpy = jest.fn((transformer) => new originalTransformStream(transformer));
    
    // 使用 vitest 模拟全局构造函数
    vi.stubGlobal('TransformStream', transformStreamSpy);

    try {
      // 场景 A: 没有 onTransform 回调
      createCallbacksTransformer({});
      const callArgsA = transformStreamSpy.mock.calls[0][0];
      expect(callArgsA.transform).toBeUndefined();

      // 场景 B: 有 onTransform 回调
      createCallbacksTransformer({ onTransform: (c) => c });
      const callArgsB = transformStreamSpy.mock.calls[1][0];
      expect(callArgsB.transform).toBeDefined();
      expect(typeof callArgsB.transform).toBe('function');
    } finally {
      vi.unstubAllGlobals();
    }
  })

  // 8. 健壮性：onClose 唯一性
  it('should ensure onClose is called only once even if multiple closing events occur', async () => {
    const onClose = jest.fn()
    const transformer = createCallbacksTransformer({ 
      onTransform: (chunk, controller) => {
        controller.error(new Error('internal'))
      },
      onClose 
    })

    const rs = new ReadableStream({
      start(controller) {
        controller.enqueue('trigger')
        controller.close()
      }
    })

    const reader = rs.pipeThrough(transformer).getReader()
    try { await reader.read() } catch (e) {}

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
