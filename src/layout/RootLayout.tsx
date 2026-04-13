import { NavLink, Outlet, useNavigation } from 'react-router'

/**
 * 根布局：包含顶部导航栏、全局 loading 条和页面内容插槽。
 * useNavigation 检测路由跳转 / 数据加载状态，实现 NProgress 效果。
 */
export default function RootLayout() {
  const navigation = useNavigation()
  const isPending = navigation.state !== 'idle'

  return (
    <div className="layout">
      {/* 全局进度条：路由切换或 loader 加载时可见 */}
      {isPending && <div className="nprogress-bar" />}

      <nav className="nav">
        <span className="nav-brand">⚡ AntV Link</span>

        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          编辑
        </NavLink>

        <NavLink
          to="/login"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          模型
        </NavLink>

        <NavLink
          to="/scoped-css-demo"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          Scoped CSS 示例
        </NavLink>
        {/* 全局加载状态指示器 */}
        {isPending && (
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            加载中…
          </span>
        )}
      </nav>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
