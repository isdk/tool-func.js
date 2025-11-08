[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / FuncParam

# Interface: FuncParam

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:16](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/tool-func.ts#L16)

Describes a single function parameter, including its name, type, and description.

## Properties

### description?

> `optional` **description**: `string`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:39](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/tool-func.ts#L39)

A description of the parameter, explaining its purpose and usage.

***

### name?

> `optional` **name**: `string`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:21](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/tool-func.ts#L21)

The name of the parameter.

***

### required?

> `optional` **required**: `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:33](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/tool-func.ts#L33)

Indicates whether the parameter is required.

***

### type?

> `optional` **type**: `string`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:27](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/tool-func.ts#L27)

The data type of the parameter, represented as a string identifier (e.g., 'string', 'number').
