# Concurso de fotos en eventos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Descripción del evento + concurso de fotos opcional (finalistas elegidas por los organizadores, votación tras el revelado, anuncio de ganadora) en backend, app y sitio, antes del 12/12/2026.

**Architecture:** Backend: migración `0041`, módulo nuevo `src/modules/contest/` (router/controller/service/repository/schemas) más cambios chicos en `trips` (config, revelado), `media` (vista previa de organizadores) y el cron. App: feature nueva `src/features/contest/` (selección, votación, resultado) más campos en el formulario de evento y el hero. Sitio: la descripción en `/join`.

**Tech Stack:** Cloudflare Workers + Hono zod-openapi + D1 + vitest (backend); Expo SDK 58 + Expo Router + TanStack Query + jest (app); build estático en `web/scripts/build-site.mjs`.

**Spec:** `mobile/docs/superpowers/specs/2026-11-24-concurso-de-fotos-design.md` (aprobado). Leerlo entero antes de cada tarea.

## Global Constraints

- Ramas: `feature/concurso-fotos` desde `develop` en `backend` y en `mobile` (mismo nombre: el job `contract` de la app compara contra esa rama); en `web`, desde `feature/event-mode`. Sin push directo; PR por repo.
- TDD: test primero, verlo fallar. Tests solo de lo tocado, siempre `--maxWorkers=2` (`npx vitest run test/<f>.test.ts --maxWorkers=2`; `npx jest <ruta> --maxWorkers=2`).
- Código, comentarios, nombres de tests y textos del OpenAPI en inglés; mensajes al usuario, commits y PRs en español rioplatense.
- Arquitectura por capas del backend (router → controller → service → repository; escrituras como `D1PreparedStatement`, atómicas con `db.batch`; errores con `badRequest/forbidden/notFound/conflict` de `src/shared/errors.ts`; push vía `notify: AfterResponse`).
- Cada tarea que toca la API corre `npm run openapi` y commitea `openapi.json`; la app corre `API_SPEC=../backend/openapi.json npm run api:generate` y commitea `src/api/schema.d.ts`.
- Organizador = miembro activo con `role = 'admin'`. Solo eventos (`trips.type = 'event'`).
- Valores fijos: descripción ≤ 300 caracteres y ≤ 6 renglones (trim, vacía → `null`, `\r\n` = un salto); `contestVotingHours` 24–336, default 72; finalistas 2–10; `reveal_at >= ends_at + 2 h` con concurso; recordatorio 2 h antes de `reveal_at`; recordatorio de empate cada 24 h.
- Textos al usuario (exactos): "Elegí al menos 2 fotos para el concurso o apagalo." · "Con concurso, el revelado tiene que ser al menos 2 horas después del fin, para que elijas las finalistas." · "Ya podés elegir las finalistas" · "Hay un empate en el concurso: elegí la ganadora" · "¡Ya podés votar la mejor foto!" · "Ganó la foto de {autor} 🏆" · "¡Tu foto ganó el concurso de {evento}!" · "Este evento no tiene concurso." · "Ya hay 10 finalistas." · "No podés votar tu propia foto."
- Builds viejos de la app no tienen que romperse: todo campo nuevo de respuesta es aditivo.
- `event-visibility.ts` NO cambia: las finalistas se sirven por rutas propias del concurso.

## Review Focus

1. **Revelado automático (`now >= reveal_at`, sin `revealed_at`)**: `closesAt` usa `COALESCE(revealed_at, reveal_at)`; la votación se abre igual que con revelado manual. Test en Task 6.
2. **Invitado que pide archivos de una finalista de otro grupo por la ruta normal** `/trips/{id}/media/{id}/display` → sigue 404/403; solo la ruta del concurso la sirve. Test en Task 5.
3. **Invitado (no organizador) antes del revelado** pide `GET /contest` o el feed entre `ends_at` y el revelado → no ve archivos ni finalistas. Tests en Tasks 3 y 4.
4. **Dos crons a la vez cerrando el mismo concurso** → un solo anuncio (reclamo con `UPDATE ... WHERE contest_closed_at IS NULL`). Test en Task 6.
5. **Empate con 0 votos** (nadie votó) → `tied`, no `closed` con una ganadora arbitraria. Test en Task 6.

