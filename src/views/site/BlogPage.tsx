import { ArrowUpRight } from 'lucide-react'
import { useSiteLanguage } from './SiteLanguageContext'

function BlogPage() {
  const { locale } = useSiteLanguage()
  const zh = locale === 'zh'

  return (
    <section className="site-blog-page">
      <div className="site-container">
        <header className="site-blog-head">
          <span>BLOG</span>
          <h1>
            {zh ? '记录正在发生的事。' : 'Notes from what we are building.'}
          </h1>
          <p>
            {zh ? '文章内容将在这里发布。' : 'Articles will be published here.'}
          </p>
        </header>
        <div className="site-blog-grid">
          {Array.from({ length: 6 }, (_, index) => (
            <article key={index}>
              <div className="site-blog-placeholder" />
              <span>00 / 00 / 2026</span>
              <h2>{zh ? '文章标题占位' : 'Article title placeholder'}</h2>
              <ArrowUpRight />
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default BlogPage
