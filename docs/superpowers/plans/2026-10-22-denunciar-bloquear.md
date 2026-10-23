# Denunciar y bloquear Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que se pueda denunciar una foto o una persona y bloquear/desbloquear a alguien, lo mínimo que pide Apple (guía 1.2), con aviso por mail a Juani y comandos de administración para actuar.

**Architecture:** El backend guarda denuncias y bloqueos en D1, filtra en el server todo lo que lista fotos para quien pide, manda un mail por Resend y expone `/admin/*` con un token fuera del contrato. La app suma un dominio `moderation` (acciones, hooks, sheets nativos) y lo engancha en los menús que ya existen (fila del Feed, visor, visor de destacadas, perfil) más una pantalla "Bloqueados" y la línea de términos del login.

**Tech Stack:** Backend: Cloudflare Workers, Hono + `@hono/zod-openapi`, D1, R2 (`aws4fetch`), Resend, Vitest con `@cloudflare/vitest-plugin`. App: Expo SDK 58, Expo Router, TanStack Query, `openapi-fetch`, `@expo/ui` `MenuView`, `ActionSheetIOS`, `burnt`, Jest + `expo-router/testing-library`.

**Spec:** `docs/superpowers/specs/2026-10-22-denunciar-bloquear-design.md` (léanlo entero antes de empezar).

## Global Constraints

- Backend: repo `/Users/juanifraga/Desktop/Rollo/backend`, rama `feature/moderacion` desde `origin/develop` (en un worktree propio: la copia de trabajo está en otra rama de otra sesión; no la toquen). App: este repo, rama `feature/moderacion` (ya existe, desde `develop`).
- Código, comentarios, tests y nombres en inglés; todo texto que ve el usuario en rioplatense con voseo; commits en español (CLAUDE.md de cada repo).
- TDD siempre: test primero, verlo fallar, código mínimo. En la app, `await fireEvent...` (Testing Library 14).
- Motivos (valores exactos): `offensive` → "Es ofensivo", `abuse` → "Es acoso o abuso", `other` → "Otro motivo"; más "Cancelar".
- Sin toasts ni carteles de éxito: éxito = la UI cambia. Errores de red de denunciar/bloquear: `Burnt.alert({ preset: "error", title: ... })`.
- Bloquear **no** saca a nadie del rollo y no cambia contadores, totales ni cupos.
- Rutas `/admin/*` fuera de `openapi.json`. Mail a `REPORTS_EMAIL` (default `soporte@juanifraga.com`), remitente `EMAIL_FROM` como hoy.
- Datos persistidos del celular no se renombran (CLAUDE.md de la app).

## Review Focus

- Denunciar dos veces la misma foto (o persona): 204 las dos veces, un solo mail, una sola fila → test en Task B3.
- Bloquear a alguien que ya bloqueaste o que te bloqueó a vos: 204 idempotente; con bloqueo en los dos sentidos, desbloquear uno deja el otro → test en Task B1.
- Quien te bloqueó intenta canjear tu link de amistad (code y claimToken): mismo 400 que un link inválido, y no cuenta como "ya son amigos" → test en Task B2.
- Borrar la cuenta (propia o por admin) con denuncias y bloqueos en los dos lados: no quedan filas en `reports` ni `blocks` → test en Task B4.
- Denunciar sin señal en la app: no se oculta nada, aparece el HUD de error, la foto sigue → test en Task A2.

---

## Parte 1 — Backend (`rollo-app/backend`)

### Task B1: Tablas y bloqueos

**Files:**
- Create: `migrations/0011_moderation.sql`
- Create: `src/lib/moderation.ts`
- Create: `src/routes/blocks.ts`
- Modify: `src/index.ts` (montar `app.route("/blocks", blocks)`), `src/schemas.ts`
- Test: `test/blocks.test.ts`

