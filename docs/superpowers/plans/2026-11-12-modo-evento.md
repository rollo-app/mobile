# Modo evento con grupos — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un rollo de tipo `event` con grupos. El invitado entra por QR o link, elige uno o varios grupos y ve solo las fotos de esos grupos. Los organizadores ven todo, mezclado o por grupo. Tiene que estar en la App Store (1.4) antes del casamiento del 12/12/2026.

**Architecture:**
- Un evento es un rollo (`trips.type = 'event'`).
- Tres tablas nuevas: `event_groups`, `member_groups` y `media_groups`.
- La visibilidad se decide en SQL con un solo helper que usan feed, descargas, me gusta, comentarios y listas propias.
- La app lee `type` y `groups` del contrato y cambia: unirse, captura, tabs, galería y tablero.
- Un link universal `https://rolloproject.com/join/<CÓDIGO>` lleva al flujo de unirse.

**Tech Stack:**
- Backend: Cloudflare Workers + Hono (`@hono/zod-openapi`) + D1 + R2; vitest con `cloudflare:test`.
- App: Expo SDK 58, Expo Router, TanStack Query, `expo-sqlite`, `@shopify/react-native-skia` (ya instalado, para el QR); Jest con `renderRouter`.
- Sitio: `rollo-app/web` (Vercel).
- Panel: `front-admin` (Next 16).

**Spec:** `docs/superpowers/specs/2026-11-12-modo-evento-design.md` (en este repo). Leé el spec y el plan.

## Global Constraints

- **Ramas:** `feature/event-mode` en cada repo (backend, mobile, web, front-admin), desde `develop`, cada una en su worktree `<repo>/.claude/worktrees/evento`.
- **TDD:** test primero, verlo fallar, código mínimo, test en verde, commit. Commits en español; código, identificadores y descripciones de tests en inglés.
- **Correr tests:** solo los archivos tocados.
  - Backend: `npx vitest run test/<file>.test.ts --maxWorkers=2`.
  - App: `npx jest <ruta> --maxWorkers=2`.
  - La suite completa la corre el CI.
- **Migración:** `migrations/0039_event_mode.sql`, espejada en `src/db/schema.ts`. Después, `npm run db:check-schema` en verde.
- **Contrato:** cada cambio de API corre `npm run openapi` en el backend y `API_SPEC=<backend worktree>/openapi.json npm run api:generate` en la app, y se commitean los dos archivos.
- **Nada de paquetes nativos nuevos.** El QR se genera con el paquete JS `qrcode` (`QRCode.create`) y se dibuja con Skia, que ya está.
- **Compatibilidad con la 1.3:**
  - Un rollo `trip` se comporta exactamente igual que hoy.
  - En un evento, `POST /trips/join` sin `groupIds` contesta **409** `{ error: "Actualizá Rollo para sumarte a este evento.", code: "EVENT_NEEDS_UPDATE" }`.
- **Textos fijos de la UI** (rioplatense):
  - "Actualizá Rollo para sumarte a este evento."
  - "Este evento ya se reveló."
  - "Elegí tu grupo" / "Elegí tus grupos"
  - "Entrar"
  - "Todos los grupos"
  - "Grupos"
  - "Sumarme a otro grupo"
  - "Código QR"
  - "Evento"
  - "Rollo"
  - "Portada"
  - "Feed"
  - "Todos" (filtro de la galería)
- **Lleno:** se mantiene el mensaje de la Tarea 2 ("Este rollo está lleno. Pedile a quien lo creó que haga lugar.").
- **Eventos:**
  - `photoLimitMode` siempre `"total"` (20 por defecto, el usuario puede cambiarlo).
  - `momentMode` siempre `"off"`.
  - `featuringDisabled` lo elige el organizador, como hoy.
- **Organizador = miembro con `role = 'admin'`.** Los organizadores pueden no tener grupos. Todo invitado (`member`) de un evento tiene al menos un grupo.

## Review Focus

1. **Un invitado nunca ve fotos de un grupo donde no está**, por ningún camino: feed, `/files` (descarga con token), me gusta, comentarios, `/me/likes`, `/me/comments` y la portada de "Tus rollos". Tests en la Task B3.
2. **Un usuario con la 1.3 que ya era miembro activo vuelve a escanear:** hoy `joinTrip` contesta `{created:false}` antes de chequear nada. Para un evento sin grupos tiene que contestar `EVENT_NEEDS_UPDATE`, no 200. Test en la Task B2.
3. **Una foto en la cola offline con un grupo que el invitado dejó o que se borró** no tiene que fallar ni quedar trabada. El server ignora los grupos inválidos y, si no queda ninguno, usa los grupos actuales del invitado. Test en la Task B4.
4. **El link `/join/<código>` sin la app instalada.** La página del sitio muestra el código y el botón a la App Store. Al abrir la app recién instalada, el invitado escribe el código en "Unirme" y llega a la pantalla de grupos. Test en las Tasks M2 y W1.
5. **Un organizador manda una foto a "Todos los grupos" y después se crea un grupo nuevo:** el grupo nuevo no la ve. Es aceptado: queda documentado en el `CLAUDE.md` del backend y con un test que lo fija en la Task B4.

