import { create } from 'zustand'

type NcslabUser = {
  id: number | string
  name?: string
}

type NcslabRuntimeContext = {
  version: 1
  user: NcslabUser
}

type NcslabContextState = {
  context: NcslabRuntimeContext | null
  error: string | null
  setContext: (context: NcslabRuntimeContext) => void
  setError: (error: string) => void
}

const CONTEXT_MESSAGE = 'NCSLAB_CONTEXT_INIT'
const READY_MESSAGE = 'NCSLAB_CONTEXT_READY'
const LOCAL_DEBUG_CONTEXT: NcslabRuntimeContext = {
  version: 1,
  user: { id: 8848 },
}

const useNcslabContextStore = create<NcslabContextState>((set) => ({
  context: import.meta.env.DEV ? LOCAL_DEBUG_CONTEXT : null,
  error: null,
  setContext: (context) => set({ context, error: null }),
  setError: (error) => set({ context: null, error }),
}))

function isRuntimeContext(value: unknown): value is NcslabRuntimeContext {
  if (!value || typeof value !== 'object') return false
  const context = value as Partial<NcslabRuntimeContext>
  return (
    context.version === 1 && context.user != null && context.user.id != null
  )
}

function getAllowedParentOrigins() {
  const configuredOrigins = import.meta.env.VITE_NCSLAB_PARENT_ORIGINS?.split(
    ',',
  )
    .map((origin: string) => origin.trim())
    .filter(Boolean)

  return new Set(
    configuredOrigins?.length ? configuredOrigins : [window.location.origin],
  )
}

function startNcslabContextBridge() {
  const allowedOrigins = getAllowedParentOrigins()

  const onMessage = (event: MessageEvent) => {
    if (event.source !== window.parent || !allowedOrigins.has(event.origin))
      return
    if (event.data?.type !== CONTEXT_MESSAGE) return

    if (!isRuntimeContext(event.data.payload)) {
      useNcslabContextStore
        .getState()
        .setError('主应用用户上下文格式无效或协议版本不受支持')
      return
    }

    useNcslabContextStore.getState().setContext(event.data.payload)
    window.parent.postMessage(
      { type: READY_MESSAGE, payload: { version: 1 } },
      event.origin,
    )
  }

  window.addEventListener('message', onMessage)
  return () => window.removeEventListener('message', onMessage)
}

export {
  CONTEXT_MESSAGE,
  READY_MESSAGE,
  startNcslabContextBridge,
  useNcslabContextStore,
}
export type { NcslabRuntimeContext }