---

## Backend (`/Users/juanifraga/Desktop/Rollo/backend`)

### Task 1: Migración y descripción del evento

**Files:**
- Create: `migrations/0041_event_contest.sql`
- Modify: `src/db/schema.ts` (columnas de `trips`, tablas `contestFinalists`, `contestVotes`), `src/types.ts` (`TripRow`), `src/modules/trips/trips.schemas.ts` (`CreateTripSchema`, `UpdateTripSchema`), `src/modules/trips/trips.service.ts` (`createTrip`, `updateTrip`), `src/modules/trips/trips.repository.ts`, `src/lib/util.ts` (`publicTrip`), `src/schemas.ts` (`TripSchema`), `src/modules/events/events.router.ts` (+ su service/schemas: vista previa)
- Test: `test/event-description.test.ts`

**Interfaces:**
- Produces: columnas `trips.description TEXT`, `contest_enabled INTEGER NOT NULL DEFAULT 0`, `contest_voting_hours INTEGER NOT NULL DEFAULT 72`, `contest_select_notified_at`, `contest_reminder_notified_at`, `contest_cancelled_at`, `contest_tie_notified_at`, `contest_closed_at` (INTEGER NULL), `contest_winner_media_id TEXT NULL` (sin FK); tablas `contest_finalists (trip_id → trips CASCADE, media_id → media CASCADE, position INTEGER, created_at, PK(trip_id, media_id))` y `contest_votes (trip_id → trips CASCADE, user_id → users CASCADE, media_id → media CASCADE, created_at, updated_at, PK(trip_id, user_id))` + `CREATE INDEX idx_contest_votes_media ON contest_votes (trip_id, media_id)`. `Trip.description: string | null` en la API y en `GET /events/{code}`. Helper `normalizeDescription(raw: string): string | null` en `src/lib/description.ts` (tira 400 si pasa 300 o 6 renglones).

- [ ] **Step 1: Tests que fallan** en `test/event-description.test.ts`: `creates an event with a description` (`POST /trips` `{ type: "event", description: "  Premio a la mejor foto  " }` → `trip.description === "Premio a la mejor foto"`); `empty description becomes null`; `rejects 301 characters` (400); `rejects 7 lines` (400); `edits the description after the event ended and after reveal` (`PATCH` → 200); `a regular trip accepts a description too` → decisión: sí, se guarda (es inofensivo); `public event preview includes description` (`GET /events/{code}` → `description`).
- [ ] **Step 2:** `npx vitest run test/event-description.test.ts --maxWorkers=2` → FAIL.
- [ ] **Step 3:** Migración + `schema.ts` (correr `npm run db:check-schema`), `normalizeDescription`, campo en create/update/`publicTrip`/preview. En `updateTrip`, `description` se suma a lo que se puede cambiar en cualquier etapa (como `name`).
- [ ] **Step 4:** Test → PASS; `npm run typecheck`; `npx vitest run test/events.test.ts test/openapi.test.ts --maxWorkers=2` tras `npm run openapi`.
- [ ] **Step 5: Commit** `Eventos: descripción en la portada`.

### Task 2: Configuración del concurso

**Files:**
- Modify: `trips.schemas.ts`, `trips.service.ts` (`createTrip`, `updateTrip`), `trips.repository.ts`, `src/lib/util.ts` (`publicTrip`), `src/schemas.ts`
- Test: `test/contest-config.test.ts`

**Interfaces:**
- Produces: request `contestEnabled?: boolean`, `contestVotingHours?: number` (int 24–336) en create y update; respuesta `Trip.contest: { enabled: boolean; votingHours: number } | null` (`null` en un `trip`). Constante `CONTEST_MIN_REVEAL_GAP_MS = 2 * 3_600_000` en `src/modules/contest/contest.rules.ts` (archivo nuevo, puro, lo usan Tasks 2–6).

