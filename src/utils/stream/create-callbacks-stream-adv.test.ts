import { describe, expect, it, vi as jest } from 'vitest'
import { createCallbacksTransformer, StreamCallbacksAndOptions } from './create-callbacks-stream'

describe('createCallbacksTransformer - Advanced Async & Error Isolation', () => {
  // 9. 验证数据转换功能
  it('should transform chunks when onTransform returns a value', async () => {
    const transformer = createCallbacksTransformer({
      onTransform: (chunk) => `prefix_${chunk}`
    })

    const rs = new ReadableStream({
      start(controller) {
        controller.enqueue('item')
        controller.close()
      }
    })

    const reader = rs.pipeThrough(transformer).getReader()
    const { value } = await reader.read()
    expect(value).toBe('prefix_item')
  })

  // 10. 验证 onStart 的异步阻塞机制
  it('should wait for onStart to complete before starting transforms', async () => {
    let startFinished = false
    const transformer = createCallbacksTransformer({
      onStart: async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        startFinished = true
      },
      onTransform: (chunk) => {
        if (!startFinished) throw new Error('Transform started before onStart finished')
        return chunk
      }
    })

    const rs = new ReadableStream({
      start(controller) {
        controller.enqueue('data')
        controller.close()
      }
    })

    const reader = rs.pipeThrough(transformer).getReader()
    const { value } = await reader.read()
    expect(value).toBe('data')
    expect(startFinished).toBe(true)
  })

  // 11. 验证 onFinal 的异步阻塞机制
  it('should wait for onFinal to complete before calling onClose', async () => {
    let finalFinished = false
    const order: string[] = []
    
    const transformer = createCallbacksTransformer({
      onFinal: async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        finalFinished = true
        order.push('final')
      },
      onClose: () => {
        order.push('close')
      }
    })

    const rs = new ReadableStream({
      start(controller) {
        controller.enqueue('data')
        controller.close()
      }
    })

    const reader = rs.pipeThrough(transformer).getReader()
    await reader.read()
    await reader.read() // 等待流结束

    expect(finalFinished).toBe(true)
    expect(order).toEqual(['final', 'close'])
  })

  // 12. 验证 onClose 的错误隔离（不影响外部）
  it('should catch and log errors in onClose without crashing the stream', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const transformer = createCallbacksTransformer({
      onClose: () => { throw new Error('cleanup-fail') }
    })

    const rs = new ReadableStream({
      start(controller) {
        controller.enqueue('test')
        controller.close()
      }
    })

    const reader = rs.pipeThrough(transformer).getReader()
    const { value } = await reader.read()
    expect(value).toBe('test')
    
    // 等待异步 onClose 执行完毕
    await new Promise(resolve => setTimeout(resolve, 10))
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error in onClose callback'),
      expect.any(Error)
    )
    consoleSpy.mockRestore()
  })

  // 13. 验证对不同返回值的处理（undefined vs 其他虚值）
  it('should passthrough chunk only on undefined, but allow other falsy values', async () => {
    const results: any[] = []
    const transformer = createCallbacksTransformer({
      onTransform: (chunk) => {
        if (chunk === 'yield-null') return null
        if (chunk === 'yield-false') return false
        if (chunk === 'yield-zero') return 0
        if (chunk === 'yield-empty') return ''
        if (chunk === 'yield-undefined') return undefined
        return `transformed_${chunk}`
      }
    })

    const rs = new ReadableStream({
      start(controller) {
        ['yield-null', 'yield-false', 'yield-zero', 'yield-empty', 'yield-undefined', 'normal'].forEach(c => controller.enqueue(c))
        controller.close()
      }
    })

    const reader = rs.pipeThrough(transformer).getReader()
    let chunk = await reader.read()
    while (!chunk.done) {
      results.push(chunk.value)
      chunk = await reader.read()
    }

    expect(results).toEqual([
      null,
      false,
      0,
      '',
      'yield-undefined', // 因为返回 undefined，所以透传了原始 chunk
      'transformed_normal'
    ])
  })

  // 14. 验证大量异步数据块的顺序一致性
  it('should preserve order for multiple chunks with varying async delays', async () => {
    const results: number[] = []
    const transformer = createCallbacksTransformer({
      onTransform: async (chunk: number) => {
        // 赋予不同的延迟，越大的数字延迟越短，模拟乱序到达但应有序输出
        const delay = (10 - chunk) * 10
        await new Promise(resolve => setTimeout(resolve, Math.max(0, delay)))
        return chunk * 2
      }
    })

    const rs = new ReadableStream({
      start(controller) {
        [1, 2, 3, 4, 5].forEach(i => controller.enqueue(i))
        controller.close()
      }
    })

    const reader = rs.pipeThrough(transformer).getReader()
    let chunk = await reader.read()
    while (!chunk.done) {
      results.push(chunk.value)
      chunk = await reader.read()
    }

    expect(results).toEqual([2, 4, 6, 8, 10])
  })

  // 15. 验证通过 controller.error() 手动触发错误
  it('should trigger onClose("error") when controller.error() is called manually', async () => {
    const onClose = jest.fn()
    const manualError = new Error('manual-stop')
    
    const transformer = createCallbacksTransformer({
      onTransform: (chunk, controller) => {
        controller.error(manualError)
      },
      onClose
    })

    const rs = new ReadableStream({
      start(controller) {
        controller.enqueue('trigger')
      }
    })

    const reader = rs.pipeThrough(transformer).getReader()
    await expect(reader.read()).rejects.toThrow('manual-stop')
    
    expect(onClose).toHaveBeenCalledWith('error', manualError)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // 16. 验证 onCancel 抛出错误时，onClose 依然被执行
  it('should trigger onClose even if onCancel hook throws', async () => {
    const onClose = jest.fn()
    const transformer = createCallbacksTransformer({
      onCancel: () => { throw new Error('cancel-hook-error') },
      onClose
    })

    const rs = new ReadableStream({ start(c) { c.enqueue('a') } })
    const reader = rs.pipeThrough(transformer).getReader()
    await reader.read()
    
    // cancel() 返回的 promise 会因为 onCancel 报错而 reject
    await expect(reader.cancel('reason')).rejects.toThrow('cancel-hook-error')
    
    expect(onClose).toHaveBeenCalledWith('cancel', 'reason')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // 17. 验证空流的生命周期
  it('should trigger complete lifecycle for empty streams', async () => {
    const onStart = jest.fn()
    const onFinal = jest.fn()
    const onClose = jest.fn()
    const onTransform = jest.fn()

    const transformer = createCallbacksTransformer({ onStart, onFinal, onClose, onTransform })

    const rs = new ReadableStream({
      start(controller) {
        controller.close()
      }
    })

    const reader = rs.pipeThrough(transformer).getReader()
    const { done } = await reader.read()
    
    expect(done).toBe(true)
    expect(onStart).toHaveBeenCalled()
    expect(onFinal).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledWith('final', undefined)
    expect(onTransform).not.toHaveBeenCalled()
  })

  // 18. 验证在 transform 中调用 controller.terminate()
  it('should trigger onClose("final") when controller.terminate() is called', async () => {
    const onClose = jest.fn()
    const transformer = createCallbacksTransformer({
      onTransform: (chunk, controller) => {
        controller.terminate()
      },
      onClose
    })

    const rs = new ReadableStream({
      start(controller) {
        controller.enqueue('kill-me')
        controller.enqueue('after-kill')
      }
    })

    const reader = rs.pipeThrough(transformer).getReader()
    const { done } = await reader.read()
    expect(done).toBe(true)
    
    // terminate 会导致流以 'final' 状态关闭
    expect(onClose).toHaveBeenCalledWith('final', undefined)
  })

  // 19. 嵌套错误隔离：onTransform 报错且 onError 也报错
  it('should handle nested errors in onError without skipping onClose', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const onClose = jest.fn()
    const transformer = createCallbacksTransformer({
      onTransform: () => { throw new Error('primary-error') },
      onError: () => { throw new Error('secondary-error') },
      onClose
    })

    const rs = new ReadableStream({ start(c) { c.enqueue('trigger') } })
    const reader = rs.pipeThrough(transformer).getReader()

    await expect(reader.read()).rejects.toThrow('primary-error')
    
    expect(onClose).toHaveBeenCalledWith('error', expect.objectContaining({ message: 'primary-error' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    consoleSpy.mockRestore()
  })

  // 20. 验证在 onStart 中预注入数据
  it('should allow injecting data in onStart', async () => {
    const transformer = createCallbacksTransformer({
      onStart: (controller) => {
        controller.enqueue('header')
      }
    })

    const rs = new ReadableStream({
      start(controller) {
        controller.enqueue('body')
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

    expect(result).toEqual(['header', 'body'])
  })

  // 21. 验证在 onFinal 中追加数据
  it('should allow injecting data in onFinal', async () => {
    const transformer = createCallbacksTransformer({
      onFinal: (controller) => {
        controller.enqueue('footer')
      }
    })

    const rs = new ReadableStream({
      start(controller) {
        controller.enqueue('body')
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

    expect(result).toEqual(['body', 'footer'])
  })

  // 22. 验证 onFinal 报错时，onClose 状态应为 'error'
  it('should trigger onClose("error") if onFinal fails', async () => {
    const finalError = new Error('final-failed')
    const onClose = jest.fn()
    const transformer = createCallbacksTransformer({
      onFinal: () => { throw finalError },
      onClose
    })

    const rs = new ReadableStream({
      start(controller) {
        controller.enqueue('data')
        controller.close()
      }
    })

    const reader = rs.pipeThrough(transformer).getReader()
    await reader.read()
    await expect(reader.read()).rejects.toThrow('final-failed')
    
    expect(onClose).toHaveBeenCalledWith('error', finalError)
    expect(onClose).not.toHaveBeenCalledWith('final', undefined)
  })

  // 23. 验证多次触发 error 时 onClose 的幂等性
  it('should only trigger onClose once even if controller.error is called multiple times', async () => {
    const onClose = jest.fn()
    const firstError = new Error('first')
    const secondError = new Error('second')
    
    const transformer = createCallbacksTransformer({
      onTransform: (chunk, controller) => {
        controller.error(firstError)
        controller.error(secondError)
      },
      onClose
    })

    const rs = new ReadableStream({
      start(controller) {
        controller.enqueue('trigger')
      }
    })

    const reader = rs.pipeThrough(transformer).getReader()
    try { await reader.read() } catch (e) {}
    
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledWith('error', firstError)
  })

  // 24. 验证 onStart 中先 enqueue 成功后又报错
  it('should handle data injected in onStart even if it subsequently throws', async () => {
    const startError = new Error('error-after-enqueue')
    const onClose = jest.fn()
    const transformer = createCallbacksTransformer({
      onStart: (controller) => {
        controller.enqueue('early-data')
        throw startError
      },
      onClose
    })

    const rs = new ReadableStream({ start(c) { c.enqueue('normal-data') } })
    const reader = rs.pipeThrough(transformer).getReader()

    // 在 Web Streams 中，如果 start 失败，流会立刻进入 errored 状态。
    // 即便之前 enqueue 了数据，第一次读取也可能直接抛错。
    await expect(reader.read()).rejects.toThrow('error-after-enqueue')
    
    expect(onClose).toHaveBeenCalledWith('error', startError)
  })

  // 25. 验证 onStart 中直接调用 terminate
  it('should handle controller.terminate() called within onStart', async () => {
    const onClose = jest.fn()
    const onTransform = jest.fn()
    const transformer = createCallbacksTransformer({
      onStart: (controller) => {
        controller.terminate()
      },
      onTransform,
      onClose
    })

    const rs = new ReadableStream({ start(c) { c.enqueue('never-reaches') } })
    const reader = rs.pipeThrough(transformer).getReader()

    const { done } = await reader.read()
    expect(done).toBe(true)
    expect(onTransform).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledWith('final', undefined)
  })

  // 26. 验证 onTransform 内部多次手动调用 enqueue
  it('should support manual multiple enqueues in onTransform plus auto-return', async () => {
    const transformer = createCallbacksTransformer({
      onTransform: (chunk, controller) => {
        controller.enqueue(`${chunk}_1`)
        controller.enqueue(`${chunk}_2`)
        return `${chunk}_3`
      }
    })

    const rs = new ReadableStream({
      start(controller) {
        controller.enqueue('a')
        controller.close()
      }
    })

    const reader = rs.pipeThrough(transformer).getReader()
    const results: string[] = []
    let chunk = await reader.read()
    while (!chunk.done) {
      results.push(chunk.value)
      chunk = await reader.read()
    }

    expect(results).toEqual(['a_1', 'a_2', 'a_3'])
  })

  // 27. 高频压力测试：1000 个数据块的异步转换
  it('should handle high volume of chunks without issues', async () => {
    const count = 1000
    const onClose = jest.fn()
    const transformer = createCallbacksTransformer({
      onTransform: async (chunk) => {
        // 模拟微小的异步延迟
        await new Promise(resolve => process.nextTick(resolve))
        return chunk * 2
      },
      onClose
    })

    const rs = new ReadableStream({
      start(controller) {
        for (let i = 0; i < count; i++) {
          controller.enqueue(i)
        }
        controller.close()
      }
    })

    const reader = rs.pipeThrough(transformer).getReader()
    let sum = 0
    let receivedCount = 0
    
    let chunk = await reader.read()
    while (!chunk.done) {
      sum += chunk.value
      receivedCount++
      chunk = await reader.read()
    }

    expect(receivedCount).toBe(count)
    expect(sum).toBe((count * (count - 1))) // 等差数列求和 * 2
    expect(onClose).toHaveBeenCalledWith('final', undefined)
  })

  // 28. 验证背压 (Backpressure) 对 onTransform 的影响
  it('should respect backpressure during onTransform', async () => {
    let transformCallCount = 0
    const transformer = createCallbacksTransformer({
      onTransform: () => {
        transformCallCount++
      }
    })

    // 创建一个没有任何策略的流，默认高水位通常为 1
    const rs = new ReadableStream({
      start(controller) {
        controller.enqueue('a')
        controller.enqueue('b')
        controller.enqueue('c')
        controller.close()
      }
    })

    const reader = rs.pipeThrough(transformer).getReader()
    
    // 只读一个，看 transformCallCount
    // 注意：Web Streams 的实现可能会预读一块数据
    await reader.read()
    
    // transformCallCount 不应立刻冲到 3 (除非下游持续读取)
    expect(transformCallCount).toBeLessThanOrEqual(2)
  })

  // 29. 验证多层管道串联
  it('should trigger onClose correctly in a chained pipeline', async () => {
    const log: string[] = []
    const t1 = createCallbacksTransformer({ onClose: (s) => { log.push(`t1_${s}`) } })
    const t2 = createCallbacksTransformer({ onClose: (s) => { log.push(`t2_${s}`) } })

    const rs = new ReadableStream({
      start(controller) {
        controller.enqueue('ping')
        controller.close()
      }
    })

    const reader = rs.pipeThrough(t1).pipeThrough(t2).getReader()
    while (!(await reader.read()).done);

    // 等待异步 onClose 
    await new Promise(resolve => setTimeout(resolve, 10))
    
    expect(log).toContain('t1_final')
    expect(log).toContain('t2_final')
  })

  // 30. 验证在 onStart 中注入大量数据块 (HWM 压力)
  it('should handle large volume injection in onStart', async () => {
    const count = 500 // 模拟大量小块数据
    const transformer = createCallbacksTransformer({
      onStart: (controller) => {
        for (let i = 0; i < count; i++) {
          controller.enqueue(i)
        }
      }
    })

    const rs = new ReadableStream({ start(c) { c.close() } })
    const reader = rs.pipeThrough(transformer).getReader()
    
    let received = 0
    let chunk = await reader.read()
    while (!chunk.done) {
      received++
      chunk = await reader.read()
    }
    expect(received).toBe(count)
  })
})
