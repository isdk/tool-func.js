# CancelableAbility 详细设计与最佳实践

`CancelableAbility` 是 `@isdk/tool-func` 框架中用于赋予工具函数（ToolFunc）异步控制能力的核心组件。

**核心定位**：它采用 **AoP（面向切面编程）** 设计模式，通过 **`makeToolFuncCancelable`** 动态地为工具类注入异步管理能力。这意味着 `ToolFunc` 基类本身保持纯净和轻量，开发者可以根据业务需求，通过“能力注入”的方式让特定的工具具备中止（Cancel）、超时控制、以及并发限制等高级特性。

---

## 一、 能力注入机制 (AoP Pattern)

### 1. 动态注入与解耦的设计哲学

`CancelableAbility` 不是 `ToolFunc` 的硬编码属性，而是作为一种“可选能力”存在的。这种设计的优势在于：

* **按需增强**：只有真正需要异步控制的工具才会被赋予这些复杂逻辑，降低了普通同步工具的资源消耗。
* **非侵入性**：它不需要修改 `ToolFunc` 的核心源码。通过注入器，我们可以在不破坏原有类结构的前提下，透明地插入异步控制切面。

### 2. `makeToolFuncCancelable` 的核心工作

当你对一个工具类执行注入时，框架完成了以下三件事：

1. **原型增强**：将 `CancelableAbility` 定义的所有异步方法（如 `runAsyncCancelableTask`）安全地合并到目标类的原型链中。
2. **Schema 自动扩展**：动态调用 `Tool.defineProperties` 为该类注册 `maxTaskConcurrency` 和 `isReadyFn` 等属性定义。这使得 `PropertyManager` 在构造函数初始化阶段就能正确识别并赋值这些配置项。
3. **生命周期钩子拦截**：通过注入 AoP 专用钩子（如 `$_prepareContext` 和 `$_shouldIsolate`），在工具运行的每一个关键节点自动执行 `aborter` 的创建、复用和信号链接。

---

## 二、 核心架构设计：三位一体模型

注入能力后，工具的运行遵循逻辑、环境与信号分离的“三位一体”模型：

### 1. 逻辑宿主：原始实例 (`_origin`)

通过 `new ToolFunc()` 创建的原始对象被称为 **Origin 实例**。

* **职责**：持有工具的静态元数据（名称、参数定义等）以及**持久化状态**。
* **持久状态**：包括用于并发控制的信号量（`__task_semaphore`）和正在运行的任务池（`__task_aborter`）。
* **锚定机制**：在基类构造函数中，通过闭包固化了 `_origin` 属性。无论影子实例嵌套多少层，`this._origin` 始终精准指向该原始实例，防止状态在影子链中“漂移”。

### 2. 执行环境：影子实例 (Shadow Instance) 与 `ctx`

每次调用产生的影子实例负责承载瞬时的、并发安全的执行状态。

* **职责**：提供独立的执行上下文。
* **元数据隔离**：任务特有的动态数据（如本次调用的 `taskId`、`timeout` 计时器）存储在 `this.ctx` 的自有属性中。由于 `this.ctx` 是基于原型链的影子对象，这确保了子工具的 ID 不会覆盖父工具的 ID。

### 3. 中止信号：物理引用共享的 `aborter` (TaskAbortController)

与元数据隔离不同，中止信号在默认情况下是**完全复用**的。

* **设计理念**：工具链条被视为在同一个“逻辑环境”中运行。当一个中止信号（如来自 Web 请求）从外向内发起时，整个环境链条应视为一体，一旦中止，全链路应同步感知并立刻退出。
* **实现方式**：在嵌套调用中，`subAborter === mainAborter`。这保证了信号传递的零延迟和极低的内存分配开销。

---

## 三、 执行上下文 (Context) 注入机制

注入后的能力会自动接管上下文的准备逻辑，支持以下两种模式：

* **预准备 (AOT - Ahead of Time)**：使用 `tool.with(ctx)`。这会返回一个已经预先注入了 `aborter` 并完成信号链接的就绪影子实例。
* **延迟注入 (JIT - Just in Time)**：直接调用 `run(params, ctx)`。框架会在执行瞬间通过 AoP 拦截器判定是否需要隔离，并自动补齐所需的中止器。
* **属性继承**：上下文通过 `Object.create(parentCtx)` 实现属性的自动流转。父级属性（如 `traceId`）会自动传播到子工具中，除非开发者显式设置 `inheritContext: false` 以切断联系。

---

## 四、 关键功能详解

### 1. 自动注入与复用 Aborter

只要工具开启了 `AsyncFeatures.Cancelable` 特性，其 `this.ctx.aborter` 就会被自动化管理：

* **复用优先**：如果调用参数或父级上下文中已经存在 `aborter`，插件会直接复用该引用，确保信号的物理一致性。
* **自动初始化**：如果环境中完全没有信号源，插件会为本次执行创建一个全新的 `TaskAbortController`。

### 2. 外部信号链接 (Signal Linking) 与自动清理

支持将外部传入的 `AbortSignal`（如 Node.js 或浏览器的原生中止信号）无缝链接到工具内部：

