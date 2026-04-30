import type { BlockResponse, ParsedBlock } from '~/types/vo/block'

async function fetchBlocks(): Promise<BlockResponse[]> {
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

function parseBlock(blockVo: string): ParsedBlock {
  return JSON.parse(blockVo)
}

export { fetchBlocks, parseBlock }
