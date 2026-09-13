import type { Node } from '@antv/x6'

const UPDATE_BLOCK_PARAMS = 'update-block-params'
const DISPLAY_PARAM_BY_BLOCK_TYPE: Record<string, string> = {
  Constant: 'Value',
  Gain: 'Gain',
}

function syncBlockDisplayByParamValues(
  node: Node,
  paramValues: Record<string, string>,
): void {
  const blockType = node.getData()?.blockType
  const paramName = DISPLAY_PARAM_BY_BLOCK_TYPE[blockType]
  if (!paramName) return
  const value = paramValues[paramName]
  if (value === undefined) {
    throw new Error(`${blockType}.${paramName} parameter is required`)
  }
  node.attr('label_middle/text', value)
}

export { syncBlockDisplayByParamValues, UPDATE_BLOCK_PARAMS }
