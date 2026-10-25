import { Modal } from 'antd'
import { useEffect, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router'
import { ladApi } from './api'
import LadderEditor from './LadderEditor'

export default function LadderPage() {
  const navigate = useNavigate()
  const [dirty, setDirty] = useState(false)
  const blocker = useBlocker(dirty)
  const [modal, holder] = Modal.useModal()
  const [modelId] = useState(() => {
    const value = new URLSearchParams(window.location.search).get('model')
    return value && /^\d+$/.test(value) ? Number(value) : null
  })
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    const confirmation = modal.confirm({
      title: '离开前要放弃未保存的修改吗？',
      content: '当前独立扫描会在离开页面时停止。',
      okText: '放弃并离开',
      cancelText: '继续编辑',
      onOk: () => blocker.proceed(),
      onCancel: () => blocker.reset(),
    })
    return () => confirmation.destroy()
  }, [blocker, modal])
  return (
    <>
      {holder}
      <LadderEditor
        services={ladApi}
        initialModelId={modelId}
        onLeave={() => navigate('/deploy')}
        onDirtyChange={setDirty}
        onDocumentLocation={(id) =>
          window.history.replaceState(
            window.history.state,
            '',
            id === null ? '/ladder' : '/ladder?model=' + id,
          )
        }
      />
    </>
  )
}