---

## Backend (`rollo-app/backend`, worktree `backend/.claude/worktrees/evento`)

### Task B1: Migración, tipos y crear un evento con grupos

**Files:**
- Create: `migrations/0039_event_mode.sql`, `test/events.test.ts`
- Modify: `src/db/schema.ts`, `src/modules/trips/trips.schemas.ts` (`CreateTripSchema`), `trips.service.ts` (`createTrip`), `trips.repository.ts` (`NewTrip`, `insertTrip`, nuevas `insertGroups`, `listGroups`), `src/schemas.ts` (`TripSchema`, `TripDetailSchema`), `src/lib/util.ts` (`publicTrip`), `src/modules/me/me.schemas.ts` (`TripSummarySchema`), `me.repository.ts` / `me.controller.ts` (`listMyTrips`)

**Interfaces:**
- Produces, en la migración:
  - `trips.type TEXT NOT NULL DEFAULT 'trip' CHECK (type IN ('trip','event'))`, `trips.cover_key TEXT`, `trips.pending_cover_key TEXT`.
  - `event_groups(id TEXT PK, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, name TEXT NOT NULL, position INTEGER NOT NULL, created_at INTEGER NOT NULL, UNIQUE(trip_id, name))`.
  - `member_groups(member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE, group_id TEXT NOT NULL REFERENCES event_groups(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, PRIMARY KEY(member_id, group_id))` + índice en `group_id`.
  - `media_groups(media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE, group_id TEXT NOT NULL REFERENCES event_groups(id) ON DELETE CASCADE, PRIMARY KEY(media_id, group_id))` + índice en `group_id`.
- Produces, en el contrato:
  - `CreateTripRequest.type?: "trip" | "event"` (default `"trip"`) y `groups?: string[]`. En un evento es obligatorio: de 1 a 30 nombres de 1 a 40 caracteres, sin repetir, con trim.
  - `Trip.type: "trip" | "event"`, `Trip.coverUrl: string | null`, `Trip.groups: { id: string; name: string }[]` (`[]` en un `trip`).
  - `TripDetail.me.groupIds: string[]`.
  - `TripSummary.type` y `TripSummary.coverUrl`.
- Produces, en código: `listGroups(db, tripId): Promise<{id: string; name: string; position: number}[]>`, ordenado por `position`.

- [ ] **Step 1: Write the failing tests** in `test/events.test.ts`:
  - `creates an event with its groups in order`: hace `POST /trips` con `{type:"event", groups:["Familia de él","Trabajo de ella"], photoLimitMode:"total", totalPhotoLimit:20, …}`. Espera 201, `trip.type === "event"`, `trip.groups.map(g=>g.name)` igual a `["Familia de él","Trabajo de ella"]` y `trip.coverUrl === null`.
  - `rejects an event without groups`: con `groups: []`, espera 400.
  - `rejects duplicate group names`: con `["Familia","Familia"]`, espera 400.
  - `forces total photo limit and no moment on events`: con `photoLimitMode:"daily"` y `momentMode:"photo"`, `GET /trips/{id}` devuelve `photoLimitMode === "total"` y `momentMode === "off"`.
  - `a regular trip reports type trip and no groups`: con `createTrip(token)`, el detalle tiene `type === "trip"` y `groups` igual a `[]`.
  - `my trips list carries type and cover`: `GET /me/trips` incluye `type: "event"` y `coverUrl: null`.
- [ ] **Step 2: Run** `npx vitest run test/events.test.ts --maxWorkers=2` → FAIL.
- [ ] **Step 3: Implement.**
  - La migración más su espejo en `schema.ts`.
  - El schema de crear con un `superRefine` para las reglas de evento.
  - `createTrip` normaliza el evento (`photo_limit_mode='total'`, `moment_mode='off'`; si no viene `totalPhotoLimit`, 20) y suma `insertGroups` al mismo `db.batch`. Los ids de grupo son `crypto.randomUUID()` y `position` es el índice.
  - `publicTrip` recibe `groups` y `coverUrl`. La URL de la portada es `/covers/{tripId}/{file}`, que sale en la Task B5.
- [ ] **Step 4: Run** the test file plus `test/trips.test.ts` and `test/me.test.ts` → PASS. Run `npm run db:check-schema` → "Schema OK". Run `npm run openapi`.
- [ ] **Step 5: Commit** `"Eventos: tipo de rollo, grupos y migración 0039"`.

### Task B2: Unirse a un evento eligiendo grupos

