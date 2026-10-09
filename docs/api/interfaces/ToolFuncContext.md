[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / ToolFuncContext

# Interface: ToolFuncContext

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:20](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L20)

Execution context for a tool function.

## Indexable

> \[`key`: `string`\]: `any`

Allows users to extend arbitrary properties.

## Properties

### binding?

> `optional` **binding?**: `"early"` \| `"late"` \| `"auto"`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:37](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L37)

The binding strategy for internal dependencies (runAsSync).
- 'early': Always use pre-bound instances from 'depends'.
- 'late': Always resolve from rootRegistry (forced polymorphism).
- 'auto': Use 'late' if rootRegistry shadows the dependency, else 'early' (Safe Default).

***

### inheritContext?

> `optional` **inheritContext?**: `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:53](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L53)

Whether to allow context inheritance/propagation in nested calls.
Defaults to true.

***

### isolated?

> `optional` **isolated?**: `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:45](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L45)

Whether to enable independent execution scope.
If true, a temporary instance will be created via Object.create(this) to isolate concurrency.

***

### rootRegistry?

> `optional` **rootRegistry?**: *typeof* [`ToolFunc`](../classes/ToolFunc.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:27](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L27)

The entry-point registry class that initiated the call chain.
Used for late-binding dependency resolution in hierarchical registries.

***

### signal?

> `optional` **signal?**: `AbortSignal`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:60](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L60)

Standard Web AbortSignal for propagating cancellation signals.