**Interfaces:**
- Produces:
  - Tablas `reports(id TEXT PK, reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, media_id TEXT REFERENCES media(id) ON DELETE CASCADE, target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, trip_id TEXT, reason TEXT NOT NULL, created_at INTEGER NOT NULL)` con índices únicos `(reporter_id, media_id) WHERE media_id IS NOT NULL` y `(reporter_id, target_user_id) WHERE media_id IS NULL`; `blocks(blocker_id, blocked_id, created_at, PRIMARY KEY (blocker_id, blocked_id))`, ambas FK a `users` con `ON DELETE CASCADE`, índice en `blocks(blocked_id)`.
  - `src/lib/moderation.ts`:
    - `isBlockedEitherWay(db: D1Database, a: string, b: string): Promise<boolean>`
    - `blockedIdsFor(db: D1Database, viewerId: string): Promise<Set<string>>` (a quiénes bloqueó el viewer)
    - `HIDDEN_MEDIA_SQL`: fragmento SQL `string` para agregar a un `WHERE` donde `m` es `media` y `author` es la fila de `members` del autor; consume **dos** binds, ambos el `viewerId`: excluye `m.id` denunciadas por el viewer y autores (`author.user_id`) que el viewer bloqueó.
  - Schemas: `BlocksSchema = z.object({ blocked: z.array(FriendSchema) }).openapi("Blocks")`.
  - Rutas (todas `requireUser`, `bearerAuth`, en el contrato): `GET /blocks` → 200 `Blocks` (por nombre); `PUT /blocks/{userId}` → 204 (borra la amistad en la misma batch; 404 si el usuario no existe; 400 "No podés bloquearte" si es uno mismo); `DELETE /blocks/{userId}` → 204 siempre.

- [ ] **Step 1: Tests que fallan** en `test/blocks.test.ts` con `signUp`, `befriend`, `api`:
  - `"PUT /blocks/{id} blocks, removes the friendship and lists the user"`: A y B amigos; A `PUT /blocks/B` → 204; `GET /friends` de A no tiene a B y el de B no tiene a A; `GET /blocks` de A → `blocked[0].id === B`.
  - `"blocking is idempotent and one-directional"`: A bloquea a B dos veces → 204, 204; `GET /blocks` de B → `blocked` vacío.
  - `"unblocking one direction keeps the other"`: A bloquea a B, B bloquea a A; A `DELETE /blocks/B` → 204; `GET /blocks` de B sigue con A.
  - `"cannot block yourself"` → 400; `"blocking an unknown user"` → 404; sin token → 401.
- [ ] **Step 2:** `npm test -- blocks` → FAIL (404 de ruta).
- [ ] **Step 3:** Migración, `moderation.ts`, schema y `routes/blocks.ts` siguiendo el estilo de `routes/friends.ts` (`createRoute`, `errors(...)`, `json(...)`).
- [ ] **Step 4:** `npm test -- blocks` → PASS; `npm run typecheck` limpio.
- [ ] **Step 5: Commit** `git commit -m "Moderación: tablas de denuncias y bloqueos, y bloquear/desbloquear"`

### Task B2: Lo bloqueado y lo denunciado no se ve

**Files:**
- Modify: `src/routes/media.ts` (feed), `src/routes/featured.ts` (lista y archivo), `src/routes/users.ts` (perfil), `src/routes/trips.ts` + `src/lib/util.ts` (`publicMember`), `src/routes/friends.ts` (redeem y claim), `src/schemas.ts`
- Test: `test/blocks.test.ts` (sumar), `test/openapi.test.ts` si chequea campos

**Interfaces:**
- Consumes: `HIDDEN_MEDIA_SQL`, `isBlockedEitherWay`, `blockedIdsFor` (B1).
- Produces:
  - `UserProfileSchema` suma `blockedByMe: boolean` y `reportedByMe: boolean` (B3 escribe las denuncias; acá se lee `reports` con `media_id IS NULL`). Si el **perfil es de alguien que te bloqueó**, `canSee: false` y `isFriend: false`.
  - `MemberSchema` suma `blockedByMe: boolean`; `publicMember(m, user, blocked = false)` con tercer parámetro opcional; `GET /trips/{id}` lo calcula con `blockedIdsFor`.
  - `GET /users/{id}/featured` y `GET /featured/{userId}/{mediaId}/{variant}`: 403 de perfil privado si hay bloqueo en cualquier sentido entre viewer y dueño; además aplican `HIDDEN_MEDIA_SQL` (foto denunciada por el viewer o de un autor que bloqueó).
  - Feed (`GET /trips/{id}/feed`): agrega `AND ${HIDDEN_MEDIA_SQL}` con el `viewerId` (la query ya tiene `JOIN members mem`; usar alias `author` o adaptar el fragmento con un parámetro de alias — elegir uno y usarlo en los tres lugares).
  - Redeem/claim de amistad: si `isBlockedEitherWay(me, creator)` → `failAttempt` (mismo 400 que link inválido, cuenta como intento fallido).

