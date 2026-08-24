import { ImageNode } from '@/assets/TestModel'
import { getAntdMessage } from '@/services/antd-message-service'
import {
  IMAGE_FILE_MAX_SIZE,
  readImageFileAsDataURL,
  selectImageFile,
} from '@/services/image-file-service'
import type { Graph, Node } from '@antv/x6'

const activePlacements = new WeakMap<Graph, () => void>()

function startImageNodePlacement(graph: Graph) {
  activePlacements.get(graph)?.()

  const preview = graph.createNode(structuredClone(ImageNode))
  preview.setVisible(false)
  graph.startBatch('add-image-node')
  graph.addNode(preview)

  const previousCursor = graph.container.style.cursor
  graph.container.style.cursor = 'crosshair'
  let clickTimer: number | null = null
  let placementActive = true

  function movePreview(clientX: number, clientY: number) {
    const rect = graph.container.getBoundingClientRect()
    const inside =
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    preview.setVisible(inside)
    if (!inside) return false

    const point = graph.clientToLocal(clientX, clientY)
    const size = preview.getSize()
    preview.position(point.x - size.width / 2, point.y - size.height / 2)
    return true
  }

  function cleanup(cancel = true) {
    if (!placementActive) return
    placementActive = false
    if (clickTimer !== null) window.clearTimeout(clickTimer)
    document.removeEventListener('mousemove', mouseMoveHandler, true)
    document.removeEventListener('click', clickHandler, true)
    document.removeEventListener('keydown', keyDownHandler, true)
    graph.container.style.cursor = previousCursor
    if (cancel && graph.getCellById(preview.id) === preview)
      graph.removeNode(preview)
    graph.stopBatch('add-image-node')
    if (activePlacements.get(graph) === cleanup) activePlacements.delete(graph)
  }

  function mouseMoveHandler(event: MouseEvent) {
    movePreview(event.clientX, event.clientY)
  }

  function clickHandler(event: MouseEvent) {
    if (!movePreview(event.clientX, event.clientY)) {
      cleanup()
      return
    }

    event.preventDefault()
    event.stopPropagation()
    cleanup(false)
    graph.resetSelection([preview])
  }

  function keyDownHandler(event: KeyboardEvent) {
    if (event.key === 'Escape') cleanup()
  }

  document.addEventListener('mousemove', mouseMoveHandler, true)
  document.addEventListener('keydown', keyDownHandler, true)
  clickTimer = window.setTimeout(() => {
    clickTimer = null
    document.addEventListener('click', clickHandler, true)
  }, 0)
  activePlacements.set(graph, cleanup)
}

function cancelImageNodePlacement(graph: Graph) {
  activePlacements.get(graph)?.()
}

async function selectImageForNode(node: Node, graph: Graph) {
  if (node.getData()?.blockType !== 'ImageNode') return

  const file = await selectImageFile()
  if (!file) return
  if (!file.type.startsWith('image/')) {
    getAntdMessage().error('请选择图片文件')
    return
  }
  if (file.size > IMAGE_FILE_MAX_SIZE) {
    getAntdMessage().error('图片不能超过 5 MB')
    return
  }

  try {
    const dataUrl = await readImageFileAsDataURL(file)
    if (graph.getCellById(node.id) !== node) return
    node.attr(
      {
        image: {
          xlinkHref: dataUrl,
          visibility: 'visible',
        },
        placeholder: {
          visibility: 'hidden',
        },
      },
      { ignore: true, undo: false },
    )
  } catch (error) {
    console.error(error)
    getAntdMessage().error('图片读取失败')
  }
}

export { cancelImageNodePlacement, selectImageForNode, startImageNodePlacement }
