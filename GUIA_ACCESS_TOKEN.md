# Guía práctica — Access Token para tu API (Expose an API)

**Asignatura:** DSY1107 — Desarrollo Cloud Native I  
**EA1 · IDaaS / OAuth / resource server**  
**Carpeta de referencia:** `material complementario/`  
**Va después de:**

1. `msal-front/README.md` — front React + MSAL  
2. `msal-api/README.md` — API Spring Boot pública + privada  
3. `msal-front/GUIA_INTEGRACION.md` — integración front ↔ back  

Esta guía es **autoexplicativa**: en cada paso verás *para qué sirve*, *qué vas a hacer*, el *código completo* y *cómo comprobar* que quedó bien. Síguela en orden (Paso 0 → 9).

No saltes pasos: cada uno deja el proyecto listo para el siguiente.

---

## Idea de fondo (léelo antes de codear)

En la integración anterior (`GUIA_INTEGRACION.md`) el front mandaba el **ID Token** como Bearer porque el access token que MSAL devolvía era un pase **para Microsoft Graph**, no para tu API.

| Token | Metáfora | `aud` (audiencia) | ¿Sirve para `msal-api` hoy? |
|---|---|---|---|
| **ID Token** | Carnet (quién eres) | tu `VITE_CLIENT_ID` | Sí (atajo de la clase anterior) |
| **Access Token Graph** | Pase para Graph | `00000003-0000-0000-c000-000000000000` | **No** — header con `nonce` |
| **Access Token API** | Pase para **tu** API | `api://{client-id}` **o** el GUID `{client-id}` (v2.0) | **Sí** — diseño correcto |

En OAuth/OIDC el **resource server** (Spring) debe recibir un access token cuya **audiencia** sea tu API. Para lograrlo:

1. **Entra ID:** registras tu app como API (**Expose an API**) con un scope propio (`access_as_user`).
2. **Front:** pides ese scope en `loginRequest.ts` y mandas `accessToken` (no `idToken`).
3. **Back:** Spring valida `issuer-uri` **y** `audiences` (OAuth2 Resource Server nativo).

```text
Antes (integración básica):     React ──Bearer ID Token──► Spring
Después (esta guía):            React ──Bearer Access Token API──► Spring
```

---

## Qué vas a construir al final

Al terminar:

1. Entra ID expone `api://{client-id}/access_as_user` y emite access tokens **v2.0**.
2. El front pide ese scope y envía el **access token** a `/api/me`.
3. Spring valida `iss` (`issuer-uri`) y `aud` (`audiences`: GUID y/o `api://…`).
4. El ID Token y el access token de Graph **dejan de servir** para la ruta privada.