**Files:**
- Modify: `src/modules/trips/members.service.ts` (`joinTrip`, `addFriendsToTrip`), `trips.schemas.ts` (`JoinTripSchema`), `trips.repository.ts` (nuevas `setMemberGroups`, `listMemberGroupIds`), `trips.router.ts`, `trips.controller.ts`, `src/shared/errors.ts` (si hace falta el code)
- Create: `src/modules/events/events.router.ts`, `events.controller.ts`, `events.service.ts` (preview pública), montado en `src/index.ts`
- Test: `test/events.test.ts`

**Interfaces:**
- Consumes: `listGroups` (B1).
- Produces:
  - `JoinTripRequest.groupIds?: string[]` (de 1 a 30).
  - `GET /events/{code}` (sin sesión, limitado por IP con `RL_SEARCH`) → `{ name, coverUrl, revealed: boolean, groups: {id,name}[] }`. Si el código no existe o es de un `trip`, 404 "Código inválido".
  - `PUT /trips/{tripId}/members/me/groups { groupIds: string[] }` → `{ groupIds: string[] }`.
  - `setMemberGroups(db, memberId, groupIds): D1PreparedStatement[]` (borra e inserta).

- [ ] **Step 1: Write the failing tests:**
  - `previews an event by code without a session`: devuelve el nombre y los dos grupos; un código de `trip` da 404.
  - `joining an event without groups asks to update`: devuelve 409, `code === "EVENT_NEEDS_UPDATE"` y el mensaje exacto de Global Constraints. **No** se crea el miembro.
  - `an existing member rejoining without groups also asks to update` (Review Focus 2): el miembro se crea directo sin grupos en D1, y después `join` sin `groupIds` devuelve 409 `EVENT_NEEDS_UPDATE`.
  - `joins an event into the chosen groups`: con `groupIds:[A,B]` devuelve 201, y `GET /trips/{id}` da `me.groupIds` = `[A,B]` (el orden no importa).
  - `rejects group ids from another trip`: devuelve 400.
  - `rejoining with more groups adds them`: ya estaba en `[A]`, entra con `[B]` y queda en `me.groupIds` = `[A,B]`.
  - `joining a revealed event says it was revealed`: devuelve 409 "Este evento ya se reveló.".
  - `adding friends to an event is refused`: `POST /trips/{id}/members` devuelve 409 "En un evento se entra con el código.".
  - `a guest can set their groups but not to none`: `PUT …/members/me/groups` con `[B]` da 200; con `[]` da 400.
  - `an organizer may have no groups`: el creador (admin) con `[]` da 200.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
  - En `joinTrip`, si es evento: valida `groupIds` contra `listGroups` (400 si hay ids ajenos). Esto va **antes** del camino `already_member`.
  - La escritura del miembro y `setMemberGroups` van en el mismo batch. Para un miembro que ya existe, los grupos se unen a los que tenía.
  - El mensaje de revelado depende del tipo.
- [ ] **Step 4: Run** `test/events.test.ts`, `test/trips.test.ts` y `test/trip-max-members.test.ts` → PASS. Run `npm run openapi`.
- [ ] **Step 5: Commit** `"Eventos: unirse eligiendo grupos y vista previa por código"`.

### Task B3: Visibilidad por grupo

**Files:**
- Create: `src/lib/event-visibility.ts`
- Modify: `src/modules/media/media.repository.ts` (`listFeed`, la búsqueda de descarga detrás de `getDownloadKey`), `src/modules/likes/likes.repository.ts` (`findLikeableRow`, `GET /me/likes`), `src/modules/comments/comments.repository.ts` (`findCommentableRow`, `GET /me/comments`), `src/modules/me/me.repository.ts` (subconsulta de portada y `total_uploaded`), `src/modules/trips/trips.service.ts` (`getTripDetail`: lista de miembros), `src/modules/media/media.controller.ts` (`presentFeedItem`: `groupIds`)
- Test: `test/event-visibility.test.ts`

**Interfaces:**
- Produces:
  - `mediaVisibleTo(viewerUserId: string, mediaId: SQLWrapper, tripId: SQLWrapper): SQL`. Es verdadero si el rollo es `trip`, si el que mira es admin activo, o si existe un `media_groups` × `member_groups` en común con el miembro activo que mira.
  - `FeedItem.groupIds: string[]`, solo en eventos (en `trip` va `[]`).
  - `TripDetail.members` de un invitado en un evento: los organizadores más los miembros que comparten al menos un grupo con él.

