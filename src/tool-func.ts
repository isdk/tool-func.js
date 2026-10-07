import { defaultsDeep } from 'lodash-es';
import { AdvancePropertyManager } from 'property-manager';
import { _createFunction } from 'util-ex';
import { NotFoundError, throwError } from '@isdk/common-error';
import { IntSet } from '@isdk/util';
import { AsyncFeatureBits } from './utils/async-features';

/**
 * Represents the data type of a function parameter as a string (e.g., `'string'`, `'number'`).
 *
 * @public
 */
export type FuncParamType = string

/**
 * Execution context for a tool function.
 *
 * @public
 */
export interface ToolFuncContext {
  /**
   * The entry-point registry class that initiated the call chain.
   * Used for late-binding dependency resolution in hierarchical registries.
   *
   * @public
   */
  rootRegistry?: typeof ToolFunc;

  /**
   * The binding strategy for internal dependencies (runAsSync).
   * - 'early': Always use pre-bound instances from 'depends'.
   * - 'late': Always resolve from rootRegistry (forced polymorphism).
   * - 'auto': Use 'late' if rootRegistry shadows the dependency, else 'early' (Safe Default).
   *
   * @public
   */
  binding?: 'early' | 'late' | 'auto';

  /**
   * Whether to enable independent execution scope.
   * If true, a temporary instance will be created via Object.create(this) to isolate concurrency.
   *
   * @public
   */
  isolated?: boolean;

  /**
   * Whether to allow context inheritance/propagation in nested calls.
   * Defaults to true.
   *
   * @public
   */
  inheritContext?: boolean;

  /**
   * Standard Web AbortSignal for propagating cancellation signals.
   *
   * @public
   */
  signal?: AbortSignal;

  /**
   * Allows users to extend arbitrary properties.
   *
   * @public
   */
  [key: string]: any;
}

/**
 * Describes a single function parameter, including its name, type, and description.
 *
 * @public
 */
export interface FuncParam {
  /**
   * The name of the parameter.
   *
   * @public
   */
  name?: string;

  /**
   * The data type of the parameter, represented as a string identifier (e.g., 'string', 'number').
   *
   * @public
   */
  type?: FuncParamType;

  /**
   * Indicates whether the parameter is required.
   *
   * @public
   */
  required?: boolean;

  /**
   * A description of the parameter, explaining its purpose and usage.
   *
   * @public
   */
  description?: string;
}

/**
 * A map of function parameters, where each key is the parameter name.
 * The value can be either a detailed `FuncParam` object or a simple type string.
 *
 * @public
 *
 * @example
 * ```ts
 * const params: FuncParams = {
 *   userId: 'string',
 *   profile: {
 *     type: 'object',
 *     description: 'User profile data'
 *   }
 * };
 * ```
 */
export interface FuncParams {
  [name: string]: FuncParam|FuncParamType;
}

/**
 * Defines the signature for a tool function's implementation.
 *
 * @public
 *
 * @param this - The `this` context is bound to the `ToolFunc` instance.
 * @param params - Variadic arguments passed to the function.
 * @returns The result of the function's execution.
 */
export type TFunc = (this:ToolFunc, ...params:any[]) => any

/**
 * The implementation of a tool function as a string.
 *
 * The string must be a **function expression** (e.g. `'(a, b) => a + b'`,
 * `'function(a, b) { return a + b }'`, or `'function named(a) { return a }'`).
 * It is compiled at construction/registration time via `_createFunction`,
 * which wraps the string as `Function(scopeKeys, 'return ' + expr)`.
 * Bare expressions (e.g. `'a + b'`) evaluate to a value instead of a function
 * and are rejected with a clear error.
 *
 * Security note: string funcs are compiled with `new Function`, so only pass
 * strings from trusted sources (e.g. your own persisted data).
 *
 * @public
 */
export type TFuncString = string

/**
 * Base configuration for defining a tool function.
 *
 * @public
 */
export interface BaseFuncItem {
  /**
   * The unique name of the function.
   *
   * @public
   */
  name?: string;
  /**
   * Parameter definitions, which can be an object mapping names to definitions or an array for positional parameters.
   *
   * @public
   */
  params?: FuncParams | FuncParam[];
  /**
   * The expected return type of the function, described as a string or a JSON schema object.
   *
   * @public
   */
  result?: string|Record<string, any>;
  /**
   * The execution scope or context (`this`) for the function.
   *
   * Its keys become closure variables of the func, and a `this` key becomes the func's `this`.
   * Because those bindings are captured while compiling, the scope is read at compile time:
   *
   * - a string {@link FuncItem.func} is always compiled against it;
   * - a *function* value is compiled from its own source when a non-empty scope is declared — a
   *   source that is not a function expression (method shorthand, a class method, native code) is
   *   used as-is instead, since it has no standalone source to compile;
   * - an empty or absent scope leaves a function value untouched, so its lexical closure survives.
   *
   * A {@link BaseFuncItem.setup} hook may provide the scope too: it is applied *before* the func is
   * compiled (see the lifecycle ability).
   *
   * @public
   *
   */
  scope?: any;
  /**
   * Tags for grouping or filtering functions.
   *
   * @public
   */
  tags?: string|string[];
  /**
   * A lifecycle hook called once when the `ToolFunc` instance is **registered**, and again after
   * it has been `dispose`d and re-registered. It is the exact inverse of {@link BaseFuncItem.dispose}.
   *
   * It allows for initial setup, state configuration, or property modification on the instance.
   * The `this` context is the `ToolFunc` instance itself.
   *
   * The hook may return a `Promise`. When it does, the instance is *pending* until that promise
   * settles: `run()` awaits it automatically, while `runSync()` refuses to execute and asks you to
   * use `run()` / `await tool.ready` instead. Use `registerAsync()` when you want registration
   * itself to wait for setup to finish.
   *
   * NOTE: this hook is only *invoked* by the `makeToolFuncLifecycle` ability — a plain `ToolFunc`
   * stores it but never calls it. Install it once, on the registry class you actually use:
   * `const Tools = makeToolFuncLifecycle(ToolFunc)`.
   *
   * Mutating `options` inside the hook still works (including after an `await`): the touched keys
   * are re-applied through the very same `initialize`/`assign` pipeline that built the instance.
   * A `scope` the hook provides — through `this.scope` or through the options object — is applied
   * before a string `func` is compiled, and a scope *change* rebuilds it (see
   * {@link BaseFuncItem.scope}).
   *
   * @public
   *
   * @param this - The `ToolFunc` instance the hook is bound to.
   * @param options - The configuration options for the function.
   * @example
   * ```ts
   * const Tools = makeToolFuncLifecycle(ToolFunc);
   * const myFunc = new Tools({
   *   name: 'myFunc',
   *   customState: 'initial',
   *   setup() {
   *     // `this` is the myFunc instance
   *     this.customState = 'configured';
   *   }
   * });
   * myFunc.register(); // <- setup runs here, not in the constructor
   * console.log(myFunc.customState); // Outputs: 'configured'
   * ```
   */
  setup?(this: ToolFunc, options?: FuncItem): void | Promise<void>;
  /**
   * A lifecycle hook called once when the `ToolFunc` instance is **removed from the registry**,
   * i.e. when the reference count drops to zero or when `unregister` is forced. It is the exact
   * inverse of {@link BaseFuncItem.setup}: releasing whatever `setup` acquired (connections,
   * logins, timers, subscriptions...).
   *
   * The hook may return a `Promise`. Because the synchronous `unregister()` cannot await it, the
   * returned promise is tracked and its rejection is logged rather than thrown. Use
   * `unregisterAsync()` to await the teardown and observe the real error.
   *
   * After a successful `dispose`, the instance is re-armed: registering it again re-runs `setup`.
   *
   * NOTE: like {@link BaseFuncItem.setup}, this hook is only invoked by the `makeToolFuncLifecycle`
   * ability. Install it once, on the registry class you actually use:
   * `const Tools = makeToolFuncLifecycle(ToolFunc)`.
   *
   * @public
   *
   * @example
   * ```ts
   * const Tools = makeToolFuncLifecycle(ToolFunc);
   * const myFunc = new Tools({
   *   name: 'myFunc',
   *   setup() { this.conn = connect() },
   *   dispose() { this.conn.close() },
   *   func: () => 'ok',
   * });
   * myFunc.register();
   * myFunc.unregister(); // <- dispose runs here
   * ```
   */
  dispose?(this: ToolFunc): void | Promise<void>;
  /**
   * A lifecycle hook called once at the **end of every call**, releasing whatever *that call*
   * acquired. It is the call-scoped twin of {@link BaseFuncItem.dispose}: while `dispose` is tied to
   * the instance's registration lifetime, `cleanup` is tied to a single `run()`.
   *
   * Because the tools are executed through an isolated shadow instance, the body may park per-call
   * resources on `this` (`this.tx = begin()`) and `cleanup` releases exactly those — concurrent calls
   * cannot collide. Declaring `cleanup` is what makes that isolation automatic; no flag is needed.
   *
   * It is invoked on every terminal path of the call, at most once: a synchronous result or throw, a
   * settled promise (resolve *and* reject), a returned `ReadableStream` (once that stream finishes,
   * fails or is cancelled), and an abort of the call's signal. Write it defensively (`this.tx?.rollback()`),
   * since a body that threw before acquiring anything still ends the call.
   *
   * The hook may return a `Promise`. A synchronous entry point can only *initiate* that release (its
   * rejection is logged rather than thrown), while `run()`/`runWithPos()` already return a promise and
   * therefore resolve only after `cleanup` has settled. When both the body and `cleanup` fail, the two
   * errors are reported as one `AggregateError`.
   *
   * NOTE: like {@link BaseFuncItem.setup} and {@link BaseFuncItem.dispose}, this hook is only invoked
   * by the `makeToolFuncLifecycle` ability. Install it once, on the registry class you actually use:
   * `const Tools = makeToolFuncLifecycle(ToolFunc)`.
   *
   * @public
   *
   * @example
   * ```ts
   * const Tools = makeToolFuncLifecycle(ToolFunc);
   * const myFunc = new Tools({
   *   name: 'tx',
   *   func() {
   *     this.tx = db.begin();   // acquired whenever the body needs it, conditionally if you like
   *     return this.tx.query('select 1');
   *   },
   *   cleanup() { return this.tx?.commit() },  // <- runs when the call ends, however it ends
   * });
   * ```
   */
  cleanup?(this: ToolFunc): void | Promise<void>;
  /**
   * If true, indicates that this function should be treated as a server-side API.
   *
   * @public
   */
  isApi?: boolean;
  /**
   * If true, indicates that the function has the *capability* to stream its output.
   * Whether a specific call is streamed is determined by a `stream` property in the runtime parameters.
   *
   * @public
   */
  stream?: boolean;
  /**
   * Optional aliases for the function name.
   *
   * @public
   */
  alias?: string|string[];
  /**
   * A bitmask representing asynchronous features supported by the function, built from `AsyncFeatureBits`.
   * This allows the system to understand if a function supports capabilities like cancellation or multi-tasking.
   *
   * @public
   * @see `AsyncFeatureBits` from `./utils/async-features`
   * @example
   * ```ts
   * import { AsyncFeatures } from './utils';
   * const func = new ToolFunc({
   *   name: 'cancellableTask',
   *   asyncFeatures: AsyncFeatures.Cancelable | AsyncFeatures.MultiTask,
   *   // ...
   * });
   * ```
   */
  asyncFeatures?: number;
  /**
   * A map of dependencies this function has on other tool functions.
   * Declaring dependencies ensures that they are automatically registered when this function is registered.
   * This is crucial for building modular functions that rely on each other without needing to manage registration order manually.
   *
   * @public
   *
   * @example
   * ```ts
   * const helperFunc = new ToolFunc({ name: 'helper', func: () => 'world' });
   * const mainFunc = new ToolFunc({
   *   name: 'main',
   *   depends: {
   *     helper: helperFunc,
   *   },
   *   func() {
   *     // We can now safely run the dependency
   *     const result = this.runSync('helper');
   *     return `Hello, ${result}`;
   *   }
   * });
   * // When mainFunc is registered, helperFunc will be registered automatically.
   * mainFunc.register();
   * ```
   */
  depends?: {[name: string]: ToolFunc};
  /**
   * A detailed description of what the function does.
   *
   * @public
   */
  description?: string;
  /**
   * A concise, human-readable title for the function, often used in UI or by AI.
   *
   * @public
   */
  title?: string;
}

