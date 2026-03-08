# @isdk/tool-func

一个功能强大的 TypeScript 框架，用于创建、管理和执行模块化的工具函数。它非常适合用于构建 AI 代理工具、后端服务以及具有清晰、解耦架构的可扩展插件系统。

## ✨ 核心功能

- **📦 模块化与可复用工具:** 将函数定义为包含丰富元数据的 `ToolFunc` 实例。
- **🌐 全局注册表:** 静态注册表 (`ToolFunc.items`) 允许应用程序的任何部分按名称访问和运行已注册的函数。
- **🔗 依赖管理:** 使用 `depends` 属性声明对其他 `ToolFunc` 的依赖，这些依赖项将被自动注册。
- **🏷️ 别名与标签:** 为函数分配多个名称 (`alias`) 或 `tags`，以实现灵活性和分组。
- **🚀 生命周期钩子:** 使用 `setup` 方法执行一次性初始化逻辑。
- **🔄 异步能力:** 使用 `makeToolFuncCancelable` 内置支持可取消的任务、超时和并发控制。
- **🌊 流式响应:** 使用 `stream` 属性和 `createCallbacksTransformer` 轻松创建和处理流式响应。

## 📦 安装

```bash
npm install @isdk/tool-func
```

## 🚀 基本用法

### 1. 定义工具

创建一个 `ToolFunc` 实例来定义工具的元数据和实现。

```typescript
import { ToolFunc } from '@isdk/tool-func';

const getUser = new ToolFunc({
  name: 'getUser',
  description: '根据 ID 检索用户。',
  params: { id: { type: 'string', required: true } },
  func: (params) => ({ id: params.id, name: '张三' }),
});
```

### 2. 注册工具

注册工具，使其在全局注册表中可用。

```typescript
getUser.register();
```

### 3. 运行工具

使用静态 `run` 方法从应用程序的任何位置执行工具。

```typescript
async function main() {
  const user = await ToolFunc.run('getUser', { id: '123' });
  console.log(user); // 输出: { id: '123', name: '张三' }
}

main();
```

## 🌟 高级用法

### 依赖管理

声明对其他工具的依赖，它们将被自动注册。

```typescript
const welcomeUser = new ToolFunc({
  name: 'welcomeUser',
  description: '生成欢迎消息。',
  params: { userId: 'string' },
  depends: {
    // 当 `welcomeUser` 注册时，`getUser` 将被自动注册。
    userFetcher: getUser,
  },
  func: function(params) {
    // `this` 是 ToolFunc 实例，我们使用 `runAsSync` 来运行依赖
    const user = this.runAsSync('userFetcher', { id: params.userId });
    return `你好, ${user.name}!`;
  },
});

welcomeUser.register();

const message = await ToolFunc.run('welcomeUser', { userId: '456' });
console.log(message); // "你好, 张三!"
```

> **💡 提示：局部依赖别名**
> 在 `runAsSync` 或 `runAs` 中，框架会优先匹配 `depends` 映射中的键名（如 `userFetcher`）。这允许您为依赖项定义仅在当前工具内部有效的“局部名称”，而不会污染全局注册表。

### 生命周期钩子: `setup` 方法

`setup` 钩子提供了一种在创建 `ToolFunc` 实例时运行一次性初始化逻辑的方法。这对于在工具被注册或使用之前配置实例、设置初始状态或修改属性非常有用。`setup` 内部的 `this` 上下文指向 `ToolFunc` 实例本身。

```typescript
const statefulTool = new ToolFunc({
  name: 'statefulTool',
  customState: 'initial', // 定义一个自定义属性
  setup() {
    // `this` 是 statefulTool 实例
    console.log(`正在设置 ${this.name}...`);
    this.customState = 'configured';
    this.initializedAt = new Date();
  },
  func() {
    return `状态: ${this.customState}, 初始化于: ${this.initializedAt.toISOString()}`;
  }
});

console.log(statefulTool.customState); // "configured"

statefulTool.register();
console.log(await ToolFunc.run('statefulTool'));
// "状态: configured, 初始化于: ..."
```

