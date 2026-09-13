import { create } from 'zustand'
import { changeGraphView } from '@/services/subsystem-service'
import { useGraphStore } from '@/store/graphStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import type { ChangeGraphViewOptions } from '@/services/subsystem-service'

interface TabItem {
  /** 选项卡稳定唯一标识 */
  key: string
  /** 当前正在查看的子系统 */
  currentSubGraphId: string
  /** 导航历史（subGraphId 序列） */
  history: string[]
  /** 当前在历史中的位置 */
  historyIndex: number
}

interface SubSystemTabStore {
  tabs: TabItem[]
  activeKey: string

  /** 在当前选项卡内导航（双击子系统、mask 点击） */
  navigateWithin: (subGraphId: string, options?: ChangeGraphViewOptions) => void

  /** 在标签页打开或切换：若目标已有选项卡则切换，否则新建 */
  openOrSwitch: (subGraphId: string) => void

  /** 关闭选项卡 */
  closeTab: (key: string) => void

  /** 关闭其他选项卡 */
  closeOtherTabs: (key: string) => void

  /** 拖拽排序 */
  reorderTabs: (fromKey: string, toKey: string) => void

  /** 在当前选项卡的图层历史中后退 */
  goBack: () => void

  /** 在当前选项卡的图层历史中前进 */
  goForward: () => void

  /** 删除已注销子系统的导航历史 */
  removeHistory: (subGraphIds: string[]) => void

  /** 跳转父级 */
  goUp: () => void

  /** 切换选项卡 */
  setActiveTab: (key: string) => void
}

const ROOT_ID = 'root'
let nextTabKey = 0

function createTab(subGraphId: string): TabItem {
  return {
    key: `subsystem-tab-${nextTabKey++}`,
    currentSubGraphId: subGraphId,
    history: [subGraphId],
    historyIndex: 0,
  }
}

function compactHistory(history: string[]) {
  return history.filter((id, index) => id !== history[index - 1])
}

const initialTab = createTab(ROOT_ID)

/** 调用 changeGraphView 加载目标图层 */
function loadGraph(subGraphId: string, options?: ChangeGraphViewOptions) {
  const graph = useGraphStore.getState().graph
  if (graph) changeGraphView(subGraphId, graph, options)
}