- [ ] **Step 1: Tests:** `contest is off by default`; `creates an event with the contest on and 5 voting days` (`contestVotingHours: 120`); `rejects contest in a regular trip` (400); `rejects reveal closer than 2 hours to the end with the contest on` (create y PATCH, 409 con el texto exacto); `turning the contest on via PATCH checks the gap against the stored dates`; `voting hours out of range` (23 y 337 → 400); `contest settings frozen after reveal` (409 "Este evento ya se reveló."); `turning the contest off deletes chosen finalists` (sembrar una fila en `contest_finalists` por SQL); `editing contest settings after ends_at but before reveal is allowed` (excepción a "terminado: solo el nombre").
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar. La regla de etapa de `updateTrip` deja pasar `description`, `contestEnabled` y `contestVotingHours` después del fin mientras no esté revelado; mover `revealAt` sigue sus reglas actuales más el gap de 2 h si el concurso queda prendido.
- [ ] **Step 4:** PASS + `npm run openapi` + `test/openapi.test.ts`.
- [ ] **Step 5: Commit** `Concurso: prenderlo y elegir la ventana de votación`.

### Task 3: Vista previa de los organizadores

**Files:**
- Modify: `src/modules/media/media.service.ts` (`listFeed…` en ~L268 y `getDownloadKey` en ~L301), `src/modules/media/media.controller.ts`
- Create: `src/modules/contest/contest.rules.ts` → `organizerPreviewOpen(trip, member, now): boolean`
- Test: `test/contest-preview.test.ts`

**Interfaces:**
- Produces: `organizerPreviewOpen(trip: TripRow, member: { role: string }, now: number): boolean` = evento ∧ `contest_enabled` ∧ `role === 'admin'` ∧ `now >= ends_at` ∧ `!isRevealed(trip, now)`. Con eso, el feed del organizador trae `files`/`width`/`height`/`originalAvailable` en todas las fotos (como revelado, sin `likeCount` etc.) y las descargas `thumb`/`display`/`original` dejan de dar 403.

- [ ] **Step 1: Tests:** `organizer sees files after ends_at with the contest on`; `organizer sees nothing before ends_at`; `organizer sees nothing with the contest off`; `guest sees nothing between ends_at and reveal` (feed sin `files`, descarga 403); `organizer can download display of a photo from any group in that window`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** En el service, `const filesVisible = revealed || organizerPreviewOpen(...)` donde hoy decide `revealed`; el controller usa `filesVisible` para exponer archivos y sigue usando `revealed` para los campos sociales.
- [ ] **Step 4:** PASS; correr también `test/media.test.ts test/moment-feed.test.ts --maxWorkers=2`.
- [ ] **Step 5: Commit** `Concurso: los organizadores ven las fotos antes del revelado`.

### Task 4: Finalistas y estado del concurso

**Files:**
- Create: `src/modules/contest/contest.{router,controller,service,repository,schemas}.ts`; montar en `src/index.ts` bajo `/trips` (rutas `/{tripId}/contest…`, middleware de membresía como `trips.router`)
- Test: `test/contest-finalists.test.ts`

