# @isdk/tool-func

一个功能强大的 TypeScript 框架，用于创建、管理和执行模块化的工具函数。它非常适合用于构建 AI 代理工具、后端服务以及具有清晰、解耦架构的可扩展插件系统。

## ✨ 核心功能

- **📦 模块化与可复用工具:** 将函数定义为包含丰富元数据的 `ToolFunc` 实例，清晰分离静态管理与实例逻辑。
- **🌐 全局注册表:** 静态注册表 (`ToolFunc.items`) 允许应用程序的任何部分按名称访问和运行已注册的函数。
- **🏛️ 分层注册表与多态:** 支持通过原型链隔离注册表 (`isolateRegistry`)，允许插件系统“影子遮蔽”父级工具，并提供智能晚绑定以确保依赖的多态性与同级稳定性。
- **🔗 依赖管理:** 使用 `depends` 属性声明对其他 `ToolFunc` 的依赖，支持局部别名，且依赖项将被自动注册。
- **🔢 引用计数注册:** 允许多个模块共享同一个工具，自动管理依赖生命周期，仅在所有引用都释放后才真正注销。
- **⚖️ 受控覆盖:** 显式支持 `allowOverride` 模式，在保持依赖链完整性的同时安全更新工具实现（如热更新）。
- **🧩 执行上下文与并发隔离:** 利用原型链“影子实例”实现极低内存开销的并发安全。通过 `this.ctx` 安全访问环境数据（如 traceId、signal），支持 `tool.with(ctx)` 链式 API 传递上下文。
- **🔄 异步与可取消任务:** 通过 `makeToolFuncCancelable` 透明集成中止能力。每次调用自动注入 `aborter`，支持超时、AbortSignal 联动，并返回 `task` 句柄供外部控制生命周期。
- **🌊 流式响应:** 使用 `stream` 属性轻松创建流式输出。配合 `createCallbacksTransformer` 处理流事件，享受统一清理钩子与零拷贝优化。
- **🚀 生命周期钩子:** 安装 `makeToolFuncLifecycle` 后，`setup` 与 `dispose` 钩子函数会变成一个对称的、由注册表驱动的生命周期
  （接口面比较紧，支持异步 setup、就绪门禁与显式 teardown）。
