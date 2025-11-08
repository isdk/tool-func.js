[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / funcWithMeta

# Function: funcWithMeta()

> **funcWithMeta**(`fn`, `meta`, `ignoreExists?`): `undefined` \| `Function` \| [`ToolFunc`](../classes/ToolFunc.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:887](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/tool-func.ts#L887)

Attaches metadata to a function or `ToolFunc` object.

This utility merges the provided metadata with any existing metadata on the target.

## Parameters

### fn

The function or `ToolFunc` instance to which metadata will be added.

`Function` | [`ToolFunc`](../classes/ToolFunc.md)

### meta

`any`

The metadata object to attach. The operation is skipped if this is not a non-null object.

### ignoreExists?

`boolean` = `true`

If `true`, new metadata overwrites existing keys. If `false`, it merges deeply, preserving existing values.

## Returns

`undefined` \| `Function` \| [`ToolFunc`](../classes/ToolFunc.md)

The updated function or `ToolFunc` with metadata, or `undefined` if the operation was skipped.
