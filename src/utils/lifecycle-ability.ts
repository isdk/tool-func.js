import { AbilityOptions, createAbilityInjector } from 'custom-ability'
import { defineProperty } from 'util-ex'
import { NotFoundError, throwError } from '@isdk/common-error'
import { ToolFunc } from '../tool-func'
import { createCallbacksTransformer } from './stream'

export interface LifecycleAbilityOptions extends AbilityOptions {
}

/**
 * The per-instance lifecycle bookkeeping.
 *
 * It is stored on the **root** instance (`inst._origin || inst`) so that shadow instances created
 * by `Object.create(this)` during isolated execution share — and never fork — the setup state.
 * It is deliberately *not* a declared property: `property-manager` only ever assigns/export the
 * keys present in the schema, so this bookkeeping can never leak into `toObject()`/`exportData()`.
 */
interface LifecycleState {
  /** `setup` has been invoked for the current registration lifetime. */
  done: boolean
  /** An async `setup` is currently in flight. */
  pending: boolean
  /** The (possibly already settled) promise of the last `setup` invocation. */
  setupPromise?: Promise<any>
  /** The error thrown by the last `setup` invocation, if any. */
  setupError?: any
  /** `dispose` has been invoked (guards against tearing the same lifetime down twice). */
  disposeStarted: boolean
  /** The (possibly already settled) promise of the last `dispose` invocation. */
  disposePromise?: Promise<any>
  /**
   * Settles once this instance's teardown is complete: its own `dispose` *and* the release of the
   * dependencies it held. Set the moment the instance is physically removed from a registry layer.
   */
  teardownPromise?: Promise<any>
  /** The error thrown by the last `dispose` invocation, if any. */
  disposeError?: any
  /** Option keys written by `setup`; re-applied through `assign()` once setup settles. */
  touched: Set<string>
  /** The normalized options object `initialize()` was given, i.e. what `setup` receives. */
  options?: any
}

function getState(inst: any): LifecycleState {
  let state: LifecycleState = inst.__lifecycle
  if (!state) {
    state = inst.__lifecycle = {
      done: false,
      pending: false,
      disposeStarted: false,
      touched: new Set<string>(),
    }
    defineProperty(inst, '__lifecycle', state, {
      enumerable: false,
      writable: true,
      configurable: true,
    })
  }
  return state
}

function isThenable(value: any): value is PromiseLike<any> {
  return !!value && (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as any).then === 'function'
}

function isReadableStream(value: any) {
  return typeof ReadableStream !== 'undefined' && value instanceof ReadableStream
}

/** True when the tool declares the per-call `cleanup` hook (see `runWithCleanup`). */
function hasCleanupHook(inst: any) {
  return typeof inst.cleanup === 'function'
}

/**
 * Whether *this* layer is the one that will execute the body, and therefore owns the call scope.
 *
 * A tool declaring `cleanup` always runs on a shadow instance — that is exactly what its own
 * `$_shouldIsolate` forces — so a layer carrying its own `ctx` is always the executor: the check is a
 * property lookup rather than a dispatched `_shouldIsolate` call, which matters because the shadow
 * recursion enters the entry point twice per call. The `_shouldIsolate` fallback keeps an ability
 * that could still veto isolation (there is none today) from silently losing the scope.
 */
function ownsCallScope(inst: any, params: any, ctx: any): boolean {
  if (Object.prototype.hasOwnProperty.call(inst, 'ctx')) return true
  return !inst._shouldIsolate(params, ctx)
}

/**
 * Keeps capability metadata (`TaskPromise.task`, ...) on the promise handed back to the caller.
 *
 * Wrapping a result in a promise of our own would otherwise silently strip those properties, so a
 * `cleanup` tool that also uses the cancelable ability would stop exposing `task` on `run()`.
 */
function inheritPromiseProps(source: any, target: any) {
  for (const key of Object.keys(source)) {
    if (key === 'then' || key === 'catch' || key === 'finally') continue
    try { target[key] = source[key] } catch {}
  }
  return target
}

function logAsyncCleanupError(inst: any, err: any) {
  console.error(`[ToolFunc] async cleanup of "${inst.name}" failed:`, err)
}

/** Shared result for the (common) call that carries no signal at all, so nothing is allocated. */
const NO_SIGNALS: AbortSignal[] = []

