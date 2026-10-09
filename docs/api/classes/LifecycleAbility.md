[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / LifecycleAbility

# Class: LifecycleAbility

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:518](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L518)

Turns `setup`/`dispose` into a real, symmetric lifecycle driven by the registry:

- `register()` runs `setup` (idempotently, once per registration lifetime)
- `unregister()` runs `dispose` when the tool is physically removed (reference count hit zero);
  the tool goes before the dependencies it declares, and those are released last-declared first
- `clear()` / `clearAsync()` release everything the layer owns through that same lifecycle
- `dispose` re-arms `setup`, so an unregister/register cycle rebuilds whatever was released
- `cleanup` extends that symmetry to the *call*: the per-call scope of every entry point, closed
  once per call on success, throw, abort, and after a returned stream ends
- an async `setup` makes the instance *pending*: `run()` awaits it, `runSync()` refuses it

Inject it once, on the registry class you actually use:

## Example

```ts
import { ToolFunc, makeToolFuncLifecycle } from '@isdk/tool-func'

const Tools = makeToolFuncLifecycle(ToolFunc)

new Tools({
  name: 'db',
  async setup() { this.conn = await connect() },
  dispose() { this.conn.close() },
  func() { return this.conn.query('select 1') },
}).register()

await Tools.run('db') // setup has already completed by the time func runs
```

## Indexable

> \[`name`: `string`\]: `any`

## Constructors

### Constructor

> **new LifecycleAbility**(): `LifecycleAbility`

#### Returns

`LifecycleAbility`

## Accessors

### disposed

#### Get Signature

> **get** **disposed**(): `Promise`\<[`ToolFunc`](ToolFunc.md)\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:711](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L711)

Resolves once `dispose` has settled.

##### Returns

`Promise`\<[`ToolFunc`](ToolFunc.md)\>

***

### ready

#### Get Signature

> **get** **ready**(): `Promise`\<[`ToolFunc`](ToolFunc.md)\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:703](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L703)

Resolves once `setup` has settled; rejects when `setup` rejected.

##### Returns

`Promise`\<[`ToolFunc`](ToolFunc.md)\>

## Methods

### $\_shouldIsolate()