### 执行上下文 (Context) 与 并发隔离

在生产级应用中，工具函数通常不是孤立运行的。它们需要感知并响应“执行环境”的变化。例如：在分布式追踪中需要携带 `traceId`，在 Web 服务中需要感知当前 `userId`，或者在长时间任务中需要响应 `AbortSignal` 中止信号。

为了在支持这些复杂需求的同时，又不破坏工具函数本身的纯洁性（即“逻辑与环境分离”），`@isdk/tool-func` 引入了一套基于**原型链影子实例**的上下文管理机制。

#### 1. `ToolFuncContext` 核心接口

上下文对象不仅仅是数据的载体，它还是控制工具执行行为的配置集：

- **`isolated`**: `boolean` (可选)。强制为本次调用开启独立的执行作用域。即便 `ctx` 中没有其他属性，设置为 `true` 也会触发影子实例的创建，确保并发安全性。
- **`inheritContext`**: `boolean` (可选)。控制上下文的自动传播。默认为 `true`。若设为 `false`，则本次调用将拥有一个全新的、不继承父级属性的上下文环境。
- **`signal`**: `AbortSignal` (可选)。标准 Web API。当外部中止操作时，工具内部可以通过 `this.ctx.signal` 捕获并停止运行。
- **`aborter`**: `Aborter` (可选)。自定义的中止器，用于在工具内部捕获并停止运行。 `Cancelable` 能力会使用该上下文。
- **`自定义属性`**: 您可以将任何业务相关的 Metadata（如 `userId`, `traceId`）直接平铺在上下文对象中。

> **⚠️ 关于非纯对象的说明：**
> 如果您传入的 `ctx` 拥有非标准原型（例如它是某个类的实例），框架会通过 `{...ctx}` 对其进行浅拷贝“展平”，然后再挂载到上下文原型链中。这确保了您可以访问其属性，同时维护了上下文的继承结构。

#### 2. 访问上下文：`static ctx` 与 `instance.ctx`

框架在类级别（静态）和对象级别（实例）都维护了 `ctx` 属性，它们的分工非常明确：

- **静态 `ToolFunc.ctx`**: 这是一个全局或代理层级的“默认环境”。当您使用 `ToolFunc.with(ctx)` 时，它会返回一个带此属性的类影子。
- **实例 `this.ctx`**: 这是工具内部逻辑（`func`）访问上下文的**唯一合法入口**。它保证了无论在何种并发下，您拿到的永远是“属于本次调用”的数据。

> **💡 架构设计权衡：为什么不“平铺”上下文？**
> 我们严禁将上下文数据直接挂载到 `this`（如 `this.user`）。因为 `ToolFunc` 实例拥有 `name`, `params`, `title` 等核心元数据。如果上下文里恰巧也有一个 `name` 字段，直接平铺会彻底摧毁工具的定义，导致难以排查的 Bug。`this.ctx` 提供了安全的隔离空间。

#### 3. 核心机制：影子实例 (Shadow Instance)

这是本框架最精妙的设计。为了解决并发冲突，我们没有使用笨重的深拷贝，而是利用了 JavaScript 的**原型链 (Prototype Chain)**。

当您调用 `tool.with({ user: 'Alice' }).run()` 时：

1. **创建影子**：框架执行 `Object.create(tool)`。
2. **注入属性**：在产生的影子对象上挂载 `ctx: { user: 'Alice' }`。
3. **逻辑执行**：影子对象执行 `func`。此时 `this` 指向影子对象，因此 `this.ctx` 返回 Alice；同时，因为原型链的存在，`this.name` 依然能正确访问到原工具定义的名称。

**这种设计的优势：**

- **内存极低**：影子对象只是一个极薄的属性层，不持有逻辑副本。
- **并发安全**：每个影子对象都是独立的。100 个并发请求对应 100 个影子对象，互不干扰。
- **动态继承**：您可以连续调用 `.with().with()`，上下文会形成链式继承。