/**
 * The abort signals that must end a call's scope when they fire.
 *
 * `ctx` is what the entry point was given, while `inst.ctx` is the isolated runner's own context:
 * the core passes the *params* — not the context — down to the shadow instance, so the executor
 * layer can only find the signal there. The no-context case returns a shared empty result: most calls
 * are not cancellable, and this runs on every `cleanup` call.
 */
function collectAbortSignals(inst: any, ctx: any): AbortSignal[] {
  const own = inst.ctx
  if (!ctx && !own) return NO_SIGNALS
  let result: AbortSignal[] | undefined
  const add = (value: any) => {
    if (value && typeof value.addEventListener === 'function' && !value.aborted) {
      if (!result) result = []
      result.push(value)
    }
  }
  if (ctx) {
    add(ctx.signal)
    add(ctx.aborter && ctx.aborter.signal)
  }
  if (own && own !== ctx) {
    add(own.signal)
    add(own.aborter && own.aborter.signal)
  }
  return result || NO_SIGNALS
}

function cleanupAggregateError(inst: any, callError: any, cleanupError: any) {
  return new AggregateError(
    [callError, cleanupError],
    `[ToolFunc] call of "${inst.name}" failed and its cleanup failed too`,
  )
}

/**
 * Runs a single call and then the tool's `cleanup` hook, on every terminal path.
 *
 * `setup`/`dispose` are *registration* scoped; `cleanup` is *call* scoped. It is the exact inverse
 * of whatever one call acquired, and it runs:
 *
 * - after a synchronous result or a synchronous throw,
 * - after an async body's promise settles (resolve and reject alike),
 * - once a returned `ReadableStream` is finished, failed or cancelled — the value is produced
 *   before it is consumed, so `finally` cannot express this,
 * - when the call's signal aborts (`ctx.signal` / `ctx.aborter.signal`), because a cancelled call
 *   never unwinds its own stack and a `finally` would never run.
 *
 * It runs at most once per call, with `this` bound to the instance that actually executed the body
 * (the isolated runner), so the resources parked on `this` are exactly the ones released. A body
 * that threw before acquiring anything has nothing to release: write `cleanup` defensively (e.g.
 * `this.conn?.close()`) since it is invoked for every terminal path, not only successful ones.
 *
 * The sync/async contract mirrors `unregister()`: a synchronous entry point can only *initiate* a
 * release. When `cleanup` returns a promise there is nothing to await on those paths, so its
 * rejection is logged rather than thrown; the async entry points already return a promise and chain
 * the release behind it, so awaiting the call awaits the cleanup.
 */
function runWithCleanup(inst: any, ctx: any, invoke: () => any) {
  const cleanup = inst.cleanup
  let settled = false
  let signals: AbortSignal[] = []
  let onAbort: (() => void) | undefined

  const detachAbort = () => {
    if (onAbort) {
      for (const signal of signals) {
        try { signal.removeEventListener('abort', onAbort) } catch {}
      }
    }
    onAbort = undefined
    signals = []
  }

  // Every terminal path below funnels through here, which is what makes it exactly-once.
  const drain = () => {
    if (settled) return
    settled = true
    detachAbort()
    return cleanup.call(inst)
  }

  signals = collectAbortSignals(inst, ctx)
  if (signals.length) {
    onAbort = () => {
      try {
        const released = drain()
        if (isThenable(released)) Promise.resolve(released).catch((err: any) => logAsyncCleanupError(inst, err))
      } catch (err) {
        logAsyncCleanupError(inst, err)
      }
    }
    for (const signal of signals) {
      try { signal.addEventListener('abort', onAbort, { once: true }) } catch {}
    }
  }

  let result: any
  try {
    result = invoke()
  } catch (callError) {
    let released: any
    try {
      released = drain()
    } catch (cleanupError) {
      throw cleanupAggregateError(inst, callError, cleanupError)
    }
    if (isThenable(released)) Promise.resolve(released).catch((err: any) => logAsyncCleanupError(inst, err))
    throw callError
  }

  if (isThenable(result)) {
    const settledResult = Promise.resolve(result).then(
      (value: any) => {
        const released = drain()
        return isThenable(released) ? released.then(() => value) : value
      },
      (callError: any) => {
        let released: any
        try {
          released = drain()
        } catch (cleanupError) {
          throw cleanupAggregateError(inst, callError, cleanupError)
        }
        if (!isThenable(released)) throw callError
        return Promise.resolve(released).then(
          () => { throw callError },
          (cleanupError: any) => { throw cleanupAggregateError(inst, callError, cleanupError) },
        )
      },
    )
    return inheritPromiseProps(result, settledResult)
  }

  if (isReadableStream(result)) {
    // The value is produced before it is consumed, so only the stream's close can end the scope.
    return result.pipeThrough(createCallbacksTransformer({ onClose: () => drain() }))
  }

  // Synchronous terminal. The release may still be asynchronous, and a synchronous entry point can
  // only start it — the same rule `unregister()` follows for `dispose`.
  const released = drain()
  if (isThenable(released)) Promise.resolve(released).catch((err: any) => logAsyncCleanupError(inst, err))
  return result
}

