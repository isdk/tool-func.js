[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / createCallbacksTransformer

# Function: createCallbacksTransformer()

> **createCallbacksTransformer**\<`I`, `O`\>(`cb?`): `TransformStream`\<`I`, `O`\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/stream/create-callbacks-stream.ts:92](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/stream/create-callbacks-stream.ts#L92)

Creates a transform stream that invokes optional callback functions during its lifecycle.

### Key Features:
- **Unified Cleanup**: The `onClose` hook ensures resource recovery happens once and only once.
- **Zero-Copy Optimization**: If `onTransform` is omitted, it leverages the engine's internal 
  optimized identity path for maximum throughput.
- **Cancellation Support**: Explicitly handles the `cancel` hook, critical for Web/RPC scenarios.
- **Robustness**: Protects the stream lifecycle even if callbacks themselves throw errors.

## Type Parameters

### I

`I` = `any`

### O

`O` = `any`

## Parameters

### cb?

[`StreamCallbacksAndOptions`](../interfaces/StreamCallbacksAndOptions.md)\<`I`, `O`\>

An object containing optional lifecycle callbacks.

## Returns

`TransformStream`\<`I`, `O`\>

A TransformStream that allows the execution of custom logic through callbacks.

## Example

```typescript
const transformer = createCallbacksTransformer({
  onStart: (c) => c.enqueue("START_OF_STREAM"),
  onTransform: (chunk) => chunk.toUpperCase(),
  onClose: (status, reason) => {
    console.log(`Stream closed with status: ${status}`);
    myTaskHandle.release(); // Guaranteed cleanup
  }
});
```
