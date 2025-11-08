[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / TaskAbortController

# Class: TaskAbortController

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:17](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L17)

## Extends

- `AbortController`

## Constructors

### Constructor

> **new TaskAbortController**(`parent`): `TaskAbortController`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:23](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L23)

#### Parameters

##### parent

[`CancelableAbility`](CancelableAbility.md)

#### Returns

`TaskAbortController`

#### Overrides

`AbortController.constructor`

## Properties

### id?

> `optional` **id**: [`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:18](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L18)

***

### parent

> **parent**: [`CancelableAbility`](CancelableAbility.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:21](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L21)

***

### signal

> `readonly` **signal**: `AbortSignal`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.dom.d.ts:2501

Returns the AbortSignal object associated with this object.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortController/signal)

#### Inherited from

`AbortController.signal`

***

### streamController?

> `optional` **streamController**: `ReadableStreamDefaultController`\<`any`\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:20](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L20)

***

### timeoutId?

> `optional` **timeoutId**: `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:19](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L19)

## Methods

### abort()

> **abort**(`reason?`, `data?`): `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:28](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L28)

Invoking this method will set this object's AbortSignal's aborted flag and signal to any observers that the associated activity is to be aborted.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortController/abort)

#### Parameters

##### reason?

`string` | `Error` | `CommonError`

##### data?

`any`

#### Returns

`void`

#### Overrides

`AbortController.abort`

***

### throwRejected()

> **throwRejected**(`alreadyRejected?`): `undefined` \| `true`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:37](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L37)

#### Parameters

##### alreadyRejected?

`boolean`

#### Returns

`undefined` \| `true`