/**
 * Extends `BaseFuncItem` to include the actual function implementation.
 *
 * @public
 */
export interface FuncItem extends BaseFuncItem {
  /**
   * The implementation of the tool function.
   * Can be a real function, or a function-expression string (e.g. `'(a, b) => a + b'`)
   * that will be compiled at construction time.
   *
   * @public
   */
  func?: TFunc | TFuncString;
}

/**
 * Options for registering a tool function.
 *
 * @public
 */
export interface RegisterOptions extends FuncItem {
  /**
   * Optional override behavior:
   * - `true`: Allows overwriting an existing function with the same name.
   * - `{ name: true }`: Same as `true`.
   * - `{ alias: true }`: Allows stealing existing aliases from other functions.
   *
   * @public
   */
  allowOverride?: boolean | { name?: boolean, alias?: boolean };
}

/**
 * Options for isolating a ToolFunc registry.
 *
 * @public
 */
export interface ToolFuncRegistryIsolateOptions {
  /**
   * Whether to isolate the main function registry (default: true).
   *
   * @public
   */
  items?: boolean;
  /**
   * Whether to isolate the alias map (default: true).
   *
   * @public
   */
  aliases?: boolean;
  /**
   * Whether to isolate the reference counts (default: true).
   *
   * @public
   */
  refCounts?: boolean;
}

/**
 * Represents a fully-defined tool function where the implementation is mandatory.
 *
 * @public
 */
export interface BaseFunc extends BaseFuncItem {
  /**
   * The actual function implementation.
   *
   * @public
   * @param params - The parameters for the function.
   * @returns The result of the function.
   */
  func(...params: any[]): any;
}

/**
 * A map of registered `ToolFunc` instances, indexed by their names.
 *
 * @public
 */
export interface Funcs {
  [name: string]: ToolFunc
}

/**
 * Describes a package of tool functions, including methods for registration and unregistration.
 *
 * @public
 */
export interface ToolFuncPackage {
  /**
   * The name of the tool function package.
   *
   * @public
   */
  name: string
  /**
   * A method to register all functions within the package.
   *
   * @public
   * @param data - Optional data to pass to the registration process.
   */
  register: (data?: any) => void;
  /**
   * An optional method to unregister all functions within the package.
   *
   * @public
   */
  unregister?: () => void;
}

/**
 * Declaration merging with the {@link ToolFunc} class: instances (and the class itself) accept
 * arbitrary extra properties, so a tool may carry custom state or metadata beyond the declared
 * {@link BaseFuncItem} fields.
 *
 * @public
 */
export declare interface ToolFunc extends BaseFunc {
  /**
   * Any additional property a tool carries: custom state, plugin data, or extra metadata.
   *
   * @public
   */
  [name: string]: any;
}

/**
 * Options for unregistering a tool function.
 *
 * @public
 */
export interface UnregisterOptions {
  /**
   * If true, force physical removal from the registry even if references exist.
   * Also defaults the `decrement` option to `'all'` if not specified.
   *
   * @public
   */
  force?: boolean;
  /**
   * How to handle the reference count.
   * - 'once' (default): Decrement the count by one.
   * - 'all': Completely remove the reference count entry.
   *
   * @public
   *
   * @defaultValue force ? 'all' : 'once'
   */
  decrement?: 'once' | 'all';
  /**
   * The scope of unregistration in a hierarchical registry:
   * - 'local' (default): Only remove if the item is "owned" by the current scope.
   *   Ownership is defined by having an 'own' property in items, aliases, OR reference counts.
   *   Note: Including reference counts ensures that circular dependencies are correctly cleaned up
   *   even after the primary instance is removed from the items list during an override.
   * - 'inherited': Search up the prototype chain and remove the first match found.
   * - 'all': Remove all occurrences found in the entire prototype chain.
   *
   * @public
   */
  scope?: 'local' | 'inherited' | 'all';
}

/**
 * Finds the first level in the prototype chain that "owns" the specified name
 * as an own property in its items, aliases, or reference counts.
 *
 * @param target - The starting object/class in the chain.
 * @param name - The name or alias to look for.
 * @returns The object/class that owns the name, or undefined.
 * @internal
 */
function findRegistryOwner(target: any, name: string): any {
  let current = target;
  while (current && current.items) {
    if (Object.prototype.hasOwnProperty.call(current.items, name) ||
        Object.prototype.hasOwnProperty.call(current.aliases, name) ||
        Object.prototype.hasOwnProperty.call(current._refCounts, name)) {
      return current;
    }
    const next = Object.getPrototypeOf(current);
    if (!next || next === current || next === Object.prototype) break;
    current = next;
  }
  return undefined;
}

