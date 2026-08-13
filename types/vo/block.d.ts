import type { NodeMetadata } from '@antv/x6'

/**
 * @id 数据库中 Block 的唯一标识
 * @libraryId Block 所属库的 id
 * @icon 图标img base64
 * @antvBlock Block 元数据，JSON 字符串格式
 */
interface BlockResponse {
  id: number
  libraryId: number
  icon: string
  antvBlock: string
}

// 业务自定义数据
interface BlockData {
  blockType: string
  title: string
  srcBlock: string
  description: string
  paramValues: Record<string, string>
  paramLables?: Record<string, string>
  paramOptions?: Record<string, string[]>
  level: number
  imageMode?: 'snapshot' | 'custom'
  [K: string]:
    | string
    | number
    | boolean
    | Record<string, string>
    | Record<string, string[]>
    | string[]
    | undefined
}

type Block = Omit<NodeMetadata, 'data'> & { data: BlockData }

interface BlockLibrary {
  id: number
  name: string
  description?: string
}

export type { BlockResponse, Block, BlockLibrary, BlockData }
