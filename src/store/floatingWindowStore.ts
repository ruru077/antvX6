import { create } from 'zustand'
import type { LucideIcon } from 'lucide-react'

const FLOATING_WINDOW_Z_INDEX_BASE = 50

interface FloatingWindowEntry {
  id: string
  graphId: string
  title: string
  taskbarIcon: LucideIcon
  minimized: boolean
  zIndex: number
}

interface FloatingWindowStore {
  windows: FloatingWindowEntry[]
  activeIds: Record<string, string | null>
  registerWindow: (
    window: Pick<
      FloatingWindowEntry,
      'id' | 'graphId' | 'title' | 'taskbarIcon'
    >,
  ) => void
  updateWindow: (
    id: string,
    window: Pick<FloatingWindowEntry, 'title' | 'taskbarIcon'>,
  ) => void
  unregisterWindow: (id: string) => void
  activateWindow: (id: string) => void
  minimizeWindow: (id: string) => void
  restoreWindow: (id: string) => void
}

const taskbarAnchors = new Map<string, HTMLElement>()
const windowSurfaces = new Map<string, HTMLElement>()

function assignZIndexes(
  windows: FloatingWindowEntry[],
  graphId: string,
  topId?: string,
) {
  const graphWindows = windows.filter((window) => window.graphId === graphId)
  const stackingOrder = [...graphWindows].sort((a, b) => a.zIndex - b.zIndex)
  if (topId) {
    const topWindow = stackingOrder.find((window) => window.id === topId)
    if (!topWindow) throw new Error(`Floating window ${topId} is required`)
    stackingOrder.splice(stackingOrder.indexOf(topWindow), 1)
    stackingOrder.push(topWindow)
  }
  const zIndexes = new Map(
    stackingOrder.map((window, index) => [
      window.id,
      FLOATING_WINDOW_Z_INDEX_BASE + index,
    ]),
  )
  return windows.map((window) =>
    window.graphId === graphId
      ? { ...window, zIndex: zIndexes.get(window.id)! }
      : window,
  )
}

function getTopExpandedWindow(windows: FloatingWindowEntry[], graphId: string) {
  return (
    windows.reduce<FloatingWindowEntry | null>(
      (top, window) =>
        window.graphId === graphId &&
        !window.minimized &&
        (!top || window.zIndex > top.zIndex)
          ? window
          : top,
      null,
    )?.id ?? null
  )
}

const useFloatingWindowStore = create<FloatingWindowStore>((set) => ({
  windows: [],
  activeIds: {},

  registerWindow: (window) =>
    set((state) => {
      const windows = assignZIndexes(
        [
          ...state.windows.filter(({ id }) => id !== window.id),
          { ...window, minimized: false, zIndex: FLOATING_WINDOW_Z_INDEX_BASE },
        ],
        window.graphId,
        window.id,
      )
      return {
        windows,
        activeIds: { ...state.activeIds, [window.graphId]: window.id },
      }
    }),

  updateWindow: (id, window) =>
    set((state) => ({
      windows: state.windows.map((item) =>
        item.id === id ? { ...item, ...window } : item,
      ),
    })),

  unregisterWindow: (id) =>
    set((state) => {
      taskbarAnchors.delete(id)
      windowSurfaces.delete(id)
      const removedWindow = state.windows.find((window) => window.id === id)
      if (!removedWindow) return state
      const windows = assignZIndexes(
        state.windows.filter((window) => window.id !== id),
        removedWindow.graphId,
      )
      return {
        windows,
        activeIds: {
          ...state.activeIds,
          [removedWindow.graphId]:
            state.activeIds[removedWindow.graphId] === id
              ? getTopExpandedWindow(windows, removedWindow.graphId)
              : (state.activeIds[removedWindow.graphId] ?? null),
        },
      }
    }),

  activateWindow: (id) =>
    set((state) => {
      const window = state.windows.find((item) => item.id === id)
      if (!window || window.minimized || state.activeIds[window.graphId] === id)
        return state
      const windows = assignZIndexes(state.windows, window.graphId, id)
      return {
        windows,
        activeIds: { ...state.activeIds, [window.graphId]: id },
      }
    }),

  minimizeWindow: (id) =>
    set((state) => {
      const target = state.windows.find((window) => window.id === id)
      if (!target) return state
      const windows = state.windows.map((window) =>
        window.id === id ? { ...window, minimized: true } : window,
      )
      return {
        windows,
        activeIds: {
          ...state.activeIds,
          [target.graphId]:
            state.activeIds[target.graphId] === id
              ? getTopExpandedWindow(windows, target.graphId)
              : (state.activeIds[target.graphId] ?? null),
        },
      }
    }),

  restoreWindow: (id) =>
    set((state) => {
      const window = state.windows.find((item) => item.id === id)
      if (!window) return state
      const windows = assignZIndexes(
        state.windows.map((item) =>
          item.id === id ? { ...item, minimized: false } : item,
        ),
        window.graphId,
        id,
      )
      return {
        windows,
        activeIds: { ...state.activeIds, [window.graphId]: id },
      }
    }),
}))

function setFloatingWindowTaskbarAnchor(
  id: string,
  element: HTMLElement | null,
) {
  if (element) taskbarAnchors.set(id, element)
  else taskbarAnchors.delete(id)
}

function getFloatingWindowTaskbarAnchor(id: string): HTMLElement {
  const element = taskbarAnchors.get(id)
  if (!element) throw new Error(`Taskbar anchor is required for window ${id}`)
  return element
}

function setFloatingWindowSurface(id: string, element: HTMLElement | null) {
  if (element) windowSurfaces.set(id, element)
  else windowSurfaces.delete(id)
}

function focusFloatingWindow(id: string) {
  const element = windowSurfaces.get(id)
  if (!element) throw new Error(`Window surface is required for ${id}`)
  element.focus({ preventScroll: true })
}

function focusOrRestoreFloatingWindow(id: string) {
  const state = useFloatingWindowStore.getState()
  const window = state.windows.find((item) => item.id === id)
  if (!window) return false

  if (window.minimized) state.restoreWindow(id)
  else state.activateWindow(id)
  requestAnimationFrame(() => focusFloatingWindow(id))
  return true
}

export {
  FLOATING_WINDOW_Z_INDEX_BASE,
  focusFloatingWindow,
  focusOrRestoreFloatingWindow,
  getFloatingWindowTaskbarAnchor,
  setFloatingWindowTaskbarAnchor,
  setFloatingWindowSurface,
  useFloatingWindowStore,
}
export type { FloatingWindowEntry }
