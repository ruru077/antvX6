import {
  AArrowDown,
  AArrowUp,
  BrushCleaning,
  ChevronDown,
  ClipboardCopy,
  ClipboardPaste,
  Component,
  Copy,
  Eye,
  EyeOff,
  FlipHorizontal,
  FlipVertical,
  LayoutGrid,
  Palette,
  PanelTop,
  Paintbrush,
  Redo2,
  Route,
  RotateCcw,
  RotateCw,
  Search,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Type,
  Undo2,
} from 'lucide-react'
import {
  ContextMenu as ContextMenu_,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  createContextMenuService,
  selectContextNode,
  type ContextMenuService,
} from '@/services/contextMenu-servicer'
import { useGraphStore } from '@/store/graphStore'
import type { Cell, EventArgs, Node } from '@antv/x6'

type ContextInfo =
  | { type: 'blank' }
  | { type: 'toolbar' }
  | { type: 'node'; cell: Cell }
  | { type: 'edge'; cell: Cell }

/**
 * 画布右键菜单（shadcn/Radix 实现）。
 *
 * useContextMenu hook 负责桥接 X6 右键事件到 paper-container（trigger），
 * 本组件根据右键目标类型分发不同的菜单内容。
 */
function ContextMenu({
  children,
  toolbarsVisible,
  onToggleToolbars,
}: {
  children: React.ReactNode
  toolbarsVisible?: boolean
  onToggleToolbars?: () => void
}) {
  const graph = useGraphStore((s) => s.graph)
  const ctxRef = useRef<ContextInfo>({ type: 'blank' })
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0)
  const [open, setOpen] = useState(false)

  // ── 菜单打开时拦截滚轮，防止画布缩放/平移（键盘已由 modal=false 原生拦截）──
  useEffect(() => {
    if (!open) return
    function onWheel(e: WheelEvent) {
      const target = e.target instanceof Element ? e.target : null
      const insideMenu = target?.closest('[data-slot="context-menu-content"]')
      if (!target) return
      // 菜单内容内的滚轮放行
      if (insideMenu) return
      e.preventDefault()
    }

    document.addEventListener('wheel', onWheel, {
      passive: false,
      capture: true,
    })
    return () => {
      console.log('[ContextMenu] 滚轮拦截已注销')
      document.removeEventListener('wheel', onWheel, { capture: true })
    }
  }, [open])

  // ── X6 事件 → 更新菜单上下文 ─────────────────────────────────────────
  useEffect(() => {
    if (!graph) return

    function onBlank() {
      ctxRef.current = { type: 'blank' }
      forceUpdate()
    }
    function onCell(args: EventArgs['cell:contextmenu']) {
      const isNode = args.cell.isNode()
      if (isNode) selectContextNode(graph, args.cell)
      ctxRef.current = {
        type: isNode ? 'node' : 'edge',
        cell: args.cell,
      }
      forceUpdate()
    }

    graph.on('blank:contextmenu', onBlank)
    graph.on('cell:contextmenu', onCell)
    return () => {
      graph.off('blank:contextmenu', onBlank)
      graph.off('cell:contextmenu', onCell)
    }
  }, [graph])

  // ── 捕获阶段检测工具栏右键 ──────────────────────────────────────────
  useEffect(() => {
    function onContextMenu(e: MouseEvent) {
      if ((e.target as HTMLElement)?.closest?.('.canvas-float-toolbar')) {
        ctxRef.current = { type: 'toolbar' }
        forceUpdate()
      }
    }
    document.addEventListener('contextmenu', onContextMenu, true)
    return () =>
      document.removeEventListener('contextmenu', onContextMenu, true)
  }, [])

  const ctx = ctxRef.current
  const usesSplitMenu =
    ctx.type === 'blank' || ctx.type === 'edge' || ctx.type === 'node'

  return (
    <ContextMenu_
      modal={false}
      onOpenChange={(o) => {
        setOpen(o)
      }}
    >
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent
        className={
          usesSplitMenu
            ? 'w-64 overflow-visible bg-transparent p-0 shadow-none ring-0'
            : 'w-48'
        }
      >
        {ctx.type === 'blank' ? (
          <BlankMenu service={createContextMenuService(graph)} />
        ) : ctx.type === 'toolbar' ? (
          <ToolbarMenu visible={toolbarsVisible} onToggle={onToggleToolbars} />
        ) : ctx.type === 'node' ? (
          <NodeMenu
            service={createContextMenuService(graph, ctx.cell)}
            node={ctx.cell as Node}
          />
        ) : (
          <EdgeMenu service={createContextMenuService(graph, ctx.cell)} />
        )}
      </ContextMenuContent>
    </ContextMenu_>
  )
}

