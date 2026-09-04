# Guía práctica — Integración React + API Spring Boot

**Asignatura:** DSY1107 — Desarrollo Cloud Native I  
**EA1 · IDaaS / OAuth / resource server**  
**Carpeta de referencia:** `material complementario/msal-front`  
**Va después de:** `README.md` (este front) y `../msal-api/README.md` (el back)

Esta guía es **autoexplicativa**: en cada paso verás *para qué sirve*, *qué vas a hacer*, el *código completo* y *cómo comprobar* que quedó bien. Síguela en orden (Paso 0 → 8).

No saltes pasos: cada uno deja el proyecto listo para el siguiente.

---

## Idea de fondo (léelo antes de codear)

En la guía del front (`README.md`) React solo **mostraba** los JWT en pantalla. En la guía del back (`msal-api/README.md`) Spring ya valida tokens de Entra. Ahora conectas ambos: el **client** llama al **resource server**.

| Rol OAuth | En este demo |
|---|---|
| Resource owner | Tú / el estudiante |
| Client | `msal-front` (React) |
| Auth server | Microsoft Entra ID |
| Resource server | `msal-api` (Spring Boot) |

Spring **no hace login**. El front ya inició sesión con MSAL; solo reenvía un JWT que Entra firmó.

| Ruta | Token en el request | Resultado esperado |
|---|---|---|
| `GET /public/hola` | ninguno | **200** — cualquiera entra |
| `GET /api/me` | no | **401** |
| `GET /api/me` | `Authorization: Bearer <JWT>` | **200** + claims |

### Qué token manda el front en esta clase

El front pide `User.Read` (Microsoft Graph). Eso produce **dos** JWT distintos:

| Token | Metáfora | `aud` (audiencia) | ¿Spring lo acepta hoy? |
|---|---|---|---|
| **ID Token** | Carnet (quién eres) | tu `VITE_CLIENT_ID` | **Sí** — mismo `iss` que configuraste |
| **Access Token** | Pase para Graph | `00000003-0000-0000-c000-000000000000` | **No** — lleva `nonce` en el header |

Por eso, en **esta clase**, la integración usa el **ID Token** como Bearer. No es el diseño final de producción (ahí irá un access token con scope `api://…/access_as_user`), pero demuestra el flujo client → resource server de punta a punta.

**Próxima clase:** Expose an API en Entra, pedir scope propio en `loginRequest.ts` y mandar ese access token (no el ID Token ni el de Graph).

---

## Qué vas a construir al final

Sobre el front que ya tienes del `README.md`, agregarás:

1. Una variable `VITE_API_URL` apuntando a Spring (`http://localhost:8080`).
2. Un módulo `src/api/msalApi.ts` con las dos llamadas `fetch`.
3. Un componente `ApiIntegration.tsx` con un botón **Probar API pública y privada**.
4. La sección de integración montada en `App.tsx` (solo con sesión activa).

Tras iniciar sesión, el alumno podrá pulsar un botón y ver en pantalla el JSON de `/public/hola` y el de `/api/me`.

**Cómo usar esta carpeta si ya está integrada:**

```bash
# Terminal 1 — API
cd ../msal-api
./mvnw spring-boot:run

# Terminal 2 — Front
cd msal-front
npm run dev
```

Inicia sesión → **Probar API pública y privada**.

---

## Paso 0 — Prerrequisitos: front y back listos

**Para qué:** no tiene sentido integrar si alguno de los dos proyectos no funciona solo.

Antes de empezar, confirma:

1. Completaste la guía del front (`README.md`, Pasos 0 → 9): login y logout funcionan.
2. Completaste la guía del back (`../msal-api/README.md`, Pasos 0 → 7): `./mvnw spring-boot:run` levanta en el puerto **8080**.
3. En `msal-api/src/main/resources/application.yml`, el `issuer-uri` usa el **mismo Directory (tenant) ID** que `VITE_TENANT_ID` de tu `.env`.

