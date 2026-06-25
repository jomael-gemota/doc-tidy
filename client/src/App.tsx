import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import IdpPage from './pages/IdpPage'
import JobPage from './pages/JobPage'
import VendorsPage from './pages/VendorsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<IdpPage />} />
          <Route path="/vendors" element={<VendorsPage />} />
          <Route path="/jobs/:id" element={<JobPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
