[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / ToolFunc

# Class: ToolFunc

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:510](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L510)

A manager for creating, registering, and executing reusable tool functions.

`ToolFunc` provides a robust framework for defining functions with rich metadata,
managing their lifecycle, and executing them through a centralized registry.
It is the core component for creating modular and discoverable tools.

Key Features:
- **Rich Metadata**: Define functions with descriptions, parameters, tags, and titles, making
  them self-documenting.
- **Static Registry**: A global, static registry (`ToolFunc.items`) allows any part of an
  application to access and run registered functions by name.
- **Dependency Management**: Use the `depends` property to declare dependencies on other
  `ToolFunc`s, which are then auto-registered.
- **Aliasing**: Assign multiple names to a function for flexibility.
- **Lifecycle Hooks**: Use the `setup`/`dispose` pair when you install the
  `makeToolFuncLifecycle` ability. They turn plain hook functions (stored but ignored by a bare
  `ToolFunc`) into a symmetric lifecycle: `register()` runs `setup`, `dispose()` is the inverse
  teardown, an async `setup` makes the instance *pending* (gated for `runSync` /
  `runWithPosSync`), and `dispose` re-arms the hook so an unregister/register cycle rebuilds the
  acquired state. `cleanup` extends the same symmetry to the *call*: it releases that call's
  resources once, on success, throw, abort, and after a returned stream ends.

  *

## See

 - `makeToolFuncLifecycle` (from `@src/utils/lifecycle-ability.ts`)
  *
 - `LifecycleAbility`
  *
 - `LifecycleAbilityOptions`
  * - **Parameter Handling**: Automatically handles both positional and named parameters.

## Example

```ts
// 1. Define a helper function
const getUser = new ToolFunc({
  name: 'getUser',
  description: 'Retrieves a user by ID.',
  params: { id: { type: 'string', required: true } },
  func: (params) => ({ id: params.id, name: 'John Doe' }),
});

// 2. Define a main function that depends on the helper
const welcomeUser = new ToolFunc({
  name: 'welcomeUser',
  title: 'Welcome User',
  description: 'Generates a welcome message for a user.',
  params: { userId: 'string' },
  depends: {
    // By declaring this dependency, `getUser` will be auto-registered
    // when `welcomeUser` is registered.
    userFetcher: getUser,
  },
  func: function(params) {
    // `this` is the ToolFunc instance, so we can use `runSync`
    const user = this.runSync('userFetcher', { id: params.userId });
    return `Hello, ${user.name}!`;
  },
});

// 3. Register the main function. The dependency is registered automatically.
welcomeUser.register();

// 4. Run the function from anywhere using the static runner.
async function main() {
  const message = await ToolFunc.run('welcomeUser', { userId: '123' });
  console.log(message); // Outputs: "Hello, John Doe!"
}

main();
```

## Extends

- [`BaseFunc`](../interfaces/BaseFunc.md).`AdvancePropertyManager`

## Indexable

> \[`name`: `string`\]: `any`

Any additional property a tool carries: custom state, plugin data, or extra metadata.

## Constructors

### Constructor

> **new ToolFunc**(`name`, `options?`, `config?`): `ToolFunc`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1539](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1539)

Initializes a new `ToolFunc` instance.

If a named function is provided as the first argument (or in `options.func`),
and no name is explicitly provided, the instance will automatically inherit the function's name.

#### Parameters

##### name

`string` \| `Function` \| [`FuncItem`](../interfaces/FuncItem.md)

Can be a function name, a function implementation, or a configuration object.

##### options?

`any` = `{}`

Configuration options if not provided in the first argument.
  Can also be a function-expression string (e.g. `'(a, b) => a + b'`) for the `(name, funcString)` form.
  An internal `_stack` property (a `Set`, used for cycle detection during registration) is
  consumed and removed here so it never becomes instance state.

##### config?

`any`

Optional config object, only used with the `(name, funcString, config)` form.

#### Returns

`ToolFunc`

#### Inherited from

`BaseFunc.constructor`

## Properties

### \_registry?

> `optional` **\_registry?**: *typeof* `ToolFunc`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:676](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L676)

**`Internal`**

The registry class where this tool was originally registered.

***

### $attributes

> **$attributes**: `Properties`

Defined in: property-manager.js/lib/index.d.ts:89

***

### alias?

> `optional` **alias?**: `string` \| `string`[]

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:334](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L334)

Optional aliases for the function name.

#### Inherited from