- [ ] **Step 1: Tests que fallan** (en `test/blocks.test.ts`, con `newTrip`, `joinAs`, `uploadMedia`, revelando como en `test/media.test.ts`):
  - `"the feed hides photos of people you blocked, only for you"`: A, B, C en un rollo; B sube 1 foto; A bloquea a B; feed de A sin la foto, feed de C con la foto.
  - `"members show blockedByMe for the viewer"`: `GET /trips/{id}` de A → miembro B con `blockedByMe: true`; el de C → `false`.
  - `"a blocker's profile is private to the blocked user"`: B pide `GET /users/A` → `canSee: false`, `isFriend: false`; `GET /users/A/featured` → 403.
  - `"featured lists hide photos by authors you blocked"`: A destaca una foto de B; C bloquea a B; `GET /users/A/featured` de C sin esa foto; de un tercero D, con ella.
  - `"a blocked user cannot redeem the blocker's friend link"`: A crea link; A bloquea a B; B `POST /friends/redeem { code }` → 400, mismo body que código inválido; con `claimToken` (vía `/friend-links/claim`) → 400.
  - `"profile shows blockedByMe"`: A bloquea a B → `GET /users/B` de A tiene `blockedByMe: true`.
- [ ] **Step 2:** `npm test -- blocks` → FAIL.
- [ ] **Step 3:** Implementar los filtros y campos de arriba.
- [ ] **Step 4:** `npm test` (toda la suite) → PASS; `npm run typecheck` limpio.
- [ ] **Step 5: Commit** `git commit -m "Moderación: el feed, las destacadas y el perfil respetan los bloqueos"`

### Task B3: Denunciar y mail a soporte

**Files:**
- Create: `src/routes/reports.ts`
- Modify: `src/lib/email.ts`, `src/lib/r2.ts`, `src/types.ts` (`REPORTS_EMAIL?: string`, `ADMIN_TOKEN?: string`), `src/schemas.ts`, `src/index.ts`, `wrangler.jsonc` (comentario de secrets), `.dev.vars.example`
- Test: `test/reports.test.ts`

**Interfaces:**
- Consumes: tabla `reports` (B1), `HIDDEN_MEDIA_SQL` (B2 la usa en el feed: tras denunciar, la foto desaparece del feed del denunciante).
- Produces:
  - `ReportReasonSchema = z.enum(["offensive", "abuse", "other"]).openapi("ReportReason")`; `CreateReportSchema` = objeto con `reason` y **exactamente uno** de `mediaId` / `userId` (mismo patrón que `RedeemFriendSchema`).
  - `POST /reports` → 204. 404 si la foto no existe, está borrada, no es de un rollo donde sos miembro activo (o removido/salido: misma regla que el feed) ni una destacada que podés ver; 404 si el usuario no existe; 400 si es algo tuyo (tu foto o vos). Insert `INSERT OR IGNORE`; el mail se manda solo si la fila es nueva (`meta.changes === 1`). Si el mail falla: `console.error` y igual 204.
  - `presignGet(env: Env, key: string, expiresIn = 7 * 24 * 3600): Promise<string>` en `r2.ts` (como `presignPut` con `method: "GET"`; con `DEV_LOCAL_UPLOADS` devuelve una URL `https://dev.invalid/<key>` que no se usa).
  - `sendReportEmail(env: Env, report: ReportEmail): Promise<void>` en `email.ts` con `type ReportEmail = { reason: string; reporter: Person; target: Person; trip?: { name: string }; media?: { id: string; type: "photo" | "video"; caption: string | null; takenAt: number; url: string }; adminBase: string }` y `type Person = { id: string; name: string | null; username: string | null; email: string }`. Asunto exacto: `Denuncia en Rollo: foto de @{username}` (o `video de`) / `Denuncia en Rollo: @{username}` (sin @ usa el nombre). Cuerpo de texto con motivo en español, ambos datos, el link y los comandos: `curl -X DELETE -H "Authorization: Bearer $ROLLO_ADMIN_TOKEN" {adminBase}/admin/media/{id}` y `.../admin/users/{targetId}`. Sin `RESEND_API_KEY` empuja a `export const devSentReports: ReportEmail[]` (para tests) además de loguear. Destino `env.REPORTS_EMAIL ?? "soporte@juanifraga.com"`. `adminBase` = origin del request.

