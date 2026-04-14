import RootLayout from '@/layout/RootLayout'
import { createBrowserRouter } from 'react-router'

/**
 * React Router v7 Data 模式路由配置
 *
 * 核心设计原则：
 * 1. lazy      — 所有页面懒加载，首屏 bundle 最小
 * 2. loader    — 路由渲染前并行预载数据，消除瀑布请求
 * 3. action    — 表单提交 / 数据变更，自动触发 revalidation
 * 4. errorElement — 就近捕获 loader / action 抛出的错误
 * 5. shouldRevalidate — 精细控制哪些场景无需重新拉取
 */
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
        path: '/edit',
        lazy: () => import('@/views/DiagramModel'),
      },
    ],
  },
])

export { router }