[`BaseFunc`](../interfaces/BaseFunc.md).[`alias`](../interfaces/BaseFunc.md#alias)

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

#### Inherited from

[`BaseFunc`](../interfaces/BaseFunc.md).[`asyncFeatures`](../interfaces/BaseFunc.md#asyncfeatures)

***

### constructor

> **constructor**: `Function`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:125

The initial value of Object.prototype.constructor is the standard built-in Object constructor.

***

### ctx?

> `optional` **ctx?**: [`ToolFuncContext`](../interfaces/ToolFuncContext.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:764](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L764)

The execution context for the current function call.
Only available when isolated execution is enabled.

***

### defaultOptions

> **defaultOptions**: `object`

Defined in: property-manager.js/lib/abstract.d-BOda6\_iP.d.ts:74

The default options for export and assign

#### assign?

> `optional` **assign?**: `IMergeOptions`

#### export?

> `optional` **export?**: `IMergeOptions`

***

### depends?

> `optional` **depends?**: `object`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:377](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L377)

A map of dependencies this function has on other tool functions.
Declaring dependencies ensures that they are automatically registered when this function is registered.
This is crucial for building modular functions that rely on each other without needing to manage registration order manually.

#### Index Signature

\[`name`: `string`\]: `ToolFunc`

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

#### Inherited from

[`BaseFunc`](../interfaces/BaseFunc.md).[`depends`](../interfaces/BaseFunc.md#depends)

***

### description?

> `optional` **description?**: `string`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:383](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L383)

A detailed description of what the function does.

#### Inherited from

[`BaseFunc`](../interfaces/BaseFunc.md).[`description`](../interfaces/BaseFunc.md#description)

***

### isApi?

> `optional` **isApi?**: `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:321](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L321)

If true, indicates that this function should be treated as a server-side API.

#### Inherited from

[`BaseFunc`](../interfaces/BaseFunc.md).[`isApi`](../interfaces/BaseFunc.md#isapi)

***

### name?

> `optional` **name?**: `string`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:165](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L165)

The unique name of the function.

#### Inherited from

[`BaseFunc`](../interfaces/BaseFunc.md).[`name`](../interfaces/BaseFunc.md#name)

***

### nonExported1stChar

> **nonExported1stChar**: `string`

Defined in: property-manager.js/lib/abstract.d-BOda6\_iP.d.ts:78

the property with the default prefix '$' will not be exported.

***

### params?

> `optional` **params?**: [`FuncParams`](../interfaces/FuncParams.md) \| [`FuncParam`](../interfaces/FuncParam.md)[]

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:171](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L171)

Parameter definitions, which can be an object mapping names to definitions or an array for positional parameters.

#### Inherited from

[`BaseFunc`](../interfaces/BaseFunc.md).[`params`](../interfaces/BaseFunc.md#params)

***

### result?

> `optional` **result?**: `string` \| `Record`\<`string`, `any`\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:177](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L177)

The expected return type of the function, described as a string or a JSON schema object.

#### Inherited from

[`BaseFunc`](../interfaces/BaseFunc.md).[`result`](../interfaces/BaseFunc.md#result)

***

### scope?

> `optional` **scope?**: `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:196](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L196)

The execution scope or context (`this`) for the function.

Its keys become closure variables of the func, and a `this` key becomes the func's `this`.
Because those bindings are captured while compiling, the scope is read at compile time:

- a string [FuncItem.func](../interfaces/FuncItem.md#func) is always compiled against it;
- a *function* value is compiled from its own source when a non-empty scope is declared — a
  source that is not a function expression (method shorthand, a class method, native code) is
  used as-is instead, since it has no standalone source to compile;
- an empty or absent scope leaves a function value untouched, so its lexical closure survives.

A [BaseFuncItem.setup](../interfaces/BaseFuncItem.md#setup) hook may provide the scope too: it is applied *before* the func is
compiled (see the lifecycle ability).

#### Inherited from

[`BaseFunc`](../interfaces/BaseFunc.md).[`scope`](../interfaces/BaseFunc.md#scope)

***

### stream?

> `optional` **stream?**: `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:328](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L328)

If true, indicates that the function has the *capability* to stream its output.
Whether a specific call is streamed is determined by a `stream` property in the runtime parameters.

#### Inherited from

[`BaseFunc`](../interfaces/BaseFunc.md).[`stream`](../interfaces/BaseFunc.md#stream)

***

### tags?

> `optional` **tags?**: `string` \| `string`[]

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:202](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L202)

Tags for grouping or filtering functions.

#### Inherited from

[`BaseFunc`](../interfaces/BaseFunc.md).[`tags`](../interfaces/BaseFunc.md#tags)

***

### title?

> `optional` **title?**: `string`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:389](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L389)

A concise, human-readable title for the function, often used in UI or by AI.

#### Inherited from

[`BaseFunc`](../interfaces/BaseFunc.md).[`title`](../interfaces/BaseFunc.md#title)

***

### \_refCounts

> `protected` `static` **\_refCounts**: `object` = `{}`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:670](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L670)

**`Internal`**

Tracks the number of active registration holds on each function name.
A function is truly removed only when its reference count drops to zero.

#### Index Signature

\[`name`: `string`\]: `number`

***

### aliases

> `static` **aliases**: `object` = `{}`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:663](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L663)

A static map of aliases to their corresponding primary function names.

#### Index Signature

\[`name`: `string`\]: `string`

***

### ctx?

> `static` `optional` **ctx?**: [`ToolFuncContext`](../interfaces/ToolFuncContext.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:692](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L692)

The static execution context for proxy classes created via ToolFunc.with().

***

### dataPath

> `static` **dataPath**: `string`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:685](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L685)

A conventional property to designate a file path for saving the registered `ToolFunc` data.
Note: The `ToolFunc` class itself does not implement persistence logic. It is up to the
developer to use this path to save and load the `ToolFunc.items` registry if needed.

***

### items

> `static` **items**: [`Funcs`](../interfaces/Funcs.md) = `{}`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:656](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L656)

A static registry of all `ToolFunc` implementations, indexed by their primary name.

## Methods

### \_prepareContext()

> `protected` **\_prepareContext**(`params?`, `ctx?`): [`ToolFuncContext`](../interfaces/ToolFuncContext.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1680](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1680)

**`Internal`**

Creates the final execution context (`this.ctx`) for a Shadow Instance.

NOTE: We MUST use 'this._prepareContext' (instance path) instead of
'Static._prepareContext' to allow AOP plugins (like CancelableAbility)
to hook into context preparation via method overloading ($_prepareContext).

#### Parameters

##### params?

`any`

##### ctx?

[`ToolFuncContext`](../interfaces/ToolFuncContext.md)

#### Returns

[`ToolFuncContext`](../interfaces/ToolFuncContext.md)

***

### \_resolveAs()

> `protected` **\_resolveAs**(`name`, `params?`, `ctx?`): `object`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1791](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1791)

**`Internal`**

Resolves a dependency by name into the concrete instance and execution context to call.

This is the shared resolution half of `runAs`/`runAsSync`: both need the same hierarchical
lookup and the same binding strategy, they only differ in which entry point of the resolved
tool they hand the call to (`run` vs `runSync`).

#### Parameters

##### name

`string`

The name or alias of the target function.

##### params?

`any`

Optional parameters to pass to the target function.

##### ctx?

[`ToolFuncContext`](../interfaces/ToolFuncContext.md)

The execution context.

#### Returns

`object`

The resolved instance and context.

##### context

> **context**: [`ToolFuncContext`](../interfaces/ToolFuncContext.md)

##### func

> **func**: `ToolFunc`

#### Throws

`NotFoundError` If the target function cannot be found in the current lineage.

***

### \_shouldIsolate()

> `protected` **\_shouldIsolate**(`params?`, `ctx?`): `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1662](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1662)

**`Internal`**

Determines if the function execution should be isolated into a "Shadow Instance".
Isolation creates a lightweight clone of the current tool to provide a unique `this.ctx`
for the duration of the call, preventing property collisions in concurrent environments.

When the `makeToolFuncLifecycle` ability has been installed, this gate also keeps `runSync`/
`runWithPosSync` out of a tool that is still *pending* across stacks (async `setup` in flight)
and refuses a strictly-paired tool (one with a `dispose` hook) that has not been `register()`ed.

#### Parameters

##### params?

`any`

The runtime parameters for the function call.

##### ctx?

[`ToolFuncContext`](../interfaces/ToolFuncContext.md)

The optional execution context provided by the user for this specific call (e.g., via `runSync(params, ctx)`).

#### Returns

`boolean`

`true` if a shadow instance should be created, otherwise `false`.

***

### arr2ObjParams()

> **arr2ObjParams**(`params`): `any`[]

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1614](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1614)

Converts an array of positional arguments into a named parameters object.
This is used internally to support functions defined with named parameters.

#### Parameters

##### params

`any`[]

An array of positional arguments.

#### Returns

`any`[]

An array containing a single parameters object.

***

### assign()

> **assign**(`src`, `options?`): `this`

Defined in: property-manager.js/lib/abstract.d-BOda6\_iP.d.ts:106

Assign the values from the src object.

#### Parameters

##### src

`any`

the source object

##### options?

`IMergeOptions`

#### Returns

`this`

this object

***

### assignProperty()

> **assignProperty**(`src`, `name`, `value`, `attrs?`, `options?`): `void`

Defined in: property-manager.js/lib/abstract.d-BOda6\_iP.d.ts:117

Assign a property of src to this object.

#### Parameters

##### src

`any`

the src object

##### name

`string`

the property name to assign

##### value

`any`

the property value to assign

##### attrs?

`any`

the attributes object

##### options?

`IMergeOptions`

#### Returns

`void`

***

### assignPropertyTo()

> `abstract` **assignPropertyTo**(`dest`, `src`, `name`, `value`, `attrs?`, `options?`): `void`

Defined in: property-manager.js/lib/abstract.d-BOda6\_iP.d.ts:131

Assign the property value from the src to destination object.

#### Parameters

##### dest

`any`

The destination object

##### src

`any`

The src object

##### name

`string`

The property name

##### value

`any`

The property value

##### attrs?

`any`

The attributes object of the property

##### options?

`IMergeOptions`

#### Returns

`void`

***

### assignTo()

> **assignTo**(`dest?`, `options?`): `any`

Defined in: property-manager.js/lib/abstract.d-BOda6\_iP.d.ts:191

Assign this attributes to the dest object

#### Parameters

##### dest?

`any`

the destination object

##### options?

`IMergeOptions`

#### Returns

`any`

the dest object

***

### cleanup()?

> `optional` **cleanup**(`this`): `void` \| `Promise`\<`void`\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:315](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L315)

A lifecycle hook called once at the **end of every call**, releasing whatever *that call*
acquired. It is the call-scoped twin of [BaseFuncItem.dispose](../interfaces/BaseFuncItem.md#dispose): while `dispose` is tied to
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

NOTE: like [BaseFuncItem.setup](../interfaces/BaseFuncItem.md#setup) and [BaseFuncItem.dispose](../interfaces/BaseFuncItem.md#dispose), this hook is only invoked
by the `makeToolFuncLifecycle` ability. Install it once, on the registry class you actually use:
`const Tools = makeToolFuncLifecycle(ToolFunc)`.

#### Parameters

##### this

`ToolFunc`

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

#### Inherited from

[`BaseFunc`](../interfaces/BaseFunc.md).[`cleanup`](../interfaces/BaseFunc.md#cleanup)

***

### clone()

> **clone**(`options?`): `any`

Defined in: property-manager.js/lib/abstract.d-BOda6\_iP.d.ts:155

Create a new object with the same values of attributes.

#### Parameters

##### options?

`IMergeOptions`

#### Returns

`any`

the new object

***

### cloneTo()

> **cloneTo**(`dest`, `options?`): `any`

Defined in: property-manager.js/lib/abstract.d-BOda6\_iP.d.ts:148

Create and assign the values to the destination object.

#### Parameters

##### dest

`any`

the destination object

##### options?

`IMergeOptions`

#### Returns

`any`

the new dest object

***

### defineProperties()

> `abstract` **defineProperties**(`aProperties`): `any`

Defined in: property-manager.js/lib/abstract.d-BOda6\_iP.d.ts:89

Define the attributes of this object.

#### Parameters

##### aProperties

`SimplePropDescriptors`

the defined attributes of the object

#### Returns

`any`

***

### dispose()?

> `optional` **dispose**(`this`): `void` \| `Promise`\<`void`\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:276](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L276)

A lifecycle hook called once when the `ToolFunc` instance is **removed from the registry**,
i.e. when the reference count drops to zero or when `unregister` is forced. It is the exact
inverse of [BaseFuncItem.setup](../interfaces/BaseFuncItem.md#setup): releasing whatever `setup` acquired (connections,
logins, timers, subscriptions...).

The hook may return a `Promise`. Because the synchronous `unregister()` cannot await it, the
returned promise is tracked and its rejection is logged rather than thrown. Use
`unregisterAsync()` to await the teardown and observe the real error.

After a successful `dispose`, the instance is re-armed: registering it again re-runs `setup`.

NOTE: like [BaseFuncItem.setup](../interfaces/BaseFuncItem.md#setup), this hook is only invoked by the `makeToolFuncLifecycle`
ability. Install it once, on the registry class you actually use:
`const Tools = makeToolFuncLifecycle(ToolFunc)`.

#### Parameters

##### this

`ToolFunc`

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

#### Inherited from

[`BaseFunc`](../interfaces/BaseFunc.md).[`dispose`](../interfaces/BaseFunc.md#dispose)

***

### exportTo()

> **exportTo**(`dest`, `options?`): `any`

Defined in: property-manager.js/lib/abstract.d-BOda6\_iP.d.ts:173

Export attributes to the dest json object.

#### Parameters

##### dest

`any`

the destination object

##### options?

`IExportOptions`

#### Returns

`any`

the dest object.

***

### func()

> **func**(...`params`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:464](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L464)

The actual function implementation.

#### Parameters

##### params

...`any`[]

The parameters for the function.

#### Returns

`any`

The result of the function.

#### Inherited from

[`BaseFunc`](../interfaces/BaseFunc.md).[`func`](../interfaces/BaseFunc.md#func)

***

### getFunc()

> **getFunc**(`name?`): `Function` \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1845](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1845)

Gets a bound function reference for execution with named parameters.
If a name is provided, it retrieves a different function from the registry.
Otherwise, it returns a bound version of this instance's `runSync`.

#### Parameters

##### name?

`string`

Optional name of the function to retrieve.

#### Returns

`Function` \| `undefined`

A function reference or `undefined` if not found.

***

### getFuncWithPos()

> **getFuncWithPos**(`name?`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1928](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1928)

Gets a bound function reference suitable for positional argument execution.
If a name is provided, it retrieves a different function from the registry.
Otherwise, it returns a bound version of this instance's `runWithPosSync`.

#### Parameters

##### name?

`string`

Optional name of the function to retrieve.

#### Returns

`any`

A function reference or `undefined` if not found.

***

### getProperties()

> `abstract` **getProperties**(): `PropDescriptors`

Defined in: property-manager.js/lib/abstract.d-BOda6\_iP.d.ts:98

Get the defined attributes.

#### Returns

`PropDescriptors`

the descriptors of properties object

***

### hasAsyncFeature()

> **hasAsyncFeature**(`feature`): `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1940](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1940)

Checks if the current function instance supports a specific async feature.

#### Parameters

##### feature

[`AsyncFeatureBits`](../enumerations/AsyncFeatureBits.md)

The async feature bit to check for.

#### Returns

`boolean`

`true` if the feature is supported, otherwise `false`.

***

### hasOwnProperty()

> **hasOwnProperty**(`v`): `boolean`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:140

Determines whether an object has a property with the specified name.

#### Parameters

##### v

`PropertyKey`

A property name.

#### Returns

`boolean`

***

### initialize()

> **initialize**(`src?`): `this`

Defined in: property-manager.js/lib/abstract.d-BOda6\_iP.d.ts:139

Initialize object and assign attribute values from src if src exists.

#### Parameters

##### src?

`any`

#### Returns

`this`

this object.

***

### isPrototypeOf()

> **isPrototypeOf**(`v`): `boolean`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:146

Determines whether an object exists in another object's prototype chain.

#### Parameters

##### v

`Object`

Another object whose prototype chain is to be checked.

#### Returns

`boolean`

***

### isSame()

> **isSame**(`src`, `options?`): `boolean`

Defined in: property-manager.js/lib/abstract.d-BOda6\_iP.d.ts:200

Check the src object whether “equals” this object.

#### Parameters

##### src

`any`

The source object

##### options?

`IMergeOptions`

#### Returns

`boolean`

***

### isStream()

> **isStream**(`params`): `boolean` \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1960](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1960)

Determines if a function call should produce a stream.

The logic is as follows:
1. It first checks if the function is generally capable of streaming (`this.stream`).
2. If it is, it then checks if a `stream` parameter is formally declared in the function's `params` definition.
3. If both are true, the method returns the value of the `stream` property from the runtime `params` object.
Otherwise, it returns the function's static `stream` capability.

#### Parameters

##### params

`any`

The runtime parameters passed to the function call.

#### Returns

`boolean` \| `undefined`

`true` if the call should be streamed, `false` or `undefined` otherwise.

***

### mergeTo()

> **mergeTo**(`dest`, `options?`): `any`

Defined in: property-manager.js/lib/abstract.d-BOda6\_iP.d.ts:164

Merge this attributes to dest object.

#### Parameters

##### dest

`any`

The destination object

##### options?

`IMergeOptions`

#### Returns

`any`

the dest object.

***

### obj2ArrParams()

> **obj2ArrParams**(`params?`): `any`[]

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1635](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1635)

Converts a named parameters object into an array of positional arguments.
This is used for functions defined with positional parameters.

#### Parameters

##### params?

`any`

A named parameters object.

#### Returns

`any`[]

An array of positional arguments.

***

### propertyIsEnumerable()

> **propertyIsEnumerable**(`v`): `boolean`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:152

Determines whether a specified property is enumerable.

#### Parameters

##### v

`PropertyKey`

A property name.

#### Returns

`boolean`

***

### register()

> **register**(): `boolean` \| `ToolFunc`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1590](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1590)

Registers the current `ToolFunc` instance into the static registry.
Also registers any declared dependencies.

#### Returns

`boolean` \| `ToolFunc`

The instance itself upon successful registration, or `false` if it already exists.

***

### run()

> **run**(`params?`, `ctx?`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1725](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1725)

Executes the function asynchronously with a named parameters object.

Note: This method returns a `Promise` if the underlying function is asynchronous,
otherwise it may return the result synchronously.

#### Parameters

##### params?

`any`

The parameters object for the function.

##### ctx?

[`ToolFuncContext`](../interfaces/ToolFuncContext.md)

The execution context.

#### Returns

`any`

A promise or the direct result of the function's execution.

***

### runAs()

> **runAs**(`name`, `params?`, `ctx?`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1742](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1742)

Asynchronously executes another registered function by name.

Note: This method returns a `Promise` if the underlying function is asynchronous,
otherwise it may return the result synchronously.

#### Parameters

##### name

`string`

The name of the target function to run.

##### params?

`any`

Optional parameters to pass to the function.

##### ctx?

[`ToolFuncContext`](../interfaces/ToolFuncContext.md)

The execution context.

#### Returns

`any`

A promise or the direct result of the function's execution.

***

### runAsSync()

> **runAsSync**(`name`, `params?`, `ctx?`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1772](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1772)

Executes another registered function by name, using hierarchical dependency resolution.

This method supports **Late-Binding Polymorphism**. It uses the `rootRegistry` and
`binding` strategy from the execution context to resolve dependencies.

### Binding Modes:
- `'auto'` (Default): **Lineage-Aware**. Uses late-binding only if the `rootRegistry`
  is a descendant of the tool's definition registry and has shadowed the dependency.
  Otherwise, uses early-binding for stability.
- `'early'`: **Safety First**. Always prefers the pre-bound instance from `depends`.
- `'late'`: **Forced Polymorphism**. Always resolves from the `rootRegistry`,
  ignoring the definer's environment.

#### Parameters

##### name

`string`

The name or alias of the target function to run.

##### params?

`any`

Optional parameters to pass to the target function.

##### ctx?

[`ToolFuncContext`](../interfaces/ToolFuncContext.md)

The execution context.

#### Returns

`any`

The result of the target function execution.

#### Throws

`NotFoundError` If the target function cannot be found in the current lineage.

***

### runSync()

> **runSync**(`params?`, `ctx?`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1693](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1693)

Executes the function synchronously with a named parameters object.

#### Parameters

##### params?

`any`

The parameters object for the function.

##### ctx?

[`ToolFuncContext`](../interfaces/ToolFuncContext.md)

The execution context.

#### Returns

`any`

The result of the function execution.

#### Throws

Will throw an error if an array of parameters is passed to a function that expects an object.

***

### runWithPos()

> **runWithPos**(...`params`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1899](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1899)

Executes the function asynchronously using positional arguments.

Note: This method returns a `Promise` if the underlying function is asynchronous,
otherwise it may return the result synchronously.

#### Parameters

##### params

...`any`[]

Positional arguments passed to the function.

#### Returns

`any`

A promise or the direct result of the function's execution.

***

### runWithPosAs()

> **runWithPosAs**(`name`, ...`params`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1915](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1915)

Asynchronously executes another function by name using positional arguments.

Note: This method returns a `Promise` if the underlying function is asynchronous,
otherwise it may return the result synchronously.

#### Parameters

##### name

`string`

The name of the target function to run.

##### params

...`any`[]

Positional arguments to pass to the function.

#### Returns

`any`

A promise or the direct result of the function's execution.

***

### runWithPosAsSync()

> **runWithPosAsSync**(`name`, ...`params`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1880](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1880)

Synchronously executes another function by name using positional arguments.
This is a convenience wrapper around the static `runWithPosSync()` method.

#### Parameters

##### name

`string`

The name of the target function to run.

##### params

...`any`[]

Positional arguments to pass to the function.

#### Returns

`any`

The result of the function execution.

***

### runWithPosSync()

> **runWithPosSync**(...`params`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1858](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1858)

Executes the function synchronously using positional arguments.
If the function expects named parameters, it converts the arguments automatically.

#### Parameters

##### params

...`any`[]

Positional arguments passed to the function.

#### Returns

`any`

The result of the function execution.

***

### setup()?

> `optional` **setup**(`this`, `options?`): `void` \| `Promise`\<`void`\>

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:244](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L244)

A lifecycle hook called once when the `ToolFunc` instance is **registered**, and again after
it has been `dispose`d and re-registered. It is the exact inverse of [BaseFuncItem.dispose](../interfaces/BaseFuncItem.md#dispose).

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
[BaseFuncItem.scope](../interfaces/BaseFuncItem.md#scope)).

#### Parameters

##### this

`ToolFunc`

The `ToolFunc` instance the hook is bound to.

##### options?

[`FuncItem`](../interfaces/FuncItem.md)

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

#### Inherited from

[`BaseFunc`](../interfaces/BaseFunc.md).[`setup`](../interfaces/BaseFunc.md#setup)

***

### toJSON()

> **toJSON**(): `any`

Defined in: property-manager.js/lib/abstract.d-BOda6\_iP.d.ts:182

#### Returns

`any`

***

### toLocaleString()

> **toLocaleString**(): `string`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:131

Returns a date converted to a string using the current locale.

#### Returns

`string`

***

### toObject()

> **toObject**(`options?`): `any`

Defined in: property-manager.js/lib/abstract.d-BOda6\_iP.d.ts:181

Convert the attributes to the json object

#### Parameters

##### options?

`any`

#### Returns

`any`

the json object.

***

### toString()

> **toString**(): `string`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:128

Returns a string representation of an object.

#### Returns

`string`

***

### unregister()

> **unregister**(`options?`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1602](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1602)

Removes the current `ToolFunc` instance from the static registry.

#### Parameters

##### options?

`boolean` \| [`UnregisterOptions`](../interfaces/UnregisterOptions.md)

Unregistration options or a boolean force flag.

#### Returns

`any`

The instance that was unregistered.

***

### valueOf()

> **valueOf**(): `Object`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:134

Returns the primitive value of the specified object.

#### Returns

`Object`

***

### with()

> **with**(`ctx`): `this`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:752](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L752)

Returns an isolated instance with the provided context.

#### Parameters

##### ctx

[`ToolFuncContext`](../interfaces/ToolFuncContext.md)

The context to use.

#### Returns

`this`

An isolated ToolFunc instance.

***

### \_acquireDependencies()

> `protected` `static` **\_acquireDependencies**(`inst`, `stack?`): `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1455](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1455)

#### Parameters

##### inst

`ToolFunc`

##### stack?

`Set`\<`string`\>

#### Returns

`void`

***

### \_decRefCount()

> `protected` `static` **\_decRefCount**(`name`): `number`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1444](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1444)

#### Parameters

##### name

`string`

#### Returns

`number`

***

### \_dependencyReleaseOrder()

> `protected` `static` **\_dependencyReleaseOrder**(`inst`): `ToolFunc`[]

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1496](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1496)

**`Internal`**

The dependencies of `inst`, in the order they must be released: **reverse declaration order**.

A dependency is acquired — and therefore declared — before the tools that use it, and it must
be released after them. Reversing the acquisition order is the one convention that keeps both
directions correct: declare a dependency before the tool that uses it, and every dependency
outlives everything that depends on it. Declaration order is also the acquisition order, so a
single convention covers both ends of the lifetime.

#### Parameters

##### inst

`ToolFunc`

#### Returns

`ToolFunc`[]

***

### \_extractStack()

> `protected` `static` **\_extractStack**(`options`): `Set`\<`string`\> \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1147](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1147)

**`Internal`**

Consumes the internal cycle-detection stack from a normalized options object.

The stack (a `Set`) is a registration-call-scoped value carried internally via the
'_stack' property (used by recursive dependency registration). It is extracted and
removed so it never reaches instance state or serialization.

#### Parameters

##### options

`any`

The normalized options object (may be a ToolFunc instance).

#### Returns

`Set`\<`string`\> \| `undefined`

The extracted stack, if any.

***

### \_getRegistrationAction()

> `protected` `static` **\_getRegistrationAction**(`name`, `override`): `"replace"` \| `"create"` \| `"shadow"` \| `"increment"`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1113](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1113)

