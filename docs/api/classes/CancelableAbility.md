[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / CancelableAbility

# Class: CancelableAbility

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:56](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L56)

## Indexable

\[`name`: `string`\]: `any`

## Constructors

### Constructor

> **new CancelableAbility**(): `CancelableAbility`

#### Returns

`CancelableAbility`

## Properties

### \_\_task\_aborter

> **\_\_task\_aborter**: `undefined` \| [`TaskAbortController`](TaskAbortController.md) \| [`TaskAbortControllers`](../interfaces/TaskAbortControllers.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:68](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L68)

***

### \_\_task\_semaphore

> **\_\_task\_semaphore**: `undefined` \| `Semaphore`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:69](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L69)

***

### \_asyncFeatures?

> `optional` **\_asyncFeatures**: `number`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:57](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L57)

***

### \_isReadyFn?

> `optional` **\_isReadyFn**: `SemaphoreIsReadyFuncType`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:59](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L59)

***

### \_maxTaskConcurrency

> **\_maxTaskConcurrency**: `undefined` \| `number`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:58](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L58)

***

### cleanMultiTaskAborter()

> **cleanMultiTaskAborter**: (`id`, `aborters`) => `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:66](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L66)

#### Parameters

##### id

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

##### aborters

[`TaskAbortControllers`](../interfaces/TaskAbortControllers.md)

#### Returns

`void`

***

### generateAsyncTaskId()

> **generateAsyncTaskId**: (`taskId?`, `aborters?`) => [`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:65](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L65)

#### Parameters

##### taskId?

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

##### aborters?

[`TaskAbortControllers`](../interfaces/TaskAbortControllers.md)

#### Returns

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

## Accessors

### maxTaskConcurrency

#### Get Signature

> **get** **maxTaskConcurrency**(): `undefined` \| `number`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:71](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L71)

##### Returns

`undefined` \| `number`

***

### semaphore

#### Get Signature

> **get** **semaphore**(): `undefined` \| `Semaphore`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:75](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L75)

##### Returns

`undefined` \| `Semaphore`

## Methods

### \_cleanMultiTaskAborter()

> **\_cleanMultiTaskAborter**(`id`, `aborters`): `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:263](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L263)

#### Parameters

##### id

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

##### aborters

[`TaskAbortControllers`](../interfaces/TaskAbortControllers.md)

#### Returns

`void`

***

### \_generateAsyncTaskId()

> **\_generateAsyncTaskId**(`taskId?`, `aborters?`): [`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:155](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L155)

#### Parameters

##### taskId?

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

##### aborters?

[`TaskAbortControllers`](../interfaces/TaskAbortControllers.md)

#### Returns

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

***

### $cleanMultiTaskAborter()

> **$cleanMultiTaskAborter**(`id`, `aborters`): `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:243](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L243)

#### Parameters

##### id

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

##### aborters

[`TaskAbortControllers`](../interfaces/TaskAbortControllers.md)

#### Returns

`void`

***

### $generateAsyncTaskId()

> **$generateAsyncTaskId**(`taskId?`, `aborters?`): `undefined` \| [`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:168](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L168)

#### Parameters

##### taskId?

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

##### aborters?

[`TaskAbortControllers`](../interfaces/TaskAbortControllers.md)

#### Returns

`undefined` \| [`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

***

### abort()

> **abort**(`reason?`, `data?`): `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:320](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L320)

#### Parameters

##### reason?

`string`

##### data?

`any`

#### Returns

`void`

***

### cleanTaskAborter()

> **cleanTaskAborter**(`aborter`): `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:253](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L253)

#### Parameters

##### aborter

[`TaskAbortController`](TaskAbortController.md)

#### Returns

`void`

***

### createAborter()

> **createAborter**(`params?`, `taskId?`, `raiseError?`): [`TaskAbortController`](TaskAbortController.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:179](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L179)

#### Parameters

##### params?

`any`

##### taskId?

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

##### raiseError?

`boolean` = `true`

#### Returns

[`TaskAbortController`](TaskAbortController.md)

***

### createTaskPromise()

> **createTaskPromise**\<`Output`\>(`runTask`, `params`, `options?`): [`TaskPromise`](../interfaces/TaskPromise.md)\<`Output`\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:267](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L267)

#### Type Parameters

##### Output

`Output` = `any`

#### Parameters

##### runTask

(`params`, `aborter`) => `Promise`\<`Output`\>

##### params

`Record`\<`string`, `any`\>

##### options?

###### raiseError?

`boolean`

###### taskId?

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

#### Returns

[`TaskPromise`](../interfaces/TaskPromise.md)\<`Output`\>

***

### getRunningTask()

> **getRunningTask**(`taskId?`): `undefined` \| [`TaskAbortController`](TaskAbortController.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:117](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L117)

#### Parameters

##### taskId?

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

#### Returns

`undefined` \| [`TaskAbortController`](TaskAbortController.md)

***

### getRunningTaskCount()

> **getRunningTaskCount**(): `number`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:140](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L140)

#### Returns

`number`

***

### getSemaphore()

> **getSemaphore**(`isReadyFn`): `undefined` \| `Semaphore`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:79](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L79)

#### Parameters

##### isReadyFn

`undefined` | `SemaphoreIsReadyFuncType`

#### Returns

`undefined` \| `Semaphore`

***

### hasAsyncFeature()

> **hasAsyncFeature**(`feature`): `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:96](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L96)

#### Parameters

##### feature

[`AsyncFeatureBits`](../enumerations/AsyncFeatureBits.md)

#### Returns

`boolean`

***

### isAborted()

> **isAborted**(`taskId?`): `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:102](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L102)

#### Parameters

##### taskId?

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

#### Returns

`boolean`

***

### runAsyncCancelableTask()

> **runAsyncCancelableTask**\<`Output`\>(`params`, `runTask`, `options?`): [`TaskPromise`](../interfaces/TaskPromise.md)\<`Output`\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:305](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L305)

#### Type Parameters

##### Output

`Output` = `any`

#### Parameters

##### params

`Record`\<`string`, `any`\> = `{}`

##### runTask

(`params`, `aborter`) => `Promise`\<`Output`\>

##### options?

###### isReadyFn?

`SemaphoreIsReadyFuncType`

###### raiseError?

`boolean`

###### taskId?

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

#### Returns

[`TaskPromise`](../interfaces/TaskPromise.md)\<`Output`\>

***

### hasAsyncFeature()

> `static` **hasAsyncFeature**(`feature`): `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:89](https://github.com/isdk/tool-func.js/blob/c7a20c117738f7c649e6488f0c70165b848eb802/src/utils/cancelable-ability.ts#L89)

#### Parameters

##### feature

[`AsyncFeatureBits`](../enumerations/AsyncFeatureBits.md)

#### Returns

`boolean`
