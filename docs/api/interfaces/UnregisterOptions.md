[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / UnregisterOptions

# Interface: UnregisterOptions

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:524](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L524)

Options for unregistering a tool function.

## Properties

### decrement?

> `optional` **decrement?**: `"once"` \| `"all"`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:541](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L541)

How to handle the reference count.
- 'once' (default): Decrement the count by one.
- 'all': Completely remove the reference count entry.

#### Default Value

```ts
force ? 'all' : 'once'
```

***

### force?

> `optional` **force?**: `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:531](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L531)

If true, force physical removal from the registry even if references exist.
Also defaults the `decrement` option to `'all'` if not specified.

***

### scope?

> `optional` **scope?**: `"all"` \| `"local"` \| `"inherited"`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:553](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L553)

The scope of unregistration in a hierarchical registry:
- 'local' (default): Only remove if the item is "owned" by the current scope.
  Ownership is defined by having an 'own' property in items, aliases, OR reference counts.
  Note: Including reference counts ensures that circular dependencies are correctly cleaned up
  even after the primary instance is removed from the items list during an override.
- 'inherited': Search up the prototype chain and remove the first match found.
- 'all': Remove all occurrences found in the entire prototype chain.