**`Internal`**

Analyzes the registration context and determines the appropriate action.

#### Parameters

##### name

`string`

The function name to register.

##### override

Override options.

###### name?

`boolean`

#### Returns

`"replace"` \| `"create"` \| `"shadow"` \| `"increment"`

The determined registration action.

***

### \_incRefCount()

> `protected` `static` **\_incRefCount**(`name`): `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1438](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1438)

#### Parameters

##### name

`string`

#### Returns

`void`

***

### \_isStillHeld()

> `protected` `static` **\_isStillHeld**(`name`): `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1474](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1474)

**`Internal`**

Whether any tool currently registered in this layer names `name` in its `depends`.

Only *live* tools are considered, so a dependency owned by a parent layer never keeps a
locally-owned tool waiting — that tool's removal releases its own hold and stops there.

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

### \_normalizeArguments()

> `protected` `static` **\_normalizeArguments**(`name`, `options?`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:980](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L980)

**`Internal`**

Internal helper to normalize arguments from various input patterns.
Priority: name (arg1) \> options (arg2).

#### Parameters

##### name

`string` \| `Function` \| `ToolFunc` \| [`FuncItem`](../interfaces/FuncItem.md)

Primary config.

##### options?

`any`

Default config.

#### Returns

`any`

Normalized options object.

