[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / ToolFuncPackage

# Interface: ToolFuncPackage

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:284](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/tool-func.ts#L284)

Describes a package of tool functions, including methods for registration and unregistration.

## Properties

### name

> **name**: `string`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:289](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/tool-func.ts#L289)

The name of the tool function package.

***

### register

> **register**: (`data?`) => `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:294](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/tool-func.ts#L294)

A method to register all functions within the package.

#### Parameters

##### data?

`any`

Optional data to pass to the registration process.

#### Returns

`void`

***

### unregister?

> `optional` **unregister?**: () => `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:298](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/tool-func.ts#L298)

An optional method to unregister all functions within the package.

#### Returns

`void`
