import { useEffect, useState } from 'react'
import { getPlatformUser } from '@/api/platform'
import { usePlatformStore } from '@/store/platformStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import BlockDiagram from '@/views/BlockDiagram'

export default function EmbeddedPage() {
  const [error, setError] = useState('')
  const user = usePlatformStore((s) => s.user)
  const language = new URLSearchParams(location.search).get('lang')
  const returnQuery = new URLSearchParams(language ? { lang: language } : {})
  const returnPath = `/m2plab/m2plink${returnQuery.size ? `?${returnQuery}` : ''}`
  useEffect(() => {
    let active = true
    getPlatformUser()
      .then((user) => {
        if (active) usePlatformStore.setState({ user })
      })
      .catch((error) => active && setError(error.message))
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== window.parent ||
        event.data?.channel !== 'm2psim-v1' ||
        event.data?.type !== 'context'
      )
        return
      const plantId = Number(event.data.plantId)
      const copyNum = Number(event.data.copyNum)
      if (
        Number.isInteger(plantId) &&
        plantId > 0 &&
        Number.isInteger(copyNum) &&
        copyNum >= 0
      )
        usePlatformStore.setState({ plantId, copyNum })
    }
    window.addEventListener('message', receive)
    window.parent.postMessage(
      { channel: 'm2psim-v1', type: 'ready' },
      location.origin,
    )
    const unsubscribe = useSubGraphStore.subscribe((state) =>
      window.parent.postMessage(
        { channel: 'm2psim-v1', type: 'dirty', dirty: state.isDirty },
        location.origin,
      ),
    )
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (useSubGraphStore.getState().isDirty) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      active = false
      unsubscribe()
      window.removeEventListener('message', receive)
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [])
  if (error)
    return (
      <div style={{ padding: 32 }} role="alert">
        {error}。
        <a
          href={`/login?redirect=${encodeURIComponent(returnPath)}`}
          target="_top"
        >
          返回登录
        </a>
      </div>
    )
  if (!user)
    return (
      <div style={{ padding: 32 }} role="status">
        正在连接 M2PLab…
      </div>
    )
  return (
    <div className="sim-embedded">
      <BlockDiagram />
    </div>
  )
}
