/**
 * Status indicating how the stream was closed.
 * - 'final': Stream completed successfully (flush/close).
 * - 'error': Stream closed due to an internal or upstream error.
 * - 'cancel': Stream was explicitly aborted by the reader/consumer.
 */
export type StreamCloseStatus = 'final' | 'error' | 'cancel';

/**
 * Configuration options and helper callback methods for stream lifecycle events.
 * 
 * This interface provides hooks into every significant stage of a TransformStream's life,
 * designed for robust resource management and telemetry.
 * 
 * @interface
 * @template I The input chunk type.
 * @template O The output chunk type.
 */
export interface StreamCallbacksAndOptions<I = any, O = any> {
  /** 
   * `onStart`: Called once when the stream is initialized.
   * Useful for protocol handshakes, injecting headers, or setting up local state.
   */
  onStart?: (controller: TransformStreamDefaultController) => Promise<void> | void;

  /** 
   * `onTransform`: Called for each data chunk received from the upstream.
   * If this callback is NOT provided, the transformer acts as a high-performance 
   * "Identity Transform" (zero-copy bypass).
   * 
   * @param chunk - The input data chunk.
   * @param controller - The stream controller for manual enqueuing or error triggering.
   * @returns If returns a value (other than undefined), it will be enqueued as the output.
   *          If returns undefined, the original chunk is passed through.
   */
  onTransform?: (chunk: I, controller: TransformStreamDefaultController) => Promise<O|void> | O|void;

  /** 
   * `onFinal`: Called once when the stream is closed normally (upstream close).
   * Note: This is NOT called if the stream is cancelled or errors out.
   */
  onFinal?: (controller: TransformStreamDefaultController) => Promise<void> | void;

  /** 
   * `onCancel`: Called when the stream is cancelled by the reader side (e.g., client disconnect).
   * In RPC/Dispatcher scenarios, this is the primary hook for handling aborted requests.
   * @param reason - The cancellation reason provided by the reader.
   */
  onCancel?: (reason: any) => Promise<void> | void;

  /** 
   * `onError`: Called when an error occurs during stream processing or in other callbacks.
   * This provides a specific hook for error telemetry before the stream is closed.
   */
  onError?: (error: Error) => Promise<void> | void;

  /**
   * `onClose`: Unified cleanup hook called exactly once, regardless of how the stream ended.
   * This is the recommended place for resource deallocation (e.g., releasing handles, closing DB connections).
   * 
   * @param status - The termination state: 'final', 'error', or 'cancel'.
   * @param reason - The error object or cancel reason, if applicable.
   */
  onClose?: (status: StreamCloseStatus, reason?: any) => Promise<void> | void;
}

/**
 * Creates a transform stream that invokes optional callback functions during its lifecycle.
 * 
 * ### Key Features:
 * - **Unified Cleanup**: The `onClose` hook ensures resource recovery happens once and only once.
 * - **Zero-Copy Optimization**: If `onTransform` is omitted, it leverages the engine's internal 
 *   optimized identity path for maximum throughput.
 * - **Cancellation Support**: Explicitly handles the `cancel` hook, critical for Web/RPC scenarios.
 * - **Robustness**: Protects the stream lifecycle even if callbacks themselves throw errors.
 *
 * @param [cb] - An object containing optional lifecycle callbacks.
 * @return A TransformStream that allows the execution of custom logic through callbacks.
 *
 * @example
 * ```typescript
 * const transformer = createCallbacksTransformer({
 *   onStart: (c) => c.enqueue("START_OF_STREAM"),
 *   onTransform: (chunk) => chunk.toUpperCase(),
 *   onClose: (status, reason) => {
 *     console.log(`Stream closed with status: ${status}`);
 *     myTaskHandle.release(); // Guaranteed cleanup
 *   }
 * });
 * ```
 */
export function createCallbacksTransformer<I = any, O = any>(
  cb: StreamCallbacksAndOptions<I, O> | undefined,
): TransformStream<I, O> {
  const callbacks = cb || {};
  let isClosed = false;

  const closeOnce = async (status: StreamCloseStatus, reason?: any) => {
    if (isClosed) return;
    isClosed = true;
    if (callbacks.onClose) {
      try {
        await callbacks.onClose(status, reason);
      } catch (err) {
        // Silently log onClose errors to prevent infinite loops but ensure visibility
        console.error('[createCallbacksTransformer] Fatal: Error in onClose callback:', err);
      }
    }
  };

  // The 'any' cast on the transformer configuration allows us to use the 'cancel' hook,
  // which is supported by most modern JS runtimes (Node.js, Deno, Bun, Chrome) 
  // but is technically an extension of the basic WHATWG TransformStream spec.
  const transformer: any = {
    async start(controller: TransformStreamDefaultController): Promise<void> {
      // Intercept and decorate controller.error to ensure onClose('error') is always triggered
      const _controllerError = controller.error;
      controller.error = (error: any) => {
        _controllerError.call(controller, error);
        if (callbacks.onError) {
          try { callbacks.onError(error); } catch (e) {}
        }
        closeOnce('error', error);
      };

      // Intercept and decorate controller.terminate to ensure onClose('final') is triggered
      const _controllerTerminate = controller.terminate;
      controller.terminate = () => {
        _controllerTerminate.call(controller);
        closeOnce('final');
      };

      if (callbacks.onStart) {
        try {
          await callbacks.onStart(controller);
        } catch (error: any) {
          controller.error(error);
          await closeOnce('error', error);
        }
      }
    },

    async flush(controller: TransformStreamDefaultController): Promise<void> {
      try {
        if (callbacks.onFinal) {
          await callbacks.onFinal(controller);
        }
        await closeOnce('final');
      } catch (err) {
        controller.error(err);
      }
    },

    async cancel(reason: any): Promise<void> {
      try {
        if (callbacks.onCancel) {
          await callbacks.onCancel(reason);
        }
      } finally {
        await closeOnce('cancel', reason);
      }
    },
  };

  // Optimization: If no onTransform is provided, we omit the 'transform' method 
  // from the configuration object. Most stream implementations will recognize 
  // this as an "identity" transform and use a more efficient data path.
  if (callbacks.onTransform) {
    transformer.transform = async (chunk: I, controller: TransformStreamDefaultController) => {
      try {
        const result = await callbacks.onTransform!(chunk, controller);
        // Convenience: returning undefined defaults to passing through the original chunk.
        controller.enqueue(result === undefined ? (chunk as any) : result);
      } catch (error) {
        controller.error(error);
      }
    };
  }

  return new TransformStream(transformer);
}
