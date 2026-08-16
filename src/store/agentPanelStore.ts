import { create } from 'zustand'

const useAgentPanelStore = create<{
  visible: boolean
  toggle: () => void
  close: () => void
}>((set) => ({
  visible: false,
  toggle: () => set((state) => ({ visible: !state.visible })),
  close: () => set({ visible: false }),
}))

export { useAgentPanelStore }
