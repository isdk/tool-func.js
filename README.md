# @isdk/tool-func

A powerful TypeScript framework for creating, managing, and executing modular tool functions. It's perfect for building AI agent tools, backend services, and extensible plugin systems with a clean, decoupled architecture.

## ✨ Core Features

- **📦 Modular & Reusable Tools:** Define functions as `ToolFunc` instances with rich metadata, maintaining a clear separation between static management and instance logic.
- **🌐 Global Registry:** The static registry (`ToolFunc.items`) allows any part of your application to access and run registered functions by name.
- **🏛️ Hierarchical Registries & Polymorphism:** Supports isolating registries via the prototype chain (`isolateRegistry`). Enables plugin systems to "shadow" parent tools and provides intelligent late-binding to ensure dependency polymorphism and sibling stability.
- **🔗 Dependency Management:** Declare dependencies on other `ToolFunc`s using the `depends` property. Supports local aliasing, and dependencies are automatically registered.
- **🔢 Reference Counted Registration:** Allows multiple modules to share the same tool. Automatically manages dependency lifecycles, only physically unregistering a tool when all references are released.
- **⚖️ Controlled Overrides:** Explicitly supports `allowOverride` mode to safely update tool implementations (e.g., hot-reloading) while maintaining dependency chain integrity.
- **🧩 Execution Context & Concurrency Isolation:** Achieves concurrency safety with minimal memory overhead using prototype-chain-based "Shadow Instances". Safely access environmental data (like `traceId`, `signal`) via `this.ctx` and propagate context using the `tool.with(ctx)` chainable API.
- **🔄 Async & Cancellable Tasks:** Transparently integrates cancellation capabilities via `makeToolFuncCancelable`. Automatically injects an `aborter` on every call, supports timeouts and `AbortSignal` linkage, and returns a `task` handle for external lifecycle control.
- **🌊 Streaming Responses:** Easily create streaming outputs using the `stream` property. Process stream events seamlessly with `createCallbacksTransformer`, featuring unified cleanup hooks and zero-copy optimization.
- **🚀 Lifecycle Hooks:** Use the `setup` method to execute one-time initialization logic and safely modify instance state.
- **🧬 Flexible Argument Normalization:** Supports smart pattern recognition (strings, functions, objects) and deep merging during construction and registration to easily compose tool metadata.
- **🔀 Dual-Mode Parameter Support:** Supports both semantically clear object parameters (`run`) and fixed-order positional parameters (`runWithPos`).
- **🏷️ Aliases & Tags:** Assign multiple names (`alias`) or `tags` to functions for flexibility and grouping.

## 📦 Installation

```bash
npm install @isdk/tool-func
```

## 🚀 Basic Usage

### 1. Define a Tool

Create a `ToolFunc` instance to define your tool's metadata and implementation.

```typescript
import { ToolFunc } from '@isdk/tool-func';

const getUser = new ToolFunc({
  name: 'getUser',
  description: 'Retrieves a user by ID.',
  params: { id: { type: 'string', required: true } },
  func: (params) => ({ id: params.id, name: 'John Doe' }),
});
```

### 2. Register the Tool

Register the tool to make it available in the global registry.

```typescript
getUser.register();
```

### 3. Run the Tool

Execute the tool from anywhere in your application using the static `run` method.

```typescript
async function main() {
  const user = await ToolFunc.run('getUser', { id: '123' });
  console.log(user); // Outputs: { id: '123', name: 'John Doe' }
}

main();
```

## 🌟 Advanced Usage

### Dependency Management

Declare dependencies on other tools, and they will be registered automatically.

```typescript
const welcomeUser = new ToolFunc({
  name: 'welcomeUser',
  description: 'Generates a welcome message.',
  params: { userId: 'string' },
  depends: {
    // `getUser` will be auto-registered when `welcomeUser` is registered.
    userFetcher: getUser,
  },
  func: function(params) {
    // `this` is the ToolFunc instance, so we can use `runAsSync` to run dependencies
    const user = this.runAsSync('userFetcher', { id: params.userId });
    return `Hello, ${user.name}!`;
  },
});

welcomeUser.register();

const message = await ToolFunc.run('welcomeUser', { userId: '456' });
console.log(message); // "Hello, John Doe!"
```

