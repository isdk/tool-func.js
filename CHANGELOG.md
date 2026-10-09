# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [2.0.0](https://github.com///compare/v1.0.0...v2.0.0) (2026-10-09)

### ⚠ BREAKING CHANGES

* add setup/dispose with async supports

### Features

* add clearAsync() and state the sync/async teardown contract ([701d1ee](https://github.com///commit/701d1ee573cb17764c1ddbad13c9401b5c28b083))
* add per-call cleanup hook as the call-scoped twin of dispose ([73fc69a](https://github.com///commit/73fc69a14b94d894dfb6112d9b5d9807dedfb65c))
* add setup/dispose with async supports ([7fe7090](https://github.com///commit/7fe7090e23a4a3e43e8e1c350d043d561da76190))
* support string func registration and internal _stack via options ([e89db7f](https://github.com///commit/e89db7fe17efad1eb0ca4e08bb88267a736aaa77))

### Bug Fixes

* harden CancelableAbility concurrency, task identity and timeout semantics ([6088ffb](https://github.com///commit/6088ffb9d38f5816590c411170423d1928a3f16e)), references [#5](https://github.com///issues/5) [6/#7](https://github.com///issues/7)
* restore scope binding for a function-valued func ([b87055c](https://github.com///commit/b87055c8dab6fe12aeeb7c975ae70c0bc2b829b7))
* tear a tool down before its dependencies and re-arm every lifetime ([9294215](https://github.com///commit/929421540620308ef01fc9342d6c1b8b421c44f1))

## [1.0.0](https://github.com/isdk/tool-func.js/compare/v0.1.1...v1.0.0) (2026-07-05)


### Features

* **cancelable:** 增强执行上下文支持并完善并发管理机制 ([d37618b](https://github.com/isdk/tool-func.js/commit/d37618b6d7f4c825a1207828a5df9ff471850a57))
* implement prototype-based execution context inheritance and add comprehensive tests ([a720cb9](https://github.com/isdk/tool-func.js/commit/a720cb9ce8f37906bb01ce6c72519591cc67b0b7))
* **tool-func:** enhance createCallbacksTransformer with onClose and cancellation support ([c1668be](https://github.com/isdk/tool-func.js/commit/c1668be19968d950c6deea2a5254cf587ac92676))
* **tool-func:** implement hierarchical registry with late-binding polymorphism ([957f5e8](https://github.com/isdk/tool-func.js/commit/957f5e8926ecebfff116e6530fa47883b65947ad))
* **tool-func:** implement reference counting and override support for registration ([fabb660](https://github.com/isdk/tool-func.js/commit/fabb660503717be46f1958a784ea4c96c31d6b24))
* unify argument normalization with deep defaults and metadata awareness ([3b710e9](https://github.com/isdk/tool-func.js/commit/3b710e9839a205dc7719b162c9f005e5bff58213))


### Bug Fixes

* **docs:** minor change ([98b8595](https://github.com/isdk/tool-func.js/commit/98b8595f81bef5c76ce33eef41e7ed063a6fea9c))
* **docs:** streaming response and createCallbacksTransformer usage ([56896eb](https://github.com/isdk/tool-func.js/commit/56896eb3fa2e874a00389decc44c706ae1df6cfc))
* enhance async task management, fix memory leaks and counting errors ([effadc2](https://github.com/isdk/tool-func.js/commit/effadc260d61822cd5498e500f372ba48c8ad8d6))
* **tool-func:** fix circular dependency recursion and alias unregistration ([8fad43e](https://github.com/isdk/tool-func.js/commit/8fad43e3b54b0d8d9b47df6a76e60b7a1409065d))


### Refactor

* enhance execution context and async task isolation mechanism ([604891b](https://github.com/isdk/tool-func.js/commit/604891bcd682a47aec9c6834c5b3bef0fba76428))
* extract func-meta.ts from tool-func ([03e081f](https://github.com/isdk/tool-func.js/commit/03e081f2494d9a67fe8e4463e5bc49504824ea94))
* implement prototype-based shadow instances for concurrent context isolation ([d81a21c](https://github.com/isdk/tool-func.js/commit/d81a21c0601705cf48a6dffbc1ebd00f2961b79d))

## 0.1.1 (2025-11-08)