**Comprobar el éxito:** en [jwt.io](https://jwt.io), el access token de Perfil muestra `aud` = `api://…` o el GUID del client, y `scp: access_as_user`; Postman y el botón del front responden **200** en `/api/me`.

---

## Paso 0 — Prerrequisitos

**Para qué:** esta guía asume que ya tienes front, back e integración funcionando con ID Token.

Antes de empezar:

- [ ] Completaste `msal-front/README.md` (login MSAL).
- [ ] Completaste `msal-api/README.md` (API en `:8080`).
- [ ] Completaste `msal-front/GUIA_INTEGRACION.md` (botón que llama a `/public/hola` y `/api/me`).
- [ ] Tienes a mano **Application (client) ID** y **Directory (tenant) ID** de tu App Registration.

Anota tu **client ID** (ejemplo de formato):

```text
VITE_CLIENT_ID=11111111-2222-3333-4444-555555555555
```

En los pasos siguientes reemplaza `{client-id}` por ese GUID.

**Cómo comprobar:** ambos servicios arrancan; la integración actual responde 200 con ID Token.

---

## Paso 1 — Expose an API en Entra ID

**Para qué:** declarar que tu App Registration **también es una API** y definir el scope que el front pedirá.

1. Abre [Portal de Azure](https://portal.azure.com).
2. **Microsoft Entra ID** → **App registrations** → tu app del demo React.
3. Menú **Expose an API**.
4. Junto a **Application ID URI**, clic en **Set** (o **Add**).
5. Acepta el valor sugerido o escribe:

   ```text
   api://{client-id}
   ```

   Ejemplo:

   ```text
   api://11111111-2222-3333-4444-555555555555
   ```

6. Clic en **Add a scope**:

   | Campo | Valor |
   |---|---|
   | Scope name | `access_as_user` |
   | Who can consent | Admins and users |
   | Admin consent display name | `Access msal-api as user` |
   | Admin consent description | `Permite al front llamar a msal-api` |
   | User consent display name | `Access msal-api as user` |
   | User consent description | `Permite al front llamar a msal-api` |
   | State | Enabled |

7. **Add scope**.

El scope completo queda:

```text
api://{client-id}/access_as_user
```

**Por qué `access_as_user`:** es la convención de Microsoft para “el usuario delegado accede a la API como él mismo”.

**Cómo comprobar:** en **Expose an API** ves el URI `api://…` y el scope `access_as_user` en estado Enabled.

---

## Paso 2 — Autorizar la SPA en **Authorized client applications**

**Para qué:** en este demo la **misma** App Registration es SPA (front) y API (back). En lugar de **API permissions** (donde “My APIs” suele mostrar *No results*), pre-autorizas el client en **Expose an API** para que MSAL pueda pedir el scope `access_as_user`.

1. En la misma App Registration → **Expose an API**.
2. Baja a **Authorized client applications** → **Add a client application**.
3. **Client ID:** el mismo `VITE_CLIENT_ID` de tu `.env` (la SPA es la misma app).

   ```text
   {client-id}
   ```

   (el mismo Application (client) ID que tienes en `VITE_CLIENT_ID` del `.env`)

4. Marca el scope **`access_as_user`**.
5. **Add application**.

**Por qué no usamos API permissions aquí:** cuando front y back comparten un solo registro, el portal no siempre lista la app en “My APIs”. **Authorized client applications** evita ese problema y es suficiente para el demo.

**Cómo comprobar:** en **Expose an API** → *Authorized client applications* aparece tu client ID con el scope `access_as_user` marcado.

---

## Paso 3 — Pedir el scope en `loginRequest.ts`

**Para qué:** que Entra emita un access token **para tu API**, no solo para Graph.

Reemplaza `msal-front/src/auth/loginRequest.ts` por:

```typescript
import type { RedirectRequest } from '@azure/msal-browser'

const clientId = import.meta.env.VITE_CLIENT_ID ?? ''
const apiScope = `api://${clientId}/access_as_user`

/** OIDC + scope delegado hacia msal-api. */
export const loginRequest: RedirectRequest = {
  scopes: ['openid', 'profile', apiScope],
}
```

| Scope | Para qué |
|---|---|
| `openid` | ID Token (identidad OIDC) |
| `profile` | Claims básicos de perfil |
| `api://…/access_as_user` | **Access token para msal-api** |

**Quité `User.Read`:** ya no pedimos Graph. Si más adelante necesitas Graph y tu API, puedes incluir ambos scopes.

**Importante:** tras cambiar scopes debes **cerrar sesión** y **volver a iniciar sesión** para que Entra emita tokens nuevos.

**Cómo comprobar:** tras re-login, en Perfil el **Access Token** en [jwt.io](https://jwt.io) muestra:

- `aud`: `api://{client-id}` **o** el GUID `{client-id}` (ambos son válidos en v2.0)
- `scp`: `access_as_user`
- Header **sin** campo `nonce`

---

## Paso 4 — Configurar Spring (Resource Server nativo)

**Para qué:** que Spring rechace tokens que no sean **para tu API** (Graph e ID Token quedarán fuera), usando solo la auto-configuración de Spring Boot (`issuer-uri` + `audiences`).

### 4.1 — Manifest: access tokens v2.0 (obligatorio)

**Para qué:** que Entra emita tokens con `iss` = `…/v2.0` de forma predecible (alineado con `issuer-uri`). Si queda en `null`, Entra emite tokens **v1** (`iss` = `https://sts.windows.net/{tenant}/`) y Spring responde **401** con el log `The iss claim is not valid`.

1. En la App Registration → **Manifest**.
2. Busca la propiedad según el formato del JSON que veas:

| Formato del Manifest | Propiedad | Valor correcto |
|---|---|---|
| Classic (Azure AD) | `accessTokenAcceptedVersion` | `2` |
| Microsoft Graph | `api.requestedAccessTokenVersion` | `2` |

**Classic:**

```json
"accessTokenAcceptedVersion": 2
```

**Microsoft Graph** (dentro del objeto `api`):

```json
"api": {
  "requestedAccessTokenVersion": 2,
  ...
}
```

Si está en `null` o `1`, cámbialo a **`2`**.

3. **Save**.
4. En el front: **Cerrar sesión** y volver a iniciar sesión (los tokens viejos siguen con `iss` v1).

**Cómo comprobar:** en [jwt.io](https://jwt.io) el access token tiene:

- `iss`: `https://login.microsoftonline.com/{tenant-id}/v2.0` (**no** `sts.windows.net`)
- `aud`: GUID o `api://{client-id}`
- `scp`: `access_as_user`
- Header **sin** `nonce`

### 4.2 — `application.yml`

Edita `msal-api/src/main/resources/application.yml`:

```yaml
server:
  port: 8080

spring:
  application:
    name: msal-api
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://login.microsoftonline.com/{tenant-id}/v2.0
          # GUID (v2.0) y Application ID URI.
          audiences:
            - api://{client-id}
            - {client-id}

logging:
  level:
    org.springframework.security.oauth2: DEBUG
```

Reemplaza:

| Placeholder | Valor |
|---|---|
| `{tenant-id}` | mismo GUID que `VITE_TENANT_ID` |
| `{client-id}` | mismo GUID que `VITE_CLIENT_ID` |

Ejemplo:

```yaml
          issuer-uri: https://login.microsoftonline.com/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/v2.0
          audiences:
            - api://11111111-2222-3333-4444-555555555555
            - 11111111-2222-3333-4444-555555555555
```

También actualiza `application.yml.example` (sin GUIDs reales) para tus compañeros:

```yaml
          issuer-uri: https://login.microsoftonline.com/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/v2.0
          audiences:
            - api://11111111-2222-3333-4444-555555555555
            - 11111111-2222-3333-4444-555555555555
```

Reinicia la API:

```bash
cd msal-api
./mvnw spring-boot:run
```

**Por qué `issuer-uri`:** Spring descarga la configuración OpenID de Entra y valida la firma y el `iss` del JWT.

**Por qué dos `audiences`:** en tokens v2.0 el claim `aud` suele ser el **GUID** del client; a veces es `api://{client-id}`. Si solo configuras uno y Entra emite el otro, `/api/me` responde **401**.

**Por qué `DEBUG`:** al fallar la validación JWT verás el motivo en la consola de Spring (útil en clase).

**Cómo comprobar:** la API arranca sin error al descargar la configuración OpenID de Entra.

---

## Paso 5 — Usar `accessToken` en la integración React

**Para qué:** dejar de mandar el ID Token y usar el pase correcto.

En `msal-front/src/components/ApiIntegration.tsx`, cambia la llamada privada:

```typescript
// Antes (integración básica — ID Token):
fetchPrivateMe(tokenResult.idToken),

// Después (access token de tu API):
fetchPrivateMe(tokenResult.accessToken),
```

El bloque completo de `callApis` debe quedar así:

```typescript
      const [publicData, privateData] = await Promise.all([
        fetchPublicHola(),
        fetchPrivateMe(tokenResult.accessToken),
      ])
```

Actualiza también el texto de ayuda en el mismo componente:

```tsx
      <p className="token-hint">
        Base URL: <code>{getApiBaseUrl()}</code>. La ruta pública no lleva token;
        la privada envía el <strong>Access Token</strong> con scope{' '}
        <code>access_as_user</code>.
      </p>
```

**Cómo comprobar:** el proyecto compila (`npm run build`).

---

## Paso 6 — Actualizar textos en `Profile.tsx` (recomendado)

**Para qué:** que el alumno entienda qué token copiar para Postman.

En `msal-front/src/components/Profile.tsx`, bajo **Access Token (JWT · pase)**:

```tsx
          <p className="token-hint">
            Pase para <code>msal-api</code> (scope{' '}
            <code>access_as_user</code>). Mándalo como Bearer a{' '}
            <code>GET /api/me</code> o usa el botón de integración.
          </p>
```

Y bajo **ID Token**, confirma que diga que **no** va a la API:

```tsx
          <p className="token-hint">
            Lo usa tu app para saber quién entró. No lo envíes a la API como
            pase.
          </p>
```

**Cómo comprobar:** los textos en pantalla coinciden con el flujo access-token-first.

---

## Paso 7 — Cerrar sesión y volver a entrar

**Para qué:** MSAL guarda tokens viejos en caché. Si no re-autenticas, seguirás viendo el access token de Graph.

1. Arranca `msal-api` y `msal-front`.
2. En el front, **Cerrar sesión**.
3. **Iniciar sesión con Microsoft** de nuevo.
4. Entra puede mostrar pantalla de consentimiento del nuevo scope — acepta.

**Cómo comprobar:** en Perfil, decodifica el access token en [jwt.io](https://jwt.io):

| Claim | Valor esperado |
|---|---|
| `aud` | `api://{client-id}` **o** el GUID `{client-id}` |
| `scp` | `access_as_user` |
| Header | sin `nonce` |

---

## Paso 8 — Probar con el front, curl y Postman

**Para qué:** validar el flujo completo con el token correcto.

### 8.1 Desde React

1. Inicia sesión.
2. Pulsa **Probar API pública y privada**.
3. Debes ver JSON de `/public/hola` y `/api/me` con tu `preferred_username`.

### 8.2 Desde curl

Copia el **Access Token** de Perfil (no el ID Token):

```bash
curl -i http://localhost:8080/api/me \
  -H "Authorization: Bearer PEGA_AQUI_EL_ACCESS_TOKEN"
```

### 8.3 Desde Postman

1. Importa `msal-api/msal-api.postman_collection.json`.
2. Pega el access token en la variable `accessToken`.
3. Ejecuta **GET /api/me (con access token → 200)**.

### Tabla de resultados

| Bearer que envías | Resultado esperado |
|---|---|
| Access token API (`access_as_user`) | **200** |
| Access token viejo de Graph (`User.Read`) | **401** |
| ID Token | **401** |
| Sin header | **401** |

Detén servicios con `Ctrl+C` cuando termines.

---

## Paso 9 — Checklist final

- [ ] **Expose an API** con URI `api://{client-id}`
- [ ] Scope `access_as_user` creado y habilitado
- [ ] Client ID agregado en **Authorized client applications** con scope `access_as_user`
- [ ] Manifest: `accessTokenAcceptedVersion` **o** `api.requestedAccessTokenVersion` = `2` (no `null`)
- [ ] `loginRequest.ts` pide `api://{client-id}/access_as_user`
- [ ] `application.yml` tiene `issuer-uri` y `audiences` (GUID + `api://…`)
- [ ] `ApiIntegration.tsx` usa `tokenResult.accessToken`
- [ ] Cerré sesión y volví a entrar **después** de cambiar el Manifest
- [ ] Access token en jwt.io: `iss` con `/v2.0` (no `sts.windows.net`), `aud` + `scp: access_as_user`, sin `nonce`
- [ ] `/api/me` responde 200 desde React, curl y Postman
- [ ] Entiendo por qué el ID Token y el token de Graph ya **no** sirven

---

## Flujo (diagrama)

```mermaid
sequenceDiagram
    participant U as Usuario
    participant R as msal-front
    participant E as Entra ID
    participant S as msal-api

    U->>R: Iniciar sesión
    R->>E: loginRedirect (openid, profile, api://…/access_as_user)
    E->>R: ID Token + Access Token API
    U->>R: Probar API pública y privada
    R->>S: GET /public/hola
    S->>R: 200
    R->>S: GET /api/me (Bearer Access Token API)
    S->>S: Valida iss + aud
    S->>R: 200 + claims
```

---

## Si algo falla

| Síntoma | Qué significa | Qué hacer |
|---|---|---|
| Consent / scope error al login | Falta autorizar el client | Revisa Paso 2: **Authorized client applications** + scope marcado |
| “My APIs” muestra *No results* | Normal con una sola app | Ignora esa pantalla; usa **Authorized client applications** (Paso 2) |
| Access token sigue con `aud` de Graph | Scopes viejos en caché | Cierra sesión; borra site data; vuelve a entrar |
| `/api/me` 401 + log `The iss claim is not valid` | Access token v1 (`requestedAccessTokenVersion` / `accessTokenAcceptedVersion` en `null`) | Manifest → pon **`2`**, guarda, cierra sesión y vuelve a entrar |
| `/api/me` 401 con access token nuevo | `aud` no coincide | `audiences` con GUID y `api://…`; revisa jwt.io y logs DEBUG |
| `/api/me` 401 con ID Token | Spring ya exige audience API | Usa access token, no id token |
| `timed_out` en el front al pedir tokens | Caché / consentimiento del scope nuevo | Cierra sesión, vuelve a entrar y acepta el consentimiento |
| `AADSTS650053` | Scope mal escrito | Verifica `api://{client-id}/access_as_user` |
| API no arranca | Tenant mal en `issuer-uri` | Revisa GUID + `/v2.0` |
| CORS | Origen no listado | Front en 5173; revisa `SecurityConfig` |

---

## Comandos rápidos

```bash
# API
cd msal-api
./mvnw spring-boot:run

# Front
cd msal-front
npm run dev
npm run build
```

```bash
curl http://localhost:8080/public/hola
curl -i http://localhost:8080/api/me \
  -H "Authorization: Bearer <ACCESS_TOKEN_DE_PERFIL>"
```

---

## Orden de las guías del material complementario

```text
1. msal-front/README.md           → React + MSAL (login)
2. msal-api/README.md             → Spring resource server
3. msal-front/GUIA_INTEGRACION.md → Conectar front y back (ID Token)
4. GUIA_ACCESS_TOKEN.md           → Access token real (esta guía)
   (copia en msal-front/ y msal-api/)
```
