import { ToolFunc } from "../src/tool-func"

/**
 * 通过名称获取当前注册表中对应实现的引用计数
 */
export function getRefCount(name: string) {
  return (ToolFunc as any)._refCounts[name];
}
