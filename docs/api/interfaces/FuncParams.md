[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / FuncParams

# Interface: FuncParams

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:122](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L122)

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
