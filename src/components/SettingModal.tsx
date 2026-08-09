import { ConfigProvider, Transfer } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import {
  Box,
  ChevronRight,
  Code2,
  Globe,
  Library,
  Paintbrush,
  Plus,
} from 'lucide-react'
import { useShallow } from 'zustand/shallow'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar'
import { Switch } from '@/components/ui/switch'
import { getLibraryNames } from '@/services/stencil-service'
import { useConfigStore } from '@/store/configStore'
import type { ConfigStore, Locale, Theme } from '@/store/configStore'

// type ----------------------------------------------------
interface SettingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface NavItem {
  name: string
  icon: React.ComponentType<{ className?: string }>
}

type SettingType = 'toggle' | 'select'

interface SettingItem {
  key: string
  label: string
  desc: string
  type: SettingType
  options?: { label: string; value: string | number }[]
}

// 模块常量 ----------------------------------------------------
const NAV_ITEMS: NavItem[] = [
  { name: '库函数', icon: Library },
  { name: '参数封装', icon: Box },
  { name: '外观', icon: Paintbrush },
  { name: '语言', icon: Globe },
]

const THEME_OPTIONS: { label: string; value: Theme }[] = [
  { label: '跟随系统', value: 'system' },
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
]

const FONT_SIZE_OPTIONS: { label: string; value: number }[] = [
  { label: '小 (12px)', value: 12 },
  { label: '默认 (14px)', value: 14 },
  { label: '大 (16px)', value: 16 },
  { label: '特大 (18px)', value: 18 },
]

const LOCALE_OPTIONS: { label: string; value: Locale }[] = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
]

const TIMEZONE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Asia/Shanghai (UTC+8)', value: 'Asia/Shanghai' },
  { label: 'Asia/Tokyo (UTC+9)', value: 'Asia/Tokyo' },
  { label: 'America/New_York (UTC-5)', value: 'America/New_York' },
  { label: 'Europe/London (UTC+0)', value: 'Europe/London' },
]