En otra terminal (con la API corriendo):

```bash
curl -i http://localhost:8080/public/hola
```

Debes ver **HTTP/1.1 200** y un JSON con `"mensaje": "API pública: no se pidió token."`.

**Cómo comprobar:** los tres ítems de arriba se cumplen; el `curl` responde 200.

---

## Paso 1 — Verificar la API privada con curl (referencia)

**Para qué:** entender qué espera Spring **antes** de escribir código React. Así, si algo falla en el front, sabes si el problema es la API o la integración.

Con la API corriendo:

```bash
# Sin token → 401
curl -i http://localhost:8080/api/me

# Con token → 200 (pega el ID Token de Perfil en msal-front)
curl -i http://localhost:8080/api/me \
  -H "Authorization: Bearer PEGA_AQUI_EL_ID_TOKEN"
```

| Prueba | Esperado |
|---|---|
| Sin header `Authorization` | **401 Unauthorized** |
| Bearer = **ID Token** de Perfil | **200** + `preferred_username`, `sub`, `iss` |
| Bearer = **Access Token** de Graph | **401** (normal en esta clase) |

**Por qué el access token de Graph falla:** ese JWT es un pase **para Microsoft Graph**, no para tu API. Spring intenta validarlo y rechaza la firma (header con `nonce`).

**Cómo comprobar:** el ID Token funciona en curl; el access token de Graph da 401. Eso confirma que el back está bien y que en React debes mandar el ID Token.

---

## Paso 2 — Agregar `VITE_API_URL` al `.env`

**Para qué:** el front necesita saber en qué URL vive Spring. Hoy es local; mañana puede ser otro host.

Abre `.env` en la raíz de `msal-front` y agrega esta línea (si no existe):

```env
VITE_API_URL=http://localhost:8080
```

Tu `.env` completo debería verse similar a:

```env
VITE_CLIENT_ID=11111111-2222-3333-4444-555555555555
VITE_TENANT_ID=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
VITE_REDIRECT_URI=http://localhost:5173
VITE_API_URL=http://localhost:8080
```

También actualiza `.env.example` (para que otros alumnos sepan qué variable falta):

```env
VITE_CLIENT_ID=REEMPLAZAR_CON_APPLICATION_CLIENT_ID
VITE_TENANT_ID=REEMPLAZAR_CON_DIRECTORY_TENANT_ID
VITE_REDIRECT_URI=http://localhost:5173
VITE_API_URL=http://localhost:8080
```

| Clave | Qué es | Valor local |
|---|---|---|
| `VITE_API_URL` | URL base de `msal-api` | `http://localhost:8080` |

**Por qué el prefijo `VITE_`:** Vite solo expone al código variables que empiezan así. Si escribes `API_URL` sin `VITE_`, en el código saldrá `undefined`.

Guarda el archivo y **reinicia** Vite (`Ctrl+C` → `npm run dev`).

**Cómo comprobar:** en DevTools → Consola del navegador, tras recargar, no deberías ver errores por URL indefinida al probar la integración (Paso 8).

---

## Paso 3 — Cliente HTTP: `src/api/msalApi.ts`

**Para qué:** centralizar las dos llamadas a la API en un solo archivo. Si mañana cambia la URL o el endpoint, lo editas en un lugar.

Crea la carpeta `src/api/` y dentro el archivo `msalApi.ts` con **todo** este contenido:

```typescript
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
```

| Función | Qué hace | Token |
|---|---|---|
| `fetchPublicHola()` | `GET /public/hola` | ninguno |
| `fetchPrivateMe(token)` | `GET /api/me` | Bearer que tú le pases |

**Por qué `fetch` nativo y no axios:** el demo solo hace GET; no hace falta instalar otra dependencia.

**Estructura que debes ver:**

```text
msal-front/
└── src/
    ├── api/
    │   └── msalApi.ts    ← nuevo
    ├── auth/
    ├── components/
    ...
```

