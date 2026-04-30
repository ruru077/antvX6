import { NavLink, Outlet } from 'react-router'

function RootLayout() {
  return (
    <>
      <header className="app-header">
        <nav className="app-header-nav">
          <NavLink to="/" end>
            编辑
          </NavLink>
          <NavLink to="/model">模型</NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </>
  )
}

export default RootLayout
