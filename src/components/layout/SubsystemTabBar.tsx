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
import { Button, Tabs } from 'antd'
import { ArrowBigLeft, ArrowBigRight, ArrowBigUp } from 'lucide-react'
import { cloneElement, type CSSProperties, type ReactElement } from 'react'
import { useShallow } from 'zustand/shallow'
import { useSubGraphStore } from '@/store/subGraphStore'
import { useSubSystemTabStore } from '@/store/subSystemTabStore'
import type { DragEndEvent } from '@dnd-kit/core'
import type { TabsProps } from 'antd'

interface DraggableTabPaneProps extends React.HTMLAttributes<HTMLDivElement> {
  'data-node-key': string
}

function DraggableTabNode({
  className,
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

  return cloneElement(
    props.children as ReactElement,
    {
      ref: setNodeRef,
      style,
      ...attributes,
      ...listeners,
    } as Record<string, unknown>,
  )
}

function SubsystemTabBar() {
  const { tabs, activeKey } = useSubSystemTabStore(
    useShallow((s) => ({
      tabs: s.tabs,
      activeKey: s.activeKey,
    })),
  )
  const subGraphsData = useSubGraphStore((s) => s.subGraphs)
  const goBack = useSubSystemTabStore((s) => s.goBack)
  const goForward = useSubSystemTabStore((s) => s.goForward)
  const goUp = useSubSystemTabStore((s) => s.goUp)
  const setActiveTab = useSubSystemTabStore((s) => s.setActiveTab)
  const closeTab = useSubSystemTabStore((s) => s.closeTab)
  const reorderTabs = useSubSystemTabStore((s) => s.reorderTabs)

  const sensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 10 },
  })

  const activeTab = tabs.find((t) => t.key === activeKey)
  const canGoBack = !!activeTab && activeTab.historyIndex > 0
  const canGoForward =
    !!activeTab && activeTab.historyIndex < activeTab.history.length - 1
  const canGoUp =
    !!activeTab && !!subGraphsData[activeTab.currentSubGraphId]?.parentId

  const tabItems: NonNullable<TabsProps['items']> = tabs.map((tab) => ({
    key: tab.key,
    label: subGraphsData[tab.rootSubGraphId]?.name ?? tab.key,
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
    <div className="flex h-8 items-center overflow-hidden border-b border-gray-200 bg-[rgb(240,240,240)]">
      <div className="flex shrink-0 items-center px-0.5">
        <Button
          type="text"
          icon={<ArrowBigLeft fill="currentColor" size={24} strokeWidth={1} />}
          disabled={!canGoBack}
          onClick={goBack}
        />
        <Button
          type="text"
          icon={<ArrowBigRight fill="currentColor" size={24} strokeWidth={1} />}
          disabled={!canGoForward}
          onClick={goForward}
        />
        <Button
          type="text"
          icon={<ArrowBigUp fill="currentColor" size={24} strokeWidth={1} />}
          disabled={!canGoUp}
          onClick={goUp}
        />
      </div>
      <div className="mt-2.5 flex min-w-0 flex-1 overflow-hidden">
        <Tabs
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
  )
}

export { SubsystemTabBar }
