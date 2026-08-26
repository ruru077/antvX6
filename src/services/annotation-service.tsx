import { Button, ColorPicker, Input, InputNumber } from 'antd'
import { createRoot } from 'react-dom/client'
import { AnnotationNode } from '@/assets/TestModel'
import type { Graph, Node } from '@antv/x6'

const activeSessions = new WeakMap<Graph, () => void>()

interface AnnotationValue {
  text: string
  fontSize: number
  color: string
}

function AnnotationEditor({
  initialValue,
  clientX,
  clientY,
  onConfirm,
  onCancel,
}: {
  initialValue: AnnotationValue
  clientX: number
  clientY: number
  onConfirm: (value: AnnotationValue) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(initialValue.text)
  const [fontSize, setFontSize] = useState(initialValue.fontSize)
  const [color, setColor] = useState(initialValue.color)
  const value = { text: text.trim(), fontSize, color }

  function confirm() {
    if (value.text) onConfirm(value)
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: Math.max(8, Math.min(clientX, window.innerWidth - 272)),
        top: Math.max(8, Math.min(clientY, window.innerHeight - 104)),
        zIndex: 10000,
        width: 264,
        padding: 8,
        border: '1px solid #bfbfbf',
        borderRadius: 4,
        background: '#ffffff',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.16)',
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 6,
        }}
      >
        <InputNumber
          size="small"
          min={8}
          max={72}
          value={fontSize}
          aria-label="字号"
          style={{ width: 64 }}
          onChange={(value) => setFontSize(Number(value ?? 14))}
        />
        <ColorPicker
          size="small"
          value={color}
          onChange={(value) => setColor(value.toHexString())}
        />
        <div style={{ flex: 1 }} />
        <Button size="small" onClick={onCancel}>
          取消
        </Button>
        <Button
          size="small"
          type="primary"
          disabled={!value.text}
          onClick={confirm}
        >
          确定
        </Button>
      </div>
      <Input
        size="small"
        value={text}
        autoFocus
        placeholder="输入注解"
        onChange={(event) => setText(event.target.value)}
        onPressEnter={confirm}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel()
        }}
      />
    </div>
  )
}

function getAnnotationSize(text: string, fontSize: number) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (context) context.font = `${fontSize}px Arial`
  const textWidth = context?.measureText(text).width ?? text.length * fontSize
  return {
    width: Math.max(40, Math.ceil(textWidth) + 16),
    height: Math.max(24, Math.ceil(fontSize * 1.5) + 8),
  }
}

function openAnnotationEditor(
  graph: Graph,
  clientX: number,
  clientY: number,
  initialValue: AnnotationValue,
  onConfirm: (value: AnnotationValue) => void,
) {
  activeSessions.get(graph)?.()

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  let destroyed = false

  function destroy() {
    if (destroyed) return
    destroyed = true
    if (activeSessions.get(graph) === destroy) activeSessions.delete(graph)
    requestAnimationFrame(() => {
      root.unmount()
      container.remove()
    })
  }

  root.render(
    <AnnotationEditor
      initialValue={initialValue}
      clientX={clientX}
      clientY={clientY}
      onCancel={destroy}
      onConfirm={(value) => {
        try {
          onConfirm(value)
        } finally {
          destroy()
        }
      }}
    />,
  )
  activeSessions.set(graph, destroy)
}

function startAnnotationPlacement(graph: Graph) {
  activeSessions.get(graph)?.()

  const previousCursor = graph.container.style.cursor
  graph.container.style.cursor = 'crosshair'
  let clickTimer: number | null = null
  let placementActive = true

  function cleanup() {
    if (!placementActive) return
    placementActive = false
    if (clickTimer !== null) window.clearTimeout(clickTimer)
    document.removeEventListener('click', clickHandler, true)
    document.removeEventListener('keydown', keyDownHandler, true)
    graph.container.style.cursor = previousCursor
    if (activeSessions.get(graph) === cleanup) activeSessions.delete(graph)
  }

  function clickHandler(event: MouseEvent) {
    const rect = graph.container.getBoundingClientRect()
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    if (!inside) {
      cleanup()
      return
    }

    event.preventDefault()
    event.stopPropagation()
    const point = graph.clientToLocal(event.clientX, event.clientY)
    cleanup()
    openAnnotationEditor(
      graph,
      event.clientX,
      event.clientY,
      { text: '', fontSize: 14, color: '#000000' },
      (value) => {
        const node = graph.createNode(structuredClone(AnnotationNode))
        node.attr({
          label: {
            text: value.text,
            fontSize: value.fontSize,
            fill: value.color,
          },
        })
        node.size(getAnnotationSize(value.text, value.fontSize))
        node.position(point.x, point.y)
        graph.addNode(node)
        graph.resetSelection([node])
      },
    )
  }

  function keyDownHandler(event: KeyboardEvent) {
    if (event.key === 'Escape') cleanup()
  }

  document.addEventListener('keydown', keyDownHandler, true)
  clickTimer = window.setTimeout(() => {
    clickTimer = null
    document.addEventListener('click', clickHandler, true)
  }, 0)
  activeSessions.set(graph, cleanup)
}

function editAnnotationNode(
  node: Node,
  graph: Graph,
  clientX: number,
  clientY: number,
) {
  if (node.getData()?.blockType !== 'Annotation') return

  openAnnotationEditor(
    graph,
    clientX,
    clientY,
    {
      text: node.attr<string>('label/text') ?? '',
      fontSize: node.attr<number>('label/fontSize') ?? 14,
      color: node.attr<string>('label/fill') ?? '#000000',
    },
    (value) => {
      graph.startBatch('edit-annotation')
      try {
        node.attr({
          label: {
            text: value.text,
            fontSize: value.fontSize,
            fill: value.color,
          },
        })
        node.size(getAnnotationSize(value.text, value.fontSize))
      } finally {
        graph.stopBatch('edit-annotation')
      }
      graph.resetSelection([node])
    },
  )
}

function cancelAnnotationPlacement(graph: Graph) {
  activeSessions.get(graph)?.()
}

export {
  cancelAnnotationPlacement,
  editAnnotationNode,
  startAnnotationPlacement,
}