***

### \_normalizeRegisterArguments()

> `protected` `static` **\_normalizeRegisterArguments**(`name`, `options?`): [`RegisterOptions`](../interfaces/RegisterOptions.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1164](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1164)

**`Internal`**

Normalizes the arguments passed to the `register` method into a unified `RegisterOptions` object.

#### Parameters

##### name

`string` \| `Function` \| `ToolFunc` \| [`RegisterOptions`](../interfaces/RegisterOptions.md)

The primary identification or implementation.

##### options?

[`RegisterOptions`](../interfaces/RegisterOptions.md)

Additional or overriding configuration.

#### Returns

[`RegisterOptions`](../interfaces/RegisterOptions.md)

A normalized options object ready for registration.

***

### \_prepareContext()

> `static` **\_prepareContext**(`parentCtx?`, `ctx?`): [`ToolFuncContext`](../interfaces/ToolFuncContext.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:727](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L727)

**`Internal`**

Internal helper to prepare the execution context, maintaining the prototype chain.

#### Parameters

##### parentCtx?

[`ToolFuncContext`](../interfaces/ToolFuncContext.md)

The parent context to inherit from.

##### ctx?

[`ToolFuncContext`](../interfaces/ToolFuncContext.md)

The new context properties to apply.

#### Returns

[`ToolFuncContext`](../interfaces/ToolFuncContext.md)

