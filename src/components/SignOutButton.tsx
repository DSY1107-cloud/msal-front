import { useMsal } from '@azure/msal-react'

export function SignOutButton() {
  const { instance } = useMsal()

  return (
    <button
      type="button"
      onClick={() =>
        instance.logoutRedirect({
          postLogoutRedirectUri:
            import.meta.env.VITE_REDIRECT_URI ?? 'http://localhost:5173',
        })
      }
    >
      Cerrar sesión
    </button>
  )
}
