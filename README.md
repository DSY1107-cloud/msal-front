# Guía práctica — Front React + MSAL (Microsoft Entra ID)

**Asignatura:** DSY1107 — Desarrollo Cloud Native I  
**EA1 · IDaaS / OAuth / Entra ID**  
**Carpeta de referencia:** `material complementario/msal-front`

Esta guía es **autoexplicativa**: en cada paso verás *para qué sirve*, *qué vas a hacer*, el *código completo* y *cómo comprobar* que quedó bien. Síguela en orden (Paso 0 → 9).

---

## Idea de fondo (léelo antes de codear)

En OAuth / OpenID Connect tu React **no pide la contraseña**. Solo es el **client** (el programa). Quien autentica es Microsoft Entra ID (**auth server**). La persona que inicia sesión es el **resource owner**.

| Rol OAuth | En este demo |
|---|---|
| Resource owner | Tú / el estudiante (la persona) |
| Client | La app React |
| Auth server | Microsoft Entra ID |
| Resource server | Todavía no (más adelante: API / Gateway) |

**MSAL** (`@azure/msal-browser` + `@azure/msal-react`) es la librería oficial de Microsoft que, desde el navegador:

1. Te manda a la pantalla de login de Microsoft (**redirect**).
2. Vuelve a tu app con tokens.
3. Guarda la sesión en el navegador.
4. Te deja leer “quién entró” (datos del **ID Token** / cuenta).

En este demo mostramos el **ID Token** (carnet: quién eres) y el **access token** JWT (pase) para inspeccionarlo en clase. Más adelante el access token irá al API / Gateway; aquí aún no llamamos a un backend propio.

---

## Qué vas a construir al final

Una SPA React + TypeScript (Vite) que:

1. Lee tres valores desde `.env`: client id, tenant id y URL de retorno.
2. Si esos valores aún son placeholders, muestra un aviso claro (no se rompe).
3. Si están configurados, muestra **Iniciar sesión con Microsoft**.
4. Tras el login, muestra nombre, usuario y tenant, y permite **Cerrar sesión**.

**Cómo usar esta carpeta si ya está generada:**

```bash
cd msal-front
npm install
cp .env.example .env
# Completa los IDs (Paso 8)
npm run dev
```

Si partes de cero, no saltes pasos: cada uno deja el proyecto listo para el siguiente.

---

## Paso 0 — Prerrequisitos

**Para qué:** asegurarte de que tu máquina puede crear y correr un proyecto Vite.

En la terminal:

```bash
node -v
npm -v
```

Necesitas Node.js **18+** (recomendado 20 LTS) y npm. Para el Paso 8 también necesitas una cuenta Azure con acceso a **Microsoft Entra ID**.

**Cómo comprobar:** ambos comandos imprimen un número de versión (no un error “command not found”).

---

## Paso 1 — Crear el proyecto Vite (React + TypeScript)

**Para qué:** tener un front React vacío, con TypeScript y servidor de desarrollo en el puerto 5173. Todavía **no** hay login; solo la base.

En la carpeta donde quieras el demo:

```bash
npm create vite@latest msal-front -- --template react-ts
cd msal-front
npm install
```

Arranca una vez:

```bash
npm run dev
```

Abre `http://localhost:5173`. Debe verse la página por defecto de Vite/React. En la plantilla actual (Vite 8) es una pantalla **Get started** con logos de React y Vite, no el contador clásico de tutoriales viejos. Detén el servidor con `Ctrl+C`.

**Por qué Vite y no Create React App:** Vite es el scaffold actual recomendado: arranca rápido y usa `import.meta.env` para variables de entorno (lo usaremos en el Paso 3).

**Estructura mínima que debes ver ahora:**

```text
msal-front/
├── package.json
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
└── src/
    ├── main.tsx      ← punto de entrada
    ├── App.tsx       ← componente raíz (lo reemplazaremos)
    ├── App.css
    └── index.css
```

**Cómo comprobar:** la app abre en el navegador sin errores en la terminal.

---

## Paso 2 — Instalar MSAL