- [ ] **Step 1: Tests que fallan** en `test/reports.test.ts` (limpiar `devSentReports` en `beforeEach`):
  - `"reporting a photo hides it from the reporter's feed and emails support"`: A y B en rollo, B sube foto; A `POST /reports { mediaId, reason: "offensive" }` → 204; feed de A sin la foto; feed de B con la foto; `devSentReports.length === 1`, con `media.id`, `reporter.id === A`, `target.id === B`.
  - `"reporting twice sends one email"`: misma denuncia dos veces → 204, 204, `devSentReports.length === 1`.
  - `"reporting a person sets reportedByMe and does not hide them"`: A `POST /reports { userId: B, reason: "abuse" }` → 204; `GET /users/B` de A → `reportedByMe: true`; feed de A sigue con las fotos de B.
  - `"cannot report your own photo or yourself"` → 400; `"cannot report a photo from another roll"` → 404; `"mediaId and userId together"` → 400; `reason: "spam"` → 400.
  - `"a failing email still records the report"`: con `env: { RESEND_API_KEY: "x" }` y `fetch` de Resend respondiendo 500 (mock de `globalThis.fetch` solo para `api.resend.com`) → 204 y fila en `reports`.
- [ ] **Step 2:** `npm test -- reports` → FAIL.
- [ ] **Step 3:** Implementar ruta, schema, `presignGet`, `sendReportEmail`.
- [ ] **Step 4:** `npm test` → PASS; `npm run typecheck` limpio.
- [ ] **Step 5: Commit** `git commit -m "Moderación: denunciar fotos y personas, con mail a soporte"`

### Task B4: Administración y borrar cuenta

**Files:**
- Create: `src/lib/account.ts`, `src/routes/admin.ts`, `docs/moderacion.md`
- Modify: `src/routes/me.ts` (usar `deleteAccount`), `src/routes/media.ts` (extraer el borrado del admin del rollo a una función reutilizable), `src/index.ts`, `CLAUDE.md` del backend (secrets nuevos y link a `docs/moderacion.md`), `openapi.json` (regenerado con `npm run openapi`)
- Test: `test/admin.test.ts`, `test/account.test.ts` (sumar)

**Interfaces:**
- Consumes: tablas de B1, `deleteMediaRows` de `me.ts` (pasa a `lib/account.ts`).
- Produces:
  - `deleteAccount(env: Env, user: UserRow): Promise<void>` en `src/lib/account.ts`: lo que hoy hace `DELETE /me`, más `DELETE FROM reports WHERE reporter_id = ? OR target_user_id = ?` y `DELETE FROM blocks WHERE blocker_id = ? OR blocked_id = ?`.
  - `deleteTripMedia(env: Env, mediaId: string): Promise<boolean>` (mismo efecto que `DELETE /media/{id}` del admin del rollo; `false` si no existe o ya estaba borrada).
  - `src/routes/admin.ts`: `new Hono<AppEnv>()` (no `OpenAPIHono`, así no entra al contrato), montado con `app.route("/admin", admin)`. Middleware: si `!env.ADMIN_TOKEN` → 404 `No encontrado`; si el header no es exactamente `Bearer ${ADMIN_TOKEN}` (comparación de tiempo constante) → 404 también. `DELETE /admin/media/:mediaId` → 204 / 404. `DELETE /admin/users/:userId` → 204 / 404. `GET /admin/reports?limit=50` (máx. 200) → `{ reports: [{ id, reason, createdAt, reporter: { id, name, username, email }, target: {...}, mediaId, tripId }] }` más nuevas primero.

- [ ] **Step 1: Tests que fallan**:
  - `test/admin.test.ts` (con `env: { ADMIN_TOKEN: "secret" }` en `api`): `"admin routes are 404 without the token or with a wrong one"`; `"DELETE /admin/media removes the photo for everyone"` (sale del feed de todos los miembros, archivos de R2 borrados); `"DELETE /admin/users deletes the account like DELETE /me"` (su sesión da 401 y sus fotos no están); `"GET /admin/reports lists newest first"`; `"admin routes are not in openapi.json"` (`GET /openapi.json` sin paths que empiecen con `/admin`).
  - `test/account.test.ts`: `"deleting the account removes reports and blocks on both sides"`: A denuncia y bloquea a B; B denuncia a A; A `DELETE /me` → en D1 `SELECT COUNT(*)` de `reports` y `blocks` con A = 0.
