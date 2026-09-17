import { useLocation } from 'react-router'
import BlockDiagram from '@/views/BlockDiagram'
import type { EntryGraphModel } from '~/types'

type WorkspaceLocationState = {
  diagramModel?: EntryGraphModel
  modelId?: number
}

type WorkspacePageProps = {
  exchangePath?: string
  showIssueLink?: boolean
}

function WorkspacePage({
  exchangePath = '/exchange',
  showIssueLink = false,
}: WorkspacePageProps) {
  const { state } = useLocation()
  const locationState = state as WorkspaceLocationState | null

  return (
    <section className="workspace-page">
      <BlockDiagram
        initialModel={locationState?.diagramModel}
        modelKey={locationState?.modelId}
        exchangePath={exchangePath}
        showIssueLink={showIssueLink}
      />
    </section>
  )
}

export default WorkspacePage
