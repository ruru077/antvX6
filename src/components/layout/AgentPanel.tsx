import { HttpAgent } from '@ag-ui/client'
import {
  AssistantRuntimeProvider,
  SimpleTextAttachmentAdapter,
  WebSpeechDictationAdapter,
} from '@assistant-ui/react'
import { useAgUiRuntime } from '@assistant-ui/react-ag-ui'
import { BotIcon, XIcon } from 'lucide-react'
import {
  ModelSelector,
  type ModelOption,
} from '@/components/assistant-ui/model-selector'
import { ComposerContext } from '@/components/composer'
import { Thread } from '@/components/thread'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAgentPanelStore } from '@/store/agentPanelStore'

const AG_UI_AGENT_URL = import.meta.env.VITE_AG_UI_AGENT_URL as
  | string
  | undefined

const DEEPSEEK_REASONING_EFFORTS = [
  { id: 'none', name: '关闭' },
  { id: 'low', name: '低' },
  { id: 'high', name: '高' },
  { id: 'max', name: '最大' },
] as const

const AGENT_MODELS = [
  {
    id: 'deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    description: '1M 上下文 · 更低延迟',
    efforts: DEEPSEEK_REASONING_EFFORTS,
  },
  {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    description: '1M 上下文 · 更强能力',
    efforts: DEEPSEEK_REASONING_EFFORTS,
  },
] satisfies readonly ModelOption[]

const DEMO_CONTEXT_USAGE = {
  system: 0,
  tools: 0,
  messages: 0,
  total: 1000,
}

function AgentPanel() {
  const close = useAgentPanelStore((state) => state.close)

  return (
    <Tabs defaultValue="chat" className="h-full min-h-0 gap-0">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border px-2">
        <TabsList
          variant="line"
          aria-label="Agent 面板标签"
          className="h-full gap-1 p-0"
        >
          <TabsTrigger
            value="chat"
            className="h-full flex-none rounded-none px-2 text-xs after:bottom-0"
          >
            对话
          </TabsTrigger>
          <TabsTrigger
            value="connection"
            className="h-full flex-none rounded-none px-2 text-xs after:bottom-0"
          >
            接入
          </TabsTrigger>
        </TabsList>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="关闭 Agent 面板"
          className="ml-auto"
          onClick={close}
        >
          <XIcon />
        </Button>
      </div>

      <TabsContent
        forceMount
        value="chat"
        className="min-h-0 data-[state=active]:flex data-[state=inactive]:hidden"
      >
        {AG_UI_AGENT_URL ? (
          <ConnectedAgentChat endpoint={AG_UI_AGENT_URL} />
        ) : (
          <AgentEndpointRequired />
        )}
      </TabsContent>

      <TabsContent
        forceMount
        value="connection"
        className="min-h-0 data-[state=active]:flex data-[state=inactive]:hidden"
      >
        <AgentConnectionInfo />
      </TabsContent>
    </Tabs>
  )
}

function ConnectedAgentChat({ endpoint }: { endpoint: string }) {
  const [threadId] = useState(() => createThreadId())
  const agent = useMemo(
    () =>
      new HttpAgent({
        url: endpoint,
        threadId,
      }),
    [endpoint, threadId],
  )
  const attachments = useMemo(() => new SimpleTextAttachmentAdapter(), [])
  const dictation = useMemo(
    () =>
      WebSpeechDictationAdapter.isSupported()
        ? new WebSpeechDictationAdapter({ language: 'zh-CN' })
        : undefined,
    [],
  )
  const runtime = useAgUiRuntime({
    agent,
    adapters: { attachments, dictation },
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="min-w-0 flex-1">
        <Thread
          components={{ Welcome: AgentWelcome }}
          composerLeadingAction={
            <ModelSelector
              models={AGENT_MODELS}
              defaultValue="deepseek-v4-flash"
              defaultEffort="high"
              variant="ghost"
              size="sm"
              className="min-w-0 max-w-full"
            />
          }
          composerTrailingAction={
            <ComposerContext usage={DEMO_CONTEXT_USAGE} />
          }
        />
      </div>
    </AssistantRuntimeProvider>
  )
}

function createThreadId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  const fallback =
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
      ? Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map((n) => n.toString(16).padStart(2, '0'))
          .join('')
      : Math.random().toString(36).slice(2)

  return `thread-${Date.now()}-${fallback}`
}

function AgentWelcome() {
  return (
    <div className="aui-thread-welcome-root mb-6 flex flex-col items-center gap-2 px-4 text-center">
      <BotIcon className="size-8 text-muted-foreground" />
      <div className="font-medium">Agent 对话</div>
      <div className="max-w-56 text-xs text-muted-foreground">
        输入消息后，将通过 AG-UI 发送给 Mastra Agent。
      </div>
    </div>
  )
}

function AgentEndpointRequired() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <BotIcon className="size-8 text-muted-foreground" />
      <div className="font-medium">尚未配置 Agent Endpoint</div>
      <div className="text-xs text-muted-foreground">
        配置 VITE_AG_UI_AGENT_URL 后，对话将直接连接 AG-UI 服务。
      </div>
    </div>
  )
}

function AgentConnectionInfo() {
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 text-sm">
      <div className="flex flex-col gap-1">
        <div className="font-medium">通用接入链路</div>
        <div className="text-muted-foreground">
          assistant-ui → AG-UI → Mastra → MCP → Model
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="font-medium">环境变量</div>
        <code className="w-fit rounded bg-muted px-2 py-1 text-xs">
          VITE_AG_UI_AGENT_URL
        </code>
      </div>
      <div className="flex flex-col gap-1">
        <div className="font-medium">当前 Endpoint</div>
        <code className="break-all rounded bg-muted px-2 py-1 text-xs">
          {AG_UI_AGENT_URL ?? '未配置'}
        </code>
      </div>
    </div>
  )
}

export { AgentPanel }