// ── 空白区域 ─────────────────────────────────────────────────────────────

function FloatingToolbar({ context }: { context: ContextInfo['type'] }) {
  const operationMenu = {
    label: '操作',
    topActions: [
      { icon: BrushCleaning, label: '格式化' },
      { icon: LayoutGrid, label: '自动排列' },
      { icon: Component, label: '模块图标' },
    ],
    bottomActions:
      context === 'blank'
        ? [
            { icon: Undo2, label: '撤销' },
            { icon: Redo2, label: '重做' },
            { icon: ClipboardPaste, label: '粘贴' },
            { icon: ClipboardCopy, label: '粘贴输入端口副本' },
          ]
        : context === 'node'
          ? [
              { icon: Scissors, label: '剪切' },
              { icon: Copy, label: '复制' },
              { icon: ClipboardPaste, label: '粘贴' },
              { icon: Route, label: '复制路径' },
            ]
          : [
              { icon: Scissors, label: '剪切' },
              { icon: Copy, label: '复制' },
              { icon: ClipboardPaste, label: '粘贴' },
            ],
  } satisfies ToolbarGroupData

  const propertyMenu =
    context === 'blank'
      ? {
          label: '属性',
          topActions: [{ icon: Palette, label: '背景颜色' }],
          bottomActions: [{ icon: Type, label: '画布字体' }],
        }
      : context === 'node'
        ? {
            label: '属性',
            topActions: [
              { icon: Palette, label: '背景颜色' },
              { icon: Type, label: '字体大小' },
              { icon: AArrowUp, label: '放大字体' },
              { icon: AArrowDown, label: '缩小字体' },
            ],
            bottomActions: [
              { icon: Paintbrush, label: '前景颜色' },
              { icon: Eye, label: '显示/隐藏模块名称' },
              { icon: PanelTop, label: '内容预览' },
              { icon: SlidersHorizontal, label: '字体属性' },
            ],
          }
        : {
            label: '属性',
            topActions: [
              { icon: Type, label: '字体大小' },
              { icon: AArrowUp, label: '放大字体' },
              { icon: AArrowDown, label: '缩小字体' },
            ],
            bottomActions: [
              { icon: Eye, label: '显示/隐藏模块名称' },
              { icon: PanelTop, label: '内容预览' },
              { icon: SlidersHorizontal, label: '字体属性' },
            ],
          }

  const groups = [operationMenu, propertyMenu]
  if (context === 'node') {
    groups.push({
      label: '旋转',
      topActions: [
        { icon: RotateCw, label: '顺时针旋转' },
        { icon: RotateCcw, label: '逆时针旋转' },
      ],
      bottomActions: [
        { icon: FlipHorizontal, label: '左右翻转' },
        { icon: FlipVertical, label: '上下翻转' },
      ],
    })
  }

  return (
    <div className="mb-2 flex w-max overflow-hidden rounded-md border bg-popover p-1 shadow-lg">
      {groups.map((group, index) => (
        <ToolbarGroup key={group.label} group={group} separated={index > 0} />
      ))}
    </div>
  )
}

type ToolbarAction = { icon: typeof BrushCleaning; label: string }
type ToolbarGroupData = {
  label: string
  topActions: ToolbarAction[]
  bottomActions: ToolbarAction[]
}

const FONT_SIZE_OPTIONS = [
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '14',
  '16',
  '18',
  '20',
  '22',
  '24',
  '26',
  '28',
  '36',
  '48',
  '72',
]

function ToolbarGroup({
  group,
  separated,
}: {
  group: ToolbarGroupData
  separated: boolean
}) {
  const columns = Math.max(group.topActions.length, group.bottomActions.length)

  return (
    <ContextMenuGroup
      aria-label={group.label}
      className={cn('grid grid-rows-2 gap-0.5 px-1', separated && 'border-l')}
      style={{ gridTemplateColumns: `repeat(${columns}, max-content)` }}
    >
      {group.topActions.map(({ icon: Icon, label }) => (
        <ToolbarActionItem key={label} icon={Icon} label={label} />
      ))}
      {Array.from({ length: columns - group.topActions.length }).map(
        (_, index) => (
          <span key={index} aria-hidden />
        ),
      )}
      {group.bottomActions.map(({ icon: Icon, label }) => (
        <ToolbarActionItem key={label} icon={Icon} label={label} />
      ))}
    </ContextMenuGroup>
  )
}

