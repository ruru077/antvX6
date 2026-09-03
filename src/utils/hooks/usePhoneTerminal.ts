const PHONE_TERMINAL = (() => {
  if (typeof navigator === 'undefined') return false

  return /iPhone|iPod|Windows Phone|Android.+Mobile/i.test(navigator.userAgent)
})()

/** 当前页面加载时是否运行在手机终端。 */
function usePhoneTerminal() {
  return PHONE_TERMINAL
}

export { PHONE_TERMINAL, usePhoneTerminal }