- [ ] **Step 1: Write the failing tests.** Fixture: un evento con grupos A y B, el invitado `ga` en A, el invitado `gb` en B, el organizador, y una foto de `ga` en A y otra de `gb` en B. Se revela con un UPDATE directo, como en los tests de revelado que ya existen.
  - `a guest sees only photos of their groups in the feed`: `ga` ve 1 ítem, el suyo. El organizador ve 2.
  - `a photo in two groups is seen by both`.
  - `a guest cannot download another group's photo`: el `/files` de la foto de B con el token de `ga` da 404.
  - `a guest cannot like or comment another group's photo`: los dos dan 404.
  - `my likes and my comments never list photos the guest stopped seeing`: `ga` da me gusta a una foto de A y A pasa a no tener a `ga` (con `PUT /groups` a B). `/me/likes` no la lista.
  - `members list shows organizers and shared-group guests only`.
  - `joining another group shows its past photos`.
  - `regular trips are unaffected`: un `trip` con 2 autores; cada uno ve las 2 fotos.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `mediaVisibleTo` y sumalo al WHERE de cada consulta de la lista.
  - El keyset de `listFeed` no cambia: el filtro es un predicado más.
  - `groupIds` sale de un `json_group_array` correlacionado sobre `media_groups`. Un evento tiene ≤ 30 grupos.
- [ ] **Step 4: Run** `test/event-visibility.test.ts`, `feed-pagination`, `likes`, `comments`, `media` y `me` → PASS. Run `npm run openapi`.
- [ ] **Step 5: Commit** `"Eventos: cada invitado ve solo las fotos de sus grupos"`.

### Task B4: Mandar una foto a uno o varios grupos

**Files:**
- Modify: `src/modules/media/media.schemas.ts` (`RegisterMediaSchema`), `media.service.ts` (`registerMedia`), `media.repository.ts` (`insertMedia` más el batch de `media_groups`)
- Test: `test/event-media.test.ts`

**Interfaces:**
- Produces: `RegisterMediaRequest.groupIds?: string[]` (de 0 a 30). En un `trip` se ignora.
- Regla, en una función pura `resolveMediaGroups({ requested, memberGroupIds, allGroupIds, isAdmin }): string[]` dentro de `media.service.ts`:
  - Un admin se queda con los pedidos que están en `allGroupIds`. Un invitado, con los pedidos que están en `memberGroupIds`.
  - Si no queda ninguno: un invitado va a `memberGroupIds` y un admin a `allGroupIds`.

- [ ] **Step 1: Write the failing tests:**
  - `a guest's photo goes to the chosen groups`: un invitado en A y B manda `[B]`. Lo ve un invitado de B, no uno de A.
  - `a photo sent to two groups counts once against the quota`: con `totalPhotoLimit:1`, la segunda foto da 429 aunque la primera fuera a 2 grupos.
  - `stale group ids are ignored and fall back to the guest's groups` (Review Focus 3): el invitado ahora está solo en B y manda `[A]`. Da 201 y la foto queda en B.
  - `an organizer can send to all groups`: con todos los ids, ven la foto los invitados de A y de B.
  - `a group created later does not see an all-groups photo` (Review Focus 5).
  - Unidad `resolveMediaGroups` con los cuatro casos de la regla.
  - `register is idempotent with groups`: repetir el mismo `id` no duplica filas de `media_groups`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** con `INSERT OR IGNORE INTO media_groups` en el mismo batch que `insertMedia`.
- [ ] **Step 4: Run** `test/event-media.test.ts` y `test/media.test.ts` → PASS. Run `npm run openapi`.
- [ ] **Step 5: Commit** `"Eventos: mandar fotos a uno o varios grupos"`.

### Task B5: Administrar grupos y portada

**Files:**
- Modify: `src/modules/trips/trips.router.ts`, `trips.controller.ts`, `trips.service.ts`, `trips.repository.ts`
- Create: `src/modules/trips/cover.service.ts`, la ruta pública `GET /covers/{tripId}/{file}` (modelo: `src/modules/avatars/`)
- Test: `test/event-groups.test.ts`, `test/event-cover.test.ts`

**Interfaces:**
- Produces:
  - `POST /trips/{tripId}/groups {name}` → 201 `{id,name}`.
  - `PATCH /trips/{tripId}/groups/{groupId} {name}` → 200.
  - `DELETE /trips/{tripId}/groups/{groupId}` → 204, o 409 "Este grupo tiene gente o fotos." si tiene `member_groups` o `media_groups`.
  - Todo lo anterior es solo para admin (`requireAdmin`) y solo en eventos sin revelar. Revelado: 409 "Este evento ya se reveló.". En un `trip`: 409.
  - `POST /trips/{tripId}/cover {sizeBytes}` → `{upload, expiresIn}`; `POST /trips/{tripId}/cover/complete` → `{coverUrl}`. Solo admin. Mismas validaciones que el avatar: ≤ 2 MB y JPEG. La clave es `trips/{tripId}/cover/{uuid}.jpg`.

