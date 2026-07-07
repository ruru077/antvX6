import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { SiteLocale } from './siteContent'

type SiteLanguageContextValue = {
  locale: SiteLocale
  setLocale: (locale: SiteLocale) => void
}

const SiteLanguageContext = createContext<SiteLanguageContextValue | null>(null)
const STORAGE_KEY = 'm2plab-site-locale'

type Props = {
  children: ReactNode
}

function getBrowserLocale(): SiteLocale {
  if (typeof window === 'undefined') {
    return 'zh'
  }

  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved === 'en' || saved === 'zh') {
    return saved
  }

  const browserLang = navigator.language.toLowerCase()
  return browserLang.startsWith('en') ? 'en' : 'zh'
}

export function SiteLanguageProvider({ children }: Props) {
  const [locale, setLocale] = useState<SiteLocale>(getBrowserLocale)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, locale)
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN'
  }, [locale])

  return (
    <SiteLanguageContext.Provider value={{ locale, setLocale }}>
      {children}
    </SiteLanguageContext.Provider>
  )
}

export function useSiteLanguage() {
  const context = useContext(SiteLanguageContext)
  if (!context) {
    throw new Error('useSiteLanguage must be used inside SiteLanguageProvider')
  }
  return context
}