#### 4. Fluent API 的双重形态

我们提供了链式调用接口，让代码读起来像自然语言：

##### 静态形态：`ToolFunc.with(ctx)`

用于在全局层面或未获取实例时，预设执行环境。它返回的是一个“静态代理类”。

```typescript
// 以后续所有调用都带上当前用户信息
const AuthorizedRunner = ToolFunc.with({ token: 'abc-123', role: 'admin' });

// 执行任意工具，它们都能通过 this.ctx.role 拿到 admin
await AuthorizedRunner.run('deleteUser', { id: 789 });
```

##### 实例形态：`tool.with(ctx)`

用于针对特定工具进行精细化环境配置。它返回的是一个“执行期影子实例”。

```typescript
const uploadTool = ToolFunc.get('uploadFile');

// 为单次上传任务设置追踪 ID 和中止信号
const controller = new AbortController();
const runner = uploadTool.with({
  traceId: 'T-555',
  signal: controller.signal
});

await runner.run({ id: 789 });
```

#### 5. 高级扩展钩子 (面向插件开发者)

如果您正在开发 AoP (面向切面) 插件（如：自动日志、权限拦截、性能追踪），或者需要自定义工具的隔离行为，您需要深入理解以下两个核心内部钩子。它们是框架扩展性的基石：

- **`_shouldIsolate(params, ctx)`**: **影子实例的“准入开关”**。
  - **作用**：决定本次调用是否需要创建一个全新的影子实例。
  - **`ctx` 参数**：特指用户在调用 `run(params, ctx)` 或 `runSync(params, ctx)` 时显式传入的“调用时上下文”。
  - **判断逻辑**：
    1. 如果用户传入了 `ctx`，则必须隔离以应用这些覆盖。
    2. 如果当前实例已经是一个影子实例（拥有自己的 `ctx` 属性），且用户没有传入新的 `ctx`，则不再重复隔离，直接复用。
    3. 如果实例拥有“预设上下文”（通过 `.with()` 设置），则必须隔离。
  - **自定义场景**：您可以重写此方法，根据 `params` 中的特定字段（如 `forceNewScope: true`）来强制开启隔离。

- **`_prepareContext(params, ctx)`**: **上下文的“加工工厂”**。
  - **作用**：在影子实例创建后，负责构建该实例最终持有的 `this.ctx` 对象。
  - **核心逻辑——原型继承**：
    1. 它首先获取“父级上下文”（即当前实例已有的 `this.ctx`）。
    2. 如果 `inheritContext` 配置为 `true`（默认值），它会执行 `Object.create(parentCtx)`。
    3. 这样，新上下文就“继承”了父级的所有属性（如 `traceId`），但又提供了一个空的顶层空间。
    4. 最后，将用户显式传入的 `ctx` 覆盖到这个新对象的顶层。
  - **自定义场景**：插件（如 `Cancelable`）会重写此方法，在这里自动往 `this.ctx` 中注入 `aborter` 或 `logger` 实例，从而实现对业务逻辑透明的功能注入。

> **⚠️ 注意**：在重写这些方法时，务必调用 `super._shouldIsolate` 或 `super._prepareContext` 以保证框架核心功能的正常运行。

#### 6. 上下文的自动传播 (Propagation)

在工具链式调用中（例如工具 A 的实现中调用了 `this.runAs('B')`），上下文会自动流动：

- **默认行为**：B 自动继承 A 的所有 `ctx` 属性。
- **显式控制**：在 `runAs` 时可以传入新的 `ctx`，该 `ctx` 将作为子上下文合并（继承）到当前调用中。
- **位置参数支持**：由于位置参数函数（`runWithPos`）不接受 `ctx` 参数，**必须**通过 `this.with(ctx).runWithPos(...)` 来确保上下文能正确注入。

### 异步与可取消任务

基于上述的上下文机制，`makeToolFuncCancelable` 可以更加优雅地工作。它会自动将 `TaskAbortController` (aborter) 注入到 `this.ctx.aborter` 中。

