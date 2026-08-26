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
import { flushSync } from 'react-dom'
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
import { Switch } from '@/components/ui/switch'
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
 * 当前桥接逻辑已内聚到本组件，确保菜单上下文先于 Radix 打开事件更新。
 */
function ContextMenu({
  children,
  enabled = true,
  toolbarsVisible,
  onToggleToolbars,
}: {
  children: React.ReactNode
  enabled?: boolean
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

  // ── X6 事件 → 更新菜单上下文并触发 Radix 菜单 ─────────────────────────
  useEffect(() => {
    if (!graph || !enabled) return
    const paper = graph.container.closest<HTMLElement>('.paper-container')
    if (!paper) return

    function openMenu(
      context: ContextInfo,
      event: { clientX: number; clientY: number },
    ) {
      flushSync(() => {
        ctxRef.current = context
        forceUpdate()
      })
      paper?.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: event.clientX,
          clientY: event.clientY,
        }),
      )
    }

    function onBlank(args: EventArgs['blank:contextmenu']) {
      openMenu({ type: 'blank' }, args.e)
    }

    function onNode(args: EventArgs['node:contextmenu']) {
      selectContextNode(graph, args.node)
      openMenu({ type: 'node', cell: args.node }, args.e)
    }

    function onEdge(args: EventArgs['edge:contextmenu']) {
      openMenu({ type: 'edge', cell: args.edge }, args.e)
    }

    graph.on('blank:contextmenu', onBlank)
    graph.on('node:contextmenu', onNode)
    graph.on('edge:contextmenu', onEdge)
    return () => {
      graph.off('blank:contextmenu', onBlank)
      graph.off('node:contextmenu', onNode)
      graph.off('edge:contextmenu', onEdge)
    }
  }, [enabled, graph])

  // ── 捕获阶段检测工具栏右键 ──────────────────────────────────────────
  useEffect(() => {
    function onContextMenu(e: MouseEvent) {
      if ((e.target as HTMLElement)?.closest?.('.canvas-float-toolbar')) {
        flushSync(() => {
          ctxRef.current = { type: 'toolbar' }
          forceUpdate()
        })
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
      <ContextMenuTrigger disabled={!enabled} className="flex min-h-0 flex-1">
        {children}
      </ContextMenuTrigger>
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

function FloatingToolbar({
  context,
  service,
}: {
  context: ContextInfo['type']
  service: ContextMenuService
}) {
  const operationMenu = {
    label: '操作',
    topActions: [
      {
        icon: BrushCleaning,
        label: '格式化',
        onSelect: service.formatDiagram,
      },
      {
        icon: LayoutGrid,
        label: '自动排列',
        onSelect: service.autoArrange,
      },
      {
        icon: Component,
        label: '模块图标',
        onSelect: service.addSubsystemImage,
        disabled: !service.canSetModuleIcon,
      },
    ],
    bottomActions:
      context === 'blank'
        ? [
            {
              icon: Undo2,
              label: '撤销',
              onSelect: service.undo,
              disabled: !service.canUndo,
            },
            {
              icon: Redo2,
              label: '重做',
              onSelect: service.redo,
              disabled: !service.canRedo,
            },
            {
              icon: ClipboardPaste,
              label: '粘贴',
              onSelect: service.paste,
              disabled: !service.canPaste,
            },
            {
              icon: ClipboardCopy,
              label: '粘贴输入端口副本',
              disabled: true,
            },
          ]
        : context === 'node'
          ? [
              { icon: Scissors, label: '剪切', onSelect: service.cut },
              { icon: Copy, label: '复制', onSelect: service.copy },
              {
                icon: ClipboardPaste,
                label: '粘贴',
                onSelect: service.paste,
                disabled: !service.canPaste,
              },
              {
                icon: Route,
                label: '复制路径',
                onSelect: service.copyBlockPath,
                disabled: !service.canCopyBlockPath,
              },
            ]
          : [
              { icon: Scissors, label: '剪切', onSelect: service.cut },
              { icon: Copy, label: '复制', onSelect: service.copy },
              {
                icon: ClipboardPaste,
                label: '粘贴',
                onSelect: service.paste,
                disabled: !service.canPaste,
              },
            ],
  } satisfies ToolbarGroupData

  const propertyMenu: ToolbarGroupData =
    context === 'blank'
      ? {
          label: '属性',
          topActions: [
            {
              icon: Palette,
              label: '背景颜色',
              onColorSelect: service.setCanvasBackgroundColor,
            },
          ],
          bottomActions: [
            {
              icon: Type,
              label: '画布字体',
              control: (
                <CanvasFontSelect
                  value={service.canvasFontFamily}
                  onValueChange={service.setCanvasFontFamily}
                />
              ),
            },
          ],
        }
      : context === 'node'
        ? {
            label: '属性',
            topActions: [
              {
                icon: Palette,
                label: '背景颜色',
                onColorSelect: service.setNodeBackgroundColor,
              },
              {
                icon: Type,
                label: '字体大小',
                control: (
                  <FontSizeSelect
                    value={String(service.labelFontSize)}
                    onValueChange={(value) =>
                      service.setLabelFontSize(Number(value))
                    }
                  />
                ),
              },
              {
                icon: AArrowUp,
                label: '放大字体',
                onSelect: service.increaseLabelFontSize,
              },
              {
                icon: AArrowDown,
                label: '缩小字体',
                onSelect: service.decreaseLabelFontSize,
              },
            ],
            bottomActions: [
              {
                icon: Paintbrush,
                label: '前景颜色',
                onColorSelect: service.setLabelColor,
              },
              {
                icon: Eye,
                label: '显示/隐藏模块名称',
                visible: !service.isLabelHidden,
                onVisibleChange: service.setLabelVisible,
              },
              { icon: PanelTop, label: '内容预览', disabled: true },
              { icon: SlidersHorizontal, label: '字体属性', disabled: true },
            ],
          }
        : {
            label: '属性',
            topActions: [
              { icon: Type, label: '字体大小', disabled: true },
              { icon: AArrowUp, label: '放大字体', disabled: true },
              { icon: AArrowDown, label: '缩小字体', disabled: true },
            ],
            bottomActions: [
              { icon: Eye, label: '显示/隐藏模块名称', disabled: true },
              { icon: PanelTop, label: '内容预览', disabled: true },
              { icon: SlidersHorizontal, label: '字体属性', disabled: true },
            ],
          }

  const groups: ToolbarGroupData[] = [operationMenu, propertyMenu]
  if (context === 'node') {
    groups.push({
      label: '旋转',
      topActions: [
        {
          icon: RotateCw,
          label: '顺时针旋转',
          onSelect: service.rotateClockwise,
        },
        {
          icon: RotateCcw,
          label: '逆时针旋转',
          onSelect: service.rotateCounterclockwise,
        },
      ],
      bottomActions: [
        { icon: FlipHorizontal, label: '左右翻转', disabled: true },
        { icon: FlipVertical, label: '上下翻转', disabled: true },
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

type ToolbarAction = {
  icon: typeof BrushCleaning
  label: string
  onSelect?: () => void
  disabled?: boolean
  control?: React.ReactNode
  onColorSelect?: (color: string) => void
  visible?: boolean
  onVisibleChange?: (visible: boolean) => void
}
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
      {group.topActions.map((action) => (
        <ToolbarActionItem key={action.label} {...action} />
      ))}
      {Array.from({ length: columns - group.topActions.length }).map(
        (_, index) => (
          <span key={index} aria-hidden />
        ),
      )}
      {group.bottomActions.map((action) => (
        <ToolbarActionItem key={action.label} {...action} />
      ))}
    </ContextMenuGroup>
  )
}

function ToolbarActionItem({
  icon: Icon,
  label,
  onSelect,
  disabled,
  control,
  onColorSelect,
  visible,
  onVisibleChange,
}: ToolbarAction) {
  if (control) return control

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
      disabled={disabled}
      onSelect={(event) => {
        if (hasDropdownIndicator) {
          event.preventDefault()
        }
        onSelect?.()
      }}
    >
      <Icon />
      {hasDropdownIndicator && <ChevronDown className="!size-2.5" />}
    </ContextMenuItem>
  )

  if (disabled) return item

  if (onVisibleChange) {
    return (
      <Popover>
        <PopoverTrigger asChild>{item}</PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={8}
          className="w-48 p-0"
        >
          <VisibilityPanel
            visible={visible ?? true}
            onVisibleChange={onVisibleChange}
          />
        </PopoverContent>
      </Popover>
    )
  }

  if (!onColorSelect) return item

  return (
    <Popover>
      <PopoverTrigger asChild>{item}</PopoverTrigger>
      <PopoverContent align="start" side="bottom" sideOffset={8}>
        <BackgroundColorPalette onColorSelect={onColorSelect} />
      </PopoverContent>
    </Popover>
  )
}

function FontSizeSelect({
  value,
  onValueChange,
}: {
  value: string
  onValueChange: (value: string) => void
}) {
  const options = FONT_SIZE_OPTIONS.includes(value)
    ? FONT_SIZE_OPTIONS
    : [...FONT_SIZE_OPTIONS, value].sort((a, b) => Number(a) - Number(b))

  return (
    <Select defaultValue={value} onValueChange={onValueChange}>
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
          {options.map((size) => (
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

const CANVAS_FONT_OPTIONS = [
  { label: '继承界面字体', value: 'inherit' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: '等宽字体', value: 'monospace' },
]

function CanvasFontSelect({
  value,
  onValueChange,
}: {
  value: string
  onValueChange: (value: string) => void
}) {
  return (
    <Select defaultValue={value} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label="画布字体"
        title="画布字体"
        size="sm"
        className="h-6 w-18 gap-0.5 rounded-sm border-border bg-background px-1 py-0 shadow-none data-[size=sm]:h-6 *:data-[slot=select-value]:truncate *:data-[slot=select-value]:text-[10px] [&_svg]:!size-3"
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start" sideOffset={4} className="min-w-36">
        <SelectGroup>
          {CANVAS_FONT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function VisibilityPanel({
  visible: initialVisible,
  onVisibleChange,
}: {
  visible: boolean
  onVisibleChange: (visible: boolean) => void
}) {
  const [visible, setVisible] = useState(initialVisible)

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
      <label htmlFor="context-menu-label-visible" className="font-medium">
        显示模块名称
      </label>
      <Switch
        id="context-menu-label-visible"
        checked={visible}
        onCheckedChange={(checked) => {
          setVisible(checked)
          onVisibleChange(checked)
        }}
      />
    </div>
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

function BackgroundColorPalette({
  onColorSelect,
}: {
  onColorSelect: (color: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <ColorSwatchGroup
        label="标准颜色"
        colors={STANDARD_COLORS}
        onColorSelect={onColorSelect}
      />
      <ColorSwatchGroup
        label="最近使用的颜色"
        colors={RECENT_COLORS}
        onColorSelect={onColorSelect}
      />
    </div>
  )
}

function ColorSwatchGroup({
  label,
  colors,
  onColorSelect,
}: {
  label: string
  colors: string[]
  onColorSelect: (color: string) => void
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
            onClick={() => onColorSelect(color)}
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
        <ContextMenuItem disabled={!service.canPaste} onClick={service.paste}>
          粘贴
        </ContextMenuItem>
        <ContextMenuItem disabled={!service.canUndo} onClick={service.undo}>
          撤销
        </ContextMenuItem>
        <ContextMenuItem disabled={!service.canRedo} onClick={service.redo}>
          重做
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
      <FloatingToolbar context="blank" service={service} />
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
        <FloatingToolbar context="node" service={service} />
        <div className="rounded-3xl bg-popover p-1.5 shadow-lg ring-1 ring-foreground/5">
          <ContextMenuLabel className="font-semibold text-foreground">
            {title}
          </ContextMenuLabel>
          <ContextMenuGroup>
            <ContextMenuItem onClick={service.openNodeParameters}>
              打开
            </ContextMenuItem>
            <ContextMenuItem onClick={service.cut}>剪切</ContextMenuItem>
            <ContextMenuItem onClick={service.copy}>复制</ContextMenuItem>
            <ContextMenuItem variant="destructive" onClick={service.remove}>
              删除
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
            <ContextMenuItem onClick={service.toggleLabelVisibility}>
              {service.isLabelHidden ? '显示标签' : '隐藏标签'}
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
      <FloatingToolbar context="node" service={service} />
      <div className="rounded-3xl bg-popover p-1.5 shadow-lg ring-1 ring-foreground/5">
        <ContextMenuLabel className="font-semibold text-foreground">
          Subsystem
        </ContextMenuLabel>
        <ContextMenuGroup>
          <ContextMenuItem onClick={service.openSubsystem}>
            打开
          </ContextMenuItem>
          <ContextMenuItem onClick={service.openSubsystemInTab}>
            在新选项卡打开
          </ContextMenuItem>
          <ContextMenuItem onClick={service.cut}>剪切</ContextMenuItem>
          <ContextMenuItem onClick={service.copy}>复制</ContextMenuItem>
          <ContextMenuItem variant="destructive" onClick={service.remove}>
            删除
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
          <ContextMenuItem onClick={service.toggleLabelVisibility}>
            {service.isLabelHidden ? '显示标签' : '隐藏标签'}
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
              <ContextMenuItem onClick={service.addSubsystemImage}>
                添加图像
              </ContextMenuItem>
              <ContextMenuItem
                disabled={!service.canRemoveSubsystemImage}
                onClick={service.removeSubsystemImage}
              >
                删除图像
              </ContextMenuItem>
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
      <FloatingToolbar context="edge" service={service} />
      <div className="rounded-3xl bg-popover p-1.5 shadow-lg ring-1 ring-foreground/5">
        <ContextMenuLabel className="font-semibold text-foreground">
          信号
        </ContextMenuLabel>
        <ContextMenuGroup>
          <ContextMenuItem onClick={service.cut}>剪切</ContextMenuItem>
          <ContextMenuItem onClick={service.copy}>复制</ContextMenuItem>
          <ContextMenuItem variant="destructive" onClick={service.remove}>
            删除
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
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
