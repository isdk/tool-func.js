# @isdk/tool-func 极简上手指南

## 一句话概括

这是一个 TypeScript 框架，帮你把函数变成**带元数据、可注册、可依赖、可取消、可流式输出**的“工具模块”。特别适合构建 AI Agent 工具链、后端服务插件系统。

---

## 核心概念速览

| 概念 | 是什么 | 为什么重要 |
|------|--------|-----------|
| **ToolFunc** | 一个工具函数+元数据的封装体 | 你的每一个“能力单元” |
| **注册表** | 全局工具仓库，按名字存取 | 解耦调用者和实现者 |
| **影子实例** | 基于原型链的轻量级隔离副本 | 并发安全，不深拷贝，内存极省 |
| **上下文 ctx** | 每次调用的环境数据（traceId、signal等） | 让工具感知“谁在叫我、能否中断” |
| **依赖管理** | 声明其他工具为依赖，自动注册/注销 | 组件化组装，自动生命周期 |

---

## 上手三步走

### 第一步：定义工具

```typescript
import { ToolFunc } from '@isdk/tool-func'

const getUser = new ToolFunc({
  name: 'getUser',
  description: '根据ID查用户',
  params: { id: { type: 'string', required: true } },
  func: (params) => ({ id: params.id, name: '张三' })
})
```

### 第二步：注册工具

```typescript
getUser.register()
// 现在全局可通过名字 'getUser' 找到它
```

### 第三步：运行工具

```typescript
// 在任何地方，按名字调用
const user = await ToolFunc.run('getUser', { id: '123' })
console.log(user) // { id: '123', name: '张三' }
```

---

## 进阶玩法（看完就能用）

### 🔗 依赖另一个工具

```typescript
const welcomeUser = new ToolFunc({
  name: 'welcomeUser',
  params: { userId: 'string' },
  depends: { fetcher: getUser }, // 声明依赖，自动注册
  func: function(params) {
    const user = this.runAsSync('fetcher', { id: params.userId })
    return `你好, ${user.name}!`
  }
})

welcomeUser.register()
const msg = await ToolFunc.run('welcomeUser', { userId: '456' })
// "你好, 张三!"
```

### 🧵 上下文链式调用
上下文会沿着调用链自动传播，无需手动传递。
```typescript
const parent = new ToolFunc({
  name: 'parent',
  func: async function(params) {
    // 当前上下文里有 traceId
    console.log(this.ctx.traceId) // 'chain-001'
    // 调用子工具，上下文自动继承
    return this.runAs('child', { data: 'hello' })
  }
})
const child = new ToolFunc({
  name: 'child',
  func: function(params) {
    console.log(this.ctx.traceId) // 'chain-001'（自动继承）
    return `ok ${params.data}`
  }
})
parent.register(); child.register()

// 注入根上下文
const result = await ToolFunc.with({ traceId: 'chain-001' }).run('parent', {})
```

如需在子调用中叠加新上下文，传给 `runAs` 的第三个参数：
```typescript
this.runAs('child', params, { extraField: 'value' })
```
新上下文会通过原型链继承父级上下文，不会丢失原有数据。


### 🧵 并发安全：上下文隔离
**隔离发生在 `run()` 那一刻**。同一个工具实例，每次调用传入不同的 `ctx`，内部 `this.ctx` 自动隔离，互不干扰。

```typescript
const logTool = new ToolFunc({
  name: 'logCtx',
  func: function(params) {
    // 每个并发调用看到的 ctx 都是独立的
    console.log(`[${this.ctx.requestId}] 开始处理`)
    return `完成 ${this.ctx.requestId}`
  }
})
logTool.register()

// 并发执行，每次 run 都传入独立的 ctx
const [resA, resB] = await Promise.all([
  logTool.run({}, { requestId: 'req-A' }),
  logTool.run({}, { requestId: 'req-B' })
])

console.log(resA) // "完成 req-A"
console.log(resB) // "完成 req-B"
// 日志输出：
// [req-A] 开始处理
// [req-B] 开始处理
```

**原理**：每次 `run()` 时，框架都会基于原型链创建一个新的影子实例，并把传入的 `ctx` 挂载到该影子实例上。因此 `this.ctx` 指向的是本次调用独有的上下文，不同调用之间完全隔离。

因此你也可以先用 `.with()` 创建带默认上下文的 runner，再调用 `run()`：
```typescript
const runner = logTool.with({ defaultField: 'shared' })
const res1 = await runner.run({}, { requestId: 'req-A' }) // 合并原有 ctx
const res2 = await runner.run({}, { requestId: 'req-B' })
```

### 🛑 可取消任务

```typescript
import { makeToolFuncCancelable, AsyncFeatures } from '@isdk/tool-func'

const CancelableToolFunc = makeToolFuncCancelable(ToolFunc)

const longTask = new CancelableToolFunc({
  name: 'longTask',
  asyncFeatures: AsyncFeatures.Cancelable,
  func: async function(params) {
    const aborter = this.ctx.aborter // 自动注入
    for (let i = 0; i < 100; i++) {
      await doSomeWork()
      aborter.throwIfAborted() // 检查是否被取消
    }
    return '完成'
  }
})

longTask.register()

// 运行并获取控制句柄
const promise = ToolFunc.run('longTask')
const task = promise.task
setTimeout(() => task.abort('超时了'), 5000) // 随时取消
```

### 🌊 流式输出

```typescript
const streamTask = new ToolFunc({
  name: 'streamTask',
  stream: true,
  params: { stream: { type: 'boolean' } },
  func: function(params) {
    if (this.isStream(params)) {
      return new ReadableStream({
        async start(controller) {
          for (let i = 0; i < 5; i++) {
            controller.enqueue(`块 ${i}\n`)
            await sleep(100)
          }
          controller.close()
        }
      })
    }
    return '一次性结果'
  }
})
```

### 🧩 分层注册表（多租户/插件隔离）

```typescript
class PluginTools extends ToolFunc {
  static { this.isolateRegistry() }
}

// 父级注册表
ToolFunc.register('globalTool', { func: () => 'global' })

// 插件有自己的隔离空间，但能看到父级工具
PluginTools.register('localTool', { func: () => 'local' })
PluginTools.get('globalTool') // 存在（继承）
PluginTools.get('localTool')  // 存在（局部）
ToolFunc.get('localTool')     // undefined（隔离了）
```

---

## 避坑提醒（来自实战经验）

| 别这样做 | 正确做法 |
|---------|---------|
| 用 `Object.assign` 合并上下文 | 用 `Object.create(parentCtx)` 建原型链继承 |
| 用 `Object.setPrototypeOf` 改原型 | 创建时就确定原型：`Object.assign(Object.create(proto), ctx)` |
| 在影子实例上存持久状态 | 持久状态放 Root 实例，通过 `this._origin` 访问 |
| 跳过实例方法直接调静态方法 | 始终走 `this._prepareContext` 触发插件链 |

---

## 什么时候用它？

- ✅ 你要建一个**工具函数库**，让不同模块按名字调用
- ✅ 你需要**并发安全**，不想手动管理每个请求的上下文
- ✅ 你的工具之间有**依赖关系**，需要自动生命周期管理
- ✅ 你需要**可取消的长时间任务**或**流式响应**
- ✅ 你在做**插件系统**或**多租户应用**，需要隔离注册表

---

## 一句话记住精髓

> **“每个工具是一个有身份证的独立单元，通过原型链实现零拷贝并发隔离，通过注册表实现全局解耦调用。”**

现在你可以打开编辑器，`npm install @isdk/tool-func`，开始写你的第一个工具了。