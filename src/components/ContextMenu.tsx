import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  MergeCellsOutlined,
  ScissorOutlined,
  SnippetsOutlined,
} from '@ant-design/icons'
import { Dropdown, message } from 'antd'
import { CircleDashed } from 'lucide-react'
import { useGraphStore } from '@/store/graphStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import type { Cell, Edge, EventArgs, Graph, Node } from '@antv/x6'
import type { MenuProps } from 'antd'
type ContextInfo =
  | { type: 'blank' }
  | { type: 'toolbar' }
  | { type: 'node'; cell: Cell }
  | { type: 'edge'; cell: Cell }

/**
 * 画布右键菜单。
 *
 * Dropdown 包裹 paper-container（非 paper div），X6 Scroller 不会移动它。
 * 手动控制 open 并补充 mousedown 关闭 + scroller 滚动关闭，
 * 弥补 trigger=['contextMenu'] 在自定义滚动容器中的不足。
 */
function ContextMenu({
  children,
  toolbarsVisible,
  onToggleToolbars,
}: {
  children: React.ReactNode
  toolbarsVisible?: boolean
  onToggleToolbars?: () => void
}) {
  const graph = useGraphStore((s) => s.graph)
  const ctxRef = useRef<ContextInfo>({ type: 'blank' })
  const [, forceUpdate] = useState(0)
  const [open, setOpen] = useState(false)

  // X6 事件 → 更新菜单上下文
  useEffect(() => {
    if (!graph) return

    function onBlank() {
      ctxRef.current = { type: 'blank' }
      forceUpdate((n) => n + 1)
    }
    function onCell(args: EventArgs['cell:contextmenu']) {
      ctxRef.current = {
        type: args.cell.isNode() ? 'node' : 'edge',
        cell: args.cell,
      }
      forceUpdate((n) => n + 1)
    }

    graph.on('blank:contextmenu', onBlank)
    graph.on('cell:contextmenu', onCell)
    return () => {
      graph.off('blank:contextmenu', onBlank)
      graph.off('cell:contextmenu', onCell)
    }
  }, [graph])

  // 捕获阶段检测右键落点：悬浮工具栏上的右键 → toolbar 菜单
  useEffect(() => {
    function onContextMenu(e: MouseEvent) {
      if ((e.target as HTMLElement)?.closest?.('.canvas-float-toolbar')) {
        ctxRef.current = { type: 'toolbar' }
        forceUpdate((n) => n + 1)
      }
    }
    document.addEventListener('contextmenu', onContextMenu, true)
    return () =>
      document.removeEventListener('contextmenu', onContextMenu, true)
  }, [])

  // 补充关闭行为：mousedown（不等 mouseup） + scroller 滚动
  useEffect(() => {
    if (!graph) return

    function onMouseDown(e: MouseEvent) {
      if (e.button === 2) return // 右键交给 contextmenu
      if (
        document
          .querySelector('.ant-dropdown')
          ?.contains(e.target as HTMLElement)
      )
        return
      setOpen(false)
    }

    function onScrollerScroll() {
      setOpen(false)
    }

    document.addEventListener('mousedown', onMouseDown, true)

    // scroller 由 X6 异步创建，轮询一次
    const timer = setInterval(() => {
      const el = graph.container?.closest?.(
        '.x6-graph-scroller',
      ) as HTMLElement | null
      if (el) {
        clearInterval(timer)
        el.addEventListener('scroll', onScrollerScroll, { passive: true })
      }
    }, 100)

    return () => {
      document.removeEventListener('mousedown', onMouseDown, true)
      clearInterval(timer)
      const el = graph.container?.closest?.(
        '.x6-graph-scroller',
      ) as HTMLElement | null
      el?.removeEventListener('scroll', onScrollerScroll)
    }
  }, [graph])

  const ctx = ctxRef.current
  const items =
    ctx.type === 'blank'
      ? buildBlankMenu(graph)
      : ctx.type === 'toolbar'
        ? buildToolbarMenu(toolbarsVisible, onToggleToolbars)
        : ctx.type === 'node'
          ? buildNodeMenu(graph, ctx.cell! as Node)
          : buildEdgeMenu(graph, ctx.cell! as Edge)

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={['contextMenu']}
      menu={{ items }}
    >
      {children}
    </Dropdown>
  )
}

// ── 空白区域右键菜单 ──────────────────────────────────────────────────────

function buildBlankMenu(graph: Graph | null): MenuProps['items'] {
  return [
    {
      key: 'paste',
      icon: <SnippetsOutlined />,
      label: '粘贴',
      disabled: graph?.isClipboardEmpty() ?? true,
      onClick() {
        if (graph?.isClipboardEmpty()) return
        graph?.paste({ offset: 30 })
        message.success('粘贴成功')
      },
    },
    {
      key: 'fit-content',
      icon: <EditOutlined />,
      label: '适应内容',
      onClick() {
        graph?.zoomToFit({ padding: 20 })
      },
    },
  ]
}

// ── 悬浮工具栏右键菜单 ──────────────────────────────────────────────────

function buildToolbarMenu(
  toolbarsVisible?: boolean,
  onToggle?: () => void,
): MenuProps['items'] {
  if (!onToggle) return []
  return [
    {
      key: 'toggle-toolbars',
      icon: toolbarsVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />,
      label: toolbarsVisible ? '隐藏悬浮工具' : '显示悬浮工具',
      onClick: onToggle,
    },
  ]
}

// ── Node 右键菜单 ─────────────────────────────────────────────────────────

function buildNodeMenu(graph: Graph | null, node: Node): MenuProps['items'] {
  const isSubsystem = node.getData()?.blockType === 'Subsystem'
  const items: Exclude<MenuProps['items'], undefined> = []

  items.push(
    {
      key: 'copy',
      icon: <CopyOutlined />,
      label: '复制',
      onClick() {
        graph?.copy([node])
        message.success('已复制')
      },
    },
    {
      key: 'cut',
      icon: <ScissorOutlined />,
      label: '剪切',
      onClick() {
        graph?.cut([node])
        message.success('已剪切')
      },
    },
  )

  if (isSubsystem) {
    items.push(
      { type: 'divider' },
      {
        key: 'enter-subsystem',
        icon: <MergeCellsOutlined />,
        label: '进入子系统',
        onClick() {
          useSubGraphStore.getState().changeGraphView(node.id)
        },
      },
    )
    items.push(
      { type: 'divider' },
      {
        key: 'add-mask',
        icon: <CircleDashed size={14} />,
        label: '增加系统封装',
        onClick() {
          useSubGraphStore.getState().addMaskToSubsystem(node)
        },
      },
    )
  }

  items.push(
    { type: 'divider' },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      danger: true,
      label: '删除',
      onClick() {
        graph?.removeCell(node)
      },
    },
  )

  return items
}

// ── Edge 右键菜单 ─────────────────────────────────────────────────────────

function buildEdgeMenu(graph: Graph | null, edge: Edge): MenuProps['items'] {
  return [
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      danger: true,
      label: '删除连线',
      onClick() {
        graph?.removeCell(edge)
      },
    },
  ]
}

export { ContextMenu }
