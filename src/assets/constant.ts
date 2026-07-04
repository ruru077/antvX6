/**
 * @description 常量
 */
/**
 * @instruction 当为 10 的倍数时 曼哈顿路由更为稳定
 */
const GRAPH_GRID = 20
// EDGE 红
const RED = '#e60000'
// EDGE 黑
const BLACK = '#000000'
const TARGETMARKER_SIZE = 15
// EDGE 线宽
const EDGE_STROKE_WIDTH = 1
// EDGE 交点GAP
const GAP_SIZE = 2
// 吸附触发Threshold
const SNAP_RADIUS = 20
// 粘贴时节点偏移量
const PASTE_OFFSET = 32
// STENCIL节点行内间距
const STENCIL_NODE_ROW_GAP = 60
// STENCIL分组底部间距
const STENCIL_GROUP_PADDING = 40
// STENCIL左右内边距
const STENCIL_SIDE_PADDING = 10
// STENCIL最小重排宽度
const MIN_RESIZABLE_WIDTH = 10
// STENCIL节点垂直间距
const STENCIL_NODE_COLUMN_GAP = 45
// 键盘事件节流时间
const KEY_THROTTLE_TIME = 800
// target connectionPoint 相对 anchor 的偏移量（负值 = 线段终点提前于 port）
const EDGE_TARGET_CP_OFFSET = -5
// EDGE Wrapper 的宽度
const EDGE_WRAPPER_WIDTH = 20
// sourceArrowhead StrokeWdith
const SOURCE_ARROWHEAD_STROKE_WIDTH = 3
// targetArrowhead StrokeWidth
const TARGET_ARROWHEAD_STROKE_WIDTH = 10
// 联系人邮箱
const CONTACT_ME_EMAIL = 'yesw@sustech.edu.cn'
export {
  GRAPH_GRID,
  RED,
  BLACK,
  TARGETMARKER_SIZE,
  GAP_SIZE,
  SNAP_RADIUS,
  EDGE_STROKE_WIDTH,
  PASTE_OFFSET,
  STENCIL_NODE_ROW_GAP,
  STENCIL_GROUP_PADDING,
  STENCIL_SIDE_PADDING,
  MIN_RESIZABLE_WIDTH,
  STENCIL_NODE_COLUMN_GAP,
  KEY_THROTTLE_TIME,
  EDGE_TARGET_CP_OFFSET,
  EDGE_WRAPPER_WIDTH,
  SOURCE_ARROWHEAD_STROKE_WIDTH,
  TARGET_ARROWHEAD_STROKE_WIDTH,
  CONTACT_ME_EMAIL,
}
