import {
  AppstoreOutlined,
  ApartmentOutlined,
  SisternodeOutlined,
} from '@ant-design/icons'
import { Splitter, Tree } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { focusCellInSubGraph } from '@/services/graph-navigation-service'
import { useSubGraphStore } from '@/store/subGraphStore'
import { useSubSystemTabStore } from '@/store/subSystemTabStore'
import type { TreeDataNode } from 'antd'
import type { Key } from 'react'
import type { GraphJSON, SubGraphMap } from '~/types'

type GraphJsonCell = GraphJSON['cells'][number] & {
  id?: string
  shape?: string
  attrs?: { label?: { text?: unknown } }
  data?: { title?: unknown }
}

function buildHierarchyTree(subGraphs: SubGraphMap, rootId: string) {
  function buildSubGraphNode(graphId: string): TreeDataNode {
    const subGraph = subGraphs[graphId]
    return {
      key: `graph:${graphId}`,
      title: graphId === rootId ? rootId : subGraph.name,
      icon: graphId === rootId ? <ApartmentOutlined /> : <SisternodeOutlined />,
      children: subGraph.childrenIds.map(buildSubGraphNode),
    }
  }

  return [buildSubGraphNode(rootId)]
}

function buildCurrentGraphNodes(
  subGraphs: SubGraphMap,
  currentGraphId: string,
): TreeDataNode[] {
  const cells = (subGraphs[currentGraphId]?.graphJson.cells ??
    []) as GraphJsonCell[]
  return cells
    .filter((cell) => cell.shape !== 'edge' && cell.id && !subGraphs[cell.id])
    .map((cell) => {
      const labelText = cell.attrs?.label?.text
      const title = cell.data?.title
      return {
        key: `cell:${cell.id}`,
        title:
          typeof labelText === 'string' && labelText.trim()
            ? labelText.trim()
            : typeof title === 'string' && title.trim()
              ? title.trim()
              : cell.id,
        icon: <AppstoreOutlined />,
      }
    })
}

function HierarchyPanel() {
  const { currentPathIds, rootId, subGraphs } = useSubGraphStore(
    useShallow((state) => ({
      currentPathIds: state.currentPathIds,
      rootId: state.rootId,
      subGraphs: state.subGraphs,
    })),
  )
  const treeData = useMemo(
    () => buildHierarchyTree(subGraphs, rootId),
    [rootId, subGraphs],
  )
  const currentGraphId = currentPathIds[currentPathIds.length - 1]
  const currentGraphKey = `graph:${currentGraphId}`
  const currentGraphNodes = useMemo(
    () => buildCurrentGraphNodes(subGraphs, currentGraphId),
    [currentGraphId, subGraphs],
  )
  const currentGraphName =
    currentGraphId === rootId
      ? rootId
      : (subGraphs[currentGraphId]?.name ?? currentGraphId)
  const currentPathKeys = useMemo(
    () => currentPathIds.map((id) => `graph:${id}`),
    [currentPathIds],
  )
  const [expandedKeys, setExpandedKeys] = useState<Key[]>(currentPathKeys)

  useEffect(() => {
    setExpandedKeys((keys) =>
      Array.from(new Set([...keys, ...currentPathKeys])),
    )
  }, [currentPathKeys])

  return (
    <Splitter
      orientation="horizontal"
      className="min-h-0 flex-1 bg-background"
      classNames={{ dragger: 'diagram-splitter-dragger' }}
    >
      <Splitter.Panel defaultSize="50%" min="20%">
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-auto p-2">
            <Tree
              blockNode
              expandedKeys={expandedKeys}
              selectedKeys={[currentGraphKey]}
              showIcon
              showLine
              treeData={treeData}
              className="min-w-max bg-transparent"
              onExpand={(keys) => setExpandedKeys(keys)}
              onSelect={(selectedKeys) => {
                const key = selectedKeys[0]
                if (typeof key !== 'string') return
                useSubSystemTabStore.getState().navigateWithin(key.slice(6))
              }}
            />
          </div>
        </div>
      </Splitter.Panel>

      <Splitter.Panel min="20%">
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border bg-muted px-2 text-sm font-medium text-foreground">
            <span>当前图层节点</span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              {currentGraphName} 共 {currentGraphNodes.length} 个
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2">
            <Tree
              blockNode
              treeData={currentGraphNodes}
              className="min-w-max bg-transparent"
              onSelect={(_, info) => {
                const key = info.node.key
                if (typeof key !== 'string') return
                focusCellInSubGraph(currentGraphId, key.slice(5))
              }}
            />
          </div>
        </div>
      </Splitter.Panel>
    </Splitter>
  )
}

export { HierarchyPanel }