```typescript
import { ToolFunc, makeToolFuncCancelable, AsyncFeatures } from '@isdk/tool-func';

const CancellableToolFunc = makeToolFuncCancelable(ToolFunc);

const myLongTask = new CancellableToolFunc({
  name: 'myLongTask',
  asyncFeatures: AsyncFeatures.Cancelable,
  func: async function(params) {
    // 从上下文获取 aborter，实现取消逻辑
    const aborter = this.ctx.aborter;

    for (let i = 0; i < 100; i++) {
      await doSomeWork();
      // 检查中止状态
      aborter.throwIfAborted();
    }
    return '完成';
  }
});

myLongTask.register();

// 运行并中途取消
const promise = ToolFunc.run('myLongTask');
const task = promise.task; // 获取任务控制器

setTimeout(() => task.abort('不再需要结果'), 1000);
```

### 流式响应

要创建一个可以流式输出其结果的工具，请遵循以下步骤：

1. **启用流式传输能力**: 在工具的定义中设置 `stream: true`。这会将该工具标记为*具备*流式传输能力。
2. **检查流式传输请求**: 在 `func` 内部，使用 `this.isStream(params)` 方法。该方法会检查当前调用是否被请求为流。默认情况下，它会检查传入参数中是否存在 `stream: true`。
3. **添加控制参数（可选）**: 如果您的工具需要*同时*支持流式和常规值返回，请在 `params` 定义中添加一个 `stream: { type: 'boolean' }` 参数。这允许用户选择返回类型（例如，通过传递 `{ stream: true }`）。如果您的工具*只*支持流式输出，则不需要此参数。

下面的示例演示了一个可以根据请求返回流或单个值的灵活工具。

```typescript
import { ToolFunc } from '@isdk/tool-func';

// 1. 定义工具的流式传输能力
const streamableTask = new ToolFunc({
  name: 'streamableTask',
  description: '一个可以返回值或流的任务。',
  stream: true, // 标记为支持流式传输
  params: {
    // 声明一个 'stream' 参数来控制输出类型
    stream: { type: 'boolean', description: '是否以流的方式输出。' }
  },
  func: function(params) {
    // 2. 检查是否请求了流式传输
    if (this.isStream(params)) {
      // 返回一个 ReadableStream 以进行流式输出
      return new ReadableStream({
        async start(controller) {
          for (let i = 0; i < 5; i++) {
            controller.enqueue(`数据块 ${i}\n`);
            await new Promise(r => setTimeout(r, 100));
          }
          controller.close();
        }
      });
    } else {
      // 如果不是流式传输，则返回一个常规值
      return '一次性完成';
    }
  }
});

// 3. 注册工具
streamableTask.register();

// 4. 以两种模式运行
async function main() {
  console.log('--- 以非流式模式运行 ---');
  const result = await ToolFunc.run('streamableTask', { stream: false });
  console.log('结果:', result); // 输出: 一次性完成

  console.log('\n--- 以流式模式运行 ---');
  const stream = await ToolFunc.run('streamableTask', { stream: true });

  // 5. 消费流
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log('流已结束。');
      break;
    }
    process.stdout.write(value); // 输出: 数据块 0, 数据块 1, ...
  }
}

main();
```

### 使用 `createCallbacksTransformer` 处理流事件

虽然 `ToolFunc` 允许您*返回*流，但您通常还需要处理流*内部*的数据。`createCallbacksTransformer` 实用工具可以创建一个 `TransformStream`，让您能够轻松地挂接到流的生命周期事件中。这对于在数据流经时进行日志记录、数据处理或触发副作用非常有用。

它接受一个包含以下可选回调函数的对象：

- `onStart`: 在流初始化时调用一次。
- `onTransform`: 对于流经的每个数据块调用。
- `onFinal`: 在流成功关闭时调用一次。
- `onError`: 在流处理过程中发生错误时调用。

以下是如何使用它来观察流：

