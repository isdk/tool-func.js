[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / CancelableAbility

# Class: CancelableAbility

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:71](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L71)

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

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:83](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L83)

***

### \_\_task\_semaphore

> **\_\_task\_semaphore**: `Semaphore` \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:84](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L84)

***

### \_asyncFeatures?

> `optional` **\_asyncFeatures?**: `number`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:72](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L72)

***

### \_isReadyFn?

> `optional` **\_isReadyFn?**: `SemaphoreIsReadyFuncType`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:74](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L74)

***

### \_maxTaskConcurrency

> **\_maxTaskConcurrency**: `number` \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:73](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L73)

***

### cleanMultiTaskAborter

> **cleanMultiTaskAborter**: (`id`, `aborters`) => `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:81](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L81)

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

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:80](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L80)

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

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:86](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L86)

##### Returns

`number` \| `undefined`

***

### semaphore

#### Get Signature

> **get** **semaphore**(): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:90](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L90)

##### Returns

`any`

## Methods

### \_cleanMultiTaskAborter()

> **\_cleanMultiTaskAborter**(`id`, `aborters`): `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:328](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L328)

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

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:180](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L180)

#### Parameters

##### taskId?

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

##### aborters?

[`TaskAbortControllers`](../interfaces/TaskAbortControllers.md)

#### Returns

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

***

### \_resolveTaskId()

> **\_resolveTaskId**(`taskId?`): [`AsyncTaskId`](../type-aliases/AsyncTaskId.md) \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:339](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L339)

为本次调用解析每任务 taskId（multitask 模式下预生成并返回）。

并发任务可能共享同一个 ctx（如同一个 `with()` runner 上的并发 `run()`）与同一个 aborter，
因此 taskId 必须在调用方作为局部变量持有、通过闭包传递，
而不能存到共享对象上（`ctx.taskId` / `aborter.id` 都会被覆盖）。

#### Parameters

##### taskId?

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

#### Returns

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md) \| `undefined`

***

### \_runCancelableTask()

> **\_runCancelableTask**\<`Output`\>(`runTask`, `params`, `aborter`, `taskId?`): `Promise`\<`Output`\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:375](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L375)

执行任务并绑定清理逻辑（任务池注销 / 流管道 / timeout 清理 / 外部信号监听清理）。

- 通过 Promise.resolve().then 延迟调用 runTask，使同步 throw 也走 reject 路径，
  保证 .catch/.finally 清理逻辑必然执行，避免 aborter 泄漏。
- 引用计数：嵌套任务复用同一个 aborter 时，只有最后一个任务结束时才清理 timeout
  定时器，保证 timeout 覆盖整个任务链。计数以“已启动”的任务为准（排队中尚未
  运行的任务不计入），故并发共享 aborter + 信号量排队时，最后一个启动的任务
  结束即清理定时器，组级 deadline 以启动阶段为界。

#### Type Parameters

##### Output

`Output` = `any`

#### Parameters

##### runTask

(`params`, `aborter`) => `Promise`\<`Output`\>

##### params

`Record`\<`string`, `any`\>

##### aborter

[`TaskAbortController`](TaskAbortController.md)

##### taskId?

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

#### Returns

`Promise`\<`Output`\>

***

### $\_prepareContext()

> **$\_prepareContext**(`params?`, `ctx?`): [`ToolFuncContext`](../interfaces/ToolFuncContext.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:494](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L494)

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

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:483](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L483)

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

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:305](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L305)

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

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:196](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L196)

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

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:456](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L456)

#### Parameters

##### reason?

`string`

##### data?

`any`

#### Returns

`void`

***

### cleanTaskAborter()

> **cleanTaskAborter**(`aborter`, `taskId?`): `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:315](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L315)

#### Parameters

##### aborter

[`TaskAbortController`](TaskAbortController.md)

##### taskId?

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

#### Returns

`void`

***

### createAborter()

> **createAborter**(`params?`, `taskId?`, `raiseError?`, `ctx?`): [`TaskAbortController`](TaskAbortController.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:208](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L208)

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

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:350](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L350)

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

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:135](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L135)

#### Parameters

##### taskId?

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

#### Returns

[`TaskAbortController`](TaskAbortController.md) \| `undefined`

***

### getRunningTaskCount()

> **getRunningTaskCount**(): `number`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:159](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L159)

#### Returns

`number`

***

### getSemaphore()

> **getSemaphore**(`isReadyFn?`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:94](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L94)

#### Parameters

##### isReadyFn?

`SemaphoreIsReadyFuncType` \| `undefined`

#### Returns

`any`

***

### hasAsyncFeature()

> **hasAsyncFeature**(`feature`): `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:113](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L113)

#### Parameters

##### feature

[`AsyncFeatureBits`](../enumerations/AsyncFeatureBits.md)

#### Returns

`boolean`

***

### isAborted()

> **isAborted**(`taskId?`): `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:119](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L119)

#### Parameters

##### taskId?

[`AsyncTaskId`](../type-aliases/AsyncTaskId.md)

#### Returns

`boolean`

***

### runAsyncCancelableTask()

> **runAsyncCancelableTask**\<`Output`\>(`params?`, `runTask`, `options?`): [`TaskPromise`](../interfaces/TaskPromise.md)\<`Output`\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:431](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L431)

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

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/cancelable-ability.ts:106](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/cancelable-ability.ts#L106)

#### Parameters

##### feature

[`AsyncFeatureBits`](../enumerations/AsyncFeatureBits.md)

#### Returns

`boolean`
