import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// type ----------------------------------------------------
type Theme = 'light' | 'dark' | 'system'
type Locale = 'zh-CN' | 'en-US'

interface ConfigValues {
  // 外观
  theme: Theme
  fontSize: number
  compactMode: boolean
  // 语言
  locale: Locale
  timezone: string
  dateFormat: string
  // Stencil
  stencilDefaultExpand: boolean
  // 过滤/隐藏的分组列表（空 = 全部显示）
  hiddenStencilGroups: string[]
}

interface ConfigStore extends ConfigValues {
  setTheme: (theme: Theme) => void
  setFontSize: (size: number) => void
  setCompactMode: (enabled: boolean) => void
  setLocale: (locale: Locale) => void
  setTimezone: (tz: string) => void
  setDateFormat: (fmt: string) => void
  setStencilDefaultExpand: (enabled: boolean) => void
  setHiddenStencilGroups: (groups: string[]) => void
}

// 默认值 ----------------------------------------------------
const DEFAULT_VALUES: ConfigValues = {
  theme: 'system',
  fontSize: 16,
  compactMode: false,
  locale: 'zh-CN',
  timezone: 'Asia/Shanghai',
  dateFormat: 'YYYY-MM-DD',
  stencilDefaultExpand: false,
  hiddenStencilGroups: [],
}

// 主题工具 ----------------------------------------------------
function resolveThemeClass(theme: Theme) {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
}

// Store ----------------------------------------------------
const useConfigStore = create<ConfigStore>()(
  persist(
    (set) => ({
      ...DEFAULT_VALUES,

      setTheme: (theme) => {
        resolveThemeClass(theme)
        set({ theme })
      },
      setFontSize: (fontSize) => set({ fontSize }),
      setCompactMode: (compactMode) => set({ compactMode }),
      setLocale: (locale) => set({ locale }),
      setTimezone: (timezone) => set({ timezone }),
      setDateFormat: (dateFormat) => set({ dateFormat }),
      setStencilDefaultExpand: (stencilDefaultExpand) =>
        set({ stencilDefaultExpand }),
      setHiddenStencilGroups: (hiddenStencilGroups) =>
        set({ hiddenStencilGroups }),
    }),
    { name: 'antv-link-config' },
  ),
)

// 页面加载时同步持久化的主题到 DOM（persist 异步 hydration 后触发）
useConfigStore.subscribe((state) => {
  resolveThemeClass(state.theme)
})

export { useConfigStore }
export type { ConfigValues, ConfigStore, Locale, Theme }
