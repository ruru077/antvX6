import { siteContent } from './siteContent'
import { useSiteLanguage } from './SiteLanguageContext'

function ContactPage() {
  const { locale } = useSiteLanguage()
  const copy = siteContent[locale].contact

  return (
    <section className="m2p-page">
      <header className="m2p-page-head">
        <p className="m2p-eyebrow">Contact</p>
        <h1>{copy.pageTitle}</h1>
        <p>{copy.pageDesc}</p>
      </header>
      <div className="m2p-grid">
        <article className="m2p-feature-card">
          <h3>{locale === 'zh' ? '邮箱支持' : 'Email support'}</h3>
          <p>{copy.email}</p>
        </article>
        <article className="m2p-feature-card">
          <h3>{locale === 'zh' ? '资源协作' : 'Cooperate'}</h3>
          <ul>
            {copy.resources.map((resource) => (
              <li key={resource}>{resource}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  )
}

export default ContactPage