const DATE_FORMAT_OPTIONS: { label: string; value: string }[] = [
  { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
  { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
  { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
]

// 每个导航项对应的设置项 schema
const SETTING_SCHEMA: Record<string, SettingItem[]> = {
  库函数: [
    {
      key: 'stencilDefaultExpand',
      label: '库函数默认打开分组',
      desc: '开启后 stencil 面板中所有库函数分组默认展开。',
      type: 'toggle',
    },
  ],
  Mask封装: [],
  外观: [
    {
      key: 'theme',
      label: '主题',
      desc: '切换浅色、深色或跟随系统主题。',
      type: 'select',
      options: THEME_OPTIONS,
    },
    {
      key: 'fontSize',
      label: '字号',
      desc: '调整编辑器与面板的字体大小。',
      type: 'select',
      options: FONT_SIZE_OPTIONS,
    },
    {
      key: 'compactMode',
      label: '紧凑模式',
      desc: '减小间距以呈现更密集的布局。',
      type: 'toggle',
    },
  ],
  语言: [
    {
      key: 'locale',
      label: '界面语言',
      desc: '设置应用界面的显示语言。',
      type: 'select',
      options: LOCALE_OPTIONS,
    },
    {
      key: 'timezone',
      label: '时区',
      desc: '配置本地时区以正确显示时间。',
      type: 'select',
      options: TIMEZONE_OPTIONS,
    },
    {
      key: 'dateFormat',
      label: '日期格式',
      desc: '选择日期和时间的显示格式。',
      type: 'select',
      options: DATE_FORMAT_OPTIONS,
    },
  ],
}

// 工具 ----------------------------------------------------
/** GenericSettings 所需的配置切片类型 */
type ConfigSlice = Pick<
  ConfigStore,
  | 'theme'
  | 'fontSize'
  | 'compactMode'
  | 'locale'
  | 'timezone'
  | 'dateFormat'
  | 'setTheme'
  | 'setFontSize'
  | 'setCompactMode'
  | 'setLocale'
  | 'setTimezone'
  | 'setDateFormat'
>

function getConfigValue(
  store: ConfigSlice,
  key: string,
): boolean | string | number {
  return (store as unknown as Record<string, unknown>)[key] as
    | boolean
    | string
    | number
}

function setConfigValue(
  store: ConfigSlice,
  key: string,
  val: string | number,
): void {
  if (key === 'theme') store.setTheme(val as Theme)
  else if (key === 'fontSize') store.setFontSize(val as number)
  else if (key === 'compactMode')
    store.setCompactMode(val as unknown as boolean)
  else if (key === 'locale') store.setLocale(val as Locale)
  else if (key === 'timezone') store.setTimezone(val as string)
  else if (key === 'dateFormat') store.setDateFormat(val as string)
}

// 子组件 ----------------------------------------------------
function NavSidebar({
  active,
  onChange,
}: {
  active: string
  onChange: (n: string) => void
}) {
  return (
    <Sidebar collapsible="none" className="hidden md:flex">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold">
            库函数设置
          </SidebarGroupLabel>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.name === active}
                    onClick={() => onChange(item.name)}
                  >
                    <a href="#">
                      <item.icon />
                      <span>{item.name}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

function ToggleRow({
  item,
  value,
  onChange,
}: {
  item: SettingItem
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Label htmlFor={item.key}>{item.label}</Label>
        <p className="text-xs text-muted-foreground">{item.desc}</p>
      </div>
      <Switch id={item.key} checked={value} onCheckedChange={onChange} />
    </div>
  )
}

function SelectRow({
  item,
  value,
  onChange,
}: {
  item: SettingItem
  value: string | number
  onChange: (v: string | number) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-medium">{item.label}</div>
        <p className="text-xs text-muted-foreground">{item.desc}</p>
      </div>
      <select
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value
          const numOpt = item.options?.find((o) => String(o.value) === raw)
          onChange(
            numOpt && typeof numOpt.value === 'number' ? numOpt.value : raw,
          )
        }}
        className="shrink-0 h-8 rounded-lg border border-border bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring/50"
      >
        {item.options?.map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function LibraryContent({ onNewModule }: { onNewModule: () => void }) {
  const {
    hiddenStencilGroups,
    stencilDefaultExpand,
    setStencilDefaultExpand,
    setHiddenStencilGroups,
  } = useConfigStore(
    useShallow((s) => ({
      hiddenStencilGroups: s.hiddenStencilGroups,
      stencilDefaultExpand: s.stencilDefaultExpand,
      setStencilDefaultExpand: s.setStencilDefaultExpand,
      setHiddenStencilGroups: s.setHiddenStencilGroups,
    })),
  )
  const [open, setOpen] = useState(false)
  const [keys, setKeys] = useState<string[]>([])
  const transferRef = useRef<HTMLDivElement>(null)
  const names = getLibraryNames()
  const hidden = hiddenStencilGroups
  const count = names.length - hidden.length
  const data = names.map((n) => ({ key: n, title: n }))

  return (
    <>
      <ToggleRow
        item={SETTING_SCHEMA['库函数'][0]}
        value={stencilDefaultExpand}
        onChange={(v) => setStencilDefaultExpand(v)}
      />

      <div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">自定义显示的库函数组</div>
            <p className="text-xs text-muted-foreground">
              当前显示 {count}/{names.length} 个分组
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
            {open ? '收起' : '配置'}
          </Button>
        </div>
        {open && (
          <div ref={transferRef} className="relative mt-3 flex justify-center">
            <ConfigProvider
              locale={zhCN}
              getPopupContainer={() => transferRef.current || document.body}
            >
              <Transfer
                titles={['当前显示', '隐藏分组']}
                showSearch
                filterOption={(inputValue, item) =>
                  item.title.toLowerCase().includes(inputValue.toLowerCase())
                }
                dataSource={data}
                targetKeys={hidden}
                selectedKeys={keys}
                onChange={(next) => setHiddenStencilGroups(next as string[])}
                onSelectChange={(s, t) => setKeys([...s, ...t] as string[])}
                render={(item) => item.title}
                listStyle={{ width: 220, height: 270 }}
                footer={(_, info) =>
                  info?.direction === 'right' ? (
                    <Button
                      size="sm"
                      style={{
                        display: 'flex',
                        margin: 8,
                        marginInlineStart: 'auto',
                      }}
                      onClick={() => setHiddenStencilGroups([])}
                    >
                      全部显示
                    </Button>
                  ) : null
                }
              />
            </ConfigProvider>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">新增自定义模块</div>
          <p className="text-xs text-muted-foreground">
            创建并管理自定义的函数模块，配置参数与行为。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onNewModule}>
          <Plus /> 新增
        </Button>
      </div>
    </>
  )
}

function CustomModulePage({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
      <Code2 className="size-8" />
      <p className="text-sm">自定义模块管理</p>
      <p className="text-xs">功能开发中，敬请期待</p>
      <Button variant="ghost" size="sm" className="mt-2" onClick={onBack}>
        <ChevronRight className="rotate-180" /> 返回
      </Button>
    </div>
  )
}

function GenericSettings({ items }: { items: SettingItem[] }) {
  const store = useConfigStore()
  return (
    <>
      {items.map((item) => {
        const v = getConfigValue(store, item.key)
        return item.type === 'toggle' ? (
          <ToggleRow
            key={item.key}
            item={item}
            value={Boolean(v)}
            onChange={(next) => setConfigValue(store, item.key, Number(next))}
          />
        ) : (
          <SelectRow
            key={item.key}
            item={item}
            value={v as string | number}
            onChange={(next) => setConfigValue(store, item.key, next)}
          />
        )
      })}
    </>
  )
}

// UI -------------------------------------------------------
function SettingModal({ open, onOpenChange }: SettingModalProps) {
  const [activeNav, setActiveNav] = useState(NAV_ITEMS[0].name)
  const [subPage, setSubPage] = useState<string | null>(null)
  const items = SETTING_SCHEMA[subPage ? '' : activeNav] ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 md:max-h-[500px] md:max-w-[700px] lg:max-w-[800px]">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Customize your settings here.
        </DialogDescription>
        <SidebarProvider className="items-start">
          <NavSidebar
            active={activeNav}
            onChange={(name) => {
              setActiveNav(name)
              setSubPage(null)
            }}
          />
          <main className="flex h-[480px] flex-1 flex-col overflow-hidden">
            <div className="flex h-16 shrink-0 items-center px-4 text-sm font-medium" />
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">
              {subPage === '自定义模块' && (
                <CustomModulePage onBack={() => setSubPage(null)} />
              )}
              {!subPage && activeNav === '库函数' && (
                <LibraryContent onNewModule={() => setSubPage('自定义模块')} />
              )}
              {!subPage && activeNav !== '库函数' && (
                <GenericSettings items={items} />
              )}
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}

export { SettingModal }
