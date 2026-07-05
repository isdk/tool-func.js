[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / TaskAbortController

# Class: TaskAbortController

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:17](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L17)

## Extends

- `AbortController`

## Constructors

### Constructor

> **new TaskAbortController**(`parent`): `TaskAbortController`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:23](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L23)

#### Parameters

##### parent

[`CancelableAbility`](CancelableAbility.md)

#### Returns

`TaskAbortController`

#### Overrides

`AbortController.constructor`

## Properties

### id?

> `optional` **id?**: [`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:18](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L18)

***

### parent

> **parent**: [`CancelableAbility`](CancelableAbility.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:21](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L21)

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

> `optional` **streamController?**: `ReadableStreamDefaultController`\<`any`\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:20](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L20)

***

### timeoutId?

> `optional` **timeoutId?**: `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:19](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L19)

## Methods

### abort()

> **abort**(`reason?`, `data?`): `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:28](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L28)

Invoking this method will set this object's AbortSignal's aborted flag and signal to any observers that the associated activity is to be aborted.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortController/abort)

#### Parameters

##### reason?

`string` \| `CommonError` \| `Error`

##### data?

`any`

#### Returns

`void`

#### Overrides

`AbortController.abort`

***

### throwIfAborted()

> **throwIfAborted**(`alreadyRejected?`): `true` \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:40](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L40)

#### Parameters

##### alreadyRejected?

`boolean`

#### Returns

`true` \| `undefined`

***

### ~~throwRejected()~~

> **throwRejected**(`alreadyRejected?`): `true` \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:53](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L53)

#### Parameters

##### alreadyRejected?

`boolean`

#### Returns

`true` \| `undefined`

#### Deprecated

use throwIfAborted instead
