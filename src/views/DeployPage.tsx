import { ConfigProvider } from 'antd'
import KeepAliveRouteOutlet from 'keepalive-for-react-router'

const DEPLOY_THEME = { token: { fontFamily: 'inherit' } }

function DeployPage() {
  return (
    <ConfigProvider theme={DEPLOY_THEME}>
      <main className="deploy-workspace">
        <KeepAliveRouteOutlet
          include={/^\/(?:deploy|deploy-workspace)(?:\?|$)/}
          transition={false}
          viewTransition={false}
          containerClassName="route-keep-alive-container"
          cacheNodeClassName="route-keep-alive-node"
        />
      </main>
    </ConfigProvider>
  )
}

export default DeployPage
