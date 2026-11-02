# Perfil completo obligatorio — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una cuenta sin nombre o sin @ no pueda usar la API (salvo completar el perfil, salir o borrarse), no aparezca fuera de sus rollos y, si quedó abandonada, se borre sola; y que en la app se pueda cerrar sesión desde "Completá tu perfil".

**Architecture:** En el backend, `requireUser` pasa a exigir perfil completo (428 si falta) y un `requireSession` nuevo queda solo para las rutas del paso del perfil. Las consultas sociales filtran las cuentas incompletas y un cron nuevo borra las abandonadas con `deleteAccount`. En la app, el uploader y el canje de amigo tratan el 428 como "esperar", y la pantalla del perfil suma "Cerrar sesión".

**Tech Stack:** Backend: Cloudflare Workers + D1, Hono + `@hono/zod-openapi`, Vitest con `cloudflare:test`. App: Expo SDK 58, Expo Router, TanStack Query, Jest + `expo-router/testing-library`.

**Spec:** `mobile/docs/superpowers/specs/2026-11-01-perfil-completo-obligatorio-design.md`

## Global Constraints

- Dos repos: `../backend` (`rollo-app/backend`) para las tareas 1–3 y `mobile` para las tareas 4–5. En cada uno, rama `feature/perfil-completo` desde `develop`, en un worktree en `<repo>/.claude/worktrees/` (nunca en `/tmp`). El worktree del backend necesita su `.dev.vars` (copiarlo del repo principal).
- Código, comentarios y descripciones de tests en inglés; textos que ve el usuario, commits y PRs en español rioplatense.
- Texto exacto del error: `"Completá tu perfil"`, status **428**.
- TDD: test que falla, código mínimo, test en verde. En la app, correr solo los tests de lo tocado con `--maxWorkers=2`; nunca la suite completa. En el backend, `npx vitest run test/<archivo>`.
- No deployar ni mandar EAS Update: el orden del deploy lo decide el dueño (ver spec, "Compatibilidad").
- Leer el `CLAUDE.md` de cada repo antes de empezar.

## Review Focus

1. **Usuario viejo sin @ con fotos en la cola:** la app abre en "Completá tu perfil", la subida en segundo plano recibe 428 y las fotos tienen que quedar pendientes, no fallidas. Lo cubre la tarea 4 (test de `classify` en `register` y en `complete`).
2. **Alguien completando el perfil justo cuando corre el cron:** no se borra si su sesión se usó en los últimos 7 días. Tarea 3, test "keeps an incomplete account whose session was used recently".
3. **Una cuenta vieja sin @ que es creadora o miembro de un rollo:** sigue en la lista de miembros, su autoría en el feed sigue y el cron no la toca. Tarea 2 (test de miembros) y tarea 3 (test "keeps accounts with any membership").
4. **Ruta nueva o pasada por alto que queda abierta:** cualquier ruta con `requireUser` responde 428 a una cuenta incompleta. Tarea 1, test que recorre una muestra de rutas de cada router.
5. **Cerrar sesión desde el perfil con fotos ajenas en la cola:** cerrar sesión no borra la cola (regla existente). Tarea 5 lo verifica con el mock de `logout` (no hay borrado de cola).

---

### Task 1: `requireSession` y `requireUser` con perfil completo (backend)

**Files:**
- Modify: `backend/src/lib/auth.ts` (`requireUser`, nuevo `requireSession`)
- Modify: `backend/src/lib/openapi.ts` (`ERROR_DESCRIPTIONS` suma 428)
- Modify: los routers con `requireUser`: `me`, `auth`, `usernames`, `blocks`, `comments`, `featured`, `friend-requests`, `friends`, `likes`, `media`, `moments`, `reports`, `trips`, `users`
- Modify: `backend/src/modules/trips/members.service.ts` y `trips.service.ts` (borrar `requireName` y sus llamadas)
- Modify: `backend/openapi.json` (regenerado)
- Test: `backend/test/profile-required.test.ts` (nuevo); ajustar `test/me.test.ts`, `test/trips.test.ts`, `test/account.test.ts`, `test/blocks.test.ts`

**Interfaces:**
- Produces: `requireSession` (middleware, solo sesión: lo que hoy hace `requireUser`) y `requireUser` (sesión + `user.name?.trim()` y `user.username`; si no, `HTTPException(428, { message: "Completá tu perfil" })`). Ambos en `src/lib/auth.ts`. `requireUser` reusa `requireSession` en vez de duplicar la búsqueda de sesión.

Rutas que pasan a `requireSession` (todas las demás quedan con `requireUser`):
`GET /me`, `PATCH /me`, `DELETE /me`, `POST /me/avatar`, `POST /me/avatar/complete`, `PUT /me/push-tokens/{token}`, `DELETE /me/push-tokens/{token}` (en `me.router.ts`), la ruta del router `usernames` y `POST /auth/logout` (`auth.router.ts:65`).

