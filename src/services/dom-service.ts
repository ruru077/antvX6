function createDomService() {
  /**
   * Creates a page wheel blocker.
   * @returns PageWheelBlocker
   */
  function createPageWheelBlocker() {
    const wheelOptions: AddEventListenerOptions & { capture: true } = {
      passive: false,
      capture: true,
    }
    let onWheel: ((e: WheelEvent) => void) | null = null

    function blockPageWheel() {
      if (onWheel) return

      onWheel = (e: WheelEvent) => {
        e.preventDefault()
        e.stopPropagation()
      }

      document.addEventListener('wheel', onWheel, wheelOptions)
    }

    function releasePageWheel() {
      if (!onWheel) return
      document.removeEventListener('wheel', onWheel, wheelOptions)
      onWheel = null
    }

    return {
      blockPageWheel,
      releasePageWheel,
    }
  }

  return {
    createPageWheelBlocker,
  }
}

export { createDomService }