- **🧬 灵活的参数归一化:** 构造与注册时支持智能模式识别（字符串、函数、对象）与深度合并，轻松组合工具元数据。
- **🔀 双模式参数支持:** 同时支持语义清晰的对象参数（`run`）与固定顺序的位置参数（`runWithPos`）。
- **🏷️ 别名与标签:** 为函数分配多个名称 (`alias`) 或 `tags`，以实现灵活性和分组。

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
console.log(message); // 输出: "你好, 张三!"
```

> **💡 提示：局部依赖别名**
> 在 `runAsSync` 或 `runAs` 中，框架会优先匹配 `depends` 映射中的键名（如 `userFetcher`）。这允许您为依赖项定义仅在当前工具内部有效的“局部名称”，而不会污染全局注册表。

### 生命周期钩子: 完整的 setup / dispose 生命周期

一个普通的 `ToolFunc` 会存放 `setup` 和 `dispose` 这两个钩子函数，但**不会调用它们**；它们只是配置字段。
请在你实际使用的注册表类上安装一次生命周期能力 `const Tools = makeToolFuncLifecycle(ToolFunc)`，
此时这两个钩子就变成了一个对称的、由注册表驱动的生命周期：

- **`register()`** 会运行 `setup`（幂等的，每个注册生命周期仅运行一次，发生在实例被放入注册表之后）。
  它可以修改收到的 options 对象；它所触碰的键会通过同一条 `initialize` / `assign` 流水线被回放到实例上。
- **`scope` 是编译期输入**：`func` 会以工具的 `scope` 为作用域编译（其中每个键都会成为函数的
  闭包变量，`this` 键则成为函数的 `this`），而这些值在编译时就被捕获。因此，`setup` 提供的 `scope`
  —— 无论通过 `this.scope` 还是通过 options 对象 —— 都会在 func 编译**之前**生效，与 `setup` 仍运行在
  构造函数中时的行为完全一致。
- **`dispose`** 是其准确逆操作：当工具被真正移除（引用计数归零，或使用了 `force`）时，它的清理逻辑会运行；
  返回的 Promise 会被追踪，拒绝异常会被记录而非抛出。
- **同步只发起，异步才等待**：`unregister()` 与 `Tools.clear()` 是同步入口，因此只能**发起** teardown；
  `unregisterAsync()` 与 `Tools.clearAsync()` 会等到结束 —— 工具自身的 `dispose` **以及**串行排在它之后的
  依赖释放。所以在 `clear()` 下，依赖的异步销毁会与持有者的重叠；`clearAsync()` 正是为此存在，它会把
  整层的失败聚合为一个 `AggregateError`。
- **销毁顺序**：工具会在它所声明的依赖**之前**被销毁，而这些依赖按声明顺序**倒序**释放。
  依赖必须比所有使用它的东西活得更久，所以持有者的 `dispose` 仍能看到活着的依赖，把 `setup` 取走的东西还回去
  —— 先停掉定时器，再关掉它查询的连接池。请按依赖顺序声明（被依赖者写在使用者之前）：
  这一条约定同时让获取顺序与释放顺序（其倒序）都正确。`Tools.clear()` / `Tools.clearAsync()` 会用同一顺序
  释放这一层所拥有的每个工具，而不再只是把表换掉。
- **重置（re-arm）**：一旦 `dispose` 成功，整个生命周期都会为**下一次**注册重新准备好，所以每一次
  unregister / register 循环都会重新运行 `setup`，并在下一个循环里再次被销毁。带有 `dispose` 钩子的实例
  是严格配对的：在调用 `register()` 之前就运行它，会被当作一个错误。
- **`cleanup` —— `dispose` 的调用期孪生钩子**：`setup`/`dispose` 绑定的是实例的**注册**生命周期，
  而 `cleanup` 绑定的是**单次调用**。声明它即可释放该次调用所获取的一切，且在每条终止路径上**恰好一次**：
  同步返回或抛出、Promise 落定（成功与拒绝皆是）、返回的 `ReadableStream`（结束、出错或被取消时），
  以及调用信号被中止时 —— 被取消的调用不会展开自己的调用栈，所以 `finally` 永远不会执行。
  函数体把本次调用的资源挂在 `this` 上（`this.tx = begin()`），`cleanup` 释放的正是这些资源；
  声明该钩子还会让每次调用运行在自己独立的 shadow 实例上，因此并发调用不会互相覆盖。
  请把它写得防御一些（`this.tx?.commit()`），因为即使函数体在获取任何资源之前就抛出，它也会被调用。
  同步入口只能**发起**异步释放（其拒绝会被记录）；`run()`/`runWithPos()` 本就返回 Promise，
  因此只有在 cleanup 落定后才会 resolve。当函数体**与** cleanup 同时失败时，该次调用只会报告一个 `AggregateError`。
- **异步 setup**：如果 `setup` 返回了一个 Promise，该实例会进入 *pending* 状态。
  `run()` / `runWithPos()` 会自动等待它；`runSync()` / `runWithPosSync()` 则会拒绝运行，
  并指引你改用异步入口（`run()` / `await tool.ready`）。
  **静态辅助方法** `registerAsync()`、`createAsync()`、`awaitReady()` 和 `whenAllReady()` 会等待 setup
  （前两者还包括整个依赖树）。

每个已注册工具上的**实例侧接口**：`ensureSetup()` / `ensureDispose()`、
`isSetupDone()` / `isSetupPending()`、`registerAsync()` / `unregisterAsync()`，
以及 `ready` 和 `disposed` 这两个 Promise。
**静态侧接口**：`Tools.registerAsync(...)`、`Tools.unregisterAsync(...)`、
`Tools.createAsync(...)`、`Tools.clearAsync()`、`Tools.awaitReady(name)` 和 `Tools.whenAllReady()`。

```typescript
import { ToolFunc, makeToolFuncLifecycle } from '@isdk/tool-func';

const Tools = makeToolFuncLifecycle(ToolFunc);

const db = new Tools({
  name: 'db',
  setup() {
    // 在 register() 时运行，而不是构造函数里；这里的 this 仍然是实例本身
    this.conn = connect();
  },
  dispose() {
    this.conn.close();
  },
  func() {
    return this.conn.query('select 1');
  },
});

db.register();             // <- 此时运行 setup()
await Tools.run('db');     // 到 func 运行时，setup 已经完成了
db.unregister();           // <- 此时运行 dispose()

// 异步 setup：实例会保持 pending，直到 setup 落定。
const slow = new Tools({
  name: 'slow',
  async setup() { this.readyAt = await Promise.resolve('now'); },
  func() { return this.readyAt; },
});
// slow.runSync() 会抛出；请改用异步接口：
await Tools.registerAsync(slow);        // 等待 setup（及依赖）落定
await Tools.whenAllReady();             // 等待注册表里每个工具都就绪
await Tools.createAsync({ name: 'temp', setup() { /* ... */ } });  // 创建并执行 setup，但不注册

