import { router } from '@/router'
import '@/styles/ScopedCssDemo.scoped.scss'
import { RouterProvider } from 'react-router/dom'

function App() {
  return (
    <>
      <RouterProvider router={router} />
    </>
  )
}

export default App
