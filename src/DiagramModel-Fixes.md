# DiagramModel.tsx 修复说明

本文档记录 `src/views/DiagramModel.tsx` 中的两处修复，包括根因分析与修复方案。

---

## 修复一：contentEditable 误写入 style 对象

### 位置

`src/views/DiagramModel.tsx` **第 355–365 行**（rAF 回调内）

### 修复前（错误）

```ts
// 第 347~357 行（旧）
Object.assign(labelDiv.style, {
  cursor: 'text',
  userSelect: 'text',
  outline: 'none',
  width: 'fit-content',
  height: 'auto',
  whiteSpace: 'pre',
  marginLeft: '50%',
  transform: 'translateX(-50%)',
  contentEditable: 'plaintext-only',  // ← 写在 style 对象里，不生效
})
```

### 修复后（正确）

```ts
// 第 355~365 行（新）
Object.assign(labelDiv.style, {
  cursor: 'text',
  userSelect: 'text',
  outline: 'none',
  width: 'fit-content',
  height: 'auto',
  whiteSpace: 'pre',
  marginLeft: '50%',
  transform: 'translateX(-50%)',
})

// contentEditable 是 HTML 属性而非 CSS 属性，不能写入 style 对象
labelDiv.contentEditable = 'plaintext-only'
```

### 根因

`contentEditable` 是 HTMLElement 的 **IDL 属性**（HTML DOM 属性），**不是 CSS 属性**。`Object.assign(labelDiv.style, { contentEditable: 'plaintext-only' })` 会将 `contentEditable` 作为 `style` 对象的自定义属性写入，但浏览器渲染引擎只识别 `style` 上的 CSS 属性，对此直接忽略，不会产生任何效果。

### 修复要点

将 `contentEditable` 从 `style` 对象中移出，改为单独通过 DOM 属性赋值 `labelDiv.contentEditable = 'plaintext-only'`。等效的替代写法还有 `labelDiv.setAttribute('contenteditable', 'plaintext-only')`。

---

## 修复二：text-block shape 的 attrHooks.text 拦截 port 标签

### 位置

`src/views/DiagramModel.tsx` **第 252–332 行**（text-block 节点的 port groups 配置）

涉及两个 port group：
- `inSYS`：**第 252–292 行**
- `outSYS`：**第 293–332 行**

### 现象

第一个节点（`shape: 'rect'`，第 22 行）的 port 标签 "In1" / "Out1" 正常显示。
第三个节点（`shape: 'text-block'`，第 227 行）的 port 标签**完全不显示**。

两个节点的 port 配置在修复前完全相同，唯一区别是 shape 不同。

### 修复前（错误）

```ts
// inSYS group — attrs.text 中包含 text 属性
attrs: {
  portBody: { magnet: true, strokeWidth: 10, strokeOpacity: 0 },
  text: {
    fontSize: 12,
    fontWeight: 'bold',
    text: 'In1',           // ← 这个 text 属性会被 attrHooks.text 拦截
  },
},
label: {
  position: { name: 'right', args: { x: 2 } },
  // 未定义 markup，使用默认 port label markup
},
```

### 修复后（正确）

```ts
// inSYS group — 移除 text 属性，改用 markup.textContent
attrs: {
  portBody: { magnet: true, strokeWidth: 10, strokeOpacity: 0 },
  // 不使用 text 属性设值，避免 text-block 的 attrHooks.text 拦截
  text: {
    fontSize: 12,
    fontWeight: 'bold',
    // text: 'In1'  ← 已移除
  },
},
label: {
  // 通过 markup.textContent 设置文本，绕过 attrHooks.text
  markup: {
    tagName: 'text',
    selector: 'text',
    textContent: 'In1',    // ← 文本内容在 markup 渲染时直接写入 DOM
  },
  position: { name: 'right', args: { x: 2 } },
},
```

`outSYS` group 做了同样的修改（`textContent: 'Out1'`）。

### 根因（深层分析）

#### 1. text-block shape 的 attrHooks.text

X6 的 `text-block` shape（`node_modules/@antv/x6/lib/shape/text-block.js`）定义了 shape 级别的 `attrHooks.text`：

