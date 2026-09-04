import { useCallback, useState } from 'react'
import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { useMsal } from '@azure/msal-react'
import {
  fetchPrivateMe,
  fetchPublicHola,
  getApiBaseUrl,
  type PrivateMeResponse,
  type PublicHolaResponse,
} from '../api/msalApi'
import { loginRequest } from '../auth/loginRequest'

type ApiState = {
  publicData: PublicHolaResponse | null
  privateData: PrivateMeResponse | null
}

export function ApiIntegration() {
  const { instance, accounts } = useMsal()
  const account = accounts[0]
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiState | null>(null)

  const callApis = useCallback(async () => {
    if (!account) return

    setLoading(true)
    setError(null)
    setData(null)

    try {
      const tokenResult = await instance.acquireTokenSilent({
        ...loginRequest,
        account,
      })

      const [publicData, privateData] = await Promise.all([
        fetchPublicHola(),
        fetchPrivateMe(tokenResult.accessToken),
      ])

      setData({ publicData, privateData })
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        setError(
          'Se requiere interacción. Cierra sesión e inicia sesión de nuevo.',
        )
        return
      }

      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo completar la integración con msal-api.',
      )
    } finally {
      setLoading(false)
    }
  }, [account, instance])

  if (!account) return null

  return (
    <section className="api-integration">
      <h2>Integración con msal-api</h2>
      <p className="token-hint">
        Base URL: <code>{getApiBaseUrl()}</code>. La ruta pública no lleva token;
        la privada envía el <strong>Access Token</strong> con scope{' '}
        <code>access_as_user</code>.
      </p>

      <div className="actions">
        <button type="button" onClick={() => void callApis()} disabled={loading}>
          {loading ? 'Consultando API…' : 'Probar API pública y privada'}
        </button>
      </div>

      {error && <p className="token-error">{error}</p>}

      {data && (
        <>
          <h3>GET /public/hola</h3>
          <pre className="token-box">{JSON.stringify(data.publicData, null, 2)}</pre>

          <h3>GET /api/me</h3>
          <pre className="token-box">{JSON.stringify(data.privateData, null, 2)}</pre>
        </>
      )}
    </section>
  )
}
