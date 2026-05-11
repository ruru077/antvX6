import { Graph, Stencil, StringExt } from '@antv/x6'
import { fetchBlockLibrary, fetchBlocks } from '@/api/blocks'

/**
 * Stencil入口
 * @param stencilContainer
 * @returns
 */
function createStencilService(stencilContainer: HTMLElement) {
  let stencil!: Stencil
  let graph!: Graph
  let activeColumns = 2
  /**
   * 挂载Stencil
   * @param g 全局Graph实例
   */
  async function create(g: Graph): Promise<void> {
    graph = g

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
        groups: {
          in: {
            markup: [
              {
                tagName: 'path',
                selector: 'portBody',
                attrs: {
                  d: 'M 0 0 -9 -5 -9 -3 -3 0 -9 3 -9 5 z',
                },
              },
            ],
            z: 1,
            attrs: {
              portBody: {
                magnet: true,
                fill: '#000000',
                stroke: '#000000',
                strokeWidth: 10,
                strokeOpacity: 0,
              },
            },
            position: {
              name: 'left',
            },
            label: {
              position: {
                name: 'left',
              },
            },
          },
          out: {
            markup: [
              {
                tagName: 'path',
                selector: 'portBody',
                attrs: {
                  d: 'M 9 0 0 -5 0 -3 6 0 0 3 0 5 z',
                },
              },
            ],
            z: -1,
            attrs: {
              portBody: {
                magnet: true,
                fill: '#000000',
                stroke: '#000000',
                strokeWidth: 10,
                strokeOpacity: 0,
              },
            },
            position: {
              name: 'right',
            },
            label: {
              position: {
                name: 'right',
              },
            },
          },
        },
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
        groups: {
          ine: {
            markup: [
              {
                tagName: 'circle',
                selector: 'portBody',
                attrs: {
                  r: 2,
                },
              },
            ],
            attrs: {
              portBody: {
                magnet: true,
                fill: '#000000',
                stroke: '#000000',
                strokeWidth: 15,
                strokeOpacity: 0,
              },
            },
            position: {
              name: 'left',
            },
            label: {
              position: {
                name: 'left',
              },
            },
          },
          oute: {
            markup: [
              {
                tagName: 'circle',
                selector: 'portBody',
                attrs: {
                  r: 2,
                },
              },
            ],
            position: {
              name: 'right',
            },
            attrs: {
              portBody: {
                magnet: true,
                fill: '#000000',
                stroke: '#000000',
                strokeWidth: 15,
                strokeOpacity: 0,
              },
            },
            label: {
              position: {
                name: 'right',
              },
            },
          },
        },
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
    graph.addNode(Derivative)
    graph.addNode(hh)

    const [blocks, libraries] = await Promise.all([
      fetchBlocks(),
      fetchBlockLibrary(),
    ])
    stencil = createStencil(activeColumns, libraries)
    libraries.forEach((lib) => {
      const nodes = blocks
        .filter((item) => item.libraryId === lib.id)
        .map((item) => graph.createNode(item.block))
      stencil.load(nodes, lib.name)
    })
    stencilContainer.appendChild(stencil.container)
  }
  function dispose(): void {
    stencil.dispose()
  }

  // ── Private functions 业务修改────────────────────────────────
  function createStencil(
    columns: number,
    libraries: { id: number; name: string }[],
  ): Stencil {
    return new Stencil({
      target: graph,
      // 模板画布宽度。
      stencilGraphWidth: 200,
      // 模板画布高度，设置为 0 则自动根据内容调整高度。
      stencilGraphHeight: 0,
      groups: libraries.map((lib) => ({
        name: lib.name,
        title: lib.name,
      })),

      search(cell, keyword) {
        const label = cell.attr<string>('label/text') ?? ''
        return label.toLowerCase().indexOf(keyword.toLowerCase()) !== -1
      },
      placeholder: 'TO_BLOCK_NAME',
      stencilGraphPadding: 10,
      notFoundText: 'NOT FOUND',
      getDragNode(node) {
        const cloned = node.clone()
        cloned.getPorts().forEach((port) => {
          if (port.id) {
            cloned.portProp(port.id, 'id', StringExt.uuid())
          }
        })
        return cloned
      },
      // layoutOptions: {
      //   columns,
      //   columnWidth: NODE_SIZE + NODE_GAP,
      //   rowHeight: NODE_SIZE + NODE_GAP + LABEL_H,
      //   dx: 0,
      //   dy: 0,
      //   marginX: SIDE_PAD,
      //   marginY: SIDE_PAD,
      // },
    })
  }

  function UpdateStencil(libraries: { id: number; name: string }[]): void {
    stencil!.dispose()
    stencil = createStencil(activeColumns, libraries)
  }

  function collapseAll(): void {
    stencil?.collapseGroups()
  }

  function expandAll(): void {
    stencil?.expandGroups()
  }

  return {
    create,
    dispose,
    collapseAll,
    expandAll,
  }
}

export { createStencilService }
