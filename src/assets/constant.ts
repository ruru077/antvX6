/**
 * @description 常量
 */
/**
 * @instruction 当为 10 的倍数时 曼哈顿路由更为稳定
 */
const GRAPH_GRID = 20
// 单次节点拖动超过三个网格时，放弃旧手动折点，按新布局重新路由。
const NODE_ROUTE_RESET_DISTANCE = GRAPH_GRID * 8
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
// 模块放置后，端口自动连接预览线悬空端点的屏幕距离（px）。
const PREVIEW_PORT_SNAP_RADIUS = 10
// 粘贴时节点偏移量
const PASTE_OFFSET = 32
// STENCIL节点行内间距
const STENCIL_NODE_ROW_GAP = 12
// STENCIL分组底部间距
const STENCIL_GROUP_PADDING = 40
// STENCIL左右内边距
const STENCIL_SIDE_PADDING = 10
// STENCIL最小重排宽度
const MIN_RESIZABLE_WIDTH = 10
// STENCIL节点垂直间距
const STENCIL_NODE_COLUMN_GAP = 12
// 键盘事件节流时间
const KEY_THROTTLE_TIME = 800
// 模型保存事件
const SAVE_MODEL_EVENT = 'model:save'
// target connectionPoint 相对 anchor 的偏移量（负值 = 线段终点提前于 port）
const EDGE_TARGET_CP_OFFSET = -5
// Port 出线方向保留的固定线段长度
const PORT_STUB_SIZE = 20
// EDGE Wrapper 的宽度
const EDGE_WRAPPER_WIDTH = 20
// sourceArrowhead StrokeWdith
const SOURCE_ARROWHEAD_STROKE_WIDTH = 3
// targetArrowhead StrokeWidth
const TARGET_ARROWHEAD_STROKE_WIDTH = 10
// 联系人邮箱
const CONTACT_ME_EMAIL = 'yesw@sustech.edu.cn'
// Ctrl/Meta + wheel 缩放档位
const WHEEL_ZOOM_LEVELS = [0.5, 0.6, 0.8, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5]
// 右键拖拽复制触发阈值
const RIGHT_DRAG_COPY_THRESHOLD = 5
// Edge 悬浮工具的基础 class 与可见状态 class
const HOVER_EDGE_TOOL_CLASS = 'edge-hover-tool'
const HOVER_EDGE_TOOL_VISIBLE_CLASS = 'edge-hover-tool-visible'
export {
  GRAPH_GRID,
  NODE_ROUTE_RESET_DISTANCE,
  RED,
  BLACK,
  TARGETMARKER_SIZE,
  GAP_SIZE,
  SNAP_RADIUS,
  PREVIEW_PORT_SNAP_RADIUS,
  EDGE_STROKE_WIDTH,
  PASTE_OFFSET,
  STENCIL_NODE_ROW_GAP,
  STENCIL_GROUP_PADDING,
  STENCIL_SIDE_PADDING,
  MIN_RESIZABLE_WIDTH,
  STENCIL_NODE_COLUMN_GAP,
  KEY_THROTTLE_TIME,
  SAVE_MODEL_EVENT,
  EDGE_TARGET_CP_OFFSET,
  PORT_STUB_SIZE,
  EDGE_WRAPPER_WIDTH,
  SOURCE_ARROWHEAD_STROKE_WIDTH,
  TARGET_ARROWHEAD_STROKE_WIDTH,
  CONTACT_ME_EMAIL,
  WHEEL_ZOOM_LEVELS,
  RIGHT_DRAG_COPY_THRESHOLD,
  HOVER_EDGE_TOOL_CLASS,
  HOVER_EDGE_TOOL_VISIBLE_CLASS,
}
