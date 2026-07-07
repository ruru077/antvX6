import { Link, useParams } from 'react-router'
import { siteContent } from './siteContent'
import { useSiteLanguage } from './SiteLanguageContext'

function DocsHubPage() {
  const { locale } = useSiteLanguage()
  const { slug } = useParams()
  const docs = siteContent[locale].docs
  const chapter = docs.chapters.find((item) => item.slug === slug)
  const activeChapter = chapter ?? null

  return (
    <section className="m2p-page">
      <header className="m2p-page-head">
        <p className="m2p-eyebrow">Docs</p>
        <h1>{docs.pageTitle}</h1>
        <p>{docs.pageDesc}</p>
      </header>
      <div className="m2p-docs-shell">
        <aside className="m2p-docs-toc">
          <h2>{locale === 'zh' ? '文档章节' : 'Chapters'}</h2>
          <nav>
            <Link className={!slug ? 'active' : ''} to="/docs">
              {locale === 'zh' ? '文档首页' : 'Docs Home'}
            </Link>
            {docs.chapters.map((item) => (
              <Link
                key={item.slug}
                to={`/docs/${item.slug}`}
                className={activeChapter?.slug === item.slug ? 'active' : ''}
              >
                {item.title}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="m2p-docs-content">
          <h2>{!activeChapter ? docs.pageTitle : activeChapter.title}</h2>
          <p className="m2p-docs-intro">
            {!activeChapter ? docs.index.intro : activeChapter.subtitle}
          </p>
          {!activeChapter && (
            <ul>
              {docs.index.points.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {activeChapter && (
            <div className="m2p-docs-chapter-blocks">
              {activeChapter.sections.map((section) => (
                <section key={section.title}>
                  <h3>{section.title}</h3>
                  <ul>
                    {section.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          {!activeChapter && (
            <h2>{locale === 'zh' ? '快速入口' : 'Quick Entry'}</h2>
          )}
          <div
            className="m2p-actions"
            style={{ marginTop: activeChapter ? '1rem' : '1.5rem' }}
          >
            <Link className="m2p-btn m2p-btn-primary" to="/playground">
              {locale === 'zh' ? '立即体验' : 'Open Playground'}
            </Link>
            <Link className="m2p-btn m2p-btn-ghost" to="/features">
              {locale === 'zh' ? '先看功能' : 'Explore Features'}
            </Link>
          </div>
        </article>

        <aside className="m2p-docs-side">
          <h3>{locale === 'zh' ? '操作建议' : 'Action Tips'}</h3>
          <ul>
            {docs.sideTips.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {activeChapter?.next && (
            <Link className="m2p-btn m2p-btn-ghost" to={activeChapter.next.to}>
              {activeChapter.next.label}
            </Link>
          )}
        </aside>
      </div>
    </section>
  )
}

export default DocsHubPage