- [ ] **Step 1: Write the failing tests:**
  - Crear, renombrar y borrar un grupo vacío.
  - Nombre duplicado: 409.
  - Borrar un grupo con gente o con fotos: 409.
  - Un invitado no puede (403).
  - Después del revelado: 409 "Este evento ya se reveló.".
  - Portada:
    - el ciclo completo devuelve `coverUrl` y `GET` del archivo da 200 `image/jpeg`;
    - un no-JPEG da 400;
    - un invitado da 403;
    - la portada vieja se borra de R2.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** copiando el patrón de `me.service.requestAvatarUpload` / `completeAvatarUpload`.
- [ ] **Step 4: Run** los dos archivos → PASS. Run `npm run openapi`.
- [ ] **Step 5: Commit** `"Eventos: grupos y portada editables por los organizadores"`.

### Task B6: Panel, seed y documentación

**Files:**
- Modify: `src/modules/admin/admin.service.ts` (`getTrip` suma `type` y `groups: {id,name,memberCount,mediaCount}[]`), `admin.repository.ts`, `scripts/seed.ts` (un evento "Casamiento de prueba" con 3 grupos e invitados en cada uno, impreso en el resumen), `CLAUDE.md` (sección "Eventos"), `README.md` si lista endpoints
- Test: `test/admin-trips.test.ts`

- [ ] **Step 1: Write the failing test** `admin trip detail lists event groups with counts`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS. Corré `npm run seed` local y fijate que imprima el evento con su código.
- [ ] **Step 5: Commit** `"Eventos: panel, seed y documentación"`. Push y PR a `develop`.

---

## App (`rollo-app/mobile`, worktree `mobile/.claude/worktrees/evento`)

Arranca cuando el contrato de B1–B5 está en la rama del backend. Regenerá `schema.d.ts` con el `openapi.json` del worktree del backend.

### Task M1: Contrato y helpers de evento

**Files:**
- Modify: `src/api/schema.d.ts` (generado), `src/test/trip.ts` (fixtures con `type`, `groups`, `coverUrl`, `me.groupIds`), `src/test/feed.ts` (`groupIds`)
- Create: `src/features/events/event.ts`, `src/features/events/__tests__/event.test.ts`

**Interfaces:**
- Produces:
  - `isEvent(trip: { type: "trip" | "event" }): boolean`.
  - `isOrganizer(detail: TripDetail): boolean` (`detail.me.role === "admin"`).
  - `myGroups(detail: TripDetail): { id: string; name: string }[]`.
  - `sendableGroups(detail): { id; name }[]`: todos para un organizador, los propios para un invitado.

- [ ] Tests para las cuatro funciones → FAIL → implementar → `npm run typecheck` limpio y los tests que ya existían con los fixtures nuevos en verde → commit `"Eventos: contrato y helpers"`.

### Task M2: Link `/join/<código>` y unirse eligiendo grupos

**Files:**
- Modify: `app/+native-intent.tsx`, `src/features/trips/join-screen.tsx`, `src/features/trips/actions.ts` (`joinTrip({code, groupIds?})`, nueva `previewEvent(code)`), `src/features/trips/use-join-trip.ts`, `src/test/routes.ts`, `app/_layout.tsx`
- Create: `src/features/events/join-link.ts` (`joinLinkPath(url): string | null` → `/join?code=<CODE>`), `src/storage/pending-join.ts` (SecureStore `rollo.pendingJoin`, `{code}`), `src/features/events/use-pending-join.ts`, `src/features/events/pick-groups.tsx`
- Test: `__tests__/native-intent.test.ts`, `__tests__/join-event.test.tsx`

**Interfaces:**
- Consumes: `GET /events/{code}` y `POST /trips/join {code, groupIds}` (B2).
- Produces:
  - `previewEvent(code): Promise<EventPreview | null>`: `null` si es 404, porque es un `trip`.
  - `PickGroups({ groups, selected, onChange })`: una lista de filas con check, en multi-selección.

Flujo:
- **Con código.** "Unirme" llama primero a `previewEvent`. Si es evento, en vez de unirse muestra la portada, el nombre y "Elegí tu grupo" (o "Elegí tus grupos" con más de uno) con `PickGroups`. El botón "Entrar" se habilita con al menos uno elegido. Si es `null`, sigue el flujo de hoy.
- **Con link.** Un link `/join?code=` sin sesión guarda `rollo.pendingJoin` y, al completar el perfil, abre `/join?code=…`, como `useRedeemPendingFriend`.

- [ ] **Step 1: Write the failing tests:**
  - `redirectSystemPath maps https://rolloproject.com/join/ABC123 to /join?code=ABC123`, y `rollo://join/ABC123` también.
  - `entering an event code shows its groups and joins the chosen ones`: `previewEvent` y `joinTrip` están mockeados. Se espera `joinTrip` llamado con `{code:"ABC123", groupIds:["g2"]}` y la navegación a `/roll`.
  - `Entrar is disabled until a group is picked`.
  - `a regular trip code joins directly`: `previewEvent` devuelve `null`. Mismo comportamiento que hoy.
  - `a revealed event shows "Este evento ya se reveló."` (`preview.revealed`) y no muestra los grupos.
  - `a join link without a session is kept and opened after the profile is complete`.
