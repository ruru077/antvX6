import { useShallow } from 'zustand/shallow'
import { resolveThemeClass, useConfigStore } from '@/store/configStore'
import type { Theme } from '@/store/configStore'

type ResolvedTheme = 'dark' | 'light'

const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)'
const CONFIG_STORAGE_KEY = 'antv-link-config'

// ── 工具函数 ─────────────────────────────────────────────────────────────────

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(COLOR_SCHEME_QUERY).matches ? 'dark' : 'light'
}

function isTheme(value: string | null): value is Theme {
  return value === 'dark' || value === 'light' || value === 'system'
}

/** 在三态之间循环切换 */
function toggle() {
  const current = useConfigStore.getState().theme
  const next: Theme =
    current === 'dark'
      ? 'light'
      : current === 'light'
        ? 'dark'
        : getSystemTheme() === 'dark'
          ? 'light'
          : 'dark'
  useConfigStore.getState().setTheme(next)
}

// ── 副作用（模块级，import 即生效）─────────────────────────────────────────

// 监听系统主题变化：当 theme === 'system' 时同步 DOM
if (typeof window !== 'undefined') {
  const mql = window.matchMedia(COLOR_SCHEME_QUERY)
  mql.addEventListener('change', () => {
    if (useConfigStore.getState().theme === 'system') {
      resolveThemeClass('system')
    }
  })
}

// D 快捷键切换主题
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
    toggle()
  })
}

// 跨标签页同步：监听 configStore 的 persist key
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== CONFIG_STORAGE_KEY || !e.newValue) return
    try {
      const parsed = JSON.parse(e.newValue)
      const incomingTheme = parsed?.state?.theme
      if (
        isTheme(incomingTheme) &&
        incomingTheme !== useConfigStore.getState().theme
      ) {
        useConfigStore.getState().setTheme(incomingTheme)
      }
    } catch {
      // ignore parse errors
    }
  })
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * 主题 hook：读取当前 theme 并提供 setTheme / toggle。
 * 在 App 层调用一次即可激活所有副作用（class、快捷键、跨标签页同步）。
 */
function useThemeToggle() {
  return useConfigStore(
    useShallow((s) => ({
      theme: s.theme,
      setTheme: s.setTheme,
      toggle,
    })),
  )
}

export { useThemeToggle }
export type { Theme, ResolvedTheme }
