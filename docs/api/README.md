**@isdk/tool-func**

***

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

Define a tool that can stream its output.

```typescript
import { ToolFunc, createCallbacksTransformer } from '@isdk/tool-func';

const streamingTool = new ToolFunc({
  name: 'streamingTool',
  stream: true, // Enable streaming capability
  func: function(params) {
    const stream = new ReadableStream({
      async start(controller) {
        for (let i = 0; i < 5; i++) {
          controller.enqueue({ chunk: i });
          await new Promise(r => setTimeout(r, 100));
        }
        controller.close();
      }
    });

    // Use a transformer to handle stream events
    const transformer = createCallbacksTransformer({
      onTransform: (chunk) => console.log('Received:', chunk),
      onFinal: () => console.log('Stream finished!'),
    });

    return stream.pipeThrough(transformer);
  }
});

streamingTool.register();
ToolFunc.run('streamingTool');
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

If you would like to contribute to the project, please read the [CONTRIBUTING.md](_media/CONTRIBUTING.md) file for guidelines on how to get started.

## 📄 License

The project is licensed under the MIT License. See the [LICENSE-MIT](_media/LICENSE-MIT) file for more details.
