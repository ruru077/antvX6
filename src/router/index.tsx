import { createBrowserRouter } from 'react-router'
import RootLayout from '@/views/layout/RootLayout'

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
      {
        path: '/model2',
        lazy: () => import('@/views/DiagramModel2'),
      },
      {
        path: '/model3',
        lazy: () => import('@/views/DiagramModel3'),
      },
      {
        path: '/model4',
        lazy: () => import('@/views/DiagramModel4'),
      },
      {
        path: '/model5',
        lazy: () => import('@/views/DiagramModel5'),
      },
    ],
  },
])

export { router }
