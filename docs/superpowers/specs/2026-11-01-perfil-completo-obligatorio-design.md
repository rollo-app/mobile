# Perfil completo obligatorio — diseño

Fecha: 2026-11-01. Repos: `rollo-app/backend` (lo principal) y `mobile` (dos cambios chicos).

## Por qué

Una cuenta de Rollo nace en `users` apenas se verifica el código o el link mágico
(`INSERT OR IGNORE INTO users (id, email, created_at)`, `backend/src/modules/auth/auth.repository.ts`), con `name` y
`username` en null. Si alguien cierra la app en "Completá tu perfil", la cuenta queda así para siempre. El dueño no quiere
que exista una cuenta sin nombre o sin @ que pueda hacer cosas o aparecer en algún lado. Surgió diseñando la búsqueda de
usuarios (`2026-11-01-buscar-usuarios-design.md`), que por ahora las esconde.

Hoy la app ya no deja entrar a una cuenta incompleta (`gateFor` en `src/features/auth/gate.ts` exige `name.trim()` y
`username`), y `PATCH /me` no permite vaciar ni el nombre (`trim().min(1)`) ni el @ (formato obligatorio). El hueco está en el
server: casi toda la API funciona con la sesión de una cuenta incompleta. Solo crear un rollo y unirse a uno lo chequean
(`requireName` en `backend/src/modules/trips/members.service.ts`, 409 si falta el nombre o el @).

## Objetivos

1. **Una cuenta sin nombre o sin @ no puede hacer nada** más que completar su perfil, cerrar sesión o borrarse. Lo decide el
   server, no solo la app.
2. **Nadie la ve**: no aparece en búsquedas, listas ni perfiles.
3. **Las abandonadas se borran solas.**
4. **Se puede salir de "Completá tu perfil" sin matar la app**: botón "Cerrar sesión" (decisión del dueño).

## No objetivos

- No cambia cuándo nace la fila de `users` (ver "Descartado").
- No cambia el formulario ni las reglas del nombre y del @.
- No se toca el backoffice (`/admin`), que tiene su propia auth.

## Anti-objetivos (sería un fracaso aunque ande)

- Que un usuario viejo sin @ que es miembro de un rollo **pierda fotos**: que la cola las marque como fallidas o las borre
  porque el server ahora contesta otra cosa.
- Que se borre una cuenta con algo atado (rollos, amigos) o una que alguien está completando en este momento.
- Que una ruta nueva quede abierta a cuentas incompletas por olvido.

## Server

### Middleware

`requireUser` (`backend/src/lib/auth.ts`) pasa a exigir **sesión válida y perfil completo** (`name` con algo después de
`trim` y `username` no null). Si falta algo contesta **428** con `{ error: "Completá tu perfil" }`. Así toda ruta existente y
toda ruta nueva queda protegida por defecto.

Un middleware nuevo, `requireSession`, hace lo que hoy hace `requireUser` (solo sesión) y lo usan **únicamente** las rutas
que necesita el paso del perfil o salir de él:

| Ruta | Para qué |
|---|---|
| `GET /me` | el gate de la app |
| `PATCH /me` | completar el perfil |
| `DELETE /me` | borrar la cuenta |
| `POST /me/avatar`, `POST /me/avatar/complete` | foto en "Completá tu perfil" |
| chequeo de @ disponible (`usernames` router) | el "Disponible / Ya está en uso" |
| `POST /auth/logout` | cerrar sesión |
| `PUT` / `DELETE /me/push-tokens/{token}` | la app borra el token al cerrar sesión |

`/friend-links/claim` ya no lleva sesión y queda igual. Todo lo demás (rollos, amigos, solicitudes, fotos, me gusta,
comentarios, destacadas, momentos, ajustes, búsqueda) pasa a dar 428 para una cuenta incompleta.

**Por qué 428 y no 409/403:** el uploader de la app (`src/features/capture/uploader.ts`, `classify`) marca como fallida una
foto ante un 409 o un 403 en el registro. Un código propio permite que la app lo trate como "esperar" (ver App). 428
(Precondition Required) además dice lo que es.

`requireName` se borra: lo cubre el middleware. `isNew` de `AuthSession` sigue igual (ya significa "perfil incompleto").
El contrato (`openapi.json`) documenta el 428 en las rutas con `requireUser`.

### Invisibles

Con el middleware, una cuenta incompleta nueva no puede tener amigos ni rollos. Las únicas que pueden aparecer son las viejas
sin @ que ya tienen rollos o amigos.

- **Fuera de sus rollos** (búsqueda, amigos, amigos en común, solicitudes, perfil de otro): se filtra
  `name IS NOT NULL AND username IS NOT NULL`, y `GET /users/{id}` de una cuenta incompleta da 404.