The merged context.

DANGER - DO NOT "OPTIMIZE" UNLESS YOU UNDERSTAND:
1. Why NOT Object.assign(target, ctx) alone?
   Object.assign only copies 'own' properties. In nested calls (e.g., .with().with()),
   parent properties exist on the prototype. Using assign would drop all inherited
   context data (like traceId from a parent runner).
2. Why NOT Object.setPrototypeOf?
   It's a heavy performance killer in V8. We use Object.create(proto) instead.
3. Why check isPrototypeOf?
   If ctx is already in the chain, we return it to maintain identity and avoid
   redundant shadow layers, which is required by many AOP plugins and unit tests.

***

### \_releaseDependencies()

> `protected` `static` **\_releaseDependencies**(`inst`): `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1504](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1504)

#### Parameters

##### inst

`ToolFunc`

#### Returns

`void`

***

### \_releaseInstance()

> `protected` `static` **\_releaseInstance**(`inst`): `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1520](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1520)

**`Internal`**

Finalizes an instance that has just been physically removed from this layer.

The instance's own teardown comes **before** its dependencies are released: a dependency must
outlive everything that uses it, so a dependent's `dispose` still finds a live dependency to
give back what its `setup` took. The lifecycle ability overrides this to drive the `dispose`
hook — and to wait for an asynchronous teardown — between the two steps.

#### Parameters

##### inst

`ToolFunc`

#### Returns

`void`

***

### assign()

#### Call Signature

> `static` **assign**\<`T`, `U`\>(`target`, `source`): `T` & `U`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2015.core.d.ts:286

Copy the values of all of the enumerable own properties from one or more source objects to a
target object. Returns the target object.

##### Type Parameters

###### T

`T` *extends* `object`

###### U

`U`

##### Parameters

###### target

`T`

The target object to copy to.

###### source

`U`

The source object from which to copy properties.

##### Returns

`T` & `U`

#### Call Signature

> `static` **assign**\<`T`, `U`, `V`\>(`target`, `source1`, `source2`): `T` & `U` & `V`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2015.core.d.ts:295

Copy the values of all of the enumerable own properties from one or more source objects to a
target object. Returns the target object.

##### Type Parameters

###### T

`T` *extends* `object`

###### U

`U`

###### V

`V`

##### Parameters

###### target

`T`

The target object to copy to.

###### source1

`U`

The first source object from which to copy properties.

###### source2

`V`

The second source object from which to copy properties.

##### Returns

`T` & `U` & `V`

#### Call Signature

> `static` **assign**\<`T`, `U`, `V`, `W`\>(`target`, `source1`, `source2`, `source3`): `T` & `U` & `V` & `W`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2015.core.d.ts:305

Copy the values of all of the enumerable own properties from one or more source objects to a
target object. Returns the target object.

##### Type Parameters

###### T

`T` *extends* `object`

###### U

`U`

###### V

`V`

###### W

`W`

##### Parameters

###### target

`T`

The target object to copy to.

###### source1

`U`

The first source object from which to copy properties.

###### source2

`V`

The second source object from which to copy properties.

###### source3

`W`

The third source object from which to copy properties.

##### Returns

`T` & `U` & `V` & `W`

#### Call Signature

> `static` **assign**(`target`, ...`sources`): `any`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2015.core.d.ts:313

Copy the values of all of the enumerable own properties from one or more source objects to a
target object. Returns the target object.

##### Parameters

###### target

`object`

The target object to copy to.

###### sources

...`any`[]

One or more source objects from which to copy properties

##### Returns

`any`

***

### clear()