/**
 * Wraps the normalized options in a Proxy that records which keys `setup` writes.
 *
 * We deliberately do **not** snapshot the original values: `initialize()` is an overridable
 * "options -> this" pipeline, so a subclass `assign` hook may legitimately rewrite what a value
 * became on the instance. Comparing values would therefore produce false positives. Recording the
 * *written keys* instead lets us replay exactly the keys the hook touched, through the very same
 * pipeline that built the instance.
 */
function trackOptions(options: any) {
  if (!options || typeof options !== 'object') return undefined
  const touched = new Set<string>()
  const proxy = new Proxy(options, {
    set(target: any, prop: string|symbol, value: any) {
      if (typeof prop === 'string') touched.add(prop)
      target[prop] = value
      return true
    },
    deleteProperty(target: any, prop: string|symbol) {
      if (typeof prop === 'string') touched.delete(prop)
      delete target[prop]
      return true
    },
  })
  return { proxy, touched }
}

/**
 * Re-applies the option keys `setup` wrote back onto the instance.
 *
 * `assign({exclude})` walks the schema in declaration order and runs each key through
 * `validatePropertyValue` -> the attr's `assign` hook -> type coercion, so replayed values are
 * treated exactly like the ones that came from the constructor. Keys `setup` did **not** touch are
 * excluded, which is what makes "setup sets `this.x` directly" win over "options carries `x`".
 */
function applyTouchedOptions(inst: any, state: LifecycleState) {
  const options = state.options
  if (!options || !state.touched.size) return
  const exclude: string[] = []
  for (const key of Object.keys(options)) {
    if (!state.touched.has(key)) exclude.push(key)
  }
  state.touched.clear()
  inst.assign(options, { exclude })
}

/**
 * The compile-time inputs of the tool's function, as seen right before `setup` runs.
 *
 * `scope` is what a function-expression string is compiled against, so a `setup` that changes it
 * invalidates the compiled `func` (see `rebuildFuncForScope`).
 */
interface CompileInputs {
  scope: any
  func: any
}

/**
 * Rebuilds the tool's `func` after `setup` changed the tool's `scope`.
 *
 * `scope` is a compile-time input: `_createFunction` captures the scope's values while it compiles
 * the func — whether it was given as a function-expression string or as a function value — so a
 * scope that arrives with `setup` would otherwise never be visible to the func. Before the
 * lifecycle ability, `setup` ran in the constructor before `initialize()` compiled the func — this
 * restores that ordering for every entry point (registration, lazy setup on first run, and the
 * async setup path alike). Replaying the declared func through `assign()` is what recompiles it
 * against the new scope.
 *
 * A `func` that `setup` replaced directly (`this.func = fn`) is left alone — the same "direct
 * writes win" rule the touched-options replay follows — as is one the replay has just compiled
 * from a string, because `assign()` already compiled it against the new scope.
 */
function rebuildFuncForScope(inst: any, state: LifecycleState, before: CompileInputs) {
  const scopeChanged = inst.scope !== before.scope
  // Only the func that came from the options is rebuilt; a direct write or a replay-compiled one
  // already reflects the new scope.
  const funcFromOptions = inst.func === before.func
  if (!scopeChanged || !funcFromOptions) return
  const src = state.options && state.options.func
  if (typeof src !== 'string' && typeof src !== 'function') return
  inst.assign({ func: src })
}

/**
 * Invokes `setup` at most once per registration lifetime.
 *
 * @returns A promise resolving to the instance. Rejects with whatever `setup` threw.
 */
