import type { Block } from '~/types/vo/block'

interface StencilPresentationAdapter {
  adaptBlock: (block: Block) => Block
  showTooltip: boolean
}

let activeAdapter: StencilPresentationAdapter | null = null

function registerStencilPresentationAdapter(
  adapter: StencilPresentationAdapter,
) {
  if (activeAdapter && activeAdapter !== adapter)
    throw new Error('Stencil presentation adapter is already registered')

  activeAdapter = adapter
  return () => {
    if (activeAdapter === adapter) activeAdapter = null
  }
}

function adaptStencilBlock(block: Block) {
  return activeAdapter?.adaptBlock(block) ?? block
}

function shouldShowStencilTooltip() {
  return activeAdapter?.showTooltip ?? true
}

export {
  adaptStencilBlock,
  registerStencilPresentationAdapter,
  shouldShowStencilTooltip,
}
export type { StencilPresentationAdapter }
