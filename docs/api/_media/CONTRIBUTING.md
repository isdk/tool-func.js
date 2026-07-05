# Contributing

Please feel free to file GitHub Issues or propose Pull Requests. We're always happy to discuss improvements to this library!

## Detailed Design & Trade-offs: Argument Normalization

The framework implements a robust argument normalization system through `_normalizeArguments` and `_normalizeRegisterArguments`. Below are the key design decisions and trade-offs made during development.

### 1. Pattern Recognition over Strict Typing

We chose a "Pattern Recognition" approach to handle the various ways a `ToolFunc` can be defined or registered. This allows for a very flexible API:

- `new ToolFunc(name, options)`
- `new ToolFunc(func, options)`
- `new ToolFunc(config, defaults)`

This trade-off prioritizes **developer experience and API ergonomics** over strict, single-signature typing.

### 2. The "Authority" Principle (1st Arg Wins)

A critical shift in the framework was moving from "2nd arg overrides 1st arg" (standard `Object.assign` behavior) to **"1st arg is the authority, 2nd arg provides defaults"** (using `lodash-es/defaultsDeep`).

**Rationale:**

- **Semantic Clarity**: When a developer calls `new ToolFunc({ name: 'A' }, { name: 'B' })`, the most explicit intent is the first object. Treating the second argument as a "defaults" package aligns better with human intuition.
- **Nested Merging**: Standard assignment often destroys nested configuration objects (like `params` or `depends`). Using `defaultsDeep` ensures that global or plugin-level defaults can be merged into local definitions without wiping them out.

### 3. Separation of Instructions and Metadata

We distinguish between **Tool Metadata** (like `name`, `params`) and **Registration Instructions** (like `allowOverride`).

- `_normalizeArguments`: Handles core metadata used by the constructor.
- `_normalizeRegisterArguments`: Extends this to extract and clean up registration-specific instructions.

This ensures that "temporary" instructions like `allowOverride` don't pollute the long-lived `ToolFunc` instance state.

### 4. Automatic Metadata Awareness (`FuncMetaSymbol`)

To support tools like `funcWithMeta`, the normalization logic automatically checks for a hidden `FuncMetaSymbol` on function arguments.

**Trade-off:** This adds a small amount of "magic" to the normalization process but significantly improves interoperability with other parts of the `@isdk` ecosystem where metadata might be attached directly to raw functions.

### 5. Instance Mutability during Registration

When `ToolFunc.register(instance, defaults)` is called, the `defaultsDeep` operation **mutates the existing instance**.

**Decision**: We decided to allow this mutation because registration is a lifecycle event where the tool is being "prepared" for global use. Applying missing defaults to an existing instance ensures that the registered version is fully configured according to the current environment's defaults.

## Registry Lifecycle & Circular Dependencies

Managing the lifecycle of tools in a hierarchical registry, especially with circular dependencies (e.g., A depends on B, B depends on A), requires careful handling of what we call **"Ghost States"**.

### 1. The "Ghost State" (Reference Count Ownership)

When a tool `A` is unregistered with `force: true` (e.g., during an override), it is physically removed from `this.items` **early** in the process to prevent re-entrancy. However, the unregistration process then recursively cleans up its dependencies (like `B`). If `B` also depends on `A`, it will trigger another `unregister(A)`.

**Lesson Learned:**
If we only check `this.items` for "local ownership" during the `scope: 'local'` check, the second (recursive) call to `unregister(A)` would fail because `A` was already deleted from `items`. This would leave a "dangling" reference count, causing the count to be off by one.

**Solution:**
We define "Local Ownership" as having an 'own' property in **any** of the three core registry components: `items`, `aliases`, OR `_refCounts`. The reference count is the ultimate "Ghost State" that represents the tool's lingering life during the cleanup phase.

### 2. Hierarchical Isolation via Prototype Shadowing

We chose `Object.create(Parent.items)` for registry isolation.

