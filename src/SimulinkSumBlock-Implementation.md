# Simulink Sum Block 端口布局实现笔记

## 一、leftArc 自定义 Port 布局

### 原理

注册自定义 `leftArc` port layout，端口沿椭圆左半弧均匀分布。

```typescript
Graph.registerPortLayout('leftArc', (portsArgs, elemBBox, groupArgs) => {
  const count = portsArgs.length
  const range = groupArgs.range ?? Math.min(180, (count - 1) * 90)
  const startAngle = groupArgs.start ?? 180
  const step = count > 1 ? range / (count - 1) : 0

  const center = elemBBox.getCenter()
  const topCenter = elemBBox.getTopCenter()
  const ratio = elemBBox.width / elemBBox.height

  return portsArgs.map((item, idx) => {
    const angle = startAngle + idx * step
    const p = topCenter.clone().rotate(-angle, center).scale(ratio, 1, center)
    return { angle: ..., position: p.round().toJSON() }
  })
})
```

### 端口数-跨度表

| 端口数 | 跨度 | 步长       | 角度分布               |
| ------ | ---- | ---------- | ---------------------- |
| 1      | 0°   | 0          | 270° (左侧)            |
| 2      | 90°  | 90°        | 180°, 270° (底部+左侧) |
| 3      | 135° | 67.5°      | 180°, 247.5°, 315°     |
| 4+     | 180° | 180°/(N-1) | 180° → 360° 等距       |

---

## 二、箭头旋转公式

### X6 角度坐标系

- angle 0° = topCenter，顺时针递增
- angle 180° = 底部，angle 270° = 左侧

### 推导

输入箭头 SVG path 尖端在 (0,0)，默认指向 LEFT (180°)。

```typescript
const dx = center.x - p.x // 端口→圆心 的 x 分量
const dy = center.y - p.y // 端口→圆心 的 y 分量
const mathAngle = Math.atan2(dy, dx) * (180 / Math.PI)

// X6 applyPortTransform 使用 rotate(angle)，不是 rotate(-angle)
// 输入箭头默认 180°，需旋转到圆心方向
const theta = 180 + mathAngle + 180
```

### 验证

| 端口 | mathAngle | theta    | rotate  | 箭头     |
| ---- | --------- | -------- | ------- | -------- |
| 底部 | -90°      | 270°     | CW 270° | 指向上 ✓ |
| 左侧 | 0°        | 360°→0°  | CW 360° | 指向右 ✓ |
| 顶部 | 90°       | 450°→90° | CW 90°  | 指向下 ✓ |

---

## 三、Port Label 两大坑点

### 坑点 1: `existPortLabel` 硬编码检查

**源码**: `X6/src/view/node/index.ts:531-533`

```typescript
protected existPortLabel(port: Port) {
  return port.attrs && port.attrs.text  // 只认 'text' key
}
```

X6 创建 label DOM 前检查 `port.attrs.text`。不存在则跳过，label 不渲染。

**修复**: group attrs 中必须加 `text: {}` 占位：

```typescript
attrs: {
  text: {},      // ← 必须，否则 label 不创建
  portBody: { ... },
}
```

### 坑点 2: 默认 label selector 是 `text`

**源码**: `X6/src/view/markup.ts:295-302`

```typescript
function getPortLabelMarkup(): MarkupType {
  return { tagName: 'text', selector: 'text' } // 默认 'text'
}
```

默认 selector 是 `text`，设置 `attrs.portLabel` 找不到对应 DOM。

**修复**: 自定义 label markup，覆盖 selector：

```typescript
label: {
  markup: [{ tagName: 'text', selector: 'portLabel' }],
}
```

### Label 创建完整调用链

```
createPortElement()                              // X6/src/view/node/index.ts:390+
  ├─ existPortLabel(port)                         // :531 — 检查 port.attrs.text
  ├─ getPortLabelMarkup(port.label)               // :527 — label.markup || cell.portLabelMarkup
  ├─ Markup.renderMarkup(...)                     // :397 — 创建 DOM
  ├─ selector 去重检查                             // :404
  └─ portElement.appendChild(portLabelElement)    // :415

updatePortGroup()                                 // :451
  ├─ applyPortTransform(portElement, portLayout)  // :466
  ├─ updateAttrs(portElement, portAttrs)          // :475
  ├─ applyPortTransform(labelElement, labelLayout, -(portLayout.angle))
  │                                               // :484 — label 定位 + 反旋抵消
  └─ updateAttrs(labelElement, labelLayout.attrs) // :499
```

---

## 四、Edge Label 动态追加

### 核心逻辑

```typescript
// 双击边: 无标签→追加, 有→聚焦
graph.on('edge:dblclick', ({ edge }) => {
  if (edge.getLabels().length === 0) {
    edge.appendLabel({ markup: ..., attrs: { foreignObject: { ... } } })
  } else {
    (graph.findViewByCell(edge) as any)?.labelSelectors?.[0]?.label?.focus()
  }
})
```

### 执行时序

