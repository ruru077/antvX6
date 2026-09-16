import { assetUrl } from './platform'
import type { Block, BlockLibrary, BlockResponse } from '~/types/vo/block'

const API_BASE = import.meta.env.VITE_M2PLINK_API_BASE?.replace(/\/$/, '')

/**
 * 获取 Stencil Block 数据
 * @returns Block NodeMeta[]
 */
async function fetchBlocks(): Promise<{ block: Block; libraryId: number }[]> {
  try {
    const response = await fetch(API_BASE === undefined ? assetUrl('catalog/blocks.json') : `${API_BASE}/antvblocks`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data: BlockResponse[] = await response.json()
    return data.map((item) => {
      const block: Block = JSON.parse(item.antvBlock)
      // Block图标
      if (block.attrs.image) {
        block.attrs.image.xlinkHref = `data:image/png;base64,${item.icon ?? ''}`
      }
      return { block, libraryId: item.libraryId }
    })
  } catch (error) {
    console.error('Failed to fetch blocks:', error)
    return []
  }
}

/**
 * 获取 Stencil Block Library 分组数据
 * @returns BlockLibrary[]
 */
async function fetchBlockLibrary(): Promise<BlockLibrary[]> {
  try {
    const response = await fetch(API_BASE === undefined ? assetUrl('catalog/libraries.json') : `${API_BASE}/library`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data: BlockLibrary[] = await response.json()
    return data
  } catch (error) {
    console.error('Failed to fetch block library:', error)
    return []
  }
}

export { fetchBlocks, fetchBlockLibrary }
