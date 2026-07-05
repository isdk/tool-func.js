[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / CancelableAbility

# Class: CancelableAbility

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:66](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L66)

## Indexable

> \[`name`: `string`\]: `any`

## Constructors

### Constructor

> **new CancelableAbility**(): `CancelableAbility`

#### Returns

`CancelableAbility`

## Properties

### \_\_task\_aborter

> **\_\_task\_aborter**: [`TaskAbortController`](TaskAbortController.md) \| [`TaskAbortControllers`](../interfaces/TaskAbortControllers.md) \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:78](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L78)

***

### \_\_task\_semaphore

> **\_\_task\_semaphore**: `Semaphore` \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:79](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L79)

***

### \_asyncFeatures?

> `optional` **\_asyncFeatures?**: `number`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:67](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L67)

***

### \_isReadyFn?

> `optional` **\_isReadyFn?**: `SemaphoreIsReadyFuncType`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:69](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L69)

***

### \_maxTaskConcurrency

> **\_maxTaskConcurrency**: `number` \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:68](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L68)

***

### cleanMultiTaskAborter

> **cleanMultiTaskAborter**: (`id`, `aborters`) => `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:76](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L76)

#### Parameters

##### id

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

##### aborters

[`TaskAbortControllers`](../interfaces/TaskAbortControllers.md)

#### Returns

`void`

***

### generateAsyncTaskId

> **generateAsyncTaskId**: (`taskId?`, `aborters?`) => [`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:75](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L75)

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

> **get** **maxTaskConcurrency**(): `number` \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:81](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L81)

##### Returns

`number` \| `undefined`

***

### semaphore

#### Get Signature

> **get** **semaphore**(): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:85](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L85)

##### Returns

`any`

## Methods

### \_cleanMultiTaskAborter()

> **\_cleanMultiTaskAborter**(`id`, `aborters`): `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:299](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L299)

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

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:174](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L174)

#### Parameters

##### taskId?

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

##### aborters?

[`TaskAbortControllers`](../interfaces/TaskAbortControllers.md)

#### Returns

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

***

### $\_prepareContext()

> **$\_prepareContext**(`params?`, `ctx?`): [`ToolFuncContext`](../interfaces/ToolFuncContext.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:400](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L400)

Method overloading for ToolFunc._prepareContext

#### Parameters

##### params?

`any`

##### ctx?

[`ToolFuncContext`](../interfaces/ToolFuncContext.md)

#### Returns

[`ToolFuncContext`](../interfaces/ToolFuncContext.md)

***

### $\_shouldIsolate()

> **$\_shouldIsolate**(`params?`, `ctx?`): `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:389](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L389)

Method overloading for ToolFunc._shouldIsolate

#### Parameters

##### params?

`any`

##### ctx?

[`ToolFuncContext`](../interfaces/ToolFuncContext.md)

#### Returns

`boolean`

***

### $cleanMultiTaskAborter()

> **$cleanMultiTaskAborter**(`id`, `aborters`): `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:278](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L278)

#### Parameters

##### id

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

##### aborters

[`TaskAbortControllers`](../interfaces/TaskAbortControllers.md)

#### Returns

`void`

***

### $generateAsyncTaskId()

> **$generateAsyncTaskId**(`taskId?`, `aborters?`): [`AsyncTaskId`](../type-aliases/AsyncTaskId.md) \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:190](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L190)

#### Parameters

##### taskId?

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

##### aborters?

[`TaskAbortControllers`](../interfaces/TaskAbortControllers.md)

#### Returns

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md) \| `undefined`

***

### abort()

> **abort**(`reason?`, `data?`): `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:362](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L362)

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

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:288](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L288)

#### Parameters

##### aborter

[`TaskAbortController`](TaskAbortController.md)

#### Returns

`void`

***

### createAborter()

> **createAborter**(`params?`, `taskId?`, `raiseError?`, `ctx?`): [`TaskAbortController`](TaskAbortController.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:201](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L201)

#### Parameters

##### params?

`any`

##### taskId?

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

##### raiseError?

`boolean` = `true`

##### ctx?

[`ToolFuncContext`](../interfaces/ToolFuncContext.md)

#### Returns

[`TaskAbortController`](TaskAbortController.md)

***

### createTaskPromise()

> **createTaskPromise**\<`Output`\>(`runTask`, `params`, `options?`): [`TaskPromise`](../interfaces/TaskPromise.md)\<`Output`\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:303](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L303)

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

> **getRunningTask**(`taskId?`): [`TaskAbortController`](TaskAbortController.md) \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:129](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L129)

#### Parameters

##### taskId?

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

#### Returns

[`TaskAbortController`](TaskAbortController.md) \| `undefined`

***

### getRunningTaskCount()

> **getRunningTaskCount**(): `number`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:153](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L153)

#### Returns

`number`

***

### getSemaphore()

> **getSemaphore**(`isReadyFn?`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:89](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L89)

#### Parameters

##### isReadyFn?

`SemaphoreIsReadyFuncType` \| `undefined`

#### Returns

`any`

***

### hasAsyncFeature()

> **hasAsyncFeature**(`feature`): `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:107](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L107)

#### Parameters

##### feature

[`AsyncFeatureBits`](../enumerations/AsyncFeatureBits.md)

#### Returns

`boolean`

***

### isAborted()

> **isAborted**(`taskId?`): `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:113](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L113)

#### Parameters

##### taskId?

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

#### Returns

`boolean`

***

### runAsyncCancelableTask()

> **runAsyncCancelableTask**\<`Output`\>(`params?`, `runTask`, `options?`): [`TaskPromise`](../interfaces/TaskPromise.md)\<`Output`\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:347](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L347)

#### Type Parameters

##### Output

`Output` = `any`

#### Parameters

##### params?

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

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:100](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/utils/cancelable-ability.ts#L100)

#### Parameters

##### feature

[`AsyncFeatureBits`](../enumerations/AsyncFeatureBits.md)

#### Returns

`boolean`
