import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import type { GraphLoadingStage } from '@/utils/hooks/useKeepAliveGraphViewport'
import type { ReactNode } from 'react'

export function WorkspaceLoadingBoundary({
  stage,
  children,
}: {
  stage: GraphLoadingStage
  children: ReactNode
}) {
  const ready = stage === 'ready'
  return (
    <div
      className="workspace-loading-boundary"
      data-workspace-stage={stage}
      aria-busy={!ready}
    >
      <div className="workspace-loading-content" inert={!ready}>
        {children}
      </div>
      {stage === 'initializing' && (
        <div
          className="workspace-loading-stage"
          role="status"
          aria-label="正在初始化工作区"
        >
          <DotLottieReact
            className="workspace-loading-animation"
            src="https://lottie.host/a2343634-d221-42c7-a6d1-c7883af7048f/6owlS39w8o.lottie"
            autoplay
            loop
          />
        </div>
      )}
    </div>
  )
}
