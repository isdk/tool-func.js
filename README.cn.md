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
    // `this` 是 ToolFunc 实例，所以我们可以使用 `runSync`
    const user = this.runSync('userFetcher', { id: params.userId });
    return `你好, ${user.name}!`;
  },
});

welcomeUser.register();

const message = await ToolFunc.run('welcomeUser', { userId: '456' });
console.log(message); // "你好, 张三!"
```

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

### 异步与可取消任务

添加强大的异步功能，如取消和并发控制。

```typescript
import { ToolFunc, makeToolFuncCancelable, AsyncFeatures } from '@isdk/tool-func';

// 创建 ToolFunc 类的可取消版本
const CancellableToolFunc = makeToolFuncCancelable(ToolFunc, {
  maxTaskConcurrency: 5, // 最多允许 5 个并发任务
});

const longRunningTask = new CancellableToolFunc({
  name: 'longRunningTask',
  asyncFeatures: AsyncFeatures.Cancelable, // 标记为可取消
  func: async function(params, aborter) {
    console.log('任务已开始...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5秒任务
    aborter.throwIfAborted(); // 检查是否已取消
    console.log('任务已完成!');
    return { success: true };
  }
});

longRunningTask.register();

// 运行任务并获取其 aborter
const promise = ToolFunc.run('longRunningTask');
const task = promise.task;

// 2秒后中止任务
setTimeout(() => {
  task.abort('用户取消');
}, 2000);
```

### 流式响应

定义一个可以流式传输其输出的工具。

```typescript
import { ToolFunc, createCallbacksTransformer } from '@isdk/tool-func';

const streamingTool = new ToolFunc({
  name: 'streamingTool',
  stream: true, // 启用流式传输能力
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

    // 使用转换器处理流事件
    const transformer = createCallbacksTransformer({
      onTransform: (chunk) => console.log('收到:', chunk),
      onFinal: () => console.log('流已结束!'),
    });

    return stream.pipeThrough(transformer);
  }
});

streamingTool.register();
ToolFunc.run('streamingTool');
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