**Interfaces:**
- Produces:
  - `PUT /trips/{tripId}/contest/finalists/{mediaId}` y `DELETE` (204, organizadores, solo con `organizerPreviewOpen`; si no, 409 "Las finalistas se eligen entre el fin del evento y el revelado."). Validaciones: foto (no video), `status = 'uploaded'`, no borrada, sin `paired_media_id`, del evento (si no, 400); 11.ª → 409 "Ya hay 10 finalistas."; idempotentes.
  - `GET /trips/{tripId}/contest` → `ContestSchema`:
    `{ status: "pending"|"selecting"|"voting"|"tied"|"closed"|"cancelled", votingHours: number, closesAt: number|null, finalists: Finalist[], myVote: string|null, winner: { mediaId: string, author: Author, imageAvailable: boolean } | null, tiedMediaIds: string[] }`
    con `Finalist = { mediaId, author: { userId, name, avatarUrl }, thumbHash, width, height, thumbPath, displayPath, votes: number | null }`. 404 "Este evento no tiene concurso." si está apagado o es un `trip`.
  - `contest.repository.validFinalists(db, tripId, viewerUserId)`: finalistas cuya foto no está borrada ni archivada, autor activo en el evento, y sin bloqueo/denuncia con el viewer (usar `hiddenMediaSql` de `reports.repository` e `isBlockedEitherWay`-equivalente en SQL). Es la única fuente de "qué finalistas cuentan" para GET, votar y cerrar.
  - `contestStatus(trip, now): Status` puro en `contest.rules.ts`: `cancelled` si `contest_cancelled_at`; `closed` si `contest_closed_at`; `pending` si `now < ends_at`; `selecting` si no revelado; `voting` si `now < closesAt`; si no, `tied` (el cron todavía no cerró o hay empate).
  - Paths: `thumbPath`/`displayPath` = `/trips/{tripId}/contest/finalists/{mediaId}/{thumb|display}` (Task 5).
- Reglas de visibilidad del GET: un invitado antes del revelado recibe `finalists: []`; `votes` es `null` salvo en `closed`; `myVote` es `null` si su voto apunta a una finalista que ya no es válida.

- [ ] **Step 1: Tests:** marcar/desmarcar; 11.ª → 409; video → 400; selfie vinculada → 400; antes de `ends_at` → 409; invitado → 403; `GET` por etapa (`pending`, `selecting`, `voting`); invitado en `selecting` ve `finalists: []`; finalista archivada por su autor no aparece; autor que se salió → no aparece; `votes` es `null` en `voting`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar con la forma por capas del repo (modelo: `src/modules/media/`).
- [ ] **Step 4:** PASS; `npm run openapi`; `test/openapi.test.ts`.
- [ ] **Step 5: Commit** `Concurso: finalistas y estado`.

### Task 5: Votar y archivos de finalistas

**Files:**
- Modify: `src/modules/contest/*`; `src/lib/rate-limit.ts` (sumar la ruta de archivos del concurso a `FILE_DOWNLOAD`, para que cuente en `RL_FILES` y no en `RL_GLOBAL`)
- Test: `test/contest-vote.test.ts`

**Interfaces:**
- Produces: `PUT /trips/{tripId}/contest/vote` `{ mediaId }` → 204 (upsert en `contest_votes`; `RL_EXPENSIVE`); `DELETE /trips/{tripId}/contest/vote` → 204 siempre. `GET /trips/{tripId}/contest/finalists/{mediaId}/{variant}` (`thumb|display`) → sirve con `serveMediaFile` (display con respaldo al original, como `resolveVariantKey`) a cualquier miembro activo si la foto está en `validFinalists` para él y el estado es `voting`, `tied` o `closed`; organizadores también en `selecting`.
- Errores: no `voting` → 409 "La votación no está abierta."; foto no finalista válida → 404; propia → 400 "No podés votar tu propia foto."

- [ ] **Step 1: Tests:** votar y cambiar el voto (una fila); `myVote` refleja el voto; votar la propia → 400; votar antes del revelado o después de `closesAt` → 409; un invitado de otro grupo baja el `display` de una finalista por la ruta del concurso (200) **y** la misma foto por `/trips/{id}/media/{id}/display` sigue fallando como hoy; foto no finalista por la ruta del concurso → 404; bloqueado con el autor → 404 al votar y al bajar; revelado automático (`reveal_at` en el pasado, `revealed_at` null) abre la votación.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS + `npm run openapi`.
- [ ] **Step 5: Commit** `Concurso: votar y ver las finalistas`.

### Task 6: Revelado, cierre, empate y avisos

