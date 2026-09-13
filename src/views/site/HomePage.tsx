import {
  ArrowRight,
  Check,
  Cloud,
  Cpu,
  Database,
  Play,
  Radio,
  Route,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router'
import { BentoCard, BentoGrid } from '@/components/ui/bento-grid'
import { Button } from '@/components/ui/button'
import { DiaTextReveal } from '@/components/ui/dia-text-reveal'
import { HeroVideoDialog } from '@/components/ui/hero-video-dialog'
import { IconCloud } from '@/components/ui/icon-cloud'
import { Lens } from '@/components/ui/lens'
import { Marquee } from '@/components/ui/marquee'
import { OrbitingCircles } from '@/components/ui/orbiting-circles'
import { RainbowButton } from '@/components/ui/rainbow-button'
import { Separator } from '@/components/ui/separator'
import { useSiteLanguage } from './SiteLanguageContext'

function GraphPreview({ compact = false }: { compact?: boolean }) {
  const nodes = [
    { label: 'Sensor', icon: Radio, className: 'site-graph-node sensor' },
    { label: 'Controller', icon: Cpu, className: 'site-graph-node controller' },
    { label: 'Actuator', icon: Zap, className: 'site-graph-node actuator' },
  ]

  return (
    <div className={`site-graph-window${compact ? ' compact' : ''}`}>
      <div className="site-window-bar">
        <div className="site-window-dots">
          <i />
          <i />
          <i />
        </div>
        <span>remote-lab.flow</span>
        <span className="site-live">
          <i /> Live
        </span>
      </div>
      <div className="site-graph-canvas">
        <svg viewBox="0 0 800 380" aria-hidden="true">
          <defs>
            <linearGradient id="flow-line" x1="0" x2="1">
              <stop stopColor="#737373" />
              <stop offset="1" stopColor="#60a5fa" />
            </linearGradient>
          </defs>
          <path d="M205 190 C280 190 265 104 355 104" />
          <path d="M455 104 C535 104 510 190 596 190" />
          <path
            className="site-flow-pulse"
            d="M205 190 C280 190 265 104 355 104 M455 104 C535 104 510 190 596 190"
          />
        </svg>
        {nodes.map(({ label, icon: Icon, className }) => (
          <motion.div
            key={label}
            className={className}
            animate={{ y: [0, -3, 0] }}
            transition={{
              duration: 5,
              repeat: Infinity,
              delay: label.length / 10,
            }}
          >
            <Icon />
            <span>{label}</span>
            <i className="site-port left" />
            <i className="site-port right" />
          </motion.div>
        ))}
        <div className="site-graph-status">
          <Check /> 3 modules validated <span>18 ms</span>
        </div>
      </div>
    </div>
  )
}

function OrbitVisual() {
  return (
    <div className="site-orbit-visual">
      <OrbitingCircles iconSize={40}>
        <Radio />
        <Cpu />
        <Zap />
        <Cloud />
        <Database />
      </OrbitingCircles>
      <OrbitingCircles iconSize={30} radius={100} reverse speed={2}>
        <Radio />
        <Cpu />
        <Cloud />
        <Database />
      </OrbitingCircles>
    </div>
  )
}

const iconCloudSlugs = [
  'typescript',
  'javascript',
  'dart',
  'java',
  'react',
  'flutter',
  'android',
  'html5',
  'css3',
  'nodedotjs',
  'express',
  'nextdotjs',
  'prisma',
  'amazonaws',
  'postgresql',
  'firebase',
  'nginx',
  'vercel',
  'testinglibrary',
  'jest',
  'cypress',
  'docker',
  'git',
  'jira',
  'github',
  'gitlab',
  'visualstudiocode',
  'androidstudio',
  'sonarqube',
  'figma',
]

const iconCloudImages = iconCloudSlugs.map(
  (slug) => `https://cdn.simpleicons.org/${slug}/${slug}`,
)

const marqueePlaceholders = Array.from({ length: 6 }, (_, index) => index)

function HomePage() {
  const { locale } = useSiteLanguage()
  const zh = locale === 'zh'
  return (
    <div className="site-home">
      <section className="site-hero site-hero-centered">
        <div className="site-hero-grid" />
        <div className="site-container">
          <motion.div
            className="site-hero-copy"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="site-pill">
              <Sparkles />{' '}
              {zh
                ? '下一代远程实验编排平台'
                : 'The next remote-lab orchestration platform'}{' '}
              <ArrowRight />
            </div>
            <h1>
              {zh
                ? '连接组件，让实验运行'
                : 'Connect components. Run experiments.'}
            </h1>
            <p>
              {zh
                ? '在一个可视化工作区中完成建模、验证、路由与远程接入。'
                : 'Model, validate, route, and connect remote systems in one visual workspace.'}
            </p>
            <div className="site-actions">
              <RainbowButton asChild size="lg" className="site-rainbow-action">
                <Link to="/playground">
                  {zh ? '开始搭建' : 'Start building'}
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </RainbowButton>
              <Button asChild size="lg" variant="outline">
                <Link to="/blog">
                  <Play data-icon="inline-start" />
                  {zh ? '了解工作方式' : 'See how it works'}
                </Link>
              </Button>
            </div>
            <div className="site-proof">
              <span>
                <Check /> {zh ? '无需安装' : 'No install'}
              </span>
              <span>
                <Check /> {zh ? '浏览器即用' : 'Browser native'}
              </span>
              <span>
                <Check /> {zh ? '开放模型格式' : 'Open model format'}
              </span>
            </div>
          </motion.div>
          <motion.div
            className="site-hero-visual"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.12 }}
          >
            <GraphPreview />
          </motion.div>
        </div>
      </section>

      <section className="site-platform-section">
        <div className="site-marquee-wrap">
          <Marquee pauseOnHover className="[--duration:20s]">
            {marqueePlaceholders.map((item) => (
              <div
                className="site-marquee-placeholder"
                key={item}
                aria-hidden="true"
              >
                <i />
                <span>
                  <b />
                  <b />
                </span>
              </div>
            ))}
          </Marquee>
          <Marquee reverse pauseOnHover className="[--duration:20s]">
            {marqueePlaceholders.map((item) => (
              <div
                className="site-marquee-placeholder"
                key={item}
                aria-hidden="true"
              >
                <i />
                <span>
                  <b />
                  <b />
                </span>
              </div>
            ))}
          </Marquee>
        </div>
        <div className="site-container">
          <div className="site-platform-head">
            <span>PLATFORM</span>
            <h2>
              {zh ? '看见整个实验链路' : 'See the entire experiment flow'}
            </h2>
            <p>
              {zh
                ? '从组件关系到远程执行，交互细节集中在同一个工作界面。'
                : 'From component relations to remote execution, every interaction lives in one workspace.'}
            </p>
          </div>
          <HeroVideoDialog
            className="site-video-dialog"
            animationStyle="from-center"
            videoSrc="/playground"
            thumbnailSrc="/site-workspace-preview.svg"
            thumbnailAlt={zh ? '可视化工作区预览' : 'Visual workspace preview'}
          />

          <BentoGrid className="site-magic-bento">
            <BentoCard
              name={zh ? '设备与系统自动协作' : 'Devices that work together'}
              description={
                zh
                  ? '围绕同一个实验模型连接传感器、控制器、执行器和云端服务。'
                  : 'Connect sensors, controllers, actuators, and cloud services around one model.'
              }
              href="/blog"
              cta={zh ? '了解连接能力' : 'Explore connections'}
              Icon={Workflow}
              className="md:col-span-2"
              background={<OrbitVisual />}
            />
            <BentoCard
              name={zh ? '开放的组件生态' : 'An open component ecosystem'}
              description={
                zh
                  ? '用统一图模型承载不同来源的能力。拖动图标云查看生态。'
                  : 'Bring capabilities from different sources into one graph model.'
              }
              href="/blog"
              cta={zh ? '查看生态' : 'View ecosystem'}
              Icon={Cloud}
              className="md:col-span-1"
              background={
                <div className="site-icon-cloud">
                  <IconCloud images={iconCloudImages} />
                </div>
              }
            />
            <BentoCard
              name={
                zh ? '放大每一个工程细节' : 'Inspect every engineering detail'
              }
              description={
                zh
                  ? 'Lens 让复杂模型中的端口、规则与信号关系更容易被检查。'
                  : 'Lens makes ports, rules, and signal relationships easier to inspect.'
              }
              href="/playground"
              cta={zh ? '进入工作区' : 'Open workspace'}
              Icon={Route}
              className="md:col-span-3"
              background={
                <div className="site-lens-preview">
                  <Lens zoomFactor={1.35} lensSize={150}>
                    <GraphPreview compact />
                  </Lens>
                </div>
              }
            />
          </BentoGrid>
        </div>
      </section>

      <section className="site-dia-reveal-section">
        <div className="site-container">
          <span className="site-dia-label">VISION</span>
          <h2>
            <DiaTextReveal
              text={
                zh
                  ? '把复杂实验系统，变成人人都能理解与运行的可视化模型。'
                  : 'Turn complex experiment systems into visual models anyone can understand and run.'
              }
              colors={['#111111', '#2563eb', '#60a5fa', '#dbeafe', '#111111']}
              textColor="#111111"
              duration={1.8}
              delay={0.15}
            />
          </h2>
        </div>
      </section>

      <section className="site-cta-section">
        <div className="site-container site-cta-card">
          <div>
            <span className="site-pill">
              <Sparkles /> M2PLINK
            </span>
            <h2>{zh ? '从一个组件开始。' : 'Start with one component.'}</h2>
            <p>
              {zh
                ? '打开真实工作区，搭建第一条实验链路。'
                : 'Open the real workspace and build your first experiment flow.'}
            </p>
            <div className="site-actions">
              <RainbowButton asChild size="lg" className="site-rainbow-action">
                <Link to="/playground">
                  {zh ? '进入体验区' : 'Open playground'}
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </RainbowButton>
            </div>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="site-container">
          <div>
            <strong>M2PLAB</strong>
            <p>
              {zh
                ? '连接组件，运行实验。'
                : 'Connect components. Run experiments.'}
            </p>
          </div>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/playground">Playground</Link>
            <Link to="/blog">Blog</Link>
          </nav>
        </div>
        <Separator />
        <div className="site-container site-footer-bottom">
          <span>© 2026 M2PLAB</span>
          <span>
            {zh ? '为开放的远程实验而构建' : 'Built for open remote labs'}
          </span>
        </div>
      </footer>
    </div>
  )
}

export default HomePage
