import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// type ----------------------------------------------------
type Theme = 'light' | 'dark' | 'system'
type Locale = 'zh-CN' | 'en-US'

interface LibrarySettings {
  /** 数学函数 */
  mathFunctions: boolean
  /** 逻辑模块 */
  logicModules: boolean
  /** 信号源 */
  signalSources: boolean
  /** 自定义函数 */
  customFunctions: boolean
}

interface ConfigValues {
  // 外观
  theme: Theme
  fontSize: number
  compactMode: boolean
  // 语言
  locale: Locale
  timezone: string
  dateFormat: string
  // 库函数
  library: LibrarySettings
}

interface ConfigStore extends ConfigValues {
  setTheme: (theme: Theme) => void
  setFontSize: (size: number) => void
  setCompactMode: (enabled: boolean) => void
  setLocale: (locale: Locale) => void
  setTimezone: (tz: string) => void
  setDateFormat: (fmt: string) => void
  setLibrary: (key: keyof LibrarySettings, enabled: boolean) => void
}

// 默认值 ----------------------------------------------------
const DEFAULT_VALUES: ConfigValues = {
  theme: 'system',
  fontSize: 14,
  compactMode: false,
  locale: 'zh-CN',
  timezone: 'Asia/Shanghai',
  dateFormat: 'YYYY-MM-DD',
  library: {
    mathFunctions: true,
    logicModules: true,
    signalSources: true,
    customFunctions: false,
  },
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
      setLibrary: (key, enabled) =>
        set((s) => ({
          library: { ...s.library, [key]: enabled },
        })),
    }),
    { name: 'antv-link-config' },
  ),
)

// 页面加载时同步持久化的主题到 DOM（persist 异步 hydration 后触发）
useConfigStore.subscribe((state) => {
  resolveThemeClass(state.theme)
})

export { useConfigStore }
export type { ConfigValues, ConfigStore, LibrarySettings, Locale, Theme }
