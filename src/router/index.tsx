import { createBrowserRouter } from 'react-router'
import RootLayout from '@/views/layout/RootLayout'
import BlogPage from '@/views/site/BlogPage'
import HomePage from '@/views/site/HomePage'
import PlaygroundPage from '@/views/site/PlaygroundPage'

const router = createBrowserRouter([
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
        path: '/playground',
        Component: PlaygroundPage,
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
