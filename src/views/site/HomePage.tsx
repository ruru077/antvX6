import {
  ArrowRight,
  Boxes,
  Cpu,
  FileJson,
  Gauge,
  GitBranch,
  Moon,
  Network,
  PlayCircle,
  Rocket,
  Sparkles,
  Sun,
  Workflow,
} from 'lucide-react'
import { motion, useMotionValue, useSpring } from 'motion/react'
import {
  lazy,
  Suspense,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { siteContent } from './siteContent'
import { useSiteLanguage } from './SiteLanguageContext'
import type { COBEOptions } from 'cobe'

const Globe = lazy(() =>
  import('@/components/ui/globe').then((module) => ({ default: module.Globe })),
)

const NEON_GLOBE_CONFIG: COBEOptions = {
  width: 900,
  height: 900,
  devicePixelRatio: 2,
  onRender: () => {},
  phi: 0,
  theta: 0.28,
  dark: 1,
  diffuse: 1.15,
  mapSamples: 18000,
  mapBrightness: 5.8,
  baseColor: [0.36, 0.2, 0.86],
  markerColor: [0.12, 0.92, 1],
  glowColor: [0.64, 0.36, 1],
  markers: [
    { location: [39.9042, 116.4074], size: 0.08 },
    { location: [31.2304, 121.4737], size: 0.07 },
    { location: [35.6762, 139.6503], size: 0.06 },
    { location: [1.3521, 103.8198], size: 0.055 },
    { location: [37.7749, -122.4194], size: 0.07 },
    { location: [51.5072, -0.1276], size: 0.055 },
  ],
}

function TextGenerateEffect({ words = '' }: { words?: string }) {
  const parts = words.trim()
    ? words.split(' ')
    : ['LINK', 'COMPONENTS', 'FOR', 'M2PLAB']

  return (
    <h1 className="neon-hero-title">
      {parts.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{
            duration: 0.62,
            delay: index * 0.08,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {word}
        </motion.span>
      ))}
    </h1>
  )
}

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 32, filter: 'blur(10px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-12% 0px' }}
      transition={{ duration: 0.72, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

function HomePage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const { locale } = useSiteLanguage()
  const copy = siteContent[locale]

  useEffect(() => {
    document.documentElement.dataset.siteTheme = theme
    return () => {
      delete document.documentElement.dataset.siteTheme
    }
  }, [theme])

  const cursorX = useMotionValue(-120)
  const cursorY = useMotionValue(-120)
  const smoothX = useSpring(cursorX, { stiffness: 90, damping: 28, mass: 0.35 })
  const smoothY = useSpring(cursorY, { stiffness: 90, damping: 28, mass: 0.35 })

  const featureIcons = [Cpu, GitBranch, Workflow, Boxes, Gauge, Network]
  const flowIcons = [Sparkles, Workflow, FileJson]
  const flowSteps =
    locale === 'zh'
      ? [
          '选择传感器、控制器和执行器，建立实验设备的可视化链路。',
          '连接端口时即时校验方向和占用，自动路由保持结构清晰。',
          '导出 JSON、图片或 DTO，把课程任务交给远程设备和教学平台。',
        ]
      : [
          'Pick sensors, controllers, and actuators to shape a visual experiment chain.',
          'Validate direction and occupancy instantly while routing keeps the model clean.',
          'Export JSON, media, or DTO for remote devices and course platforms.',
        ]
  const flowTitles =
    locale === 'zh'
      ? ['Build', 'Route', 'Deploy']
      : ['Build', 'Route', 'Deploy']
  const integrations =
    locale === 'zh'
      ? [
          'Remote I/O',
          'LMS',
          'Device Gateway',
          'Lab Queue',
          'Auto Grading',
          'DTO Export',
        ]
      : [
          'Remote I/O',
          'LMS',
          'Device Gateway',
          'Lab Queue',
          'Auto Grading',
          'DTO Export',
        ]
  const faqs =
    locale === 'zh'
      ? [
          [
            '这个首页表达什么？',
            'M2PLAB 是面向学生实验的远程控制组件编排入口，核心不是静态展示，而是把设备逻辑变成可操作链路。',
          ],
          [
            '为什么要用 Globe？',
            '它表达远程实验和跨地点设备接入，视觉上把“远程控制”这个场景第一眼讲清楚。',
          ],
          [
            '后续能接真实编辑器吗？',
            '/playground 现在直接打开 BlockDiagram 工作区，首页负责吸引和导流，工作从画布开始。',
          ],
        ]
      : [
          [
            'What does this page communicate?',
            'M2PLAB is the entry point for remote-control component orchestration in student labs.',
          ],
          [
            'Why a Globe?',
            'It makes the remote-device story visible immediately and anchors the brand in distributed experiments.',
          ],
          [
            'Can it connect to the real editor?',
            'Yes. /playground now opens the BlockDiagram workspace directly.',
          ],
        ]
  const themeLabels =
    locale === 'zh'
      ? { dark: '暗色', light: '亮色' }
      : { dark: 'Dark', light: 'Light' }
  const footerColumns =
    locale === 'zh'
      ? [
          {
            title: '热门推荐',
            links: [
              ['开始搭建', '/playground'],
              ['示例模型', '/playground'],
              ['功能概览', '/features'],
              ['远程实验场景', '/scenarios'],
              ['解决方案', '/solutions'],
              ['快速入门', '/docs/chapter-2-get-started'],
            ],
          },
          {
            title: '资源与社区',
            links: [
              ['产品文档', '/docs'],
              ['连接与路由', '/docs/chapter-3-link-and-routing'],
              ['子系统建模', '/docs/chapter-4-subsystem'],
              ['导出与集成', '/docs/chapter-5-export-and-deploy'],
              ['路线图', '/about'],
              ['联系我们', '/contact'],
            ],
          },
          {
            title: '支持服务',
            links: [
              ['课程接入', '/solutions'],
              ['实验模板', '/playground'],
              ['设备网关', '/scenarios'],
              ['教学评测', '/docs/chapter-5-export-and-deploy'],
              ['问题反馈', '/contact'],
              ['部署咨询', '/contact'],
            ],
          },
          {
            title: 'M2PLAB 实验',
            links: [
              ['温湿度控制', '/scenarios'],
              ['电机速率控制', '/scenarios'],
              ['远程实验队列', '/scenarios'],
              ['自动批改', '/solutions'],
              ['Block Diagram', '/playground'],
              ['学生工作区', '/playground'],
            ],
          },
        ]
      : [
          {
            title: 'Popular',
            links: [
              ['Start build', '/playground'],
              ['Demo model', '/playground'],
              ['Features', '/features'],
              ['Scenarios', '/scenarios'],
              ['Solutions', '/solutions'],
              ['Get started', '/docs/chapter-2-get-started'],
            ],
          },
          {
            title: 'Resources',
            links: [
              ['Docs', '/docs'],
              ['Links and routing', '/docs/chapter-3-link-and-routing'],
              ['Subsystems', '/docs/chapter-4-subsystem'],
              ['Export', '/docs/chapter-5-export-and-deploy'],
              ['Roadmap', '/about'],
              ['Contact', '/contact'],
            ],
          },
          {
            title: 'Support',
            links: [
              ['Course setup', '/solutions'],
              ['Templates', '/playground'],
              ['Device gateway', '/scenarios'],
              ['Grading', '/docs/chapter-5-export-and-deploy'],
              ['Feedback', '/contact'],
              ['Deployment', '/contact'],
            ],
          },
          {
            title: 'M2PLAB Labs',
            links: [
              ['Humidity control', '/scenarios'],
              ['Motor control', '/scenarios'],
              ['Remote queue', '/scenarios'],
              ['Auto grading', '/solutions'],
              ['Block Diagram', '/playground'],
              ['Student workspace', '/playground'],
            ],
          },
        ]

  return (
    <div
      className={`neon-brand-page neon-theme-${theme}`}
      onMouseMove={(event) => {
        cursorX.set(event.clientX - 160)
        cursorY.set(event.clientY - 160)
      }}
    >
      <motion.div
        className="neon-cursor-halo"
        style={{ x: smoothX, y: smoothY }}
      />

      <section className="neon-hero">
        <div className="neon-aurora" />
        <div className="neon-grid-pattern" />
        <div className="neon-hero-globe" aria-hidden="true">
          <Suspense fallback={<div className="neon-globe-fallback" />}>
            <Globe config={NEON_GLOBE_CONFIG} className="neon-globe-canvas" />
          </Suspense>
        </div>

        <div className="neon-hero-copy">
          <motion.p
            className="neon-eyebrow"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {copy.brand.badge} / REMOTE EXPERIMENT ORCHESTRATION
          </motion.p>
          <motion.p
            className="neon-hero-subtitle"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.42 }}
          >
            {copy.brand.subtitle}
          </motion.p>
          <motion.p
            className="neon-hero-line"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.54 }}
          >
            {copy.brand.subtitleEn}
          </motion.p>
          <motion.div
            className="neon-hero-actions"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.66 }}
          >
            <Button asChild className="neon-primary-btn">
              <Link to="/playground">
                {copy.cta.primary}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="neon-outline-btn">
              <Link to="/playground">
                <PlayCircle className="h-4 w-4" />
                {locale === 'zh' ? '打开实验画布' : 'Open canvas'}
              </Link>
            </Button>
          </motion.div>
          <motion.div
            className="neon-theme-switch"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.62, delay: 0.78 }}
            aria-label={locale === 'zh' ? '主题切换' : 'Theme switch'}
          >
            <button
              type="button"
              className={theme === 'dark' ? 'active' : ''}
              onClick={() => setTheme('dark')}
            >
              <Moon className="h-4 w-4" />
              {themeLabels.dark}
            </button>
            <button
              type="button"
              className={theme === 'light' ? 'active' : ''}
              onClick={() => setTheme('light')}
            >
              <Sun className="h-4 w-4" />
              {themeLabels.light}
            </button>
          </motion.div>
        </div>

        <div className="neon-hero-strip">
          {copy.home.metrics.map((metric) => (
            <span key={metric}>{metric}</span>
          ))}
        </div>
      </section>

      <section className="neon-section neon-section-tight">
        <Reveal className="neon-section-head">
          <p className="neon-eyebrow">CAPABILITIES</p>
          <h2>{copy.features.pageTitle}</h2>
          <p>{copy.features.pageDesc}</p>
        </Reveal>
        <div className="neon-feature-grid">
          {copy.features.cards.map((card, index) => {
            const Icon = featureIcons[index]
            return (
              <Reveal key={card.title} delay={index * 0.04}>
                <article className="neon-card neon-hover-card">
                  <Icon className="neon-pulse-icon h-5 w-5" />
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                </article>
              </Reveal>
            )
          })}
        </div>
      </section>

      <section className="neon-section neon-flow-band">
        <Reveal className="neon-section-head">
          <p className="neon-eyebrow">WORKFLOW</p>
          <h2>
            {locale === 'zh'
              ? '从组件到设备下发，一条链路走完'
              : 'From component graph to remote deployment'}
          </h2>
          <p>{copy.home.heroDesc}</p>
        </Reveal>
        <div className="neon-flow-grid">
          {flowSteps.map((step, index) => {
            const Icon = flowIcons[index]
            return (
              <Reveal key={step} delay={index * 0.08}>
                <article className="neon-flow-step">
                  <span>{`0${index + 1}`}</span>
                  <Icon className="h-5 w-5" />
                  <h3>{flowTitles[index]}</h3>
                  <p>{step}</p>
                </article>
              </Reveal>
            )
          })}
        </div>
      </section>

      <section className="neon-section">
        <Reveal className="neon-section-head">
          <p className="neon-eyebrow">SCENARIOS</p>
          <h2>{copy.scenarios.pageTitle}</h2>
          <p>{copy.scenarios.pageDesc}</p>
        </Reveal>
        <div className="neon-scenario-grid">
          {copy.scenarios.cards.map((item, index) => (
            <Reveal key={item.title} delay={index * 0.05}>
              <article className="neon-card neon-scenario-card">
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
                <strong>{item.task}</strong>
                <span>{item.expect}</span>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="neon-section neon-architecture">
        <Reveal className="neon-section-head">
          <p className="neon-eyebrow">SYSTEM MAP</p>
          <h2>
            {locale === 'zh'
              ? '实验链路、远程设备、课程平台一起编排'
              : 'One orchestration plane for labs, devices, and courses'}
          </h2>
          <p>
            {locale === 'zh'
              ? '前端图模型负责表达结构，规则层负责保护端口关系，导出层负责把链路交给课程系统。'
              : 'The graph model expresses structure, rules protect port relations, and exports connect the course system.'}
          </p>
        </Reveal>
        <Reveal className="neon-arch-panel">
          {integrations.map((item, index) => (
            <span
              key={item}
              style={{ '--delay': `${index * 120}ms` } as CSSProperties}
            >
              {item}
            </span>
          ))}
        </Reveal>
      </section>

      <section className="neon-section neon-playground-band">
        <Reveal className="neon-playground-copy">
          <p className="neon-eyebrow">PLAYGROUND</p>
          <h2>
            {locale === 'zh'
              ? '进入真实工作区，而不是只看展示页'
              : 'Step into the real workspace, not just a showcase'}
          </h2>
          <p>
            {locale === 'zh'
              ? '首页负责讲清品牌，/playground 直接承载真实可运行的 BlockDiagram 工作区。'
              : 'The landing page tells the story; /playground opens the real BlockDiagram workspace.'}
          </p>
          <div className="neon-inline-actions">
            <Button asChild className="neon-primary-btn">
              <Link to="/playground">
                <Rocket className="h-4 w-4" />
                {locale === 'zh' ? '进入体验区' : 'Open playground'}
              </Link>
            </Button>
            <Button asChild variant="outline" className="neon-outline-btn">
              <Link to="/docs">
                {locale === 'zh' ? '阅读文档' : 'Read docs'}
              </Link>
            </Button>
          </div>
        </Reveal>
      </section>

      <section className="neon-section">
        <Reveal className="neon-section-head">
          <p className="neon-eyebrow">FAQ</p>
          <h2>
            {locale === 'zh'
              ? '把复杂实验体验收束成明确路径'
              : 'A clear path through complex remote labs'}
          </h2>
        </Reveal>
        <div className="neon-faq-grid">
          {faqs.map(([question, answer], index) => (
            <Reveal key={question} delay={index * 0.06}>
              <details className="neon-faq-card">
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="neon-final-cta">
        <Reveal>
          <p className="neon-eyebrow">LINK COMPONENTS FOR M2PLAB</p>
          <h2>
            {locale === 'zh'
              ? '让学生第一次打开页面就想继续点下去'
              : 'Make the first viewport pull students into the lab'}
          </h2>
          <Button asChild className="neon-primary-btn">
            <Link to="/playground">
              {locale === 'zh' ? '开始搭建实验链路' : 'Start building'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </Reveal>
      </section>

      <footer className="neon-site-footer">
        <div className="neon-footer-inner">
          {footerColumns.map((column) => (
            <div key={column.title} className="neon-footer-column">
              <h3>{column.title}</h3>
              <nav>
                {column.links.map(([label, to]) => (
                  <Link key={label} to={to}>
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
          ))}
        </div>
        <div className="neon-footer-bottom">
          <span>LINK COMPONENTS FOR M2PLAB</span>
          <span>
            {locale === 'zh'
              ? '面向学生远程实验的组件链路平台'
              : 'Visual component links for remote student labs'}
          </span>
        </div>
      </footer>
    </div>
  )
}

export default HomePage
