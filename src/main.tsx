import { createRoot } from 'react-dom/client'
import App from '@/App'
import enUS from '@/assets/i18n/en-US.json'
import zhCN from '@/assets/i18n/zh-CN.json'
import zhTW from '@/assets/i18n/zh-TW.json'
import '@/styles/global.scss'

// react-intl-universal 文案切换
const locales = {
  'en-US': enUS,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
}
intl.init({ currentLocale: 'zh-CN', locales })

createRoot(document.getElementById('root')!).render(
  // Dev确定后开启严格模型测试依赖
  // <StrictMode>
  <App />,
  // </StrictMode>,
)
