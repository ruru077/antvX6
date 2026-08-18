import type { Graph } from '@antv/x6'

type GraphJSON = ReturnType<Graph['toJSON']>

interface SubGraphItem {
  id: string
  name: string
  deep: number
  parentId: string | null
  childrenIds: string[]
  graphJson: GraphJSON
}

interface EntryGraphModel {
  modelName?: string
  currentGraphId: string
  rootId: string
  subGraphs: Record<string, SubGraphItem>
}

type SubGraphMap = Record<string, SubGraphItem>

export type { EntryGraphModel, GraphJSON, SubGraphItem, SubGraphMap }
