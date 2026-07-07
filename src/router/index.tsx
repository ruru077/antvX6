import { createBrowserRouter, redirect } from 'react-router'
import RootLayout from '@/views/layout/RootLayout'
import AboutPage from '@/views/site/AboutPage'
import ContactPage from '@/views/site/ContactPage'
import DocsHubPage from '@/views/site/DocsHubPage'
import FeaturesPage from '@/views/site/FeaturesPage'
import HomePage from '@/views/site/HomePage'
import PlaygroundPage from '@/views/site/PlaygroundPage'
import ScenariosPage from '@/views/site/ScenariosPage'
import SolutionsPage from '@/views/site/SolutionsPage'

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
        path: '/features',
        Component: FeaturesPage,
      },
      {
        path: '/scenarios',
        Component: ScenariosPage,
      },
      {
        path: '/solutions',
        Component: SolutionsPage,
      },
      {
        path: '/playground',
        Component: PlaygroundPage,
      },
      {
        path: '/docs',
        Component: DocsHubPage,
      },
      {
        path: '/docs/get-started',
        loader: () => redirect('/docs/chapter-2-get-started'),
      },
      {
        path: '/docs/:slug',
        Component: DocsHubPage,
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
      {
        path: '/about',
        Component: AboutPage,
      },
      {
        path: '/contact',
        Component: ContactPage,
      },
    ],
  },
])

export { router }
