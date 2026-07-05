[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / ToolFuncContext

# Interface: ToolFuncContext

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:16](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/tool-func.ts#L16)

Execution context for a tool function.

## Indexable

> \[`key`: `string`\]: `any`

Allows users to extend arbitrary properties.

## Properties

### binding?

> `optional` **binding?**: `"early"` \| `"late"` \| `"auto"`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:29](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/tool-func.ts#L29)

The binding strategy for internal dependencies (runAsSync).
- 'early': Always use pre-bound instances from 'depends'.
- 'late': Always resolve from rootRegistry (forced polymorphism).
- 'auto': Use 'late' if rootRegistry shadows the dependency, else 'early' (Safe Default).

***

### inheritContext?

> `optional` **inheritContext?**: `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:41](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/tool-func.ts#L41)

Whether to allow context inheritance/propagation in nested calls.
Defaults to true.

***

### isolated?

> `optional` **isolated?**: `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:35](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/tool-func.ts#L35)

Whether to enable independent execution scope.
If true, a temporary instance will be created via Object.create(this) to isolate concurrency.

***

### rootRegistry?

> `optional` **rootRegistry?**: *typeof* [`ToolFunc`](../classes/ToolFunc.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:21](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/tool-func.ts#L21)

The entry-point registry class that initiated the call chain.
Used for late-binding dependency resolution in hierarchical registries.

***

### signal?

> `optional` **signal?**: `AbortSignal`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:46](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/tool-func.ts#L46)

Standard Web AbortSignal for propagating cancellation signals.
