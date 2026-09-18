import Icon, {
  AppstoreOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useRequest } from 'ahooks'
import {
  Badge,
  Button,
  ConfigProvider,
  Dropdown,
  Input,
  Tabs,
  Tooltip,
} from 'antd'
import { fetchBlockResources } from '@/api/blocks'
import CollapseGroupsSvg from '@/assets/svg/stencil-collapse-groups.svg?react'
import ExpandGroupsSvg from '@/assets/svg/stencil-expand-groups.svg?react'
import { SettingModal } from '@/components/SettingModal'
import { Button as SButton } from '@/components/ui/button'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { createStencilService } from '@/services/stencil-service'
import { useConfigStore } from '@/store/configStore'
import { useGraphStore } from '@/store/graphStore'
import type { StencilArrangeMode } from '@/store/configStore'
import type { TextMatchOptions } from '~/types/common/text'
import '@styles/StencilPanel.scss'

// type ----------------------------------------------------
interface SearchRuleItem {
  key: keyof TextMatchOptions
  label: string
  text: string
}
type ActionsProps = {
  collapseAll: () => void
  expandAll: () => void
}
type SearchBarProps = {
  keyword: string
  searchOptions: TextMatchOptions
  viewMode: 'library' | 'results'
  setViewMode: (mode: 'library' | 'results') => void
  toggleRule: (ruleKey: keyof TextMatchOptions) => void
  updateKeyword: (keyword: string) => void
}
type StencilController = {
  actions: ActionsProps
  search: SearchBarProps
  stencilContainerRef: React.RefObject<HTMLDivElement | null>
}

// 模块常量 ----------------------------------------------------
const SEARCH_OPTIONS: TextMatchOptions = {
  regex: false,
  caseSensitive: false,
  wholeWord: false,
}
const SEARCH_RULE_ITEMS: SearchRuleItem[] = [
  { key: 'caseSensitive', label: '匹配大小写', text: 'Aa' },
  { key: 'wholeWord', label: '全字匹配', text: 'ab' },
  { key: 'regex', label: '正则匹配', text: '.*' },
]
const stencilService = createStencilService()

// hooks ------------------------------------------------------
function usePanelController(onReady: () => void): StencilController {
  const graph = useGraphStore((s) => s.graph)
  const stencilContainerRef = useRef<HTMLDivElement>(null)
  const { data: blockResources } = useRequest(fetchBlockResources, {
    cacheKey: 'version1',
    staleTime: -1,
    cacheTime: -1,
  })
  // 用户搜索词
  const [keyword, setKeyword] = useState('')
  // 当前的搜索视图模式，library 是显示库分组，results 是显示搜索结果
  const [viewMode, setViewModeState] = useState<'library' | 'results'>(
    'library',
  )
  // 搜索选项，如是否启用正则、大小写匹配和全字匹配
  const [searchOptions, setSearchOptions] =
    useState<TextMatchOptions>(SEARCH_OPTIONS)

  const syncSearchState = useEffectEvent(() => {
    stencilService.configSearchOptions(searchOptions)
    stencilService.syncSearchKeyword(keyword, viewMode)
  })
  /**
   * 挂载Effect，创建Stencil实例并在组件卸载时销毁实例
   */
  useEffect(() => {
    const container = stencilContainerRef.current
    if (!graph || !container || !blockResources) return
    let disposed = false

    void stencilService.create(container, blockResources).then((created) => {
      if (!created || disposed) return
      syncSearchState()
      onReady()
    })

    return () => {
      disposed = true
      stencilService.dispose()
    }
  }, [blockResources, graph])

  useEffect(() => {
    const container = stencilContainerRef.current
    if (!container) return

    const finishCollapse = (event: TransitionEvent) => {
      if (event.propertyName !== 'height') return
      const group = event.target
      if (
        !(group instanceof HTMLElement) ||
        !group.classList.contains('x6-widget-stencil-group') ||
        !group.classList.contains('is-collapsing')
      )
        return

      group.classList.remove('is-collapsing')
    }

    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        const group = record.target
        if (
          !(group instanceof HTMLElement) ||
          !group.classList.contains('x6-widget-stencil-group')
        )
          return

        const wasCollapsed =
          record.oldValue?.split(/\s+/).includes('collapsed') ?? false
        if (!wasCollapsed && group.classList.contains('collapsed')) {
          group.classList.add('is-collapsing')
        }
      })
    })

    observer.observe(container, {
      attributes: true,
      attributeFilter: ['class'],
      attributeOldValue: true,
      subtree: true,
    })
    container.addEventListener('transitionend', finishCollapse)
    container.addEventListener('transitioncancel', finishCollapse)

    return () => {
      observer.disconnect()
      container.removeEventListener('transitionend', finishCollapse)
      container.removeEventListener('transitioncancel', finishCollapse)
    }
  }, [])

  /**
   * SearchBar 相关的 Effect
   */
  useEffect(() => {
    syncSearchState()
  }, [keyword, searchOptions, viewMode])

  // 更新搜索词和视图模式的函数，自动切换模式
  function updateKeyword(nextKeyword: string) {
    setKeyword(nextKeyword)
    setViewModeState(nextKeyword.trim() ? 'results' : 'library')
  }

  function toggleRule(ruleKey: keyof TextMatchOptions) {
    setSearchOptions((value) => ({
      ...value,
      [ruleKey]: !value[ruleKey],
    }))
  }

  return {
    actions: {
      collapseAll: () => stencilService.collapseAll(),
      expandAll: () => stencilService.expandAll(),
    },
    search: {
      keyword,
      searchOptions,
      toggleRule,
      setViewMode: setViewModeState,
      updateKeyword,
      viewMode,
    },
    stencilContainerRef,
  }
}

