import RootLayout from '@/layout/RootLayout'
import { createBrowserRouter } from 'react-router'

const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      // ── 首页（index route）── //
      {
        index: true,
        lazy: () => import('@/views/BlockDiagram'),
      },
      {
        path: '/model',
        lazy: () => import('@/views/DiagramModel'),
      },
    ],
  },
])

export { router }