**Files:**
- Modify: `src/lib/settings.ts` (`contestResult: "notify_contest_result"`), nueva migración `0042_notify_contest_result.sql` (`ALTER TABLE user_settings ADD COLUMN notify_contest_result INTEGER NOT NULL DEFAULT 1`), `src/schemas.ts` (settings), `src/modules/trips/trips.service.ts` (`revealTrip`: 409 si concurso prendido y `validFinalists < 2` o `now < ends_at`), `src/modules/trips/notices.service.ts` (`tripRevealedMessage` suma "¡Ya podés votar la mejor foto!" con concurso válido), `src/modules/contest/contest.service.ts` (`runContestNotices(env, now)`), `src/index.ts` (sumarlo al `Promise.allSettled` del cron), `src/modules/contest/contest.router.ts` (`POST /trips/{tripId}/contest/winner`)
- Test: `test/contest-close.test.ts`

**Interfaces:**
- Produces: `runContestNotices(env: Pick<Env, "DB">, now: number): Promise<void>` que, por evento con concurso (acotado, p. ej. 50 por pasada, idempotente con reclamos `UPDATE ... WHERE col IS NULL`):
  1. `now >= ends_at` y `contest_select_notified_at IS NULL` y no revelado → push a organizadores "Ya podés elegir las finalistas", url `/contest-picks?trip=<id>`.
  2. `now >= reveal_at - 2h`, no revelado, `< 2` finalistas válidas, `contest_reminder_notified_at IS NULL` → recordatorio a organizadores.
  3. Revelado (manual o automático) con `< 2` finalistas válidas y sin `contest_cancelled_at` → setear `contest_cancelled_at` y avisar a organizadores "El concurso se canceló: no había finalistas."
  4. `now >= closesAt` y `contest_closed_at IS NULL`: contar votos solo sobre `validFinalists`; un máximo único → reclamo `UPDATE trips SET contest_closed_at=?, contest_winner_media_id=? WHERE id=? AND contest_closed_at IS NULL` y, si `changes > 0`, push a todos menos el autor "Ganó la foto de {autor} 🏆" y al autor "¡Tu foto ganó el concurso de {evento}!" (url `/contest?trip=<id>`); 0 finalistas válidas → `cancelled`; empate (incluye todos en 0) → si `contest_tie_notified_at` es null o tiene ≥ 24 h, push a organizadores "Hay un empate en el concurso: elegí la ganadora" y actualizar `contest_tie_notified_at`.
  - `POST /trips/{tripId}/contest/winner` `{ mediaId }` (organizador; estado `tied`; `mediaId` entre los empatados, si no 400) → mismo reclamo y mismos push vía `notify`.
- Todos los push con `sendPush(env, ids, "contestResult", msg, { actorId })`.

- [ ] **Step 1: Tests (con `mockExpo()` y `flushPendingPushes()`):** revelado manual con 1 finalista → 409 texto exacto; revelado manual antes de `ends_at` con concurso → 409; push de revelado suma el texto del concurso; cron: aviso de selección una vez; recordatorio una vez; revelado automático sin finalistas → `cancelled` + aviso; cierre con ganadora única → `closed`, `winner`, `votes` visibles, push al autor distinto del resto; dos `runContestNotices` en paralelo → un solo push; empate 0–0 → `tied`, aviso a organizadores, no se repite antes de 24 h y sí después; `POST winner` cierra y anuncia; `POST winner` con una no empatada → 400; ganadora borrada después del cierre → `winner.imageAvailable: false`; preferencia `contestResult` apagada → no le llega.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS + `test/notifications.test.ts test/push-events.test.ts --maxWorkers=2` + `npm run openapi`.
- [ ] **Step 5:** Seed: "Casamiento de prueba" con `contestEnabled: true` (en `scripts/seed/scenarios.ts`). **Commit** `Concurso: revelado, cierre y anuncio de la ganadora`.
- [ ] **Step 6:** Documentar en `backend/CLAUDE.md` (sección Eventos: "Concurso de fotos") y abrir PR a `develop`. Deploy: `0041` y `0042` con `npm run db:migrate:remote` **antes** de `npm run deploy`.

