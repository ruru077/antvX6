import type { Block, BlockResponse } from '~/types/vo/block'

/**
 * 从后端获取 Stencil Block 数据
 * @returns Block NodeMeta[]
 */
async function fetchBlocks(): Promise<Block[]> {
  try {
    const response = await fetch('http://localhost:8080/antvblocks')
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
      return block
    })
  } catch (error) {
    console.error('Failed to fetch blocks:', error)
    return []
  }
}

export { fetchBlocks }