- [ ] **Step 2–4:** FAIL → implementar → PASS (además de los tests de `join` que ya existen).
- [ ] **Step 5: Commit** `"Eventos: unirse por link o código eligiendo grupos"`.

### Task M3: Captura con grupos

**Files:**
- Modify: `src/features/capture/capture-screen.tsx` `capture-preview.tsx` (prop `groups?: {id,name}[]`, `selectedGroupIds`, `onGroupsChange`), `use-send-shot.ts` (`SendShotInput.groupIds?: string[]`), `queue.ts` (columna `group_ids TEXT` con JSON en `ADDED_COLUMNS`, `QueuedMedia.groupIds: string[] | null`), `uploader.ts` (manda `groupIds`)
- Create: `src/storage/last-groups.ts` (SecureStore `rollo.lastGroups.<tripId>`, JSON de ids), `src/features/events/group-chips.tsx`
- Test: `src/features/capture/__tests__/queue.test.ts`, `__tests__/capture.test.tsx`

**Interfaces:**
- Consumes: `sendableGroups` (M1), `RegisterMediaRequest.groupIds` (B4).
- Produces: `GroupChips({ groups, selected, onChange, allOption: boolean })`. Con `allOption`, que es para organizadores, el primer chip es "Todos los grupos" y tildarlo elige todos los ids.

Reglas de la pantalla del caption:
- Con **un solo** grupo para mandar no se muestran chips y la foto va a ese grupo.
- Con varios, arranca con `rollo.lastGroups.<tripId>` filtrado a los grupos que siguen valiendo. Si no queda ninguno, arranca con el primero.
- "Mandar al rollo" se deshabilita si no hay ninguno tildado.
- En un `trip` no cambia nada.

- [ ] **Step 1: Write the failing tests:**
  - Cola: `persists group ids and reads them back`, y `an old row without the column reads groupIds as null` (migración aditiva sobre una base creada sin la columna).
  - Captura:
    - `an event asks for location like a trip` (cambio del 12/11: en eventos se guarda la ubicación).
    - `a guest in one group sees no chips and sends to it`.
    - `a guest in two groups starts with the last used and can add the other`: `enqueue` se llama con `groupIds` igual a `["g1","g2"]`.
    - `an organizer sees Todos los grupos`.
    - `a trip shows no chips and still asks for location`.
  - Uploader: `sends groupIds when present and omits them when null`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** `"Eventos: captura sin ubicación y con elección de grupos"`.

### Task M4: Tabs y feed del evento

**Files:**
- Modify: `src/features/trips/tabs.ts` (`tabsFor` recibe `isEvent`), `app/(tabs)/_layout.tsx` (en un evento, la tab del medio-izquierda se llama "Feed" con el ícono `list.bullet.rectangle`, y después del revelado se oculta), `src/features/map/activity-screen.tsx` (en un evento renderiza solo `FeedList`, sin `RollMap` ni el control segmentado)
- Test: `src/features/trips/__tests__/tabs.test.ts`, `__tests__/map.test.tsx`

- [ ] Tests:
  - `event tabs show Feed before reveal and hide it after`.
  - `the event feed tab never mounts the map`.
  - `trips keep Mapa`.
- [ ] FAIL → implementar → PASS → commit `"Eventos: tab Feed sin mapa"`.

### Task M5: Galería con filtro por grupo

**Files:**
- Modify: `src/features/media/revealed.ts` (`RevealedPhoto.groupIds`), `src/features/gallery/group.ts` (`filterByGroup(photos, groupId | null)`), `gallery-screen.tsx` (estado `groupId`), `gallery-toolbar.tsx` (menú "Grupos" con "Todos" y uno por grupo, junto al filtro de autor)
- Test: `src/features/gallery/__tests__/group.test.ts`, `__tests__/gallery.test.tsx`

Regla: el menú aparece solo si `sendableGroups(detail)` tiene más de un grupo, es decir, un organizador o un invitado en varios grupos. "Todos" es el orden cronológico de lo que el server ya devuelve.

- [ ] Tests:
  - `filterByGroup keeps photos in the group and null keeps all`.
  - `an organizer can filter the gallery by group`.
  - `a guest in one group sees no group menu`.
- [ ] FAIL → implementar → PASS → commit `"Eventos: galería por grupo"`.

### Task M6: Tablero del evento — grupos, QR y portada