- [ ] **Step 1: Write the failing tests** en `test/profile-required.test.ts`:
  - `"an account without a name gets 428 on a profile-gated route"`: `signUp(undefined, null)` y `GET /me/trips` → `status 428`, `body { error: "Completá tu perfil" }`.
  - `"an account without a username gets 428 on a profile-gated route"`: `signUp(undefined, "Fede", null)` y `GET /me/trips` → 428.
  - `"the profile step routes work without a complete profile"`: con `signUp(undefined, null, null)`: `GET /me` 200, `GET /usernames/<valor>` 200 (usar la ruta real del router), `POST /me/avatar` con `sizeBytes` válido 200 o 201 (el que ya devuelve), `PATCH /me` con nombre y @ 200, y después `GET /me/trips` 200.
  - `"logout and account deletion work without a complete profile"`: `POST /auth/logout` y, con otra cuenta incompleta, `DELETE /me` → los status que esas rutas ya devuelven (204).
  - `"every router gates incomplete accounts"`: con una cuenta incompleta, una ruta de cada router con `requireUser` (por ej. `GET /friends`, `GET /me/friend-requests`, `GET /me/likes`, `GET /me/comments`, `POST /trips/join`, `GET /blocks`, `GET /users/<otroId>`, `GET /me/moments`, `GET /me/settings`, `POST /friends/link`) → todas 428.
- [ ] **Step 2: Run** `npx vitest run test/profile-required.test.ts`. Expected: FAIL (dan 200/409 en vez de 428).
- [ ] **Step 3: Implement** `requireSession` y el nuevo `requireUser` en `src/lib/auth.ts`, y cambiar a `requireSession` las rutas de la lista. Sumar `428: "Profile incomplete: set a name and a username first"` a `ERROR_DESCRIPTIONS` y agregar `428` a `errors(...)` en cada ruta que quede con `requireUser`.
- [ ] **Step 4: Borrar `requireName`** y sus dos llamadas. En `test/me.test.ts:152-155` y `test/trips.test.ts:91-94,188-191` las expectativas pasan de 409 con "Completá tu nombre en el perfil" / "Elegí tu nombre de usuario en el perfil" a `428` con `"Completá tu perfil"`.
- [ ] **Step 5: Run the backend tests that touch accounts:** `npx vitest run test/profile-required.test.ts test/me.test.ts test/trips.test.ts test/account.test.ts test/blocks.test.ts test/auth.test.ts test/magic-link.test.ts`. Expected: PASS. Si algún test usa una cuenta incompleta (`signUp(..., null)`) para algo que no sea el paso del perfil, se completa su perfil en el test, salvo que el test sea justamente sobre una cuenta incompleta. Los de `blocks.test.ts:297,309` bloquean **a** una cuenta sin @ desde una completa: siguen andando.
- [ ] **Step 6: Run** `npm run typecheck` (o el script equivalente del backend) y regenerar `openapi.json` con el script del repo; `npx vitest run test/openapi.test.ts`. Expected: PASS.
- [ ] **Step 7: Commit**

```bash
git add src/lib/auth.ts src/lib/openapi.ts src/modules test openapi.json
git commit -m "Perfil completo obligatorio: 428 en toda la API salvo el paso del perfil"
```

### Task 2: cuentas incompletas invisibles fuera de sus rollos (backend)

**Files:**
- Modify: `backend/src/modules/users/users.repository.ts` (`findProfileOwner`, `listFriendsOf`)
- Modify: `backend/src/modules/friends/friends.repository.ts` (`listFriends`, la búsqueda por id de la línea 81)
- Modify: `backend/src/modules/friend-requests/friend-requests.repository.ts` (`listReceived`, la búsqueda por id de la línea 10)
- Test: `backend/test/incomplete-invisible.test.ts` (nuevo)

**Interfaces:**
- Consumes: tarea 1 (una cuenta incompleta ya no puede crear amistades ni solicitudes nuevas; las de los tests se arman con SQL directo).
- Produces: el filtro `name IS NOT NULL AND TRIM(name) <> '' AND username IS NOT NULL` en esas consultas. **No** se toca nada de rollos: miembros, feed, me gusta, comentarios ni creador.

Fixture de los tests: una cuenta completa A, una cuenta B completa y después `UPDATE users SET username = NULL WHERE id = B` (usuario viejo sin @), con amistad A–B creada antes con `befriend`.

