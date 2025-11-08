[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / ToolFuncPackage

# Interface: ToolFuncPackage

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:217](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/tool-func.ts#L217)

Describes a package of tool functions, including methods for registration and unregistration.

## Properties

### name

> **name**: `string`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:222](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/tool-func.ts#L222)

The name of the tool function package.

***

### register()

> **register**: (`data?`) => `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:227](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/tool-func.ts#L227)

A method to register all functions within the package.

#### Parameters

##### data?

`any`

Optional data to pass to the registration process.

#### Returns

`void`

***

### unregister()?

> `optional` **unregister**: () => `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:231](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/tool-func.ts#L231)

An optional method to unregister all functions within the package.

#### Returns

`void`