```
appendLabel() → setLabels() → onLabelsChange()
  ├─ ① destroyCustomizeLabels()  — 清理上次 onEdgeLabelRendered 返回值
  ├─ ② renderLabels()           — 重建 DOM → customizeLabels → onEdgeLabelRendered
  └─ ③ updateLabelPositions()
```

### 坑点: blur 触发 re-render 抢焦点

```
blur → setLabelAt 保存 → onLabelsChange → renderLabels
→ onEdgeLabelRendered → setupEdgeLabel → labelDiv.focus() ⚠️
```

**修复**: 仅 `savedText === ''`（首次创建）时 auto-focus。

### 关键源码

| 函数                      | 路径                            |
| ------------------------- | ------------------------------- |
| `customizeLabels`         | `X6/src/view/edge/index.ts:227` |
| `renderLabels`            | `X6/src/view/edge/index.ts:275` |
| `destroyCustomizeLabels`  | `X6/src/view/edge/index.ts:249` |
| `onLabelsChange`          | `X6/src/view/edge/index.ts:337` |
| `OnEdgeLabelRenderedArgs` | `X6/src/graph/options.ts:386`   |
| `Edge.appendLabel`        | `X6/src/model/edge.ts:640`      |
| `Edge.removeLabelAt`      | `X6/src/model/edge.ts:665`      |
| `Edge.setLabelAt`         | `X6/src/model/edge.ts:651`      |

---

## 五、foreignObject 限制

SVG `<foreignObject>` 必须显式设 `width`/`height`，CSS `auto` 无效。

|                   | Node label             | Edge label               |
| ----------------- | ---------------------- | ------------------------ |
| 参照系            | body rect (有物理尺寸) | 无隐式容器               |
| `refHeight: null` | ✅                     | ❌ 高度 0，内容不可见    |
| 自适应            | 相对 node body         | 需 `label.size` 或固定值 |

---

## 六、Port Layout 类型系统（TS 兼容）

### 坑点: 自定义 args 不满足 X6 类型

X6 的 `PortPositionMetadata` 是 discriminated union——自定义 `name` 对应 `args: PortLayoutCommonArgs`（仅 `x, y, dx, dy`），不认 `compensateRotate`。

**修复**: 定义接口加 `[key: string]: unknown` 索引签名 + 使用时 `as` 断言：

```typescript
interface LeftArcArgs extends PortLayoutCommonArgs {
  compensateRotate?: boolean
  start?: number
  range?: number
  dr?: number
  [key: string]: unknown  // ← 满足 KeyValue 约束
}

// 使用时
args: { compensateRotate: true } as LeftArcArgs
```

---

## 七、源码索引

### Port Layout

| 文件                 | 路径                                        |
| -------------------- | ------------------------------------------- |
| `ellipseSpread`      | `X6/src/registry/port-layout/ellipse.ts:31` |
| `ellipseLayout`      | `X6/src/registry/port-layout/ellipse.ts:44` |
| `toResult`           | `X6/src/registry/port-layout/util.ts:18`    |
| `portLayoutRegistry` | `X6/src/registry/port-layout/index.ts:49`   |

### Port Label Layout

| 文件      | 路径                                             |
| --------- | ------------------------------------------------ |
| `inside`  | `X6/src/registry/port-label-layout/inout.ts:29`  |
| `outside` | `X6/src/registry/port-label-layout/inout.ts:14`  |
| `radial`  | `X6/src/registry/port-label-layout/radial.ts:12` |

### Node View

| 函数                 | 路径                            |
| -------------------- | ------------------------------- |
| `createPortElement`  | `X6/src/view/node/index.ts:390` |
| `updatePortGroup`    | `X6/src/view/node/index.ts:451` |
| `applyPortTransform` | `X6/src/view/node/index.ts:508` |
| `existPortLabel`     | `X6/src/view/node/index.ts:531` |
| `getPortLabelMarkup` | `X6/src/view/node/index.ts:527` |

### Markup

| 函数                     | 路径                           |
| ------------------------ | ------------------------------ |
| `getForeignObjectMarkup` | `X6/src/view/markup.ts:330`    |
| `getTextBlockMarkup`     | `X6/src/shape/text-block.ts:6` |
| `getPortLabelMarkup`     | `X6/src/view/markup.ts:295`    |

---

## 八、踩坑清单

1. **`existPortLabel` 硬编码**: 必须 `attrs.text: {}` 占位
2. **默认 label selector 是 `text`**: 自定义需 `label.markup: [{ selector: 'portLabel' }]`
3. **`applyPortTransform` 用 `rotate(angle)` 而非 `rotate(-angle)`**: 旋转公式据此推导
4. **Edge label `setLabelAt` 触发 re-render**: 导致 focus 被抢，需 `savedText` 判空
5. **foreignObject 必须固定宽高**: SVG 规范，CSS `auto` 无效
6. **Edge label 无隐式容器**: `refWidth/refHeight` 需 `label.size` 或固定值
7. **X6 `PortPositionMetadata` discriminated union**: 自定义 args 需 `[key: string]: unknown`
8. **`onEdgeLabelRendered` return cleanup**: DOM 即将销毁，只适合解绑外部资源