> **💡 Pro Tip: Local Dependency Aliasing**
> In `runAsSync` or `runAs`, the framework prioritizes matching keys in the `depends` map (e.g., `userFetcher`). This allows you to define "local names" for dependencies that are only valid within the current tool, without polluting the global registry.

### Lifecycle Hooks: The `setup` Method

The `setup` hook provides a way to run one-time initialization logic when a `ToolFunc` instance is created. This is useful for configuring the instance, setting up initial state, or modifying properties before the tool is registered or used. The `this` context inside `setup` refers to the `ToolFunc` instance itself.

```typescript
const statefulTool = new ToolFunc({
  name: 'statefulTool',
  customState: 'initial', // Define a custom property
  setup() {
    // `this` is the statefulTool instance
    console.log(`Setting up ${this.name}...`);
    this.customState = 'configured';
    this.initializedAt = new Date();
  },
  func() {
    return `State: ${this.customState}, Initialized: ${this.initializedAt.toISOString()}`;
  }
});

console.log(statefulTool.customState); // "configured"

statefulTool.register();
console.log(await ToolFunc.run('statefulTool'));
// "State: configured, Initialized: ..."
```

### Registration Lifecycle & Reference Counting

In complex plugin systems, multiple tools might share the same underlying dependency. To safely manage these shared tools, `@isdk/tool-func` introduces a **Reference Counting** mechanism.

#### 1. How Reference Counting Works

- **`register()`**: Each time you call register, the reference count for that tool name is incremented. If the tool already exists and override mode is not enabled, it simply increments the count and returns `false` (indicating no new instance was created).
- **`unregister()`**: Each time you call unregister, the reference count is decremented. The tool is only physically removed from the global registry when its count reaches zero.
- **Forced Unregistration**: You can bypass the count and remove a tool immediately using `ToolFunc.unregister(name, true)` or `unregister({ force: true })`.

#### 2. Automatic Dependency Lifecycle

When you register a tool with `depends`, the framework automatically handles the lifecycle of its dependencies:

- **Auto-Registration**: Registering a parent tool automatically registers all `ToolFunc` instance dependencies (incrementing their refCounts).
- **Auto-Unregistration**: When a parent tool is completely removed (refCount reaches zero), it automatically triggers unregistration requests for all its dependencies (decrementing their refCounts).

This ensures that as long as at least one parent tool is active, its required child tools will not be accidentally unloaded.

> **🔧 Internal Convention: Circular Dependency Detection via `options._stack` (Plugin Developers)**
>
> When a tool declares `depends`, registration recurses into each dependency. To terminate
> circular chains (A → B → A), the framework threads an internal **stack** — a `Set` of the
> ancestor names currently being registered — through the recursive `register` calls:
>
> - **Carrying**: the stack is passed as `options._stack` (it may sit either in the first-arg
>   config object or in the second-arg options). It is **consumed and removed** during
>   normalization (see `_extractStack`), so it never becomes instance state and is never
>   serialized.
> - **Back-edge behavior**: if a name is already in the stack, `register` returns `false` —
>   the tool is already being registered in the current call chain, so re-entry is skipped.
> - **If you override `register()` / `_acquireDependencies()`**: keep threading the stack via
>   `{ _stack: stack }` in the options object — do not add a third parameter. Only the wrapper
>   object is consumed; the `Set` itself passes through recursion unchanged.

#### 3. Implementation Overriding

If you need to dynamically update the logic of an already registered tool (e.g., for hot-reloading or plugin replacement), use the `allowOverride` option:

```typescript
// Initial registration
ToolFunc.register({ name: 'calc', func: () => 1 });

// Attempt to override (without allowOverride, this only increments the refCount)
ToolFunc.register({
  name: 'calc',
  func: () => 2,
  allowOverride: true // Forcefully replace the existing implementation
});

console.log(ToolFunc.runSync('calc')); // Outputs: 2
```

> **⚠️ Note**: A warning is issued if the tool being overridden is still held by other references (refCount > 1). Overriding is atomic: if a new tool's alias conflicts with another existing tool, the override fails and the old version is preserved.

### Hierarchical Registries and Shadowing

For complex systems with plugin architectures or multi-tenant environments, you might need to isolate certain tools while still inheriting others from a parent registry. `@isdk/tool-func` supports **Hierarchical Registries** using JavaScript's prototype chain.