function runSetup(inst: any): Promise<any> {
  const state = getState(inst)
  if (state.done) {
    return state.setupPromise || Promise.resolve(inst)
  }
  const setup = inst.setup
  // A new registration lifetime starts here, so the teardown side is re-armed as well: `dispose`
  // is the exact inverse of `setup`, and the next `unregister()` must release what this one
  // acquires. (`disposeStarted` only guards against tearing the *same* lifetime down twice.)
  state.disposeStarted = false
  state.disposePromise = undefined
  state.disposeError = undefined
  state.teardownPromise = undefined
  // Mark first: a re-entrant `register()` from within `setup` must not recurse.
  state.done = true
  if (typeof setup !== 'function') {
    return Promise.resolve(inst)
  }

  // The func is compiled against the scope, so remember what it was compiled with: `setup` may
  // provide or replace the scope, and the compiled func then has to be rebuilt (see below).
  const before: CompileInputs = { scope: inst.scope, func: inst.func }

  const tracker = trackOptions(state.options)
  // The proxy records written keys into its *own* `touched` Set; alias it onto `state`
  // so `applyTouchedOptions` can replay exactly the keys `setup` actually touched.
  if (tracker) { state.touched = tracker.touched }
  let result: any
  try {
    result = setup.call(inst, tracker ? tracker.proxy : state.options)
  } catch (e) {
    // Setup never completed, so leave the instance re-armed for the next attempt.
    state.done = false
    state.touched.clear()
    throw e
  }

  if (isThenable(result)) {
    state.pending = true
    const promise = Promise.resolve(result).then(
      () => {
        state.pending = false
        applyTouchedOptions(inst, state)
        rebuildFuncForScope(inst, state, before)
        return inst
      },
      (err: any) => {
        state.pending = false
        state.setupError = err
        throw err
      }
    )
    // Registration is fire-and-forget, so nobody is guaranteed to await this. The extra handler
    // keeps a failed async setup from surfacing as an unhandledRejection; the rejection is still
    // observable through `ready` / `run()` / `ensureSetup()`.
    promise.catch(() => {})
    state.setupPromise = promise
    return promise
  }

  applyTouchedOptions(inst, state)
  rebuildFuncForScope(inst, state, before)
  return Promise.resolve(inst)
}

/**
 * Invokes `dispose` at most once per registration lifetime.
 *
 * `dispose` is the exact inverse of `setup`, so it only re-arms the hook when it actually ran.
 * A tool without a `dispose` hook therefore keeps its setup state across an unregister/register
 * cycle, while a tool with one starts every new registration from scratch.
 */
function runDispose(inst: any) {
  const state = getState(inst)
  if (state.disposeStarted) return
  state.disposeStarted = true

  const dispose = inst.dispose
  const setup = inst.setup
  // Nothing was acquired (no dispose hook, or setup never completed) -> nothing to release.
  if (typeof dispose !== 'function') return
  if (typeof setup === 'function' && !state.done) return

  // Re-arm: the next registration must rebuild whatever this teardown just released.
  state.done = false
  state.pending = false
  state.setupPromise = undefined
  state.setupError = undefined
  state.touched.clear()

  let result: any
  try {
    result = dispose.call(inst)
  } catch (e) {
    state.disposeError = e
    throw e
  }

  if (isThenable(result)) {
    const promise = Promise.resolve(result).then(
      () => inst,
      (err: any) => {
        state.disposeError = err
        throw err
      }
    )
    // `unregister()` is synchronous and cannot await; log-free handling here keeps the rejection
    // reachable through `unregisterAsync()` without producing an unhandledRejection warning.
    promise.catch(() => {})
    state.disposePromise = promise
  }
}

/**
 * The execution gate applied before any synchronous call reaches `func`.
 *
 * - A tool with a `dispose` hook is strictly paired: executing it before `register()` is a bug,
 *   because its state was never acquired and `dispose` would have nothing to undo. We say so.
 * - A tool without a `dispose` hook keeps the historical "just works" behaviour and is set up
 *   lazily on first use.
 * - Either way, an *async* setup cannot be waited for synchronously, so we refuse and point at
 *   the async entry points rather than running against a half-initialized instance.
 */
function assertRunnable(inst: any) {
  const state = getState(inst)
  if (typeof inst.setup === 'function' && !state.done) {
    if (inst.dispose) {
      throwError(`tool "${inst.name}" has not been set up yet: call register() (or ensureSetup()) before executing it`, inst.name)
    }
    runSetup(inst)
  }
  if (state.pending) {
    throwError(`async setup of "${inst.name}" is still pending: use run() or await tool.ready before executing it`, inst.name)
  }
}

