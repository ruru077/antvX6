import { Graph, Stencil } from '@antv/x6'
import { port } from './../../../X6/src/registry/attr/port'

/**
 * Stencil入口
 * @param stencilContainer
 * @returns
 */
function createStencilService(stencilContainer: HTMLElement) {
  let stencil!: Stencil
  let graph!: Graph
  let resizeObserver!: ResizeObserver
  let activeColumns = 2
  const commonAttrs = {
    body: {
      fill: '#fff',
      stroke: '#8f8f8f',
      strokeWidth: 1,
    },
  }
  /**
   * 挂载Stencil
   * @param g 全局Graph实例
   */
  function create(g: Graph): void {
    graph = g
    stencil = createStencil(activeColumns)
    const n1 = graph.createNode({
      shape: 'rect',
      x: 40,
      y: 40,
      width: 80,
      height: 40,
      label: 'rect',
      attrs: commonAttrs,
      ports: {
        items: [
          {
            id: 'port1',
            group: 'in',
          },
          {
            id: 'port2',
            group: 'out',
          },
        ],
        groups: {
          in: {
            position: 'left',
            attrs: {
              circle: {
                r: 4,
                magnet: true,
                stroke: '#31d0c6',
                strokeWidth: 2,
              },
            },
          },
          out: {
            position: 'right',
            attrs: {
              circle: {
                r: 4,
                magnet: true,
                stroke: '#31d0c6',
                strokeWidth: 2,
              },
            },
          },
        },
      },
    })

    const n2 = graph.createNode({
      shape: 'rect',
      x: 40,
      y: 40,
      width: 80,
      height: 40,
      label: 'Subsystem',
      data: { kind: 'subsystem', name: 'Subsystem' },
      attrs: commonAttrs,
      ports: {
        items: [
          {
            id: 'port1',
            group: 'in',
          },
          {
            id: 'port2',
            group: 'out',
          },
        ],
        groups: {
          in: {
            position: 'left',
            attrs: {
              circle: {
                r: 4,
                magnet: true,
                stroke: '#31d0c6',
                strokeWidth: 2,
              },
            },
          },
          out: {
            position: 'right',
            attrs: {
              circle: {
                r: 4,
                magnet: true,
                stroke: '#31d0c6',
                strokeWidth: 2,
              },
            },
          },
        },
      },
    })
    const n3 = graph.createNode({
      shape: 'ellipse',
      x: 280,
      y: 40,
      width: 80,
      height: 40,
      label: 'ellipse',
      attrs: commonAttrs,
    })

    const n4 = graph.createNode({
      shape: 'path',
      x: 420,
      y: 40,
      width: 40,
      height: 40,
      // https://www.svgrepo.com/svg/13653/like
      path: 'M24.85,10.126c2.018-4.783,6.628-8.125,11.99-8.125c7.223,0,12.425,6.179,13.079,13.543c0,0,0.353,1.828-0.424,5.119c-1.058,4.482-3.545,8.464-6.898,11.503L24.85,48L7.402,32.165c-3.353-3.038-5.84-7.021-6.898-11.503c-0.777-3.291-0.424-5.119-0.424-5.119C0.734,8.179,5.936,2,13.159,2C18.522,2,22.832,5.343,24.85,10.126z',
      attrs: commonAttrs,
      label: 'path',
    })

    stencil.load([n1, n2], 'group1')
    stencil.load([n3, n4], 'group2')
    stencilContainer.appendChild(stencil.container)
  }
  function dispose(): void {
    resizeObserver?.disconnect()
    stencil.dispose()
  }

  // ── Private functions 业务修改────────────────────────────────
  function createStencil(columns: number): Stencil {
    return new Stencil({
      target: graph,
      // 模板画布宽度。
      stencilGraphWidth: 200,
      // 模板画布高度，设置为 0 则自动根据内容调整高度。
      stencilGraphHeight: 0,
      groups: [
        {
          name: 'group1',
          title: 'Group(Collapsable)',
        },
        {
          name: 'group2',
          title: 'Group',
          collapsable: false,
        },
      ],
      search(cell, keyword) {
        return cell.shape.indexOf(keyword) !== -1
      },
      placeholder: 'TO_BLOCK_NAME',
      stencilGraphPadding: 10,
      notFoundText: 'NOT FOUND',
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

  function UpdateStencil(): void {
    stencil!.dispose()
    stencil = createStencil(activeColumns)
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