// UI ---------------------------------------------------------
function StencilLayout({ onReady }: { onReady: () => void }) {
  const { actions, search, stencilContainerRef } = usePanelController(onReady)
  const [settingsOpen, setSettingsOpen] = useState(false)
  //TODO 参考百度贴吧的 hover悬浮效果，增加用户交互体验
  return (
    // 左侧面板禁用波纹 按需使用
    <ConfigProvider wave={{ disabled: true }}>
      <div className="stencil-wrapper">
        <Actions {...actions} onOpenSettings={() => setSettingsOpen(true)} />
        <SearchBar {...search} />
        <div ref={stencilContainerRef} className="stencil-mount"></div>
      </div>
      <SettingModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </ConfigProvider>
  )
}

// Stencil actions 组件，包含展开和折叠分组按钮
function Actions({
  collapseAll,
  expandAll,
  onOpenSettings,
}: ActionsProps & { onOpenSettings: () => void }) {
  return (
    <div className="stencil-actions">
      <Tooltip title="展开分组" mouseEnterDelay={0.2} placement="bottom">
        <Button
          size="small"
          className="stencil-icon-btn"
          icon={<Icon component={ExpandGroupsSvg} />}
          onClick={expandAll}
        />
      </Tooltip>
      <Tooltip title="折叠分组" mouseEnterDelay={0.2} placement="bottom">
        <Button
          size="small"
          className="stencil-icon-btn"
          icon={<Icon component={CollapseGroupsSvg} />}
          onClick={collapseAll}
        />
      </Tooltip>

      <HoverCard openDelay={10} closeDelay={100}>
        <HoverCardTrigger asChild>
          <SButton variant="link">V0.0.1</SButton>
        </HoverCardTrigger>
        <HoverCardContent className="flex w-64 flex-col gap-0.5">
          <div className="font-semibold">@ChangeLogs</div>
          <div>(1) 发布master分支</div>
          <div>(2) 进行master分支的回归测试</div>
          <a
            href="https://github.com/ruru077/antvX6/releases/tag/v0.0.1"
            target="_blank"
            rel="noreferrer"
            className="mt-1 text-xs text-muted-foreground hover:underline"
          >
            master date 08/25
          </a>
        </HoverCardContent>
      </HoverCard>

      <Tooltip title="模块设置" mouseEnterDelay={0.2} placement="bottom">
        <Button
          size="small"
          className="stencil-icon-btn"
          style={{ marginLeft: 'auto' }}
          icon={<SettingOutlined />}
          onClick={onOpenSettings}
        />
      </Tooltip>
    </div>
  )
}

// Stencil 搜索组件，包含搜索输入和搜索规则设置
function SearchBar(props: SearchBarProps) {
  const {
    keyword,
    searchOptions,
    toggleRule,
    updateKeyword,
    setViewMode,
    viewMode,
  } = props
  const searchKeyword = keyword.trim()
  const arrangeMode = useConfigStore((state) => state.stencilArrangeMode)
  const setArrangeMode = useConfigStore((state) => state.setStencilArrangeMode)

  return (
    <div className="stencil-search-shell">
      <div className="stencil-search-row">
        <Input
          size="small"
          className="stencil-search-input"
          placeholder="BLK_NAME"
          value={keyword}
          onChange={(event) => updateKeyword(event.target.value)}
          prefix={<SearchOutlined style={{ color: '#597ef7' }} />}
          suffix={
            <div className="stencil-search-rules">
              {SEARCH_RULE_ITEMS.map((item) => (
                <Tooltip
                  key={item.key}
                  title={item.label}
                  mouseEnterDelay={0.3}
                >
                  <Button
                    type="text"
                    size="small"
                    className="stencil-search-rule-trigger"
                    data-active={searchOptions[item.key]}
                    aria-label={item.label}
                    aria-pressed={searchOptions[item.key]}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => toggleRule(item.key)}
                  >
                    <span data-rule={item.key}>{item.text}</span>
                  </Button>
                </Tooltip>
              ))}
            </div>
          }
        />
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          menu={{
            selectable: true,
            selectedKeys: [arrangeMode],
            items: [
              { key: 'default', label: '默认布局' },
              { key: 'view-priority', label: '视图优先 Beta' },
              { key: 'module-priority', label: '模块优先 Beta' },
            ],
            onClick: ({ key }) => setArrangeMode(key as StencilArrangeMode),
          }}
        >
          <Tooltip title="排列方式" mouseEnterDelay={0.3}>
            <Button
              size="small"
              className="stencil-arrange-btn"
              aria-label="排列方式"
              icon={<AppstoreOutlined />}
            />
          </Tooltip>
        </Dropdown>
      </div>
      <Tabs
        type="card"
        size="small"
        animated
        tabBarGutter={0.3}
        activeKey={viewMode}
        onChange={(key) => setViewMode(key as 'library' | 'results')}
        className="stencil-search-nav"
        items={[
          { key: 'library', label: '标准库' },
          {
            key: 'results',
            label: `匹配结果:${searchKeyword}`,
          },
        ]}
      />
    </div>
  )
}

export { StencilLayout }