**Files:**
- Modify: `src/features/roll/roll-people.tsx` (en un evento: sección "Grupos"; en "Invitar", la fila "Código QR" solo para organizadores; "Sumar amigos" oculto), `src/features/trips/actions.ts` (`setMyGroups`, `createGroup`, `renameGroup`, `deleteGroup`, `uploadCover`), `src/test/routes.ts`, `app/_layout.tsx`
- Create:
  - `app/event-groups.tsx` con `src/features/events/groups-screen.tsx`: el organizador agrega, renombra con `Alert.prompt` y borra con confirmación; el error 409 se muestra inline.
  - `app/my-groups.tsx` con `src/features/events/my-groups-screen.tsx`: el invitado usa `PickGroups` y guarda con `setMyGroups`.
  - `app/event-qr.tsx` con `src/features/events/qr-screen.tsx` y `src/features/events/qr.ts`: `qrMatrix(text): boolean[][]` con `QRCode.create(text, {errorCorrectionLevel:"M"})`.
  - `src/features/events/qr-canvas.tsx`: un `Canvas` de Skia; "Compartir" usa `makeImageSnapshot` → PNG en caché → `Share.share({url})`.
  - Hooks `use-set-my-groups.ts`, `use-group-mutations.ts` y `use-upload-cover.ts`, que invalidan el detalle y `myTripsKey`.
- Test: `src/features/events/__tests__/qr.test.ts`, `__tests__/event-board.test.tsx`

**Interfaces:**
- Consumes: B2 (`PUT …/members/me/groups`), B5 (grupos y portada), `joinLinkUrl(code)` en `join-link.ts` → `https://rolloproject.com/join/<CODE>`.

- [ ] Tests:
  - `qrMatrix encodes the join url and is square`: el tamaño es impar y ≥ 21.
  - `an organizer sees Código QR and Grupos and no Sumar amigos`.
  - `a guest sees their groups and Sumarme a otro grupo, and no Código QR`.
  - `deleting a group with people shows the server message`.
  - `the QR screen shows the code under the QR`.
- [ ] FAIL → `npm i qrcode @types/qrcode` (JS puro, sin nativo) → implementar → PASS → commit `"Eventos: grupos, QR y portada en el tablero"`.

### Task M7: Crear un evento

**Files:**
- Modify: `src/features/trips/create-screen.tsx` (un `Picker` segmentado "Rollo | Evento" arriba; en un evento: sección "Grupos" con una fila por grupo, "Agregar grupo" y borrar deslizando; sección "Portada" opcional; sin sección "Momento del día"; "Fotos por persona" fijo en "Todo el rollo" con 20 por defecto), `src/features/trips/trip-form.tsx` (prop `hideMoment`), `create-form.ts` (`canCreateEvent(name, groups)`: nombre válido y ≥ 1 grupo no vacío sin repetir), `actions.ts` (`createTrip` manda `type` y `groups`)
- Test: `src/features/trips/__tests__/create-form.test.ts`, `__tests__/create-event.test.tsx`

Después de crear un evento: si eligió portada, se sube con `uploadCover`; si falla, no bloquea y queda para editarla desde el tablero. Se navega a `/roll` sin ofrecer "Sumar amigos".

- [ ] Tests:
  - `canCreateEvent needs at least one non-empty unique group`.
  - `creating an event sends type, groups and total photo limit`.
  - `the event form hides the moment section`.
  - `creating an event does not offer to add friends`.
- [ ] FAIL → implementar → PASS → commit `"Eventos: crear un evento con grupos y portada"`.

### Task M8: Versión 1.4, CLAUDE.md y PR

- [ ] Subir `version` en `app.json` a `1.4.0`, porque la app nueva ya va con `rolloproject.com` y otros cambios nativos.
- [ ] Sumar la sección "Eventos" en `CLAUDE.md` (claves de SecureStore nuevas: `rollo.pendingJoin` y `rollo.lastGroups.<tripId>`).
- [ ] `npm run typecheck` limpio y tests de lo tocado en verde. Push y PR a `develop`.

---

## Sitio (`rollo-app/web`, worktree `web/.claude/worktrees/evento`)

### Task W1: Página `/join/<código>` y AASA

**Files:** primero mirá cómo están hechas `/friends` y `/login` en ese repo y seguí el mismo patrón. Modificá `.well-known/apple-app-site-association` para sumar `"/join/*"` a los `paths` o `components`.

Comportamiento:
- La página lee el código del path y llama a `GET https://api.rolloproject.com/events/{code}`.
- Con datos, muestra la portada, el nombre, "Abrí Rollo para elegir tu grupo", el botón "Abrir Rollo" (`rollo://join/<CODE>`), el badge de la App Store y el código grande con "Si recién la instalaste, entrá con este código en Unirme".
- Si da 404, muestra "Este código no es de un evento" y el link a la App Store.
- Sin JS, igual se ven el código y el link a la App Store.

- [ ] Test del patrón del repo, o build + revisión a mano con `npm run build`. Commit, push y PR. Ojo: Vercel publica `main`, así que hace falta un PR de release `develop` → `main` antes de la prueba con amigos.

## Panel (`front-admin`, worktree `front-admin/.claude/worktrees/evento`)

### Task A1: Tipo y grupos en el detalle del rollo

