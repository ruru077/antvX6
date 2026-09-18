import { Button, Card, Form, Input, Space, Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'
import {
  CONTEXT_MESSAGE,
  READY_MESSAGE,
} from '@/services/ncslab-context-service'

function NcslabIframeDemo() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [readyVersion, setReadyVersion] = useState<number | null>(null)

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.source === iframeRef.current?.contentWindow &&
        event.origin === window.location.origin &&
        event.data?.type === READY_MESSAGE &&
        event.data.payload?.version === 1
      )
        setReadyVersion(1)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const sendContext = (values: { userId: string }) => {
    setReadyVersion(null)
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: CONTEXT_MESSAGE,
        payload: {
          version: 1,
          user: { id: values.userId },
        },
      },
      window.location.origin,
    )
  }

  return (
    <main className="flex min-h-screen flex-col gap-4 bg-[#f0f2f5] p-6">
      <Card title="NCSLab iframe 本地通信 Demo">
        <Form
          layout="inline"
          initialValues={{ userId: '1' }}
          onFinish={sendContext}
        >
          <Form.Item label="userId" name="userId" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                发送上下文
              </Button>
              <Typography.Text>
                {readyVersion == null
                  ? '等待子应用 READY'
                  : `READY v${readyVersion}`}
              </Typography.Text>
            </Space>
          </Form.Item>
        </Form>
      </Card>
      <iframe
        ref={iframeRef}
        className="min-h-[720px] w-full flex-1 border-0 bg-white"
        src="/deploy"
        title="NCSLab 子应用"
        onLoad={() => {
          setReadyVersion(null)
        }}
      />
    </main>
  )
}

export default NcslabIframeDemo
