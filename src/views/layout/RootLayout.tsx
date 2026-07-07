import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { siteContent } from '@/views/site/siteContent'
import {
  SiteLanguageProvider,
  useSiteLanguage,
} from '@/views/site/SiteLanguageContext'
import '@/components/styles/site-shell.scss'

function SiteHeader() {
  const { locale, setLocale } = useSiteLanguage()
  const copy = siteContent[locale]
  const { pathname } = useLocation()
  const isLanding = pathname === '/'

  return (
    <header className={`m2p-header ${isLanding ? 'landing' : ''}`}>
      <div className="m2p-brand">
        <Link to="/" className="m2p-brand-link">
          <span className="m2p-brand-mark">{copy.brand.badge}</span>
        </Link>
      </div>
      <nav className="m2p-nav">
        {copy.nav.map((item) => (
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
        <button
          className={`m2p-lang-btn ${locale === 'zh' ? 'active' : ''}`}
          onClick={() => setLocale('zh')}
          type="button"
        >
          中文
        </button>
        <button
          className={`m2p-lang-btn ${locale === 'en' ? 'active' : ''}`}
          onClick={() => setLocale('en')}
          type="button"
        >
          EN
        </button>
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
  const isLanding = pathname === '/'
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
