// the binary bit position
export const ToolAsyncMultiTaskBit = 0
export const ToolAsyncCancelableBit = 1
export const ToolAsyncPriorityBit = 2

export enum AsyncFeatureBits {
  MultiTask = ToolAsyncMultiTaskBit,
  Cancelable = ToolAsyncCancelableBit,
  Priority = ToolAsyncPriorityBit,
}

// bit fields
export enum AsyncFeatures {
  MultiTask = 1 << ToolAsyncMultiTaskBit, // B0001
  Cancelable = 1 << ToolAsyncCancelableBit, // B010
  Priority = 1 << ToolAsyncPriorityBit, // B0100
}
