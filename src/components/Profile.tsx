import { useEffect, useState } from 'react'
import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { useMsal } from '@azure/msal-react'
import { loginRequest } from '../auth/loginRequest'

type TokenView = {
  idToken: string
  accessToken: string
}

export function Profile() {
  const { instance, accounts } = useMsal()
  const account = accounts[0]
  const [tokens, setTokens] = useState<TokenView | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!account) return

    let cancelled = false

    async function loadTokens() {
      try {
        const result = await instance.acquireTokenSilent({
          ...loginRequest,
          account,
        })

        if (!cancelled) {
          setTokens({
            idToken: result.idToken,
            accessToken: result.accessToken,
          })
          setError(null)
        }
      } catch (err) {
        if (cancelled) return

        if (err instanceof InteractionRequiredAuthError) {
          setError(
            'Se requiere interacción. Cierra sesión e inicia sesión de nuevo.',
          )
          return
        }

        setError(
          err instanceof Error
            ? err.message
            : 'No se pudieron obtener los tokens.',
        )
      }
    }

    void loadTokens()

    return () => {
      cancelled = true
    }
  }, [account, instance])

  if (!account) return null

  const tid = account.idTokenClaims?.tid

  return (
    <section className="profile">
      <h2>Perfil</h2>
      <ul>
        <li>
          <strong>Nombre:</strong> {account.name ?? '—'}
        </li>
        <li>
          <strong>Usuario:</strong> {account.username}
        </li>
        <li>
          <strong>Tenant (tid):</strong> {typeof tid === 'string' ? tid : '—'}
        </li>
      </ul>

      {error && <p className="token-error">{error}</p>}
      {!error && !tokens && <p>Cargando tokens…</p>}
      {tokens && (
        <>
          <h2>ID Token (JWT · carnet)</h2>
          <p className="token-hint">
            Lo usa tu app para saber quién entró. No lo envíes a la API como
            pase.
          </p>
          <pre className="token-box">{tokens.idToken}</pre>

          <h2>Access Token (JWT · pase)</h2>
          <p className="token-hint">
            Pase para <code>msal-api</code> (scope{' '}
            <code>access_as_user</code>). Mándalo como Bearer a{' '}
            <code>GET /api/me</code> o usa el botón de integración.
          </p>
          <pre className="token-box">{tokens.accessToken}</pre>
        </>
      )}
    </section>
  )
}
