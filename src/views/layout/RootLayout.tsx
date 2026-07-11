import { GithubOutlined } from '@ant-design/icons'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { SiteLanguageProvider } from '@/views/site/SiteLanguageContext'
import '@/components/styles/site-shell.scss'

function SiteHeader() {
  const { pathname } = useLocation()
  const isLanding = pathname === '/' || pathname === '/blog'
  const navItems = [
    { text: 'Home', path: '/' },
    { text: 'Playground', path: '/playground' },
    { text: 'Blog', path: '/blog' },
  ]

  return (
    <header className={`m2p-header ${isLanding ? 'landing' : ''}`}>
      <div className="m2p-brand">
        <Link to="/" className="m2p-brand-link">
          <span className="m2p-brand-mark">LINK FOR M2PLAB</span>
        </Link>
      </div>
      <nav className="m2p-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.text}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `m2p-nav-link${isActive ? ' active' : ''}`
            }
          >
            {item.text}
          </NavLink>
        ))}
      </nav>
      <div className="m2p-tools">
        <Button asChild variant="ghost" size="sm" className="m2p-github-btn">
          <a
            href="https://github.com/ruru077/antvX6"
            target="_blank"
            rel="noreferrer"
          >
            <GithubOutlined data-icon="inline-start" />
            Submit Issue Here
          </a>
        </Button>
      </div>
    </header>
  )
}

function SiteMain() {
  const { pathname } = useLocation()
  const isWorkspacePage =
    pathname === '/playground' ||
    pathname === '/model' ||
    pathname === '/model2' ||
    pathname === '/model3' ||
    pathname === '/model4' ||
    pathname === '/model5'

  return (
    <main className={`m2p-main ${isWorkspacePage ? 'editor' : ''}`}>
      <Outlet />
    </main>
  )
}

function RootLayout() {
  const { pathname } = useLocation()
  const isLanding = pathname === '/' || pathname === '/blog'
  const isWorkspacePage =
    pathname === '/playground' ||
    pathname === '/model' ||
    pathname === '/model2' ||
    pathname === '/model3' ||
    pathname === '/model4' ||
    pathname === '/model5'
  const shellClass = isLanding
    ? ' m2p-shell-landing'
    : isWorkspacePage
      ? ' m2p-shell-workspace'
      : ' m2p-shell-site'

  return (
    <SiteLanguageProvider>
      <div className={`m2p-shell${shellClass}`}>
        <SiteHeader />
        <SiteMain />
      </div>
    </SiteLanguageProvider>
  )
}

export default RootLayout
