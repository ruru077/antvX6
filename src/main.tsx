import App from '@/App'
import enUS from '@/i18n/en-US.json'
import zhCN from '@/i18n/zh-CN.json'
import zhTW from '@/i18n/zh-TW.json'
import '@/styles/global.scss'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// react-intl-universal 文案切换
const locales = {
  'en-US': enUS,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
}
intl.init({ currentLocale: 'zh-CN', locales })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
