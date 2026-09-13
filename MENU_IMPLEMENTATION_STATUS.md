# shadcn/ui 右键菜单与悬浮菜单功能清单

更新时间：2026-08-20

## 当前挂载入口

- 画布挂载入口：`DiagramCanvas()`，根据 `metaContextMenuEnabled` 选择菜单实现。
- 默认菜单入口：`ContextMenuAntd()`；实验开关关闭时包裹 `.paper-container`。
- Meta 菜单入口：`ContextMenu()`；实验开关开启时包裹 `.paper-container`。
- shadcn 右键菜单入口：`ContextMenu()`。
- X6 右键事件入口：`ContextMenu()` 内的 `onBlank()`、`onNode()`、`onEdge()`。
- 右键菜单顶部悬浮操作条入口：`FloatingToolbar()`。
- 画布悬浮工具栏自身的右键菜单入口：`ToolbarMenu()`。
- 业务动作统一入口：`createContextMenuService()`。

`SettingModal()` 的“实验功能 → 启用 Meta 右键菜单”控制当前实现，配置入口为 `useConfigStore().setMetaContextMenuEnabled()`，默认值为 `false`（Ant Design）。`useContextMenu()` 仍保留在代码中，但已不再挂载到当前画布入口。

## 已实现

### 画布空白区右键菜单

| 功能 | UI 入口函数 | 动作入口函数 |
| --- | --- | --- |
| 粘贴 | `BlankCanvasMenu()` | `createContextMenuService().paste()` |
| 撤销 | `BlankCanvasMenu()` | `createContextMenuService().undo()` |
| 重做 | `BlankCanvasMenu()` | `createContextMenuService().redo()` |
| 全选 | `BlankCanvasMenu()` | `createContextMenuService().selectAll()` |
| 将当前选中内容创建为常规系统封装 | `BlankCanvasMenu()` | `createContextMenuService().createSubsystem()` |

### 普通节点右键菜单

| 功能 | UI 入口函数 | 动作入口函数 |
| --- | --- | --- |
| 打开参数窗口 | `NodeMenu()` | `createContextMenuService().openNodeParameters()` |
| 剪切 | `NodeMenu()` | `createContextMenuService().cut()` |
| 复制 | `NodeMenu()` | `createContextMenuService().copy()` |
| 删除 | `NodeMenu()` | `createContextMenuService().remove()` |
| 显示/隐藏标签 | `NodeMenu()` | `createContextMenuService().toggleLabelVisibility()` |
| 基于所选内容创建常规子系统 | `NodeMenu()` | `createContextMenuService().createSubsystem()` |

### 子系统节点右键菜单

| 功能 | UI 入口函数 | 动作入口函数 |
| --- | --- | --- |
| 在当前导航内打开 | `SubsystemMenu()` | `createContextMenuService().openSubsystem()` |
| 在新选项卡打开 | `SubsystemMenu()` | `createContextMenuService().openSubsystemInTab()` |
| 剪切、复制、删除 | `SubsystemMenu()` | `cut()`、`copy()`、`remove()` |
| 打开参数窗口 | `SubsystemMenu()` | `openNodeParameters()` |
| 显示/隐藏标签 | `SubsystemMenu()` | `toggleLabelVisibility()` |
| 基于所选内容创建常规子系统 | `SubsystemMenu()` | `createSubsystem()` |
| 创建封装 | `SubsystemMenu()` | `createSubsystemMask()` |
| 查看封装内部 | `SubsystemMenu()` | `openSubsystem()` |
| 封装参数 | `SubsystemMenu()` | `openNodeParameters()` |
| 添加自定义图像 | `SubsystemMenu()` | `addSubsystemImage()` |
| 删除自定义图像 | `SubsystemMenu()` | `removeSubsystemImage()` |

### 连线右键菜单

| 功能 | UI 入口函数 | 动作入口函数 |
| --- | --- | --- |
| 剪切 | `EdgeMenu()` | `createContextMenuService().cut()` |
| 复制 | `EdgeMenu()` | `createContextMenuService().copy()` |
| 删除 | `EdgeMenu()` | `createContextMenuService().remove()` |

### 右键菜单顶部悬浮操作条