/**
 * A manager for creating, registering, and executing reusable tool functions.
 *
 * `ToolFunc` provides a robust framework for defining functions with rich metadata,
 * managing their lifecycle, and executing them through a centralized registry.
 * It is the core component for creating modular and discoverable tools.
 *
 * Key Features:
 * - **Rich Metadata**: Define functions with descriptions, parameters, tags, and titles, making
 *   them self-documenting.
 * - **Static Registry**: A global, static registry (`ToolFunc.items`) allows any part of an
 *   application to access and run registered functions by name.
 * - **Dependency Management**: Use the `depends` property to declare dependencies on other
 *   `ToolFunc`s, which are then auto-registered.
 * - **Aliasing**: Assign multiple names to a function for flexibility.
 * - **Lifecycle Hooks**: Use the `setup`/`dispose` pair when you install the
 *   `makeToolFuncLifecycle` ability. They turn plain hook functions (stored but ignored by a bare
 *   `ToolFunc`) into a symmetric lifecycle: `register()` runs `setup`, `dispose()` is the inverse
 *   teardown, an async `setup` makes the instance *pending* (gated for `runSync` /
 *   `runWithPosSync`), and `dispose` re-arms the hook so an unregister/register cycle rebuilds the
 *   acquired state. `cleanup` extends the same symmetry to the *call*: it releases that call's
 *   resources once, on success, throw, abort, and after a returned stream ends.
 *
 * @public
   * @see `makeToolFuncLifecycle` (from `@src/utils/lifecycle-ability.ts`)
   * @see `LifecycleAbility`
   * @see `LifecycleAbilityOptions`
   * - **Parameter Handling**: Automatically handles both positional and named parameters.
 *
 *
 * @example
 * ```ts
 * // 1. Define a helper function
 * const getUser = new ToolFunc({
 *   name: 'getUser',
 *   description: 'Retrieves a user by ID.',
 *   params: { id: { type: 'string', required: true } },
 *   func: (params) => ({ id: params.id, name: 'John Doe' }),
 * });
 *
 * // 2. Define a main function that depends on the helper
 * const welcomeUser = new ToolFunc({
 *   name: 'welcomeUser',
 *   title: 'Welcome User',
 *   description: 'Generates a welcome message for a user.',
 *   params: { userId: 'string' },
 *   depends: {
 *     // By declaring this dependency, `getUser` will be auto-registered
 *     // when `welcomeUser` is registered.
 *     userFetcher: getUser,
 *   },
 *   func: function(params) {
 *     // `this` is the ToolFunc instance, so we can use `runSync`
 *     const user = this.runSync('userFetcher', { id: params.userId });
 *     return `Hello, ${user.name}!`;
 *   },
 * });
 *
 * // 3. Register the main function. The dependency is registered automatically.
 * welcomeUser.register();
 *
 * // 4. Run the function from anywhere using the static runner.
 * async function main() {
 *   const message = await ToolFunc.run('welcomeUser', { userId: '123' });
 *   console.log(message); // Outputs: "Hello, John Doe!"
 * }
 *
 * main();
 * ```
 */
export class ToolFunc extends AdvancePropertyManager {
  /**
   * A static registry of all `ToolFunc` implementations, indexed by their primary name.
   *
   * @public
   */
  static items: Funcs = {};

  /**
   * A static map of aliases to their corresponding primary function names.
   *
   * @public
   */
  static aliases: {[name: string]: string} = {};

  /**
   * Tracks the number of active registration holds on each function name.
   * A function is truly removed only when its reference count drops to zero.
   * @internal
   */
  protected static _refCounts: {[name: string]: number} = {};

  /**
   * The registry class where this tool was originally registered.
   * @internal
   */
  _registry?: typeof ToolFunc;

  /**
   * A conventional property to designate a file path for saving the registered `ToolFunc` data.
   * Note: The `ToolFunc` class itself does not implement persistence logic. It is up to the
   * developer to use this path to save and load the `ToolFunc.items` registry if needed.
   *
   * @public
   */
  static dataPath: string;

  /**
   * The static execution context for proxy classes created via ToolFunc.with().
   *
   * @public
   */
  static ctx?: ToolFuncContext;

  /**
   * Returns a static proxy with the provided context.
   *
   * @public
   *
   * @param ctx - The context to use.
   * @returns A static proxy of ToolFunc class.
   */
  static with(ctx: ToolFuncContext): typeof ToolFunc {
    const proxy = Object.create(this);
    proxy.ctx = this._prepareContext(this.ctx, ctx);
    return proxy;
  }

  /**
   * Internal helper to prepare the execution context, maintaining the prototype chain.
   *
   * @param parentCtx - The parent context to inherit from.
   * @param ctx - The new context properties to apply.
   * @returns The merged context.
   * @internal
   *
   * DANGER - DO NOT "OPTIMIZE" UNLESS YOU UNDERSTAND:
   * 1. Why NOT Object.assign(target, ctx) alone?
   *    Object.assign only copies 'own' properties. In nested calls (e.g., .with().with()),
   *    parent properties exist on the prototype. Using assign would drop all inherited
   *    context data (like traceId from a parent runner).
   * 2. Why NOT Object.setPrototypeOf?
   *    It's a heavy performance killer in V8. We use Object.create(proto) instead.
   * 3. Why check isPrototypeOf?
   *    If ctx is already in the chain, we return it to maintain identity and avoid
   *    redundant shadow layers, which is required by many AOP plugins and unit tests.
   */
  static _prepareContext(parentCtx?: ToolFuncContext, ctx?: ToolFuncContext): ToolFuncContext {
    if (ctx?.inheritContext === false || parentCtx?.inheritContext === false) return ctx ? { ...ctx } : {};

    if (!ctx) return parentCtx && parentCtx !== Object.prototype ? Object.create(parentCtx) : {};

    if (parentCtx && parentCtx !== Object.prototype && Object.prototype.isPrototypeOf.call(parentCtx, ctx)) {
      return ctx;
    }

    if (!parentCtx || parentCtx === Object.prototype) {
      return ctx;
    }

    // High-performance shadow creation: create with proto, then mix-in new overrides.
    return Object.assign(Object.create(parentCtx), ctx);
  }

  /**
   * Returns an isolated instance with the provided context.
   *
   * @public
   *
   * @param ctx - The context to use.
   * @returns An isolated ToolFunc instance.
   */
  with(ctx: ToolFuncContext): this {
    const runner = Object.create(this);
    runner.ctx = this._prepareContext(undefined, ctx);
    return runner;
  }

  /**
   * The execution context for the current function call.
   * Only available when isolated execution is enabled.
   *
   * @public
   */
  ctx?: ToolFuncContext;

  /**
   * Retrieves a registered function by its name or alias.
   *
   * @public
   * @param name - The name or alias of the function to retrieve.
   * @returns The `ToolFunc` instance if found, otherwise `undefined`.
   */
  static get(name: string) {
    let result = this.items[name];
    if (!result && (name = this.aliases[name])) {
      result = this.items[name]
    }
    return result
  }

  /**
   * Returns the complete map of all registered functions.
   *
   * @public
   * @returns The map of `ToolFunc` instances.
   */
  static list() {
    return this.items
  }

  /**
   * Finds the first registered function that has a specific tag.
   *
   * @public
   * @param tagName - The tag to search for.
   * @returns The first matching `ToolFunc` instance, or `undefined` if none is found.
   */
  static getByTag(tagName: string) {
    let result: ToolFunc|undefined;
    for (const name in this.list()) {
      const item = this.get(name)
      if (!item) continue;
      let tags = item.tags
      if (typeof tags === 'string') {
        if (tags === tagName) {
          result = item
          break
        }
      } else if (Array.isArray(tags)) {
        if (tags.indexOf(tagName) >= 0) {
          result = item
          break
        }
      }
    }
    return result
  }

  /**
   * Retrieves all registered functions that have a specific tag.
   *
   * @public
   * @param tagName - The tag to search for.
   * @returns An array of matching `ToolFunc` instances.
   */
  static getAllByTag(tagName: string) {
    let result: ToolFunc[] = [];
    for (const name in this.list()) {
      const item = this.get(name)
      if (!item) {
        continue;
      }
      let tags = item.tags
      if (typeof tags === 'string') {
        if (tags === tagName) {
          result.push(item)
        }
      } else if (Array.isArray(tags)) {
        if (tags.indexOf(tagName) >= 0) {
          result.push(item)
        }
      }
    }
    return result
  }

  /**
   * Checks if any registered function has a specific asynchronous feature.
   *
   * @public
   * @param feature - The async feature bit to check for.
   * @returns `true` if the feature is present in any function, otherwise `false`.
   */
  static hasAsyncFeature(feature: AsyncFeatureBits) {
    const proto = this.prototype
    let features = proto.asyncFeatures || 0
    if (proto._asyncFeatures) { features |= proto._asyncFeatures }
    return IntSet.has(features, feature)
  }

  /**
   * Asynchronously executes a registered function by name with named parameters.
   *
   * Note: This method returns a `Promise` if the underlying function is asynchronous,
   * otherwise it may return the result synchronously.
   *
   * @public
   *
   * @param name - The name of the function to run.
   * @param params - The parameters object for the function.
   * @param ctx - The execution context.
   * @returns A promise or the direct result of the function's execution.
   * @throws `NotFoundError` If the function with the given name is not found.
   */
  static run(name: string, params?: any, ctx?: ToolFuncContext): Promise<any>|any {
    const func = this.get(name)
    if (func) {
      const context = this._prepareContext(this.ctx, ctx);
      if (!context.rootRegistry) { context.rootRegistry = this }
      return func.run(params, context)
    }
    throw new NotFoundError(`${name} to run`, this.name);
  }

