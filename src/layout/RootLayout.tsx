import { NavLink, Outlet } from 'react-router'

function RootLayout() {
  return (
    <div className="layout">
      <header className="app-header">
        <div className="app-header-brand">
          <svg
            width="22"
            height="22"
            viewBox="0 0 22 22"
            fill="none"
            style={{ flexShrink: 0 }}
          >
            <circle
              cx="11"
              cy="11"
              r="10"
              stroke="#60a5fa"
              strokeWidth="1.5"
              fill="none"
            />
            <circle cx="11" cy="11" r="4" fill="#60a5fa" />
            <line
              x1="11"
              y1="1"
              x2="11"
              y2="5"
              stroke="#60a5fa"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="11"
              y1="17"
              x2="11"
              y2="21"
              stroke="#60a5fa"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="1"
              y1="11"
              x2="5"
              y2="11"
              stroke="#60a5fa"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="17"
              y1="11"
              x2="21"
              y2="11"
              stroke="#60a5fa"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span>AntV Link</span>
        </div>
        <nav className="app-header-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `header-nav-link${isActive ? ' active' : ''}`
            }
          >
            编辑
          </NavLink>
          <NavLink
            to="/model"
            className={({ isActive }) =>
              `header-nav-link${isActive ? ' active' : ''}`
            }
          >
            模型
          </NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}

export default RootLayout
