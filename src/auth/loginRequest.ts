import type { RedirectRequest } from '@azure/msal-browser'

/** Scopes mínimos para login OIDC + perfil básico. */
export const loginRequest: RedirectRequest = {
  scopes: ['openid', 'profile', 'User.Read'],
}
