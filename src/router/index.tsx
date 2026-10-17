import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router'
import DeployPage from '@/views/DeployPage'
import RootLayout from '@/views/layout/RootLayout'

const ExchangeWorkspaceRoutes = lazy(
  () => import('@/views/site/ExchangeWorkspaceRoutes'),
)

const router = createBrowserRouter([
  {
    path: '/iframe-demo',
    hydrateFallbackElement: <></>,
    lazy: async () => ({
      Component: (await import('@/views/NcslabIframeDemo')).default,
    }),
  },
  {
    Component: DeployPage,
    hydrateFallbackElement: <></>,
    children: [
      {
        element: (
          <Suspense fallback={null}>
            <ExchangeWorkspaceRoutes
              exchangePath="/deploy"
              workspacePath="/deploy-workspace"
            />
          </Suspense>
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
    hydrateFallbackElement: <></>,
    children: [
      // ── 首页（index route）── //
      {
        index: true,
        lazy: async () => ({
          Component: (await import('@/views/site/HomePage')).default,
        }),
      },
      {
        element: (
          <Suspense fallback={null}>
            <ExchangeWorkspaceRoutes
              exchangePath="/exchange"
              workspacePath="/workspace"
            />
          </Suspense>
        ),
        children: [
          { path: '/exchange', element: null },
          { path: '/workspace', element: null },
        ],
      },
      {
        path: '/blog',
        lazy: async () => ({
          Component: (await import('@/views/site/BlogPage')).default,
        }),
      },
      {
        path: '/model2',
        lazy: () => import('@/views/DiagramModel2'),
      },
    ],
  },
])

export { router }
