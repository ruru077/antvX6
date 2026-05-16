import { Graph, Model, Stencil, StringExt } from '@antv/x6'
import type { Node } from '@antv/x6'
import { throttle } from 'lodash-es'
import type { Block } from '~/types/vo/block'
import { fetchBlockLibrary, fetchBlocks } from '@/api/blocks'
import {
  STENCIL_GROUP_PADDING,
  STENCIL_NODE_GAP,
  STENCIL_PADDING,
} from '@/assets/constant'
import { electricalPortGroups, signalPortGroups } from '@/assets/x6Model'
import { useGraphStore } from '@/store/graphStore'

function createStencilService(stencilContainer: HTMLElement) {
  let stencil!: Stencil
  let graph!: Graph
  let stencilWidth = stencilContainer.clientWidth
  let libraryWithBlock = new Map<string, Block[]>()
  let resizeObserver: ResizeObserver | null = null
  const Derivative = {
    shape: 'rect',
    width: 60,
    height: 60,
    x: 1500,
    y: 1000,
    markup: [
      {
        tagName: 'rect',
        selector: 'body',
      },
      {
        tagName: 'text',
        selector: 'label',
      },
      {
        tagName: 'image',
        selector: 'image',
      },
    ],
    attrs: {
      body: {
        refWidth: '100%',
        refHeight: '100%',
        strokeWidth: 2,
        stroke: '#000000',
        fill: '#FFFFFF',
      },
      label: {
        textVerticalAnchor: 'top',
        textAnchor: 'middle',
        refX: '50%',
        refY: '110%',
        fontSize: 14,
        fill: '#000000',
        text: 'Derivative',
      },
      image: {
        xlinkHref:
          'data:image/png;base64,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',
        refWidth: '80%',
        refHeight: '80%',
        refX: '10%',
        refY: '10%',
      },
    },
    ports: {
      items: [
        {
          id: 'i1',
          group: 'in',
        },
        {
          id: 'o1',
          group: 'out',
        },
      ],
      groups: signalPortGroups,
    },
    // 自定义数据放在 data 字段
    data: {
      blockType: 'Derivative',
      title: 'Derivative',
      srcBlock: 'simulink/Continuous/Derivative',
      description: 'Numerical derivative for the input signal.',
      paramValues: [],
      paramLables: [],
      level: 10,
    },
  }
  const hh = {
    shape: 'rect',
    width: 70,
    height: 90,
    x: 1600,
    y: 1100,
    markup: [
      {
        tagName: 'image',
        selector: 'body',
      },
      {
        tagName: 'text',
        selector: 'label',
      },
    ],
    attrs: {
      body: {
        refWidth: '100%',
        refHeight: '100%',
      },
      label: {
        textVerticalAnchor: 'middle',
        textAnchor: 'middle',
        refX: '50%',
        refY: '120%',
        fontSize: 14,
        fill: '#000000',
        text: 'Resistor',
      },
      image: {
        xlinkHref:
          'data:image/png;base64,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',
      },
    },
    ports: {
      items: [
        {
          id: 'eLConn1',
          group: 'ine',
        },
        {
          id: 'eRConn1',
          group: 'oute',
        },
      ],
      groups: electricalPortGroups,
    },
    data: {
      blockType: 'Resistor',
      title: 'Resistor',
      srcBlock: 'fl_lib/Electrical/Electrical Elements/Resistor',
      description:
        'The voltage-current (V-I) relationship for a linear resistor is V=I*R, where R is the constant resistance in ohms.',
      paramValues: {
        R: '1',
      },
      paramLables: {
        R: 'Resistance (Ohm)',
      },
      level: 10,
    },
  }
  console.log(JSON.stringify(Derivative, null, 2))
  // console.log(JSON.parse(JSON.stringify(Derivative, null, 2)))
  useGraphStore.getState().graph.addNode(Derivative)
  useGraphStore.getState().graph.addNode(hh)
  /**
   * 贪心布局：每行塞节点，装不下换行，不修改加载顺序；每行高度 = 该行最高节点；行列间距固定
   */
  function greedyLayout(model: Model) {
    const nodes = model.getNodes()
    const areaX = stencilWidth - 2 * STENCIL_PADDING
    const rows: Node[][] = []
    let row: Node[] = []
    let tolWidth = 0
    for (const node of nodes) {
      const { width } = node.getSize()
      const needed =
        row.length === 0 ? width : tolWidth + STENCIL_NODE_GAP + width
      if (needed <= areaX) {
        row.push(node)
        tolWidth = needed
      } else if (needed > areaX && row.length > 0) {
        rows.push(row)
        row = [node]
        tolWidth = width
      } else if (needed > areaX && row.length === 0) {
        // 单个节点宽度超过行宽 兼容性报错
        console.error('[联系管理员兼容]Exist node exceeds min row width:', node)
      } else {
        console.error('Unexpected layout case:', node)
      }
    }
    if (row.length) rows.push(row)
    let y = STENCIL_NODE_GAP / 2
    for (const r of rows) {
      const sizes = r.map((n) => n.getSize())
      const rowH = Math.max(...sizes.map((s) => s.height))
      const totalNodeWidth = sizes.reduce((sum, s) => sum + s.width, 0)
      //  gap 计算（两种情况）：
      // ┌ r.length > 1 → gap = (areaX - totalNodeWidth) / (r.length + 1)
      // │   节点间和两侧都留等量间距，共 (n+1) 份
      // └ r.length = 1 → gap = (areaX - totalNodeWidth) / 2
      //  单节点居中，左右各一份
      const gap =
        r.length > 1
          ? (areaX - totalNodeWidth) / (r.length + 1)
          : (areaX - totalNodeWidth) / 2
      let x = gap
      for (let i = 0; i < r.length; i++) {
        const { width, height } = sizes[i]
        r[i].position(x, y + (rowH - height) / 2)
        x += width + gap
      }
      y += rowH + STENCIL_NODE_GAP
    }
  }

  async function create(): Promise<void> {
    graph = useGraphStore.getState().graph
    const [blocks, libraries] = await Promise.all([
      fetchBlocks(),
      fetchBlockLibrary(),
    ])
    libraryWithBlock = new Map(
      libraries.map((lib) => [
        lib.name,
        blocks
          .filter((item) => item.libraryId === lib.id)
          .map((item) => item.block),
      ]),
    )
    stencil = buildStencil()
    for (const [libName, libBlocks] of libraryWithBlock) {
      stencil.load(
        libBlocks.map((b) => graph.createNode(b)),
        libName,
      )
    }
    stencilContainer.appendChild(stencil.container)
    resizeObserver = new ResizeObserver(
      throttle((entries: ResizeObserverEntry[]) => {
        const newWidth = entries[0].contentRect.width
        if (Math.abs(newWidth - stencilWidth) < 10) return
        resize(newWidth)
      }, 200),
    )
    resizeObserver.observe(stencilContainer)
  }

  function dispose(): void {
    resizeObserver?.disconnect()
    stencil?.dispose()
  }

  function buildStencil(): Stencil {
    return new Stencil({
      target: graph,
      stencilGraphWidth: stencilWidth,
      stencilGraphHeight: 0,
      groups: Array.from(libraryWithBlock).map(([libName]) => ({
        name: libName,
        title: libName,
        graphPadding: STENCIL_GROUP_PADDING,
        layout: greedyLayout,
      })),
      search(cell, keyword) {
        const label = cell.attr<string>('label/text') ?? ''
        return label.toLowerCase().indexOf(keyword.toLowerCase()) !== -1
      },
      placeholder: 'TO_BLOCK_NAME',
      stencilGraphPadding: STENCIL_PADDING,
      notFoundText: 'NOT FOUND',
      getDragNode(node) {
        // 子系统port id 不需要唯一性 保持in1 out1
        if (node.getData()?.blockType === 'Subsystem') return node.clone()
        const cloned = node.clone()
        cloned.getPorts().forEach((port) => {
          if (port.id) cloned.portProp(port.id, 'id', StringExt.uuid())
        })
        const { width, height } = cloned.getSize()
        return cloned.size(Math.max(width, 60), Math.max(height, 60))
      },
    })
  }

  function resize(newWidth: number): void {
    stencilWidth = newWidth
    if (!libraryWithBlock.size) return
    stencil.options.stencilGraphWidth = stencilWidth
    for (const [libName, libBlocks] of libraryWithBlock) {
      stencil.resizeGroup(libName, { width: stencilWidth, height: 0 })
      stencil.load(
        libBlocks.map((b) => graph.createNode(b)),
        libName,
      )
    }
  }

  function collapseAll(): void {
    stencil?.collapseGroups()
  }
  function expandAll(): void {
    stencil?.expandGroups()
  }

  return { create, dispose, resize, collapseAll, expandAll }
}

export { createStencilService }
