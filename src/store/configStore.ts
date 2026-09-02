import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'

// type ----------------------------------------------------
type Theme = 'light' | 'dark' | 'system'
type Locale = 'zh-CN' | 'en-US'
type StencilArrangeMode = 'default' | 'view-priority' | 'module-priority'

interface ConfigValues {
  // 外观
  theme: Theme
  fontSize: number
  compactMode: boolean
  // 语言
  locale: Locale
  timezone: string
  dateFormat: string
  // 实验功能
  metaContextMenuEnabled: boolean
  betaGroupEnabled: boolean
  // Stencil
  stencilDefaultExpand: boolean
  stencilPreviewEnabled: boolean
  stencilArrangeMode: StencilArrangeMode
  selectionMovingRouterFallbackEnabled: boolean
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
  setMetaContextMenuEnabled: (enabled: boolean) => void
  setBetaGroupEnabled: (enabled: boolean) => void
  setStencilDefaultExpand: (enabled: boolean) => void
  setStencilPreviewEnabled: (enabled: boolean) => void
  setStencilArrangeMode: (mode: StencilArrangeMode) => void
  setSelectionMovingRouterFallbackEnabled: (enabled: boolean) => void
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
  metaContextMenuEnabled: false,
  betaGroupEnabled: false,
  stencilDefaultExpand: false,
  stencilPreviewEnabled: false,
  stencilArrangeMode: 'default',
  selectionMovingRouterFallbackEnabled: false,
  hiddenStencilGroups: [],
}

// 主题工具 ----------------------------------------------------
export function resolveThemeClass(theme: Theme) {
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
  subscribeWithSelector(
    persist(
      (set) => ({
        ...DEFAULT_VALUES,

        setTheme: (theme) => set({ theme }),
        setFontSize: (fontSize) => set({ fontSize }),
        setCompactMode: (compactMode) => set({ compactMode }),
        setLocale: (locale) => set({ locale }),
        setTimezone: (timezone) => set({ timezone }),
        setDateFormat: (dateFormat) => set({ dateFormat }),
        setMetaContextMenuEnabled: (metaContextMenuEnabled) =>
          set({ metaContextMenuEnabled }),
        setBetaGroupEnabled: (betaGroupEnabled) => set({ betaGroupEnabled }),
        setStencilDefaultExpand: (stencilDefaultExpand) =>
          set({ stencilDefaultExpand }),
        setStencilPreviewEnabled: (stencilPreviewEnabled) =>
          set({ stencilPreviewEnabled }),
        setStencilArrangeMode: (stencilArrangeMode) =>
          set({ stencilArrangeMode }),
        setSelectionMovingRouterFallbackEnabled: (
          selectionMovingRouterFallbackEnabled,
        ) => set({ selectionMovingRouterFallbackEnabled }),
        setHiddenStencilGroups: (hiddenStencilGroups) =>
          set({ hiddenStencilGroups }),
      }),
      { name: 'antv-link-config' },
    ),
  ),
)

// 初始主题同步（persist hydration 后 theme 已是持久化值）
resolveThemeClass(useConfigStore.getState().theme)

// 主题变化时同步 DOM（subscribeWithSelector 只在 theme 字段变化时触发）
useConfigStore.subscribe(
  (state) => state.theme,
  (theme) => resolveThemeClass(theme),
)

export { useConfigStore }
export type { ConfigValues, ConfigStore, Locale, StencilArrangeMode, Theme }
