import { router } from '@/router'
import '@/styles/global.scss'
import { RouterProvider } from 'react-router/dom'
function App() {
  return (
    <>
      <RouterProvider router={router} />
    </>
  )
}

export default App