**Para qué:** agregar la librería que habla con Entra ID. Sin esto, tendrías que armar a mano URLs de `/authorize`, guardar tokens, etc. MSAL ya lo resuelve.

Dentro de `msal-front`:

```bash
npm install @azure/msal-browser @azure/msal-react
```

Se instalan **dos** paquetes a propósito:

| Paquete | Qué es | Qué te da en la práctica |
|---|---|---|
| `@azure/msal-browser` | Motor MSAL para el navegador | Crear la app cliente (`PublicClientApplication`), hacer `loginRedirect` / `logoutRedirect`, guardar sesión |
| `@azure/msal-react` | Adaptador para React | `MsalProvider` (contexto), hooks como `useMsal`, plantillas `AuthenticatedTemplate` / `UnauthenticatedTemplate` |

**Versión de esta guía:** serie **5.x**. En MSAL 5 es **obligatorio** llamar a `initialize()` antes de usar el flujo redirect (lo harás en el Paso 5). Si copias tutoriales viejos de MSAL 2/3 y omites eso, el login puede fallar en silencio.

**Cómo comprobar:** en `package.json`, dentro de `"dependencies"`, aparecen `@azure/msal-browser` y `@azure/msal-react` además de `react` y `react-dom`.

---

## Paso 3 — Variables de entorno (sin pegar secretos en el código)

**Para qué:** el **client id** y el **tenant id** identifican tu App Registration en Azure. No deben ir hardcodeados en el `.tsx` (cambian por ambiente y no conviene versionarlos con valores reales de cada alumno).

En un SPA **no** usas client secret. Entra trata a la app como *public client*. Lo que sí configuras son IDs públicos + la URL de retorno.

### 3.1 Crear `.env.example`

**Para qué:** plantilla versionable. Cualquiera clona el repo y sabe qué variables faltan, sin ver tus GUIDs.

En la raíz del proyecto (`msal-front/.env.example`), crea el archivo con **exactamente** estas tres líneas:

```env
VITE_CLIENT_ID=REEMPLAZAR_CON_APPLICATION_CLIENT_ID
VITE_TENANT_ID=REEMPLAZAR_CON_DIRECTORY_TENANT_ID
VITE_REDIRECT_URI=http://localhost:5173
```

| Variable | Qué representa | De dónde sale después |
|---|---|---|
| `VITE_CLIENT_ID` | Identificador de **tu aplicación** registrada en Entra | App Registration → Application (client) ID |
| `VITE_TENANT_ID` | Identificador del **directorio** (organización) | App Registration / Entra → Directory (tenant) ID |
| `VITE_REDIRECT_URI` | URL a la que Microsoft **devuelve** al usuario tras login/logout | Debe coincidir con la URI SPA registrada (`http://localhost:5173` en local) |

**Por qué el prefijo `VITE_`:** Vite solo inyecta en el front variables que empiezan así. Si escribes `CLIENT_ID` sin `VITE_`, en el código saldrá `undefined`.

### 3.2 Crear tu `.env` local

```bash
cp .env.example .env
```

Si usas PowerShell en Windows: `Copy-Item .env.example .env`.

Deja los textos `REEMPLAZAR_...` por ahora. En el Paso 8 los cambiarás por GUIDs reales. Hasta entonces la app debe mostrar un aviso de configuración incompleta (Paso 5 y 7).

### 3.3 No subir `.env` a Git

Abre `.gitignore` y asegúrate de tener:

```gitignore
.env
.env.local
```

El `.gitignore` que genera Vite suele traer `*.local`, pero **no** incluye `.env`. Tienes que agregarlo tú; si no, un `git add .` sube tus GUIDs.

Así cada persona usa su propio registro / tenant sin filtrar IDs del aula en el repositorio.

**Cómo comprobar:** existen `.env.example` y `.env`; `.gitignore` lista `.env`.

---

## Paso 4 — Configuración MSAL en código (`src/auth`)

**Para qué:** concentrar en un solo lugar “cómo se conecta esta app a Entra”. Los botones de login solo dirán “inicia sesión”; no repetirán client id ni authority en cada componente.

Crea las carpetas:

```bash
mkdir -p src/auth src/components
```

