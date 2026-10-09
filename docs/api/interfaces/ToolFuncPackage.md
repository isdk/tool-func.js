[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / ToolFuncPackage

# Interface: ToolFuncPackage

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:481](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L481)

Describes a package of tool functions, including methods for registration and unregistration.

## Properties

### name

> **name**: `string`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:487](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L487)

The name of the tool function package.

***

### register

> **register**: (`data?`) => `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:494](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L494)

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

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:500](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L500)

An optional method to unregister all functions within the package.

#### Returns

`void`
