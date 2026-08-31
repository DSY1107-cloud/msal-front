import { useMsal } from '@azure/msal-react'
import { loginRequest } from '../auth/loginRequest'

export function SignInButton() {
  const { instance } = useMsal()

  return (
    <button type="button" onClick={() => instance.loginRedirect(loginRequest)}>
      Iniciar sesión con Microsoft
    </button>
  )
}
