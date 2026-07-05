[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / FuncParams

# Interface: FuncParams

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:97](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/tool-func.ts#L97)

A map of function parameters, where each key is the parameter name.
The value can be either a detailed `FuncParam` object or a simple type string.

## Example

```ts
const params: FuncParams = {
  userId: 'string',
  profile: {
    type: 'object',
    description: 'User profile data'
  }
};
```

## Indexable

> \[`name`: `string`\]: `string` \| [`FuncParam`](FuncParam.md)