// 调用期资源：`cleanup` 是 `dispose` 的调用期孪生钩子。
const tx = new Tools({
  name: 'tx',
  func() {
    this.tx = db.begin();   // 由函数体在需要时（且仅在需要时）获取
    return this.tx.query('select 1');
  },
  cleanup() { return this.tx?.commit(); },  // 调用结束时运行，无论以何种方式结束
});
await tx.run();  // 只有在 cleanup() 落定之后才会 resolve
```

> **⚠️ 裸实例在生命周期上是无操作的。**
> `new ToolFunc({ setup(){...}, dispose(){...} }).register()` 不会对钩子做任何处理。
> 如果你需要生命周期，请始终从已用 `makeToolFuncLifecycle` 加强过的注册表类（
> 或其子类）进行构造。

### 调用期作用域：`cleanup` 与它的四条终止路径

`setup`/`dispose` 是**注册期**作用域 —— 每次注册一个资源生命周期；`cleanup` 则是**调用期**作用域
—— 每次 `run()` 一个资源生命周期。声明它，框架就会在调用结束时**恰好一次**地关闭该作用域，
无论这次调用以何种方式结束：

| 终止路径 | `cleanup` 何时运行 |
| --- | --- |
| 同步返回 | 函数体返回其值之后立即运行 |
| 同步抛出 | 在抛出路径中、错误被重新抛出之前运行 |
| 异步函数体（Promise） | 落定之后 —— 成功与拒绝皆是；`run()` 只会在释放落定后 resolve |
| 返回 `ReadableStream` | 流结束、出错或被消费者取消时 |
| 调用信号被中止 | `ctx.signal` / `ctx.aborter.signal` 触发的那一刻 |

后两条正是 `try/finally` 无法表达、因而必须由框架承担的：

- **流的值在被消费之前就已经产生。** `finally` 在函数体**返回**流时就运行了 —— 那时消费者还没拿到
  任何一个 chunk。作用域会一直保持打开，直到流本身关闭：框架会把它经过一层 identity
  `TransformStream`，其 `onClose` 就是释放点。
- **被取消的调用不会展开自己的调用栈。** `AbortSignal` 只是*通知*，不会穿过你的栈帧抛异常，
  所以 `finally` 永远不会运行。因此由信号来关闭作用域。

几条需要知道的语义：

- **恰好一次。** 每条终止路径都汇入同一个释放，所以先被中止、随后又被取消的流也只释放一次。
- **`this` 是该次调用的 shadow 实例。** 声明 `cleanup` 同时会强制调用期隔离，因此函数体挂在 `this`
  上的字段是该次调用私有的 —— 并发调用不会互相覆盖。要把同一个资源共享给嵌套调用，请走 `this.ctx`，
  `runAs` 的目标会继承它。
- **请写得防御一些。** 即使函数体在获取任何资源之前就抛出，`cleanup` 依然会被调用，所以要加保护
  （`this.tx?.commit()`）。
- **嵌套顺序。** 嵌套的 `runAs`/`runAsSync` 子调用在自己的调用结束时释放自己的作用域 —— 早于父调用继续，
  因此也早于父调用释放。当父调用 `await` 该子调用时，父调用恢复执行时子调用的异步释放已经落定。
- **同步只发起，异步才等待。** 与 `unregister()` 一致，同步入口只能**发起**异步释放（其拒绝会被记录，
  永不抛出）；`run()`/`runWithPos()` 本就返回 Promise，因此只会在 cleanup 落定后 resolve。
- **只有一个错误，而不是两个。** 如果函数体**与** cleanup 同时失败，该次调用只会报告一个
  `AggregateError`，同时携带两者。

### 注册生命周期与引用计数

在复杂的插件系统中，多个工具可能会共享同一个底层依赖。为了安全地管理这些共享工具，`@isdk/tool-func` 引入了**引用计数 (Reference Counting)** 机制。

#### 1. 引用计数的工作原理

- **`register()`**: 每次调用注册时，该工具名称对应的引用计数加 1。如果工具已存在且未开启覆盖模式，它仅增加计数并返回 `false`（表示未创建新实例）。
- **`unregister()`**: 每次调用注销时，引用计数减 1。只有当计数归零时，该工具才会从全局注册表中物理移除。
- **强制注销**: 使用 `ToolFunc.unregister(name, true)` 或 `unregister({ force: true })` 可以跳过计数直接移除工具。

#### 2. 自动依赖生命周期

当您注册一个带有 `depends` 的工具时，框架会自动处理依赖项的生命周期：

- **自动注册**: 注册父工具时，所有 `ToolFunc` 实例类型的依赖项都会被自动注册（引用计数加 1）。
- **自动注销**: 当父工具被彻底移除（引用计数归零）时，它会自动触发对所有依赖项的注销请求（引用计数减 1）。

这确保了只要还有一个父工具在运行，其依赖的子工具就不会被意外卸载。

> **🔧 内部约定：通过 `options._stack` 进行循环依赖检测（插件开发者）**
>
> 当工具声明了 `depends` 时，注册过程会递归进入每个依赖。为了终止循环链（A → B → A），
> 框架会在递归的 `register` 调用中传递一个内部**栈** —— 一个记录“当前正在注册的祖先名称”的 `Set`：
>
> - **传递方式**: 栈通过 `options._stack` 传递（可以放在第一参配置对象里，也可以放在第二参 options 中）。
>   它会在归一化过程中被**消费并移除**（见 `_extractStack`），因此永远不会成为实例状态，也永远不会被序列化。
> - **回边行为**: 如果某个名称已经在栈中，`register` 会返回 `false` ——
>   表示该工具已在当前调用链中注册，跳过重复进入。
> - **如果您重写 `register()` / `_acquireDependencies()`**: 请继续通过 options 对象中的 `{ _stack: stack }`
>   传递栈 —— 不要新增第三个参数。被消费的只是包裹对象，`Set` 本身会原样穿透递归。

#### 3. 实现覆盖 (Override)

如果您需要动态更新一个已注册工具的逻辑（例如热更新或插件替换），可以使用 `allowOverride` 选项：

```typescript
// 第一次注册
ToolFunc.register({ name: 'calc', func: () => 1 });