  /**
   * Synchronously executes a registered function by name with named parameters.
   *
   * @public
   * @param name - The name of the function to run.
   * @param params - The parameters object for the function.
   * @param ctx - The execution context.
   * @returns The result of the function's execution.
   * @throws `NotFoundError` If the function with the given name is not found.
   */
  static runSync(name: string, params?: any, ctx?: ToolFuncContext) {
    const func = this.get(name)
    if (func) {
      const context = this._prepareContext(this.ctx, ctx);
      if (!context.rootRegistry) { context.rootRegistry = this }
      return func.runSync(params, context)
    }
    throw new NotFoundError(`${name} to run`, this.name);
  }

  /**
   * Retrieves a bound, runnable function reference for a registered function.
   * This reference is suitable for execution with an object of named parameters.
   *
   * @public
   * @param name - The name of the function.
   * @returns A bound function reference, or `undefined` if not found.
   */
  static getFunc(name: string): Function | undefined {
    const func = this.get(name)
    return func?.getFunc()
  }

  /**
   * Asynchronously executes a function using positional arguments.
   *
   * Note: This method returns a `Promise` if the underlying function is asynchronous,
   * otherwise it may return the result synchronously.
   *
   * @public
   *
   * @param name - The name of the function to run.
   * @param params - Positional arguments to pass to the function.
   * @returns A promise or the direct result of the function's execution.
   * @throws `NotFoundError` If the function with the given name is not found.
   */
  static runWithPos(name: string, ...params: any[]): Promise<any>|any {
    const func = this.get(name)
    if (func) {
      const runner = this.ctx ? func.with(this.ctx) : func;
      return runner.runWithPos(...params)
    }
    throw new NotFoundError(`${name} to run`, this.name);
  }

  /**
   * Synchronously executes a function using positional arguments.
   *
   * @public
   * @param name - The name of the function to run.
   * @param params - Positional arguments to pass to the function.
   * @returns The result of the function's execution.
   * @throws `NotFoundError` If the function with the given name is not found.
   */
  static runWithPosSync(name: string, ...params: any[]) {
    const func = this.get(name)
    if (func) {
      const runner = this.ctx ? func.with(this.ctx) : func;
      return runner.runWithPosSync(...params)
    }
    throw new NotFoundError(`${name} to run`, this.name);
  }

  /**
   * Retrieves a bound, runnable function reference for a registered function.
   * This reference is suitable for execution with positional arguments.
   *
   * @public
   * @param name - The name of the function.
   * @returns A bound function reference, or `undefined` if not found.
   */
  static getFuncWithPos(name: string) {
    const func = this.get(name)
    return func?.getFuncWithPos()
  }

  /**
   * Internal helper to normalize arguments from various input patterns.
   * Priority: name (arg1) \> options (arg2).
   *
   * @param name - Primary config.
   * @param options - Default config.
   * @returns Normalized options object.
   * @internal
   */
  protected static _normalizeArguments(name: ToolFunc | string | Function | FuncItem, options?: FuncItem | any): any {
    let result: any;

    if (typeof name === 'string') {
      result = { name };
    } else if (typeof name === 'function') {
      result = { func: name as TFunc };
      const meta = (name as any)[FuncMetaSymbol];
      if (meta && typeof meta === 'object') {
        Object.assign(result, meta);
      }
    } else if (name instanceof ToolFunc) {
      result = name;
    } else if (name && typeof name === 'object') {
      result = { ...name };
    } else {
      result = {};
    }

    if (typeof options === 'string') {
      // The 2nd arg is a function-expression string, e.g. register('add', '(a, b) => a + b').
      // First-arg priority is preserved: func is only filled if not already present.
      defaultsDeep(result, { func: options });
    } else if (options && typeof options === 'object' && options !== name && options !== result) {
      defaultsDeep(result, options);
    }

    if (!result.name) {
      if (typeof result.func === 'function' && (result.func as any).name) {
        result.name = (result.func as any).name;
      } else if (typeof result.func === 'string') {
        // Derive the name from a named function expression, e.g. 'function add(a, b) {...}'.
        const m = (result.func as string).match(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/);
        if (m) { result.name = m[1]; }
      }
    }

    return result;
  }

  /**
   * Isolates the current registry layer by branching off its parent using prototype shadowing.
   *
   * This creates a new "scope" where:
   * 1. New registrations are stored only in the local layer, supporting tool shadowing.
   * 2. Parent tools remain accessible via the prototype chain (read-only) unless shadowed.
   * 3. Reference counting is isolated, enabling clean per-layer lifecycle management.
   *
   * @public
   *
   * @param options - Options to selectively isolate specific maps (items, aliases, refCounts).
   */
  static isolateRegistry(options: ToolFuncRegistryIsolateOptions = { items: true, aliases: true, refCounts: true }) {
    const Parent = Object.getPrototypeOf(this) as typeof ToolFunc;
    if (!Parent || !Parent.items) return;

    if (options.items !== false) {
      this.items = Object.create(Parent.items);
    }
    if (options.aliases !== false) {
      this.aliases = Object.create(Parent.aliases);
    }
    if (options.refCounts !== false) {
      this._refCounts = Object.create(Parent._refCounts);
    }
  }

  /**
   * Resets the local registry by clearing all registered items, aliases, and reference counts.
   *
   * In a hierarchical registry, this only clears properties "owned" by the current
   * layer. Inherited items from parent registries remain visible through the prototype chain.
   *
   * Every tool this layer owns is released first, so its lifecycle actually runs: the tool — and
   * the dependencies it solely holds — gives back whatever `setup` acquired. Swapping the tables
   * alone would silently leak every one of them.
   *
   * Like `unregister()`, teardown is only *initiated*, never awaited: an asynchronous `dispose`
   * cannot be waited for here, and since a dependency's release is chained behind its holder's, an
   * asynchronous teardown is still in flight while the next tool goes down. Use `clearAsync()`
   * (installed by the lifecycle ability) when the layer may hold asynchronous teardown.
   *
   * @public
   */
  static clear() {
    // Release what this layer owns *before* dropping the tables: a registered tool holds real
    // resources (a connection, a timer, a subscription) and its `dispose` — plus the release of
    // the dependencies it solely holds — would otherwise never run. Swapping the tables alone
    // leaks every one of them.
    //
    // Tools are released in reverse dependency order, for the same reason a tool is released
    // before the dependencies it declares: one that is still named in another live tool's
    // `depends` has to wait. Neither `items` order nor its reverse expresses that on its own —
    // a tool is inserted *before* the dependencies it declares, but a dependency registered
    // separately may well come first — so the order is derived from the declared edges.
    let remaining = Object.keys(this.items || {})
    while (remaining.length) {
      const held: string[] = []
      const releasable: string[] = []
      for (const name of remaining) {
        if (this._isStillHeld(name)) held.push(name)
        else releasable.push(name)
      }
      // A dependency cycle leaves nothing releasable; break it by releasing the rest in order.
      const batch = releasable.length ? releasable : held
      for (const name of batch) {
        try {
          this.unregister(name, { force: true, scope: 'local' })
        } catch (e) {
          // Best-effort: a failing teardown must not leave the registry half-cleared.
          console.error(`[ToolFunc] teardown of "${name}" failed during clear():`, e)
        }
      }
      remaining = releasable.length ? held : []
    }

    const protoItems = Object.getPrototypeOf(this.items || {});
    const protoAliases = Object.getPrototypeOf(this.aliases || {});
    const protoRefCounts = Object.getPrototypeOf(this._refCounts || {});

    this.items = protoItems === Object.prototype ? {} : Object.create(protoItems);
    this.aliases = protoAliases === Object.prototype ? {} : Object.create(protoAliases);
    this._refCounts = protoRefCounts === Object.prototype ? {} : Object.create(protoRefCounts);
  }

  /**
   * Analyzes the registration context and determines the appropriate action.
   *
   * @param name - The function name to register.
   * @param override - Override options.
   * @returns The determined registration action.
   * @internal
   */
  protected static _getRegistrationAction(name: string, override: { name?: boolean }): 'create' | 'shadow' | 'replace' | 'increment' {
    const owner = findRegistryOwner(this, name);
    const isOwn = owner === this;
    const isInherited = !!owner && !isOwn;

    // 1. Cross-scope Namespace Protection
    if (isInherited && override.name === false) {
      throwError(`Name "${name}" is already defined in parent registry and shadowing is disabled.`);
    }

    // 2. Local Collision
    if (isOwn) {
      // Robustness: only increment if it actually exists in items.
      // If it's a "ghost" (only in _refCounts), treat as 'create' to restore it.
      if (Object.prototype.hasOwnProperty.call(this.items, name)) {
        return override.name ? 'replace' : 'increment';
      }
    }

    // 3. New Entry or Shadowing
    return isInherited ? 'shadow' : 'create';
  }

