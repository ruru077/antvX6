import type { RefObject } from 'react'

/**
 * 滚动时添加 is-scrolling 标记，停止滚动 500ms 后移除
 * @param containerRef - paper 容器的 ref
 */
function useScrollListener(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!containerRef.current) return
    const scrollerEl =
      containerRef.current.closest<HTMLElement>('.x6-graph-scroller')
    if (!scrollerEl) return

    let timer: ReturnType<typeof setTimeout> | null = null
    const onScroll = () => {
      scrollerEl.classList.add('is-scrolling')
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => scrollerEl.classList.remove('is-scrolling'), 500)
    }

    scrollerEl.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      if (timer) clearTimeout(timer)
      scrollerEl.removeEventListener('scroll', onScroll)
    }
  }, [containerRef])
}

export { useScrollListener }
