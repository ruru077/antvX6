import { siteContent } from './siteContent'
import { useSiteLanguage } from './SiteLanguageContext'

function SolutionsPage() {
  const { locale } = useSiteLanguage()
  const copy = siteContent[locale].solutions

  return (
    <section className="m2p-page">
      <header className="m2p-page-head">
        <p className="m2p-eyebrow">Solutions</p>
        <h1>{copy.pageTitle}</h1>
        <p>{copy.pageDesc}</p>
      </header>
      <div className="m2p-grid">
        {copy.cards.map((item) => (
          <article className="m2p-feature-card" key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
          </article>
        ))}
      </div>
      <div className="m2p-kpi">
        <h2>{locale === 'zh' ? '方案执行清单' : 'Implementation Checklist'}</h2>
        <ul>
          {copy.checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default SolutionsPage