  /**
   * Consumes the internal cycle-detection stack from a normalized options object.
   *
   * The stack (a `Set`) is a registration-call-scoped value carried internally via the
   * '_stack' property (used by recursive dependency registration). It is extracted and
   * removed so it never reaches instance state or serialization.
   *
   * @param options - The normalized options object (may be a ToolFunc instance).
   * @returns The extracted stack, if any.
   * @internal
   */
  protected static _extractStack(options: any): Set<string> | undefined {
    if (options && typeof options === 'object' && options._stack instanceof Set) {
      const stack: Set<string> = options._stack;
      delete options._stack;
      return stack;
    }
    return undefined;
  }

  /**
   * Normalizes the arguments passed to the `register` method into a unified `RegisterOptions` object.
   *
   * @param name - The primary identification or implementation.
   * @param options - Additional or overriding configuration.
   * @returns A normalized options object ready for registration.
   * @internal
   */
  protected static _normalizeRegisterArguments(name: ToolFunc | string | Function | RegisterOptions, options?: RegisterOptions): RegisterOptions {
    const result = this._normalizeArguments(name, options);
    const allowOverride = result.allowOverride;
    result.override = typeof allowOverride === 'object' ? { ...allowOverride } : { name: allowOverride };
    if (result.hasOwnProperty('allowOverride')) { delete result.allowOverride; }
    return result;
  }

  /**
   * Registers a `ToolFunc` instance into the registry.
   *
   * This method supports multiple overloads and handles hierarchical registration,
   * alias collision protection, and automatic dependency registration with cycle detection.
   *
   * ### Hierarchical Behavior:
   * - In an isolated registry, items are stored locally, shadowing parent items with the same name.
   * - Alias consistency is enforced across the hierarchy: registering a colliding alias throws an error
   *   unless `allowOverride.alias` is explicitly granted.
   *
   * ### Circular Dependencies:
   * Automatically detects and manages circular dependency chains using an internal stack.
   * Reference counts are precisely managed (count=1 for back-edges) to prevent memory leaks
   * and enable clean group unregistration.
   *
   * @public
   *
   * @param name - The tool instance, function, or name to register.
   * @param options - Configuration or implementation for the tool.
   *   The internal cycle-detection stack (a `Set`) may also be carried as `_stack` — either in this
   *   options argument or in the first-arg config object (used by recursive dependency registration);
   *   it is consumed and removed during normalization, never reaching the instance.
   *   With the `(name, funcString, config)` form, an optional third `config` argument is accepted
   *   that provides params/metadata defaults for the function-expression string.
   * @returns The registered ToolFunc instance on success (creation, shadowing, or override),
   * or `false` if registration was ignored (e.g., ref-count increment only).
   *
   * @example
   * ```ts
   * // 1. Registering with explicit name and function
   * ToolFunc.register('add', { func: (a, b) => a + b });
   *
   * // 2. Registering with shadowing permission in an isolated registry
   * MyPluginTools.register('calc', { func: () => 2, allowOverride: true });
   *
   * // 3. Registering an existing ToolFunc instance
   * const tool = new ToolFunc({ name: 'my-tool', func: () => 'ok' });
   * ToolFunc.register(tool);
   *
   * // 4. Registering from a function-expression string (compiled at registration time)
   * ToolFunc.register('add', '(a, b) => a + b');
   *
   * // 5. Same, with an optional config object describing params and metadata
   * ToolFunc.register('add', '(a, b) => a + b', { params: [{ name: 'a' }, { name: 'b' }], description: 'Adds two numbers' });
   *
   * // 6. Registering a named function expression without an explicit name
   * ToolFunc.register({ func: 'function greet(name) { return `Hi ${name}`; }' });
   * ```
   * @throws `Error` If name is missing, or if an alias collision occurs without permission.
   */
  static register(name: string, options: RegisterOptions): boolean|ToolFunc
  static register(func: Function, options: RegisterOptions): boolean|ToolFunc
  static register(name: string, func: TFuncString, options?: RegisterOptions): boolean|ToolFunc
  static register(name: string|ToolFunc|Function|RegisterOptions, options?: RegisterOptions): boolean|ToolFunc
  static register(name: ToolFunc|string|Function|RegisterOptions, options: RegisterOptions|ToolFunc|TFuncString = {} as any, config?: RegisterOptions) {
    // Support: register(name, funcString, config?)
    // The optional 3rd arg is only meaningful with the (name, funcString, config) form.
    if (typeof options === 'string') {
      // defaultsDeep: the func string wins; config only fills missing metadata.
      options = config ? defaultsDeep({ func: options }, config) : { func: options };
    }
    options = this._normalizeRegisterArguments(name, options as RegisterOptions);

    // The cycle-detection stack is carried internally via the '_stack' property
    // (used by recursive dependency registration). It may arrive either in the
    // first-arg config object or in the second-arg options, so it is extracted
    // from the NORMALIZED result — catching both positions — and removed before
    // it can reach the constructed instance. Extracting after normalization also
    // avoids mutating a caller-provided options object: for object first-args the
    // normalized result is a fresh copy, so the caller's original is untouched.
    const _stack = this._extractStack(options);

    const override = (options as any).override;
    if (options.hasOwnProperty('override')) { delete (options as any).override; }

    let realName = options.name as string
    if (!realName) { throwError('Function name is required for registration') }

    const existing = this.get(realName)
    const normalizedName = existing ? existing.name! : realName
    options.name = normalizedName

    // Circular Dependency Detection via Stack (Ancestors only)
    const stack = _stack || new Set<string>();
    if (stack.has(normalizedName)) {
      return false; // Back-edge: already processing this tool in current call stack
    }

    // 2. Atomic Alias Check (Ensures alias consistency across the hierarchy)
    const alias = (options as any).alias
    if (alias) {
      const aliases = Array.isArray(alias) ? alias : [alias]
      for (const a of aliases) {
        // Find owner of the alias in the entire hierarchy
        const owner = this.aliases[a];

        if (owner && owner !== normalizedName && !override.alias) {
          throwError(`Alias "${a}" already exists for "${owner}".`)
        }
      }
    }

    const action = this._getRegistrationAction(normalizedName, override);
    let result: boolean|ToolFunc = (action === 'increment' || action === 'replace') && !!existing;

    if (action === 'replace') {
      const refCount = this._refCounts[normalizedName] || 1
      console.warn(`[ToolFunc] Overriding "${normalizedName}" which is held by ${refCount} references.`)
      this.unregister(normalizedName, { force: true, decrement: 'once', scope: 'local' })
      result = false
    }

    if (action === 'create' || action === 'shadow' || action === 'replace') {
      if (!(options instanceof ToolFunc)) {
        options = new this(options)
      }
      const inst = options as ToolFunc
      inst._registry = this;
      this.items[normalizedName] = inst

      stack.add(normalizedName);
      this._incRefCount(normalizedName)

      try {
        if (inst.alias) {
          const aliases = Array.isArray(inst.alias) ? inst.alias : [inst.alias]
          for (const a of aliases) {
            this.aliases[a] = normalizedName
          }
        }
        this._acquireDependencies(inst, stack)
        result = inst
      } catch (e) {
        this.unregister(normalizedName, { force: true, scope: 'local' })
        throw e
      } finally {
        stack.delete(normalizedName);
      }
    } else { // action === 'increment'
      this._incRefCount(normalizedName)

      if (alias && existing instanceof ToolFunc) {
        const aliases = Array.isArray(alias) ? alias : [alias]
        for (const a of aliases) { this.aliases[a] = normalizedName }
        const old = existing.alias
        if (!old) { existing.alias = alias }
        else {
          const merged = new Set(Array.isArray(old) ? old : [old])
          aliases.forEach(a => merged.add(a))
          existing.alias = Array.from(merged)
        }
      }
      result = false
    }
    return result
  }

