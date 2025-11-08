# @isdk/tool-func

A powerful TypeScript framework for creating, managing, and executing modular tool functions. It's perfect for building AI agent tools, backend services, and extensible plugin systems with a clean, decoupled architecture.

## ✨ Core Features

- **📦 Modular & Reusable Tools:** Define functions as `ToolFunc` instances with rich metadata.
- **🌐 Global Registry:** A static registry (`ToolFunc.items`) allows any part of an application to access and run registered functions by name.
- **🔗 Dependency Management:** Use the `depends` property to declare dependencies on other `ToolFunc`s, which are then auto-registered.
- **🏷️ Aliasing & Tagging:** Assign multiple names (`alias`) or `tags` to a function for flexibility and grouping.
- **🚀 Lifecycle Hooks:** Use the `setup` method for one-time initialization logic.
- **🔄 Asynchronous Capabilities:** Built-in support for cancellable tasks, timeouts, and concurrency control using `makeToolFuncCancelable`.
- **🌊 Streamable Responses:** Easily create and handle streaming responses with the `stream` property and `createCallbacksTransformer`.

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
    // `this` is the ToolFunc instance, so we can use `runSync`
    const user = this.runSync('userFetcher', { id: params.userId });
    return `Hello, ${user.name}!`;
  },
});

welcomeUser.register();

const message = await ToolFunc.run('welcomeUser', { userId: '456' });
console.log(message); // "Hello, John Doe!"
```

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

### Asynchronous & Cancellable Tasks

Add powerful async capabilities like cancellation and concurrency control.

```typescript
import { ToolFunc, makeToolFuncCancelable, AsyncFeatures } from '@isdk/tool-func';

// Create a cancellable version of the ToolFunc class
const CancellableToolFunc = makeToolFuncCancelable(ToolFunc, {
  maxTaskConcurrency: 5, // Allow up to 5 concurrent tasks
});

const longRunningTask = new CancellableToolFunc({
  name: 'longRunningTask',
  asyncFeatures: AsyncFeatures.Cancelable, // Mark as cancelable
  func: async function(params, aborter) {
    console.log('Task started...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5s task
    aborter.throwIfAborted(); // Check for cancellation
    console.log('Task finished!');
    return { success: true };
  }
});

longRunningTask.register();

// Run the task and get its aborter
const promise = ToolFunc.run('longRunningTask');
const task = promise.task;

// Abort the task after 2 seconds
setTimeout(() => {
  task.abort('User cancelled');
}, 2000);
```

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

While `ToolFunc` allows you to *return* streams, you often need to process the data *within* a stream. The `createCallbacksTransformer` utility creates a `TransformStream` that makes it easy to hook into a stream's lifecycle events. This is useful for logging, data processing, or triggering side effects as data flows through the stream.

It accepts an object with the following optional callback functions:

- `onStart`: Called once when the stream is initialized.
- `onTransform`: Called for each chunk of data that passes through the stream.
- `onFinal`: Called once the stream is successfully closed.
- `onError`: Called if an error occurs during the stream's processing.

Here's how you can use it to observe a stream:

```typescript
import { createCallbacksTransformer } from '@isdk/tool-func';

async function main() {
  // 1. Create a transformer with callbacks
  const transformer = createCallbacksTransformer({
    onStart: () => console.log('Stream started!'),
    onTransform: (chunk) => {
      console.log('Received chunk:', chunk);
      // You can modify the chunk here if needed
      return chunk.toUpperCase();
    },
    onFinal: () => console.log('Stream finished!'),
    onError: (err) => console.error('Stream error:', err),
  });

  // 2. Create a source ReadableStream
  const readableStream = new ReadableStream({
    start(controller) {
      controller.enqueue('a');
      controller.enqueue('b');
      controller.enqueue('c');
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

```
Stream started!
Received chunk: a
Processed chunk: A
Received chunk: b
Processed chunk: B
Received chunk: c
Processed chunk: C
Stream finished!
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

## 🏛️ Core Architecture: Static vs. Instance

A key design principle in `ToolFunc` is the separation of roles between the static class and its instances:

- **The Static Class as Manager:** The static side of `ToolFunc` (e.g., `ToolFunc.register`, `ToolFunc.run`) acts as a global **registry** and **executor**. It manages all tool definitions, allowing any part of your application to discover and run tools by name.

- **The Instance as the Tool:** An instance (`new ToolFunc(...)`) represents a single, concrete **tool**. It holds the actual function logic, its metadata (name, description, parameters), and any internal state.

This separation provides the best of both worlds: the power of object-oriented encapsulation for defining individual tools and the convenience of a globally accessible service for managing and executing them.

## 🤝 Contributing

If you would like to contribute to the project, please read the [CONTRIBUTING.md](./CONTRIBUTING.md) file for guidelines on how to get started.

## 📄 License

The project is licensed under the MIT License. See the [LICENSE-MIT](./LICENSE-MIT) file for more details.
