# Exchange 性能优化后的代码变更说明

## 文档范围

- 基线提交：`3939442 perf: exchange界面 优化布局`
- 记录范围：基线之后至 `d160052` 的全部 7 个提交
- 提交日期：2026-10-17
- 排列方式：按提交时间从早到晚

本文记录基线之后的性能优化、功能调整、缺陷修复和代码清理。每节说明修改动机、实际行为变化和主要代码边界，便于后续排查回归或继续开发。

## 变更总览

| 提交 | 类型 | 主题 | 主要影响范围 |
| --- | --- | --- | --- |
| `3766f06` | perf | 空模型视口初始化 | Graph 缩放与居中 |
| `793bcef` | chore | 生产环境隐藏未稳定设置 | 设置导航 |
| `385ad3a` | chore | Scope 图表显示调整 | 采样、时间轴、数值显示 |
| `54a349c` | chore | 禁用尚未迁移的功能 | Scope、工具栏、部署入口 |
| `a804397` | feat | 本地自动保存与恢复 | 模型编辑、保存、Exchange 打开流程 |
| `1b3122c` | chore | 固定根图 ID | 子系统 Store、Tab、导出与 DTO |
| `d160052` | chore | 删除已完成的 beta 测试模块 | Stencil beta 分组 |

## `3766f06` 空模型不执行 zoomToFit

### 背景

空模型没有 Cell，继续调用 `zoomToFit` 无法得到有意义的内容边界，可能造成首次进入空模型时缩放或定位异常。

### 修改

- 有 Cell 时保持原行为：刷新 Scroller 后执行 `zoomToFit`。
- 没有 Cell 时不再执行 `zoomToFit`。
- 空模型固定使用 100% 缩放，并将视口定位到画布页面中心。
- 仍在两次 `requestAnimationFrame` 后完成初始化，避免容器尺寸尚未稳定。

### 代码边界

- `src/utils/hooks/useKeepAliveGraphViewport.ts`

## `793bcef` 生产环境禁用未稳定设置

### 背景

部分设置页面尚未稳定，不应在生产环境中提供可操作入口。

### 修改

- 为设置导航项增加 `disabled` 状态。
- 生产环境禁用以下入口：
  - 参数封装
  - 外观
  - 语言
  - 开发者模式
- 开发环境仍可使用这些入口。
- 设置导航按钮由包裹 `<a href="#">` 改为原生按钮语义，禁用状态直接交给 `SidebarMenuButton`。

### 代码边界

- `src/components/SettingModal.tsx`

## `385ad3a` Scope 图表采样与时间轴调整

### 背景

Scope 的采样时间原先固定从 `0.1` 开始，没有结合解释器的实际仿真步长；时间轴也只使用返回数据的首尾值，显示和输入缺少约束。

### 修改

- 固定步长模式读取 `config.SimFixedStep`。
- 自动步长或变步长模式从返回数据中计算最小有效时间间隔。
- 实际采样间隔取“用户输入采样时间”和“仿真步长”中的较大值，避免采样间隔小于仿真数据分辨率。
- 默认采样时间由 `0.1 s` 调整为 `0.01 s`。
- 采样时间在失焦时校验：
  - 必须大于 0。
  - 不得小于仿真步长。
  - 非法输入恢复到最近一次有效值。
- 当解释器配置中的 `StartTime`、`StopTime` 有效时，Scope 横轴和缩放范围使用该仿真时间区间。
- 时间轴标签、指针标签和缩放条标签统一去除无意义的浮点尾数。

### 用户影响

- Scope 采样设置与实际仿真步长一致。
- 输入错误会得到明确提示，不再静默接受无法生效的采样时间。
- 横轴范围与仿真配置保持一致。

### 代码边界

- `src/components/ScopeChart.tsx`

## `54a349c` 禁用尚未迁移的功能

### Scope 数值显示

- 增加“小数位数”设置，范围为 0 至 12 位，默认 2 位。
- Tooltip 数值使用统一的小数位格式。
- 采样时间输入框缩窄并隐藏增减控制按钮。

### 生产环境工具栏

- “下载到目标设备”在生产环境禁用。
- “验证模型”在生产环境禁用。

### 部署入口

- `/deploy` 不再传入 `showIssueLink`，因此部署工作区不再显示尚未迁移完成的问题提交入口。

### 代码边界

- `src/components/ScopeChart.tsx`
- `src/components/layout/PaperToolbar.tsx`
- `src/router/index.tsx`

## `a804397` 模型自动保存与恢复

### 自动保存数据

自动保存内容包括：

- 完整 `EntryGraphModel`
- 当前解释器配置 `InterpreterConfig`

Local Storage 使用用户与模型联合键隔离数据：