---

## App (`/Users/juanifraga/Desktop/Rollo/mobile`)

Antes de la primera tarea: `API_SPEC=../backend/openapi.json npm run api:generate` con la rama del backend al día (repetir cuando cambie).

### Task 7: Descripción y configuración del concurso en crear/editar evento

**Files:**
- Modify: `src/features/trips/create-screen.tsx`, `trip-form.tsx`, `create-form.ts`, `edit-form.ts`, `edit-screen.tsx`, `src/features/events/event-hero.tsx`, `src/features/info/topics.ts`
- Test: `src/features/trips/__tests__/create-event.test.tsx`, `src/features/trips/__tests__/edit-form.test.ts`, `src/features/events/__tests__/event-hero.test.tsx`

**Interfaces:**
- Produces: en `create-form.ts`: `MAX_DESCRIPTION = 300`, `MAX_DESCRIPTION_LINES = 6`, `DEFAULT_VOTING_DAYS = 3`, `contestRevealDefault(end: number): number` (= fin + 1 día) y `revealAllowedWithContest(reveal: number, end: number): boolean` (≥ fin + 2 h). `TripSettings` (edit-form) suma `description`, `contestEnabled`, `contestVotingDays`; `changedFields` manda `contestVotingHours = días × 24`.
- UI: en "Rollo | Evento", campo "Descripción" (multilínea) y sección "Concurso de fotos": switch apagado por defecto; prendido muestra "Votación de N días" (stepper 1–14) y, si el revelado era "Al terminar", lo pasa a "Otro momento" con `contestRevealDefault`. Info topic `contest` ("Concurso de fotos": cómo funciona en 2–4 frases). Editar evento: la descripción se edita siempre (también terminado o revelado); el concurso hasta el revelado. Hero: descripción debajo del nombre, `numberOfLines={3}` con "Ver más" que expande.

- [ ] **Step 1: Tests:** crear evento manda `description` y `contestEnabled: false` por defecto; prender el concurso manda `contestEnabled: true, contestVotingHours: 72` y mueve el revelado; `changedFields` con días → horas; hero muestra la descripción y no deja hueco si es `null`.
- [ ] **Step 2:** FAIL (`npx jest src/features/trips src/features/events --maxWorkers=2`). **Step 3:** implementar. **Step 4:** PASS + `npm run typecheck`.
- [ ] **Step 5: Commit** `Eventos: descripción y concurso al crear y editar`.

### Task 8: Selección de finalistas (organizadores)

**Files:**
- Create: `src/features/contest/{actions.ts, use-contest.ts, use-toggle-finalist.ts, picks-screen.tsx, contest-state.ts}`, `app/contest-picks.tsx`; registrar en `app/_layout.tsx` (push en el stack raíz, título "Elegí las finalistas") y `src/test/routes.ts`
- Modify: `src/features/roll/roll-board.tsx` (fila "Elegí las finalistas · N de 10" para organizadores cuando `contest.enabled`, terminado y sin revelar)
- Test: `src/features/contest/__tests__/contest-state.test.ts`, `__tests__/contest-picks.test.tsx`

**Interfaces:**
- Consumes: `GET /trips/{id}/contest`, `PUT/DELETE …/finalists/{mediaId}`, el feed (Task 3) con `files` para el organizador.
- Produces: `useContest(tripId)` (query key `["contest", tripId]`, se persiste), `useToggleFinalist(tripId)` optimista sobre esa key. `contest-state.ts`: `canPick(contest, isOrganizer)`, `pickCountLabel(n)` → "4 de 10".
- Pantalla: grilla FlashList (reusar la celda/grilla de `gallery` vía su API pública) con todas las fotos del feed, filtro "Grupos" como la galería del organizador, check en las marcadas, contador arriba; 11.ª → muestra el error del server inline.

- [ ] **Step 1: Tests:** la fila aparece solo para organizadores en esa ventana; tocar marca y desmarca (llama a las actions); con 10 el error del server se muestra.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** `Concurso: elegir las finalistas`.