> `static` **clear**(): `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1064](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1064)

Resets the local registry by clearing all registered items, aliases, and reference counts.

In a hierarchical registry, this only clears properties "owned" by the current
layer. Inherited items from parent registries remain visible through the prototype chain.

Every tool this layer owns is released first, so its lifecycle actually runs: the tool — and
the dependencies it solely holds — gives back whatever `setup` acquired. Swapping the tables
alone would silently leak every one of them.

Like `unregister()`, teardown is only *initiated*, never awaited: an asynchronous `dispose`
cannot be waited for here, and since a dependency's release is chained behind its holder's, an
asynchronous teardown is still in flight while the next tool goes down. Use `clearAsync()`
(installed by the lifecycle ability) when the layer may hold asynchronous teardown.

#### Returns

`void`

***

### create()

#### Call Signature

> `static` **create**(`o`): `any`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:188

Creates an object that has the specified prototype or that has null prototype.

##### Parameters

###### o

`object` \| `null`

Object to use as a prototype. May be null.

##### Returns

`any`

#### Call Signature

> `static` **create**(`o`, `properties`): `any`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:195

Creates an object that has the specified prototype, and that optionally contains specified properties.

##### Parameters

###### o

`object` \| `null`

Object to use as a prototype. May be null

###### properties

`PropertyDescriptorMap` & `ThisType`\<`any`\>

JavaScript object that contains one or more property descriptors.

##### Returns

`any`

***

### defineProperties()

> `static` **defineProperties**(`aTarget`, `aProperties`, `recreate?`): `any`

Defined in: property-manager.js/lib/index.d.ts:95

Adds one or more properties to an object, and/or modifies attributes of existing properties.

#### Parameters

##### aTarget

`any`

##### aProperties

`PropDescriptors`

##### recreate?

`boolean`

#### Returns

`any`

***

### defineProperty()

> `static` **defineProperty**\<`T`\>(`o`, `p`, `attributes`): `T`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:203

Adds a property to an object, or modifies attributes of an existing property.

#### Type Parameters

##### T

`T`

#### Parameters

##### o

`T`

Object on which to add or modify the property. This can be a native JavaScript object (that is, a user-defined object or a built in object) or a DOM object.

##### p

`PropertyKey`

The property name.

##### attributes

`PropertyDescriptor` & `ThisType`\<`any`\>

Descriptor for the property. It can be for a data property or an accessor property.

#### Returns

`T`

***

### entries()

#### Call Signature

> `static` **entries**\<`T`\>(`o`): \[`string`, `T`\][]

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2017.object.d.ts:36

Returns an array of key/values of the enumerable own properties of an object

##### Type Parameters

###### T

`T`

##### Parameters

###### o

\{\[`s`: `string`\]: `T`; \} \| `ArrayLike`\<`T`\>

Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.

##### Returns

\[`string`, `T`\][]

#### Call Signature

> `static` **entries**(`o`): \[`string`, `any`\][]

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2017.object.d.ts:42

Returns an array of key/values of the enumerable own properties of an object

##### Parameters

###### o

Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.

##### Returns

\[`string`, `any`\][]

***

### freeze()

#### Call Signature

> `static` **freeze**\<`T`\>(`f`): `T`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:222

Prevents the modification of existing property attributes and values, and prevents the addition of new properties.

##### Type Parameters

###### T

`T` *extends* `Function`

##### Parameters

###### f

`T`

Object on which to lock the attributes.

##### Returns

`T`

#### Call Signature

> `static` **freeze**\<`T`, `U`\>(`o`): `Readonly`\<`T`\>

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:228

Prevents the modification of existing property attributes and values, and prevents the addition of new properties.

##### Type Parameters

###### T

`T` *extends* `object`

###### U

`U` *extends* `string` \| `number` \| `bigint` \| `boolean` \| `symbol`

##### Parameters

###### o

`T`

Object on which to lock the attributes.

##### Returns

`Readonly`\<`T`\>

#### Call Signature

> `static` **freeze**\<`T`\>(`o`): `Readonly`\<`T`\>

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:234

Prevents the modification of existing property attributes and values, and prevents the addition of new properties.

##### Type Parameters

###### T

`T`

##### Parameters

###### o

`T`

Object on which to lock the attributes.

##### Returns

`Readonly`\<`T`\>

***

### fromEntries()

#### Call Signature

> `static` **fromEntries**\<`T`\>(`entries`): `object`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2019.object.d.ts:26

Returns an object created by key-value entries for properties and methods

##### Type Parameters

###### T

`T` = `any`

##### Parameters

###### entries

`Iterable`\<readonly \[`PropertyKey`, `T`\]\>

An iterable object that contains key-value entries for properties and methods.

##### Returns

`object`

#### Call Signature

> `static` **fromEntries**(`entries`): `any`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2019.object.d.ts:32

Returns an object created by key-value entries for properties and methods

##### Parameters

###### entries

`Iterable`\<readonly `any`[]\>

An iterable object that contains key-value entries for properties and methods.

##### Returns

`any`

***

### get()

> `static` **get**(`name`): `ToolFunc`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:773](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L773)

Retrieves a registered function by its name or alias.

#### Parameters

##### name

`string`

The name or alias of the function to retrieve.

#### Returns

`ToolFunc`

The `ToolFunc` instance if found, otherwise `undefined`.

***

### getAllByTag()

> `static` **getAllByTag**(`tagName`): `ToolFunc`[]

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:826](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L826)

Retrieves all registered functions that have a specific tag.

#### Parameters

##### tagName

`string`

The tag to search for.

#### Returns

`ToolFunc`[]

An array of matching `ToolFunc` instances.

***

### getByTag()

> `static` **getByTag**(`tagName`): `ToolFunc` \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:798](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L798)

Finds the first registered function that has a specific tag.

#### Parameters

##### tagName

`string`

The tag to search for.

#### Returns

`ToolFunc` \| `undefined`

The first matching `ToolFunc` instance, or `undefined` if none is found.

***

### getFunc()

> `static` **getFunc**(`name`): `Function` \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:913](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L913)

Retrieves a bound, runnable function reference for a registered function.
This reference is suitable for execution with an object of named parameters.

#### Parameters

##### name

`string`

The name of the function.

#### Returns

`Function` \| `undefined`

A bound function reference, or `undefined` if not found.

***

### getFuncWithPos()

> `static` **getFuncWithPos**(`name`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:966](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L966)

Retrieves a bound, runnable function reference for a registered function.
This reference is suitable for execution with positional arguments.

#### Parameters

##### name

`string`

The name of the function.

#### Returns

`any`

A bound function reference, or `undefined` if not found.

***

### getOwnPropertyDescriptor()

> `static` **getOwnPropertyDescriptor**(`o`, `p`): `PropertyDescriptor` \| `undefined`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:175

Gets the own property descriptor of the specified object.
An own property descriptor is one that is defined directly on the object and is not inherited from the object's prototype.

#### Parameters

##### o

`any`

Object that contains the property.

##### p

`PropertyKey`

Name of the property.

#### Returns

`PropertyDescriptor` \| `undefined`

***

### getOwnPropertyDescriptors()

> `static` **getOwnPropertyDescriptors**\<`T`\>(`o`): \{ \[P in string \| number \| symbol\]: TypedPropertyDescriptor\<T\[P\]\> \} & `object`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2017.object.d.ts:48

Returns an object containing all own property descriptors of an object

#### Type Parameters

##### T

`T`

#### Parameters

##### o

`T`

Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.

#### Returns

\{ \[P in string \| number \| symbol\]: TypedPropertyDescriptor\<T\[P\]\> \} & `object`

***

### getOwnPropertyNames()

> `static` **getOwnPropertyNames**(`o`): `string`[]

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:182

Returns the names of the own properties of an object. The own properties of an object are those that are defined directly
on that object, and are not inherited from the object's prototype. The properties of an object include both fields (objects) and functions.

#### Parameters

##### o

`any`

Object that contains the own properties.

#### Returns

`string`[]

***

### getOwnPropertySymbols()

> `static` **getOwnPropertySymbols**(`o`): `symbol`[]

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2015.core.d.ts:319

Returns an array of all symbol properties found directly on object o.

#### Parameters

##### o

`any`

Object to retrieve the symbols from.

#### Returns

`symbol`[]

***

### getProperties()

> `static` **getProperties**(): `PropDescriptors`

Defined in: property-manager.js/lib/index.d.ts:94

get all properties descriptor include inherited.

#### Returns

`PropDescriptors`

***

### getPrototypeOf()

> `static` **getPrototypeOf**(`o`): `any`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:167

Returns the prototype of an object.

#### Parameters

##### o

`any`

The object that references the prototype.

#### Returns

`any`

***

### hasAsyncFeature()

> `static` **hasAsyncFeature**(`feature`): `boolean`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:854](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L854)

Checks if any registered function has a specific asynchronous feature.

#### Parameters

##### feature

[`AsyncFeatureBits`](../enumerations/AsyncFeatureBits.md)

The async feature bit to check for.

#### Returns

`boolean`

`true` if the feature is present in any function, otherwise `false`.

***

### hasOwn()

> `static` **hasOwn**(`o`, `v`): `boolean`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2022.object.d.ts:25

Determines whether an object has a property with the specified name.

#### Parameters

##### o

`object`

An object.

##### v

`PropertyKey`

A property name.

#### Returns

`boolean`

***

### is()

> `static` **is**(`value1`, `value2`): `boolean`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2015.core.d.ts:332

Returns true if the values are the same value, false otherwise.

#### Parameters

##### value1

`any`

The first value.

##### value2

`any`

The second value.

#### Returns

`boolean`

***

### isExtensible()

> `static` **isExtensible**(`o`): `boolean`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:258

Returns a value that indicates whether new properties can be added to an object.

#### Parameters

##### o

`any`

Object to test.

#### Returns

`boolean`

***

### isFrozen()

> `static` **isFrozen**(`o`): `boolean`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:252

Returns true if existing property attributes and values cannot be modified in an object, and new properties cannot be added to the object.

#### Parameters

##### o

`any`

Object to test.

#### Returns

`boolean`

***

### isolateRegistry()

> `static` **isolateRegistry**(`options?`): `void`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1032](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1032)

Isolates the current registry layer by branching off its parent using prototype shadowing.

This creates a new "scope" where:
1. New registrations are stored only in the local layer, supporting tool shadowing.
2. Parent tools remain accessible via the prototype chain (read-only) unless shadowed.
3. Reference counting is isolated, enabling clean per-layer lifecycle management.

#### Parameters

##### options?

[`ToolFuncRegistryIsolateOptions`](../interfaces/ToolFuncRegistryIsolateOptions.md) = `...`

Options to selectively isolate specific maps (items, aliases, refCounts).

#### Returns

`void`

***

### isSealed()

> `static` **isSealed**(`o`): `boolean`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:246

Returns true if existing property attributes cannot be modified in an object and new properties cannot be added to the object.

#### Parameters

##### o

`any`

Object to test.

#### Returns

`boolean`

***

### keys()

#### Call Signature

> `static` **keys**(`o`): `string`[]

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:264

Returns the names of the enumerable string properties and methods of an object.

##### Parameters

###### o

`object`

Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.

##### Returns

`string`[]

#### Call Signature

> `static` **keys**(`o`): `string`[]

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2015.core.d.ts:325

Returns the names of the enumerable string properties and methods of an object.

##### Parameters

###### o

Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.

##### Returns

`string`[]

***

### list()

> `static` **list**(): [`Funcs`](../interfaces/Funcs.md)

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:787](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L787)

Returns the complete map of all registered functions.

#### Returns

[`Funcs`](../interfaces/Funcs.md)

The map of `ToolFunc` instances.

***

### preventExtensions()

> `static` **preventExtensions**\<`T`\>(`o`): `T`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:240

Prevents the addition of new properties to an object.

#### Type Parameters

##### T

`T`

#### Parameters

##### o

`T`

Object to make non-extensible.

#### Returns

`T`

***

### register()

#### Call Signature

> `static` **register**(`name`, `options`): `boolean` \| `ToolFunc`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1223](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1223)

Registers a `ToolFunc` instance into the registry.

This method supports multiple overloads and handles hierarchical registration,
alias collision protection, and automatic dependency registration with cycle detection.

### Hierarchical Behavior:
- In an isolated registry, items are stored locally, shadowing parent items with the same name.
- Alias consistency is enforced across the hierarchy: registering a colliding alias throws an error
  unless `allowOverride.alias` is explicitly granted.

### Circular Dependencies:
Automatically detects and manages circular dependency chains using an internal stack.
Reference counts are precisely managed (count=1 for back-edges) to prevent memory leaks
and enable clean group unregistration.

##### Parameters

###### name

`string`

The tool instance, function, or name to register.

###### options

[`RegisterOptions`](../interfaces/RegisterOptions.md)

Configuration or implementation for the tool.
  The internal cycle-detection stack (a `Set`) may also be carried as `_stack` — either in this
  options argument or in the first-arg config object (used by recursive dependency registration);
  it is consumed and removed during normalization, never reaching the instance.
  With the `(name, funcString, config)` form, an optional third `config` argument is accepted
  that provides params/metadata defaults for the function-expression string.

##### Returns

`boolean` \| `ToolFunc`

The registered ToolFunc instance on success (creation, shadowing, or override),
or `false` if registration was ignored (e.g., ref-count increment only).

##### Example

```ts
// 1. Registering with explicit name and function
ToolFunc.register('add', { func: (a, b) => a + b });

