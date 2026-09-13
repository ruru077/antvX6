import type { Node } from '@antv/x6'
import type { PortMetadata } from '@antv/x6/lib/model/port'

const SUM_MIN_BODY_SIZE = 60
const SUM_PORT_SPACING = 24
const SUM_BODY_SIZE_STEP = 15
const RECT_PORT_SPACING = 20
const RECT_PORT_PADDING = 10

function resizeSumPorts(node: Node, input: string): void {
  const chars = Array.from(input)
  const range = Math.min(180, Math.max(0, (chars.length - 1) * 90))
  node.setData({ portTexts: chars }, { deep: false })
  node.setPropByPath('ports/groups/in/position/args', {
    start: 180 + range / 2,
    step: chars.length > 1 ? -range / (chars.length - 1) : 0,
    compensateRotate: true,
  })
  const outputPorts = node
    .getPorts()
    .filter((port) => !port.group?.toLowerCase().startsWith('in'))
  const inputPorts: PortMetadata[] = chars.map((text, index) => {
    return {
      id: `i${index + 1}`,
      group: 'in',
      attrs: { portLabel: { text } },
      label: { position: { args: { offset: -15 } } },
    }
  })

  node.setPropByPath('ports/items', [...inputPorts, ...outputPorts], {
    rewrite: true,
  })

  const requiredBodySize = Math.max(
    SUM_MIN_BODY_SIZE,
    Math.ceil(
      (2 * SUM_PORT_SPACING * Math.max(0, chars.length - 1)) /
        Math.PI /
        SUM_BODY_SIZE_STEP,
    ) * SUM_BODY_SIZE_STEP,
  )
  const currentSize = node.getSize()
  const width = Math.max(currentSize.width, requiredBodySize)
  const height = Math.max(currentSize.height, requiredBodySize)
  if (width > currentSize.width || height > currentSize.height) {
    node.resize(width, height)
  }
}

function resizeRectMathPorts(
  node: Node,
  input: string,
  formatText: (value: string) => string,
): void {
  const portTexts = Array.from(input, formatText)
  node.setData({ portTexts }, { deep: false })
  const outputPorts = node
    .getPorts()
    .filter((port) => !port.group?.toLowerCase().startsWith('in'))
  const inputPorts: PortMetadata[] = portTexts.map((text, index) => ({
    id: `i${index + 1}`,
    group: 'in',
    attrs: { portLabel: { text } },
  }))
  node.setPropByPath('ports/items', [...inputPorts, ...outputPorts], {
    rewrite: true,
  })

  const requiredHeight =
    portTexts.length * RECT_PORT_SPACING + RECT_PORT_PADDING * 2
  const currentSize = node.getSize()
  if (requiredHeight > currentSize.height) {
    node.resize(currentSize.width, requiredHeight)
  }
}

function formatProductPortText(value: string): string {
  if (value === '*') return '×'
  if (value === '/') return '÷'
  return value
}

function resizeBlockByParamValues(
  node: Node,
  paramValues: Record<string, string>,
): void {
  const positionName = node.getPropByPath<string>(
    'ports/groups/in/position/name',
  )
  const input = paramValues.Inputs ?? ''
  if (positionName === 'ellipse') {
    resizeSumPorts(node, input)
    return
  }
  if (positionName !== 'left') return
  const blockType = node.getData()?.blockType
  if (blockType === 'Add') {
    resizeRectMathPorts(node, input, (value) => value)
  }
  if (blockType === 'Product') {
    resizeRectMathPorts(node, input, formatProductPortText)
  }
}

export { resizeBlockByParamValues }
