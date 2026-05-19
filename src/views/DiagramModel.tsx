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
        body: {
          strokeWidth: 2,
        },
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
                fill: '#000000',
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
      graphJson: {
        cells: [
          {
            position: {
              x: 120,
              y: 390,
            },
            size: {
              width: 52,
              height: 26,
            },
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
            visible: true,
            shape: 'rect',
            id: '49c2b1b5-bced-468e-aa95-1747fd55fd33',
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
            ports: {
              items: [
                {
                  id: 'a288cf5a-808b-42ac-8631-05d9ef73fed7',
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
            zIndex: 1,
          },
          {
            position: {
              x: 322,
              y: 390,
            },
            size: {
              width: 52,
              height: 26,
            },
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
                text: 'Out',
              },
            },
            visible: true,
            shape: 'rect',
            id: '11836323-e27e-4607-a944-19e3c16b97f4',
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
            data: {
              title: 'Out',
              srcBlock: 'simulink/Ports & Subsystems/Out1',
              blockType: 'Out',
              description: 'Provide an output port for a subsystem or model.',
              paramLables: {
                No: 'No.',
              },
              paramValues: {
                No: 1,
              },
              level: 10,
            },
            ports: {
              items: [
                {
                  id: '86ad5397-db32-4d8b-b9ff-b9eec530496d',
                  group: 'in',
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
              },
            },
            zIndex: 2,
          },
          {
            shape: 'edge',
            attrs: {
              line: {
                strokeWidth: 1.5,
                targetMarker: {
                  name: 'block',
                  args: {
                    size: 15,
                  },
                },
              },
            },
            id: '1d857d06-f372-42a0-8061-491ddb5fee8a',
            source: {
              cell: '49c2b1b5-bced-468e-aa95-1747fd55fd33',
              port: 'a288cf5a-808b-42ac-8631-05d9ef73fed7',
            },
            target: {
              cell: '11836323-e27e-4607-a944-19e3c16b97f4',
              port: '86ad5397-db32-4d8b-b9ff-b9eec530496d',
            },
            zIndex: 3,
          },
        ],
      },
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
