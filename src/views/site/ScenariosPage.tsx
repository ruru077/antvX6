import { siteContent } from './siteContent'
import { useSiteLanguage } from './SiteLanguageContext'

function ScenariosPage() {
  const { locale } = useSiteLanguage()
  const copy = siteContent[locale].scenarios

  return (
    <section className="m2p-page">
      <header className="m2p-page-head">
        <p className="m2p-eyebrow">Scenarios</p>
        <h1>{copy.pageTitle}</h1>
        <p>{copy.pageDesc}</p>
      </header>
      <div className="m2p-list-grid">
        {copy.cards.map((item) => (
          <article className="m2p-feature-card" key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
            <div className="m2p-callout">
              <strong>{locale === 'zh' ? '学生任务：' : 'Task: '}</strong>
              {item.task}
            </div>
            <div className="m2p-callout">
              <strong>{locale === 'zh' ? '预期学习：' : 'Expected: '}</strong>
              {item.expect}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default ScenariosPage
