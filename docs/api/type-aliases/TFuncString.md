[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / TFuncString

# Type Alias: TFuncString

> **TFuncString** = `string`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:152](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L152)

The implementation of a tool function as a string.

The string must be a **function expression** (e.g. `'(a, b) => a + b'`,
`'function(a, b) { return a + b }'`, or `'function named(a) { return a }'`).
It is compiled at construction/registration time via `_createFunction`,
which wraps the string as `Function(scopeKeys, 'return ' + expr)`.
Bare expressions (e.g. `'a + b'`) evaluate to a value instead of a function
and are rejected with a clear error.

Security note: string funcs are compiled with `new Function`, so only pass
strings from trusted sources (e.g. your own persisted data).
