import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  MergeCellsOutlined,
  ScissorOutlined,
  SnippetsOutlined,
} from '@ant-design/icons'
import { Dropdown, message } from 'antd'
import { useEffect, useState } from 'react'
import { useGraphStore } from '@/store/graphStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import type { Cell, EventArgs, Graph } from '@antv/x6'
import type { MenuProps } from 'antd'

type ContextInfo =
  | { type: 'blank' }
  | { type: 'node'; cell: Cell }
  | { type: 'edge'; cell: Cell }

/**
 * 画布右键菜单组件，根据右键目标（空白/Node/Edge）展示不同菜单项。
 * 包裹 paper-container 即可生效。
 */
function CanvasContextMenu({ children }: { children: React.ReactNode }) {
  const graph = useGraphStore((s) => s.graph)
  const [menuCtx, setMenuCtx] = useState<ContextInfo & { _key: number }>({
    type: 'blank',
    _key: 0,
  })

  // 订阅 X6 右键事件，更新菜单上下文
  useEffect(() => {
    if (!graph) return

    const onBlank = (args: EventArgs['blank:contextmenu']) => {
      args.e.preventDefault()
      setMenuCtx({ type: 'blank', _key: Date.now() })
    }
    const onCell = (args: EventArgs['cell:contextmenu']) => {
      args.e.preventDefault()
      setMenuCtx({
        type: args.cell.isNode() ? 'node' : 'edge',
        cell: args.cell,
        _key: Date.now(),
      })
    }

    graph.on('blank:contextmenu', onBlank)
    graph.on('cell:contextmenu', onCell)

    return () => {
      graph.off('blank:contextmenu', onBlank)
      graph.off('cell:contextmenu', onCell)
    }
  }, [graph])

  const menu: MenuProps =
    menuCtx.type === 'blank'
      ? { items: buildBlankMenu(graph) }
      : menuCtx.type === 'node'
        ? { items: buildNodeMenu(graph, menuCtx.cell!) }
        : { items: buildEdgeMenu(graph, menuCtx.cell!) }

  return (
    <Dropdown trigger={['contextMenu']} menu={menu}>
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

// ── Node 右键菜单 ─────────────────────────────────────────────────────────

function buildNodeMenu(graph: Graph | null, cell: Cell): MenuProps['items'] {
  const node = cell
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

function buildEdgeMenu(graph: Graph | null, cell: Cell): MenuProps['items'] {
  return [
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      danger: true,
      label: '删除连线',
      onClick() {
        graph?.removeCell(cell)
      },
    },
  ]
}

export { CanvasContextMenu }