- [ ] **Step 2:** `npm test -- admin account` → FAIL.
- [ ] **Step 3:** Extraer `deleteAccount` y `deleteTripMedia`, rutas admin, `docs/moderacion.md` en español: cómo generar y cargar el token (`openssl rand -hex 32` + `npx wrangler secret put ADMIN_TOKEN`), exportarlo como `ROLLO_ADMIN_TOKEN` en la terminal, los tres `curl`, y que hay que actuar dentro de las 24 h.
- [ ] **Step 4:** `npm test` → PASS; `npm run typecheck` limpio; `npm run openapi` y commitear `openapi.json`.
- [ ] **Step 5: Commit** `git commit -m "Moderación: comandos de administración y limpieza al borrar la cuenta"`

### Task B5: PR y producción (la hace quien coordina, no un worker)

- [ ] PR `feature/moderacion` → `develop` en `rollo-app/backend` (título y cuerpo en español), CI verde, revisión.
- [ ] Con OK de Juani: merge a `develop`, PR `develop` → `main`, migración remota (`npm run db:migrate:remote`) y deploy según el CLAUDE.md del backend.
- [ ] Juani carga `ADMIN_TOKEN` en una terminal del backend (`npx wrangler secret put ADMIN_TOKEN`) y lo guarda en su gestor; `REPORTS_EMAIL` no hace falta (default).

---

## Parte 2 — App (este repo; empieza cuando el contrato de B4 está en `develop` del backend)

### Task A1: Dominio `moderation`

**Files:**
- Modify: `src/api/schema.d.ts` (regenerado: `API_SPEC=<ruta al openapi.json del backend> npm run api:generate`), `package.json` (`npx expo install burnt`), `jest.setup.ts` (mock de `burnt`)
- Create: `src/features/moderation/actions.ts`, `reasons.ts`, `report-sheet.ts`, `use-report.ts`, `use-block.ts`, `use-blocked.ts`
- Test: `src/features/moderation/__tests__/reasons.test.ts`, `src/features/moderation/__tests__/actions.test.ts`

**Interfaces:**
- Produces:
  - `actions.ts`: `type ReportReason = Schemas["ReportReason"]`; `reportMedia(mediaId: string, reason: ReportReason): Promise<void>`; `reportUser(userId: string, reason: ReportReason): Promise<void>`; `blockUser(userId: string): Promise<void>`; `unblockUser(userId: string): Promise<void>`; `fetchBlocked(): Promise<Friend[]>` (`Friend` de `@/features/friends/actions`).
  - `reasons.ts`: `REPORT_REASONS: readonly { reason: ReportReason; label: string }[]` (orden y textos de Global Constraints); `reasonAt(index: number): ReportReason | null` (índice del action sheet; el último, "Cancelar", y fuera de rango → `null`).
  - `report-sheet.ts`: `pickReportReason(title: string): Promise<ReportReason | null>` con `ActionSheetIOS.showActionSheetWithOptions({ title, options: [...labels, "Cancelar"], cancelButtonIndex })`.
  - `use-blocked.ts`: `blockedKey = ["blocked"] as const`; `useBlocked()` con la misma forma que `useFriends()` (`{ blocked, error, refetch, isRefetching }`).
  - `use-report.ts`: `useReport(): { reportMedia(target: { mediaId: string; tripId?: string }): Promise<boolean>; reportUser(userId: string, name: string): Promise<boolean>; busy: boolean }`. Cada uno abre `pickReportReason` (títulos: foto `"¿Por qué denunciás esta foto?"`, persona `` `¿Por qué denunciás a ${name}?` ``), llama a la acción y: éxito → haptic `notificationAsync(Success)`, saca la foto del cache `feedKey(tripId)` si vino `tripId`, invalida `["feed"]`, `["featured"]` y `userKey(userId)`; devuelve `true`. Cancelar → `false` sin llamar. Error → `Burnt.alert({ preset: "error", title: "No se pudo denunciar", message: "Probá de nuevo cuando tengas señal." })`, nada se oculta, `false`.
  - `use-block.ts`: `useBlock(userId: string, name: string): { confirmBlock(): void; unblock(): Promise<void>; busy: boolean }`. `confirmBlock` muestra `Alert.alert` con el texto exacto del spec (`` `¿Bloquear a ${name}?` `` / "No vas a ver sus fotos ni sus captions en ningún rollo, deja de ser tu amigo o amiga y no te va a poder sumar a rollos.", botones "Cancelar" y "Bloquear" destructivo). Tras bloquear/desbloquear invalida `userKey(userId)`, `friendsKey`, `blockedKey`, `["feed"]`, `["featured"]`, `["trip"]`. Error → `Burnt.alert({ preset: "error", title: "No se pudo bloquear" })` (o `"No se pudo desbloquear"`).