// 2. Registering with shadowing permission in an isolated registry
MyPluginTools.register('calc', { func: () => 2, allowOverride: true });

// 3. Registering an existing ToolFunc instance
const tool = new ToolFunc({ name: 'my-tool', func: () => 'ok' });
ToolFunc.register(tool);

// 4. Registering from a function-expression string (compiled at registration time)
ToolFunc.register('add', '(a, b) => a + b');

// 5. Same, with an optional config object describing params and metadata
ToolFunc.register('add', '(a, b) => a + b', { params: [{ name: 'a' }, { name: 'b' }], description: 'Adds two numbers' });

// 6. Registering a named function expression without an explicit name
ToolFunc.register({ func: 'function greet(name) { return `Hi ${name}`; }' });
```

##### Throws

`Error` If name is missing, or if an alias collision occurs without permission.

#### Call Signature

> `static` **register**(`func`, `options`): `boolean` \| `ToolFunc`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1224](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1224)

Registers a `ToolFunc` instance into the registry.

This method supports multiple overloads and handles hierarchical registration,
alias collision protection, and automatic dependency registration with cycle detection.

### Hierarchical Behavior:
- In an isolated registry, items are stored locally, shadowing parent items with the same name.
- Alias consistency is enforced across the hierarchy: registering a colliding alias throws an error
  unless `allowOverride.alias` is explicitly granted.

### Circular Dependencies:
Automatically detects and manages circular dependency chains using an internal stack.
Reference counts are precisely managed (count=1 for back-edges) to prevent memory leaks
and enable clean group unregistration.

##### Parameters

###### func

`Function`

###### options

[`RegisterOptions`](../interfaces/RegisterOptions.md)

Configuration or implementation for the tool.
  The internal cycle-detection stack (a `Set`) may also be carried as `_stack` — either in this
  options argument or in the first-arg config object (used by recursive dependency registration);
  it is consumed and removed during normalization, never reaching the instance.
  With the `(name, funcString, config)` form, an optional third `config` argument is accepted
  that provides params/metadata defaults for the function-expression string.

##### Returns

`boolean` \| `ToolFunc`

The registered ToolFunc instance on success (creation, shadowing, or override),
or `false` if registration was ignored (e.g., ref-count increment only).

##### Example

```ts
// 1. Registering with explicit name and function
ToolFunc.register('add', { func: (a, b) => a + b });

// 2. Registering with shadowing permission in an isolated registry
MyPluginTools.register('calc', { func: () => 2, allowOverride: true });

// 3. Registering an existing ToolFunc instance
const tool = new ToolFunc({ name: 'my-tool', func: () => 'ok' });
ToolFunc.register(tool);

// 4. Registering from a function-expression string (compiled at registration time)
ToolFunc.register('add', '(a, b) => a + b');

// 5. Same, with an optional config object describing params and metadata
ToolFunc.register('add', '(a, b) => a + b', { params: [{ name: 'a' }, { name: 'b' }], description: 'Adds two numbers' });

// 6. Registering a named function expression without an explicit name
ToolFunc.register({ func: 'function greet(name) { return `Hi ${name}`; }' });
```

##### Throws

`Error` If name is missing, or if an alias collision occurs without permission.

#### Call Signature

> `static` **register**(`name`, `func`, `options?`): `boolean` \| `ToolFunc`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1225](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1225)

Registers a `ToolFunc` instance into the registry.

This method supports multiple overloads and handles hierarchical registration,
alias collision protection, and automatic dependency registration with cycle detection.

### Hierarchical Behavior:
- In an isolated registry, items are stored locally, shadowing parent items with the same name.
- Alias consistency is enforced across the hierarchy: registering a colliding alias throws an error
  unless `allowOverride.alias` is explicitly granted.

### Circular Dependencies:
Automatically detects and manages circular dependency chains using an internal stack.
Reference counts are precisely managed (count=1 for back-edges) to prevent memory leaks
and enable clean group unregistration.

##### Parameters

###### name

`string`

The tool instance, function, or name to register.

###### func

`string`

###### options?

[`RegisterOptions`](../interfaces/RegisterOptions.md)

Configuration or implementation for the tool.
  The internal cycle-detection stack (a `Set`) may also be carried as `_stack` — either in this
  options argument or in the first-arg config object (used by recursive dependency registration);
  it is consumed and removed during normalization, never reaching the instance.
  With the `(name, funcString, config)` form, an optional third `config` argument is accepted
  that provides params/metadata defaults for the function-expression string.

##### Returns

`boolean` \| `ToolFunc`

The registered ToolFunc instance on success (creation, shadowing, or override),
or `false` if registration was ignored (e.g., ref-count increment only).

##### Example

```ts
// 1. Registering with explicit name and function
ToolFunc.register('add', { func: (a, b) => a + b });

// 2. Registering with shadowing permission in an isolated registry
MyPluginTools.register('calc', { func: () => 2, allowOverride: true });