/** Awaits `setup` of a tool and, recursively, of every tool it depends on. */
async function waitReadyTree(inst: any, visited = new Set<any>()) {
  const host = inst._origin || inst
  if (visited.has(host)) return
  visited.add(host)
  await runSetup(host)
  const depends = host.depends
  if (depends) {
    await Promise.all(
      Object.values(depends)
        .filter((dep: any) => dep instanceof ToolFunc)
        .map((dep: any) => waitReadyTree(dep, visited)),
    )
  }
}

/** Resolves a registered tool by walking this registry layer and its prototype chain. */
function collectRegistryInstances(Tools: any) {
  const seen = new Set<any>()
  const result: any[] = []
  let layer: any = Tools
  while (layer && layer.items) {
    for (const key of Object.keys(layer.items)) {
      const inst = layer.items[key]
      if (inst instanceof ToolFunc && !seen.has(inst)) {
        seen.add(inst)
        result.push(inst)
      }
    }
    const parent = Object.getPrototypeOf(layer)
    if (!parent || parent === Function.prototype || parent === Object.prototype) break
    layer = parent
  }
  return result
}

export declare interface LifecycleAbility {
  /**
   * Runs `setup` (if it has not run yet) and resolves once it has completed.
   * Use this to use a tool without registering it.
   */
  ensureSetup(): Promise<ToolFunc>
  /**
   * Runs `dispose` (if it has not run yet) and resolves once it has completed, rethrowing any
   * error the hook produced.
   */
  ensureDispose(): Promise<ToolFunc>
  /** Whether `setup` has been invoked for the current registration lifetime. */
  isSetupDone(): boolean
  /** Whether an async `setup` is currently in flight. */
  isSetupPending(): boolean
  /** Registers this tool and resolves once it (and its dependency tree) is ready. */
  registerAsync(): Promise<ToolFunc|boolean>
  /** Unregisters this tool and resolves once its `dispose` has settled. */
  unregisterAsync(options?: any): Promise<ToolFunc|undefined>
  [name: string]: any
}

/**
 * Turns `setup`/`dispose` into a real, symmetric lifecycle driven by the registry:
 *
 * - `register()` runs `setup` (idempotently, once per registration lifetime)
 * - `unregister()` runs `dispose` when the tool is physically removed (reference count hit zero);
 *   the tool goes before the dependencies it declares, and those are released last-declared first
 * - `clear()` / `clearAsync()` release everything the layer owns through that same lifecycle
 * - `dispose` re-arms `setup`, so an unregister/register cycle rebuilds whatever was released
 * - `cleanup` extends that symmetry to the *call*: the per-call scope of every entry point, closed
 *   once per call on success, throw, abort, and after a returned stream ends
 * - an async `setup` makes the instance *pending*: `run()` awaits it, `runSync()` refuses it
 *
 * Inject it once, on the registry class you actually use:
 *
 * @example
 * import { ToolFunc, makeToolFuncLifecycle } from '@isdk/tool-func'
 *
 * const Tools = makeToolFuncLifecycle(ToolFunc)
 *
 * new Tools({
 *   name: 'db',
 *   async setup() { this.conn = await connect() },
 *   dispose() { this.conn.close() },
 *   func() { return this.conn.query('select 1') },
 * }).register()
 *
 * await Tools.run('db') // setup has already completed by the time func runs
 */
export class LifecycleAbility {
  /**
   * AOP overloading for the static `ToolFunc.initialize`.
   *
   * This is where we capture the normalized options object: it is the exact object that was
   * turned into this instance, so `setup` receives the very same `options` it always did, and we
   * can replay whatever `setup` writes back into it.
   */
  $initialize(src?: any) {
    const inst = (this as any).self || this
    const Super = (this as any).super
    const result = Super ? Super.call(inst, src) : (inst as any).initialize(src)
    if (src && typeof src === 'object') {
      getState(inst).options = src
    }
    return result
  }

  /**
   * AOP overloading for the static `ToolFunc.register`: runs `setup` on the freshly registered
   * tool. Dependencies are registered through this same static, so their `setup` runs too.
   */
  static $register(name?: any, options?: any, config?: any) {
    const Tools = (this as any).self || this
    const result = (this as any).super.call(Tools, name, options, config)
    if (result instanceof ToolFunc) {
      try {
        runSetup(result)
      } catch (e) {
        // A failed setup must not leave a half-registered tool behind.
        Tools.unregister(result.name, { force: true, scope: 'local' })
        throw e
      }
    }
    return result
  }