**Cómo comprobar:** el archivo existe, compila sin errores (`npm run build` si quieres adelantarte).

---

## Paso 4 — Componente `ApiIntegration.tsx`

**Para qué:** la UI que, al pulsar un botón, obtiene el ID Token con MSAL y llama a las dos rutas de Spring.

Crea `src/components/ApiIntegration.tsx` con **todo** este contenido:

```tsx
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
        fetchPrivateMe(tokenResult.idToken),
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
        la privada envía el <strong>ID Token</strong> como Bearer (limitación de
        esta clase con scope <code>User.Read</code>).
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
```

Puntos clave del código:

| Línea / bloque | Qué hace |
|---|---|
| `acquireTokenSilent({ ...loginRequest, account })` | Reutiliza la sesión MSAL sin redirigir de nuevo |
| `fetchPublicHola()` | Llama la ruta pública sin `Authorization` |
| `fetchPrivateMe(tokenResult.idToken)` | Manda el **ID Token** como Bearer (no `accessToken`) |
| `Promise.all([...])` | Ejecuta ambas llamadas en paralelo |

**Cómo comprobar:** el archivo existe y exporta `ApiIntegration`. Aún no lo verás en pantalla hasta el Paso 6.

---

## Paso 5 — Actualizar el texto de Perfil (opcional pero recomendado)

**Para qué:** que el alumno entienda en pantalla por qué el access token de Graph no sirve para Spring en esta clase.

En `src/components/Profile.tsx`, reemplaza el párrafo bajo **Access Token (JWT · pase)** por:

```tsx
          <p className="token-hint">
            Con scope <code>User.Read</code> es un pase para Microsoft Graph (lleva{' '}
            <code>nonce</code> en el header). En esta clase Spring no lo valida;
            la integración usa el ID Token. Más adelante pedirás un scope propio{' '}
            <code>api://…</code> y este pase irá al API.
          </p>
```

**Cómo comprobar:** tras login, el texto bajo el access token menciona Graph y la integración.

---

## Paso 6 — Montar la integración en `App.tsx`

**Para qué:** mostrar `ApiIntegration` solo cuando hay sesión (igual que `Profile`).

Reemplaza `src/App.tsx` por **todo** este contenido:

```tsx
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
```

El único cambio respecto al `App.tsx` del `README.md` es:

```tsx
import { ApiIntegration } from './components/ApiIntegration'
// ...
<Profile />
<ApiIntegration />
```

**Cómo comprobar:** tras login, debajo de Perfil aparece la sección **Integración con msal-api** con el botón.

---

## Paso 7 — Estilos en `App.css`

**Para qué:** que los subtítulos de las respuestas JSON y el botón deshabilitado se vean ordenados.

Al final de `src/App.css`, agrega:

```css
.api-integration h3 {
  margin: 1.25rem 0 0.5rem;
  font-size: 1rem;
}

.api-integration .actions button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
```

Reutilizamos las clases `.token-box`, `.token-hint` y `.token-error` que ya creaste en el Paso 7.2 del `README.md`.

**Cómo comprobar:** los JSON de la API se muestran con el mismo estilo oscuro que los JWT de Perfil.

---

## Paso 8 — Probar el flujo completo (front + back)

**Para qué:** validar la integración de punta a punta, no solo cada archivo por separado.

### 8.1 Levantar ambos servicios

Terminal 1 — API:

```bash
cd msal-api
./mvnw spring-boot:run
```

Espera el log `Tomcat started on port 8080`.

Terminal 2 — Front:

```bash
cd msal-front
npm run dev
```

Abre `http://localhost:5173`.

### 8.2 Recorrer la tabla

