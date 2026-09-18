import { useKeepAliveContext } from 'keepalive-for-react'
import { useLocation } from 'react-router'
import BlockDiagram from '@/views/BlockDiagram'
import ExchangeDiagram from '@/views/exchangeDiagram'
import type { InterpreterConfig } from '@/store/interpreterStore'
import type { EntryGraphModel } from '~/types'

type WorkspaceLocationState = {
  diagramModel?: EntryGraphModel
  modelId?: number | string
  modelName?: string
  config?: InterpreterConfig
}

function ExchangeWorkspaceRoutes({
  exchangePath,
  workspacePath,
  showIssueLink = false,
}: {
  exchangePath: string
  workspacePath: string
  showIssueLink?: boolean
}) {
  const { pathname, state } = useLocation()
  const { active } = useKeepAliveContext()
  const model = state as WorkspaceLocationState | null
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const workspaceVisible = pathname === workspacePath && workspaceReady

  return (
    <div className="route-keep-alive-container">
      <div
        className={`route-keep-alive-node${workspaceVisible ? ' inactive' : ''}`}
        inert={workspaceVisible}
      >
        <ExchangeDiagram
          workspacePath={workspacePath}
          active={active && !workspaceVisible}
          workspaceReady={workspaceReady}
        />
      </div>
      <div
        className={`route-keep-alive-node${workspaceVisible ? '' : ' inactive'}`}
        inert={!workspaceVisible}
      >
        <BlockDiagram
          initialModel={model?.diagramModel}
          modelId={model?.modelId}
          modelName={model?.modelName}
          initialConfig={model?.config}
          exchangePath={exchangePath}
          showIssueLink={showIssueLink}
          onReady={() => setWorkspaceReady(true)}
        />
      </div>
    </div>
  )
}

export default ExchangeWorkspaceRoutes
