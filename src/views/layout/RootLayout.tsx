import { GithubOutlined } from '@ant-design/icons'
import { ConfigProvider } from 'antd'
import KeepAliveRouteOutlet from 'keepalive-for-react-router'
import { Link, NavLink, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { SiteLanguageProvider } from '@/views/site/SiteLanguageContext'
import '@/components/styles/site-shell.scss'

const SITE_THEME = { token: { fontFamily: 'inherit' } }

function SiteHeader() {
  const navItems = [
    { text: 'Home', path: '/' },
    { text: 'Exchange', path: '/exchange' },
    { text: 'Blog', path: '/blog' },
  ]

  return (
    <header className="m2p-header">
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
      <div className="justify-self-end">
        <Button asChild variant="ghost" size="sm">
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
  const activeCacheKey =
    pathname === '/exchange' || pathname === '/workspace'
      ? 'exchange-workspace'
      : undefined

  return (
    <main className="m2p-main">
      <KeepAliveRouteOutlet
        activeCacheKey={activeCacheKey}
        include="exchange-workspace"
        transition={false}
        viewTransition={false}
        containerClassName="route-keep-alive-container"
        cacheNodeClassName="route-keep-alive-node"
      />
    </main>
  )
}

function RootLayout() {
  return (
    <SiteLanguageProvider>
      <ConfigProvider theme={SITE_THEME}>
        <div className="m2p-shell">
          <SiteHeader />
          <SiteMain />
        </div>
      </ConfigProvider>
    </SiteLanguageProvider>
  )
}

export default RootLayout
