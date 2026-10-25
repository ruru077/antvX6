/** Development-only acceptance surface; it must never be enabled on a remote origin. */
export function isLocalLadderIntegration() {
  return (
    import.meta.env.DEV &&
    import.meta.env.VITE_LAD_ENABLED === 'true' &&
    ['127.0.0.1', 'localhost', '[::1]'].includes(window.location.hostname) &&
    window.location.pathname === '/ladder-integration'
  )
}