- [ ] **Step 1: Tests que fallan**: `reasons.test.ts` (`reasonAt(0) === "offensive"`, `reasonAt(2) === "other"`, `reasonAt(3) === null`, `reasonAt(-1) === null`, labels exactos); `actions.test.ts` con `globalThis.fetch = jest.fn(...)`: `reportMedia` hace `POST /reports` con `{ mediaId, reason }`; `blockUser` hace `PUT /blocks/{id}`; `unblockUser` `DELETE`; `fetchBlocked` devuelve `body.blocked`.
- [ ] **Step 2:** `npx jest src/features/moderation` → FAIL.
- [ ] **Step 3:** Regenerar el cliente, instalar `burnt` (y mockearlo en `jest.setup.ts`: `jest.mock("burnt", () => ({ alert: jest.fn(), toast: jest.fn() }))`), implementar los archivos.
- [ ] **Step 4:** `npx jest src/features/moderation` → PASS; `npm run typecheck` limpio.
- [ ] **Step 5: Commit** `git commit -m "Moderación: acciones y hooks para denunciar y bloquear"`

### Task A2: Denunciar fotos (Feed, visor, destacadas)

**Files:**
- Modify: `src/features/feed/feed-row.tsx`, `src/features/feed/feed-list.tsx`, `src/features/gallery/photo-viewer.tsx`, `src/features/featured/featured-viewer.tsx`
- Test: `__tests__/feed.test.tsx`, `__tests__/gallery.test.tsx`, `__tests__/featured-viewer.test.tsx` (sumar casos; mockear `@/features/moderation/actions`)

**Interfaces:**
- Consumes: `useReport` (A1).
- Produces: `FeedRow` suma la prop `onReport?: (item: MapItem) => void`. El long-press abre un sheet con las acciones que correspondan: "Denunciar" (si `onReport`) y "Borrar foto" (si `onDelete`, destructiva), "Cancelar". `FeedList` pasa `onReport` en filas cuyo autor no sos vos. Visor y visor de destacadas: `MenuView` "Más opciones" también en fotos ajenas, con la acción `{ id: "report", title: "Denunciar", image: "exclamationmark.bubble" }`; tras denunciar, el visor pasa a la siguiente foto o cierra si era la última.

- [ ] **Step 1: Tests que fallan** (`renderRouter` + rutas de `src/test/routes.ts`; `ActionSheetIOS.showActionSheetWithOptions` mockeado para elegir el índice):
  - `feed.test.tsx` `"long-pressing someone else's row reports it and the row disappears"`: elige "Denunciar" y luego índice 0 → `reportMedia` llamado con `(id, "offensive")` y la fila ya no está.
  - `feed.test.tsx` `"your own rows offer no Denunciar"`.
  - `feed.test.tsx` `"a failed report keeps the row and shows the error HUD"`: `reportMedia` rechaza → la fila sigue y `Burnt.alert` llamado con `preset: "error"`.
  - `gallery.test.tsx` `"the viewer reports someone else's photo and moves on"`.
  - `featured-viewer.test.tsx` `"the featured viewer reports a photo"`.
- [ ] **Step 2:** `npx jest __tests__/feed __tests__/gallery __tests__/featured-viewer` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Mismo comando → PASS; `npm test` completo → PASS.
- [ ] **Step 5: Commit** `git commit -m "Moderación: denunciar fotos desde el Feed y los visores"`

### Task A3: Perfil, miembros y "Bloqueados"

**Files:**
- Modify: `src/features/friends/user-profile-screen.tsx`, `src/features/roll/roll-people.tsx` (y la sheet "Sobre el rollo" si lista miembros por otro componente), `src/features/profile/settings-screen.tsx`, `app/_layout.tsx`, `src/test/routes.ts`
- Create: `src/features/moderation/blocked-screen.tsx`, `app/blocked.tsx`
- Test: `__tests__/friend-profile.test.tsx`, `__tests__/moderation.test.tsx`

