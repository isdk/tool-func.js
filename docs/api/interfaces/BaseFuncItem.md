[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / BaseFuncItem

# Interface: BaseFuncItem

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:159](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L159)

Base configuration for defining a tool function.

## Extended by

- [`FuncItem`](FuncItem.md)
- [`BaseFunc`](BaseFunc.md)

## Properties

### alias?

> `optional` **alias?**: `string` \| `string`[]

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:334](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L334)

Optional aliases for the function name.

***

### asyncFeatures?

> `optional` **asyncFeatures?**: `number`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:351](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L351)

A bitmask representing asynchronous features supported by the function, built from `AsyncFeatureBits`.
This allows the system to understand if a function supports capabilities like cancellation or multi-tasking.

#### See

`AsyncFeatureBits` from `./utils/async-features`

#### Example

```ts
import { AsyncFeatures } from './utils';
const func = new ToolFunc({
  name: 'cancellableTask',
  asyncFeatures: AsyncFeatures.Cancelable | AsyncFeatures.MultiTask,
  // ...
});
```

***

### depends?

> `optional` **depends?**: `object`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:377](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L377)

A map of dependencies this function has on other tool functions.
Declaring dependencies ensures that they are automatically registered when this function is registered.
This is crucial for building modular functions that rely on each other without needing to manage registration order manually.

#### Index Signature

\[`name`: `string`\]: [`ToolFunc`](../classes/ToolFunc.md)

#### Example

```ts
const helperFunc = new ToolFunc({ name: 'helper', func: () => 'world' });
const mainFunc = new ToolFunc({
  name: 'main',
  depends: {
    helper: helperFunc,
  },
  func() {
    // We can now safely run the dependency
    const result = this.runSync('helper');
    return `Hello, ${result}`;
  }
});
// When mainFunc is registered, helperFunc will be registered automatically.
mainFunc.register();
```

***

### description?

> `optional` **description?**: `string`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:383](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L383)

A detailed description of what the function does.

***

### isApi?

> `optional` **isApi?**: `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:321](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L321)

If true, indicates that this function should be treated as a server-side API.

***

### name?

> `optional` **name?**: `string`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:165](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L165)

The unique name of the function.

***

### params?

> `optional` **params?**: [`FuncParams`](FuncParams.md) \| [`FuncParam`](FuncParam.md)[]

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:171](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L171)

Parameter definitions, which can be an object mapping names to definitions or an array for positional parameters.

***

### result?

> `optional` **result?**: `string` \| `Record`\<`string`, `any`\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:177](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L177)

The expected return type of the function, described as a string or a JSON schema object.

***

### scope?

> `optional` **scope?**: `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:196](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L196)

The execution scope or context (`this`) for the function.

Its keys become closure variables of the func, and a `this` key becomes the func's `this`.
Because those bindings are captured while compiling, the scope is read at compile time:

- a string [FuncItem.func](FuncItem.md#func) is always compiled against it;
- a *function* value is compiled from its own source when a non-empty scope is declared — a
  source that is not a function expression (method shorthand, a class method, native code) is
  used as-is instead, since it has no standalone source to compile;
- an empty or absent scope leaves a function value untouched, so its lexical closure survives.

A [BaseFuncItem.setup](#setup) hook may provide the scope too: it is applied *before* the func is
compiled (see the lifecycle ability).

***

### stream?

> `optional` **stream?**: `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:328](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L328)

If true, indicates that the function has the *capability* to stream its output.
Whether a specific call is streamed is determined by a `stream` property in the runtime parameters.

***

### tags?

> `optional` **tags?**: `string` \| `string`[]

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:202](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L202)

Tags for grouping or filtering functions.

***

### title?

> `optional` **title?**: `string`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:389](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L389)

A concise, human-readable title for the function, often used in UI or by AI.

## Methods

### cleanup()?

> `optional` **cleanup**(`this`): `void` \| `Promise`\<`void`\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:315](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L315)

A lifecycle hook called once at the **end of every call**, releasing whatever *that call*
acquired. It is the call-scoped twin of [BaseFuncItem.dispose](#dispose): while `dispose` is tied to
the instance's registration lifetime, `cleanup` is tied to a single `run()`.

Because the tools are executed through an isolated shadow instance, the body may park per-call
resources on `this` (`this.tx = begin()`) and `cleanup` releases exactly those — concurrent calls
cannot collide. Declaring `cleanup` is what makes that isolation automatic; no flag is needed.

It is invoked on every terminal path of the call, at most once: a synchronous result or throw, a
settled promise (resolve *and* reject), a returned `ReadableStream` (once that stream finishes,
fails or is cancelled), and an abort of the call's signal. Write it defensively (`this.tx?.rollback()`),
since a body that threw before acquiring anything still ends the call.

The hook may return a `Promise`. A synchronous entry point can only *initiate* that release (its
rejection is logged rather than thrown), while `run()`/`runWithPos()` already return a promise and
therefore resolve only after `cleanup` has settled. When both the body and `cleanup` fail, the two
errors are reported as one `AggregateError`.

NOTE: like [BaseFuncItem.setup](#setup) and [BaseFuncItem.dispose](#dispose), this hook is only invoked
by the `makeToolFuncLifecycle` ability. Install it once, on the registry class you actually use:
`const Tools = makeToolFuncLifecycle(ToolFunc)`.

#### Parameters

##### this

[`ToolFunc`](../classes/ToolFunc.md)

#### Returns

`void` \| `Promise`\<`void`\>

#### Example

```ts
const Tools = makeToolFuncLifecycle(ToolFunc);
const myFunc = new Tools({
  name: 'tx',
  func() {
    this.tx = db.begin();   // acquired whenever the body needs it, conditionally if you like
    return this.tx.query('select 1');
  },
  cleanup() { return this.tx?.commit() },  // <- runs when the call ends, however it ends
});
```

***

### dispose()?

> `optional` **dispose**(`this`): `void` \| `Promise`\<`void`\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:276](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L276)

A lifecycle hook called once when the `ToolFunc` instance is **removed from the registry**,
i.e. when the reference count drops to zero or when `unregister` is forced. It is the exact
inverse of [BaseFuncItem.setup](#setup): releasing whatever `setup` acquired (connections,
logins, timers, subscriptions...).

The hook may return a `Promise`. Because the synchronous `unregister()` cannot await it, the
returned promise is tracked and its rejection is logged rather than thrown. Use
`unregisterAsync()` to await the teardown and observe the real error.

After a successful `dispose`, the instance is re-armed: registering it again re-runs `setup`.

NOTE: like [BaseFuncItem.setup](#setup), this hook is only invoked by the `makeToolFuncLifecycle`
ability. Install it once, on the registry class you actually use:
`const Tools = makeToolFuncLifecycle(ToolFunc)`.

#### Parameters

##### this

[`ToolFunc`](../classes/ToolFunc.md)

#### Returns

`void` \| `Promise`\<`void`\>

#### Example

```ts
const Tools = makeToolFuncLifecycle(ToolFunc);
const myFunc = new Tools({
  name: 'myFunc',
  setup() { this.conn = connect() },
  dispose() { this.conn.close() },
  func: () => 'ok',
});
myFunc.register();
myFunc.unregister(); // <- dispose runs here
```

***

### setup()?

> `optional` **setup**(`this`, `options?`): `void` \| `Promise`\<`void`\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:244](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L244)

A lifecycle hook called once when the `ToolFunc` instance is **registered**, and again after
it has been `dispose`d and re-registered. It is the exact inverse of [BaseFuncItem.dispose](#dispose).

It allows for initial setup, state configuration, or property modification on the instance.
The `this` context is the `ToolFunc` instance itself.

The hook may return a `Promise`. When it does, the instance is *pending* until that promise
settles: `run()` awaits it automatically, while `runSync()` refuses to execute and asks you to
use `run()` / `await tool.ready` instead. Use `registerAsync()` when you want registration
itself to wait for setup to finish.

NOTE: this hook is only *invoked* by the `makeToolFuncLifecycle` ability — a plain `ToolFunc`
stores it but never calls it. Install it once, on the registry class you actually use:
`const Tools = makeToolFuncLifecycle(ToolFunc)`.

Mutating `options` inside the hook still works (including after an `await`): the touched keys
are re-applied through the very same `initialize`/`assign` pipeline that built the instance.
A `scope` the hook provides — through `this.scope` or through the options object — is applied
before a string `func` is compiled, and a scope *change* rebuilds it (see
[BaseFuncItem.scope](#scope)).

#### Parameters

##### this

[`ToolFunc`](../classes/ToolFunc.md)

The `ToolFunc` instance the hook is bound to.

##### options?

[`FuncItem`](FuncItem.md)

The configuration options for the function.

#### Returns

`void` \| `Promise`\<`void`\>

#### Example

```ts
const Tools = makeToolFuncLifecycle(ToolFunc);
const myFunc = new Tools({
  name: 'myFunc',
  customState: 'initial',
  setup() {
    // `this` is the myFunc instance
    this.customState = 'configured';
  }
});
myFunc.register(); // <- setup runs here, not in the constructor
console.log(myFunc.customState); // Outputs: 'configured'
```
