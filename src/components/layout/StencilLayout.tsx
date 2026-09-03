import Icon, {
  AppstoreOutlined,
  DownOutlined,
  FilterOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import {
  AutoComplete,
  Badge,
  Button,
  ConfigProvider,
  Dropdown,
  Input,
  Tabs,
  Tooltip,
} from 'antd'
import CollapseGroupsSvg from '@/assets/svg/stencil-collapse-groups.svg?react'
import ExpandGroupsSvg from '@/assets/svg/stencil-expand-groups.svg?react'
import { SettingModal } from '@/components/SettingModal'
import { Button as SButton } from '@/components/ui/button'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import {
  filterSearchHistory,
  getSearchHistory,
} from '@/services/search-history-service'
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
  { key: 'caseSensitive', label: '匹配大小写' },
  { key: 'wholeWord', label: '全字匹配' },
  { key: 'regex', label: '正则匹配' },
]
const stencilService = createStencilService()

// hooks ------------------------------------------------------
function usePanelController(): StencilController {
  const graph = useGraphStore((s) => s.graph)
  const stencilContainerRef = useRef<HTMLDivElement>(null)
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
    if (!graph || !container) return

    void stencilService.create(container).then((created) => {
      if (!created) return
      syncSearchState()
    })

    return () => {
      stencilService.dispose()
    }
  }, [graph])
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
function StencilLayout() {
  const { actions, search, stencilContainerRef } = usePanelController()
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
  const [ruleMenuOpen, setRuleMenuOpen] = useState(false)
  const [historyMode, setHistoryMode] = useState<'closed' | 'all' | 'matches'>(
    'closed',
  )
  const arrangeMode = useConfigStore((state) => state.stencilArrangeMode)
  const setArrangeMode = useConfigStore((state) => state.setStencilArrangeMode)

  const selectedRuleKeys = SEARCH_RULE_ITEMS.filter(
    (item) => searchOptions[item.key],
  ).map((item) => item.key)

  const historyItems =
    historyMode === 'all'
      ? getSearchHistory()
      : filterSearchHistory(searchKeyword)
  const historyOptions = historyItems.map((value) => ({ value }))
  const historyOpen = historyMode !== 'closed' && historyOptions.length > 0

  function changeKeyword(value: string) {
    updateKeyword(value)
    setHistoryMode(
      value.trim() && filterSearchHistory(value).length ? 'matches' : 'closed',
    )
  }

  const ruleButton = (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      open={ruleMenuOpen}
      onOpenChange={(open, info) => {
        if (open || info.source === 'trigger') setRuleMenuOpen(open)
      }}
      menu={{
        selectable: true,
        multiple: true,
        selectedKeys: selectedRuleKeys,
        items: SEARCH_RULE_ITEMS.map((item) => ({
          key: item.key,
          label: item.label,
        })),
        onClick: ({ key }) => toggleRule(key as keyof TextMatchOptions),
      }}
    >
      <Button
        size="small"
        data-active={selectedRuleKeys.length > 0}
        className="stencil-search-rule-trigger"
        aria-label="匹配规则"
        icon={<FilterOutlined />}
      />
    </Dropdown>
  )

  return (
    <div className="stencil-search-shell">
      <div className="stencil-search-row">
        <AutoComplete
          className="stencil-search-autocomplete"
          value={keyword}
          options={historyOptions}
          open={historyOpen}
          filterOption={false}
          onChange={changeKeyword}
          onSelect={(value) => {
            updateKeyword(value)
            setHistoryMode('closed')
          }}
          onOpenChange={(open) => {
            if (!open) setHistoryMode('closed')
          }}
        >
          <Input
            size="small"
            className="stencil-search-input"
            placeholder="TO_BLOCK_NAME"
            prefix={<SearchOutlined style={{ color: '#b6bcc2' }} />}
            suffix={
              <Button
                type="text"
                size="small"
                className="stencil-search-history-trigger"
                aria-label="搜索历史"
                icon={<DownOutlined />}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() =>
                  setHistoryMode(historyMode === 'all' ? 'closed' : 'all')
                }
              />
            }
          />
        </AutoComplete>
        {ruleButton}
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
