import { create } from 'zustand'
import { useShallow } from 'zustand/shallow'

type Theme = 'dark' | 'light' | 'system'
type ResolvedTheme = 'dark' | 'light'

const STORAGE_KEY = 'theme'
const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)'
const THEME_VALUES: Theme[] = ['dark', 'light', 'system']

// ── 工具函数 ─────────────────────────────────────────────────────────────────

function isTheme(value: string | null): value is Theme {
  if (value === null) return false
  return THEME_VALUES.includes(value as Theme)
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(COLOR_SCHEME_QUERY).matches ? 'dark' : 'light'
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme
}

function applyThemeClass(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
}

// ── Store ────────────────────────────────────────────────────────────────────

interface ThemeStore {
  theme: Theme
  /** 设置主题并持久化到 localStorage */
  setTheme: (theme: Theme) => void
  /** 在三态之间循环切换 */
  toggle: () => void
}

const useThemeToggleStore = create<ThemeStore>((set) => {
  // 初始化
  const stored = localStorage.getItem(STORAGE_KEY)
  const initial: Theme = isTheme(stored) ? stored : 'system'

  // 首次应用
  applyThemeClass(resolveTheme(initial))

  return {
    theme: initial,

    setTheme: (next) => {
      localStorage.setItem(STORAGE_KEY, next)
      set({ theme: next })
    },

    toggle: () => {
      set((s) => {
        const next =
          s.theme === 'dark'
            ? 'light'
            : s.theme === 'light'
              ? 'dark'
              : getSystemTheme() === 'dark'
                ? 'light'
                : 'dark'
        localStorage.setItem(STORAGE_KEY, next)
        return { theme: next }
      })
    },
  }
})

// ── 副作用（模块级，import 即生效）─────────────────────────────────────────

// 主题变化时同步 DOM class
useThemeToggleStore.subscribe((s) => {
  applyThemeClass(resolveTheme(s.theme))
})

// 监听系统主题变化
if (typeof window !== 'undefined') {
  const mql = window.matchMedia(COLOR_SCHEME_QUERY)
  mql.addEventListener('change', () => {
    const state = useThemeToggleStore.getState()
    if (state.theme === 'system') {
      applyThemeClass(getSystemTheme())
    }
  })
}

// D 快捷键切换
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (event.key.toLowerCase() !== 'd') return
    // 焦点在输入框时跳过
    const target = event.target
    if (target instanceof HTMLElement) {
      if (target.isContentEditable) return
      if (target.closest("input, textarea, select, [contenteditable='true']"))
        return
    }
    useThemeToggleStore.getState().toggle()
  })
}

// 跨标签页同步
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.storageArea !== localStorage || e.key !== STORAGE_KEY) return
    const store = useThemeToggleStore.getState()
    const incoming = isTheme(e.newValue) ? e.newValue : 'system'
    if (incoming !== store.theme) {
      store.setTheme(incoming)
    }
  })
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * 主题 hook：读取当前 theme 并提供 setTheme / toggle。
 * 在 App 层调用一次即可激活所有副作用（class、快捷键、跨标签页同步）。
 */
function useThemeToggle() {
  return useThemeToggleStore(
    useShallow((s) => ({
      theme: s.theme,
      setTheme: s.setTheme,
      toggle: s.toggle,
    })),
  )
}

export { useThemeToggle }
export type { Theme, ResolvedTheme }
