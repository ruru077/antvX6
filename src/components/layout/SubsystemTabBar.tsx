import { EditOutlined } from '@ant-design/icons'
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
} from '@dnd-kit/core'
import {
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button, Dropdown, Input, Tabs, Tag, Tooltip, Typography } from 'antd'
import { ArrowBigLeft, ArrowBigRight, ArrowBigUp } from 'lucide-react'
import { cloneElement, type CSSProperties, type ReactElement } from 'react'
import { useShallow } from 'zustand/shallow'
import { VirtualKeyboard } from '@/components/VirtualKeyboard'
import { useSubGraphStore } from '@/store/subGraphStore'
import { useSubSystemTabStore } from '@/store/subSystemTabStore'
import type { DragEndEvent } from '@dnd-kit/core'
import type { TabsProps } from 'antd'
import '@styles/SubsystemTabBar.scss'

interface DraggableTabPaneProps extends React.HTMLAttributes<HTMLDivElement> {
  'data-node-key': string
  canClose: boolean
  onClose: (key: string) => void
  onCloseOthers: (key: string) => void
}

function DraggableTabNode({
  className,
  canClose,
  onClose,
  onCloseOthers,
  ...props
}: Readonly<DraggableTabPaneProps>) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: props['data-node-key'] })

  const style: CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    cursor: 'move',
  }

  const tabNode = cloneElement(
    props.children as ReactElement,
    {
      ref: setNodeRef,
      style,
      ...attributes,
      ...listeners,
    } as Record<string, unknown>,
  )

  return (
    <Dropdown
      trigger={['contextMenu']}
      menu={{
        items: [
          { key: 'close', label: '关闭选项卡', disabled: !canClose },
          {
            key: 'close-others',
            label: '关闭其他选项卡',
            disabled: !canClose,
          },
        ],
        onClick: ({ key }) => {
          if (key === 'close') onClose(props['data-node-key'])
          if (key === 'close-others') onCloseOthers(props['data-node-key'])
        },
      }}
    >
      {tabNode}
    </Dropdown>
  )
}

function SubsystemTabBar() {
  const { tabs, activeKey } = useSubSystemTabStore(
    useShallow((s) => ({
      tabs: s.tabs,
      activeKey: s.activeKey,
    })),
  )
  const { rootId, subGraphsData, modelName, isDirty } = useSubGraphStore(
    useShallow((s) => ({
      rootId: s.rootId,
      subGraphsData: s.subGraphs,
      modelName: s.modelName,
      isDirty: s.isDirty,
    })),
  )
  const renameModel = useSubGraphStore((s) => s.renameModel)
  const goBack = useSubSystemTabStore((s) => s.goBack)
  const goForward = useSubSystemTabStore((s) => s.goForward)
  const goUp = useSubSystemTabStore((s) => s.goUp)
  const setActiveTab = useSubSystemTabStore((s) => s.setActiveTab)
  const closeTab = useSubSystemTabStore((s) => s.closeTab)
  const closeOtherTabs = useSubSystemTabStore((s) => s.closeOtherTabs)
  const reorderTabs = useSubSystemTabStore((s) => s.reorderTabs)

  const sensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 10 },
  })
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  // 根据当前字体测量项目名编辑框宽度。
  function measureTextWidth(text: string) {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return 0

    context.font = `15px ${getComputedStyle(document.body).fontFamily}`
    return context.measureText(text || ' ').width
  }

  const editInputWidth = editing
    ? Math.max(Math.ceil(measureTextWidth(editValue) + 20), 48)
    : 120

  // 开始编辑模型名称。
  function startEdit() {
    setEditValue(modelName)
    setEditing(true)
  }

  // 提交模型名称编辑。
  function commitEdit() {
    const trimmed = editValue.trim()
    if (trimmed) renameModel(trimmed)
    setEditing(false)
  }

  const activeTab = tabs.find((t) => t.key === activeKey)
  const canGoBack = !!activeTab && activeTab.historyIndex > 0
  const canGoForward =
    !!activeTab && activeTab.historyIndex < activeTab.history.length - 1
  const canGoUp =
    !!activeTab && !!subGraphsData[activeTab.currentSubGraphId]?.parentId

  const tabItems: NonNullable<TabsProps['items']> = tabs.map((tab) => ({
    key: tab.key,
    label:
      tab.currentSubGraphId === rootId
        ? rootId
        : (subGraphsData[tab.currentSubGraphId]?.name ?? tab.currentSubGraphId),
    children: null,
    closable: tabs.length > 1,
  }))

  function onDragEnd({ active, over }: DragEndEvent) {
    if (active.id !== over?.id) {
      reorderTabs(active.id as string, over?.id as string)
    }
  }

  function onEdit(
    targetKey: React.MouseEvent | React.KeyboardEvent | string,
    action: 'add' | 'remove',
  ) {
    if (action === 'remove') closeTab(targetKey as string)
  }

  return (
    <div className="subsystem-tab-bar">
      <div className="subsystem-tab-bar__main">
        <div className="subsystem-tab-bar__navigation">
          <Tooltip title="回退">
            <Button
              type="text"
              icon={
                <ArrowBigLeft fill="currentColor" size={24} strokeWidth={1} />
              }
              disabled={!canGoBack}
              onClick={goBack}
            />
          </Tooltip>
          <Tooltip title="前进">
            <Button
              type="text"
              icon={
                <ArrowBigRight fill="currentColor" size={24} strokeWidth={1} />
              }
              disabled={!canGoForward}
              onClick={goForward}
            />
          </Tooltip>
          <Tooltip title="返回上一级图层">
            <Button
              type="text"
              icon={
                <ArrowBigUp fill="currentColor" size={24} strokeWidth={1} />
              }
              disabled={!canGoUp}
              onClick={goUp}
            />
          </Tooltip>
        </div>
        <div className="subsystem-tab-bar__tabs">
          <Tabs
            className="subsystem-tabs"
            type="editable-card"
            size="small"
            hideAdd
            activeKey={activeKey}
            onChange={(key) => setActiveTab(key)}
            onEdit={onEdit}
            items={tabItems}
            renderTabBar={(tabBarProps, DefaultTabBar) => (
              <DndContext
                sensors={[sensor]}
                onDragEnd={onDragEnd}
                collisionDetection={closestCenter}
              >
                <SortableContext
                  items={tabs.map((i) => i.key)}
                  strategy={horizontalListSortingStrategy}
                >
                  <DefaultTabBar {...tabBarProps}>
                    {(node) => (
                      <DraggableTabNode
                        {...(node as React.ReactElement<DraggableTabPaneProps>)
                          .props}
                        key={node.key}
                        canClose={tabs.length > 1}
                        onClose={closeTab}
                        onCloseOthers={closeOtherTabs}
                      >
                        {node}
                      </DraggableTabNode>
                    )}
                  </DefaultTabBar>
                </SortableContext>
              </DndContext>
            )}
          />
        </div>
      </div>
      {/* 项目名区域 */}
      <div className="subsystem-tab-bar__model-name">
        <VirtualKeyboard />
        {editing ? (
          <Input
            size="small"
            value={editValue}
            autoFocus
            style={{ width: editInputWidth }}
            onChange={(e) => setEditValue(e.target.value)}
            onPressEnter={commitEdit}
            onBlur={commitEdit}
          />
        ) : (
          <Tag color={isDirty ? 'orange' : 'green'} variant="outlined">
            <Typography.Text>
              {modelName}
              {isDirty ? ' *' : ''}
            </Typography.Text>
            <EditOutlined onClick={startEdit} />
          </Tag>
        )}
      </div>
    </div>
  )
}

export { SubsystemTabBar }
