import {
  CopyOutlined,
  DeleteOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  ExportOutlined,
  FullscreenOutlined,
  RedoOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  ScissorOutlined,
  SnippetsOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import { Dropdown } from 'antd'
import { flushSync } from 'react-dom'
import {
  createContextMenuService,
  selectContextNode,
  type ContextMenuService,
} from '@/services/contextMenu-servicer'
import { useGraphStore } from '@/store/graphStore'
import type { Cell, EventArgs } from '@antv/x6'
import type { MenuProps } from 'antd'

type ContextInfo =
  | { type: 'blank' }
  | {
      type: 'node'
      cell: Cell
      isSubsystem: boolean
      isLabelHidden: boolean
      imageMode?: 'snapshot' | 'custom'
    }
  | { type: 'edge'; cell: Cell }

function getBlankMenuItems(service: ContextMenuService): MenuProps['items'] {
  return [
    {
      key: 'paste',
      icon: <SnippetsOutlined />,
      label: '粘贴',
      disabled: !service.canPaste,
    },
    {
      key: 'select-all',
      icon: <FullscreenOutlined />,
      label: '全选',
    },
    { type: 'divider' },
    {
      key: 'undo',
      icon: <UndoOutlined />,
      label: '撤销',
      disabled: !service.canUndo,
    },
    {
      key: 'redo',
      icon: <RedoOutlined />,
      label: '重做',
      disabled: !service.canRedo,
    },
  ]
}

function getNodeMenuItems(
  isSubsystem: boolean,
  isLabelHidden: boolean,
  service: ContextMenuService,
): MenuProps['items'] {
  return [
    {
      key: 'cut',
      icon: <ScissorOutlined />,
      label: '剪切',
    },
    {
      key: 'copy',
      icon: <CopyOutlined />,
      label: '复制',
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除',
      danger: true,
    },
    ...(isSubsystem
      ? [
          {
            key: 'open-in-new-tab',
            icon: <ExportOutlined />,
            label: '在新选项卡打开',
          },
        ]
      : []),
    { type: 'divider' },
    {
      key: 'rotate-clockwise',
      icon: <RotateRightOutlined />,
      label: '顺时针旋转',
    },
    {
      key: 'rotate-counterclockwise',
      icon: <RotateLeftOutlined />,
      label: '逆时针旋转',
    },
    {
      key: 'toggle-label',
      icon: isLabelHidden ? <EyeOutlined /> : <EyeInvisibleOutlined />,
      label: isLabelHidden ? '显示标签' : '隐藏标签',
    },
    { type: 'divider' },
    {
      key: 'parameters',
      label: '参数',
    },
    ...(isSubsystem
      ? [
          {
            key: 'mask',
            label: '封装',
            children: [
              { key: 'mask-create', label: '创建封装' },
              { key: 'mask-open', label: '查看封装内部' },
              { key: 'mask-parameters', label: '封装参数' },
              { key: 'mask-add-image', label: '添加图像' },
              {
                key: 'mask-remove-image',
                label: '删除图像',
                disabled: !service.canRemoveSubsystemImage,
              },
            ],
          },
        ]
      : []),
  ]
}

const edgeMenuItems: MenuProps['items'] = [
  {
    key: 'cut',
    icon: <ScissorOutlined />,
    label: '剪切',
  },
  {
    key: 'copy',
    icon: <CopyOutlined />,
    label: '复制',
  },
  {
    key: 'delete',
    icon: <DeleteOutlined />,
    label: '删除',
    danger: true,
  },
]

function runMenuAction(key: string, service: ContextMenuService) {
  const actions: Partial<Record<string, () => void>> = {
    paste: service.paste,
    'select-all': service.selectAll,
    undo: service.undo,
    redo: service.redo,
    cut: service.cut,
    copy: service.copy,
    delete: service.remove,
    'open-in-new-tab': service.openSubsystemInTab,
    'rotate-clockwise': service.rotateClockwise,
    'rotate-counterclockwise': service.rotateCounterclockwise,
    parameters: service.openNodeParameters,
    'mask-create': service.createSubsystemMask,
    'mask-open': service.openSubsystem,
    'mask-parameters': service.openNodeParameters,
    'mask-add-image': service.addSubsystemImage,
    'mask-remove-image': service.removeSubsystemImage,
  }

  actions[key]?.()
}

/**
 * 画布简易右键菜单（Ant Design 实现）。
 * 普通画布操作复用现有 ContextMenuService；子系统封装菜单暂只提供 UI。
 */
function ContextMenuAntd({
  children,
  enabled = true,
}: {
  children: React.ReactNode
  enabled?: boolean
}) {
  const graph = useGraphStore((state) => state.graph)
  const [contextInfo, setContextInfo] = useState<ContextInfo>({ type: 'blank' })

  useEffect(() => {
    if (!graph || !enabled) return
    const paper = graph.container.closest<HTMLElement>('.paper-container')
    if (!paper) return

    function openMenu(event: { clientX: number; clientY: number }) {
      paper?.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: event.clientX,
          clientY: event.clientY,
        }),
      )
    }

    function onBlank(args: EventArgs['blank:contextmenu']) {
      flushSync(() => setContextInfo({ type: 'blank' }))
      openMenu(args.e)
    }

    function onCell({ cell, e }: EventArgs['cell:contextmenu']) {
      if (cell.isNode()) {
        selectContextNode(graph, cell)
        flushSync(() => {
          setContextInfo({
            type: 'node',
            cell,
            isSubsystem: cell.getData()?.blockType === 'Subsystem',
            isLabelHidden: cell.attr<string>('label/style/display') === 'none',
            imageMode: cell.getData()?.imageMode,
          })
        })
        openMenu(e)
        return
      }

      flushSync(() => setContextInfo({ type: 'edge', cell }))
      openMenu(e)
    }

    graph.on('blank:contextmenu', onBlank)
    graph.on('cell:contextmenu', onCell)

    return () => {
      graph.off('blank:contextmenu', onBlank)
      graph.off('cell:contextmenu', onCell)
    }
  }, [enabled, graph])

  const service = createContextMenuService(
    graph,
    contextInfo.type === 'blank' ? undefined : contextInfo.cell,
    contextInfo.type === 'node' ? contextInfo.imageMode : undefined,
  )
  const items =
    contextInfo.type === 'blank'
      ? getBlankMenuItems(service)
      : contextInfo.type === 'node'
        ? getNodeMenuItems(
            contextInfo.isSubsystem,
            contextInfo.isLabelHidden,
            service,
          )
        : edgeMenuItems

  return (
    <Dropdown
      disabled={!enabled}
      destroyOnHidden
      menu={{
        items,
        onClick: ({ key }) => {
          if (key === 'toggle-label' && contextInfo.type === 'node') {
            service.toggleLabelVisibility()
            setContextInfo({
              ...contextInfo,
              isLabelHidden: !contextInfo.isLabelHidden,
            })
            return
          }
          runMenuAction(key, service)
        },
      }}
      trigger={['contextMenu']}
    >
      {children}
    </Dropdown>
  )
}

export { ContextMenuAntd }