  /**
   * Unregisters a tool function implementation from the registry by its name, alias, or instance.
   *
   * This method supports hierarchical unregistration. If a function's reference count
   * reaches zero, it is physically removed from the registry and its dependencies are released.
   *
   * @public
   *
   * @param target - The name, alias, or implementation instance.
   * @param options - Unregistration options, or a boolean shorthand for `{ force: true }`.
   *   Recognized fields:
   *   - `force`: If true, removes the tool immediately, ignoring the reference count
   *     (default: `false`).
   *   - `decrement`: How many registration holds to release — `'once'` (default) or `'all'`.
   *   - `scope`: Hierarchical search scope —
   *     `'local'` (default) only removes a tool owned by the current registry layer;
   *     `'inherited'` searches up and removes the first match found in parents;
   *     `'all'` removes every occurrence in the whole prototype chain.
   * @returns The unregistered ToolFunc instance, or `undefined` if not found.
   */
  static unregister(target: string | ToolFunc, options?: UnregisterOptions | boolean): ToolFunc|undefined {
    let force = false
    let decrement: 'once' | 'all' = 'once'
    let scope: 'local' | 'inherited' | 'all' = 'local'

    if (typeof options === 'boolean') {
      force = options; if (force) decrement = 'all'
    } else if (options && typeof options === 'object') {
      force = !!options.force
      decrement = options.decrement || (force ? 'all' : 'once')
      scope = options.scope || 'local'
    }

    let inst: ToolFunc | undefined;
    let realName: string | undefined;

    if (typeof target === 'string') {
      inst = this.items[target] || this.get(target);
      realName = inst ? inst.name : (this.aliases[target] || target);
    } else {
      inst = target;
      realName = inst.name;
    }

    if (!realName) return undefined;

    // Hierarchy Scope Handling
    if (scope === 'inherited' || scope === 'all') {
      let result: ToolFunc | undefined;
      let current: any = this;
      while (current) {
        const owner = findRegistryOwner(current, realName);
        if (!owner) break;

        result = owner.unregister(target, { ...(options as any), scope: 'local' });
        if (scope === 'inherited' && result) return result;

        current = Object.getPrototypeOf(owner);
        if (!current || current === Object.prototype) break;
      }
      return result;
    }

    /**
     * SCOPE & OWNERSHIP CHECK:
     * In a hierarchical registry, we must prevent a child scope from accidentally
     * unregistering items belonging to its parent.
     *
     * Why check _refCounts for 'local' scope?
     * During a 'force' unregistration or override of circular dependencies (e.g., A \<-\> B),
     * an item (A) is physically removed from 'this.items' EARLY to prevent re-entrancy.
     * However, its "ghost state" (the reference count) must remain accessible to the
     * recursive cleanup process (_releaseDependencies) so that subsequent calls to
     * unregister(A) from its dependencies can still identify 'A' as locally owned
     * and finish decrementing its count to zero.
     */
    if (scope === 'local') {
      if (!Object.prototype.hasOwnProperty.call(this.items, realName) &&
          !Object.prototype.hasOwnProperty.call(this.aliases, realName) &&
          !Object.prototype.hasOwnProperty.call(this._refCounts, realName)) {
        return undefined;
      }
    }

    let newCount = 0

    if (decrement === 'all') {
      delete this._refCounts[realName]
    } else {
      newCount = this._decRefCount(realName)
    }

    if (newCount === 0 || force) {
      if (inst && this.items[realName] === inst) {
        delete this.items[realName]
        if (inst.alias) {
          const list = Array.isArray(inst.alias) ? inst.alias : [inst.alias]
          for (const a of list) { if (this.aliases[a] === realName) delete this.aliases[a] }
        }
      }
      if (inst) {
        this._releaseInstance(inst)
      }
    }

    return inst
  }

  protected static _incRefCount(name: string) {
    const isOwn = Object.prototype.hasOwnProperty.call(this._refCounts, name);
    const current = isOwn ? this._refCounts[name] : 0;
    this._refCounts[name] = current + 1;
  }

  protected static _decRefCount(name: string): number {
    const current = this._refCounts[name] || 0
    if (current <= 1) {
      delete this._refCounts[name]
      return 0
    }
    const count = current - 1
    this._refCounts[name] = count
    return count
  }

  protected static _acquireDependencies(inst: ToolFunc, stack?: Set<string>) {
    const depends = inst.depends
    if (depends) {
      for (const dep of Object.values(depends)) {
        if (dep instanceof ToolFunc) {
          this.register(dep, stack ? ({ _stack: stack } as any) : undefined)
        }
      }
    }
  }

  /**
   * Whether any tool currently registered in this layer names `name` in its `depends`.
   *
   * Only *live* tools are considered, so a dependency owned by a parent layer never keeps a
   * locally-owned tool waiting — that tool's removal releases its own hold and stops there.
   *
   * @internal
   */
  protected static _isStillHeld(name: string): boolean {
    for (const key of Object.keys(this.items || {})) {
      const depends = this.items[key]?.depends
      if (!depends) continue
      for (const dep of Object.values(depends)) {
        if (dep instanceof ToolFunc && dep.name === name) return true
      }
    }
    return false
  }

  /**
   * The dependencies of `inst`, in the order they must be released: **reverse declaration order**.
   *
   * A dependency is acquired — and therefore declared — before the tools that use it, and it must
   * be released after them. Reversing the acquisition order is the one convention that keeps both
   * directions correct: declare a dependency before the tool that uses it, and every dependency
   * outlives everything that depends on it. Declaration order is also the acquisition order, so a
   * single convention covers both ends of the lifetime.
   *
   * @internal
   */
  protected static _dependencyReleaseOrder(inst: ToolFunc): ToolFunc[] {
    const depends = inst.depends
    if (!depends) return []
    return Object.values(depends)
      .filter((dep): dep is ToolFunc => dep instanceof ToolFunc)
      .reverse()
  }

  protected static _releaseDependencies(inst: ToolFunc) {
    for (const dep of this._dependencyReleaseOrder(inst)) {
      this.unregister(dep.name!)
    }
  }

  /**
   * Finalizes an instance that has just been physically removed from this layer.
   *
   * The instance's own teardown comes **before** its dependencies are released: a dependency must
   * outlive everything that uses it, so a dependent's `dispose` still finds a live dependency to
   * give back what its `setup` took. The lifecycle ability overrides this to drive the `dispose`
   * hook — and to wait for an asynchronous teardown — between the two steps.
   *
   * @internal
   */
  protected static _releaseInstance(inst: ToolFunc) {
    this._releaseDependencies(inst)
  }

  /**
   * Initializes a new `ToolFunc` instance.
   *
   * If a named function is provided as the first argument (or in `options.func`),
   * and no name is explicitly provided, the instance will automatically inherit the function's name.
   *
   * @public
   *
   * @param name - Can be a function name, a function implementation, or a configuration object.
   * @param options - Configuration options if not provided in the first argument.
   *   Can also be a function-expression string (e.g. `'(a, b) => a + b'`) for the `(name, funcString)` form.
   *   An internal `_stack` property (a `Set`, used for cycle detection during registration) is
   *   consumed and removed here so it never becomes instance state.
   * @param config - Optional config object, only used with the `(name, funcString, config)` form.
   */
  constructor(name: string|Function|FuncItem, options: FuncItem|any = {}, config?: FuncItem|any) {
    super()

    // Support: new ToolFunc(name, funcString, config?)
    // Same normalization as register: the 2nd arg can be a function-expression string,
    // with an optional 3rd config object describing params and metadata.
    if (typeof options === 'string') {
      // defaultsDeep: the func string wins; config only fills missing metadata.
      options = config ? defaultsDeep({ func: options }, config) : { func: options };
    }
    options = (this.constructor as typeof ToolFunc)._normalizeArguments(name, options);

    // Defensive strip: the internal cycle-detection stack must never become instance
    // state. register() consumes it before construction; this catches direct
    // construction (e.g. new ToolFunc({ _stack })) where register is not involved.
    (this.constructor as typeof ToolFunc)._extractStack(options);

    this.name = options.name as string
    // _origin always points to the Root ToolFunc instance (the one created via 'new').
    // RATIONALE:
    // 1. State Persistence: Concurrent states like semaphores and task pools MUST stay on the root.
    // 2. Closure Binding: Using '() => this' in the constructor locks the reference to the root
    //    instance, ensuring that even deep shadow chains (Object.create) can always trace back
    //    to the same origin.
    // 3. Vitest Compatibility: The no-op setter and 'configurable: true' prevent TypeError during
    //    Vitest's deep diffing/proxying processes when a test fails.
    Object.defineProperty(this, '_origin', {
      get: () => this,
      set: (v) => {},
      enumerable: false,
      configurable: true
    });
    // const ctor = this.constructor as unknown as typeof ToolFunc;
    // if (ctor.items[name]) {
    //   throw new AlreadyExistsError(`Function ${name}`, ToolFunc.name)
    // }
    // initialize PropertyManager (which assigns `scope` before `func`, see ToolFuncSchema)
    // NOTE: `setup` is deliberately NOT invoked here. It is a *registration* time hook and is
    // driven by the `makeToolFuncLifecycle` ability (see @src/utils/lifecycle-ability.ts), which
    // also owns the `dispose` counterpart. Keeping it out of the constructor is what makes
    // setup/dispose exact inverses across a re-registration cycle.
    this.initialize(options)
  }

  /**
   * Registers the current `ToolFunc` instance into the static registry.
   * Also registers any declared dependencies.
   *
   * @public
   * @returns The instance itself upon successful registration, or `false` if it already exists.
   */
  register() {
    const Tools = (this.constructor as unknown as typeof ToolFunc)
    return Tools.register(this)
  }

  /**
   * Removes the current `ToolFunc` instance from the static registry.
   *
   * @public
   * @param options - Unregistration options or a boolean force flag.
   * @returns The instance that was unregistered.
   */
  unregister(options?: UnregisterOptions | boolean) {
    return (this.constructor as any).unregister(this.name, options)
  }

