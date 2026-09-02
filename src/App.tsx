import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
} from '@azure/msal-react'
import { isAuthConfigured } from './auth/msalConfig'
import { SignInButton } from './components/SignInButton'
import { SignOutButton } from './components/SignOutButton'
import { ApiIntegration } from './components/ApiIntegration'
import { Profile } from './components/Profile'
import './App.css'

export default function App() {
  if (!isAuthConfigured) {
    return (
      <main className="app">
        <h1>React + MSAL · Entra ID</h1>
        <p className="banner">
          Configuración incompleta. Copia <code>.env.example</code> a{' '}
          <code>.env</code> y reemplaza <code>VITE_CLIENT_ID</code> y{' '}
          <code>VITE_TENANT_ID</code> con los valores del App Registration.
          Luego reinicia <code>npm run dev</code>.
        </p>
      </main>
    )
  }

  return (
    <main className="app">
      <h1>React + MSAL · Entra ID</h1>

      <AuthenticatedTemplate>
        <div className="actions">
          <SignOutButton />
        </div>
        <Profile />
        <ApiIntegration />
      </AuthenticatedTemplate>

      <UnauthenticatedTemplate>
        <p>No hay sesión. Usa el botón para autenticarte con Microsoft.</p>
        <div className="actions">
          <SignInButton />
        </div>
      </UnauthenticatedTemplate>
    </main>
  )
}
