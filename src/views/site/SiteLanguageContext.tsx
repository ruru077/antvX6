import type { ReactNode } from 'react'
export type SiteLocale = 'zh' | 'en'

type SiteLanguageContextValue = {
  locale: SiteLocale
}

const SiteLanguageContext = createContext<SiteLanguageContextValue | null>(null)

type Props = {
  children: ReactNode
}

export function SiteLanguageProvider({ children }: Props) {
  useEffect(() => {
    window.localStorage.removeItem('m2plab-site-locale')
    document.documentElement.lang = 'en'
  }, [])

  return (
    <SiteLanguageContext.Provider value={{ locale: 'en' }}>
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
