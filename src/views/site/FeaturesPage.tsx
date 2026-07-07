import { siteContent } from './siteContent'
import { useSiteLanguage } from './SiteLanguageContext'

function FeaturesPage() {
  const { locale } = useSiteLanguage()
  const copy = siteContent[locale].features

  return (
    <section className="m2p-page">
      <header className="m2p-page-head">
        <p className="m2p-eyebrow">Features</p>
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
    </section>
  )
}

export default FeaturesPage