- [ ] **Step 1: Write the failing tests:**
  - `"an incomplete account's profile is not found"`: `GET /users/<B>` con el token de A → 404.
  - `"incomplete accounts are left out of friend lists"`: `GET /friends` de A no incluye a B; `GET /users/<C>/friends` (C amigo de A y de B) no incluye a B.
  - `"incomplete accounts are left out of received requests"`: insertar con SQL una fila en `friend_requests` de B a A; `GET /me/friend-requests` de A no la trae.
  - `"incomplete members still show inside their rollos"`: B miembro de un rollo de A (unir a B mientras está completo y después borrarle el @); `GET /trips/<id>` de A trae a B entre los miembros.
- [ ] **Step 2: Run** `npx vitest run test/incomplete-invisible.test.ts`. Expected: FAIL en los tres primeros; el cuarto ya pasa.
- [ ] **Step 3: Implement** el filtro en las consultas listadas. Revisar con `grep -n "FROM users\|JOIN users"` en `src/modules` si queda otra consulta social (no de rollos) que muestre personas, y sumarla con su test.
- [ ] **Step 4: Run** `npx vitest run test/incomplete-invisible.test.ts test/friends.test.ts test/friend-requests.test.ts test/users.test.ts` (los que existan). Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/modules test/incomplete-invisible.test.ts
git commit -m "Las cuentas sin nombre o sin @ no aparecen en perfiles, amigos ni solicitudes"
```

### Task 3: cron que borra cuentas incompletas abandonadas (backend)

**Files:**
- Create: `backend/src/lib/incomplete-accounts.ts`
- Modify: `backend/src/index.ts` (sumarla al `Promise.allSettled` de `scheduled` y a su comentario)
- Test: `backend/test/incomplete-accounts.test.ts`

**Interfaces:**
- Consumes: `deleteAccount(env, user: UserRow)` de `src/modules/account/account.service.ts`.
- Produces: `purgeIncompleteAccounts(env: Env, now = Date.now()): Promise<void>`, con `STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000` y `BATCH = 50`, mismo estilo que `src/lib/pending-cleanup.ts`.

Una cuenta se borra si cumple todo:
- `name IS NULL OR TRIM(name) = '' OR username IS NULL`;
- `created_at < now - STALE_AFTER_MS`;
- ninguna sesión con `last_used_at >= now - STALE_AFTER_MS`;
- ninguna fila en `members` (cualquier estado), `friendships` (como `user_a` o `user_b`) ni `friend_requests` (como `from_user_id` o `to_user_id`).

Para cada fila elegida se carga el `UserRow` completo y se llama a `deleteAccount`.

- [ ] **Step 1: Write the failing tests** (envejecer con `UPDATE users SET created_at = ?` y `UPDATE sessions SET last_used_at = ?`):
  - `"deletes an incomplete account older than 7 days with no recent session"` → la fila de `users` ya no está.
  - `"keeps an incomplete account younger than 7 days"`.
  - `"keeps an incomplete account whose session was used recently"` (cuenta de 8 días, sesión usada hace 1 día).
  - `"keeps accounts with any membership"` (cuenta sin @ de 30 días que fue miembro de un rollo, aunque se haya ido).
  - `"keeps accounts with a friendship or a friend request"`.
  - `"never touches complete accounts"` (completa, 30 días, sin sesión reciente).
- [ ] **Step 2: Run** `npx vitest run test/incomplete-accounts.test.ts`. Expected: FAIL ("purgeIncompleteAccounts" no existe).
- [ ] **Step 3: Implement** `purgeIncompleteAccounts` y sumarla a `scheduled`.
- [ ] **Step 4: Run** `npx vitest run test/incomplete-accounts.test.ts test/pending-cleanup.test.ts`. Expected: PASS.
- [ ] **Step 5: Docs del backend:** en su `CLAUDE.md`, una línea en la sección de cuentas/auth: `requireUser` exige perfil completo (428 "Completá tu perfil"), `requireSession` solo para el paso del perfil (con la lista de rutas), y el cron `purgeIncompleteAccounts`.
- [ ] **Step 6: Commit y PR a `develop`** (descripción en español, con el orden de deploy de la spec: el backend va después del update de la app).

```bash
git add src/lib/incomplete-accounts.ts src/index.ts test/incomplete-accounts.test.ts CLAUDE.md
git commit -m "Cron: borrar cuentas sin completar abandonadas hace más de 7 días"
```

### Task 4: la app trata el 428 como "esperar" (mobile)

**Files:**
- Modify: `mobile/src/features/capture/uploader.ts` (`classify`)
- Modify: `mobile/src/features/friends/use-pending-friend.ts` (`keepPending`)
- Modify: `mobile/src/api/schema.d.ts` (regenerado del contrato de la tarea 1)
- Test: `mobile/src/features/capture/__tests__/uploader.test.ts`; Create: `mobile/src/features/friends/__tests__/pending-friend.test.ts` (no hay test previo de `redeemPendingFriend`: mockear `@/features/friends/actions` y usar el SecureStore en memoria de `jest.setup.ts`)

**Interfaces:**
- Consumes: el 428 de la tarea 1.
- Produces: nada nuevo; `classify` devuelve `{ kind: "offline" }` ante 428 en las dos fases, igual que el 401.

- [ ] **Step 1: Write the failing tests** en `uploader.test.ts`, al lado de `"a 401 (session rejected) stops the pass…"` (línea ~508) y con el mismo armado:
  - `"a 428 (profile incomplete) stops the pass and keeps the photos in the queue"`: la primera llamada responde `json(428, { error: "Completá tu perfil" })`; se esperan una sola llamada, las dos fotos siguen en `queue.pending()` y ninguna marcada fallida.
  - Lo mismo cuando el 428 llega en `complete`.
  - En `pending-friend.test.ts`: `"keeps the pending friend code on a 428"` → `redeemFriend` rechaza con `ApiError` 428 y `getPendingFriend()` sigue devolviendo el pendiente.
- [ ] **Step 2: Run** `npx jest src/features/capture/__tests__/uploader.test.ts src/features/friends --maxWorkers=2`. Expected: FAIL en los tres tests nuevos.
- [ ] **Step 3: Implement**: en `classify`, `if (status === 401 || status === 428) return { kind: "offline" };` con el comentario actualizado ("…or the profile isn't complete yet: keep the queue until it is"). En `keepPending`, sumar `error.status === 428`.
- [ ] **Step 4: Run** el mismo comando. Expected: PASS.
- [ ] **Step 5: Regenerar el contrato** con el backend de la tarea 1: `API_SPEC=<worktree del backend>/openapi.json npm run api:generate`, y `npm run typecheck`. Expected: sin errores.
- [ ] **Step 6: Commit**

```bash
git add src/features/capture/uploader.ts src/features/capture/__tests__/uploader.test.ts src/features/friends/use-pending-friend.ts src/features/friends/__tests__/pending-friend.test.ts src/api/schema.d.ts
git commit -m "Con el perfil sin completar (428) las fotos y el código de amigo esperan"
```

### Task 5: "Cerrar sesión" en "Completá tu perfil" (mobile)

**Files:**
- Modify: `mobile/app/(auth)/profile.tsx` → como `app/` solo rutea (regla del `CLAUDE.md`), mover la pantalla a `mobile/src/features/auth/complete-profile-screen.tsx` (`CompleteProfileScreen`) y dejar la ruta montándola.
- Test: `mobile/__tests__/profile.test.tsx` (o `accounts.test.tsx`, donde ya se prueba "Completá tu perfil")

**Interfaces:**
- Consumes: `useLogOut()` de `src/features/auth/use-log-out.ts`.
- Produces: `CompleteProfileScreen` (sin props).

- [ ] **Step 1: Write the failing test** `"the profile step can sign out"`: con sesión y `me` sin nombre ni @ (mismo armado que los tests existentes del paso), `await fireEvent.press(getByRole("button", { name: "Cerrar sesión" }))` → se llamó al `logout` mockeado de `@/features/auth/actions` y la pantalla pasa a la del email (`"Tu email"` o el texto que use el test de login existente).
- [ ] **Step 2: Run** `npx jest __tests__/profile.test.tsx --maxWorkers=2`. Expected: FAIL (no hay botón).
- [ ] **Step 3: Implement**: botón `Button` con `label="Cerrar sesión"` y `variant="secondary"` debajo del `ProfileForm`, como en la pantalla de error del gate (`app/_layout.tsx`), que llama a `logOut.mutate()`, deshabilitado mientras `isPending`. Sin `Alert`. Si falla, `ErrorText` con `errorMessage(logOut.error, "No se pudo cerrar sesión")`.
- [ ] **Step 4: Run** el mismo comando. Expected: PASS.
- [ ] **Step 5: Docs:** en el `CLAUDE.md` de la app, en el párrafo de cuentas: "Completá tu perfil" tiene "Cerrar sesión", y el server contesta 428 "Completá tu perfil" a una cuenta sin nombre o sin @ (la cola y el código de amigo esperan).
- [ ] **Step 6: Commit y PR a `develop`** (en español).

```bash
git add app/\(auth\)/profile.tsx src/features/auth/complete-profile-screen.tsx __tests__/profile.test.tsx CLAUDE.md
git commit -m "Completá tu perfil: botón para cerrar sesión"
```

### Después (decide el dueño)

1. Correr en producción la consulta de solo lectura de la spec.
2. Mergear la app y mandar `npm run update:production`; unos días después, mergear y deployar el backend (o juntos, si la consulta dio 0 cuentas sin @ con rollos).
