import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/design-tokens.css'
import '../styles/admin-base.css'
import '../styles/admin-console.css'
import '../styles/admin-modern.css'
import { AdminApp } from '../components/admin/AdminApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
)
