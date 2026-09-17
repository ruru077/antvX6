import { createBrowserRouter } from 'react-router'
import DeployPage from '@/views/DeployPage'
import ExchangeDiagram from '@/views/exchangeDiagram'
import RootLayout from '@/views/layout/RootLayout'
import BlogPage from '@/views/site/BlogPage'
import HomePage from '@/views/site/HomePage'
import WorkspacePage from '@/views/site/WorkspacePage'

const router = createBrowserRouter([
  {
    Component: DeployPage,
    children: [
      {
        path: '/deploy',
        element: <ExchangeDiagram workspacePath="/deploy-workspace" />,
      },
      {
        path: '/deploy-workspace',
        element: <WorkspacePage exchangePath="/deploy" showIssueLink />,
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
        path: '/exchange',
        Component: ExchangeDiagram,
      },
      {
        path: '/workspace',
        Component: WorkspacePage,
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
