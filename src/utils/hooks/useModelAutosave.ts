import { useEffect } from 'react'
import { getAntdMessage } from '@/services/antd-message-service'
import {
  isSameModelContent,
  readModelAutosave,
  removeModelAutosave,
  writeModelAutosave,
} from '@/services/model-autosave-service'
import { useNcslabContextStore } from '@/services/ncslab-context-service'
import { useGraphStore } from '@/store/graphStore'
import { useInterpreterStore } from '@/store/interpreterStore'
import { useSubGraphStore } from '@/store/subGraphStore'

export function useModelAutosave(active: boolean, modelId?: number | string) {
  const graph = useGraphStore((state) => state.graph)
  const userId = useNcslabContextStore((state) => state.context?.user.id)

  useEffect(() => {
    if (!active || !graph || modelId == null || userId == null) return
    let notified = false
    let wroteAutosave = false
    const timer = window.setInterval(() => {
      try {
        const store = useSubGraphStore.getState()
        store.syncGraph(graph.toJSON())
        store.recomputeDirty()
        if (!useSubGraphStore.getState().isDirty) {
          // 本轮编辑撤销回数据库内容时，清除本轮生成的旧草稿。
          if (wroteAutosave) {
            removeModelAutosave(userId, modelId)
            wroteAutosave = false
          }
          return
        }
        const content = {
          graphModel: store.exportEntryGraphModel(),
          config: useInterpreterStore.getState().config,
        }
        const previous = readModelAutosave(userId, modelId)
        if (previous && isSameModelContent(previous, content)) return
        writeModelAutosave(userId, modelId, content)
        wroteAutosave = true
        notified = false
      } catch (error) {
        if (!notified) {
          getAntdMessage().warning(
            `本地自动保存失败：${error instanceof Error ? error.message : String(error)}`,
          )
          notified = true
        }
      }
    }, 10_000)
    return () => window.clearInterval(timer)
  }, [active, graph, modelId, userId])
}