  /**
   * AOP overloading for `ToolFunc.runSync`: applies the readiness gate and, for a tool that declares
   * `cleanup`, the per-call scope.
   *
   * Only the layer that actually executes the body opens the scope. When this layer is about to be
   * shadowed (`_shouldIsolate`), the core recurses into a shadow runner whose own `$runSync` call
   * owns the cleanup — which is what keeps the four entry points (and the shadowing recursion) from
   * opening four nested scopes for one call.
   */
  $runSync(params?: any, ctx?: any) {
    const inst = (this as any).self || this
    assertRunnable(inst)
    if (!hasCleanupHook(inst) || !ownsCallScope(inst, params, ctx)) {
      return (this as any).super.call(inst, params, ctx)
    }
    return runWithCleanup(inst, ctx, () => (this as any).super.call(inst, params, ctx))
  }

  /** AOP overloading for `ToolFunc.runWithPosSync`: the positional twin of `$runSync`. */
  $runWithPosSync(...params: any[]) {
    const inst = (this as any).self || this
    assertRunnable(inst)
    if (!hasCleanupHook(inst) || !ownsCallScope(inst, params, undefined)) {
      return (this as any).super.apply(inst, params)
    }
    return runWithCleanup(inst, undefined, () => (this as any).super.apply(inst, params))
  }

  /**
   * AOP overloading for `ToolFunc._shouldIsolate`.
   *
   * A tool that declares `cleanup` parks per-call resources on `this` for the body to use and the
   * hook to release, so isolation is not optional for it: without a shadow instance, concurrent
   * calls would collide on the very fields that call's cleanup is about to release. This mirrors how
   * the cancelable ability isolates a cancelable tool, and it is why no opt-in flag is needed.
   */
  $_shouldIsolate(params?: any, ctx?: any): boolean {
    const Super = (this as any).super
    const that = (this as any).self || this
    if (Super && Super.call(that, params, ctx)) return true
    if (Object.prototype.hasOwnProperty.call(that, 'ctx')) return false
    return hasCleanupHook(that)
  }

  /**
   * AOP overloading for `ToolFunc.run`: awaits a pending async `setup` first.
   *
   * When nothing is pending this is a plain pass-through, so synchronous tools keep their exact
   * current semantics (including returning a non-promise result).
   */
  $run(params?: any, ctx?: any) {
    const inst = (this as any).self || this
    const lc = getState(inst)
    if (lc.pending && lc.setupPromise) {
      return lc.setupPromise.then(() => inst.run(params, ctx))
    }
    return (this as any).super.call(inst, params, ctx)
  }

  /**
   * AOP overloading for `ToolFunc.runWithPos`: the positional-arguments twin of `$run`.
   *
   * `runWithPos` is an async entry point just like `run`, so it must share the same
   * readiness contract: a pending async `setup` is awaited, never refused. Without this
   * override the call would fall straight into `runWithPosSync`'s gate and throw while
   * pending — leaving a positional tool with async setup permanently unrunnable.
   */
  $runWithPos(...params: any[]) {
    const inst = (this as any).self || this
    const lc = getState(inst)
    if (lc.pending && lc.setupPromise) {
      return lc.setupPromise.then(() => inst.runWithPos(...params))
    }
    return (this as any).super.apply(inst, params)
  }

  /** Runs `setup` if needed and resolves once it has settled. */
  ensureSetup(): Promise<ToolFunc> {
    const inst = (this as any).self || this
    return runSetup(inst._origin || inst)
  }

  /** Runs `dispose` if needed and resolves once it has settled, rethrowing hook errors. */
  async ensureDispose(): Promise<ToolFunc> {
    const inst = (this as any).self || this
    const host = inst._origin || inst
    const lc = getState(host)
    if (!lc.disposeStarted) {
      runDispose(host)
    }
    if (lc.disposePromise) {
      await lc.disposePromise
    }
    if (lc.disposeError) throw lc.disposeError
    return host
  }

  /** Resolves once `setup` has settled; rejects when `setup` rejected. */
  get ready(): Promise<ToolFunc> {
    const inst = (this as any).self || this
    const host = inst._origin || inst
    const lc = getState(host)
    return lc.setupPromise || Promise.resolve(host)
  }

