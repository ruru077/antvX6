import type { Block, BlockLibrary, BlockResponse } from '~/types/vo/block'

/**
 * 获取 Stencil Block 数据
 * @returns Block NodeMeta[]
 */
async function fetchBlocks(): Promise<{ block: Block; libraryId: number }[]> {
  try {
    const response = await fetch('http://42.192.110.38/antvblocks')
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
    const response = await fetch('http://42.192.110.38/library')
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
