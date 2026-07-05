[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / funcWithMeta

# Function: funcWithMeta()

> **funcWithMeta**(`fn`, `meta`, `ignoreExists?`): `Function` \| [`ToolFunc`](../classes/ToolFunc.md) \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-func/src/func-meta.ts:14](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/func-meta.ts#L14)

Attaches metadata to a function or `ToolFunc` object.

This utility merges the provided metadata with any existing metadata on the target.

## Parameters

### fn

`Function` \| [`ToolFunc`](../classes/ToolFunc.md)

The function or `ToolFunc` instance to which metadata will be added.

### meta

`any`

The metadata object to attach. The operation is skipped if this is not a non-null object.

### ignoreExists?

`boolean` = `true`

If `true`, new metadata overwrites existing keys. If `false`, it merges deeply, preserving existing values.

## Returns

`Function` \| [`ToolFunc`](../classes/ToolFunc.md) \| `undefined`

The updated function or `ToolFunc` with metadata, or `undefined` if the operation was skipped.