function ToolbarActionItem({ icon: Icon, label }: ToolbarAction) {
  if (label === '字体大小') return <FontSizeSelect />

  const hasDropdownIndicator =
    label === '背景颜色' ||
    label === '前景颜色' ||
    label === '显示/隐藏模块名称'

  const item = (
    <ContextMenuItem
      className={cn(
        'h-7 justify-center p-0',
        hasDropdownIndicator ? 'w-9 gap-0.5' : 'w-7',
      )}
      aria-label={label}
      title={label}
      onSelect={(event) => {
        if (hasDropdownIndicator) {
          event.preventDefault()
        }
      }}
    >
      <Icon />
      {hasDropdownIndicator && <ChevronDown className="!size-2.5" />}
    </ContextMenuItem>
  )

  if (label === '显示/隐藏模块名称') {
    return (
      <Popover>
        <PopoverTrigger asChild>{item}</PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={8}
          className="w-48 p-0"
        >
          <VisibilityPanel />
        </PopoverContent>
      </Popover>
    )
  }

  if (label !== '背景颜色' && label !== '前景颜色') return item

  return (
    <Popover>
      <PopoverTrigger asChild>{item}</PopoverTrigger>
      <PopoverContent align="start" side="bottom" sideOffset={8}>
        <BackgroundColorPalette />
      </PopoverContent>
    </Popover>
  )
}