* **多信号支持**：支持通过 `ctx.signal`（单信号）或 `ctx.signals`（信号数组）传入。
* **联动效应**：通过内部的 `linkAnyAbort` 机制，任何一个外部信号触发中止，内部 `aborter` 都会立即响应。
* **生命周期安全 (Memory Leak Prevention)**：框架会自动管理监听器的清理。链接操作会产生一个清理函数并存储在 `ctx._linkCleanup` 中。无论任务是成功、失败还是被中止，框架都会在 `finally` 阶段调用该函数，确保所有外部监听器被移除，彻底防止内存泄漏。

### 3. 任务状态查询与惰性清理

* **isAborted(taskId?)**：精准查询指定任务或单任务工具是否已中止。
* **getRunningTaskCount()**：获取当前正在运行的任务总数。
* **惰性清理机制**：为了保持高性能，框架采用了惰性清理策略。当调用 `getRunningTaskCount` 或 `getRunningTask` 时，如果发现某个任务已经处于中止状态，框架会顺手将其从内部任务池中注销。

### 3. 超时管理 (Timeout)

可以通过 `ctx.timeout` 或 `params.timeout` 设置任务的最大执行时长：

* **精准中止**：在 `MultiTask` 模式下，超时逻辑会自动获取本次调用的 `taskId` 并调用 `abort()`。这确保了框架只会杀死那个超时的特定并发任务，而不会影响同一工具的其他正常运行任务。

### 4. 并发限制与 isReadyFn

通过 `maxTaskConcurrency` 限制单工具的全局并发执行数：

* **状态共享**：所有的影子实例在执行前，都会通过 `this._origin.semaphore` 访问同一个信号量计数器。
* **isReadyFn 异步检查**：允许在任务正式占用资源前进行额外检查（如等待数据库连接池就绪）。
* **绑定原则**：`isReadyFn` 必须绑定到根实例（通过 `_origin` 获取），否则在生命周期极短的影子实例上进行状态判断会导致逻辑错误。

---

## 五、 开发避坑指南（核心技术细节）

### ⚠️ 1. 赋值与读取的陷阱 (持久状态锚定)

* **错误做法**：`this.__task_aborter = aborter;`
* **正确做法**：`((this as any)._origin || this).__task_aborter = aborter;`
* **原因**：影子实例是随用随弃的。直接赋值会把状态写在影子实例上，导致其他并发调用通过原型链无法看到该状态，从而使并发限制完全失效。

### ⚠️ 2. 特征位检查 (Feature Bit vs Mask)

* **错误做法**：`this.hasAsyncFeature(AsyncFeatures.Cancelable)` (传入了掩码值 `2`)
* **正确做法**：`this.hasAsyncFeature(AsyncFeatureBits.Cancelable)` (传入了位偏移 `1`)
* **原因**：`IntSet.has` 预期的是**位的位置**（Bit Position），而不是位掩码计算后的值。

### ⚠️ 3. Vitest Diff 干扰与 _origin 定义

* **现象**：当 Vitest 测试失败进行差异对比时，会尝试修改对象的属性进行序列化。如果 `_origin` 设置为 `writable: false` 且没有 Setter，Vitest 会抛出 `TypeError` 掩盖真实的业务错误。
* **防御性设计**：`_origin` 必须定义为带有空 Setter 的属性：

  ```javascript
  Object.defineProperty(this, '_origin', {
    get: () => this,
    set(v) {}, // 必须显式提供空 setter 兼容测试工具
    enumerable: false,
    configurable: true
  });
  ```

### ⚠️ 4. 插件拦截链的稳健性 (实例路径)

* **规则**：内核代码严禁直接调用静态 `ToolFunc._prepareContext`。
* **后果**：直接调用静态方法会绕过 `this`（实例）上的 AoP 钩子，导致 `CancelableAbility` 无法拦截并注入中止器。
* **做法**：必须始终通过 `this._prepareContext` 发起调用。

### ⚠️ 5. 递归调用的能力注入

* **规则**：在测试或定义匿名工具类时，如果使用了 `runAsyncCancelableTask` 或 `runAs`。
* **必须操作**：显式执行 `makeToolFuncCancelable(YourClass)`。
* **后果**：由于这些能力是动态注入到目标类原型链中的，如果不执行注入，会抛出 `is not a function` 错误。

### ⚠️ 6. 防止无限递归

* **背景**：在重写 `_shouldIsolate` 自定义隔离逻辑时。
* **操作**：必须通过 `hasOwnProperty('ctx')` 检查当前实例是否已经具备自有上下文属性。
* **后果**：如果没有此检查，在 `isolated: true` 模式下，影子实例执行 `runSync` 时会再次触发隔离，导致栈溢出。

---

## 六、 结论

`CancelableAbility` 是 AoP 模式与 Javascript 原型链特性的深度结晶。
开发者应始终牢记其核心契约：**`aborter` 是共享的灯（用于信号同步），而 `ctx` 是私有的包（用于元数据隔离）。** 只要坚持“状态归 Root，环境归 Shadow”的原则，就能构建出极高性能且并发安全的工具系统。
