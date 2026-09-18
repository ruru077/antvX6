import { useLocation } from 'react-router'
import BlockDiagram from '@/views/BlockDiagram'
import type { InterpreterConfig } from '@/store/interpreterStore'
import type { EntryGraphModel } from '~/types'

type WorkspaceLocationState = {
  diagramModel?: EntryGraphModel
  modelId?: number | string
  modelName?: string
  config?: InterpreterConfig
}

function WorkspacePage({
  exchangePath = '/exchange',
  showIssueLink = false,
}: {
  exchangePath?: string
  showIssueLink?: boolean
}) {
  const { state } = useLocation()
  const locationState = state as WorkspaceLocationState | null

  return (
    <section className="workspace-page">
      <BlockDiagram
        initialModel={locationState?.diagramModel}
        modelId={locationState?.modelId}
        modelName={locationState?.modelName}
        initialConfig={locationState?.config}
        exchangePath={exchangePath}
        showIssueLink={showIssueLink}
      />
    </section>
  )
}

export default WorkspacePage