| # | Qué haces | Qué deberías ver |
|---|---|---|
| 1 | Inicias sesión con Microsoft | Perfil con nombre, usuario, tokens |
| 2 | Baja a **Integración con msal-api** | Base URL `http://localhost:8080` |
| 3 | Clic en **Probar API pública y privada** | Dos bloques JSON |
| 4 | Lees `/public/hola` | `"mensaje": "API pública: no se pidió token."` |
| 5 | Lees `/api/me` | `"mensaje": "API privada: el access token es válido."`, tu `preferred_username`, `sub`, `iss` |
| 6 | DevTools → pestaña **Network** | Peticiones a `:8080` sin error CORS |

### 8.3 CORS (no deberías tocar nada)

El back ya autoriza `http://localhost:5173` en `SecurityConfig.java`:

```java
cfg.setAllowedOrigins(List.of("http://localhost:5173", "http://localhost:4200"));
```

Si el front corre en el puerto **5173**, no cambies el back.

Detén ambos servicios con `Ctrl+C` cuando termines.

### Checklist final

- [ ] Completé la guía del front (`README.md`) y del back (`msal-api/README.md`)
- [ ] `VITE_API_URL=http://localhost:8080` en `.env` y reinicié Vite
- [ ] Existen `src/api/msalApi.ts` y `src/components/ApiIntegration.tsx`
- [ ] `App.tsx` monta `<ApiIntegration />` dentro de `AuthenticatedTemplate`
- [ ] `/public/hola` responde 200 desde el botón del front
- [ ] `/api/me` responde 200 con ID Token como Bearer
- [ ] Entiendo por qué el access token de Graph **no** sirve en esta clase
- [ ] `npm run build` pasa

---

## Flujo (diagrama)

```mermaid
sequenceDiagram
    participant U as Usuario
    participant R as msal-front
    participant E as Entra ID
    participant S as msal-api

    U->>R: Iniciar sesión
    R->>E: loginRedirect (openid, profile, User.Read)
    E->>R: ID Token + Access Token Graph
    U->>R: Probar API pública y privada
    R->>S: GET /public/hola (sin Authorization)
    S->>R: 200 JSON público
    R->>S: GET /api/me (Bearer ID Token)
    S->>S: Valida iss del tenant
    S->>R: 200 JSON con claims
```

---

## Si algo falla

| Síntoma | Qué significa | Qué hacer |
|---|---|---|
| `Failed to fetch` | API apagada o URL mal | Verifica `./mvnw spring-boot:run` y `VITE_API_URL` |
| CORS en consola | Origen no permitido | Front en 5173; revisa `SecurityConfig` en el back |
| `GET /api/me respondió 401` con ID Token | Tenant distinto o token expirado | `issuer-uri` = mismo GUID que `VITE_TENANT_ID`; cierra sesión y vuelve a entrar |
| `GET /api/me respondió 401` si cambias a `accessToken` | Graph token con `nonce` | En esta clase usa `tokenResult.idToken`, no `accessToken` |
| `import.meta.env.VITE_API_URL` undefined | Falta prefijo `VITE_` | Corrige `.env` y reinicia `npm run dev` |
| Botón no aparece | No hay sesión o falta import en `App.tsx` | Inicia sesión; revisa Paso 6 |
| Compila pero pantalla vacía en integración | Error silencioso en fetch | Abre DevTools → Network y Console |

---

## Comandos rápidos (proyecto ya integrado)

```bash
# API
cd msal-api
./mvnw spring-boot:run    # http://localhost:8080

# Front
cd msal-front
npm run dev               # http://localhost:5173
npm run build
```

```bash
curl http://localhost:8080/public/hola
curl -i http://localhost:8080/api/me \
  -H "Authorization: Bearer <ID_TOKEN_DE_PERFIL>"
```

---

## Próximo paso

Sigue **`../GUIA_ACCESS_TOKEN.md`** (y su PDF `GUIA_ACCESS_TOKEN.pdf`) para usar el **access token real** con Expose an API, `audiences` en Spring y scope `api://…/access_as_user`.
