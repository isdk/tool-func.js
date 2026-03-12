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
