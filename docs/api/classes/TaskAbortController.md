[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / TaskAbortController

# Class: TaskAbortController

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:17](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L17)

## Extends

- `AbortController`

## Constructors

### Constructor

> **new TaskAbortController**(`parent`): `TaskAbortController`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:28](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L28)

#### Parameters

##### parent

[`CancelableAbility`](CancelableAbility.md)

#### Returns

`TaskAbortController`

#### Overrides

`AbortController.constructor`

## Properties

### \_taskCount?

> `optional` **\_taskCount?**: `number`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:26](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L26)

共享该 aborter 的嵌套任务引用计数，用于决定何时清理 timeout 定时器

***

### id?

> `optional` **id?**: [`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:18](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L18)

***

### parent

> **parent**: [`CancelableAbility`](CancelableAbility.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:24](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L24)

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

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:21](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L21)

兼容性展示字段（last-wins），流的错误通知已改由 streamControllers 集合驱动

***

### streamControllers?

> `optional` **streamControllers?**: `any`[]

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:23](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L23)

共享该 aborter 的并发任务各自的流控制器（避免单值字段互相覆盖）

***

### timeoutId?

> `optional` **timeoutId?**: `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:19](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L19)

## Methods

### abort()

> **abort**(`reason?`, `data?`): `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:33](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L33)

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

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:45](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L45)

#### Parameters

##### alreadyRejected?

`boolean`

#### Returns

`true` \| `undefined`

***

### ~~throwRejected()~~

> **throwRejected**(`alreadyRejected?`): `true` \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:58](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L58)

#### Parameters

##### alreadyRejected?

`boolean`

#### Returns

`true` \| `undefined`

#### Deprecated

use throwIfAborted instead