// 尝试覆盖（如果不加 allowOverride，此操作仅增加引用计数，不会替换逻辑）
ToolFunc.register({
  name: 'calc',
  func: () => 2,
  allowOverride: true // 强制替换现有实现
});

console.log(ToolFunc.runSync('calc')); // 输出: 2
```

> **⚠️ 注意**: 如果被覆盖的工具正被其他引用持有（引用计数 > 1），框架会发出警告。覆盖操作是原子的：如果新工具的别名与现有其他工具冲突，覆盖将失败并保持旧版本。

### 分层注册表与影子遮蔽 (Shadowing)

对于具有插件架构或多租户环境的复杂系统，您可能需要隔离某些工具，同时仍从父注册表继承其他工具。`@isdk/tool-func` 支持使用 JavaScript 原型链的**分层注册表 (Hierarchical Registries)**。

#### 1. 隔离您的注册表

使用 `ToolFunc.isolateRegistry()` 从父级分支当前注册表。这会创建一个新的作用域，其中注册是局部的，但父级工具仍然可见（并且可以被遮蔽）。

```typescript
class MyPluginTools extends ToolFunc {
  static {
    // 隔离注册表：隔离项目、别名和引用计数
    this.isolateRegistry();
  }
}

// 父级拥有 'global-tool'
ToolFunc.register('global-tool', { func: () => 'global' });

// MyPluginTools 继承 'global-tool' 但可以注册自己的 'local-tool'
MyPluginTools.register('local-tool', { func: () => 'local' });

console.log(MyPluginTools.get('global-tool')); // 返回全局工具
console.log(MyPluginTools.get('local-tool'));  // 返回局部工具
console.log(ToolFunc.get('local-tool'));       // undefined (已隔离！)
```

#### 2. 工具影子遮蔽 (多态性)

当注册表被隔离时，您可以注册一个与父级同名的工具。这会在当前作用域内“遮蔽 (Shadowing)”父级工具。

```typescript
// 遮蔽父级的 'calc' 工具
MyPluginTools.register('calc', { func: () => 'plugin-version' });

console.log(ToolFunc.runSync('calc'));       // 原始版本
console.log(MyPluginTools.runSync('calc'));  // 插件版本
```

#### 3. 命名空间保护

如果您想确保名称全局唯一并防止意外遮蔽，请使用 `allowOverride: false`。注册表将检查整个原型链，如果名称已被占用则抛出错误。

```typescript
MyPluginTools.register('global-tool', {
  func: () => 'oops',
  allowOverride: false // 报错，因为 'global-tool' 存在于父级中
});
```

#### 4. 作用域注销 (Scoped Unregistration)

`unregister` 方法支持 `scope` 选项，以控制移除工具的深度：

- **`scope: 'local'` (默认)**: 仅当工具被当前注册表“拥有”时才将其移除。如果您注销一个影子工具，父级工具将重新出现。
- **`scope: 'inherited'`**: 沿原型链向上查找并移除第一个匹配项。
- **`scope: 'all'`**: 从当前注册表及其所有父级中移除该工具。

#### 5. 智能晚绑定与绑定策略 (Late-Binding Polymorphism)

在复杂的插件系统中，父类工具可能依赖于其他工具。当子类“影子覆盖”了这些依赖项时，系统能够通过 `rootRegistry` (根调用者) 智能感知并切换。

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
    // 影子覆盖依赖项
    this.register({ name: 'dep', func: () => 'child-dep' });
  }
}

// 自动模式：子类调用继承工具时，自动使用子类的影子版本
console.log(Child.runSync('main'));  // 输出: "child-dep"
console.log(Parent.runSync('main')); // 输出: "parent-dep" (同级稳定性保护)
```

您可以通过执行上下文 `ctx.binding` 显式控制依赖绑定的粒度：

- **`'auto'` (默认)**: **智能感知**。仅当“根调用者”是“定义者”的后代且定义了同名影子时，才切换到晚绑定。这既实现了插件的多态性，又保护了同级调用时的依赖稳定性。
- **`'early'`**: **早绑定 (安全性优先)**。始终使用注册时锁定的原始依赖实例，不受任何影子干扰。
- **`'late'`**: **晚绑定 (环境优先)**。无视血缘关系，强制从当前根调用者的注册表重新解析依赖。