- **Dentro de sus propios rollos** (miembros, "N personas", autor en Feed y mapa, me gusta, comentarios, creador): **siguen
  visibles como hoy.** Son parte del grupo y sacarlas rompería el rollo (un creador que desaparece, fotos de alguien que no
  está). Como su perfil da 404, el nombre del autor de esas fotos no se puede tocar (si el `onPress` existe, falla en silencio
  o no se ofrece; el builder decide). *Decisión de Claude, para revisar.*

El builder revisa cada consulta de la primera lista y agrega el filtro donde haga falta.

### Limpieza (cron)

En el `scheduled` de `src/index.ts`, junto a las demás tareas, una función nueva (por ej. `purgeIncompleteAccounts`) que
borra con `deleteAccount` (`src/modules/account/account.service.ts`, ya limpia sesiones, avatar en R2, push tokens, etc.)
las cuentas que cumplen **todo**:

- `name` vacío/null **o** `username` null;
- creadas hace más de **7 días**;
- **ninguna sesión usada** en los últimos 7 días (así no se borra a alguien que está en el paso del perfil);
- **sin nada atado**: ninguna fila en `members` (ni activa ni pasada) y ninguna amistad ni solicitud.

Si esa persona vuelve, el login crea la cuenta de nuevo. Un tope de filas por pasada (por ej. 50) para no pasar el tiempo del
cron. Las cuentas viejas sin @ con rollos o amigos **no se borran nunca**: completan el perfil la próxima vez que abran la app.

### Antes de deployar

Contar en producción, solo lectura:

```sql
SELECT COUNT(*) AS total, SUM(name IS NULL OR TRIM(name) = '') AS sin_nombre, SUM(username IS NULL) AS sin_usuario
FROM users WHERE name IS NULL OR TRIM(name) = '' OR username IS NULL;
```

## App

1. **"Cerrar sesión" en "Completá tu perfil"** (`app/(auth)/profile.tsx`): botón de texto secundario abajo del formulario
   (`Button variant="secondary"` o un link, como el de la pantalla de error del gate en `app/_layout.tsx`), con `useLogOut`.
   Sin confirmación: no se pierde nada que importe (el email se vuelve a escribir). Al cerrar sesión el gate vuelve a
   `/email`. Test de pantalla con `renderRouter`.
2. **El uploader trata el 428 como "esperar"** (`classify` en `uploader.ts`): igual que el 401, devuelve `{ kind: "offline" }`
   y la foto queda en la cola sin marcarse fallida. Cuando la persona completa el perfil, la próxima pasada la sube. Test en
   `src/features/capture/__tests__`.
3. **El código de amigo guardado no se pierde con un 428** (`keepPending` en `src/features/friends/use-pending-friend.ts`, que
   hoy descarta el código ante cualquier 4xx salvo 429): suma el 428 a los que lo conservan. Test al lado.

Las demás llamadas que la app hace en el fondo antes del gate (mapa sin señal, `syncMoments`, la tarea de subida) ya toleran
errores sin tocar nada; con 428 siguen igual.

## Compatibilidad

- **Builds viejos** (1.0.x de TestFlight): ya tienen el gate con @ (desde el 2026-10-20). No conocen el 428: si un usuario
  viejo sin @ con fotos en la cola tiene un build así, el registro de la foto daría 428 y se marcaría fallida. Es un caso casi
  imposible (cuenta sin @ + rollo + fotos sin subir + build viejo); se acepta. La consulta de arriba dice si existe.
- **Orden del deploy** (*decisión de Claude, para revisar*): primero la app. Los cambios de la app son solo JS y salen con
  `npm run update:production`; el backend se deploya después, cuando el update ya tuvo un par de días para llegar. Si la consulta
  de producción da 0 cuentas sin @ con rollos, el orden no importa y se pueden deployar juntos.
- **Seed** (`rocio@rollo.test` sin @): sigue sirviendo para probar el paso del perfil de un usuario viejo.

## Descartado

**Crear la fila de `users` recién al completar el perfil** (sesión provisional sin usuario). Arregla de raíz pero cambia
sesiones (FK a `users`), avatar y el contrato del login; mucho cambio para lo mismo que logra el middleware.

## Para el builder

- Dónde exactamente meter el filtro de "invisibles" en cada consulta.
- Nombre de la función del cron y el tope por pasada.
- Texto y ubicación exacta del botón "Cerrar sesión", dentro del estilo nativo del resto del paso.
- Tests: TDD en los dos repos, corriendo solo los tests de lo tocado (`--maxWorkers=2` en la app).
