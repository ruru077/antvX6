import { RotateCcwIcon, RotateCwIcon } from 'lucide-react'
import { useHistoryParamNoticeStore } from '@/store/historyParamNoticeStore'

const NOTICE_DURATION = 3000

function HistoryParamNotice() {
  const notice = useHistoryParamNoticeStore((state) => state.notice)
  const clearNotice = useHistoryParamNoticeStore((state) => state.clearNotice)
  const hoveredRef = useRef(false)
  const elapsedRef = useRef(false)

  useEffect(() => {
    if (!notice) return
    elapsedRef.current = false
    const timer = window.setTimeout(() => {
      elapsedRef.current = true
      if (!hoveredRef.current) clearNotice(notice.revision)
    }, NOTICE_DURATION)
    return () => window.clearTimeout(timer)
  }, [clearNotice, notice])

  if (!notice) return null
  const undo = notice.action === 'undo'
  const Icon = undo ? RotateCcwIcon : RotateCwIcon

  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute bottom-10 left-10 z-40 min-w-48 overflow-hidden rounded-md border border-black/70 bg-neutral-800 text-xs text-neutral-100 shadow-lg animate-in fade-in slide-in-from-bottom-1"
      onMouseEnter={() => {
        hoveredRef.current = true
      }}
      onMouseLeave={() => {
        hoveredRef.current = false
        if (elapsedRef.current) clearNotice(notice.revision)
      }}
    >
      <div className="flex items-center gap-1.5 border-b border-white/10 px-2.5 py-1.5 text-neutral-300">
        <Icon className="size-3.5" />
        <span>{undo ? '撤销参数修改' : '重做参数修改'}</span>
      </div>
      <div className="space-y-2 p-2">
        {notice.blocks.map((block) => (
          <div key={block.label}>
            <div className="mb-1 text-[11px] text-neutral-400">
              {block.label}
            </div>
            <div className="space-y-px">
              {block.params.map((param) => (
                <div
                  key={param.name}
                  className="grid grid-cols-[minmax(0,1fr)_auto] overflow-hidden rounded border border-white/10"
                >
                  <span className="min-w-0 truncate bg-neutral-700 px-2 py-1 text-neutral-300">
                    {param.name}
                  </span>
                  <span className="max-w-48 break-all bg-neutral-950 px-2 py-1 text-white">
                    {param.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export { HistoryParamNotice }
