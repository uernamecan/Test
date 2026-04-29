import { RouterProvider } from 'react-router-dom'
import AppErrorBoundary from './components/common/AppErrorBoundary'
import { router } from './router'

export default function App() {
  return (
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>
  )
}
