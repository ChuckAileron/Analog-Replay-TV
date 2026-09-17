import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/design-tokens.css'
import '../index.css'
import '../styles/admin-console.css'
import { AdminApp } from '../components/admin/AdminApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
)