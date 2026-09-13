import { Dom, Graph, ToolItem } from '@antv/x6'
import { getTextBlockMarkup } from '@antv/x6/es/shape/text-block'
import type { Edge, EdgeView } from '@antv/x6'
import type { ToolItemOptions } from '@antv/x6/lib/view/tool/tool-item'

const EDGE_LABEL_MARKUP = getTextBlockMarkup(true)

interface EdgeEditToolOptions extends ToolItemOptions {
  labelIndex?: number
  gap?: number
  backgroundColor?: string
  text?: string
}

type EdgeViewWithLabels = EdgeView & {
  labelCache?: Record<number, SVGElement>
}
/**
 * @description 自定义边工具：编辑 edge label 文本内容
 * 1. 无 label 时保持隐藏，双击 edge 后创建 label 并进入编辑
 * 2. 编辑器失焦时保存文本内容，恢复原始 label 显示
 * 3. 按下 Enter 键时保存文本内容并失焦，按下 Shift + Enter 键时换行
 * 4. 编辑器内容为空时，失焦后自动移除 label
 * 5. 编辑器位置随 edge label 的位置变化而变化
 * @author codex
 */
class EdgeEditTool extends ToolItem<EdgeView, EdgeEditToolOptions> {
  static defaults: EdgeEditToolOptions = {
    ...ToolItem.getDefaults<EdgeEditToolOptions>(),
    name: 'edge-edit',
    tagName: 'div',
    isSVGElement: false,
    labelIndex: 0,
    gap: 6,
    backgroundColor: 'transparent',
    text: '',
    events: {
      mousedown: 'onMouseDown',
      touchstart: 'onMouseDown',
      input: 'onInput',
      focus: 'onFocus',
      blur: 'onBlur',
      keydown: 'onKeyDown',
    },
  }

  private updateFrame: number | null = null
  private graphScale = () => this.scheduleUpdate()
  private cellDblClick = ({ e }: { e: Dom.DoubleClickEvent }) => {
    e.stopPropagation()
    const label = this.getLabel() ?? this.createLabel()
    const text = label.attrs?.label?.text
    this.container.textContent = typeof text === 'string' ? text : ''
    this.show()
    this.scheduleUpdate()
    requestAnimationFrame(() => (this.container as HTMLDivElement).focus())
  }
  protected init() {
    const editor = this.container as HTMLDivElement
    editor.contentEditable = 'plaintext-only'
    Object.assign(editor.style, {
      position: 'absolute',
      display: 'inline-block',
      minWidth: '20px',
      minHeight: '1em',
      padding: '1px 3px',
      lineHeight: '1.2',
      whiteSpace: 'pre',
      textAlign: 'center',
      outline: 'none',
      transformOrigin: '0 0',
      cursor: 'text',
      color: '#333',
      backgroundColor: this.options.backgroundColor ?? 'transparent',
    })
  }

  protected onRender() {
    this.cellView.on('cell:dblclick', this.cellDblClick)
    this.graph.on('scale', this.graphScale)
    const label = this.getLabel()
    if (!label) {
      this.hide()
      return
    }

    const text = label?.attrs?.label?.text
    if (text === '') {
      ;(this.cell as Edge).removeLabelAt(this.options.labelIndex ?? 0, {
        undo: false,
      })
      this.hide()
      return
    }

    this.container.textContent = typeof text === 'string' ? text : ''
    this.scheduleUpdate()
  }

  update() {
    const edge = this.cell as Edge
    const labelIndex = this.options.labelIndex ?? 0
    const label = edge.getLabels()[labelIndex]
    if (!label) {
      this.hide()
      return this
    }

    this.show()
    this.hideOriginalLabel()

    const labelPosition = label.position
    const distance =
      typeof labelPosition === 'number'
        ? labelPosition
        : (labelPosition?.distance ?? 0.5)
    const pathLength = this.cellView.path.length()
    const distanceFromSource =
      distance > 0 && distance <= 1 ? pathLength * distance : distance
    const tangent = this.cellView.path.tangentAtLength(distanceFromSource)
    if (!tangent) return this

    const tangentLength = tangent.length()
    if (tangentLength === 0) return this

    const editor = this.container as HTMLDivElement
    const scale = this.graph.scale()
    const rect = editor.getBoundingClientRect()
    const width = Math.max(rect.width / Math.abs(scale.sx), 20)
    const height = Math.max(rect.height / Math.abs(scale.sy), 18)
    const normalX = -(tangent.end.y - tangent.start.y) / tangentLength
    const normalY = (tangent.end.x - tangent.start.x) / tangentLength
    const gap = this.options.gap ?? 6
    const offset =
      (Math.abs(normalX) * width) / 2 + (Math.abs(normalY) * height) / 2 + gap

    const position = this.graph.localToGraph({
      x: tangent.start.x + normalX * offset,
      y: tangent.start.y + normalY * offset,
    })
    editor.style.left = `${position.x}px`
    editor.style.top = `${position.y}px`
    editor.style.transform = `scale(${scale.sx}, ${scale.sy}) translate(-50%, -50%)`

    return this
  }

