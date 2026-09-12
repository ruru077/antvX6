import { createBrowserRouter } from 'react-router'
import EmbeddedPage from '@/views/EmbeddedPage'
import RootLayout from '@/views/layout/RootLayout'
import BlogPage from '@/views/site/BlogPage'
import HomePage from '@/views/site/HomePage'
import PlaygroundPage from '@/views/site/PlaygroundPage'

const router = createBrowserRouter(
  [
    { path: '/embed', Component: EmbeddedPage },
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
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
)

export { router }