```typescript
// 强制使用父类的原始依赖，即便子类有影子
Child.runSync('main', {}, { binding: 'early' }); // 输出: "parent-dep"
```

### 执行上下文 (Context) 与 并发隔离

在生产级应用中，工具函数通常不是孤立运行的。它们需要感知并响应“执行环境”的变化。例如：在分布式追踪中需要携带 `traceId`，在 Web 服务中需要感知当前 `userId`，或者在长时间任务中需要响应 `AbortSignal` 中止信号。

为了在支持这些复杂需求的同时，又不破坏工具函数本身的纯洁性（即“逻辑与环境分离”），`@isdk/tool-func` 引入了一套基于**原型链影子实例**的上下文管理机制。

#### 1. `ToolFuncContext` 核心接口

上下文对象不仅仅是数据的载体，它还是控制工具执行行为的配置集：

- **`isolated`**: `boolean` (可选)。内核实现，强制为本次调用开启独立的执行作用域。即便 `ctx` 中没有其他属性，设置为 `true` 也会触发影子实例的创建，确保并发安全性。
- **`inheritContext`**: `boolean` (可选)。内核实现，控制上下文的自动传播。默认为 `true`。若设为 `false`，则本次调用将拥有一个全新的、不继承父级属性的上下文环境。
- **`signal`**: `AbortSignal` (可选)。建议，标准 Web API。当外部中止操作时，工具内部可以通过 `this.ctx.signal` 捕获并停止运行。
- **`signals`**: `AbortSignal[]` (可选)。建议，支持传入多个中止信号，其中任何一个信号中止都会触发任务停止。
- **`aborter`**: `Aborter` (可选)。建议，自定义的中止器。注入`Cancelable` 能力后会自动在此处注入并管理任务生命周期。
- **`自定义属性`**: 您可以将任何业务相关的 Metadata（如 `userId`, `traceId`）直接平铺在上下文对象中。

> **⚠️ 关于非纯对象的说明：**
> 如果您传入的 `ctx` 拥有非标准原型（例如它是某个类的实例），框架会通过 `{...ctx}` 对其进行浅拷贝“展平”，然后再挂载到上下文原型链中。这确保了您可以访问其属性，同时维护了上下文的继承结构。

#### 2. 访问上下文：`static ctx` 与 `instance.ctx`

框架在类级别（静态）和对象级别（实例）都维护了 `ctx` 属性，它们的分工非常明确：

- **静态 `ToolFunc.ctx`**: 这是一个全局或代理层级的“默认环境”。当您使用 `ToolFunc.with(ctx)` 时，它会返回一个带此属性的类影子。
- **实例 `this.ctx`**: 这是工具内部逻辑（`func`）访问上下文的**唯一合法入口**。它保证了无论在何种并发下，您拿到的永远是“属于本次调用”的数据。

> **💡 架构设计权衡：为什么不“平铺”上下文？**
> 我们严禁将上下文数据直接挂载到 `this`（如 `this.user`）。因为 `ToolFunc` 实例拥有 `name`, `params`, `title` 等核心元数据。如果上下文里恰巧也有一个 `name` 字段，直接平铺会彻底摧毁工具的定义，导致难以排查的 Bug。`this.ctx` 提供了安全的隔离空间。

#### 3. 核心机制：影子实例 (Shadow Instance) 与 原始追踪 (_origin)

这是本框架最精妙的设计。为了解决并发冲突，我们没有使用笨重的深拷贝，而是利用了 JavaScript 的**原型链 (Prototype Chain)**。

当您调用 `tool.with({ user: 'Alice' }).run()` 时：

1. **创建影子**：框架执行 `Object.create(tool)`。
2. **原始追踪**：每个影子实例内部都有一个隐藏的 `_origin` 属性指向最顶层的原始工具实例（即通过 `new ToolFunc()` 创建的那个对象）。这确保了即便在复杂的嵌套影子中，并发控制状态（如信号量、运行中任务数）依然能由原始工具统一管理，避免“状态漂移”。
3. **注入上下文**：在产生的影子对象上挂载 `ctx`。为了保护用户传入的原始 `ctx` 对象不被修改，框架会通过 `Object.create(parentCtx)` 和属性合并创建一个新对象作为本次调用的 `this.ctx`。
4. **逻辑执行**：影子对象执行 `func`。此时 `this` 指向影子对象，因此 `this.ctx` 返回 Alice；同时，因为原型链的存在，`this.name` 依然能正确访问到原工具定义的名称。

**这种设计的优势：**

- **状态同步**：通过 `_origin` 确保了单实例并发上限（`maxTaskConcurrency`）等状态在所有影子实例间全局有效，不会因为创建了影子而丢失对原始资源计数的追踪。
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

