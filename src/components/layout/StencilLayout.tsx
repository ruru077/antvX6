import Icon, { SearchOutlined, SettingOutlined } from '@ant-design/icons'
import { Button, ConfigProvider, Input, Tabs, Tooltip } from 'antd'
import type { TextMatchOptions } from '~/types/common/text'
import CollapseGroupsSvg from '@/assets/svg/stencil-collapse-groups.svg?react'
import ExpandGroupsSvg from '@/assets/svg/stencil-expand-groups.svg?react'
import { createStencilService } from '@/services/stencil-service'
import { useGraphStore } from '@/store/graphStore'
import '@styles/StencilPanel.scss'

// type ----------------------------------------------------
interface SearchRuleItem {
  key: keyof TextMatchOptions
  label: string
  icon: string
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
  updateKeyword: (event: React.ChangeEvent<HTMLInputElement>) => void
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
  { key: 'caseSensitive', label: '匹配大小写', icon: 'Aa' },
  { key: 'wholeWord', label: '全字匹配', icon: 'ab' },
  { key: 'regex', label: '正则匹配', icon: '.*' },
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
  function updateKeyword(event: React.ChangeEvent<HTMLInputElement>) {
    const nextKeyword = event.target.value
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
  //TODO 参考百度贴吧的 hover悬浮效果，增加用户交互体验
  return (
    // 左侧面板禁用波纹 按需使用
    <ConfigProvider wave={{ disabled: true }}>
      <div className="stencil-wrapper">
        <Actions {...actions} />
        <SearchBar {...search} />
        <div ref={stencilContainerRef} className="stencil-mount"></div>
      </div>
    </ConfigProvider>
  )
}

// Stencil actions 组件，包含展开和折叠分组按钮
function Actions(props: ActionsProps) {
  const { collapseAll, expandAll } = props

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
      <Tooltip title="模块设置" mouseEnterDelay={0.2} placement="bottom">
        <Button
          size="small"
          className="stencil-icon-btn"
          style={{ marginLeft: 'auto' }}
          icon={<SettingOutlined />}
          onClick={() => alert('模块设置功能开发中，敬请期待！')}
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

  const ruleSuffix = (
    <div className="stencil-search-rules">
      {SEARCH_RULE_ITEMS.map((item) => (
        <Tooltip key={item.key} title={item.label} mouseEnterDelay={0.3}>
          <button
            type="button"
            data-active={searchOptions[item.key]}
            className="stencil-search-rule-btn"
            onClick={() => toggleRule(item.key)}
          >
            {item.icon}
          </button>
        </Tooltip>
      ))}
    </div>
  )

  return (
    <div className="stencil-search-shell">
      <div className="stencil-search-row">
        <Input
          size="small"
          className="stencil-search-input"
          placeholder="TO_BLOCK_NAME"
          value={keyword}
          onChange={updateKeyword}
          prefix={<SearchOutlined style={{ color: '#b6bcc2' }} />}
          suffix={ruleSuffix}
        />
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
