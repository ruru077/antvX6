import { create } from 'zustand'
import { changeGraphView } from '@/services/subsystem-service'
import { useGraphStore } from '@/store/graphStore'
import { useSubGraphStore } from '@/store/subGraphStore'

interface TabItem {
  /** 唯一标识，= rootSubGraphId */
  key: string
  /** 选项卡入口子系统 */
  rootSubGraphId: string
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
  navigateWithin: (subGraphId: string) => void

  /** 打开或切换：若目标已有选项卡则切换，否则新建（面包屑、Tree 选择） */
  openOrSwitch: (subGraphId: string) => void

  /** 关闭选项卡 */
  closeTab: (key: string) => void

  /** 新增选项卡（+ 按钮，默认 rootId） */
  addTab: (subGraphId?: string) => void

  /** 拖拽排序 */
  reorderTabs: (fromKey: string, toKey: string) => void

  /** 后退 */
  goBack: () => void

  /** 前进 */
  goForward: () => void

  /** 跳转父级 */
  goUp: () => void

  /** 切换选项卡 */
  setActiveTab: (key: string) => void
}

const ROOT_ID = 'root'

function createTab(subGraphId: string): TabItem {
  return {
    key: subGraphId,
    rootSubGraphId: subGraphId,
    currentSubGraphId: subGraphId,
    history: [subGraphId],
    historyIndex: 0,
  }
}

/** 调用 changeGraphView 加载目标图层 */
function loadGraph(subGraphId: string) {
  const graph = useGraphStore.getState().graph
  if (graph) changeGraphView(subGraphId, graph)
}

const useSubSystemTabStore = create<SubSystemTabStore>((set, get) => ({
  tabs: [createTab(ROOT_ID)],
  activeKey: ROOT_ID,

  navigateWithin: (subGraphId) => {
    const { tabs, activeKey } = get()
    const tab = tabs.find((t) => t.key === activeKey)
    if (!tab) return
    if (tab.currentSubGraphId === subGraphId) return

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
    loadGraph(subGraphId)
  },

  openOrSwitch: (subGraphId) => {
    const { tabs, activeKey } = get()
    const existing = tabs.find((t) => t.rootSubGraphId === subGraphId)

    if (existing) {
      if (existing.key === activeKey) {
        // 同一选项卡 → 在内部导航到 root
        get().navigateWithin(subGraphId)
      } else {
        // 切换到已有选项卡
        set({ activeKey: existing.key })
        loadGraph(existing.currentSubGraphId)
      }
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

  addTab: (subGraphId) => {
    const targetId = subGraphId ?? useSubGraphStore.getState().rootId
    get().openOrSwitch(targetId)
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
    const nextTabs = tabs.map((t) =>
      t.key === activeKey
        ? { ...t, currentSubGraphId: targetId, historyIndex: newIndex }
        : t,
    )
    set({ tabs: nextTabs })
    loadGraph(targetId)
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