  /**
   * Arrowhead 等兄弟 Tool 获得焦点时，X6 会隐藏其余 Tool。
   * Edge label 是常驻内容，拖线预览期间也必须继续显示并跟随路径更新。
   */
  hide() {
    if (this.getLabel()) return this
    return super.hide()
  }

  protected onMouseDown(event: MouseEvent) {
    event.stopPropagation()
  }

  protected onInput() {
    this.update()
  }

  protected onFocus() {
    this.container.style.outline = '2px solid #20cde3'
    this.focus()
  }

  protected onBlur() {
    this.container.style.outline = 'none'
    this.saveText()
    this.blur()
    // 失焦后清除浏览器文本选区，避免 Label 保留蓝色选中高亮。
    window.getSelection()?.removeAllRanges()
  }

  protected onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Enter') return
    if (event.shiftKey) return
    event.preventDefault()
    ;(this.container as HTMLDivElement).blur()
  }

  protected onRemove() {
    this.cellView.off('cell:dblclick', this.cellDblClick)
    this.graph.off('scale', this.graphScale)
    if (this.updateFrame != null) {
      cancelAnimationFrame(this.updateFrame)
      this.updateFrame = null
    }
    this.saveText(false)
    this.restoreOriginalLabel()
  }

  private scheduleUpdate() {
    if (this.updateFrame != null) cancelAnimationFrame(this.updateFrame)
    this.updateFrame = requestAnimationFrame(() => {
      this.updateFrame = null
      this.update()
    })
  }

  private getLabel() {
    const edge = this.cell as Edge
    const labelIndex = this.options.labelIndex ?? 0
    return edge.getLabels()[labelIndex]
  }

  private createLabel() {
    const edge = this.cell as Edge
    edge.appendLabel({
      markup: EDGE_LABEL_MARKUP,
      size: { width: 160, height: 24 },
      position: { distance: 0.5, offset: 0 },
      attrs: {
        foreignObject: {
          refWidth: '100%',
          refHeight: '100%',
          style: { overflow: 'visible', display: 'block' },
          x: -80,
          y: -12,
        },
        label: {
          text: this.options.text ?? '',
        },
      },
    })

    return edge.getLabels()[this.options.labelIndex ?? 0]
  }

  private saveText(updateAfterSave = true) {
    const edge = this.cell as Edge
    const labelIndex = this.options.labelIndex ?? 0
    const label = edge.getLabels()[labelIndex]
    if (!label) return

    const text = (this.container as HTMLDivElement).innerText.replace(/\n$/, '')
    if (text === '') {
      edge.removeLabelAt(labelIndex)
      this.hide()
      return
    }
    if (label.attrs?.label?.text === text) return

    edge.prop(`labels/${labelIndex}/attrs/label/text`, text)
    if (updateAfterSave) this.scheduleUpdate()
  }

  private hideOriginalLabel() {
    const labelIndex = this.options.labelIndex ?? 0
    const view = this.cellView as EdgeViewWithLabels
    const label = view.labelCache?.[labelIndex]
    if (label) label.style.visibility = 'hidden'
  }

  private restoreOriginalLabel() {
    const labelIndex = this.options.labelIndex ?? 0
    const view = this.cellView as EdgeViewWithLabels
    const label = view.labelCache?.[labelIndex]
    if (label) label.style.visibility = ''
  }
}

function registerEdgeEditTool() {
  Graph.registerEdgeTool('edge-edit', EdgeEditTool, true)
}

function addEdgeEditTool(edge: Edge, text = '') {
  if (edge.hasTool('edge-edit')) return
  edge.addTools([{ name: 'edge-edit', args: { text } }], { undo: false })
}

export { EdgeEditTool, addEdgeEditTool, registerEdgeEditTool }
