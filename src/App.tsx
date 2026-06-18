import { useThemeToggle } from '@hooks/useThemeToggle'
import { RouterProvider } from 'react-router/dom'
import { router } from '@/router'
import '@styles/global.scss'

function App() {
  // 激活主题副作用（class、快捷键、跨标签页同步）
  useThemeToggle()

  return (
    <>
      <RouterProvider router={router} />
    </>
  )
}

export default App