### 4.1 Crear `src/auth/msalConfig.ts`

**Qué problema resuelve este archivo:**

1. Lee las tres variables del `.env`.
2. Arma el objeto de configuración que MSAL exige (`msalConfig`).
3. Decide si la config ya es usable (`isAuthConfigured`), para no intentar login con un client id inventado.

**Authority:** es la URL del auth server para tu tenant:

```text
https://login.microsoftonline.com/{tenantId}
```

Eso le dice a MSAL: “pide tokens a Entra, en **este** directorio”.

Crea `src/auth/msalConfig.ts` y pega **todo** esto:

```ts
import {
  type Configuration,
  BrowserCacheLocation,
  LogLevel,
} from '@azure/msal-browser'

const clientId = import.meta.env.VITE_CLIENT_ID ?? ''
const tenantId = import.meta.env.VITE_TENANT_ID ?? ''
const redirectUri =
  import.meta.env.VITE_REDIRECT_URI ?? 'http://localhost:5173'

/**
 * true solo si ya pegaste GUIDs reales en .env.
 * Si sigue el texto REEMPLAZAR_..., la app mostrará el aviso
 * y NO creará la instancia MSAL (un clientId inválido hace fallar MSAL 5).
 */
export const isAuthConfigured =
  Boolean(clientId) &&
  Boolean(tenantId) &&
  !clientId.startsWith('REEMPLAZAR') &&
  !tenantId.startsWith('REEMPLAZAR')

/** Configuración que recibe PublicClientApplication. */
export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri,
    postLogoutRedirectUri: redirectUri,
  },
  cache: {
    // LocalStorage: la sesión sobrevive a cerrar la pestaña (demo de aula).
    cacheLocation: BrowserCacheLocation.LocalStorage,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      piiLoggingEnabled: false,
    },
  },
}
```

**Lectura del objeto `auth`:**

| Campo | Significado en palabras simples |
|---|---|
| `clientId` | “Soy esta aplicación registrada en Entra” |
| `authority` | “Hablo con Entra de este tenant” |
| `redirectUri` | “Después del login, vuelve a esta URL de mi SPA” |
| `postLogoutRedirectUri` | “Después del logout, vuelve también aquí” |

**Cómo comprobar:** el archivo existe; no hay errores de import al guardar (el IDE debería resolver `@azure/msal-browser`).

### 4.2 Crear `src/auth/loginRequest.ts`

**Para qué:** cuando llamas a `loginRedirect`, MSAL debe saber **qué permisos / scopes** pedir. Un scope es “qué pedimos que el token permita o qué info de identidad queremos”.

En el aula: el access token es el **pase**; el scope es **qué salas** abre ese pase. Con OIDC:

| Scope | Qué estás pidiendo | Analogía de clase |
|---|---|---|
| `openid` | Quiero un **ID Token** (carnet: quién eres) | Sin esto no hay login OIDC de verdad |
| `profile` | Incluye claims básicos de perfil en la identidad | Nombre, etc. en el carnet |
| `User.Read` | Permiso delegado de Microsoft Graph para leer el perfil del usuario | Deja lista una llamada futura a Graph `/me` (no la hacemos en esta guía) |

Crea `src/auth/loginRequest.ts`:

```ts
import type { RedirectRequest } from '@azure/msal-browser'

/** Pedimos estos scopes en cada loginRedirect. */
export const loginRequest: RedirectRequest = {
  scopes: ['openid', 'profile', 'User.Read'],
}
```

**Qué NO pidas todavía:** scopes de “tu API Spring”. Eso aparece cuando registres la API y quieras mandar el access token al Gateway. Aquí el objetivo es solo **identidad en el front**.

**Cómo comprobar:** el archivo exporta `loginRequest` con exactamente esos tres scopes.

---

## Paso 5 — Arrancar React envuelto en MSAL (`src/main.tsx`)

**Para qué:** `main.tsx` es el primer archivo que corre. Aquí debes:

1. Crear la instancia MSAL (solo si `.env` ya tiene IDs reales).
2. Inicializarla (`initialize`).
3. Procesar el regreso del redirect (`handleRedirectPromise`), por si el usuario vuelve desde login.microsoftonline.com.
4. Envolver la app en `MsalProvider` para que los componentes hijos usen `useMsal()`.