**Trade-offs:**

- **Pros:** Extremely memory-efficient. Reading is a natural "look-up" that automatically inherits all parent tools.
- **Cons:** Standard assignment (`this.items[name] = ...`) creates an 'own' property, which "shadows" the parent. This is exactly the behavior we want for isolation, but it requires that our management logic (like `unregister`) is aware of the difference between 'own' and 'inherited' properties to avoid accidentally modifying the parent.

### 3. Namespace Protection vs. Shadowing

We introduced a distinction in `_getRegistrationAction`:

- **Shadowing**: The default behavior when a name exists in the parent but not locally. It allows a child registry to provide its own version of a tool without breaking the parent.
- **Protection**: If `allowOverride: false` is explicitly set, we check the **entire prototype chain** (using `this.get(name)`). This provides a "Global Namespace" guarantee for critical tools.

## Internal Development Lessons Learned (Architectural Principles)

During the implementation of the hierarchical registry and polymorphic dependency resolution, we encountered several non-obvious challenges that shaped the current architecture.

### 1. Reference Counting vs. Circular Dependencies

**The Trap:** Simple recursive registration of dependencies (`A -> B -> A`) leads to inflated reference counts. If `A` is registered, and then `B` (which depends on `A`) is auto-registered, `A`'s count becomes 2. This prevents `A` from being automatically cleaned up when the initial registration is removed, creating a "memory leak cluster".

**The Lesson:** We introduced a **Registration Stack (`Set<string>`)** to identify "Back-edges" in the dependency graph.

- In a cycle, the back-edge registration is ignored (`count` stays at 1).
- This ensures a circular cluster behaves like an atomic unit: once the root reference is gone, the whole cluster is automatically garbage-collected.

### 2. Alias Hijacking in Hierarchical Registries

**The Trap:** Prototypal inheritance naturally allows shadowing properties. However, in a tool registry, an alias is often a "Public Contract". If a child registry silently shadows an inherited alias, it might accidentally hijack logic meant for the parent.

**The Lesson:** Alias collision checks MUST scan the **entire prototype chain**.

- To protect the namespace, registering an alias that already exists anywhere in the hierarchy is forbidden by default.
- Shadowing an alias is only permitted with explicit intent via `allowOverride: { alias: true }`.

### 3. The Binding Paradox: Stability vs. Polymorphism

**The Trap:**

- **Early Binding** (lock instances at registration) is stable but prevents child registries from customizing inherited tools.
- **Late Binding** (resolve by name at call-time) supports polymorphism but breaks when an inherited tool depends on a specific internal version of another tool.

**The Lesson: "Lineage-Aware Auto-Binding"**.
We introduced `rootRegistry` and a three-mode `binding` strategy (`auto`, `early`, `late`):

- **Default (`auto`)**: It uses "Bloodline Logic". It only switches to late-binding (polymorphism) if the caller is a **strict descendant** of the tool's definer AND has a **local shadow** of the dependency.
- This preserves "Stability" for same-scope calls while enabling "Polymorphism" for plugin-style extensions.

### 4. Context Propagation in Async Call Chains

**The Trap:** In asynchronous `run()` calls, control flags like `rootRegistry` or `binding` strategy tend to get lost when nested tools are called (e.g., `await this.runAs('dep')`).

**The Lesson:**

- **Static Entry Points** (`static run/runSync`) MUST act as the "Source of Truth" for context injection. They are responsible for tagging the `rootRegistry`.
- `runAsSync` MUST explicitly propagate these control flags into its sub-calls. If the root caller's info is lost at the start of the chain, the entire hierarchical logic fails.

## Testing

```shell
pnpm test
```

## Releasing

Releases are supposed to be done from master, version bumping is automated through [`standard-version`](https://github.com/absolute-version/commit-and-tag-version):

```shell
pnpm run release -- --dry-run  # verify output manually
pnpm run release               # follow the instructions from the output of this command
```
