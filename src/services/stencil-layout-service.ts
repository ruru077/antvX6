import { Dom } from '@antv/x6'
import {
  STENCIL_NODE_COLUMN_GAP,
  STENCIL_NODE_ROW_GAP,
  STENCIL_SIDE_PADDING,
} from '@/assets/constant'
import { useConfigStore } from '@/store/configStore'
import type { StencilArrangeMode } from '@/store/configStore'
import type { ComplexAttrValue, Model, Node } from '@antv/x6'

const STENCIL_LABEL_MIN_WIDTH = 72
const STENCIL_LABEL_MAX_WIDTH = 120
const STENCIL_LABEL_HORIZONTAL_PADDING = 16
const STENCIL_LABEL_LAYOUT_PADDING = 8
const STENCIL_LABEL_NODE_GAP = 12
const STENCIL_LABEL_MAX_LINES = 3

type LabelStyle = Record<string, string | number>
type StencilLabelSnapshot = {
  textWrap: ComplexAttrValue
  lineHeight: ComplexAttrValue
  style: LabelStyle | undefined
  labelRefY: ComplexAttrValue
  labelRefY2: ComplexAttrValue
  textVerticalAnchor: ComplexAttrValue
  foreignObjectRefY: ComplexAttrValue
  foreignObjectRefY2: ComplexAttrValue
  html: boolean
  appliedMode?: StencilArrangeMode
  appliedWidth?: number
}
type StencilLayoutItem = {
  node: Node
  nodeWidth: number
  nodeHeight: number
  width: number
  visualTop: number
  visualBottom: number
}
type StencilContentArea = {
  x: number
  y: number
  width: number
  height: number
}

