import type { CellAttrs } from '@antv/x6'

interface BlockResponse {
  antvBlock: string
  icon: string
  libraryId: number
  userId: string
}

interface BlockMarkupItem {
  tagName: string
  selector: string
  attrs?: Record<string, unknown>
}

interface BlockPortItem {
  id: string
  group: string
}

interface BlockPortGroup {
  markup?: BlockMarkupItem[]
  z?: number
  attrs?: Record<string, unknown>
  position?: { name: string }
  label?: { position?: { name: string } }
}

interface BlockPortConfig {
  items: BlockPortItem[]
  groups: Record<string, BlockPortGroup>
}

interface BlockData {
  blockType: string
  title: string
  srcBlock: string
  description: string
  paramValues: unknown[]
  paramLables: string[]
  level: number
}

interface ParsedBlock {
  shape: string
  width: number
  height: number
  markup: BlockMarkupItem[]
  attrs: CellAttrs
  ports: BlockPortConfig
  data: BlockData
}

export type { BlockResponse, ParsedBlock }
