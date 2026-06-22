import {
  Copy,
  Eye,
  EyeOff,
  GitMerge,
  Scissors,
  Trash2,
  ZoomIn,
  CircleDashed,
} from 'lucide-react'
import {
  ContextMenu as ContextMenu_,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { useGraphStore } from '@/store/graphStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import type { Cell, Edge, EventArgs, Graph, Node } from '@antv/x6'

type ContextInfo =
  | { type: 'blank' }
  | { type: 'toolbar' }
  | { type: 'node'; cell: Cell }
  | { type: 'edge'; cell: Cell }

/**
 * 画布右键菜单（shadcn/Radix 实现）。
 *
 * useContextMenu hook 负责桥接 X6 右键事件到 paper-container（trigger），
 * 本组件根据右键目标类型分发不同的菜单内容。
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
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0)
  const [open, setOpen] = useState(false)

  // ── 菜单打开时拦截滚轮，防止画布缩放/平移（键盘已由 modal=false 原生拦截）──
  useEffect(() => {
    if (!open) return
    function onWheel(e: WheelEvent) {
      const target = e.target instanceof Element ? e.target : null
      const insideMenu = target?.closest('[data-slot="context-menu-content"]')
      if (!target) return
      // 菜单内容内的滚轮放行
      if (insideMenu) return
      e.preventDefault()
    }

    document.addEventListener('wheel', onWheel, {
      passive: false,
      capture: true,
    })
    return () => {
      console.log('[ContextMenu] 滚轮拦截已注销')
      document.removeEventListener('wheel', onWheel, { capture: true })
    }
  }, [open])

  // ── X6 事件 → 更新菜单上下文 ─────────────────────────────────────────
  useEffect(() => {
    if (!graph) return

    function onBlank() {
      ctxRef.current = { type: 'blank' }
      forceUpdate()
    }
    function onCell(args: EventArgs['cell:contextmenu']) {
      const isNode = args.cell.isNode()
      ctxRef.current = {
        type: isNode ? 'node' : 'edge',
        cell: args.cell,
      }
      forceUpdate()
    }

    graph.on('blank:contextmenu', onBlank)
    graph.on('cell:contextmenu', onCell)
    return () => {
      graph.off('blank:contextmenu', onBlank)
      graph.off('cell:contextmenu', onCell)
    }
  }, [graph])

  // ── 捕获阶段检测工具栏右键 ──────────────────────────────────────────
  useEffect(() => {
    function onContextMenu(e: MouseEvent) {
      if ((e.target as HTMLElement)?.closest?.('.canvas-float-toolbar')) {
        ctxRef.current = { type: 'toolbar' }
        forceUpdate()
      }
    }
    document.addEventListener('contextmenu', onContextMenu, true)
    return () =>
      document.removeEventListener('contextmenu', onContextMenu, true)
  }, [])

  const ctx = ctxRef.current

  return (
    <ContextMenu_
      modal={false}
      onOpenChange={(o) => {
        setOpen(o)
      }}
    >
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {ctx.type === 'blank' ? (
          <BlankMenu graph={graph} />
        ) : ctx.type === 'toolbar' ? (
          <ToolbarMenu visible={toolbarsVisible} onToggle={onToggleToolbars} />
        ) : ctx.type === 'node' ? (
          <NodeMenu graph={graph} node={ctx.cell as Node} />
        ) : (
          <EdgeMenu graph={graph} edge={ctx.cell as Edge} />
        )}
      </ContextMenuContent>
    </ContextMenu_>
  )
}

// ── 空白区域 ─────────────────────────────────────────────────────────────

function BlankMenu({ graph }: { graph: Graph | null }) {
  return (
    <ContextMenuGroup>
      <ContextMenuItem
        disabled={graph?.isClipboardEmpty() ?? true}
        onClick={() => {
          if (graph?.isClipboardEmpty()) return
          graph?.paste({ offset: 30 })
        }}
      >
        <Copy className="mr-2 size-4" />
        粘贴
        <ContextMenuShortcut>⌘V</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onClick={() => graph?.zoomToFit({ padding: 20 })}>
        <ZoomIn className="mr-2 size-4" />
        适应内容
      </ContextMenuItem>
    </ContextMenuGroup>
  )
}

// ── 悬浮工具栏 ──────────────────────────────────────────────────────────

function ToolbarMenu({
  visible,
  onToggle,
}: {
  visible?: boolean
  onToggle?: () => void
}) {
  if (!onToggle) return null
  return (
    <ContextMenuGroup>
      <ContextMenuItem onClick={onToggle}>
        {visible ? (
          <EyeOff className="mr-2 size-4" />
        ) : (
          <Eye className="mr-2 size-4" />
        )}
        {visible ? '隐藏悬浮工具' : '显示悬浮工具'}
      </ContextMenuItem>
    </ContextMenuGroup>
  )
}

// ── Node ────────────────────────────────────────────────────────────────

function NodeMenu({ graph, node }: { graph: Graph | null; node: Node }) {
  const isSubsystem = node.getData()?.blockType === 'Subsystem'
  console.log(isSubsystem)
  return (
    <>
      <ContextMenuGroup>
        <ContextMenuItem
          onClick={() => {
            graph?.copy([node])
          }}
        >
          <Copy className="mr-2 size-4" />
          复制
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            graph?.cut([node])
          }}
        >
          <Scissors className="mr-2 size-4" />
          剪切
          <ContextMenuShortcut>⌘X</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuGroup>
      {isSubsystem && (
        <>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuItem
              onClick={() => {
                useSubGraphStore.getState().changeGraphView(node.id)
              }}
            >
              <GitMerge className="mr-2 size-4" />
              进入子系统
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuItem
              onClick={() => {
                useSubGraphStore.getState().addMaskToSubsystem(node)
              }}
            >
              <CircleDashed className="mr-2 size-4" />
              增加系统封装
            </ContextMenuItem>
          </ContextMenuGroup>
        </>
      )}
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuItem
          variant="destructive"
          onClick={() => {
            graph?.removeCell(node)
          }}
        >
          <Trash2 className="mr-2 size-4" />
          删除
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuGroup>
    </>
  )
}

// ── Edge ────────────────────────────────────────────────────────────────

function EdgeMenu({ graph, edge }: { graph: Graph | null; edge: Cell }) {
  return (
    <ContextMenuGroup>
      <ContextMenuItem
        variant="destructive"
        onClick={() => {
          graph?.removeCell(edge)
        }}
      >
        <Trash2 className="mr-2 size-4" />
        删除连线
      </ContextMenuItem>
    </ContextMenuGroup>
  )
}

export { ContextMenu }