```typescript
import { createCallbacksTransformer } from '@isdk/tool-func';

async function main() {
  // 1. 使用回调创建一个转换器
  const transformer = createCallbacksTransformer({
    onStart: () => console.log('流已开始！'),
    onTransform: (chunk) => {
      console.log('收到数据块:', chunk);
      // 如果需要，您可以在此处修改数据块
      return chunk.toUpperCase();
    },
    onFinal: () => console.log('流已结束！'),
    onError: (err) => console.error('流错误:', err),
  });

  // 2. 创建一个源 ReadableStream
  const readableStream = new ReadableStream({
    start(controller) {
      controller.enqueue('a');
      controller.enqueue('b');
      controller.enqueue('c');
      controller.close();
    },
  });

  // 3. 将流通过转换器进行管道传输
  const transformedStream = readableStream.pipeThrough(transformer);

  // 4. 从转换后的流中读取结果
  const reader = transformedStream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    console.log('处理后的数据块:', value);
  }
}

main();
```

此示例将输出：

```sh
流已开始！
收到数据块: a
处理后的数据块: A
收到数据块: b
处理后的数据块: B
收到数据块: c
处理后的数据块: C
流已结束！
```

### 参数处理：对象参数与位置参数

`ToolFunc` 支持基于对象和位置的参数，以提供灵活性。虽然两者都可用，但**通常推荐使用对象参数**，因为它们更清晰且具有自文档性。

#### 对象参数（推荐）

当 `params` 定义为对象时，`func` 会接收一个包含所有命名参数的单一对象参数。这是默认且最直接的方法。

```typescript
const greetUser = new ToolFunc({
  name: 'greetUser',
  description: '根据姓名和年龄问候用户。',
  params: {
    name: { type: 'string', required: true },
    age: { type: 'number' },
  },
  func: (args) => {
    const { name, age } = args;
    return `你好, ${name}! ${age ? `你今年 ${age} 岁。` : ''}`;
  },
});

greetUser.register();
console.log(await ToolFunc.run('greetUser', { name: '爱丽丝', age: 30 }));
// 输出: "你好, 爱丽丝! 你今年 30 岁。"
```

#### 位置参数

如果 `params` 定义为 `FuncParam` 对象的数组，`func` 将按照定义的顺序接收参数。这对于参数数量固定且较少，并且顺序直观的函数很有用。

```typescript
const addNumbers = new ToolFunc({
  name: 'addNumbers',
  description: '将两个数字相加。',
  params: [
    { name: 'num1', type: 'number', required: true },
    { name: 'num2', type: 'number', required: true },
  ],
  func: (num1, num2) => num1 + num2,
});

addNumbers.register();
console.log(await ToolFunc.runWithPos('addNumbers', 5, 3)); // 使用 runWithPos 处理位置参数
// 输出: 8
```

**建议：** 对于大多数用例，将 `params` 定义为对象并在 `func` 中按名称访问参数更清晰且不易出错，尤其当函数的参数列表变长时。

## 🏛️ 核心架构：静态与实例

`ToolFunc` 的一个关键设计原则是静态类和实例之间的角色分离：

- **作为管理者的静态类:** `ToolFunc` 的静态部分（例如 `ToolFunc.register`, `ToolFunc.run`）充当全局的**注册表**和**执行器**。它管理所有工具的定义，允许您的应用程序的任何部分按名称发现和运行工具。

- **作为工具的实例:** 一个实例 (`new ToolFunc(...)`) 代表一个单一的、具体的**工具**。它持有实际的函数逻辑、其所有的元数据（名称、描述、参数）以及任何内部状态。

这种分离提供了两全其美的优势：既有用于定义单个工具的面向对象封装的能力，又有用于管理和执行它们的全局可访问服务的便利性。

## 🤝 贡献

如果您想为项目做出贡献，请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 文件以获取有关如何开始的指南。

## 📄 许可证

该项目根据 MIT 许可证授权。有关更多详细信息，请参阅 [LICENSE-MIT](./LICENSE-MIT) 文件。