- **`_shouldIsolate(params, ctx)`**: **影子实例的“准入开关”**。决定本次调用是否需要创建一个全新的影子实例。
  - **优先级判定逻辑**：
    1. **最高优先级**：显式传入的 `ctx.isolated`。如果为 `true`，强制隔离。
    2. **安全模式**：只要调用时传入了任何 `ctx` 覆盖属性，默认隔离以确保应用新环境且不污染原型。
    3. **递归保护**：如果当前实例已经是一个影子实例（拥有自有属性 `ctx`），且没有新的隔离要求，则复用现有实例，避免无限嵌套。
    4. **预置配置**：检查实例原型链上预设的 `this.ctx.isolated` 配置。
    5. **兜底**：如果存在任何有效的上下文，默认开启并发安全隔离。

- **`_prepareContext(params, ctx)`**: **上下文的“加工工厂”**。负责构建影子实例最终持有的 `this.ctx` 对象。
  - **核心步骤**：
    1. **获取父级**：首先获取“父级上下文”（当前实例已有的 `this.ctx`）。
    2. **建立继承**：如果允许继承，执行 `Object.create(parentCtx)` 建立原型链继承。这确保了父级属性可见，且严禁直接使用 `Object.assign` 覆盖，否则会丢失原型链上的数据。
    3. **能力注入 (AOP)**：这是插件最关键的切入点。例如 `Cancelable` 插件会在此处自动注入 `aborter` 实例。**注意**：内核调用必须走实例路径（`this._prepareContext`）才能触发插件钩子。
    4. **属性覆盖**：最后将用户传入的 `ctx` 浅拷贝合并到顶层。

  > **⚠️ 提示**：在重写这些方法时，务必调用 `super._shouldIsolate` 或 `super._prepareContext` 以保证框架核心功能和插件链的正常运行。

#### 6. 上下文的自动传播 (Propagation)

在工具链式调用中（例如工具 A 的实现中调用了 `this.runAs('B')`），上下文会自动流动：

- **默认行为**：B 自动继承 A 的所有 `ctx` 属性。
- **显式控制**：在 `runAs(params?, ctx?: ToolFuncContext)` 时可以传入新的 `ctx`，该 `ctx` 将作为子上下文合并（继承）到当前调用中。
- **位置参数支持**：由于位置参数函数（`runWithPos`）不接受 `ctx` 参数，**必须**通过 `this.with(ctx).runWithPos(...)` 来确保上下文能正确注入。

### 异步与可取消任务

在处理 AI 代理请求、大数据处理或复杂的异步工作流时，任务往往耗时较长。**可取消能力 (Cancelable Ability)** 允许开发者在任务运行中途将其安全中止，避免无效的计算和资源浪费。

#### 1. 核心机制：透明的上下文集成

通过 `makeToolFuncCancelable` 动态赋予工具函数“可取消”能力后，框架会自动参与执行上下文的构建：

- **自动注入**: 每次调用工具时，框架会在影子实例的 `this.ctx` 中自动注入一个 `TaskAbortController` (简称 `aborter`)。
- **环境隔离**: 每个并发任务拥有独立的中止器，互不干扰。
- **信号联动**: 如果上下文 (`ctx`) 中传入了外部的 `signal` 或 `signals`，注入的 `aborter` 会自动与这些信号链接。只要外部信号中止，内部任务将立即感知。

#### 2. 使用示例

下面的示例展示了如何定义一个支持中止的长耗时循环任务：

```typescript
import { ToolFunc, makeToolFuncCancelable, AsyncFeatures } from '@isdk/tool-func';

// 1. 赋予 ToolFunc 类可取消的能力
const CancellableToolFunc = makeToolFuncCancelable(ToolFunc);

// 2. 定义具体的长耗时工具
const myLongTask = new CancellableToolFunc({
  name: 'myLongTask',
  asyncFeatures: AsyncFeatures.Cancelable, // 声明开启取消特性
  func: async function(params) {
    // 从上下文获取自动注入的 aborter
    const aborter = this.ctx.aborter;

    for (let i = 0; i < 100; i++) {
      // 执行实际工作
      await doSomeWork();

      // 核心步骤：检查中止状态。如果已中止，此处会抛出 AbortError
      aborter.throwIfAborted();
    }
    return '任务成功完成';
  }
});

myLongTask.register();

// 3. 运行任务并获取控制句柄
// 异步执行会返回一个带 .task 属性的 Promise
const promise = ToolFunc.run('myLongTask');
const task = promise.task; // 获取本次调用的任务控制器

// 模拟在 1 秒后发现不再需要结果，发起中止
setTimeout(() => task.abort('不再需要结果'), 1000);

try {
  await promise;
} catch (err) {
  console.log(err.message); // 输出: "不再需要结果"
}
```

#### 3. 关键点解析

