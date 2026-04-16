import type { CellAttrs } from '@antv/x6'
import type {
  PortMetadata as PortItemMetadata,
  Metadata as PortMetadata,
} from '@antv/x6/es/model/port'

export interface BlockDefinition {
  id: number
  type: string
  data: string
  markup: string
  icon: string
}

export interface ParsedBlockData {
  type: string
  defaults: Record<string, unknown>
  protoProps: {
    markup: Array<{
      tagName: string
      selector: string
    }>
  }
}

export interface ParsedMarkupData {
  type: string
  attrs: CellAttrs
  ports: Partial<PortMetadata> | PortItemMetadata[]
}

export async function fetchBlocks(): Promise<BlockDefinition[]> {
  try {
    const response = await fetch('http://localhost:8080/blocks')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Failed to fetch blocks:', error)
    return []
  }
}

export function parseBlockData(dataStr: string): ParsedBlockData {
  return JSON.parse(dataStr)
}

export function parseMarkupData(markupStr: string): ParsedMarkupData {
  return JSON.parse(markupStr)
}
