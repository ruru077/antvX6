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

    // 注册 IntegratorBlock 形状
    Graph.registerNode('IntegratorBlock', {
      width: 100,
      height: 100,
      markup: [
        {
          tagName: 'rect',
          selector: 'body',
        },
        {
          tagName: 'image',
          selector: 'image',
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
          strokeWidth: 2,
          stroke: '#000000',
          fill: '#FFFFFF',
        },
        image: {
          xlinkHref:
            'data:image/png;base64,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',
          refWidth: '66%',
          refHeight: '66%',
          refDx: '-83%',
          refDy: '-83%',
        },
        label: {
          textVerticalAnchor: 'middle',
          textAnchor: 'middle',
          refX: '50%',
          refY: '120%',
          fontSize: 14,
          fill: '#000000',
          text: 'Integrator',
        },
        root: {
          magnet: false,
        },
      },
    })

    // 添加 IntegratorBlock 节点
    graph.addNode({
      x: 100,
      y: 100,
      shape: 'IntegratorBlock',
      data: {
        blockType: 'Integrator',
        title: 'Integrator',
        srcBlock: 'simulink/Continuous/Integrator',
        description: 'Continuous time intergration for the input signal.',
        paramValues: {
          InitialCondition: '0',
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