#### 1. Isolate Your Registry

Use `ToolFunc.isolateRegistry()` to branch the current registry from its parent. This creates a new scope where registrations are local, but parent tools are still visible (and can be shadowed).

```typescript
class MyPluginTools extends ToolFunc {
  static {
    // Branch the registry: isolate items, aliases, and refCounts
    this.isolateRegistry();
  }
}

// Parent has 'global-tool'
ToolFunc.register('global-tool', { func: () => 'global' });

// MyPluginTools inherits 'global-tool' but can register its own 'local-tool'
MyPluginTools.register('local-tool', { func: () => 'local' });

console.log(MyPluginTools.get('global-tool')); // Returns the global tool
console.log(MyPluginTools.get('local-tool'));  // Returns the local tool
console.log(ToolFunc.get('local-tool'));       // undefined (isolated!)
```

#### 2. Tool Shadowing (Polymorphism)

When a registry is isolated, you can register a tool with the same name as one in the parent. This "shadows" the parent tool within the current scope.

```typescript
// Shadowing the parent's 'calc' tool
MyPluginTools.register('calc', { func: () => 'plugin-version' });

console.log(ToolFunc.runSync('calc'));       // Original version
console.log(MyPluginTools.runSync('calc'));  // Plugin version
```

#### 3. Namespace Protection

If you want to ensure a name is globally unique and prevent accidental shadowing, use `allowOverride: false`. The registry will check the entire prototype chain and throw an error if the name is already taken.

```typescript
MyPluginTools.register('global-tool', {
  func: () => 'oops',
  allowOverride: false // Throws error because 'global-tool' exists in parent
});
```

#### 4. Scoped Unregistration

The `unregister` method supports a `scope` option to control how deeply to remove a tool:

- **`scope: 'local'` (default)**: Only remove the tool if it's "owned" by the current registry. If you unregister a shadow tool, the parent tool will "re-appear".
- **`scope: 'inherited'`**: Search up the chain and remove the first occurrence.
- **`scope: 'all'`**: Remove the tool from the current registry and all its parents.

#### 5. Late-Binding Polymorphism & Binding Strategies

In complex plugin systems, a parent tool may depend on other tools. When a child registry "shadows" these dependencies, the system intelligently senses the `rootRegistry` (entry-point caller) and switches implementations accordingly.

```typescript
class Parent extends ToolFunc {
  static {
    const depP = new ToolFunc({ name: 'dep', func: () => 'parent-dep' });
    this.register(depP);
    this.register({
      name: 'main',
      depends: { d: depP },
      func: function() { return this.runAsSync('dep'); }
    });
  }
}

class Child extends Parent {
  static {
    this.isolateRegistry();
    // Shadow the dependency
    this.register({ name: 'dep', func: () => 'child-dep' });
  }
}

// Auto mode: Child's shadow is used when called from Child
console.log(Child.runSync('main'));  // Outputs: "child-dep"
console.log(Parent.runSync('main')); // Outputs: "parent-dep" (Stability protection)
```

You can explicitly control the dependency binding behavior via `ctx.binding`:

- **`'auto'` (Default)**: **Smart Sensing**. Switches to late-binding only if the caller is a descendant of the definer and has a shadow. This achieves polymorphism while preserving stability for same-scope calls.
- **`'early'`**: **Early Binding (Safety First)**. Always uses the original instance bound at registration, ignoring any shadows.
- **`'late'`**: **Late Binding (Environment First)**. Forced resolution from the rootRegistry, regardless of lineage.

```typescript
// Force using parent's original dependency even if child has a shadow
Child.runSync('main', {}, { binding: 'early' }); // Outputs: "parent-dep"
```

### Execution Context and Concurrency Isolation

In production-grade applications, tool functions often don't run in isolation. They need to be aware of and respond to changes in the "execution environment". For example: carrying a `traceId` in distributed tracing, knowing the current `userId` in a web service, or responding to an `AbortSignal` in long-running tasks.

To support these complex requirements without compromising the purity of the tool functions (i.e., "separation of logic and environment"), `@isdk/tool-func` introduces a context management mechanism based on **prototype chain shadow instances**.

#### 1. `ToolFuncContext` Core Interface

The context object is not just a data carrier; it's also a configuration set for controlling tool execution behavior:

- **`isolated`**: `boolean` (optional). Core implementation, forces an independent execution scope for this call. Even if there are no other properties in `ctx`, setting this to `true` will trigger the creation of a shadow instance, ensuring concurrency safety.
- **`inheritContext`**: `boolean` (optional). Core implementation, controls automatic context propagation. Defaults to `true`. If set to `false`, this call will have a brand new context environment that doesn't inherit from the parent.
- **`signal`**: `AbortSignal` (optional). Recommendation, standard Web API. When an external abort occurs, the tool can catch it via `this.ctx.signal`.
- **`signals`**: `AbortSignal[]` (optional). Recommendation, support for passing multiple abort signals. Any signal aborting will trigger the task to stop.
- **`aborter`**: `Aborter` (optional). Recommendation, custom aborter. After injecting `Cancelable` ability, it will be automatically injected and managed here.
- **`Custom Properties`**: You can spread any business-related Metadata (like `userId`, `traceId`) directly on the context object.

> **⚠️ Note on non-plain objects:**
> If you pass a `ctx` with a non-standard prototype (e.g., it's an instance of a class), the framework will shallow copy and "flatten" it via `{...ctx}` before mounting it to the context prototype chain. This ensures you can access its properties while maintaining the inheritance structure.

#### 2. Accessing Context: `static ctx` vs `instance.ctx`

The framework maintains `ctx` properties at both the class level (static) and object level (instance), with clear responsibilities:

- **Static `ToolFunc.ctx`**: This is a global or proxy-level "default environment". When you use `ToolFunc.with(ctx)`, it returns a class shadow with this property.
- **Instance `this.ctx`**: This is the **only legitimate entry point** for tool internal logic (`func`) to access context. it guarantees that you always get data "belonging to this call", regardless of concurrency.

> **💡 Architectural Trade-off: Why not "flatten" context?**
> We strictly forbid mounting context data directly on `this` (e.g., `this.user`). This is because `ToolFunc` instances have core metadata like `name`, `params`, `title`, etc. If the context happened to have a `name` field, flattening it would destroy the tool definition and lead to hard-to-debug bugs. `this.ctx` provides a safe isolated space.

#### 3. Core Mechanism: Shadow Instance and Root Tracking (_origin)

This is the most ingenious design of this framework. To solve concurrency conflicts, we don't use heavy deep cloning, but leverage JavaScript's **Prototype Chain**.

When you call `tool.with({ user: 'Alice' }).run()`:

1. **Create Shadow**: The framework executes `Object.create(tool)`.
2. **Root Tracking**: Every shadow instance has a hidden `_origin` property pointing to the original tool instance. This ensures that even in complex nested shadows, concurrency control state (like semaphores, running task counts) is still managed by the original tool, avoiding "state drift".
3. **Inject Properties**: Mount `ctx: { user: 'Alice' }` on the resulting shadow object.
4. **Logic Execution**: The shadow object executes `func`. At this point, `this` points to the shadow object, so `this.ctx` returns Alice; meanwhile, thanks to the prototype chain, `this.name` still correctly accesses the name defined in the original tool.

**Advantages of this design:**

- **State Synchronization**: Ensures global validity of single-instance concurrency limits (`maxTaskConcurrency`) and other resource-tracking states via `_origin`. This prevents state drift by centralizing management on the original tool instance.
- **Extremely Low Memory**: Shadow objects are just a very thin layer of properties and don't hold logic copies.
- **Concurrency Safety**: Each shadow object is independent. 100 concurrent requests correspond to 100 shadow objects, without interference.
- **Dynamic Inheritance**: You can call `.with().with()` continuously, forming a chain of context inheritance.

#### 4. Dual Forms of Fluent API

We provide a chained calling interface that reads like natural language:

##### Static Form: `ToolFunc.with(ctx)`

Used to preset the execution environment at a global level or before getting an instance. It returns a "static proxy class".

```typescript
// All subsequent calls will carry current user info
const AuthorizedRunner = ToolFunc.with({ token: 'abc-123', role: 'admin' });

// Run any tool, they can all get admin via this.ctx.role
await AuthorizedRunner.run('deleteUser', { id: 789 });
```

##### Instance Form: `tool.with(ctx)`

Used for fine-grained environment configuration for a specific tool. It returns an "execution-time shadow instance".

```typescript
const uploadTool = ToolFunc.get('uploadFile');

// Set trace ID and abort signal for a single upload task
const controller = new AbortController();
const runner = uploadTool.with({
  traceId: 'T-555',
  signal: controller.signal
});

await runner.run({ id: 789 });
```

#### 5. Advanced Extension Hooks (for Plugin Developers)

If you are developing AoP (Aspect Oriented Programming) plugins (e.g., auto-logging, permission interception, performance tracking) or need to customize the isolation behavior of tools, you need to deeply understand the following two core internal hooks. They are the foundation of framework extensibility:

- **`_shouldIsolate(params, ctx)`**: **The "Admission Switch" for shadow instances**.
  - **Role**: Decides whether this call needs to create a brand new shadow instance.
  - **`ctx` parameter**: Specifically refers to the "call-time context" explicitly passed by the user when calling `run(params, ctx)` or `runSync(params, ctx)`.
  - **Logic**:
    1. If the user passed `ctx`, it must be isolated to apply these overrides.
    2. If the current instance is already a shadow instance (has its own `ctx` property) and the user didn't pass a new `ctx`, it won't re-isolate and will reuse the current one.
    3. If the tool has async features like `Cancelable` enabled, it must be forced to isolate to ensure aborter isolation.
  - **Custom Scenario**: You can override this method to force isolation based on specific fields in `params` (e.g., `forceNewScope: true`).

- **`_prepareContext(params, ctx)`**: **The "Processing Factory" for context**.
  - **Role**: Responsible for building the final `this.ctx` object held by the shadow instance after it's created.
  - **Core Logic - Prototype Inheritance**:
      1. It first gets the "parent context" (i.e., the existing `this.ctx` of the current instance).
      2. If `inheritContext` is `true` (default), it executes `Object.create(parentCtx)` to achieve property inheritance.
      3. **Automatic Ability Injection**: For example, the `Cancelable` plugin overrides this method to automatically inject an `aborter` instance here and link it with external `signal/signals`.
      4. Finally, overlay the `ctx` explicitly passed by the user onto the top of this new object.
  - **Custom Scenario**: Plugins (like auto-logging) override this method to automatically inject a `logger` instance, achieving transparent feature injection for business logic.

  > **⚠️ Note**: When overriding these methods, be sure to call `super._shouldIsolate` or `super._prepareContext` to ensure normal operation of core framework features.

#### 6. Automatic Context Propagation

In tool chain calls (e.g., tool A calling `this.runAs('B')` in its implementation), context flows automatically:

- **Default Behavior**: B automatically inherits all `ctx` properties of A.
- **Explicit Control**: A new `ctx` can be passed in `runAs(params?, ctx?: ToolFuncContext)`, which will be merged (inherited) as a sub-context into the current call.
- **Positional Argument Support**: Since positional argument functions (`runWithPos`) don't accept a `ctx` argument, you **must** use `this.with(ctx).runWithPos(...)` to ensure correct context injection.

### Asynchronous & Cancellable Tasks

When dealing with AI agent requests, big data processing, or complex async workflows, tasks often take a long time. **Cancelable Ability** allows developers to safely abort a task in the middle of its execution, avoiding invalid computation and resource waste.

#### 1. Core Mechanism: Transparent Context Integration

After giving a tool "Cancelable" ability via `makeToolFuncCancelable`, the framework automatically participates in the construction of the execution context:

- **Automatic Injection**: Every time the tool is called, the framework automatically injects a `TaskAbortController` (referred to as `aborter`) into `this.ctx` of the shadow instance.
- **Environment Isolation**: Each concurrent task has an independent aborter, without interference.
- **Signal Linking**: If external `signal` or `signals` are passed in the context (`ctx`), the injected `aborter` will automatically link with these signals. As soon as an external signal aborts, the internal task will be notified immediately.

#### 2. Usage Example

The example below shows how to define a long-running loop task that supports abortion:

```typescript
import { ToolFunc, makeToolFuncCancelable, AsyncFeatures } from '@isdk/tool-func';

// 1. Give the ToolFunc class cancelable capability
const CancellableToolFunc = makeToolFuncCancelable(ToolFunc);

// 2. Define a specific long-running tool
const myLongTask = new CancellableToolFunc({
  name: 'myLongTask',
  asyncFeatures: AsyncFeatures.Cancelable, // Declare cancelable feature
  func: async function(params) {
    // Get the auto-injected aborter from context
    const aborter = this.ctx.aborter;

    for (let i = 0; i < 100; i++) {
      // Do actual work
      await doSomeWork();

      // Core step: Check for abort status. Throws AbortError if aborted.
      aborter.throwIfAborted();
    }
    return 'Task completed successfully';
  }
});

myLongTask.register();

// 3. Run the task and get the control handle
// Async execution returns a Promise with a .task property
const promise = ToolFunc.run('myLongTask');
const task = promise.task; // Get the task controller for this call

// Simulate discovery that results are no longer needed after 1 second, initiate abort
setTimeout(() => task.abort('Result no longer needed'), 1000);

try {
  await promise;
} catch (err) {
  console.log(err.message); // Outputs: "Result no longer needed"
}
```

#### 3. Key Points Analysis

- **`aborter.throwIfAborted()`**: This is the recommended way to check. It ensures that when an abort occurs, the business logic exits with a standard `AbortError`, triggering the correct resource cleanup process.
- **Task Handle**: The `task` object is attached to the Promise returned by `ToolFunc.run`. This allows callers to control the task lifecycle directly without needing to know context details.
- **Timeout Support**: You can pass a `timeout` parameter (via `params` or `ctx`) directly when calling, and the framework will automatically set a timer and trigger `aborter.abort()` after timeout.

### Streaming Responses

To create a tool that can stream its output, follow these steps:

1. **Enable Streaming Capability**: Set `stream: true` in the tool's definition. This marks the tool as *capable* of streaming.
2. **Check for Streaming Request**: Inside your `func`, use the `this.isStream(params)` method. This checks if the current execution was requested as a stream. By default, it looks for a `stream: true` parameter in the incoming arguments.
3. **Add a Control Parameter (Optional)**: If your tool should support *both* streaming and regular value returns, add a `stream: { type: 'boolean' }` parameter to your `params` definition. This allows users to choose the return type (e.g., by passing `{ stream: true }`). If your tool *only* streams, you don't need this parameter.

The example below demonstrates a flexible tool that can return either a stream or a single value.

```typescript
import { ToolFunc } from '@isdk/tool-func';

// 1. Define the tool with streaming capability
const streamableTask = new ToolFunc({
  name: 'streamableTask',
  description: 'A task that can return a value or a stream.',
  stream: true, // Mark as stream-capable
  params: {
    // Declare a 'stream' parameter to control the output type
    stream: { type: 'boolean', description: 'Whether to stream the output.' }
  },
  func: function(params) {
    // 2. Check if streaming is requested
    if (this.isStream(params)) {
      // Return a ReadableStream for streaming output
      return new ReadableStream({
        async start(controller) {
          for (let i = 0; i < 5; i++) {
            controller.enqueue(`Chunk ${i}\n`);
            await new Promise(r => setTimeout(r, 100));
          }
          controller.close();
        }
      });
    } else {
      // Return a regular value if not streaming
      return 'Completed in one go';
    }
  }
});

// 3. Register the tool
streamableTask.register();

// 4. Run in both modes
async function main() {
  console.log('--- Running in non-streaming mode ---');
  const result = await ToolFunc.run('streamableTask', { stream: false });
  console.log('Result:', result); // Output: Completed in one go

  console.log('\n--- Running in streaming mode ---');
  const stream = await ToolFunc.run('streamableTask', { stream: true });

  // 5. Consume the stream
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log('Stream finished.');
      break;
    }
    process.stdout.write(value); // Output: Chunk 0, Chunk 1, ...
  }
}

main();
```

### Handling Stream Events with `createCallbacksTransformer`

While `ToolFunc` allows you to *return* streams, you often need to process the data *within* a stream or ensure robust resource cleanup. The `createCallbacksTransformer` utility creates a `TransformStream` that makes it easy to hook into a stream's lifecycle events.

#### Key Features

- **Unified Cleanup**: The `onClose` hook is guaranteed to run exactly once, regardless of how the stream ended (success, error, or cancel). This is the ideal place to release resources like `ActiveTaskHandle`.
- **Zero-Copy Optimization**: If you omit `onTransform`, the transformer acts as a high-performance "Identity Transform", letting data pass through with minimal overhead.
- **RPC & Cancellation Friendly**: Explicitly supports the `onCancel` hook to detect client disconnections or aborts.

#### Callback Functions

- `onStart(controller)`: Called once when the stream is initialized.
- `onTransform(chunk, controller)`: Called for each chunk. (Omit for zero-copy path).
- `onFinal(controller)`: Called once the stream is successfully closed (upstream `close`).
- `onCancel(reason)`: Called if the reader cancels the stream.
- `onError(err)`: Called if an error occurs.
- `onClose(status, reason)`: **The recommended cleanup hook**. `status` is `'final'`, `'error'`, or `'cancel'`.

#### Example: Processing and Robust Cleanup

```typescript
import { createCallbacksTransformer } from '@isdk/tool-func';

async function main() {
  // 1. Create a transformer with comprehensive callbacks
  const transformer = createCallbacksTransformer({
    onStart: () => console.log('Stream started!'),
    onTransform: (chunk) => {
      console.log('Received chunk:', chunk);
      return chunk.toUpperCase();
    },
    onFinal: () => console.log('Stream finished normally!'),
    onError: (err) => console.error('Stream error:', err),
    onClose: (status, reason) => {
      console.log(`Resource Cleanup: Stream closed with status [${status}]`);
      if (reason) console.log('Reason/Error:', reason);
      // myTaskHandle.release();
    }
  });

  // 2. Create a source ReadableStream
  const readableStream = new ReadableStream({
    start(controller) {
      controller.enqueue('a');
      controller.enqueue('b');
      controller.close();
    },
  });

  // 3. Pipe the stream through the transformer
  const transformedStream = readableStream.pipeThrough(transformer);

  // 4. Read the results from the transformed stream
  const reader = transformedStream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    console.log('Processed chunk:', value);
  }
}

main();
```

This example would output:

```sh
Stream started!
Received chunk: a
Processed chunk: A
Received chunk: b
Processed chunk: B
Stream finished normally!
Resource Cleanup: Stream closed with status [final]
```

### Parameter Handling: Object vs. Positional

`ToolFunc` supports both object-based and positional parameters for flexibility. While both are functional, **object parameters are generally recommended** for their clarity and self-documenting nature.

#### Object Parameters (Recommended)

When `params` is defined as an object, the `func` receives a single object argument containing all parameters by name. This is the default and most straightforward approach.

```typescript
const greetUser = new ToolFunc({
  name: 'greetUser',
  description: 'Greets a user by name and age.',
  params: {
    name: { type: 'string', required: true },
    age: { type: 'number' },
  },
  func: (args) => {
    const { name, age } = args;
    return `Hello, ${name}! ${age ? `You are ${age} years old.` : ''}`;
  },
});

greetUser.register();
console.log(await ToolFunc.run('greetUser', { name: 'Alice', age: 30 }));
// Outputs: "Hello, Alice! You are 30 years old."
```

#### Positional Parameters

If `params` is defined as an array of `FuncParam` objects, the `func` receives arguments in the order they are defined. This can be useful for functions with a fixed, small number of arguments where order is intuitive.

```typescript
const addNumbers = new ToolFunc({
  name: 'addNumbers',
  description: 'Adds two numbers.',
  params: [
    { name: 'num1', type: 'number', required: true },
    { name: 'num2', type: 'number', required: true },
  ],
  func: (num1, num2) => num1 + num2,
});

addNumbers.register();
console.log(await ToolFunc.runWithPos('addNumbers', 5, 3)); // Use runWithPos for positional arguments
// Outputs: 8
```

**Recommendation:** For most use cases, defining `params` as an object and accessing arguments by name within your `func` is cleaner and less error-prone, especially as your function's parameter list grows.

### Flexible Argument Normalization

The framework features a "Smart Argument Normalization" system for both the `ToolFunc` constructor and the `ToolFunc.register` method. This system uses **Pattern Recognition** to identify your intent and applies **Deep Merging** (via `defaultsDeep`) to combine your inputs.

#### 1. Core Principle: The "Authority" vs. "Defaults"

In all patterns involving two arguments `(arg1, arg2)`, **`arg1` is the primary authority**, and **`arg2` provides deep default values**. This means if both arguments define the same property (like `title`), the value in `arg1` will be preserved.

#### 2. Supported Patterns

The system automatically recognizes the following patterns:

- **`(string, options)`**:
  - The first argument is the fixed `name`.
  - `options` provides everything else as defaults.
  - `const tool = new ToolFunc('myTool', { title: 'Default Title' });`

- **`(function, options)`**:
  - The first argument is the implementation `func`.
  - Its `name` is used as a fallback if no `name` is provided in `options`.
  - **Metadata Awareness**: If the function was enriched via `funcWithMeta`, its metadata is automatically extracted and used with high priority.
  - `const tool = new ToolFunc(function myTask() {}, { description: '...' });`

- **`(object, options)`**:
  - The first argument is a configuration object or an existing `ToolFunc` instance.
  - The second argument fills in missing properties recursively.
  - `const tool = new ToolFunc({ name: 'task', title: 'Main' }, { title: 'Fallback' }); // title will be 'Main'`

- **`(string, funcString)`**:
  - The first argument is the fixed `name`, the second is the implementation as a **function-expression string**.
  - `ToolFunc.register('add', '(a, b) => a + b');`

- **`(string, funcString, config)`**:
  - Same as above, plus an optional third **config object** describing `params`, `description`, `title`, etc. Works the same way for the constructor:
  - `ToolFunc.register('add', '(a, b) => a + b', { params: [{ name: 'a' }, { name: 'b' }], description: 'Adds two numbers' });`
  - `const add = new ToolFunc('add', '(a, b) => a + b', { params: [{ name: 'a' }, { name: 'b' }], description: 'Adds two numbers' });`

#### 3. String Functions

A `func` can be provided as a string and is compiled at construction/registration time. This is especially useful when loading tool definitions from persisted data (the framework itself exports `func` as a string when serializing a tool).

- **Accepted formats** — the string must be a **function expression**: an arrow expression (`'(a, b) => a + b'`), a function expression (`'function(a, b) { return a + b }'`), or a named function expression (`'function greet(name) { return name; }'`).
- **Bare expressions are rejected** — a string like `'a + b'` evaluates to a value instead of a function, so it throws a clear error. Use an arrow form instead.
- **Calling convention** — a string func like `'(a, b) => ...'` is positional, so declare `params` as an array (`[{ name: 'a' }, { name: 'b' }]`) to use `run`/`runSync` with named params, or call it with `runWithPos`/`runWithPosSync`.
- **Name derivation** — when no `name` is configured, the name is derived from a named function expression (e.g. `'function add(a, b) {...}'` → `add`).
- **Scope** — the `scope` option provides closure variables: `new ToolFunc({ name: 't', scope: { secret: 42 }, func: '() => secret' })`.

> **⚠️ Security note:** string funcs are compiled with `new Function`, i.e. arbitrary code execution. Only register strings from trusted sources (e.g. your own persisted data).

#### 4. Deep Merging Benefits

Because it uses `defaultsDeep`, you can provide partial defaults for nested structures like `params`, `depends`, or `result` schemas.

```typescript
ToolFunc.register(
  { name: 'complex', params: { id: { type: 'string' } } },
  { params: { apiKey: { type: 'string', required: true } } }
);
// The resulting tool will have BOTH 'id' and 'apiKey' in its params.
```

---

## 🏛️ Core Architecture: Static vs. Instance

A key design principle in `ToolFunc` is the separation of roles between the static class and its instances:

- **The Static Class as Manager:** The static side of `ToolFunc` (e.g., `ToolFunc.register`, `ToolFunc.run`) acts as a global **registry** and **executor**. It manages all tool definitions, allowing any part of your application to discover and run tools by name.

- **The Instance as the Tool:** An instance (`new ToolFunc(...)`) represents a single, concrete **tool**. It holds the actual function logic, its metadata (name, description, parameters), and any internal state.

This separation provides the best of both worlds: the power of object-oriented encapsulation for defining individual tools and the convenience of a globally accessible service for managing and executing them.

## 🤝 Contributing

If you would like to contribute to the project, please read the [CONTRIBUTING.md](./CONTRIBUTING.md) file for guidelines on how to get started.

## 📄 License

The project is licensed under the MIT License. See the [LICENSE-MIT](./LICENSE-MIT) file for more details.
