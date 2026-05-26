import {
  CaretDownFilled,
  default as Icon,
  LeftOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { Tooltip } from 'antd'
import CollapseGroupsSvg from '@/assets/svg/stencil-collapse-groups.svg?react'
import ExpandGroupsSvg from '@/assets/svg/stencil-expand-groups.svg?react'
import { createStencilService } from '@/services/stencil-service'
import { useGraphStore } from '@/store/graphStore'
import '@/styles/StencilPanel.scss'

type SearchViewMode = 'library' | 'results'
type SearchRuleKey = 'regex' | 'caseSensitive' | 'wholeWord'
type SearchOptions = Record<SearchRuleKey, boolean>

const MIN_WIDTH = 220
const MAX_WIDTH = 560
const DEFAULT_WIDTH = 320
const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  regex: false,
  caseSensitive: false,
  wholeWord: false,
}
const SEARCH_RULE_OPTIONS: Array<{ key: SearchRuleKey; label: string }> = [
  { key: 'regex', label: '正则表达式(R)' },
  { key: 'caseSensitive', label: '匹配大小写(C)' },
  { key: 'wholeWord', label: '全字匹配(W)' },
]

function StencilPanel() {
  const graph = useGraphStore((s) => s.graph)
  const stencilContainerRef = useRef<HTMLDivElement>(null)
  const stencilServiceRef = useRef<ReturnType<
    typeof createStencilService
  > | null>(null)
  const nativeSearchInputRef = useRef<HTMLInputElement | null>(null)
  const searchRulesMenuRef = useRef<HTMLDivElement>(null)
  const createdRef = useRef(false)
  // Stencil 折叠
  const [collapsed, setCollapsed] = useState(false)
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchViewMode, setSearchViewMode] =
    useState<SearchViewMode>('library')
  const [searchRulesMenuOpen, setSearchRulesMenuOpen] = useState(false)
  const [searchOptions, setSearchOptions] = useState<SearchOptions>(
    DEFAULT_SEARCH_OPTIONS,
  )
  const hasSearchKeyword = searchKeyword.trim().length > 0

  const createStencil = useEffectEvent(() => {
    if (!stencilContainerRef.current) return null
    const service = createStencilService(stencilContainerRef.current)
    stencilServiceRef.current = service
    createdRef.current = false
    if (!collapsed) {
      service.create()
      createdRef.current = true
    }
    return service
  })

  const applySearchState = useEffectEvent(() => {
    stencilServiceRef.current?.setSearchOptions(searchOptions)
    const input = nativeSearchInputRef.current
    if (!input) return
    input.value = searchViewMode === 'results' ? searchKeyword.trim() : ''
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })

  useEffect(() => {
    if (!graph) return
    const service = createStencil()
    if (!service) return
    return () => {
      service.dispose()
      stencilServiceRef.current = null
      nativeSearchInputRef.current = null
      createdRef.current = false
    }
  }, [graph])

  useEffect(() => {
    if (collapsed || !stencilServiceRef.current) return
    if (!createdRef.current) {
      stencilServiceRef.current.create()
      createdRef.current = true
      return
    }
    stencilServiceRef.current.setCollapsed(false)
  }, [collapsed])

  useEffect(() => {
    if (!searchRulesMenuOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (searchRulesMenuRef.current?.contains(target)) return
      setSearchRulesMenuOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [searchRulesMenuOpen])

  useEffect(() => {
    const container = stencilContainerRef.current
    if (!container) return

    const bindNativeSearchInput = () => {
      const input = container.querySelector<HTMLInputElement>(
        '.x6-widget-stencil-search input',
      )
      if (!input) return false
      nativeSearchInputRef.current = input
      applySearchState()
      return true
    }

    if (bindNativeSearchInput()) {
      return () => {
        nativeSearchInputRef.current = null
      }
    }

    const observer = new MutationObserver(() => {
      if (bindNativeSearchInput()) {
        observer.disconnect()
      }
    })

    observer.observe(container, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      nativeSearchInputRef.current = null
    }
  }, [graph, collapsed])

  useEffect(() => {
    applySearchState()
  }, [searchKeyword, searchOptions, searchViewMode])

  function handleExpandAll() {
    stencilServiceRef.current?.expandAll()
  }

  function handleCollapseAll() {
    stencilServiceRef.current?.collapseAll()
  }

  function handleToggleCollapsed() {
    setCollapsed((value) => !value)
  }

  function handleToggleSearchRulesMenu() {
    setSearchRulesMenuOpen((value) => !value)
  }

  function handleSearchChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextKeyword = event.target.value
    setSearchKeyword(nextKeyword)
    setSearchViewMode(nextKeyword.trim() ? 'results' : 'library')
  }

  function handleToggleSearchRule(ruleKey: SearchRuleKey) {
    setSearchOptions((value) => ({
      ...value,
      [ruleKey]: !value[ruleKey],
    }))
  }

  function handleResizeMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (collapsed) return
    event.preventDefault()
    const startX = event.clientX
    const startWidth = panelWidth
    const handleMouseMove = (mouseEvent: MouseEvent) => {
      const delta = mouseEvent.clientX - startX
      const newWidth = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, startWidth + delta),
      )
      setPanelWidth(newWidth)
    }
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div
      className="stencil-resizable"
      style={{ width: collapsed ? 0 : panelWidth }}
    >
      <div
        className={`stencil-wrapper${collapsed ? ' stencil-wrapper--collapsed' : ''}`}
      >
        {!collapsed && (
          <>
            <div className="stencil-actions">
              <Tooltip
                title="展开分组"
                mouseEnterDelay={0.2}
                placement="bottom"
              >
                <button className="stencil-icon-btn" onClick={handleExpandAll}>
                  <ExpandGroupsSvg />
                </button>
              </Tooltip>
              <Tooltip
                title="折叠分组"
                mouseEnterDelay={0.2}
                placement="bottom"
              >
                <button
                  className="stencil-icon-btn"
                  onClick={handleCollapseAll}
                >
                  <CollapseGroupsSvg />
                </button>
              </Tooltip>
            </div>
            <div className="stencil-search-shell">
              <div className="stencil-search-row">
                <label className="stencil-search-field">
                  <span
                    className="stencil-search-field-icon"
                    aria-hidden="true"
                  >
                    <SearchOutlined />
                  </span>
                  <input
                    type="search"
                    className="stencil-search-input"
                    placeholder="TO_BLOCK_NAME"
                    value={searchKeyword}
                    onChange={handleSearchChange}
                  />
                </label>
                <div
                  className={`stencil-search-rule${searchRulesMenuOpen ? ' is-open' : ''}`}
                  ref={searchRulesMenuRef}
                >
                  <button
                    type="button"
                    className="stencil-search-rule-btn"
                    onClick={handleToggleSearchRulesMenu}
                    title="搜索规则"
                    aria-label="搜索规则"
                    aria-haspopup="menu"
                    aria-expanded={searchRulesMenuOpen}
                  >
                    <span
                      className="stencil-search-rule-btn-icon"
                      aria-hidden="true"
                    >
                      <SearchOutlined />
                    </span>
                    <span
                      className="stencil-search-rule-btn-caret"
                      aria-hidden="true"
                    >
                      <CaretDownFilled />
                    </span>
                  </button>
                  {searchRulesMenuOpen && (
                    <div className="stencil-search-rule-menu" role="menu">
                      {SEARCH_RULE_OPTIONS.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          className={`stencil-search-rule-item${searchOptions[option.key] ? ' is-active' : ''}`}
                          onClick={() => handleToggleSearchRule(option.key)}
                          role="menuitemcheckbox"
                          aria-checked={searchOptions[option.key]}
                        >
                          <span
                            className="stencil-search-rule-item-check"
                            aria-hidden="true"
                          >
                            {searchOptions[option.key] ? '✓' : ''}
                          </span>
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div
                className="stencil-search-nav"
                role="tablist"
                aria-label="stencil search views"
              >
                <button
                  type="button"
                  className={`stencil-search-nav-btn${searchViewMode === 'library' ? ' is-active' : ''}`}
                  onClick={() => setSearchViewMode('library')}
                >
                  库
                </button>
                <button
                  type="button"
                  className={`stencil-search-nav-btn${searchViewMode === 'results' ? ' is-active' : ''}`}
                  onClick={() => setSearchViewMode('results')}
                  disabled={!hasSearchKeyword}
                >
                  {hasSearchKeyword
                    ? `搜索结果: ${searchKeyword.trim()}`
                    : '搜索结果'}
                </button>
              </div>
            </div>
          </>
        )}
        <div ref={stencilContainerRef} className="stencil-mount"></div>
      </div>
      <div
        className={`stencil-resize-handle${collapsed ? ' is-collapsed' : ''}`}
        aria-label="resize stencil panel"
        onMouseDown={handleResizeMouseDown}
      >
        <button
          type="button"
          className="stencil-collapse-handle-btn"
          title={collapsed ? '展开' : '收起'}
          aria-label={collapsed ? '展开 stencil panel' : '收起 stencil panel'}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={handleToggleCollapsed}
        >
          <LeftOutlined />
        </button>
      </div>
    </div>
  )
}

export { StencilPanel }