- **`aborter.throwIfAborted()`**: 这是推荐的检查方式。它能确保在中止发生时，业务逻辑能以标准的 `AbortError` 退出，从而触发正确的资源清理流程。
- **任务句柄 (Task Handle)**: `ToolFunc.run` 返回的 Promise 上挂载了 `task` 对象。这使得调用者无需深入了解上下文细节，即可直接通过句柄控制任务生命周期。
- **超时支持**: 您可以在调用时直接传入 `timeout` 参数（通过 `params` 或 `ctx`），框架会自动设置定时器并在超时后触发 `aborter.abort()`。

#### 4. 中止的 reject 与 unhandled rejection 防护

任务被中止（`timeout`、外部 `signal` 或显式 `task.abort()`）时，返回的 `TaskPromise` 会以 `AbortError` **reject**。当多个并发任务**共享同一个 aborter** 时——例如在同一个 `tool.with(ctx)` 返回的 runner 上并发调用 `run()`，或一个外部信号 / 超时同时作用于整组任务——它们会在几乎同一时刻一起 reject。

框架**有意不吞掉**这些 reject：否则会掩盖真正的任务失败，也会让 Node 的 `unhandledRejection` 诊断失效。因此**调用方必须为每个可能 reject 的任务 Promise 挂上处理器**。请在 await 任何一个之前，先给**所有**任务挂好处理器；否则尚未被 await 的那些任务会被记为 unhandled rejection（在 Node 默认的 `--unhandled-rejections=throw` 下甚至可能导致进程退出）：

```typescript
const p1 = runner.run({ timeout: 40 })
const p2 = runner.run() // 共享 runner 的 aborter → 与 p1 一起 reject

// ❌ 在 await p1 期间，p2 可能已经 reject，从而变成 unhandled rejection
// await p1
// await p2

// ✅ 先给两者都注册处理器，再 await。
await Promise.allSettled([p1, p2])

// 或者需要拿到已 settle 的值：
const [r1, r2] = await Promise.all([p1.catch(e => e), p2.catch(e => e)])
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

虽然 `ToolFunc` 允许您*返回*流，但您通常还需要处理流*内部*的数据，或者确保健壮的资源清理。`createCallbacksTransformer` 实用工具可以创建一个 `TransformStream`，让您能够轻松地挂接到流的生命周期事件中。

#### 核心特性

- **统一清理钩子**：`onClose` 钩子保证只执行一次，无论流是以何种方式结束（成功、错误或取消）。这是释放 `ActiveTaskHandle` 等资源的理想位置。
- **零拷贝优化**：如果您省略了 `onTransform`，转换器将表现为高性能的“恒等转换 (Identity Transform)”，让数据以极低的开销通过。
- **RPC 与取消友好**：显式支持 `onCancel` 钩子，用于检测客户端断开连接或主动中止。

#### 回调函数

- `onStart(controller)`: 在流初始化时调用一次。
- `onTransform(chunk, controller)`: 为每个数据块调用（省略此项以启用零拷贝路径）。
- `onFinal(controller)`: 在流成功关闭（上游 `close`）时调用一次。
- `onCancel(reason)`: 在读取端取消流时调用。
- `onError(err)`: 在发生错误时调用。
- `onClose(status, reason)`: **推荐的清理钩子**。`status` 为 `'final'`, `'error'` 或 `'cancel'`。

#### 示例：处理流并进行健壮的清理

```typescript
import { createCallbacksTransformer } from '@isdk/tool-func';