**Interfaces:**
- Consumes: `useReport`, `useBlock`, `useBlocked` (A1); `blockedByMe`, `reportedByMe` de `UserProfile` y `blockedByMe` de `Member` (B2).
- Produces:
  - Perfil ajeno: en la barra de navegación (`Stack.Screen options.headerRight`) un `MenuView` "Más opciones" (`ellipsis`) con "Denunciar" (oculto si `reportedByMe`) y "Bloquear" (destructivo) o "Desbloquear". Si `reportedByMe`, debajo del encabezado el texto "Denunciaste a esta persona" en `colors.secondaryLabel`, sin acción. Si `blockedByMe`, solo el encabezado (sin destacadas, amigos ni rollos en común) y una fila "Desbloquear".
  - Miembros: `value={m.blockedByMe ? "Bloqueado" : m.role === "admin" ? "Admin" : undefined}`.
  - Ajustes (`settings-screen.tsx`): fila "Bloqueados" → `/blocked`, visible solo si `useBlocked().blocked?.length`.
  - `app/blocked.tsx` → `BlockedScreen`: título "Bloqueados", lista agrupada con `Avatar`, nombre y `@`; tocar abre `/user/{id}`; vacía → "No bloqueaste a nadie." Registrada en `app/_layout.tsx` (push en el stack raíz) y en `src/test/routes.ts`.

- [ ] **Step 1: Tests que fallan**:
  - `friend-profile.test.tsx` `"blocking from a profile confirms, calls blockUser and shows Desbloquear"` (mock de `Alert.alert` que presiona "Bloquear").
  - `friend-profile.test.tsx` `"reporting a person shows Denunciaste a esta persona"` (después de `reportUser`, el perfil refetcheado trae `reportedByMe: true`).
  - `friend-profile.test.tsx` `"a blocked profile hides featured photos and friends"`.
  - `moderation.test.tsx` `"Ajustes shows Bloqueados only when someone is blocked, and unblocking from the profile removes them"`.
  - `moderation.test.tsx` `"members list shows Bloqueado"`.
- [ ] **Step 2:** `npx jest __tests__/friend-profile __tests__/moderation` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Mismo comando → PASS; `npm test` → PASS; `npm run typecheck` limpio.
- [ ] **Step 5: Commit** `git commit -m "Moderación: bloquear y denunciar desde el perfil, y lista de bloqueados"`

### Task A4: Términos en el login

**Files:**
- Modify: `app/(auth)/email.tsx` (o `src/features/auth/auth-screen.tsx` si el pie va ahí), `src/config.ts` (`SITE_URL = "https://rollo.juanifraga.com"`)
- Test: `__tests__/accounts.test.tsx`

**Interfaces:**
- Produces: debajo del botón "Continuar", un `Footnote` con el texto exacto "Al continuar aceptás los Términos y la Política de privacidad." donde "Términos" y "Política de privacidad" son texto anidado en `colors.tint`, con `accessibilityRole="link"`, que abren `${SITE_URL}/terminos` y `${SITE_URL}/privacidad` con `Linking.openURL`.

- [ ] **Step 1: Test que falla** `"the email screen links to the terms and the privacy policy"`: renderiza `/email`, presiona "Términos" → `Linking.openURL` con `https://rollo.juanifraga.com/terminos`; "Política de privacidad" → `.../privacidad`.
- [ ] **Step 2:** `npx jest __tests__/accounts` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test` → PASS; `npm run typecheck` limpio.
- [ ] **Step 5: Commit** `git commit -m "Login: aceptar términos y política de privacidad"`

### Task A5: Cierre (la hace quien coordina)

- [ ] Actualizar `CLAUDE.md` de la app (dominio `moderation` en la lista de dominios, conteo de tests) y abrir PR `feature/moderacion` → `develop` en `rollo-app/mobile` con CI verde.
- [ ] Build nuevo a TestFlight (`burnt` es nativo) y prueba manual con la cuenta de Juani y la del revisor: denunciar una foto (desaparece, llega el mail a soporte, el `curl` del mail la saca para todos), denunciar a una persona, bloquear (desaparecen sus fotos, se borra la amistad, no puede canjear links), desbloquear desde Ajustes → Bloqueados.
- [ ] En App Store Connect, notas para el revisor: "Para denunciar: mantener apretada una fila del Feed o '…' en una foto. Para bloquear: '…' en el perfil de una persona."
