import { create } from 'zustand'

interface HistoryParamEntry {
  name: string
  value: string
}

interface HistoryParamBlock {
  label: string
  params: HistoryParamEntry[]
}

interface HistoryParamNotice {
  action: 'undo' | 'redo'
  blocks: HistoryParamBlock[]
  revision: number
}

interface HistoryParamNoticeStore {
  notice: HistoryParamNotice | null
  showNotice: (
    action: HistoryParamNotice['action'],
    blocks: HistoryParamBlock[],
  ) => void
  clearNotice: (revision: number) => void
}

const useHistoryParamNoticeStore = create<HistoryParamNoticeStore>((set) => ({
  notice: null,
  showNotice: (action, blocks) =>
    set((state) => ({
      notice: {
        action,
        blocks,
        revision: (state.notice?.revision ?? 0) + 1,
      },
    })),
  clearNotice: (revision) =>
    set((state) =>
      state.notice?.revision === revision ? { notice: null } : state,
    ),
}))

export { useHistoryParamNoticeStore }
export type { HistoryParamBlock }
