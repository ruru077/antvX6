import type { Node } from '@antv/x6'

/**
 * @rule key: lower camel case, value: array of blockType strings
 */
const GUARD_SCOPE_TYPES = {
  subsystem: ['Subsystem', 'EnabledSubsystem'],
}
/**
 * @description 节点守卫 HOF，针对特定 scope 进行节点类型过滤
 * @param scope 作用域，决定了哪些节点会被 handler 处理
 * @param handler 事件处理函数，仅在节点符合 scope 要求时才会被调用
 * @returns 只处理对应 scope 的注册函数
 */
function withNodeGuard<T extends { node: Node }>(
  scope: keyof typeof GUARD_SCOPE_TYPES,
  handler: (args: T) => void,
) {
  return (args: T) => {
    // 不是当前 scope 的节点，继续执行调用链
    const blockType = args.node.getData()?.blockType
    if (!GUARD_SCOPE_TYPES[scope].includes(blockType)) return
    handler(args)
  }
}
const GUARD_BLOCK_TYPES = Object.values(GUARD_SCOPE_TYPES).flat()

export { withNodeGuard, GUARD_BLOCK_TYPES }