// 3. Registering an existing ToolFunc instance
const tool = new ToolFunc({ name: 'my-tool', func: () => 'ok' });
ToolFunc.register(tool);

// 4. Registering from a function-expression string (compiled at registration time)
ToolFunc.register('add', '(a, b) => a + b');

// 5. Same, with an optional config object describing params and metadata
ToolFunc.register('add', '(a, b) => a + b', { params: [{ name: 'a' }, { name: 'b' }], description: 'Adds two numbers' });

// 6. Registering a named function expression without an explicit name
ToolFunc.register({ func: 'function greet(name) { return `Hi ${name}`; }' });
```

##### Throws

`Error` If name is missing, or if an alias collision occurs without permission.

#### Call Signature

> `static` **register**(`name`, `options?`): `boolean` \| `ToolFunc`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1226](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1226)

Registers a `ToolFunc` instance into the registry.

This method supports multiple overloads and handles hierarchical registration,
alias collision protection, and automatic dependency registration with cycle detection.

### Hierarchical Behavior:
- In an isolated registry, items are stored locally, shadowing parent items with the same name.
- Alias consistency is enforced across the hierarchy: registering a colliding alias throws an error
  unless `allowOverride.alias` is explicitly granted.

### Circular Dependencies:
Automatically detects and manages circular dependency chains using an internal stack.
Reference counts are precisely managed (count=1 for back-edges) to prevent memory leaks
and enable clean group unregistration.

##### Parameters

###### name

`string` \| `Function` \| `ToolFunc` \| [`RegisterOptions`](../interfaces/RegisterOptions.md)

The tool instance, function, or name to register.

###### options?

[`RegisterOptions`](../interfaces/RegisterOptions.md)

Configuration or implementation for the tool.
  The internal cycle-detection stack (a `Set`) may also be carried as `_stack` — either in this
  options argument or in the first-arg config object (used by recursive dependency registration);
  it is consumed and removed during normalization, never reaching the instance.
  With the `(name, funcString, config)` form, an optional third `config` argument is accepted
  that provides params/metadata defaults for the function-expression string.

##### Returns

`boolean` \| `ToolFunc`

The registered ToolFunc instance on success (creation, shadowing, or override),
or `false` if registration was ignored (e.g., ref-count increment only).

##### Example

```ts
// 1. Registering with explicit name and function
ToolFunc.register('add', { func: (a, b) => a + b });

// 2. Registering with shadowing permission in an isolated registry
MyPluginTools.register('calc', { func: () => 2, allowOverride: true });

// 3. Registering an existing ToolFunc instance
const tool = new ToolFunc({ name: 'my-tool', func: () => 'ok' });
ToolFunc.register(tool);

// 4. Registering from a function-expression string (compiled at registration time)
ToolFunc.register('add', '(a, b) => a + b');

// 5. Same, with an optional config object describing params and metadata
ToolFunc.register('add', '(a, b) => a + b', { params: [{ name: 'a' }, { name: 'b' }], description: 'Adds two numbers' });

// 6. Registering a named function expression without an explicit name
ToolFunc.register({ func: 'function greet(name) { return `Hi ${name}`; }' });
```

##### Throws

`Error` If name is missing, or if an alias collision occurs without permission.

***

### run()

> `static` **run**(`name`, `params?`, `ctx?`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:875](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L875)

Asynchronously executes a registered function by name with named parameters.

Note: This method returns a `Promise` if the underlying function is asynchronous,
otherwise it may return the result synchronously.

#### Parameters

##### name

`string`

The name of the function to run.

##### params?

`any`

The parameters object for the function.

##### ctx?

[`ToolFuncContext`](../interfaces/ToolFuncContext.md)

The execution context.

#### Returns

`any`

A promise or the direct result of the function's execution.

#### Throws

`NotFoundError` If the function with the given name is not found.

***

### runSync()

> `static` **runSync**(`name`, `params?`, `ctx?`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:895](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L895)

Synchronously executes a registered function by name with named parameters.

#### Parameters

##### name

`string`

The name of the function to run.

##### params?

`any`

The parameters object for the function.

##### ctx?

[`ToolFuncContext`](../interfaces/ToolFuncContext.md)

The execution context.

#### Returns

`any`

The result of the function's execution.

#### Throws

`NotFoundError` If the function with the given name is not found.

***

### runWithPos()

> `static` **runWithPos**(`name`, ...`params`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:931](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L931)

Asynchronously executes a function using positional arguments.

Note: This method returns a `Promise` if the underlying function is asynchronous,
otherwise it may return the result synchronously.

#### Parameters

##### name

`string`

The name of the function to run.

##### params

...`any`[]

Positional arguments to pass to the function.

#### Returns

`any`

A promise or the direct result of the function's execution.

#### Throws

`NotFoundError` If the function with the given name is not found.

***

### runWithPosSync()

> `static` **runWithPosSync**(`name`, ...`params`): `any`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:949](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L949)

Synchronously executes a function using positional arguments.

#### Parameters

##### name

`string`

The name of the function to run.

##### params

...`any`[]

Positional arguments to pass to the function.

#### Returns

`any`

The result of the function's execution.

#### Throws

`NotFoundError` If the function with the given name is not found.

***

### seal()

> `static` **seal**\<`T`\>(`o`): `T`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:216

Prevents the modification of attributes of existing properties, and prevents the addition of new properties.

#### Type Parameters

##### T

`T`

#### Parameters

##### o

`T`

Object on which to lock the attributes.

#### Returns

`T`

***

### setPrototypeOf()

> `static` **setPrototypeOf**(`o`, `proto`): `any`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2015.core.d.ts:339

Sets the prototype of a specified object o to object proto or null. Returns the object o.

#### Parameters

##### o

`any`

The object to change its prototype.

##### proto

`object` \| `null`

The value of the new prototype or null.

#### Returns

`any`

***

### unregister()

> `static` **unregister**(`target`, `options?`): `ToolFunc` \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1350](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L1350)

Unregisters a tool function implementation from the registry by its name, alias, or instance.

This method supports hierarchical unregistration. If a function's reference count
reaches zero, it is physically removed from the registry and its dependencies are released.

#### Parameters

##### target

`string` \| `ToolFunc`

The name, alias, or implementation instance.

##### options?

`boolean` \| [`UnregisterOptions`](../interfaces/UnregisterOptions.md)

Unregistration options, or a boolean shorthand for `{ force: true }`.
  Recognized fields:
  - `force`: If true, removes the tool immediately, ignoring the reference count
    (default: `false`).
  - `decrement`: How many registration holds to release — `'once'` (default) or `'all'`.
  - `scope`: Hierarchical search scope —
    `'local'` (default) only removes a tool owned by the current registry layer;
    `'inherited'` searches up and removes the first match found in parents;
    `'all'` removes every occurrence in the whole prototype chain.

#### Returns

`ToolFunc` \| `undefined`

The unregistered ToolFunc instance, or `undefined` if not found.

***

### values()

#### Call Signature

> `static` **values**\<`T`\>(`o`): `T`[]

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2017.object.d.ts:24

Returns an array of values of the enumerable own properties of an object

##### Type Parameters

###### T

`T`

##### Parameters

###### o

\{\[`s`: `string`\]: `T`; \} \| `ArrayLike`\<`T`\>

Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.

##### Returns

`T`[]

#### Call Signature

> `static` **values**(`o`): `any`[]

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2017.object.d.ts:30

Returns an array of values of the enumerable own properties of an object

##### Parameters

###### o

Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.

##### Returns

`any`[]

***

### with()

> `static` **with**(`ctx`): *typeof* `ToolFunc`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:702](https://github.com/isdk/tool-func.js/blob/9b897b93abedaf6bd89e126cbe7bfd93fa608596/src/tool-func.ts#L702)

Returns a static proxy with the provided context.

#### Parameters

##### ctx

[`ToolFuncContext`](../interfaces/ToolFuncContext.md)

The context to use.

#### Returns

*typeof* `ToolFunc`

A static proxy of ToolFunc class.