function createStencilLayoutService() {
  const labelSnapshots = new WeakMap<Node, StencilLabelSnapshot>()

  function hasHtmlLabel(markup: unknown): boolean {
    if (Array.isArray(markup)) return markup.some(hasHtmlLabel)
    if (!markup || typeof markup !== 'object') return false

    const item = markup as {
      selector?: string
      tagName?: string
      children?: unknown
    }
    if (item.selector === 'label' && item.tagName?.toLowerCase() !== 'text') {
      return true
    }
    return hasHtmlLabel(item.children)
  }

  function getLabelSnapshot(node: Node): StencilLabelSnapshot {
    let snapshot = labelSnapshots.get(node)
    if (snapshot) return snapshot

    const style = node.attr<LabelStyle>('label/style')
    snapshot = {
      textWrap: node.attr<ComplexAttrValue>('label/textWrap'),
      lineHeight: node.attr<ComplexAttrValue>('label/lineHeight'),
      style: style ? { ...style } : undefined,
      labelRefY: node.attr<ComplexAttrValue>('label/refY'),
      labelRefY2: node.attr<ComplexAttrValue>('label/refY2'),
      textVerticalAnchor: node.attr<ComplexAttrValue>(
        'label/textVerticalAnchor',
      ),
      foreignObjectRefY: node.attr<ComplexAttrValue>('foreignObject/refY'),
      foreignObjectRefY2: node.attr<ComplexAttrValue>('foreignObject/refY2'),
      html: hasHtmlLabel(node.getMarkup()),
    }
    labelSnapshots.set(node, snapshot)
    return snapshot
  }

  function restoreLabelPresentation(target: Node, source: Node = target) {
    const snapshot = getLabelSnapshot(source)
    target.attr('label/textWrap', snapshot.textWrap ?? null)
    target.attr('label/lineHeight', snapshot.lineHeight ?? null)
    target.attr('label/style', snapshot.style ?? null)
    if (snapshot.html) {
      target.attr('foreignObject/refY', snapshot.foreignObjectRefY ?? null)
      target.attr('foreignObject/refY2', snapshot.foreignObjectRefY2 ?? null)
    } else {
      target.attr('label/refY', snapshot.labelRefY ?? null)
      target.attr('label/refY2', snapshot.labelRefY2 ?? null)
      target.attr(
        'label/textVerticalAnchor',
        snapshot.textVerticalAnchor ?? null,
      )
    }
  }

  function getViewHtmlLabelStyle(snapshot: StencilLabelSnapshot): LabelStyle {
    const style = snapshot.style ?? {}
    return {
      ...style,
      width: style.width ?? 'auto',
      maxWidth: style.maxWidth ?? 'none',
      height: style.height ?? 'auto',
      maxHeight: style.maxHeight ?? 'none',
      lineHeight: style.lineHeight ?? 'normal',
      whiteSpace: style.whiteSpace ?? 'normal',
      overflowWrap: style.overflowWrap ?? 'normal',
      wordBreak: style.wordBreak ?? 'normal',
      overflow: style.overflow ?? 'visible',
      display: style.display ?? 'flex',
      WebkitBoxOrient: style.WebkitBoxOrient ?? 'initial',
      WebkitLineClamp: style.WebkitLineClamp ?? 'unset',
      textOverflow: style.textOverflow ?? 'clip',
    }
  }

  function parseNumber(value: unknown, fallback: number): number {
    const parsed = Number.parseFloat(String(value ?? ''))
    return Number.isFinite(parsed) ? parsed : fallback
  }

  function resolveLineHeight(
    value: unknown,
    fontSize: number,
    fallbackScale: number,
  ): number {
    if (typeof value === 'string' && value.trim().endsWith('em')) {
      return parseNumber(value, fallbackScale) * fontSize
    }
    return parseNumber(value, fontSize * fallbackScale)
  }

  function getLabelTypography(node: Node, modulePriority: boolean) {
    const snapshot = getLabelSnapshot(node)
    const style = snapshot.style ?? {}
    const fontSize = parseNumber(
      node.attr('label/fontSize') ?? style.fontSize,
      14,
    )
    const lineHeight = modulePriority
      ? Math.ceil(fontSize * 1.2)
      : resolveLineHeight(
          snapshot.lineHeight ?? style.lineHeight,
          fontSize,
          snapshot.html ? 1.2 : 1,
        )
    const fontFamily = String(
      node.attr('label/fontFamily') ??
        style.fontFamily ??
        getComputedStyle(document.body).fontFamily,
    )
    const fontWeight = node.attr('label/fontWeight') ?? style.fontWeight ?? 400
    const measureStyles = {
      'font-size': fontSize,
      'font-family': fontFamily,
      'font-weight': fontWeight,
      fontSize,
      lineHeight,
    }
    return { fontSize, lineHeight, measureStyles }
  }

  function normalizeModuleLabel(text: string): string {
    return text
      .replace(/\s*\r?\n\s*/g, ' ')
      .replace(/[\t ]+/g, ' ')
      .trim()
  }

  function wrapModuleLabel(
    text: string,
    width: number,
    measureStyles: Record<string, unknown>,
  ): string {
    const words = normalizeModuleLabel(text).split(' ').filter(Boolean)
    const lines: string[] = []
    let currentLine = ''
    let index = 0

    for (; index < words.length; index += 1) {
      const word = words[index]
      const candidate = currentLine ? `${currentLine} ${word}` : word
      if (
        !currentLine ||
        Dom.measureText(candidate, measureStyles).width <= width
      ) {
        currentLine = candidate
        continue
      }

      lines.push(currentLine)
      if (lines.length === STENCIL_LABEL_MAX_LINES) break
      currentLine = word
    }

    const truncated = index < words.length
    if (!truncated && currentLine) lines.push(currentLine)
    if (truncated) {
      let lastLine = lines[lines.length - 1] ?? ''
      while (
        lastLine.includes(' ') &&
        Dom.measureText(`${lastLine}…`, measureStyles).width > width
      ) {
        lastLine = lastLine.slice(0, lastLine.lastIndexOf(' '))
      }
      lines[lines.length - 1] = `${lastLine}…`
    }

    return lines.join('\n')
  }

  function getModuleLabelWidth(nodeWidth: number, areaWidth: number): number {
    const maxWidth = Math.max(1, Math.min(STENCIL_LABEL_MAX_WIDTH, areaWidth))
    return Math.min(
      Math.max(
        nodeWidth + STENCIL_LABEL_HORIZONTAL_PADDING,
        STENCIL_LABEL_MIN_WIDTH,
      ),
      maxWidth,
    )
  }

  function resolveRefPosition(
    value: unknown,
    dimension: number,
    fallback: number,
  ): number {
    if (value == null) return fallback

    const parsed = Number.parseFloat(String(value))
    if (!Number.isFinite(parsed)) return fallback
    if (typeof value === 'string' && value.trim().endsWith('%')) {
      return (parsed / 100) * dimension
    }
    return parsed > 0 && parsed < 1 ? parsed * dimension : parsed
  }

  function getLabelVisualBounds(
    node: Node,
    labelWidth: number,
    labelHeight: number,
  ) {
    const { width: nodeWidth, height: nodeHeight } = node.getSize()
    const snapshot = getLabelSnapshot(node)
    if (snapshot.html) {
      const labelTop =
        resolveRefPosition(
          node.attr('foreignObject/refY'),
          nodeHeight,
          nodeHeight,
        ) + resolveRefPosition(node.attr('foreignObject/refY2'), nodeHeight, 0)
      return {
        left: (nodeWidth - labelWidth) / 2,
        right: (nodeWidth + labelWidth) / 2,
        top: labelTop,
        bottom: labelTop + labelHeight,
      }
    }

    const anchorX =
      resolveRefPosition(node.attr('label/refX'), nodeWidth, nodeWidth / 2) +
      resolveRefPosition(node.attr('label/refX2'), nodeWidth, 0)
    const textAnchor = node.attr<string>('label/textAnchor') ?? 'middle'
    const left =
      textAnchor === 'start'
        ? anchorX
        : textAnchor === 'end'
          ? anchorX - labelWidth
          : anchorX - labelWidth / 2
    const right = left + labelWidth
    const anchorY =
      resolveRefPosition(
        node.attr('label/refY'),
        nodeHeight,
        nodeHeight + STENCIL_LABEL_NODE_GAP,
      ) + resolveRefPosition(node.attr('label/refY2'), nodeHeight, 0)
    const verticalAnchor =
      node.attr<string>('label/textVerticalAnchor') ?? 'middle'
    const top =
      verticalAnchor === 'top'
        ? anchorY
        : verticalAnchor === 'bottom'
          ? anchorY - labelHeight
          : anchorY - labelHeight / 2

    return { left, right, top, bottom: top + labelHeight }
  }

  function applyLabelPresentation(
    node: Node,
    mode: StencilArrangeMode,
    areaWidth: number,
  ) {
    const snapshot = getLabelSnapshot(node)
    if (snapshot.appliedMode && snapshot.appliedMode !== mode) {
      restoreLabelPresentation(node)
    }
    const { width: nodeWidth } = node.getSize()
    const fullText = (node.attr<string>('label/text') ?? '').replace(
      /\r\n/g,
      '\n',
    )
    const modulePriority = mode === 'module-priority'
    const { lineHeight, measureStyles } = getLabelTypography(
      node,
      modulePriority,
    )
    if (!fullText.trim()) {
      if (snapshot.appliedMode) restoreLabelPresentation(node)
      snapshot.appliedMode = mode
      snapshot.appliedWidth = undefined
      return { displayedText: '', labelWidth: 0, labelHeight: 0 }
    }

    const naturalLines = fullText.split('\n')
    const naturalWidth = Math.max(
      ...naturalLines.map((line) => Dom.measureText(line, measureStyles).width),
    )
    let labelWidth = naturalWidth + STENCIL_LABEL_LAYOUT_PADDING
    let textWrapWidth = Math.max(1, naturalWidth)
    let displayedText = fullText
    let needsStencilPresentation = modulePriority

    if (modulePriority) {
      const requestedWidth = getModuleLabelWidth(nodeWidth, areaWidth)
      displayedText = wrapModuleLabel(fullText, requestedWidth, measureStyles)
      const widestLine = Math.max(
        ...displayedText
          .split('\n')
          .map((line) => Dom.measureText(line, measureStyles).width),
      )
      labelWidth = Math.max(
        requestedWidth,
        widestLine + STENCIL_LABEL_LAYOUT_PADDING,
      )
      textWrapWidth = labelWidth
    } else if (labelWidth > areaWidth) {
      labelWidth = Math.max(1, areaWidth)
      textWrapWidth = Math.max(1, labelWidth - STENCIL_LABEL_LAYOUT_PADDING)
      displayedText = Dom.breakText(
        fullText,
        { width: textWrapWidth, height: Number.MAX_SAFE_INTEGER },
        measureStyles,
      )
      needsStencilPresentation = true
    }

    const labelHeight = displayedText.split('\n').length * lineHeight
    if (!needsStencilPresentation) {
      if (snapshot.appliedMode !== mode || snapshot.appliedWidth != null) {
        restoreLabelPresentation(node)
        if (snapshot.html) {
          node.attr('label/style', getViewHtmlLabelStyle(snapshot))
        }
      }
      snapshot.appliedMode = mode
      snapshot.appliedWidth = undefined
      return { displayedText, labelWidth, labelHeight }
    }

    if (snapshot.appliedMode === mode && snapshot.appliedWidth === labelWidth) {
      return { displayedText, labelWidth, labelHeight }
    }

    if (modulePriority) {
      if (snapshot.html) {
        node.attr('foreignObject/refY', '100%')
        node.attr('foreignObject/refY2', STENCIL_LABEL_NODE_GAP)
      } else {
        node.attr('label/refY', '100%')
        node.attr('label/refY2', STENCIL_LABEL_NODE_GAP)
        node.attr('label/textVerticalAnchor', 'top')
      }
    }

    if (snapshot.html) {
      node.attr('label/textWrap', snapshot.textWrap ?? null)
      node.attr('label/lineHeight', snapshot.lineHeight ?? null)
      node.attr('label/style', {
        ...getViewHtmlLabelStyle(snapshot),
        width: `${textWrapWidth}px`,
        maxWidth: `${textWrapWidth}px`,
        height: 'auto',
        lineHeight: `${lineHeight}px`,
        whiteSpace: modulePriority ? 'normal' : 'pre-wrap',
        overflowWrap: modulePriority ? 'normal' : 'anywhere',
        wordBreak: 'normal',
        ...(modulePriority
          ? {
              maxHeight: `${lineHeight * STENCIL_LABEL_MAX_LINES}px`,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: STENCIL_LABEL_MAX_LINES,
              textOverflow: 'ellipsis',
            }
          : {}),
      })
    } else {
      node.attr('label/style', snapshot.style ?? null)
      node.attr('label/lineHeight', `${lineHeight}px`)
      node.attr('label/textWrap', {
        text: displayedText,
        width: textWrapWidth,
        height: labelHeight,
      })
    }

    snapshot.appliedMode = mode
    snapshot.appliedWidth = labelWidth
    return { displayedText, labelWidth, labelHeight }
  }

  function createLayoutItem(
    node: Node,
    areaWidth: number,
    mode: StencilArrangeMode,
  ): StencilLayoutItem {
    const { width: nodeWidth, height: nodeHeight } = node.getSize()
    const { labelWidth, labelHeight } = applyLabelPresentation(
      node,
      mode,
      areaWidth,
    )
    if (!labelHeight) {
      return {
        node,
        nodeWidth,
        nodeHeight,
        width: nodeWidth,
        visualTop: 0,
        visualBottom: nodeHeight,
      }
    }

    const bounds = getLabelVisualBounds(node, labelWidth, labelHeight)
    const halfVisualWidth = Math.max(
      nodeWidth / 2 - Math.min(0, bounds.left),
      Math.max(nodeWidth, bounds.right) - nodeWidth / 2,
    )

    return {
      node,
      nodeWidth,
      nodeHeight,
      width: halfVisualWidth * 2,
      visualTop: Math.min(0, bounds.top),
      visualBottom: Math.max(nodeHeight, bounds.bottom),
    }
  }

  /**
   * @description 删去边距和滚动条占位后剩余的宽度，作为 greedy layout 的可用宽度
   * @param width 当前的 stencilWidth
   * @returns reLayout 可用宽度
   */
  function getLayoutAreaWidth(
    content: HTMLElement | undefined,
    width: number,
  ): number {
    const scrollbarWidth =
      content && content.scrollHeight > content.clientHeight
        ? Math.max(0, content.offsetWidth - content.clientWidth)
        : 0
    return Math.max(0, width - scrollbarWidth - 2 * STENCIL_SIDE_PADDING)
  }

  function applyDefaultLayout(model: Model, areaWidth: number) {
    const rows: Node[][] = []
    let currentRow: Node[] = []
    let currentWidth = 0

    for (const node of model.getNodes()) {
      const snapshot = getLabelSnapshot(node)
      if (snapshot.appliedMode) {
        restoreLabelPresentation(node)
        snapshot.appliedMode = undefined
        snapshot.appliedWidth = undefined
      }

      const { width } = node.getSize()
      const nextWidth = currentRow.length ? currentWidth + 60 + width : width

      if (nextWidth <= areaWidth) {
        currentRow.push(node)
        currentWidth = nextWidth
        continue
      }

      if (currentRow.length) rows.push(currentRow)
      currentRow = [node]
      currentWidth = width

      if (width > areaWidth) {
        console.error('[联系管理员兼容]Exist node exceeds min row width:', node)
      }
    }

    if (currentRow.length) rows.push(currentRow)

    let y = 30
    for (const row of rows) {
      const sizes = row.map((node) => node.getSize())
      const rowHeight = Math.max(...sizes.map((size) => size.height))
      const nodesWidth = sizes.reduce((sum, size) => sum + size.width, 0)
      const gap =
        (areaWidth - nodesWidth) / (row.length > 1 ? row.length + 1 : 2)
      let x = gap

      row.forEach((node, index) => {
        const { width, height } = sizes[index]
        node.position(x, y + (rowHeight - height) / 2)
        x += width + gap
      })
      y += rowHeight + 45
    }

    return {
      x: 0,
      y: 0,
      width: areaWidth,
      height: rows.length ? y - 45 : 0,
    }
  }

  /**
   * @description 贪心布局算法：从上到下逐行放置节点，当前行放不下时换行；每行节点水平居中分布
   * 旧方案：同一分组只计算一次列数与列宽，所有行复用固定列中心。
   * 当前按视觉宽度贪心分行，相同元素数量的行复用相同列中心。
   * @param model 当前 Lib 的所有节点
   * @param areaWidth 可用宽度
   */
  function applyGridLayout(model: Model, areaWidth: number) {
    const mode = useConfigStore.getState().stencilArrangeMode
    if (mode === 'default') return applyDefaultLayout(model, areaWidth)

    const items = model
      .getNodes()
      .map((node) => createLayoutItem(node, areaWidth, mode))
    if (!items.length) {
      return { x: 0, y: 0, width: areaWidth, height: 0 }
    }

    const rows: StencilLayoutItem[][] = []
    let currentRow: StencilLayoutItem[] = []
    let currentMaxWidth = 0

    for (const item of items) {
      const itemWidth = Math.max(STENCIL_LABEL_MIN_WIDTH, item.width)
      if (itemWidth > areaWidth) {
        console.error(
          '[联系管理员兼容]Exist node exceeds min row width:',
          item.node,
        )
      }
      const nextCount = currentRow.length + 1
      const nextCellWidth =
        (areaWidth - (nextCount - 1) * STENCIL_NODE_ROW_GAP) / nextCount
      const nextMaxWidth = Math.max(currentMaxWidth, itemWidth)
      if (!currentRow.length || nextMaxWidth <= nextCellWidth) {
        currentRow.push(item)
        currentMaxWidth = nextMaxWidth
        continue
      }

      rows.push(currentRow)
      currentRow = [item]
      currentMaxWidth = itemWidth
    }
    if (currentRow.length) rows.push(currentRow)
    rows.sort((left, right) => right.length - left.length)

    let y = STENCIL_NODE_ROW_GAP / 2
    for (const row of rows) {
      const cellWidth =
        (areaWidth - (row.length - 1) * STENCIL_NODE_ROW_GAP) / row.length
      const rowBodyHeight = Math.max(...row.map((item) => item.nodeHeight))
      const rowMin = Math.min(
        ...row.map((item) => {
          const bodyOffset = (rowBodyHeight - item.nodeHeight) / 2
          return bodyOffset + item.visualTop
        }),
      )
      const rowMax = Math.max(
        ...row.map((item) => {
          const bodyOffset = (rowBodyHeight - item.nodeHeight) / 2
          return bodyOffset + item.visualBottom
        }),
      )

      row.forEach((item, column) => {
        // group-content 已通过 CSS 提供左右 padding，Graph 内部坐标从内容区 0 开始。
        item.node.position(
          column * (cellWidth + STENCIL_NODE_ROW_GAP) +
            (cellWidth - item.nodeWidth) / 2,
          y + (rowBodyHeight - item.nodeHeight) / 2 - rowMin,
        )
      })
      y += rowMax - rowMin + STENCIL_NODE_COLUMN_GAP
    }

    return {
      x: 0,
      y: 0,
      width: areaWidth,
      height: rows.length ? y - STENCIL_NODE_COLUMN_GAP : 0,
    }
  }

  return {
    applyGridLayout,
    getLayoutAreaWidth,
    restoreLabelPresentation,
  }
}

export { createStencilLayoutService }
export type { StencilContentArea }
