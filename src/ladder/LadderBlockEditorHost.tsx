import { useEffect } from 'react'
import {
  captureNodeRoutes,
  ensureRoutingReady,
  finishNodeRoutes,
  routeNodeEdges,
} from '@/services/routing-service'
import { useGraphStore } from '@/store/graphStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import { assertLadderBlock } from './block'
import { commitLadderBlock } from './blockCommit'
import { useLadderBlockEditorStore } from './blockEditorStore'
import { ladderCanvasPorts } from './blockNode'
import LadderEditor from './LadderEditor'
import type { ladApi } from './api'
import './blockEditor.scss'

const unavailable = async (): Promise<never> => {
  throw new Error('嵌入梯形图使用父模型保存与仿真')
}
// The embedded host has no standalone HTTP session or model-library capability.
const embeddedServices: typeof ladApi = {
  models: unavailable,
  open: unavailable,
  save: unavailable,
  remove: unavailable,
  validate: unavailable,
  session: unavailable,
  step: unavailable,
  reset: unavailable,
  close: unavailable,
  compile: unavailable,
}

export default function LadderBlockEditorHost() {
  const target = useLadderBlockEditorStore((s) => s.target)
  const close = useLadderBlockEditorStore((s) => s.close)
  const running = useSimulationStore((s) => s.isRunning)
  const snapshot = useSimulationStore((s) =>
    target && Object.hasOwn(s.ladderSnapshots, target.nodeId)
      ? s.ladderSnapshots[target.nodeId]
      : null,
  )
  const graph = useGraphStore((s) => s.graph)
  useEffect(() => {
    if (!target || !graph) return
    // Keep the X6 instance and viewport; disable its global shortcuts behind the editor.
    const keyboard = graph.isKeyboardEnabled()
    graph.disableKeyboard()
    return () => {
      if (keyboard) graph.enableKeyboard()
    }
  }, [target, graph])
  if (!target) return null
  return (
    <div
      className="lad-block-overlay"
      role="dialog"
      aria-label={`编辑梯形图 ${target.name}`}
    >
      <LadderEditor
        key={`${target.graphId}:${target.nodeId}`}
        embedded
        services={embeddedServices}
        initialProgram={target.ladder.program}
        initialInterfacePorts={target.ladder.interfacePorts}
        initialName={target.name}
        readOnly={running}
        parentSnapshot={snapshot}
        onLeave={close}
        onApply={async (program, name, interfacePorts) => {
          if (useSimulationStore.getState().isRunning)
            throw new Error('父模型仿真期间不能修改程序')
          const state = useSubGraphStore.getState()
          if (!graph || state.currentGraphId !== target.graphId)
            throw new Error('父画布已切换，请返回后重新打开模块')
          const node = graph.getCellById(target.nodeId)
          if (!node?.isNode()) throw new Error('模块已被删除')
          const current = node.getData().ladder
          assertLadderBlock(current)
          if (JSON.stringify(current) !== JSON.stringify(target.ladder))
            throw new Error('模块已发生变化，请取消后重新打开')
          const next = { version: 1 as const, program, interfacePorts }
          // Resolve the asynchronous engine before opening the parent history transaction.
          await ensureRoutingReady()
          if (
            useLadderBlockEditorStore.getState().target !== target ||
            !graph.hasCell(node) ||
            useSubGraphStore.getState().currentGraphId !== target.graphId
          )
            throw new Error('编辑目标已关闭或切换，请重新打开模块')
          captureNodeRoutes(graph, [node])
          try {
            await commitLadderBlock(
              graph,
              node,
              next,
              ladderCanvasPorts(next),
              name,
              () => routeNodeEdges(graph, [node], { reason: 'ports' }),
            )
          } finally {
            finishNodeRoutes(graph, [node])
          }
          state.syncGraph(graph.toJSON())
          state.recomputeDirty()
          useSimulationStore.getState().clearLadderSnapshots()
          close()
        }}
      />
    </div>
  )
}
