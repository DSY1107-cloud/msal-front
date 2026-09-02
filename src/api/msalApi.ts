const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

export type PublicHolaResponse = {
  mensaje: string
  recurso: string
}

export type PrivateMeResponse = {
  mensaje: string
  sub: string
  aud: string | string[]
  scp: string | null
  preferred_username: string | null
  oid: string | null
  iss: string | null
}

export function getApiBaseUrl(): string {
  return baseUrl
}

export async function fetchPublicHola(): Promise<PublicHolaResponse> {
  const response = await fetch(`${baseUrl}/public/hola`, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`GET /public/hola respondió ${response.status}`)
  }

  return response.json() as Promise<PublicHolaResponse>
}

export async function fetchPrivateMe(
  bearerToken: string,
): Promise<PrivateMeResponse> {
  const response = await fetch(`${baseUrl}/api/me`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${bearerToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`GET /api/me respondió ${response.status}`)
  }

  return response.json() as Promise<PrivateMeResponse>
}