const useSubSystemTabStore = create<SubSystemTabStore>((set, get) => ({
  tabs: [initialTab],
  activeKey: initialTab.key,

  navigateWithin: (subGraphId, options) => {
    const { tabs, activeKey } = get()
    const tab = tabs.find((t) => t.key === activeKey)
    if (!tab) return
    if (tab.currentSubGraphId === subGraphId) return

    const existing = tabs.find(
      (item) => item.key !== activeKey && item.currentSubGraphId === subGraphId,
    )
    if (existing) {
      set({ activeKey: existing.key })
      loadGraph(existing.currentSubGraphId, options)
      return
    }

    // truncate 历史后 push
    const truncated = tab.history.slice(0, tab.historyIndex + 1)
    truncated.push(subGraphId)
    const nextTabs = tabs.map((t) =>
      t.key === activeKey
        ? {
            ...t,
            currentSubGraphId: subGraphId,
            history: truncated,
            historyIndex: truncated.length - 1,
          }
        : t,
    )
    set({ tabs: nextTabs })
    loadGraph(subGraphId, options)
  },

  openOrSwitch: (subGraphId) => {
    const { tabs, activeKey } = get()
    const existing = tabs.find((t) => t.currentSubGraphId === subGraphId)

    if (existing) {
      if (existing.key === activeKey) return
      set({ activeKey: existing.key })
      loadGraph(existing.currentSubGraphId)
    } else {
      // 新建选项卡
      const newTab = createTab(subGraphId)
      set({ tabs: [...tabs, newTab], activeKey: newTab.key })
      loadGraph(subGraphId)
    }
  },

  closeTab: (key) => {
    const { tabs, activeKey } = get()
    if (tabs.length <= 1) return // 至少保留一个

    const index = tabs.findIndex((t) => t.key === key)
    if (index === -1) return

    const nextTabs = tabs.filter((t) => t.key !== key)

    // 如果关闭的是活跃选项卡，切换到相邻
    if (key === activeKey) {
      const nextIndex = Math.min(index, nextTabs.length - 1)
      const nextTab = nextTabs[nextIndex]
      set({ tabs: nextTabs, activeKey: nextTab.key })
      loadGraph(nextTab.currentSubGraphId)
    } else {
      set({ tabs: nextTabs })
    }
  },

  closeOtherTabs: (key) => {
    const { tabs, activeKey } = get()
    const tab = tabs.find((item) => item.key === key)
    if (!tab || tabs.length <= 1) return

    set({ tabs: [tab], activeKey: key })
    if (key !== activeKey) loadGraph(tab.currentSubGraphId)
  },

  reorderTabs: (fromKey, toKey) => {
    const { tabs } = get()
    const fromIndex = tabs.findIndex((t) => t.key === fromKey)
    const toIndex = tabs.findIndex((t) => t.key === toKey)
    if (fromIndex === -1 || toIndex === -1) return

    const next = [...tabs]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    set({ tabs: next })
  },

  goBack: () => {
    const { tabs, activeKey } = get()
    const tab = tabs.find((t) => t.key === activeKey)
    if (!tab || tab.historyIndex <= 0) return

    const newIndex = tab.historyIndex - 1
    const targetId = tab.history[newIndex]
    const existing = tabs.find(
      (item) => item.key !== activeKey && item.currentSubGraphId === targetId,
    )
    if (existing) {
      set({ activeKey: existing.key })
      loadGraph(existing.currentSubGraphId)
      return
    }

    const nextTabs = tabs.map((t) =>
      t.key === activeKey
        ? { ...t, currentSubGraphId: targetId, historyIndex: newIndex }
        : t,
    )
    set({ tabs: nextTabs })
    loadGraph(targetId)
  },

  goForward: () => {
    const { tabs, activeKey } = get()
    const tab = tabs.find((t) => t.key === activeKey)
    if (!tab || tab.historyIndex >= tab.history.length - 1) return

    const newIndex = tab.historyIndex + 1
    const targetId = tab.history[newIndex]
    const existing = tabs.find(
      (item) => item.key !== activeKey && item.currentSubGraphId === targetId,
    )
    if (existing) {
      set({ activeKey: existing.key })
      loadGraph(existing.currentSubGraphId)
      return
    }

    const nextTabs = tabs.map((t) =>
      t.key === activeKey
        ? { ...t, currentSubGraphId: targetId, historyIndex: newIndex }
        : t,
    )
    set({ tabs: nextTabs })
    loadGraph(targetId)
  },

  removeHistory: (subGraphIds) => {
    const removedIds = new Set(subGraphIds)
    const { tabs, activeKey } = get()
    const cleanedTabs = tabs.flatMap((tab) => {
      const previousHistory = compactHistory(
        tab.history
          .slice(0, tab.historyIndex + 1)
          .filter((id) => !removedIds.has(id)),
      )
      const nextHistory = tab.history
        .slice(tab.historyIndex + 1)
        .filter((id) => !removedIds.has(id))
      const history = compactHistory([...previousHistory, ...nextHistory])

      if (history.length === 0) return []

      const historyIndex = Math.max(previousHistory.length - 1, 0)
      return [
        {
          ...tab,
          currentSubGraphId: history[historyIndex],
          history,
          historyIndex,
        },
      ]
    })
    const activeTab = cleanedTabs.find((tab) => tab.key === activeKey)
    const currentSubGraphIds = new Set(
      activeTab ? [activeTab.currentSubGraphId] : [],
    )
    const nextTabs = cleanedTabs.filter((tab) => {
      if (tab.key === activeKey) return true
      if (currentSubGraphIds.has(tab.currentSubGraphId)) return false
      currentSubGraphIds.add(tab.currentSubGraphId)
      return true
    })
    const nextActiveKey = nextTabs.some((tab) => tab.key === activeKey)
      ? activeKey
      : nextTabs[0].key
    set({ tabs: nextTabs, activeKey: nextActiveKey })
  },

  goUp: () => {
    const { tabs, activeKey } = get()
    const tab = tabs.find((t) => t.key === activeKey)
    if (!tab) return

    const { subGraphs } = useSubGraphStore.getState()
    const parentId = subGraphs[tab.currentSubGraphId]?.parentId
    if (!parentId) return

    get().navigateWithin(parentId)
  },

  setActiveTab: (key) => {
    const { tabs, activeKey } = get()
    if (key === activeKey) return
    const tab = tabs.find((t) => t.key === key)
    if (!tab) return

    set({ activeKey: key })
    loadGraph(tab.currentSubGraphId)
  },
}))

export { useSubSystemTabStore }
export type { TabItem }
