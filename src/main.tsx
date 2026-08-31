import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { msalConfig, isAuthConfigured } from './auth/msalConfig'
import App from './App.tsx'
import './index.css'

const root = createRoot(document.getElementById('root')!)

async function bootstrap() {
  // Sin IDs reales no se instancia MSAL (clientId debe ser un GUID válido).
  if (!isAuthConfigured) {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    return
  }

  const msalInstance = new PublicClientApplication(msalConfig)
  await msalInstance.initialize()
  await msalInstance.handleRedirectPromise()

  root.render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </StrictMode>,
  )
}

void bootstrap()