```text
antv-link:autosave:v1:{userId}:{modelId}
```

同时单独记录自动保存时间。

### 自动保存触发规则

- 工作区处于激活、初始化完成且没有等待恢复选择时，启动自动保存。
- 每 10 秒同步当前画布并重新计算 dirty 状态。
- 仅在模型或解释器配置有未保存修改时写入。
- 新内容与已有自动保存完全一致时不重复写入。
- 当前编辑撤销回数据库保存状态后，清理本轮生成的旧草稿。
- 同一轮连续失败只提示一次，下一次成功后恢复提示能力。

### 打开模型时的恢复流程

Exchange 打开模型时同时读取数据库内容和该用户、该模型对应的本地草稿：

- 本地草稿与数据库内容一致时，自动删除冗余草稿。
- 存在不同草稿时，将恢复信息传入工作区。
- 工作区完成初始化后显示恢复对话框。
- 用户可选择：
  - 加载数据库版本。
  - 恢复自动保存版本。
  - 丢弃自动保存并使用数据库版本。

恢复对话框展示数据库保存时间、本地自动保存时间和草稿大小。

### 手动保存与返回

- 手动保存成功后，同时更新 Graph 与解释器配置的保存快照。
- 保存成功且没有保存期间产生的新修改时，删除本地草稿。
- 如果保存请求期间又产生修改，则保留最新草稿。
- 返回 Exchange 前重新同步画布并计算 dirty 状态。
- 存在未保存修改时提供“取消”“不保存并返回”“保存并返回”。
- “不保存并返回”会删除当前模型的本地草稿。
- “保存并返回”只有在保存完成后仍为干净状态时才执行导航。

### dirty 判定变化

- dirty 状态同时比较 Graph 模型和解释器配置。
- 浏览不同子图不视为模型内容变化：比较时统一以根图作为 `currentGraphId`。
- 导出比较前会清理运行时选中样式，避免 outline、dropShadow 或 Annotation 选中背景造成虚假 dirty。

### 代码边界

- `src/services/model-autosave-service.ts`
- `src/utils/hooks/useModelAutosave.ts`
- `src/components/ModelRecoveryDialog.tsx`
- `src/components/styles/model-recovery.scss`
- `src/views/exchangeDiagram.tsx`
- `src/views/site/ExchangeWorkspaceRoutes.tsx`
- `src/views/BlockDiagram.tsx`
- `src/components/layout/PaperToolbar.tsx`
- `src/store/subGraphStore.ts`

## `1b3122c` 根图 ID 固定为 root

### 背景

根图 ID 属于图层结构标识，不应复用模型名称或数据库模型 ID。动态根图 ID 会让子系统导航、历史栈、视图切换和 DTO 展平使用不同的根节点语义。

### 修改

- 新增统一常量 `ROOT_GRAPH_ID = 'root'`。
- `EntryGraphModel.rootId` 类型收紧为字面量 `'root'`。
- 以下位置统一直接使用固定根图 ID：
  - 新建空模型
  - SubGraph Store 初始状态
  - 模型导出
  - dirty 比较
  - Subsystem Tab 初始历史
  - 模型加载后的 Store rootId
  - 仿真/编译 DTO 的根图展平入口
- 模型名称继续由 `modelName` 单独维护，不再承担 Graph ID 语义。

### 代码边界

- `src/assets/constant.ts`
- `types/common/subGraph.d.ts`
- `src/store/subGraphStore.ts`
- `src/store/subSystemTabStore.ts`
- `src/services/subsystem-service.ts`
- `src/views/exchangeDiagram.tsx`

## `d160052` 删除已完成的 beta 测试模块

### 背景

Stencil 的 beta 分组曾内置 Add、Product、Sum 和 Subsystem，用于验证新模块数据结构及布局。Add、Product、Sum 的测试已经结束，不应继续维护重复的本地 Block 定义。

### 修改

- 删除本地 `ADD_TEST_BLOCK`。
- 删除本地 `PRODUCT_TEST_BLOCK`。
- 删除本地 `SUM_TEST_BLOCK`。
- beta 分组只保留 `SUBSYSTEM_TEST_BLOCK`，继续用于 Subsystem 结构验证。
- 后端加载的正式模块数据和其他 Stencil 分组不受影响。

### 代码边界

- `src/services/stencil-service.ts`

## 后续文档约定

后续 bug、feat、perf、refactor、build、chore 等代码提交，可继续按以下结构记录：

1. 背景或问题现象。
2. 实际代码修改。
3. 用户可观察到的行为变化。
4. 主要文件和模块边界。
5. 已完成的验证以及尚未验证的部分。

本文根据 Git 提交与代码差异整理，没有重新运行构建、类型检查或浏览器测试。
