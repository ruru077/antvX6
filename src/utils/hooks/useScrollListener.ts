import type { RefObject } from 'react'

/**
 * 滚动时添加 is-scrolling 标记，停止滚动 500ms 后移除
 * @param containerRef - paper 容器的 ref
 */
function useScrollListener(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!containerRef.current) return
    const paperContainer =
      containerRef.current.closest<HTMLElement>('.paper-container')
    const scrollerEl =
      containerRef.current.closest<HTMLElement>('.x6-graph-scroller')
    if (!paperContainer || !scrollerEl) return

    const syncScrollbar = () => {
      const {
        clientWidth,
        clientHeight,
        scrollWidth,
        scrollHeight,
        scrollLeft,
        scrollTop,
      } = scrollerEl
      const verticalVisible = scrollHeight > clientHeight + 1
      const horizontalVisible = scrollWidth > clientWidth + 1

      paperContainer.classList.toggle('has-paper-v-scrollbar', verticalVisible)
      paperContainer.classList.toggle(
        'has-paper-h-scrollbar',
        horizontalVisible,
      )

      if (verticalVisible) {
        const trackHeight = clientHeight
        const thumbHeight = Math.max(
          28,
          (clientHeight / scrollHeight) * trackHeight,
        )
        const thumbTop =
          (scrollTop / (scrollHeight - clientHeight)) *
          (trackHeight - thumbHeight)

        paperContainer.style.setProperty(
          '--paper-scrollbar-v-top',
          `${thumbTop}px`,
        )
        paperContainer.style.setProperty(
          '--paper-scrollbar-v-height',
          `${thumbHeight}px`,
        )
      }

      if (horizontalVisible) {
        const trackWidth = clientWidth
        const thumbWidth = Math.max(
          28,
          (clientWidth / scrollWidth) * trackWidth,
        )
        const thumbLeft =
          (scrollLeft / (scrollWidth - clientWidth)) * (trackWidth - thumbWidth)

        paperContainer.style.setProperty(
          '--paper-scrollbar-h-left',
          `${thumbLeft}px`,
        )
        paperContainer.style.setProperty(
          '--paper-scrollbar-h-width',
          `${thumbWidth}px`,
        )
      }
    }

    let timer: ReturnType<typeof setTimeout> | null = null
    const showScrollbar = () => {
      scrollerEl.classList.add('is-scrolling')
      paperContainer.classList.add('is-scrolling')
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        scrollerEl.classList.remove('is-scrolling')
        paperContainer.classList.remove('is-scrolling')
      }, 500)
    }

    const onScroll = () => {
      syncScrollbar()
      showScrollbar()
    }

    syncScrollbar()
    let didInitResizeObserver = false
    const onResize: ResizeObserverCallback = () => {
      syncScrollbar()
      if (didInitResizeObserver) showScrollbar()
      didInitResizeObserver = true
    }
    const activeResizeObserver = new ResizeObserver(onResize)
    activeResizeObserver.observe(scrollerEl)
    const contentEl = scrollerEl.querySelector<HTMLElement>(
      '.x6-graph-scroller-content',
    )
    if (contentEl) activeResizeObserver.observe(contentEl)
    scrollerEl.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      if (timer) clearTimeout(timer)
      activeResizeObserver.disconnect()
      scrollerEl.removeEventListener('scroll', onScroll)
    }
  }, [containerRef])
}

export { useScrollListener }