  /** Resolves once `dispose` has settled. */
  get disposed(): Promise<ToolFunc> {
    const inst = (this as any).self || this
    const host = inst._origin || inst
    const lc = getState(host)
    return lc.disposePromise || Promise.resolve(host)
  }

  isSetupDone() {
    const inst = (this as any).self || this
    return getState(inst._origin || inst).done
  }

  isSetupPending() {
    const inst = (this as any).self || this
    return getState(inst._origin || inst).pending
  }

  /** Registers this tool and resolves once it and its dependency tree are ready. */
  registerAsync(): Promise<ToolFunc|boolean> {
    const inst = (this as any).self || this
    const Tools = inst.constructor as any
    return Tools.registerAsync(inst)
  }

  /** Unregisters this tool and resolves once its `dispose` has settled. */
  unregisterAsync(options?: any): Promise<ToolFunc|undefined> {
    const inst = (this as any).self || this
    const Tools = inst.constructor as any
    return Tools.unregisterAsync(inst, options)
  }

  /**
   * The synchronous `ToolFunc.register`, awaited: registers the tool and resolves once it and its
   * whole dependency tree are ready.
   */
  static async registerAsync(name?: any, options?: any, config?: any): Promise<ToolFunc|boolean> {
    const Tools = this as any
    const result = Tools.register(name, options, config)
    if (result instanceof ToolFunc) {
      await waitReadyTree(result)
    }
    return result
  }

  /**
   * The synchronous `ToolFunc.unregister`, awaited: removes the tool and resolves once its whole
   * teardown has settled — its own `dispose` *and* the release of the dependencies it held,
   * which is serialized behind it. Rethrows whatever the `dispose` hook threw.
   *
   * Awaiting the teardown chain (rather than just the target's `dispose`) matters because the
   * teardown of a dependency is chained after its dependent's: resolving earlier would let a
   * caller observe a half-torn-down dependency tree.
   */
  static async unregisterAsync(target?: any, options?: any): Promise<ToolFunc|undefined> {
    const Tools = this as any
    const inst = Tools.unregister(target, options)
    if (!inst) return inst
    const lc = state(inst)
    if (lc.teardownPromise) await lc.teardownPromise.catch(() => {})
    if (lc.disposeError) throw lc.disposeError
    return inst
  }

  /**
   * The asynchronous `ToolFunc.clear`, awaited: releases everything this layer owns in reverse
   * dependency order, waiting for each teardown to settle before the next one starts.
   *
   * The synchronous `clear()` cannot do that. It releases in the same order, but it has no way to
   * learn that a `dispose` is still in flight — that bookkeeping lives here, in the lifecycle — so
   * with an asynchronous teardown a dependency is dropped as soon as its holder leaves the
   * registry, overlapping its holder's `dispose` instead of following it.
   *
   * Every owned tool is released even when some of them fail: the failures are collected and
   * reported in a single `AggregateError`, once the layer is fully released and never as a
   * half-released layer. Failures of tools released as dependencies are reported too, not only
   * those of the tools released as roots.
   */
  static async clearAsync(): Promise<void> {
    const Tools = this as any
    const targets: any[] = Object.keys(Tools.items || {}).map((name: string) => Tools.items[name])
    const errors: any[] = []

    let remaining: string[] = Object.keys(Tools.items || {})
    while (remaining.length) {
      const releasable = remaining.filter((name) => !Tools._isStillHeld(name))
      // A dependency cycle leaves nothing releasable; break it by releasing the rest in order.
      const batch = releasable.length ? releasable : remaining
      for (const name of batch) {
        try {
          await Tools.unregisterAsync(name, { force: true, scope: 'local' })
        } catch (e) {
          errors.push(e)
        }
      }
      remaining = releasable.length ? remaining.filter((name) => !batch.includes(name)) : []
    }

    // A dependency's failure is recorded on its own instance, so sweep the released tools as well:
    // `clearAsync` reports the layer, not merely what it happened to release as a root.
    for (const inst of targets) {
      const error = state(inst).disposeError
      if (error && !errors.includes(error)) errors.push(error)
    }

    if (errors.length) {
      throw new AggregateError(
        errors,
        `[ToolFunc] clearAsync released the layer with ${errors.length} failing teardown(s)`,
      )
    }
  }