  /**
   * Converts an array of positional arguments into a named parameters object.
   * This is used internally to support functions defined with named parameters.
   *
   * @public
   * @param params - An array of positional arguments.
   * @returns An array containing a single parameters object.
   */
  arr2ObjParams(params: any[]) {
    if (this.params && (params.length > 1 || Array.isArray(params[0]) || (params[0] && typeof params[0] !== 'object'))) {
      const _p: any = {}
      const keys = Object.keys(this.params)
      let len = Math.min(keys.length, params.length)
      for (let i = 0; i < len; i++) {
        _p[keys[i]] = params[i]
      }
      params=[_p]
    }
    return params
  }

  /**
   * Converts a named parameters object into an array of positional arguments.
   * This is used for functions defined with positional parameters.
   *
   * @public
   * @param params - A named parameters object.
   * @returns An array of positional arguments.
   */
  obj2ArrParams(params?: any): any[] {
    const result: any[] = []
    if (params && this.params && Array.isArray(this.params)) {
      const keys = Object.keys(params)
      let len = Math.min(keys.length, this.params.length)
      for (let i = 0; i < len; i++) {
        result.push(params[keys[i]])
      }
    }
    return result;

  }

  /**
   * Determines if the function execution should be isolated into a "Shadow Instance".
   * Isolation creates a lightweight clone of the current tool to provide a unique `this.ctx`
   * for the duration of the call, preventing property collisions in concurrent environments.
   *
   * When the `makeToolFuncLifecycle` ability has been installed, this gate also keeps `runSync`/
   * `runWithPosSync` out of a tool that is still *pending* across stacks (async `setup` in flight)
   * and refuses a strictly-paired tool (one with a `dispose` hook) that has not been `register()`ed.
   *
   * @param params - The runtime parameters for the function call.
   * @param ctx - The optional execution context provided by the user for this specific call (e.g., via `runSync(params, ctx)`).
   * @returns `true` if a shadow instance should be created, otherwise `false`.
   * @internal
   */
  protected _shouldIsolate(params?: any, ctx?: ToolFuncContext): boolean {
    if (ctx?.isolated !== undefined) return ctx.isolated;
    if (ctx) return true;
    // If already isolated (own property ctx), no need to isolate again.
    if (Object.prototype.hasOwnProperty.call(this, 'ctx')) return false;
    if (this.ctx?.isolated !== undefined) return this.ctx.isolated;
    return !!this.ctx;
  }

  /**
   * Creates the final execution context (`this.ctx`) for a Shadow Instance.
   *
   * NOTE: We MUST use 'this._prepareContext' (instance path) instead of
   * 'Static._prepareContext' to allow AOP plugins (like CancelableAbility)
   * to hook into context preparation via method overloading ($_prepareContext).
   *
   * @internal
   */
  protected _prepareContext(params?: any, ctx?: ToolFuncContext): ToolFuncContext {
    return (this.constructor as typeof ToolFunc)._prepareContext(this.ctx, ctx);
  }

  /**
   * Executes the function synchronously with a named parameters object.
   *
   * @public
   * @param params - The parameters object for the function.
   * @param ctx - The execution context.
   * @returns The result of the function execution.
   * @throws Will throw an error if an array of parameters is passed to a function that expects an object.
   */
  runSync(params?: any, ctx?: ToolFuncContext) {
    if (this._shouldIsolate(params, ctx)) {
      const runner = Object.create(this);
      runner.ctx = this._prepareContext(params, ctx);
      return runner.runSync(params);
    }

    const isPosParams = this.params && Array.isArray(this.params)
    if (Array.isArray(params)) {
      if (isPosParams) return this.func!(...params)
      throwError('the function is not support array params, the params must be object!', this.name)
    }
    if (isPosParams) {
      params = this.obj2ArrParams(params) as any[]
      console.warn('Warning:Use runWithPos() instead of run() for the "'+this.name+'" is function with position params')
      return this.func!(...params)
    }
    return this.func!(params)
  }

  /**
   * Executes the function asynchronously with a named parameters object.
   *
   * Note: This method returns a `Promise` if the underlying function is asynchronous,
   * otherwise it may return the result synchronously.
   *
   * @public
   *
   * @param params - The parameters object for the function.
   * @param ctx - The execution context.
   * @returns A promise or the direct result of the function's execution.
   */
  run(params?: any, ctx?: ToolFuncContext): Promise<any>|any {
    return this.runSync(params, ctx)
  }

  /**
   * Asynchronously executes another registered function by name.
   *
   * Note: This method returns a `Promise` if the underlying function is asynchronous,
   * otherwise it may return the result synchronously.
   *
   * @public
   *
   * @param name - The name of the target function to run.
   * @param params - Optional parameters to pass to the function.
   * @param ctx - The execution context.
   * @returns A promise or the direct result of the function's execution.
   */
  runAs(name:string, params?: any, ctx?: ToolFuncContext): Promise<any>|any {
    const { func, context } = this._resolveAs(name, params, ctx)
    // Goes through the target's *async* entry point on purpose: abilities layered on top of
    // ToolFunc (e.g. `makeToolFuncLifecycle`) gate their async readiness on `run()`, so this is
    // what makes a dependency's pending `setup` transparently awaited.
    return func.run(params, context)
  }

  /**
   * Executes another registered function by name, using hierarchical dependency resolution.
   *
   * This method supports **Late-Binding Polymorphism**. It uses the `rootRegistry` and
   * `binding` strategy from the execution context to resolve dependencies.
   *
   * ### Binding Modes:
   * - `'auto'` (Default): **Lineage-Aware**. Uses late-binding only if the `rootRegistry`
   *   is a descendant of the tool's definition registry and has shadowed the dependency.
   *   Otherwise, uses early-binding for stability.
   * - `'early'`: **Safety First**. Always prefers the pre-bound instance from `depends`.
   * - `'late'`: **Forced Polymorphism**. Always resolves from the `rootRegistry`,
   *   ignoring the definer's environment.
   *
   * @public
   *
   * @param name - The name or alias of the target function to run.
   * @param params - Optional parameters to pass to the target function.
   * @param ctx - The execution context.
   * @returns The result of the target function execution.
   * @throws `NotFoundError` If the target function cannot be found in the current lineage.
   */
  runAsSync(name:string, params?: any, ctx?: ToolFuncContext) {
    const { func, context } = this._resolveAs(name, params, ctx)
    return func.runSync(params, context)
  }

  /**
   * Resolves a dependency by name into the concrete instance and execution context to call.
   *
   * This is the shared resolution half of `runAs`/`runAsSync`: both need the same hierarchical
   * lookup and the same binding strategy, they only differ in which entry point of the resolved
   * tool they hand the call to (`run` vs `runSync`).
   *
   * @param name - The name or alias of the target function.
   * @param params - Optional parameters to pass to the target function.
   * @param ctx - The execution context.
   * @returns The resolved instance and context.
   * @throws `NotFoundError` If the target function cannot be found in the current lineage.
   * @internal
   */
  protected _resolveAs(name: string, params?: any, ctx?: ToolFuncContext): { func: ToolFunc, context: ToolFuncContext } {
    // 1. Prepare context. Ensure it inherits control flags from current instance context.
    let context = this._prepareContext(params, ctx);
    const rootRegistry = context.rootRegistry || this.ctx?.rootRegistry || (this.constructor as typeof ToolFunc);
    if (!context.rootRegistry) { context.rootRegistry = rootRegistry; }
    if (!context.binding && this.ctx?.binding) { context.binding = this.ctx.binding; }

    // 2. Determine Binding Strategy

    const binding = context.binding || 'auto';
    let func: ToolFunc | undefined;

    if (binding === 'late') {
      func = rootRegistry.get(name);
    } else if (binding === 'early') {
      func = this.depends?.[name] || rootRegistry.get(name);
    } else { // 'auto' (Default)
      // SMART ALGORITHM:
      // Check if the dependency found in rootRegistry's hierarchy is a "newer shadow"
      // than the one defined in our own definition scope.
      const definitionRegistry = this._registry;
      const owner = findRegistryOwner(rootRegistry, name);

      // If the owner of the tool in rootRegistry is a strict descendant of our
      // definition registry, it means the dependency has been shadowed in this chain.
      const isShadowed = !!(definitionRegistry && owner &&
                         (owner.prototype instanceof definitionRegistry));

      // DEBUG LOGS (Remove after fix)
      // console.log(`[TF DEBUG] RunAsSync '${name}' from ${this.name} (defined in ${definitionRegistry?.name}) called via ${rootRegistry.name}. Owner in root: ${owner?.name}. isShadowed: ${isShadowed}`);

      if (isShadowed) {
        // Safe to use polymorphism: we are in a customized sub-registry context.
        func = rootRegistry.get(name);
      } else {
        // Stability first: use the pre-bound instance or fall back to global registry.
        func = this.depends?.[name] || rootRegistry.get(name);
      }
    }
    if (func) {
      return { func, context }
    }
    throw new NotFoundError(`${name} to run`, rootRegistry.name);
  }