function FontSizeSelect() {
  return (
    <Select defaultValue="10">
      <SelectTrigger
        aria-label="字体大小"
        title="字体大小"
        size="sm"
        className="h-6 w-10 gap-0.5 rounded-sm border-border bg-background px-1 py-0 shadow-none data-[size=sm]:h-6 *:data-[slot=select-value]:min-w-4 *:data-[slot=select-value]:justify-center *:data-[slot=select-value]:text-[10px] [&_svg]:!size-3"
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        align="start"
        sideOffset={4}
        className="min-w-12 rounded-sm p-0 [&_svg]:hidden"
      >
        <SelectGroup className="p-0.5">
          {FONT_SIZE_OPTIONS.map((size) => (
            <SelectItem
              key={size}
              value={size}
              className="rounded-sm py-1 pr-2 pl-2 text-xs"
            >
              {size}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function VisibilityPanel() {
  return (
    <div className="text-xs">
      <div className="grid grid-cols-[56px_1fr] items-center border-b bg-muted/50 px-2 py-1.5">
        <span className="font-medium">可见性</span>
        <VisibilityRadio label="自动名称" />
      </div>
      <div className="grid grid-cols-[56px_1fr] px-2 py-1.5">
        <span aria-hidden />
        <div className="flex flex-col gap-1.5">
          <VisibilityRadio label="名称打开" />
          <VisibilityRadio label="名称关闭" />
        </div>
      </div>
      <div className="border-t bg-muted/50 px-2 py-1 font-medium">模型设置</div>
      <label className="flex cursor-default items-center justify-between gap-3 px-2 py-1.5">
        <span>隐藏自动模块名称</span>
        <input
          type="checkbox"
          defaultChecked
          className="size-3.5 accent-primary"
        />
      </label>
    </div>
  )
}

function VisibilityRadio({ label }: { label: string }) {
  return (
    <label className="flex cursor-default items-center gap-1.5 whitespace-nowrap">
      <input type="radio" name="module-name-visibility" className="size-3.5" />
      <span>{label}</span>
    </label>
  )
}

const STANDARD_COLORS = [
  '#1d4ed8',
  '#0f766e',
  '#ca8a04',
  '#9333ea',
  '#dc2626',
  '#ec4899',
  '#f97316',
  '#facc15',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#64748b',
  '#f8fafc',
  '#d1d5db',
  '#6b7280',
  '#111827',
]

const RECENT_COLORS = [
  '#ef4444',
  '#ec4899',
  '#facc15',
  '#22c55e',
  '#06b6d4',
  '#2563eb',
]

function BackgroundColorPalette() {
  return (
    <div className="flex flex-col gap-3">
      <ColorSwatchGroup label="标准颜色" colors={STANDARD_COLORS} />
      <ColorSwatchGroup label="最近使用的颜色" colors={RECENT_COLORS} />
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">预览</span>
        <div className="h-8 rounded-sm border bg-background" />
      </div>
    </div>
  )
}

function ColorSwatchGroup({
  label,
  colors,
}: {
  label: string
  colors: string[]
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium">{label}</span>
      <div className="grid grid-cols-8 gap-1">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            className="size-5 rounded-sm border border-foreground/20 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ backgroundColor: color }}
            aria-label={color}
            title={color}
          />
        ))}
      </div>
    </div>
  )
}

function BlankCanvasMenu({ service }: { service: ContextMenuService }) {
  return (
    <div className="rounded-3xl bg-popover p-1.5 shadow-lg ring-1 ring-foreground/5">
      <ContextMenuLabel className="font-semibold text-foreground">
        建模
      </ContextMenuLabel>
      <ContextMenuGroup>
        <ContextMenuItem disabled>
          <Search />
          探索 (feat)
        </ContextMenuItem>
        <ContextMenuItem disabled>
          <Sparkles />
          使用 Copilot 解释 (feat)
        </ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuItem disabled>模型设置 (feat)</ContextMenuItem>
        <ContextMenuItem disabled>运行 (feat)</ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>选择 App... (feat)</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem disabled>代码生成 (feat)</ContextMenuItem>
            <ContextMenuItem disabled>定点工具 (feat)</ContextMenuItem>
            <ContextMenuItem disabled>需求查看器 (feat)</ContextMenuItem>
            <ContextMenuItem disabled>模型顾问 (feat)</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuItem onClick={service.selectAll}>全选</ContextMenuItem>
        <ContextMenuItem disabled>取消突出显示 (feat)</ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>系统封装</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem
              disabled={!service.canCreateSubsystem}
              onClick={service.createSubsystem}
            >
              创建系统封装
            </ContextMenuItem>
            <ContextMenuItem disabled>系统封装参数 (feat)</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuGroup>
    </div>
  )
}

function BlankMenu({ service }: { service: ContextMenuService }) {
  return (
    <>
      <FloatingToolbar context="blank" />
      <BlankCanvasMenu service={service} />
    </>
  )
}

// ── 悬浮工具栏 ──────────────────────────────────────────────────────────

function ToolbarMenu({
  visible,
  onToggle,
}: {
  visible?: boolean
  onToggle?: () => void
}) {
  if (!onToggle) return null
  return (
    <ContextMenuGroup>
      <ContextMenuItem onClick={onToggle}>
        {visible ? (
          <EyeOff className="mr-2 size-4" />
        ) : (
          <Eye className="mr-2 size-4" />
        )}
        {visible ? '隐藏悬浮工具' : '显示悬浮工具'}
      </ContextMenuItem>
    </ContextMenuGroup>
  )
}

// ── Node ────────────────────────────────────────────────────────────────

function NodeMenu({
  service,
  node,
}: {
  service: ContextMenuService
  node: Node
}) {
  const isSubsystem = node.getData()?.blockType === 'Subsystem'
  if (!isSubsystem) {
    const title =
      node.attr<string>('label/text') || node.getData()?.title || '模块'
    return (
      <>
        <FloatingToolbar context="node" />
        <div className="rounded-3xl bg-popover p-1.5 shadow-lg ring-1 ring-foreground/5">
          <ContextMenuLabel className="font-semibold text-foreground">
            {title}
          </ContextMenuLabel>
          <ContextMenuGroup>
            <ContextMenuItem onClick={service.openNodeParameters}>
              打开
            </ContextMenuItem>
            <ContextMenuItem disabled>
              <Search />
              探索 (feat)
            </ContextMenuItem>
            <ContextMenuItem disabled>
              <Sparkles />
              使用 Copilot 解释 (feat)
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuItem onClick={service.openNodeParameters}>
              参数
            </ContextMenuItem>
            <ContextMenuItem disabled>为原子 (feat)</ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuSub>
              <ContextMenuSubTrigger>选择 App... (feat)</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem disabled>代码生成 (feat)</ContextMenuItem>
                <ContextMenuItem disabled>定点工具 (feat)</ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                基于所选内容创建子系统
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem
                  disabled={!service.canCreateSubsystem}
                  onClick={service.createSubsystem}
                >
                  常规子系统
                </ContextMenuItem>
                <ContextMenuItem disabled>原子子系统 (feat)</ContextMenuItem>
                <ContextMenuItem disabled>使能子系统 (feat)</ContextMenuItem>
                <ContextMenuItem disabled>触发子系统 (feat)</ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSub>
              <ContextMenuSubTrigger>转换为 (feat)</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem disabled>可变子系统 (feat)</ContextMenuItem>
                <ContextMenuItem disabled>引用模型 (feat)</ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSub>
              <ContextMenuSubTrigger>查看封装 (feat)</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem disabled>查看封装 (feat)</ContextMenuItem>
                <ContextMenuItem disabled>封装参数 (feat)</ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSub>
              <ContextMenuSubTrigger>转至库 (feat)</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem disabled>
                  在库浏览器中查看 (feat)
                </ContextMenuItem>
                <ContextMenuItem disabled>库链接管理器 (feat)</ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuItem disabled>调试 (feat)</ContextMenuItem>
          </ContextMenuGroup>
        </div>
      </>
    )
  }

  return <SubsystemMenu service={service} />
}

function SubsystemMenu({ service }: { service: ContextMenuService }) {
  return (
    <>
      <FloatingToolbar context="node" />
      <div className="rounded-3xl bg-popover p-1.5 shadow-lg ring-1 ring-foreground/5">
        <ContextMenuLabel className="font-semibold text-foreground">
          Subsystem
        </ContextMenuLabel>
        <ContextMenuGroup>
          <ContextMenuItem onClick={service.openSubsystem}>
            打开
          </ContextMenuItem>
          <ContextMenuItem disabled>
            <Search />
            探索 (feat)
          </ContextMenuItem>
          <ContextMenuItem disabled>
            <Sparkles />
            使用 Copilot 解释 (feat)
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem onClick={service.openNodeParameters}>
            参数
          </ContextMenuItem>
          <ContextMenuItem disabled>为原子 (feat)</ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuSub>
            <ContextMenuSubTrigger>选择 App... (feat)</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem disabled>代码生成 (feat)</ContextMenuItem>
              <ContextMenuItem disabled>定点工具 (feat)</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              基于所选内容创建子系统
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem
                disabled={!service.canCreateSubsystem}
                onClick={service.createSubsystem}
              >
                常规子系统
              </ContextMenuItem>
              <ContextMenuItem disabled>原子子系统 (feat)</ContextMenuItem>
              <ContextMenuItem disabled>使能子系统 (feat)</ContextMenuItem>
              <ContextMenuItem disabled>触发子系统 (feat)</ContextMenuItem>
              <ContextMenuItem disabled>函数调用子系统 (feat)</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSub>
            <ContextMenuSubTrigger>转换为 (feat)</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem disabled>可变子系统 (feat)</ContextMenuItem>
              <ContextMenuItem disabled>引用子系统 (feat)</ContextMenuItem>
              <ContextMenuItem disabled>引用模型 (feat)</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuItem disabled>展开 (feat)</ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>创建封装</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem
                disabled={service.hasSubsystemMask}
                onClick={service.createSubsystemMask}
              >
                创建封装
              </ContextMenuItem>
              <ContextMenuItem onClick={service.openSubsystem}>
                查看封装内部
              </ContextMenuItem>
              <ContextMenuItem onClick={service.openNodeParameters}>
                封装参数
              </ContextMenuItem>
              <ContextMenuItem disabled>添加图像 (feat)</ContextMenuItem>
              <ContextMenuItem disabled>删除图像 (feat)</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuItem disabled>调试 (feat)</ContextMenuItem>
        </ContextMenuGroup>
      </div>
    </>
  )
}

// ── Edge ────────────────────────────────────────────────────────────────

function EdgeMenu({ service }: { service: ContextMenuService }) {
  return (
    <>
      <FloatingToolbar context="edge" />
      <div className="rounded-3xl bg-popover p-1.5 shadow-lg ring-1 ring-foreground/5">
        <ContextMenuLabel className="font-semibold text-foreground">
          信号
        </ContextMenuLabel>
        <ContextMenuGroup>
          <ContextMenuItem disabled>跟踪信号 (feat)</ContextMenuItem>
          <ContextMenuItem disabled>总线与信号层次结构 (feat)</ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuLabel>属性</ContextMenuLabel>
        <ContextMenuGroup>
          <ContextMenuItem disabled>属性 (feat)</ContextMenuItem>
          <ContextMenuItem disabled>记录信号 (feat)</ContextMenuItem>
          <ContextMenuItem disabled>在数据检查器中查看 (feat)</ContextMenuItem>
          <ContextMenuItem disabled>添加查看器 (feat)</ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>编辑查看器 (feat)</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem disabled>记录和查看器 (feat)</ContextMenuItem>
              <ContextMenuItem disabled>测试点 (feat)</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuSub>
            <ContextMenuSubTrigger>选择 App... (feat)</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem disabled>代码生成 (feat)</ContextMenuItem>
              <ContextMenuItem disabled>需求查看器 (feat)</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuItem disabled>
            转换为 Goto/From 模块 (feat)
          </ContextMenuItem>
          <ContextMenuItem disabled>调试 (feat)</ContextMenuItem>
        </ContextMenuGroup>
      </div>
    </>
  )
}

export { ContextMenu }