> **$\_shouldIsolate**(`params?`, `ctx?`): `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:641](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L641)

AOP overloading for `ToolFunc._shouldIsolate`.

A tool that declares `cleanup` parks per-call resources on `this` for the body to use and the
hook to release, so isolation is not optional for it: without a shadow instance, concurrent
calls would collide on the very fields that call's cleanup is about to release. This mirrors how
the cancelable ability isolates a cancelable tool, and it is why no opt-in flag is needed.

#### Parameters

##### params?

`any`

##### ctx?

`any`

#### Returns

`boolean`

***

### $initialize()

> **$initialize**(`src?`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:576](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L576)

AOP overloading for the static `ToolFunc.initialize`.

This is where we capture the normalized options object: it is the exact object that was
turned into this instance, so `setup` receives the very same `options` it always did, and we
can replay whatever `setup` writes back into it.

#### Parameters

##### src?

`any`

#### Returns

`any`

***

### $run()

> **$run**(`params?`, `ctx?`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:655](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L655)

AOP overloading for `ToolFunc.run`: awaits a pending async `setup` first.

When nothing is pending this is a plain pass-through, so synchronous tools keep their exact
current semantics (including returning a non-promise result).

#### Parameters

##### params?

`any`

##### ctx?

`any`

#### Returns

`any`

***

### $runSync()

> **$runSync**(`params?`, `ctx?`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:614](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L614)

AOP overloading for `ToolFunc.runSync`: applies the readiness gate and, for a tool that declares
`cleanup`, the per-call scope.

Only the layer that actually executes the body opens the scope. When this layer is about to be
shadowed (`_shouldIsolate`), the core recurses into a shadow runner whose own `$runSync` call
owns the cleanup — which is what keeps the four entry points (and the shadowing recursion) from
opening four nested scopes for one call.

#### Parameters

##### params?

`any`

##### ctx?

`any`

#### Returns

`any`

***

### $runWithPos()

> **$runWithPos**(...`params`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:672](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L672)

AOP overloading for `ToolFunc.runWithPos`: the positional-arguments twin of `$run`.

`runWithPos` is an async entry point just like `run`, so it must share the same
readiness contract: a pending async `setup` is awaited, never refused. Without this
override the call would fall straight into `runWithPosSync`'s gate and throw while
pending — leaving a positional tool with async setup permanently unrunnable.

#### Parameters

##### params

...`any`[]

#### Returns

`any`

***

### $runWithPosSync()

> **$runWithPosSync**(...`params`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:624](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L624)

AOP overloading for `ToolFunc.runWithPosSync`: the positional twin of `$runSync`.

#### Parameters

##### params

...`any`[]

#### Returns

`any`

***

### ensureDispose()

#### Call Signature

> **ensureDispose**(): `Promise`\<[`ToolFunc`](ToolFunc.md)\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:528](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L528)

Runs `dispose` (if it has not run yet) and resolves once it has completed, rethrowing any
error the hook produced.

##### Returns

`Promise`\<[`ToolFunc`](ToolFunc.md)\>

#### Call Signature

> **ensureDispose**(): `Promise`\<[`ToolFunc`](ToolFunc.md)\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:688](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L688)

Runs `dispose` if needed and resolves once it has settled, rethrowing hook errors.

##### Returns

`Promise`\<[`ToolFunc`](ToolFunc.md)\>

***

### ensureSetup()

#### Call Signature

> **ensureSetup**(): `Promise`\<[`ToolFunc`](ToolFunc.md)\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:523](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L523)

Runs `setup` (if it has not run yet) and resolves once it has completed.
Use this to use a tool without registering it.

##### Returns

`Promise`\<[`ToolFunc`](ToolFunc.md)\>

#### Call Signature

> **ensureSetup**(): `Promise`\<[`ToolFunc`](ToolFunc.md)\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:682](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L682)

Runs `setup` if needed and resolves once it has settled.

##### Returns

`Promise`\<[`ToolFunc`](ToolFunc.md)\>

***

### isSetupDone()

#### Call Signature

> **isSetupDone**(): `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:530](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L530)

Whether `setup` has been invoked for the current registration lifetime.

##### Returns

`boolean`

#### Call Signature

> **isSetupDone**(): `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:718](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L718)

Whether `setup` has been invoked for the current registration lifetime.

##### Returns

`boolean`

***

### isSetupPending()

#### Call Signature

> **isSetupPending**(): `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:532](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L532)

Whether an async `setup` is currently in flight.

##### Returns

`boolean`

#### Call Signature