  /**
   * Gets a bound function reference for execution with named parameters.
   * If a name is provided, it retrieves a different function from the registry.
   * Otherwise, it returns a bound version of this instance's `runSync`.
   *
   * @public
   * @param name - Optional name of the function to retrieve.
   * @returns A function reference or `undefined` if not found.
   */
  getFunc(name?: string): Function | undefined {
    const result: Function | undefined = name ? (this.constructor as typeof ToolFunc).getFunc(name) : (params: any, ctx?: ToolFuncContext) => this.runSync(params, ctx)
    return result
  }

  /**
   * Executes the function synchronously using positional arguments.
   * If the function expects named parameters, it converts the arguments automatically.
   *
   * @public
   * @param params - Positional arguments passed to the function.
   * @returns The result of the function execution.
   */
  runWithPosSync(...params:any[]) {
    if (this._shouldIsolate(params)) {
      const runner = Object.create(this);
      runner.ctx = this._prepareContext(params);
      return runner.runWithPosSync(...params);
    }

    if (this.params && !Array.isArray(this.params)) {
      params = this.arr2ObjParams(params)
    }
    return this.func!(...params)
  }

  /**
   * Synchronously executes another function by name using positional arguments.
   * This is a convenience wrapper around the static `runWithPosSync()` method.
   *
   * @public
   * @param name - The name of the target function to run.
   * @param params - Positional arguments to pass to the function.
   * @returns The result of the function execution.
   */
  runWithPosAsSync(name: string, ...params: any[]) {
    const func = (this.constructor as typeof ToolFunc).get(name)
    if (func) {
      return func.runWithPosSync.call(func.with(this.ctx!), ...params)
    }
    throw new NotFoundError(`${name} to run`, (this.constructor as any).name);
  }

  /**
   * Executes the function asynchronously using positional arguments.
   *
   * Note: This method returns a `Promise` if the underlying function is asynchronous,
   * otherwise it may return the result synchronously.
   *
   * @public
   *
   * @param params - Positional arguments passed to the function.
   * @returns A promise or the direct result of the function's execution.
   */
  runWithPos(...params: any[]): Promise<any>|any {
    return this.runWithPosSync(...params)
  }

  /**
   * Asynchronously executes another function by name using positional arguments.
   *
   * Note: This method returns a `Promise` if the underlying function is asynchronous,
   * otherwise it may return the result synchronously.
   *
   * @public
   *
   * @param name - The name of the target function to run.
   * @param params - Positional arguments to pass to the function.
   * @returns A promise or the direct result of the function's execution.
   */
  runWithPosAs(name:string, ...params: any[]): Promise<any>|any {
    return this.runWithPosAsSync(name, ...params)
  }

  /**
   * Gets a bound function reference suitable for positional argument execution.
   * If a name is provided, it retrieves a different function from the registry.
   * Otherwise, it returns a bound version of this instance's `runWithPosSync`.
   *
   * @public
   * @param name - Optional name of the function to retrieve.
   * @returns A function reference or `undefined` if not found.
   */
  getFuncWithPos(name?: string) {
    const result = name ? (this.constructor as any).getFuncWithPos(name) : (...args: any[]) => this.runWithPosSync(...args)
    return result
  }

  /**
   * Checks if the current function instance supports a specific async feature.
   *
   * @public
   * @param feature - The async feature bit to check for.
   * @returns `true` if the feature is supported, otherwise `false`.
   */
  hasAsyncFeature(feature: AsyncFeatureBits) {
    let features = this.asyncFeatures ?? 0
    if (this._asyncFeatures) { features |= this._asyncFeatures }
    return IntSet.has(features, feature)
  }

  /**
   * Determines if a function call should produce a stream.
   *
   * The logic is as follows:
   * 1. It first checks if the function is generally capable of streaming (`this.stream`).
   * 2. If it is, it then checks if a `stream` parameter is formally declared in the function's `params` definition.
   * 3. If both are true, the method returns the value of the `stream` property from the runtime `params` object.
   * Otherwise, it returns the function's static `stream` capability.
   *
   * @public
   *
   * @param params - The runtime parameters passed to the function call.
   * @returns `true` if the call should be streamed, `false` or `undefined` otherwise.
   */
  isStream(params: any) {
    let result = this.stream
    if (result) {
      const paramsDecl = this.params as any
      if (paramsDecl?.stream) {result = params?.stream}
    }
    return result
  }

}

/**
 * Whether the tool declares a `scope` with at least one bindable key.
 *
 * An empty (or absent) scope binds nothing, so a function value is then left exactly as it is
 * instead of being needlessly recompiled from its source — which would drop its lexical closure.
 */
function hasScopeKeys(scope: any): boolean {
  return !!scope && typeof scope === 'object' && Object.keys(scope).length > 0
}

/**
 * Compiles a function's own source against the declared `scope`, so the scope's keys become closure
 * variables of the result (and a `this` key becomes its `this`). `_createFunction` can only bind a
 * scope while it compiles source text, hence the round-trip through `toString()`.
 *
 * Returns `undefined` when the source is not a compilable function expression — a method-shorthand
 * function (`foo() {}`), a class method, native code, or a scope whose keys are not valid parameter
 * names. The caller then keeps the original function: rejecting it would break the
 * closure-preserving default for perfectly usable tools, while keeping it leaves the tool runnable
 * with only the unbindable scope keys absent.
 */
function tryCompileFunc(fn: Function, dest: ToolFunc): Function|undefined {
  try {
    const compiled = _createFunction(fn.toString(), dest.scope)
    return typeof compiled === 'function' ? compiled : undefined
  } catch {
    // The source (or the scope's keys) cannot be compiled — see above.
    return undefined
  }
}

/**
 * Defines the schema for `ToolFunc` properties, used by `AdvancePropertyManager`.
 * This controls how properties are assigned and exported.
 * @internal
 */
export const ToolFuncSchema = {
  name: {type: 'string'},
  description: {type: 'string'},
  title: {type: 'string'},
  /**
   * Declared *before* `func` on purpose: `assign()` walks the schema in declaration order and the
   * `func` hook compiles a function-expression string against `dest.scope`, so the scope must
   * reach the instance first. Kept out of the exported data (`exported: false`) like `depends`:
   * it holds runtime references, not serializable metadata.
   */
  scope: {type: 'object', exported: false},
  func: {
    type: 'function',
    assign(value: Function|string, dest:ToolFunc, src?:ToolFunc, name?: string, options?: any) {
      let result = value;
      const valueType = typeof value;
      const isExported = options.isExported
      if (isExported) {
        result = valueType === 'function' ? value.toString() : value;
      } else if (valueType === 'string') {
        // A string func is always compiled (into the declared `scope`).
        try {
          result = _createFunction(value as string, dest.scope)
        } catch (e) {
          throwError(`failed to create the func of "${dest.name || 'unnamed'}" from the string: ${(e as Error).message}`)
        }
        if (typeof result !== 'function') {
          // Only function expressions are supported (e.g. '(a, b) => a + b').
          // Bare expressions like 'a + b' evaluate to a value instead.
          throwError(`the func string of "${dest.name || 'unnamed'}" must be a function expression (e.g. "(a, b) => a + b"), but it evaluates to ${typeof result}`)
        }
      } else if (valueType === 'function' && hasScopeKeys(dest.scope)) {
        // A function value is assigned directly — that preserves its closure and supports
        // method-shorthand / arrow / function-expression syntax as-is, instead of recompiling via
        // toString() (which breaks shorthand and discards the lexical closure). The one thing a
        // direct assignment cannot do is bind `scope`, because the scope keys are closure
        // variables that only exist while the source text is compiled. So a *declared, non-empty*
        // `scope` is honoured by compiling the function's source against it, as it always was; a
        // source that is not a compilable function expression (method shorthand, native code, a
        // class method...) is left as-is rather than rejected — its scope keys are simply not
        // bindable.
        const compiled = tryCompileFunc(value as unknown as Function, dest)
        if (compiled) { result = compiled }
      }
      return result;
    },
  },
  params: {type: 'object'},
  result: {type: 'any'},
  setup: {type: 'function'},
  depends: {type: 'object', exported: false},
  tags: {type: ['array', 'string']},
  isApi: {type: 'boolean'},
  stream: { type: 'boolean' },
  asyncFeatures: {
    type: 'number',
    // assign(value: IntSet|string|number, dest:ToolFunc, src?:ToolFunc, name?: string, options?: any) {
    //   let result = value;
    //   const valueType = typeof value;
    //   const isExported = options.isExported
    //   if (!isExported) {
    //     let initValue: number = 0
    //     if (value instanceof IntSet) {
    //       initValue = value.valueOf()
    //     } else {
    //       if (valueType === 'string') { initValue = parseInt(value as string) }
    //       else if (valueType === 'number') { initValue = value as number }
    //     }
    //     result = new IntSet(initValue)
    //   }
    //   return result;
    // },
  },
  alias: {type: ['array', 'string']},
}


ToolFunc.defineProperties(ToolFunc, ToolFuncSchema)

/**
 * A unique symbol used to attach metadata to a function object.
 * @internal
 */
export const FuncMetaSymbol = Symbol('meta')