async function main() {
  // 1. 创建带有全面回调的转换器
  const transformer = createCallbacksTransformer({
    onStart: () => console.log('流已开始！'),
    onTransform: (chunk) => {
      console.log('收到数据块:', chunk);
      return chunk.toUpperCase();
    },
    onFinal: () => console.log('流已正常结束！'),
    onError: (err) => console.error('流错误:', err),
    onClose: (status, reason) => {
      console.log(`资源清理：流已关闭，状态为 [${status}]`);
      if (reason) console.log('原因/错误详情:', reason);
      // myTaskHandle.release(); // 在此处释放您的资源句柄
    }
  });

  // 2. 创建一个源 ReadableStream
  const readableStream = new ReadableStream({
    start(controller) {
      controller.enqueue('a');
      controller.enqueue('b');
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
流已正常结束！
资源清理：流已关闭，状态为 [final]
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

### 灵活的参数归一化 (Flexible Argument Normalization)

框架为 `ToolFunc` 构造函数和 `ToolFunc.register` 方法提供了一套“智能参数归一化”系统。该系统使用**模式识别**来识别您的意图，并应用**深度合并**（通过 `defaultsDeep`）来组合您的输入。

#### 1. 核心原则：“主体”与“默认值”

在所有涉及两个参数 `(arg1, arg2)` 的模式中，**`arg1` 是主要主体 (Authority)**，而 **`arg2` 提供深度默认值 (Defaults)**。这意味着如果两个参数定义了相同的属性（如 `title`），`arg1` 中的值将被保留。

#### 2. 支持的模式

系统自动识别以下模式：

- **`(string, options)`**:
  - 第一个参数是确定的 `name`。
  - `options` 提供其他所有内容作为默认值。
  - `const tool = new ToolFunc('myTool', { title: '默认标题' });`

- **`(function, options)`**:
  - 第一个参数是实现函数 `func`。
  - 如果 `options` 中没有提供 `name`，则使用该函数的 `name` 作为兜底。
  - **元数据感知**: 如果函数通过 `funcWithMeta` 进行了增强，其元数据将被自动提取并作为高优先级配置。
  - `const tool = new ToolFunc(function myTask() {}, { description: '...' });`

- **`(object, options)`**:
  - 第一个参数是一个配置对象或现有的 `ToolFunc` 实例。
  - 第二个参数递归地填充缺失的属性。
  - `const tool = new ToolFunc({ name: 'task', title: '主标题' }, { title: '备用标题' }); // title 将是 '主标题'`

- **`(string, funcString)`**:
  - 第一个参数是确定的 `name`，第二个参数是实现代码的**函数表达式字符串**。
  - `ToolFunc.register('add', '(a, b) => a + b');`

- **`(string, funcString, config)`**:
  - 同上，外加可选的第三个**配置对象**，用于描述 `params`、`description`、`title` 等。构造函数同样支持此形式：
  - `ToolFunc.register('add', '(a, b) => a + b', { params: [{ name: 'a' }, { name: 'b' }], description: '两个数相加' });`
  - `const add = new ToolFunc('add', '(a, b) => a + b', { params: [{ name: 'a' }, { name: 'b' }], description: '两个数相加' });`

#### 3. 字符串函数 (String Functions)

`func` 可以以字符串形式提供，并在构造/注册时被编译。这在从持久化数据加载工具定义时尤其有用（框架在序列化工具时本身就会把 `func` 导出为字符串）。

- **支持的格式** —— 字符串必须是**函数表达式**：箭头表达式（`'(a, b) => a + b'`）、函数表达式（`'function(a, b) { return a + b }'`）或具名函数表达式（`'function greet(name) { return name; }'`）。
- **裸表达式会被拒绝** —— 像 `'a + b'` 这样的字符串会被求值为一个值而不是函数，因此会抛出清晰错误。请改用箭头形式。
- **调用约定** —— 类似 `'(a, b) => ...'` 的字符串函数是位置参数风格，因此请将 `params` 声明为数组（`[{ name: 'a' }, { name: 'b' }]`）以便通过 `run`/`runSync` 使用具名参数，或直接用 `runWithPos`/`runWithPosSync` 调用。
- **名字推导** —— 未配置 `name` 时，会从具名函数表达式推导名字（如 `'function add(a, b) {...}'` → `add`）。
- **作用域** —— `scope` 选项提供闭包变量：`new ToolFunc({ name: 't', scope: { secret: 42 }, func: '() => secret' })`。它对**函数值**同样适用（会从其自身源码重新编译；因此方法简写的源码无法绑定作用域，会保持原样），而空作用域或未声明作用域时函数值保持不变 —— 其词法闭包得以保留。安装生命周期能力后，也可以由 `setup` 钩子提供它（见[生命周期钩子](#生命周期钩子-完整的-setup--dispose-生命周期)）。

> **⚠️ 安全提示:** 字符串函数通过 `new Function` 编译，即任意代码执行。请仅从受信任的来源（例如您自己持久化的数据）注册字符串。

#### 4. 深度合并的优势

由于使用了 `defaultsDeep`，您可以为 `params`、`depends` 或 `result` 模式等嵌套结构提供局部默认值。

```typescript
ToolFunc.register(
  { name: 'complex', params: { id: { type: 'string' } } },
  { params: { apiKey: { type: 'string', required: true } } }
);
// 最终生成的工具将在其 params 中同时拥有 'id' 和 'apiKey'。
```

---

## 🏛️ 核心架构：静态与实例

`ToolFunc` 的一个关键设计原则是静态类和实例之间的角色分离：

- **作为管理者的静态类:** `ToolFunc` 的静态部分（例如 `ToolFunc.register`, `ToolFunc.run`）充当全局的**注册表**和**执行器**。它管理所有工具的定义，允许您的应用程序的任何部分按名称发现和运行工具。

- **作为工具的实例:** 一个实例 (`new ToolFunc(...)`) 代表一个单一的、具体的**工具**。它持有实际的函数逻辑、其所有的元数据（名称、描述、参数）以及任何内部状态。

这种分离提供了两全其美的优势：既有用于定义单个工具的面向对象封装的能力，又有用于管理和执行它们的全局可访问服务的便利性。

## 🤝 贡献

如果您想为项目做出贡献，请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 文件以获取有关如何开始的指南。

## 📄 许可证

该项目根据 MIT 许可证授权。有关更多详细信息，请参阅 [LICENSE-MIT](./LICENSE-MIT) 文件。
