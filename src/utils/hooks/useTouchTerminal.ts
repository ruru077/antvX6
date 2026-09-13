const TOUCH_TERMINAL = (() => {
  if (typeof navigator === 'undefined') return false

  const userAgent = navigator.userAgent
  return (
    /Android|HarmonyOS|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle/i.test(
      userAgent,
    ) ||
    (/Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1)
  )
})()

/** 当前页面加载时是否运行在纯触控终端。 */
function useTouchTerminal() {
  return TOUCH_TERMINAL
}

export { TOUCH_TERMINAL, useTouchTerminal }