```js
attrHooks: {
  text: {
    set(text, { elem, refBBox, ... }) {
      if (elem instanceof HTMLElement) {
        elem.textContent = text;        // ← 节点主 label（div）走这里，正常
      } else {
        // SVG 元素走这里 —— 包括 port 标签的 <text> 元素
        const wrapValue = { text, width: -5, height: '100%' };
        textWrap.set(wrapValue, { elem, refBBox, ... });  // ← 问题根源
      }
    },
    position(text, { refBBox, elem }) {
      if (elem instanceof SVGElement) {
        return refBBox.getCenter();      // ← 也会干扰 port 标签定位
      }
    },
  },
},
```

#### 2. attrHooks 的作用域是整个 cell

X6 的 `AttrManager` 通过 `cell.getAttrDefinition(attrName)` 查找属性定义（`node_modules/@antv/x6/lib/model/cell.js` 第 509 行）：

```js
getAttrDefinition(attrName) {
  const hooks = ctor.getAttrHooks() || {};        // ← 取 shape 级 attrHooks
  let definition = hooks[attrName] || registry.attrRegistry.get(attrName);
  ...
}
```

这意味着 `text-block` 节点内**所有元素**的 `text` 属性都会被 `attrHooks.text` 拦截——不仅限于节点主 label，还包括 port 标签的 `<text>` 元素。

#### 3. 对 port 标签的具体影响

port 标签是 SVG `<text>` 元素（默认 port label markup，`node_modules/@antv/x6/lib/view/markup.js` 第 196 行）：

```js
function getPortLabelMarkup() {
  return { tagName: 'text', selector: 'text', attrs: { fill: '#000000' } };
}
```

当 `attrHooks.text.set` 处理 port 标签时：
- `elem` 是 SVG `<text>` 元素，**不是** HTMLElement
- 走 `else` 分支，调用 `textWrap.set`，传入 `width: -5`
- port 的 `refBBox` 通常是 0×0 或极小尺寸
- `textWrap` 计算：`refBBox.width += width` → `0 + (-5) = -5`（**负宽度**）
- 文本被包裹进一个负宽度的区域 → **文字不可见**

同时 `attrHooks.text.position` 返回 `refBBox.getCenter()` → `(0, 0)`，覆盖了 port label layout 的定位。

#### 4. 为什么 rect shape 不受影响

`rect` shape 没有自定义 `attrHooks.text`，port 标签的 `text` 属性由全局 `attrRegistry` 中的默认 `text` 处理器处理（`node_modules/@antv/x6/lib/registry/attr/text.js`），该处理器直接调用 `Dom.text(elem, text)` 设置文本内容，不做 textWrap，所以正常显示。

### 修复要点

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| 文本内容来源 | `attrs.text.text: 'In1'` | `label.markup.textContent: 'In1'` |
| 是否触发 attrHooks.text | 是（导致 textWrap 负宽度） | 否（attrs 中无 `text` 属性名） |
| port label 是否显示 | 不可见 | 正常显示 |

核心思路：**将文本内容从 attrs 的 `text` 属性移到 markup 的 `textContent` 字段**。`textContent` 在 `parseJSONMarkup` 阶段直接写入 DOM（`node_modules/@antv/x6/lib/view/markup.js` 第 70 行），不经过 AttrManager，因此不会被 `attrHooks.text` 拦截。

---

## 文件结构总览

```
DiagramModel.tsx 行号索引
─────────────────────────────────────────────
  22-142   节点1: shape='rect'（对照组，port 标签正常）
 143-225   节点2: shape='rect'（In 端口块）
 226-346   节点3: shape='text-block'（修复目标）
   269-273   ↳ inSYS: attrs.text 移除 text 属性        ← 修复二
   278-284   ↳ inSYS: label.markup.textContent='In1'   ← 修复二
   311-314   ↳ outSYS: attrs.text 移除 text 属性       ← 修复二
   319-324   ↳ outSYS: label.markup.textContent='Out1' ← 修复二
 347-374   rAF 回调：label 可编辑修饰
   355-364   ↳ Object.assign(labelDiv.style, {...})    ← 修复一（移除 contentEditable）
   365       ↳ labelDiv.contentEditable = '...'        ← 修复一（单独设置 DOM 属性）
```
