# CancelableAbility 详细设计与最佳实践

`CancelableAbility` 是 `@isdk/tool-func` 框架中用于赋予工具函数（ToolFunc）异步控制能力的核心组件。它支持任务的中止（Cancel）、超时控制（Timeout）、并发限制（Concurrency Control）以及流式响应的生命周期管理。

本手册旨在详细描述其核心架构，并总结在复杂并发环境下的开发经验，以避免重复犯错。

---

## 核心架构设计

### 1. 影子实例 (Shadow Instance) 与状态宿主 (Root Host)

`ToolFunc` 采用原型链机制（`Object.create(this)`）来创建影子实例，从而实现并发隔离。

- **影子实例**: 仅持有本次调用的 `ctx`（上下文）和 `params`（参数）。
- **根实例 (`_root`)**: 通过 `new ToolFunc()` 创建的原始对象。

**经验教训：**
任务的状态（如运行中的中止器池 `__task_aborter` 和信号量 `__task_semaphore`）**绝对不能**存储在影子实例上。因为影子实例是瞬时的，且 JavaScript 的赋值操作（Assignment）不会修改原型。

- **解决方案**：在基类构造函数中定义只读的 `_root` 属性，`CancelableAbility` 始终通过 `(this as any)._root || this` 来读写并发状态，确保状态始终存储在原始实例上。

### 2. 执行上下文 (Context) 机制

上下文是工具执行环境的载体。

- **预准备 (AOT)**: 使用 `tool.with(ctx)` 返回一个已经注入 `aborter` 的就绪影子实例。
- **延迟注入 (JIT)**: 如果直接 `run(params, ctx)`，框架会在执行瞬间补齐中止器。
- **属性继承**: 上下文通过原型链实现嵌套继承。父级上下文的属性（如 `traceId`）会自动流转到子工具中。

---

## 关键功能详解

### 1. 自动注入 Aborter

只要工具开启了 `AsyncFeatures.Cancelable`，其 `this.ctx.aborter` 就会被自动初始化。

- 逻辑入口：`$_prepareContext`。
- **注意**：在重写此方法时，务必调用 `super` 以保证注入逻辑链不中断。

### 2. 外部信号链接 (Signal Linking)

支持将外部的 `AbortSignal`（如 Web 请求的中止信号）链接到工具内部。

- 支持单信号 `ctx.signal` 或多信号数组 `ctx.signals`。
- 任一外部信号中止，内部任务将立即感知并停止。

### 3. 超时管理 (Timeout)

可以通过 `ctx.timeout` 或 `params.timeout` 设置。

- 在 `MultiTask` 模式下，超时逻辑会自动携带 `taskId` 调用 `abort()`，确保精准中止目标任务。

### 4. 并发限制与 isReadyFn

通过 `maxTaskConcurrency` 限制并发数。

- `isReadyFn` 允许在任务正式开始前进行异步检查（如等待数据库连接或令牌发放）。
- **经验教训**：`isReadyFn` 必须绑定到根实例（通过 `_root` 获取），否则在其内部访问 `this` 可能会拿到生命周期极短的影子实例，导致状态判断错误。

---

## 开发避坑指南（经验总结）

### ⚠️ 1. 赋值与读取的陷阱

**错误做法**：`this.__task_aborter = aborter;`
**正确做法**：`((this as any)._root || this).__task_aborter = aborter;`
**原因**：直接赋值会把状态写在影子实例上，导致其他并发调用无法通过原型链看到该状态，从而使并发限制失效。

### ⚠️ 2. 特征位检查 (Feature Bit vs Mask)

**错误做法**：`this.hasAsyncFeature(AsyncFeatures.Cancelable)` (传入了掩码 2)
**正确做法**：`this.hasAsyncFeature(AsyncFeatureBits.Cancelable)` (传入了位偏移 1)
**原因**：`IntSet.has` 预期的是位的位置，而不是位的值。

### ⚠️ 3. Vitest Diff 干扰

当 Vitest 在测试失败进行差异对比时，会尝试修改对象的属性。

- **现象**：如果 `_root` 设置为 `writable: false`，Vitest 会抛出 `TypeError` 掩盖真实的业务错误。
- **防御性设计**：`_root` 应定义为带有空 Setter 的属性：

  ```javascript
  Object.defineProperty(this, '_root', {
    get: () => this,
    set(v) {},
    enumerable: false
  });
  ```

### ⚠️ 4. 递归调用的能力注入

在测试中定义辅助工具类或匿名类时，如果使用了 `runAsyncCancelableTask` 或 `runAs`：

- **必须执行**：`makeToolFuncCancelable(YourClass)`。
- **否则**：会抛出 `this.runAsyncCancelableTask is not a function` 错误。

### ⚠️ 5. 防止无限递归

在重写 `$_shouldIsolate` 时，必须检查实例是否已经具备 `ctx`：

```typescript
if (Object.prototype.hasOwnProperty.call(that, 'ctx')) return false;
```

否则 `runSync` 会在影子实例上不断尝试创建新的影子实例，导致栈溢出。

---

## 结论

`CancelableAbility` 并不是简单的 `AbortController` 包装。它是一个深度集成在原型链隔离架构下的状态管理系统。开发者在扩展或使用时，应始终关注“**操作的实例对象是谁**”以及“**状态存储在哪里**”。
