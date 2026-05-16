/**
 * X6 Selection 插件的模块扩展声明
 * api.d.ts 已将 SelectionImplEventArgsRecord（cell:selected 等）合并进 EventArgs，
 * 但 box:mousedown / box:mousemove / box:mouseup 位于 SelectionImplBoxEventArgsRecord，
 * 未被 api.d.ts 扩展——此文件补充该部分，使 graph.on('box:mousemove', ...) 有完整类型。
 */
import type { SelectionImplBoxEventArgsRecord } from '@antv/x6/lib/plugin/selection/selection'

declare module '@antv/x6/lib/graph/events' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface EventArgs extends SelectionImplBoxEventArgsRecord {}
}
