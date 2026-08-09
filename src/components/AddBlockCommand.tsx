import { Boxes } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { getLibraryWithBlocks } from '@/services/stencil-service'
import type { Block } from '~/types/vo/block'

interface AddBlockCommandProps {
  /** 面板定位的屏幕 X 坐标（clientX） */
  screenX: number
  /** 面板定位的屏幕 Y 坐标（clientY） */
  screenY: number
  onDestroy: () => void
  onSelect: (block: Block) => void
}

const PANEL_WIDTH = 300
const PANEL_MAX_HEIGHT = 400

/**
 * @description 双击画布空白处弹出的浮动"添加模块"面板
 * 使用 shadcn Command（cmdk）组件，内置搜索过滤、键盘导航（↑↓+Enter）、高亮和自动滚动
 */
function AddBlockCommand({
  screenX,
  screenY,
  onDestroy,
  onSelect,
}: AddBlockCommandProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const libraryWithBlocks = getLibraryWithBlocks()

  // 固定左上角，视口边界检测，确保面板不超出屏幕
  const left = Math.min(screenX, window.innerWidth - PANEL_WIDTH - 8)
  const top = Math.min(screenY, window.innerHeight - PANEL_MAX_HEIGHT - 8)

  // 外部点击 + ESC 关闭（面板生命周期管理）
  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onDestroy()
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onDestroy()
    }
    // 延迟一帧注册，避免捕获到触发双击事件的残余 mousedown
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handlePointerDown)
      document.addEventListener('keydown', handleKeyDown)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onDestroy])

  function handleSelect(block: Block) {
    onSelect(block)
    onDestroy()
  }

  return (
    <Command
      ref={panelRef}
      loop
      filter={(value, search) =>
        value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
      }
      className={cn(
        'fixed z-50 rounded-xl',
        'border border-border shadow-lg ring-1 ring-foreground/5 dark:ring-foreground/10',
        'animate-in fade-in-0 zoom-in-95 duration-100',
      )}
      style={{
        left,
        top,
        width: PANEL_WIDTH,
        maxHeight: PANEL_MAX_HEIGHT,
      }}
    >
      <CommandInput autoFocus placeholder="搜索模块..." />
      <CommandList className="max-h-[340px]">
        <CommandEmpty className="flex flex-col items-center gap-2 py-6">
          <Boxes className="size-8 text-muted-foreground" />
          <p>未找到匹配的模块</p>
        </CommandEmpty>
        {Array.from(libraryWithBlocks.entries()).map(([library, blocks]) => (
          <CommandGroup key={library} heading={library}>
            {blocks.map((block, index) => {
              const label = block.attrs?.label?.text ?? '未命名模块'
              const iconSrc = block.attrs?.image?.xlinkHref
              return (
                <CommandItem
                  key={`${library}-${index}`}
                  value={label}
                  onSelect={() => handleSelect(block)}
                >
                  {/* 图标 */}
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/50">
                    {iconSrc ? (
                      <img
                        src={iconSrc}
                        alt={label}
                        className="max-h-8 max-w-8 object-contain"
                      />
                    ) : (
                      <Boxes className="size-3.5 text-muted-foreground" />
                    )}
                  </div>
                  {/* 名称 + 库标签 */}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {library}
                    </span>
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  )
}

export { AddBlockCommand }
