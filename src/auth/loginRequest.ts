import type { RedirectRequest } from '@azure/msal-browser'

const clientId = import.meta.env.VITE_CLIENT_ID ?? ''
const apiScope = `api://${clientId}/access_as_user`

/** OIDC + scope delegado hacia msal-api. */
export const loginRequest: RedirectRequest = {
  scopes: ['openid', 'profile', apiScope],
}
