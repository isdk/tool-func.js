[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / FuncParams

# Interface: FuncParams

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:55](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/tool-func.ts#L55)

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

\[`name`: `string`\]: `string` \| [`FuncParam`](FuncParam.md)