  /**
   * Creates a tool without registering it and resolves once its `setup` has completed.
   *
   * @example
   * const tool = await Tools.createAsync({ name: 'temp', setup: () => { this.conn = connect() } })
   * await tool.run()
   * await tool.ensureDispose()
   */
  static async createAsync(name?: any, options?: any, config?: any): Promise<ToolFunc> {
    const Tools = this as any
    const inst: ToolFunc = new Tools(name, options, config)
    await runSetup(inst)
    return inst
  }

  /** Waits until a registered tool's `setup` has completed. */
  static async awaitReady(name: string): Promise<ToolFunc> {
    const Tools = this as any
    const func = Tools.get(name)
    if (!func) {
      throw new NotFoundError(`${name} to await ready`, Tools.name)
    }
    await runSetup(func)
    return func
  }

  /**
   * Waits until every tool registered in this registry (including inherited layers) is ready.
   * Useful as a startup warm-up before serving traffic.
   */
  static async whenAllReady(): Promise<void> {
    const Tools = this as any
    await Promise.all(collectRegistryInstances(Tools).map((inst: any) => runSetup(inst)))
  }
}

function state(inst: any) {
  return getState(inst._origin || inst)
}

/**
 * Releases the dependencies of `inst`, last declared first, and returns a promise settling once
 * every one of them has been torn down.
 *
 * The loop runs synchronously until it meets an *asynchronous* teardown; from that point on the
 * remaining dependencies are chained behind it. That keeps the reverse order a property of the
 * actual teardown — not merely of its invocation — while leaving the purely synchronous case
 * synchronous, so `unregister()` stays as cheap as it always was.
 */
function releaseDependencies(Tools: any, inst: any): Promise<any> | undefined {
  let pending: Promise<any> | undefined
  for (const dep of (Tools as any)._dependencyReleaseOrder(inst)) {
    pending = pending
      ? pending.catch(() => {}).then(() => releaseDependency(Tools, dep))
      : releaseDependency(Tools, dep)
  }
  return pending
}

/** Unregisters one dependency, returning its teardown promise when that teardown is asynchronous. */
function releaseDependency(Tools: any, dep: any): Promise<any> | undefined {
  const removed = Tools.unregister(dep.name)
  return removed ? state(removed).teardownPromise : undefined
}

/**
 * The registry's `_releaseInstance`, extended with the lifecycle: the instance's own `dispose`
 * runs first — while its dependencies are still alive — and only then are those dependencies
 * released, last declared first, each one waited for before the next one starts.
 *
 * It is installed over `ToolFunc._releaseInstance` so that it runs in the registry layer that
 * actually removed the instance, whether the removal came from `unregister()` or from `clear()`.
 */
function releaseInstance(this: any, inst: any) {
  const Tools = this
  const lc = state(inst)
  try {
    // Only tear down when no layer of this chain resolves to the instance anymore: a shadow copy
    // in a child layer, or an ancestor still holding it, keeps it alive.
    if (inst && inst.name && Tools.get(inst.name) !== inst) {
      runDispose(inst)
    }
  } catch (e) {
    // Teardown is best-effort: a failing dispose must not abort the rest of the cleanup
    // (notably releasing the tool's dependencies). Surface it and carry on.
    lc.disposeError = e
    console.error(`[ToolFunc] dispose of "${inst.name}" failed:`, e)
  }

  // Dependencies are released only once the owner's teardown has settled, so the release order is
  // the order in which the resources actually become unused.
  lc.teardownPromise = lc.disposePromise
    ? lc.disposePromise.catch(() => {}).then(() => releaseDependencies(Tools, inst))
    : releaseDependencies(Tools, inst)
}


function onInjectionSuccess(Tool: typeof ToolFunc) {
  // `setup` is already part of the core schema (it has always been user-facing config); `dispose`
  // (registration scoped) and `cleanup` (call scoped) are the other halves of the pair and only
  // exist once the ability is installed.
  if (Tool.defineProperties) Tool.defineProperties(Tool, {
    dispose: { type: 'function' },
    cleanup: { type: 'function' },
  })
  // Holder-first, LIFO teardown (see `releaseInstance`).
  ;(Tool as any)._releaseInstance = releaseInstance
}

export const makeToolFuncLifecycle = createAbilityInjector(LifecycleAbility, { afterInjection: onInjectionSuccess as any })
