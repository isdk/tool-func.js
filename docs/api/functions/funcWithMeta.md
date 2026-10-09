[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / funcWithMeta

# Function: funcWithMeta()

> **funcWithMeta**(`fn`, `meta`, `ignoreExists?`): [`ToolFunc`](../classes/ToolFunc.md) \| [`FuncWithMeta`](../type-aliases/FuncWithMeta.md) \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-func/src/func-meta.ts:22](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/func-meta.ts#L22)

Attaches metadata to a function or `ToolFunc` object.

This utility merges the provided metadata with any existing metadata on the target.

## Parameters

### fn

[`ToolFunc`](../classes/ToolFunc.md) \| [`FuncWithMeta`](../type-aliases/FuncWithMeta.md)

The function or `ToolFunc` instance to which metadata will be added.

### meta

`any`

The metadata object to attach. The operation is skipped if this is not a non-null object.

### ignoreExists?

`boolean` = `true`

If `true`, new metadata overwrites existing keys. If `false`, it merges deeply, preserving existing values.

## Returns

[`ToolFunc`](../classes/ToolFunc.md) \| [`FuncWithMeta`](../type-aliases/FuncWithMeta.md) \| `undefined`

The updated function or `ToolFunc` with metadata, or `undefined` if the operation was skipped.
