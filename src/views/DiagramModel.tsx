import { Graph } from '@antv/x6'
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
      x: 100,
      y: 40,
      width: 100,
      height: 40,
      attrs: {
        body: {
          fill: '#fff',
          stroke: '#8f8f8f',
          strokeWidth: 1,
        },
        label: {
          text: 'Integrator\nSecond-Order\nLimited\n',
          refX: 0.5,
          refY: '100%',
          refY2: 4,
          textAnchor: 'middle',
          textVerticalAnchor: 'top',
        },
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