**Por qué un `bootstrap` async:** en MSAL 5, `initialize()` y `handleRedirectPromise()` son asíncronos. Si renderizas la UI antes, puedes perder el resultado del login al volver del redirect (síntoma típico: pantalla en blanco o “sigue sin sesión”).

**Reemplaza por completo** `src/main.tsx` con:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { msalConfig, isAuthConfigured } from './auth/msalConfig'
import App from './App.tsx'
import './index.css'

const root = createRoot(document.getElementById('root')!)

async function bootstrap() {
  // Caso A: todavía no hay GUIDs → solo UI con aviso (Paso 7).
  if (!isAuthConfigured) {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    return
  }

  // Caso B: hay IDs → crear MSAL, inicializar, atrapar el redirect, proveer contexto.
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
```

**Orden que no debes alterar (Caso B):**

```text
1) new PublicClientApplication(msalConfig)
2) await initialize()
3) await handleRedirectPromise()
4) render con <MsalProvider>
```

**Cómo comprobar:** con `.env` aún en `REEMPLAZAR_...`, al correr `npm run dev` la app abre y no revienta en consola por client id inválido.

---

## Paso 6 — Botones y perfil (componentes)

**Para qué:** separar responsabilidades. Un componente inicia sesión, otro cierra, otro solo muestra datos. `App.tsx` (Paso 7) decide cuándo mostrar cada uno.

### 6.1 `SignInButton.tsx` — “llévame a Microsoft”

`useMsal()` entrega la `instance` (tu `PublicClientApplication`).  
`loginRedirect(loginRequest)` redirige el navegador completo a Entra con los scopes del Paso 4.2.

Crea `src/components/SignInButton.tsx`:

```tsx
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
```

### 6.2 `SignOutButton.tsx` — “cierra sesión en Entra y vuelve”

`logoutRedirect` limpia la sesión MSAL y puede cerrar también la sesión en Microsoft, luego vuelve a `postLogoutRedirectUri` (tu Vite local).

Crea `src/components/SignOutButton.tsx`:

```tsx
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
```

### 6.3 `Profile.tsx` — “muéstrame el carnet y el pase”

Después del login, MSAL deja una **account** en memoria/cache (identidad). Para ver los **JWT crudos**, pedimos tokens en silencio con `acquireTokenSilent` (mismos scopes del Paso 4.2).

| Bloque en pantalla | De dónde sale | Qué significa en clase |
|---|---|---|
| Nombre / usuario / tid | `account` + `idTokenClaims` | Quién entró (identidad básica) |
| ID Token (JWT) | `result.idToken` | Carnet → lo mira **tu app**, no la API |
| Access Token (JWT) | `result.accessToken` | Pase → más adelante lo mandas al API / Gateway |

Crea `src/components/Profile.tsx` con **todo** este contenido:

```tsx
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
            Este es el que más adelante iría al API / Gateway. Aquí lo mostramos
            solo para inspeccionarlo en clase.
          </p>
          <pre className="token-box">{tokens.accessToken}</pre>
        </>
      )}
    </section>
  )
}
```

Las clases `.token-box`, `.token-hint` y `.token-error` las pegas en el **Paso 7.2** al reemplazar `src/App.css`. Si ves el perfil sin cajas de token, te saltaste ese CSS.

**Cómo comprobar:** tras el login ves perfil + ambos JWT en pantalla.

---

## Paso 7 — Pantalla principal: los tres estados de la UI

**Para qué:** el usuario siempre debe entender en qué estado está la app. Sin eso, un `.env` vacío parece “app rota”.

Los tres estados:

```text
1) Sin IDs en .env     → banner “configuración incompleta”
2) Con IDs, sin sesión → botón Iniciar sesión
3) Con IDs, con sesión → Perfil + botón Cerrar sesión
```

`AuthenticatedTemplate` / `UnauthenticatedTemplate` (de `@azure/msal-react`) renderizan hijos solo si MSAL considera que hay o no hay sesión. Solo funcionan **dentro** de `MsalProvider` (por eso el Caso B del Paso 5). Cuando no hay config, ni siquiera montamos `MsalProvider`: mostramos el banner a mano con `isAuthConfigured`.

### 7.1 Reemplazar `src/App.tsx`

```tsx
import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
} from '@azure/msal-react'
import { isAuthConfigured } from './auth/msalConfig'
import { SignInButton } from './components/SignInButton'
import { SignOutButton } from './components/SignOutButton'
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

