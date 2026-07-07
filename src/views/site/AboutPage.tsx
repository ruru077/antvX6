import { Link } from 'react-router'
import { siteContent } from './siteContent'
import { useSiteLanguage } from './SiteLanguageContext'

function AboutPage() {
  const { locale } = useSiteLanguage()
  const copy = siteContent[locale].about

  return (
    <section className="m2p-page">
      <header className="m2p-page-head">
        <p className="m2p-eyebrow">About</p>
        <h1>{copy.pageTitle}</h1>
        <p>{copy.pageDesc}</p>
      </header>
      <div className="m2p-grid">
        {copy.bullets.map((item) => (
          <article className="m2p-feature-card" key={item}>
            <h3>{item}</h3>
          </article>
        ))}
      </div>
      <div className="m2p-kpi">
        <h2>{locale === 'zh' ? '路线图' : 'Roadmap'}</h2>
        <ul>
          {copy.roadmap.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="m2p-actions" style={{ marginTop: '2rem' }}>
        <Link className="m2p-btn m2p-btn-primary" to="/contact">
          {locale === 'zh' ? '联系合作' : 'Contact us'}
        </Link>
      </div>
    </section>
  )
}

export default AboutPage
