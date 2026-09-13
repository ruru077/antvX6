import type { StencilPresentationAdapter } from '@/touch/service/stencil-presentation-adapter-service'
import type { Block } from '~/types/vo/block'

function adaptSubsystemLabel(block: Block): Block {
  if (!['Subsystem', 'EnabledSubsystem'].includes(block.data.blockType))
    return block

  const adapted = structuredClone(block)
  const labelAttrs = adapted.attrs?.label
  const labelStyle = labelAttrs?.style
  return {
    ...adapted,
    attrs: {
      ...adapted.attrs,
      label: {
        ...labelAttrs,
        style: {
          ...(typeof labelStyle === 'object' ? labelStyle : {}),
          width: '100%',
          maxWidth: '100%',
          height: 'auto',
          marginLeft: 0,
          transform: 'none',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
        },
      },
    },
  } as Block
}

const touchStencilPresentationAdapter: StencilPresentationAdapter = {
  adaptBlock: adaptSubsystemLabel,
  showTooltip: false,
}

export { touchStencilPresentationAdapter }
