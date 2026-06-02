import { NavLink, Outlet } from 'react-router'

function RootLayout() {
  return (
    <>
      <header className="app-header">
        <nav className="app-header-nav">
          <NavLink to="/" end>
            编辑
          </NavLink>
          <NavLink to="/model">EditContent✅</NavLink>
          <NavLink to="/model2">Gain✅</NavLink>
          <NavLink to="/model3">Edge Label⚠️</NavLink>
          <NavLink to="/model4">Sum标签</NavLink>
          <NavLink to="/model5">非对称可变模块</NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </>
  )
}

export default RootLayout
