import { StencilService } from '@/services/stencil-service'
import '@/styles/BlockDiagram.scoped.scss'
import { Graph, Snapline } from '@antv/x6'
import { useEffect, useRef } from 'react'

function BlockDiagram() {
  const paperContainerRef = useRef<HTMLDivElement>(null)
  const stencilContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!paperContainerRef.current || !stencilContainerRef.current) return

    const graph = new Graph({
      container: paperContainerRef.current,
      background: { color: '#F2F7FA' },
      autoResize: true,
      grid: { visible: true, size: 10, type: 'dot' },
    })

    graph.use(new Snapline({ enabled: true, sharp: true }))

    // Initial sample nodes
    const source = graph.addNode({
      x: 160,
      y: 60,
      width: 100,
      height: 40,
      label: 'Hello',
      attrs: {
        body: { stroke: '#8f8f8f', strokeWidth: 1, fill: '#fff', rx: 6, ry: 6 },
      },
    })
    const target = graph.addNode({
      x: 350,
      y: 200,
      width: 100,
      height: 40,
      label: 'World',
      attrs: {
        body: { stroke: '#8f8f8f', strokeWidth: 1, fill: '#fff', rx: 6, ry: 6 },
      },
    })
    graph.addEdge({
      source,
      target,
      attrs: { line: { stroke: '#8f8f8f', strokeWidth: 1 } },
    })
    graph.centerContent()

    // Stencil
    const stencilService = new StencilService(stencilContainerRef.current)
    stencilService.create(graph)
    stencilService.setShapes(graph)

    return () => {
      stencilService.dispose()
      graph.dispose()
    }
  }, [])

  return (
    <div className="diagram-wrapper">
      {/* Visual-only toolbar — no functional event handlers */}
      <div className="toolbar-row">
        <div className="toolbar-left">
          <button className="toolbar-btn" title="File">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect
                x="2"
                y="1"
                width="9"
                height="14"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
              />
              <path
                d="M8 1v4h4"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
              />
            </svg>
          </button>
          <div className="toolbar-divider" />
          <button className="toolbar-btn" title="Undo">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3.5 5H9a4 4 0 0 1 0 8H5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M5.5 2.5L3 5l2.5 2.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>
          <button className="toolbar-btn" title="Redo">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M12.5 5H7a4 4 0 0 0 0 8h4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M10.5 2.5L13 5l-2.5 2.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>
          <div className="toolbar-divider" />
          <button className="toolbar-btn toolbar-dropdown">
            Layout
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              style={{ marginLeft: 4 }}
            >
              <path
                d="M2 3.5L5 6.5L8 3.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <div className="toolbar-right">
          <button className="toolbar-btn toolbar-dropdown">
            Canvas settings
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              style={{ marginLeft: 4 }}
            >
              <path
                d="M2 3.5L5 6.5L8 3.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="toolbar-divider" />
          <button className="toolbar-btn toolbar-btn--primary" title="Export">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 1v8M4 6l3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 10v2h10v-2"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button className="toolbar-btn toolbar-dropdown-arrow">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M2 3.5L5 6.5L8 3.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Main editor body */}
      <div className="app-body">
        <div className="stencil-container" ref={stencilContainerRef} />
        <div className="paper-container" ref={paperContainerRef} />
        {/* <div className="inspector-container">
          <div className="inspector-header">
            <span className="inspector-header-text">Properties</span>
          </div>
          <div className="inspector-content">
            <p className="inspector-empty">Select an element to inspect</p>
          </div>
        </div> */}
      </div>
    </div>
  )
}

export default BlockDiagram
export { BlockDiagram as Component }
