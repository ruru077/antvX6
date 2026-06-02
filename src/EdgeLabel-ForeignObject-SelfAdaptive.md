# Edge Label foreignObject 自适应排坑全链路

## 问题

Node label (`text-block`) 用 `refHeight: null` + `refWidth: '100%'` 即可自适应内容，edge label 相同配置不显示。

## 排查步骤

### 1. 怀疑是 SVG foreignObject 规范限制

SVG `<foreignObject>` 必须显式 `width`/`height`，`auto` 不生效。

**验证**: Node label 同用 `refHeight: null`（无 height 属性），却正常显示 → 不是规范问题。

### 2. 怀疑是 Edge label 无 ref 父容器

Node `refWidth` 解析到 body rect (160×60)，Edge label 的 ref 源是 `label.size`，未设则为 `undefined`。

**修复**: 给 `label.size` 提供 `refWidth` 参照系。

```typescript
edge.appendLabel({
  size: { width: 160, height: 0 },
  attrs: { foreignObject: { refWidth: '100%', ... } },
})
```

**结果**: DOM 中 width=160 ✅，但 height=0 → 仍不可见。

### 3. 怀疑是初始文本缺失

Node label 的 div 有 `text: 'click to edit'`，Edge label 的 div 初始 `textContent = ''`。

**验证**: 删掉 node label text，仍正常显示；edge label 设 `textContent = '.'`，仍不可见 → 无关。

### 4. 找到根因：X6 内置 CSS 差异

**源码**: `X6/src/style/raw.ts:58-63`

```css
.x6-node foreignObject {
  display: block; /* ← 节点有 */
  overflow: visible; /* ← 节点有 */
}
/* .x6-edge 下无 foreignObject 规则 */
```

Node fo 被赋予 `overflow: visible` + `display: block`，Edge fo 没有。

**全局 CSS 修复** (`src/components/styles/global.scss`):

```css
.x6-edge foreignObject {
  display: block;
  overflow: visible;
}
```

### 5. CSS 加了仍不可见——fo height=0 被浏览器跳过渲染盒

即使用 `refHeight: null`（不设 height 属性）且 CSS 有 `overflow: visible`，浏览器对 height=0 的 foreignObject **不分配渲染盒**，直接跳过。

Node label 能逃过是因为 node body 的 `<g>` 容器提供了隐式布局上下文；Edge label 的 `<g>` 只是沿路径定位，无布局上下文。

### 6. 最终方案: 1px 最小高度

```typescript
refHeight: 1 // 1px → browser 分配渲染盒
```

**X6 setWrapper 解析** (`X6/src/registry/attr/ref.ts:168`):

```typescript
// refHeight: 1
// value=1, 不在 [0,1] 且非百分比
// attrValue = Math.max(1 + refBBox.height, 0) = Math.max(1 + 0, 0) = 1
// → foreignObject height="1"
```

1px 渲染盒 + CSS `overflow: visible` + div `height: auto` → 内容自适应扩展、完整可见。

## 最终配置

```typescript
// 全局 CSS (src/components/styles/global.scss)
.x6-edge foreignObject {
  display: block;
  overflow: visible;
}

// 追加标签
edge.appendLabel({
  markup: getTextBlockMarkup(true),
  size: { width: 160, height: 0 },
  position: { distance: 0.5, offset: 15 },
  attrs: {
    foreignObject: {
      refWidth: '100%',   // = size.width = 160
      refHeight: 1,        // 1px 最小高度
      x: -60,              // -160/2, 居中
      y: -12,
    },
  },
})

// onEdgeLabelRendered 中 div 样式
Object.assign(labelDiv.style, {
  cursor: 'text',
  userSelect: 'text',
  whiteSpace: 'pre',
  display: 'block',
  width: 'fit-content',
  height: 'auto',
  color: '#333',
})
```

## 关键源码

| 文件         | 路径                                  | 作用                                                 |
| ------------ | ------------------------------------- | ---------------------------------------------------- |
| X6 CSS rules | `X6/src/style/raw.ts:58-63`           | `.x6-node fo` 有 `overflow:visible`，`.x6-edge` 没有 |
| setWrapper   | `X6/src/registry/attr/ref.ts:168-190` | `refHeight: 1` 如何解析为 `height="1"`               |
| updateLabels | `X6/src/view/edge/index.ts:442-462`   | `rootBBox` 来自 `label.size`，非 edge path bbox      |

## 总结

| 层                        | 作用                 |
| ------------------------- | -------------------- |
| `size.width: 160`         | 提供 ref 参照系      |
| `refWidth: '100%'`        | fo width = 160       |
| `refHeight: 1`            | fo 有渲染盒          |
| `overflow: visible` (CSS) | 内容超出 fo 边界可见 |
| div `height: auto`        | 内容自适应扩展       |
