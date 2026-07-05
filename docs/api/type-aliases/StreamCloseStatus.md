[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / StreamCloseStatus

# Type Alias: StreamCloseStatus

> **StreamCloseStatus** = `"final"` \| `"error"` \| `"cancel"`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/stream/create-callbacks-stream.ts:7](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/stream/create-callbacks-stream.ts#L7)

Status indicating how the stream was closed.
- 'final': Stream completed successfully (flush/close).
- 'error': Stream closed due to an internal or upstream error.
- 'cancel': Stream was explicitly aborted by the reader/consumer.
