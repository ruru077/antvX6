import { Graph } from '@antv/x6'
import { height } from '@antv/x6/lib/common/dom/position'
import { useEffect, useRef } from 'react'

function DiagramModel() {
  const graphContainerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<Graph | null>(null)

  useEffect(() => {
    if (!graphContainerRef.current) return

    const graph = new Graph({
      container: graphContainerRef.current,
      autoResize: true,
      grid: { visible: true, size: 10 },
      interacting: {
        edgeMovable: false,
      },
    })
    graphRef.current = graph

    graph.addNode({
      shape: 'rect',
      width: 100,
      height: 60,
      markup: [
        {
          tagName: 'rect',
          selector: 'body',
        },
        {
          tagName: 'text',
          selector: 'label',
        },
      ],
      attrs: {
        label: {
          refX: '50%',
          refY: '100%',
          refY2: 5,
          textAnchor: 'middle',
          textVerticalAnchor: 'top',
          text: 'Subsystem',
        },
      },
      ports: {
        items: [
          {
            id: 'i1',
            group: 'inSYS',
          },
          {
            id: 'o1',
            group: 'outSYS',
          },
        ],
        groups: {
          inSYS: {
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
                strokeWidth: 10,
                strokeOpacity: 0,
              },
              text: {
                fontSize: 12,
                fontWeight: 'bold',
                text: 'In1',
              },
            },
            position: {
              name: 'left',
            },
            label: {
              position: {
                name: 'right',
                args: {
                  x: 2,
                },
              },
            },
          },
          outSYS: {
            markup: [
              {
                tagName: 'path',
                selector: 'portBody',
                attrs: {
                  d: 'M 9 0 0 -5 0 -3 6 0 0 3 0 5 z',
                },
              },
            ],
            z: 1,
            attrs: {
              portBody: {
                magnet: true,
                stroke: '#000000',
                strokeWidth: 10,
                strokeOpacity: 0,
              },
              text: {
                fontSize: 12,
                fontWeight: 'bold',
                text: 'Out1',
              },
            },
            position: {
              name: 'right',
            },
            label: {
              position: {
                name: 'left',
                args: {
                  x: -2,
                },
              },
            },
          },
        },
      },
      data: {
        title: 'Subsystem',
        srcBlock: 'simulink/Ports & Subsystems/Subsystem',
        blockType: 'Subsystem',
        portTexts: ['In1', 'Out1'],
        description: 'Subsystem',
        paramLables: [],
        paramValues: [],
        level: 10,
      },
      graphJson: {},
    })
    graph.addNode({
      shape: 'rect',
      width: 52,
      height: 26,
      x: 60,
      y: 60,
      markup: [
        {
          tagName: 'rect',
          selector: 'body',
        },
        {
          tagName: 'text',
          selector: 'label',
        },
      ],
      attrs: {
        body: {
          strokeWidth: 2,
          rx: 13,
          ry: 13,
        },
        label: {
          refX: '50%',
          refY: '100%',
          refY2: 5,
          textAnchor: 'middle',
          textVerticalAnchor: 'top',
          text: 'In',
        },
      },
      ports: {
        items: [
          {
            id: 'o1',
            group: 'out',
          },
        ],
        groups: {
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
            z: 1,
            attrs: {
              portBody: {
                stroke: '#000000',
                magnet: true,
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
      data: {
        title: 'In',
        srcBlock: 'simulink/Ports & Subsystems/In1',
        blockType: 'In',
        description: 'Provide an input port for a subsystem or model.',
        paramLables: {
          No: 'No.',
        },
        paramValues: {
          No: 1,
        },
        level: 10,
      },
    })
    const node = graph.addNode({
      shape: 'text-block',
      width: 100,
      height: 60,
      attrs: {
        foreignObject: {
          refWidth: '100%',
          refHeight: null,
          refY: '100%',
        },
        label: {
          text: 'Subsystem',
        },
      },
      ports: {
        items: [
          {
            id: 'i1',
            group: 'inSYS',
          },
          {
            id: 'o1',
            group: 'outSYS',
          },
        ],
        groups: {
          inSYS: {
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
                strokeWidth: 10,
                strokeOpacity: 0,
              },
              // 不使用 text 属性设值，避免 text-block 的 attrHooks.text 拦截
              text: {
                fontSize: 12,
                fontWeight: 'bold',
              },
            },
            position: {
              name: 'left',
            },
            label: {
              // 通过 markup.textContent 设置文本，绕过 attrHooks.text
              markup: {
                tagName: 'text',
                selector: 'text',
                textContent: 'In1',
              },
              position: {
                name: 'right',
                args: {
                  x: 2,
                },
              },
            },
          },
          outSYS: {
            markup: [
              {
                tagName: 'path',
                selector: 'portBody',
                attrs: {
                  d: 'M 9 0 0 -5 0 -3 6 0 0 3 0 5 z',
                },
              },
            ],
            z: 1,
            attrs: {
              portBody: {
                magnet: true,
                stroke: '#000000',
                strokeWidth: 10,
                strokeOpacity: 0,
              },
              text: {
                fontSize: 12,
                fontWeight: 'bold',
              },
            },
            position: {
              name: 'right',
            },
            label: {
              markup: {
                tagName: 'text',
                selector: 'text',
                textContent: 'Out1',
              },
              position: {
                name: 'left',
                args: {
                  x: -2,
                },
              },
            },
          },
        },
      },
      data: {
        title: 'Subsystem',
        srcBlock: 'simulink/Ports & Subsystems/Subsystem',
        blockType: 'Subsystem',
        portTexts: ['In1', 'Out1'],
        description: 'Subsystem',
        paramLables: [],
        paramValues: [],
        level: 10,
      },
      graphJson: {},
    })
    // ── rAF 等视图挂载到 DOM 后修饰 label ────────────────────────── //
    requestAnimationFrame(() => {
      const view = graph.findViewByCell(node)
      if (!view) return
      const selectors = view._getSelectors()
      const labelDiv = selectors['label']
      if (!(labelDiv instanceof HTMLElement)) return

      Object.assign(labelDiv.style, {
        cursor: 'text',
        userSelect: 'text',
        outline: 'none',
        width: 'fit-content',
        height: 'auto',
        whiteSpace: 'pre',
        marginLeft: '50%',
        transform: 'translateX(-50%)',
      })
      labelDiv.contentEditable = 'plaintext-only'

      // 阻止 mousedown 冒泡，防止 X6 把 label 区域的点击解读为拖拽
      labelDiv.addEventListener('mousedown', (ev) => ev.stopPropagation())

      labelDiv.addEventListener('blur', () => {
        node.attr('label/text', labelDiv.textContent ?? '')
        window.getSelection()?.removeAllRanges()
      })
    })

    return () => {
      graph.dispose()
    }
  }, [])

  return (
    <div
      ref={graphContainerRef}
      style={{
        width: '100%',
        height: '100%',
      }}
    />
  )
}

export default DiagramModel
export { DiagramModel as Component } // Router Lazy