**Files:** `src/lib/types.ts` (`AdminTripDetail.type`, `groups`), `src/app/(panel)/rollos/[id]/page.tsx` (agregar "Tipo" en Datos y una tabla "Grupos" con Nombre, Personas y Fotos solo si es evento), y su test.

- [ ] Test que renderiza un evento con dos grupos y ve las cantidades → FAIL → implementar → PASS → commit, push y PR.

---

## Orden y cierre

1. B1 → B2 → B3 → B4 → B5 → B6. Son secuenciales porque comparten la migración y el contrato.
2. M1 → M2…M7. M2 a M7 tocan archivos casi siempre distintos, pero se hacen de a una para no pisarse `actions.ts` ni `routes.ts`. Después, M8.
3. W1 y A1 se pueden hacer en paralelo con la app, una vez que B2 y B6 estén en la rama del backend.
4. Prueba en el iPhone contra el backend local con el evento del seed: unirse por código, mandar a dos grupos, ver desde otro invitado y desde el organizador, revelar y filtrar.
5. PRs de los cuatro repos. Al mergear: migración `0039` → backend → sitio a `main` → build 1.4 de EAS → revisión de Apple, a más tardar el 5/12.
6. Antes de mandar a revisión:
   - Crear en producción, con la cuenta de revisión (`REVIEW_EMAIL`), un evento de prueba con dos grupos, y poner su código en las notas para el revisor de App Store Connect.
   - Verificar que `https://rolloproject.com/.well-known/apple-app-site-association` incluya `/join/*`.
7. Fuera de este plan, pero antes del 12/12: decidir los registros (abrirlos esa semana o hacer una excepción para eventos).

---

## Estado al cerrar la implementación (12/11/2026)

Implementado y revisado en `feature/event-mode` en los cuatro repos (sin push). Backend `49583c2..bdef500`, app `d6e4044..b5ba973`, sitio `6f67184..cf0efff`, panel `e875a32..e829770`.

### Decisiones tomadas durante la implementación
- Los eventos guardan la ubicación como cualquier rollo; solo se oculta el mapa (Juani).
- Después del revelado no se cambian grupos, portada ni se muestra el QR.
- El autor siempre ve sus propias fotos mientras sea miembro activo.
- Destacadas en perfiles siguen como en cualquier rollo.
- Un evento no admite momento del día ni cupo diario, tampoco al editarlo.
- No se puede sacar el rol a un organizador sin grupos, ni borrar el último grupo.
- La portada pública se publica sin EXIF; barrido de portadas huérfanas una vez por hora en eventos recientes.
- Vista previa pública: 300/min por IP, bloqueo de 1 min tras ~20 códigos inexistentes, CORS solo para rolloproject.com.
- `/join` sin analytics; sin JavaScript no muestra el código.
- La 1.4 tolera el caché guardado por la 1.3 (sin vaciarlo).

### Pruebas en el iPhone pendientes (no se cubren con Jest)
1. Actualizar 1.3 → 1.4 con caché guardado y fotos en la cola.
2. Universal Link en el build de producción, en frío y en caliente, incluido "Cancelar" en frío.
3. Cuenta nueva por link: login, perfil, intro y después grupos.
4. Sin la app: página del sitio, App Store, código en "Unirme".
5. "Abrir Rollo" (`rollo://join/<CÓDIGO>`) desde Safari.
6. AASA en `main` con `/join/*`.
7. Chips de grupos en la captura (2, 5 y 30 grupos, con teclado), últimos grupos recordados, ubicación guardada, foto offline que sube con sus grupos.
8. Tab Feed: ícono, título, se oculta al revelar y estar ahí al revelar lleva a Rollo.
9. Menú "Grupos" y "Solo <grupo>" en la galería.
10. QR nítido en claro y oscuro, escanea en pantalla y desde el PNG impreso, la hoja de compartir funciona.
11. Portada desde la galería (HEIC, vertical) derecha en todos lados.
12. Crear: "Rollo | Evento", borrar grupo deslizando, borrar una fila del medio conserva las otras, la portada se sube después de crear.
13. Agregar y renombrar grupos; el 409 inline al borrar uno con gente.
14. Pushes de un evento abren la pestaña correcta; sin avisos de momento del día.

### Antes del 12/12 (fuera de este plan)
- Registros: topes de mails (20/IP/día, 40 cuentas nuevas/día, Resend 100/día) no alcanzan para ~150 invitados. Decidir: subir topes para el evento o empujar Google/Apple.
- Costo de D1 a escala casamiento: medir o confirmar Workers Paid.
- Confirmar en Cloudflare que los namespaces de rate limit 1008 y 1009 no estén usados.
- Orden de deploy: migración 0039 → backend → panel → sitio a `main` → build 1.4 → revisión de Apple (a más tardar 5/12). No volver el Worker a una versión previa a eventos sin desactivarlos.