### 7.2 Reemplazar `src/App.css`

Estilos mínimos para leer el demo en clase (banner, botones y cajas JWT). Pega todo el contenido:

```css
.app {
  max-width: 52rem;
  margin: 0 auto;
  padding: 2.5rem 1.25rem;
}

.app h1 {
  margin: 0 0 1rem;
  font-size: 1.75rem;
  letter-spacing: -0.02em;
}

.app h2 {
  margin: 1.5rem 0 0.75rem;
  font-size: 1.15rem;
}

.banner {
  padding: 1rem 1.1rem;
  border: 1px solid #c9a227;
  background: #fff8e1;
  color: #5c4b00;
  line-height: 1.5;
}

.banner code {
  font-size: 0.9em;
}

.actions {
  margin: 1rem 0;
}

.actions button {
  font: inherit;
  cursor: pointer;
  padding: 0.65rem 1.1rem;
  border: 1px solid #1a1a1a;
  background: #1a1a1a;
  color: #fff;
}

.actions button:hover {
  background: #333;
  border-color: #333;
}

.profile ul {
  margin: 0;
  padding-left: 1.1rem;
  line-height: 1.7;
}

.token-hint {
  margin: 0 0 0.5rem;
  color: #444;
  font-size: 0.95rem;
}

.token-error {
  color: #8a1f1f;
  background: #fdecec;
  border: 1px solid #e2a0a0;
  padding: 0.75rem 1rem;
}

.token-box {
  margin: 0 0 1.25rem;
  padding: 0.85rem 1rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 0.75rem;
  line-height: 1.45;
  background: #1a1a1a;
  color: #e8e8e8;
  border-radius: 0.4rem;
}
```

### 7.3 Reemplazar `src/index.css`

```css
:root {
  font-family: 'Segoe UI', system-ui, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color: #1a1a1a;
  background:
    radial-gradient(ellipse 80% 50% at 50% -20%, #d6e4ff 0%, transparent 55%),
    #f6f7f9;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

code {
  font-family: ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, monospace;
}
```

### 7.4 Título en `index.html` (opcional pero recomendado)

```html
<title>DSY1107 · React + MSAL · Entra ID</title>
```

### 7.5 Estructura esperada y prueba sin IDs

```text
msal-front/
├── .env.example
├── .env
├── .gitignore
├── package.json
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── App.css
    ├── index.css
    ├── auth/
    │   ├── msalConfig.ts
    │   └── loginRequest.ts
    └── components/
        ├── SignInButton.tsx
        ├── SignOutButton.tsx
        └── Profile.tsx
```

```bash
npm run build
npm run dev
```

**Cómo comprobar (aún sin App Registration):**

1. `npm run build` termina sin errores.
2. En el navegador ves el **banner amarillo** de configuración incompleta.
3. No aparece aún el botón de Microsoft (correcto: faltan IDs).

Detén con `Ctrl+C` cuando pases al Paso 8.

---

## Paso 8 — Registrar la app en Microsoft Entra ID

**Para qué:** Entra necesita conocer a tu **client**. El App Registration crea ese registro y te entrega los dos GUIDs del `.env`. También declara la URL de retorno para que Microsoft solo redirija a sitios que tú autorizaste (evita phishing con redirect libres).

