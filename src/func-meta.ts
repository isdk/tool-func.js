import { assign, defaultsDeep } from 'lodash-es';
import { FuncMetaSymbol, ToolFunc } from './tool-func';

/**
 * A function that may carry `FuncMetaSymbol` metadata.
 *
 * Used as the parameter type of `funcWithMeta`/`funcGetMeta` to allow indexing
 * functions with `FuncMetaSymbol`. Structurally compatible with plain functions.
 */
export type FuncWithMeta = Function & { [FuncMetaSymbol]?: any }

/**
 * Attaches metadata to a function or `ToolFunc` object.
 *
 * This utility merges the provided metadata with any existing metadata on the target.
 *
 * @param {Function | ToolFunc} fn - The function or `ToolFunc` instance to which metadata will be added.
 * @param {any} meta - The metadata object to attach. The operation is skipped if this is not a non-null object.
 * @param {boolean} [ignoreExists=true] - If `true`, new metadata overwrites existing keys. If `false`, it merges deeply, preserving existing values.
 * @returns {Function | ToolFunc | undefined} The updated function or `ToolFunc` with metadata, or `undefined` if the operation was skipped.
 */
export function funcWithMeta(fn: FuncWithMeta | ToolFunc, meta: any, ignoreExists: boolean = true) {
  if (meta && typeof meta === 'object') {
    if (typeof fn === 'function') {
      meta = ignoreExists ? assign({}, fn[FuncMetaSymbol], meta) : defaultsDeep({}, fn[FuncMetaSymbol], meta)
      fn[FuncMetaSymbol] = meta
      return fn
    } else if (fn instanceof ToolFunc) {
      return fn.assign(meta)
    }
  }
}

/**
 * Retrieves metadata associated with a function or `ToolFunc` instance.
 *
 * @param {Function | ToolFunc} fn - The function or `ToolFunc` instance from which to retrieve metadata.
 * @returns {any} The metadata as a plain object, or `undefined` if no metadata is found.
 */
export function funcGetMeta(fn: FuncWithMeta | ToolFunc) {
  if (typeof fn === 'function') {
    return fn[FuncMetaSymbol]
  } else if (fn instanceof ToolFunc) {
    return fn.toObject()
  }
}