> **isSetupPending**(): `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:723](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L723)

Whether an async `setup` is currently in flight.

##### Returns

`boolean`

***

### registerAsync()

#### Call Signature

> **registerAsync**(): `Promise`\<`boolean` \| [`ToolFunc`](ToolFunc.md)\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:534](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L534)

Registers this tool and resolves once it (and its dependency tree) is ready.

##### Returns

`Promise`\<`boolean` \| [`ToolFunc`](ToolFunc.md)\>

#### Call Signature

> **registerAsync**(): `Promise`\<`boolean` \| [`ToolFunc`](ToolFunc.md)\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:729](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L729)

Registers this tool and resolves once it and its dependency tree are ready.

##### Returns

`Promise`\<`boolean` \| [`ToolFunc`](ToolFunc.md)\>

***

### unregisterAsync()

#### Call Signature

> **unregisterAsync**(`options?`): `Promise`\<[`ToolFunc`](ToolFunc.md) \| `undefined`\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:536](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L536)

Unregisters this tool and resolves once its `dispose` has settled.

##### Parameters

###### options?

`any`

##### Returns

`Promise`\<[`ToolFunc`](ToolFunc.md) \| `undefined`\>

#### Call Signature

> **unregisterAsync**(`options?`): `Promise`\<[`ToolFunc`](ToolFunc.md) \| `undefined`\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:736](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L736)

Unregisters this tool and resolves once its `dispose` has settled.

##### Parameters

###### options?

`any`

##### Returns

`Promise`\<[`ToolFunc`](ToolFunc.md) \| `undefined`\>

***

### $register()

> `static` **$register**(`name?`, `options?`, `config?`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:590](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L590)

AOP overloading for the static `ToolFunc.register`: runs `setup` on the freshly registered
tool. Dependencies are registered through this same static, so their `setup` runs too.

#### Parameters

##### name?

`any`

##### options?

`any`

##### config?

`any`

#### Returns

`any`

***

### awaitReady()

> `static` **awaitReady**(`name`): `Promise`\<[`ToolFunc`](ToolFunc.md)\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:839](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L839)

Waits until a registered tool's `setup` has completed.

#### Parameters

##### name

`string`

#### Returns

`Promise`\<[`ToolFunc`](ToolFunc.md)\>

***

### clearAsync()

> `static` **clearAsync**(): `Promise`\<`void`\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:788](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L788)

The asynchronous `ToolFunc.clear`, awaited: releases everything this layer owns in reverse
dependency order, waiting for each teardown to settle before the next one starts.

The synchronous `clear()` cannot do that. It releases in the same order, but it has no way to
learn that a `dispose` is still in flight — that bookkeeping lives here, in the lifecycle — so
with an asynchronous teardown a dependency is dropped as soon as its holder leaves the
registry, overlapping its holder's `dispose` instead of following it.

Every owned tool is released even when some of them fail: the failures are collected and
reported in a single `AggregateError`, once the layer is fully released and never as a
half-released layer. Failures of tools released as dependencies are reported too, not only
those of the tools released as roots.

#### Returns

`Promise`\<`void`\>

***

### createAsync()

> `static` **createAsync**(`name?`, `options?`, `config?`): `Promise`\<[`ToolFunc`](ToolFunc.md)\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:831](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L831)

Creates a tool without registering it and resolves once its `setup` has completed.

#### Parameters

##### name?

`any`

##### options?

`any`

##### config?

`any`

#### Returns

`Promise`\<[`ToolFunc`](ToolFunc.md)\>

#### Example

```ts
const tool = await Tools.createAsync({ name: 'temp', setup: () => { this.conn = connect() } })
await tool.run()
await tool.ensureDispose()
```

***

### registerAsync()

> `static` **registerAsync**(`name?`, `options?`, `config?`): `Promise`\<`boolean` \| [`ToolFunc`](ToolFunc.md)\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:746](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L746)

The synchronous `ToolFunc.register`, awaited: registers the tool and resolves once it and its
whole dependency tree are ready.

#### Parameters

##### name?

`any`

##### options?

`any`

##### config?

`any`

#### Returns

`Promise`\<`boolean` \| [`ToolFunc`](ToolFunc.md)\>

***

### unregisterAsync()

> `static` **unregisterAsync**(`target?`, `options?`): `Promise`\<[`ToolFunc`](ToolFunc.md) \| `undefined`\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:764](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L764)

The synchronous `ToolFunc.unregister`, awaited: removes the tool and resolves once its whole
teardown has settled — its own `dispose` *and* the release of the dependencies it held,
which is serialized behind it. Rethrows whatever the `dispose` hook threw.

Awaiting the teardown chain (rather than just the target's `dispose`) matters because the
teardown of a dependency is chained after its dependent's: resolving earlier would let a
caller observe a half-torn-down dependency tree.

#### Parameters

##### target?

`any`

##### options?

`any`

#### Returns

`Promise`\<[`ToolFunc`](ToolFunc.md) \| `undefined`\>

***

### whenAllReady()

> `static` **whenAllReady**(): `Promise`\<`void`\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/utils/lifecycle-ability.ts:853](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/utils/lifecycle-ability.ts#L853)

Waits until every tool registered in this registry (including inherited layers) is ready.
Useful as a startup warm-up before serving traffic.

#### Returns

`Promise`\<`void`\>
