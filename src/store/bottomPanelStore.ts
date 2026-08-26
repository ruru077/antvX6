import { create } from 'zustand'

const BOTTOM_PANEL_IDS = ['search', 'hierarchy', 'signal-analysis'] as const

type BottomPanelId = (typeof BOTTOM_PANEL_IDS)[number]

interface BottomPanelStore {
  openTabs: BottomPanelId[]
  activeTab: BottomPanelId | null
  visible: boolean
  togglePanel: (panelId: BottomPanelId) => void
  setActiveTab: (panelId: BottomPanelId) => void
  closePanel: () => void
}

function isBottomPanelId(panelId: string): panelId is BottomPanelId {
  return BOTTOM_PANEL_IDS.some((id) => id === panelId)
}

const useBottomPanelStore = create<BottomPanelStore>((set, get) => ({
  openTabs: [],
  activeTab: null,
  visible: false,

  togglePanel: (panelId) => {
    if (!isBottomPanelId(panelId)) return
    const { activeTab, openTabs, visible } = get()
    if (visible && activeTab === panelId) {
      set({ visible: false })
      return
    }
    set({
      openTabs: openTabs.includes(panelId) ? openTabs : [...openTabs, panelId],
      activeTab: panelId,
      visible: true,
    })
  },

  setActiveTab: (panelId) => {
    const { openTabs } = get()
    if (!isBottomPanelId(panelId) || !openTabs.includes(panelId)) return
    set({ activeTab: panelId, visible: true })
  },

  closePanel: () => set({ visible: false }),
}))

export { BOTTOM_PANEL_IDS, useBottomPanelStore }
export type { BottomPanelId }