Hazlo en el [Portal de Azure](https://portal.azure.com).

1. Busca **Microsoft Entra ID**.
2. Menú izquierdo → **App registrations** → **New registration**.
3. Completa así:

| Campo en el portal | Valor |
|---|---|
| Name | `dsy1107-react-msal-demo` (o el que indique el docente) |
| Supported account types | **Accounts in this organizational directory only** (solo tu tenant) |
| Redirect URI — plataforma | **Single-page application (SPA)** ← importante, no “Web” |
| Redirect URI — URL | `http://localhost:5173` |

4. **Register**.
5. En **Overview**, copia a tu `.env`:

| En Azure se llama | En `.env` se llama |
|---|---|
| Application (client) ID | `VITE_CLIENT_ID=...` |
| Directory (tenant) ID | `VITE_TENANT_ID=...` |

6. (Recomendado) **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated** → `User.Read` → **Add permissions**. Si el tenant lo pide, **Grant admin consent**.

   Eso alinea el permiso del portal con el scope `User.Read` del Paso 4.2.

7. Tu `.env` debe quedar con GUIDs reales, **sin** la palabra `REEMPLAZAR` y **sin** comillas:

```env
VITE_CLIENT_ID=11111111-2222-3333-4444-555555555555
VITE_TENANT_ID=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
VITE_REDIRECT_URI=http://localhost:5173
```

8. Guarda el archivo y **reinicia** Vite (`Ctrl+C` → `npm run dev`). Si no reinicias, seguirá el banner aunque el `.env` ya esté bien.

**Por qué SPA y no Web:** una app “Web” suele esperar client secret (confidential client). Un front en el navegador **no puede** guardar un secret de forma segura. La plataforma SPA indica public client + PKCE (lo maneja MSAL).

---

## Paso 9 — Probar el flujo completo

```bash
npm run dev
```

Abre `http://localhost:5173` y recorre la tabla:

| # | Qué haces | Qué deberías ver / entender |
|---|---|---|
| 1 | Cargas la app con `.env` válido | Desaparece el banner; aparece el texto de “No hay sesión” y el botón de Microsoft |
| 2 | Clic en **Iniciar sesión con Microsoft** | El navegador salta a `login.microsoftonline.com` (auth server). Tu React, en ese momento, no pide la clave |
| 3 | Te autenticas con una cuenta del tenant | Microsoft redirige de vuelta a `http://localhost:5173` con el resultado del login |
| 4 | Miras **Perfil** | Nombre, usuario, `tid`, e ID Token + Access Token (JWT). Identidad y pase visibles en el **client**; aún no llamas a tu API |
| 5 | **Cerrar sesión** | Vuelves al estado sin sesión |

### Checklist final

- [ ] Entiendo que React es el **client** y Entra el **auth server**
- [ ] Existen `msalConfig.ts` y `loginRequest.ts` con el código de esta guía
- [ ] `main.tsx` hace `initialize()` + `handleRedirectPromise()` antes del render con sesión
- [ ] App Registration es **SPA** con redirect `http://localhost:5173`
- [ ] `.env` tiene GUIDs; `.env` está en `.gitignore`; existe `.env.example`
- [ ] `npm run build` pasa
- [ ] Login y logout funcionan en el navegador

---

## Si algo falla

| Síntoma | Qué significa | Qué hacer |
|---|---|---|
| `AADSTS50011` | La URL de retorno no coincide con la registrada | En Entra, redirect SPA = exactamente `http://localhost:5173` |
| `AADSTS700016` | El client id no corresponde a una app de ese tenant | Revisa `VITE_CLIENT_ID` |
| Usuario / tenant no encontrado | Cuenta de otro directorio o tenant mal pegado | Revisa `VITE_TENANT_ID` y el tipo de cuentas del registro |
| Pantalla en blanco al volver de Microsoft | No se procesó el redirect | Revisa el orden del Paso 5 en `main.tsx` |
| Sigue el banner con IDs puestos | Vite no recargó `.env` o quedó `REEMPLAZAR_` | Reinicia `npm run dev`; abre `.env` y verifica |
| Azure pide un secret | Registraste plataforma **Web** | Crea / usa redirect como **SPA** |
| `import.meta.env.VITE_...` es `undefined` | Nombre de variable incorrecto | Debe empezar con `VITE_` y vivir en `.env` en la raíz |

---

## Comandos rápidos (proyecto ya armado)

```bash
cd msal-front
cp .env.example .env   # editar GUIDs
npm install
npm run dev            # http://localhost:5173
npm run build
```
