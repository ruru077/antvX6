import { createBrowserRouter } from 'react-router'
import DeployPage from '@/views/DeployPage'
import RootLayout from '@/views/layout/RootLayout'
import NcslabIframeDemo from '@/views/NcslabIframeDemo'
import BlogPage from '@/views/site/BlogPage'
import ExchangeWorkspaceRoutes from '@/views/site/ExchangeWorkspaceRoutes'
import HomePage from '@/views/site/HomePage'

const router = createBrowserRouter([
  {
    path: '/iframe-demo',
    Component: NcslabIframeDemo,
  },
  {
    Component: DeployPage,
    children: [
      {
        element: (
          <ExchangeWorkspaceRoutes
            exchangePath="/deploy"
            workspacePath="/deploy-workspace"
            showIssueLink
          />
        ),
        children: [
          { path: '/deploy', element: null },
          { path: '/deploy-workspace', element: null },
        ],
      },
    ],
  },
  {
    path: '/',
    Component: RootLayout,
    children: [
      // ── 首页（index route）── //
      {
        index: true,
        Component: HomePage,
      },
      {
        element: (
          <ExchangeWorkspaceRoutes
            exchangePath="/exchange"
            workspacePath="/workspace"
          />
        ),
        children: [
          { path: '/exchange', element: null },
          { path: '/workspace', element: null },
        ],
      },
      {
        path: '/blog',
        Component: BlogPage,
      },
      {
        path: '/model2',
        lazy: () => import('@/views/DiagramModel2'),
      },
    ],
  },
])

export { router }