| 上下文 | 功能 | UI 入口函数 | 动作入口函数 |
| --- | --- | --- | --- |
| 全部 | 格式化全图连线 | `FloatingToolbar()` | `formatDiagram()` → `routeAllEdges()` |
| 全部 | 按当前视觉顺序自动网格排列并重新路由 | `FloatingToolbar()` | `autoArrange()` → `routeAllEdges()` |
| 子系统节点 | 选择自定义模块图标 | `FloatingToolbar()` | `addSubsystemImage()` |
| 空白区 | 撤销、重做、粘贴 | `FloatingToolbar()` | `undo()`、`redo()`、`paste()` |
| 空白区 | 设置画布背景颜色 | `FloatingToolbar()`、`BackgroundColorPalette()` | `setCanvasBackgroundColor()` |
| 空白区 | 设置全部模块的画布字体 | `FloatingToolbar()`、`CanvasFontSelect()` | `setCanvasFontFamily()` |
| 节点 | 剪切、复制、粘贴 | `FloatingToolbar()` | `cut()`、`copy()`、`paste()` |
| 节点 | 复制 `srcBlock` 模块路径 | `FloatingToolbar()` | `copyBlockPath()` |
| 节点 | 设置模块背景颜色 | `FloatingToolbar()`、`BackgroundColorPalette()` | `setNodeBackgroundColor()` |
| 节点 | 设置模块名称前景颜色 | `FloatingToolbar()`、`BackgroundColorPalette()` | `setLabelColor()` |
| 节点 | 选择、放大、缩小模块名称字号 | `FloatingToolbar()`、`FontSizeSelect()` | `setLabelFontSize()`、`increaseLabelFontSize()`、`decreaseLabelFontSize()` |
| 节点 | 显示/隐藏模块名称 | `FloatingToolbar()`、`VisibilityPanel()` | `setLabelVisible()` |
| 节点 | 顺时针/逆时针旋转 | `FloatingToolbar()` | `rotateClockwise()`、`rotateCounterclockwise()` |
| 连线 | 剪切、复制、粘贴 | `FloatingToolbar()` | `cut()`、`copy()`、`paste()` |

`ToolbarGroup()` 是悬浮操作条的统一动作分发入口，必须把完整的 `ToolbarAction` 传给 `ToolbarActionItem()`；不能只传图标和标签，否则 `onSelect` 与 `disabled` 会丢失。

### 画布悬浮工具栏右键菜单

| 功能 | UI 入口函数 | 状态入口函数 |
| --- | --- | --- |
| 显示/隐藏画布悬浮工具栏 | `ToolbarMenu()` | `DiagramCanvas()` 内的 `setToolbarsVisible()` |

## 未实现

以下项目只有 UI 规划，或尚无稳定业务/service 入口。本轮不猜测模型属性路径，统一保持禁用或 `feat` 状态。

### 右键菜单

- 空白区：探索、Copilot 解释、模型设置、运行、代码生成、定点工具、需求查看器、模型顾问、取消突出显示、系统封装参数。
- 普通节点：探索、Copilot 解释、设为原子、代码生成、定点工具、原子/使能/触发子系统、转换为可变子系统/引用模型、查看封装、封装参数、库浏览器、库链接管理器、调试。
- 子系统节点：探索、Copilot 解释、设为原子、代码生成、定点工具、原子/使能/触发/函数调用子系统、转换为可变/引用子系统/引用模型、展开、调试。
- 连线：跟踪信号、总线与信号层次结构、属性、记录信号、数据检查器、添加/编辑查看器、测试点、代码生成、需求查看器、转换为 Goto/From、调试。

### 右键菜单顶部悬浮操作条

- 普通节点、空白区、连线：模块图标（当前只对支持自定义图像的子系统节点开放）。
- 空白区：粘贴输入端口副本。
- 节点：内容预览、字体属性、左右/上下翻转。
- 连线：字体大小/放大/缩小、模块名称显隐、内容预览、字体属性。

## 后续实现约束

- 新动作优先增加到 `createContextMenuService()`，菜单组件只负责上下文分发和调用。
- 需要修改节点/连线样式的功能，先确认各 block 类型的规范化 attr 路径，再启用对应按钮。
- 涉及仿真、App、Copilot、查看器和代码生成的功能，需要先确定业务窗口或协议入口。