### Task 9: Votación, empate y resultado

**Files:**
- Create: `src/features/contest/{contest-screen.tsx, contest-card.tsx, use-vote.ts, use-pick-winner.ts}`, `app/contest.tsx` (+ `_layout.tsx`, `routes.ts`)
- Modify: `src/features/roll/revealed-roll-screen.tsx` (o la Galería: tarjeta arriba en el segmento Rollo y en la Galería) para mostrar `ContestCard`
- Test: `src/features/contest/__tests__/contest-screen.test.tsx`, `contest-state.test.ts`

**Interfaces:**
- Produces: `contest-state.ts` suma `countdownLabel(closesAt, now)` ("Cierra en 2 días" / "Cierra en 5 h" / "Cierra en 12 min"), `shuffledFinalists(finalists, seed: string)` (orden estable por usuario: seed = userId) y `cardCopy(contest)` por estado.
- Pantalla `/contest?trip=`: finalistas en orden barajado, tocar abre en grande (display con token, `expo-image`), botón "Votar esta" / "Tu voto ✓" (deshabilitado en las propias, `accessibilityHint` "No podés votar tu propia foto"); `tied` para organizadores: "Elegir ganadora" en las empatadas con `Alert` de confirmación; `closed`: ganadora arriba con autor y votos por finalista; `cancelled`: "El concurso se canceló." Tarjeta: `voting` → "Concurso de fotos · Cierra en …"; `closed` → miniatura de la ganadora + "Ganó la foto de {autor}".

- [ ] **Step 1: Tests:** votar llama a la action y marca "Tu voto"; la propia no se puede votar; organizador ve "Elegir ganadora" en `tied` y un invitado no; `closed` muestra votos; `countdownLabel` y `shuffledFinalists` (misma seed, mismo orden).
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** `Concurso: votar y ver la ganadora`.

### Task 10: Revelar con concurso, push y ajuste de notificación

**Files:**
- Modify: el flujo de "Revelar" del tablero (buscar `reveal` en `src/features/roll/`), `src/features/notifications/settings-screen.tsx` (switch "Concurso de fotos" → `contestResult`), `src/features/notifications/notification-target.ts` (rutas `/contest` y `/contest-picks` con `trip` → activan el rollo)
- Test: tests existentes de esos archivos + uno nuevo por regla

- [ ] **Step 1: Tests:** con concurso y < 2 finalistas, "Revelar" muestra el 409 del server inline (sin cerrar nada); el switch manda `contestResult`; tocar push `/contest?trip=X` deja X activo y abre la pantalla.
- [ ] **Step 2–4:** FAIL → implementar → PASS + `npm run typecheck`.
- [ ] **Step 5: Commit** `Concurso: revelar, avisos y ajustes`. Documentar en `mobile/CLAUDE.md` (bloque Eventos) y abrir PR a `develop`. Build nuevo de EAS (hay columnas/rutas nuevas pero sin nativo: igual sale con el build del 12/12).

---

## Sitio (`/Users/juanifraga/Desktop/Rollo/web`, rama desde `feature/event-mode`)

### Task 11: Descripción en `/join/<código>`

**Files:**
- Modify: el script de la página `/join` en `scripts/site/` (el que llama a `GET /events/{code}`), test en `scripts/__tests__/`

- [ ] **Step 1:** Test: con `description` la página la muestra debajo del nombre como texto (nunca `innerHTML`); sin ella no queda hueco.
- [ ] **Step 2–4:** FAIL → implementar → PASS (`npx vitest run scripts/__tests__ --maxWorkers=2`).
- [ ] **Step 5: Commit** `Join: muestra la descripción del evento`.

---

## Orden y paralelismo

Backend 1 → 2 → 3 → 4 → 5 → 6 en orden (comparten archivos). La app arranca Task 7 apenas está Task 2 en la rama del backend; 8 tras Task 4; 9 tras Task 5; 10 tras Task 6. Web 11 tras Task 1, en paralelo con todo.
