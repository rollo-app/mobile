# Momento del día — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un aviso por día a una hora random por persona, que suena sin señal, para sacar una foto extra (con selfie opcional) en 5 minutos, con la hora sorteada y registrada en el backend.

**Architecture:** El backend sortea y guarda cada momento en `trip_moments` cuando la app pide los suyos (`GET /trips/{tripId}/moments`). La app los programa como notificaciones locales de `expo-notifications` y nunca guarda la hora en otro lado. La foto del momento entra a la cola offline con `momentDay` (y la selfie con `pairedWith`), no descuenta cupo, y en el revelado se muestra con badge o recuadro de selfie.

**Tech Stack:** Backend: Cloudflare Workers, Hono + `@hono/zod-openapi`, D1 + Drizzle, vitest. App: Expo SDK 58, Expo Router, TanStack Query, `expo-notifications`, `expo-camera` (nuevo, nativo), `expo-sqlite`, Jest + `expo-router/testing-library`.

**Spec:** `docs/superpowers/specs/2026-10-25-momento-diario-design.md`, sección 1.

## Antes de empezar

- **Depende del worker "captura y cupo"** (pantalla de caption difuminada sin "Repetir", sin videos, cupo diario o total, rama
  `feature/captura-y-cupo` en los dos repos). Las ramas de este plan salen de la **rama de integración** del próximo build, con
  eso ya adentro, no de `develop` pelado.
- Dos repos: backend `rollo-app/backend` (tareas B*) y app `rollo-app/mobile` (tareas A*). Primero todas las B*; después
  `npm run openapi` en el backend y `API_SPEC=<ruta al openapi.json del backend> npm run api:generate` en la app.
- Leer los dos `CLAUDE.md`. Backend: módulos en capas (`router` → `controller` → `service` → `repository`), migraciones SQL
  como fuente de verdad y `src/db/schema.ts` alineado (`npm run db:check-schema`). App: `app/` solo rutea, `useMutation`,
  TDD, código en inglés y UI en rioplatense.

## Global Constraints

- Ventana para sacarla: **5 minutos** desde `notifyAt` (`MOMENT_WINDOW_MS = 5 * 60_000`).
- Franja por defecto: **540 a 1380** minutos desde medianoche (9:00 a 23:00) en `trip.timezone`.
- Día sin momento si la ventana del día dura **menos de 30 minutos** (`MIN_DAY_WINDOW_MS = 30 * 60_000`).
- La app baja momentos desde **3 días antes de `startsAt`** hasta `endsAt`, y programa como mucho **40** avisos en total.
- `momentMode`: `"off" | "photo" | "photo_selfie"`. En el backend el default es `"off"` (rollos viejos y build viejo); la app nueva
  manda `"photo_selfie"` por defecto.
- Selfie a **1080 px** de lado mayor; foto principal con el mismo procesamiento que las demás.
- La hora de un momento futuro **nunca** se muestra, ni se guarda en el cache de TanStack Query ni en SecureStore. Solo vive en
  el planificador de notificaciones del sistema.
- Cambios del backend **aditivos**: el build viejo de TestFlight (que no conoce momentos) sigue andando igual.
- Textos (exactos):
  - Aviso: título `"Es tu momento"`, cuerpo `"Tenés 5 minutos para sacar tu foto de {rollo}."`
  - Banner en Rollo: `"Tu momento · quedan {m:ss}"`
  - Tarde: título `"Se pasó tu momento de hoy"`, cuerpo `"Mañana te toca otro."`
  - Crear rollo: sección `"Momento del día"`, opciones `"Apagado"`, `"Solo foto"`, `"Foto + selfie"`; campos `"Desde"` y `"Hasta"`.
  - Ajustes → Notificaciones: switch `"Momento del día"`. Desarrollo: fila `"Probar momento ahora"`.

## Review Focus

1. **Celular en otra zona horaria que el rollo:** el aviso suena en el instante UTC sorteado y `momentDay` es el del rollo
   (test en A3 y A5).
2. **Cerrar sesión y entrar con otra cuenta:** no queda ningún aviso de momento de la cuenta anterior (test en A3).
3. **La foto del momento llega días después, fuera de la ventana:** se acepta, `in_window = 0`, no descuenta cupo (test en B6).
4. **La principal falla para siempre:** la selfie no se sube sola y se descarta con ella (test en A4).
5. **Rollo que arranca a las 22:45 o termina a las 9:10:** ese día no hay momento (test en B2).

---

## Backend (`rollo-app/backend`)

### Task B1: Migración y esquema

**Files:**
- Create: `migrations/00NN_daily_moment.sql` (NN = el siguiente libre en la rama de integración)
- Modify: `src/db/schema.ts`
- Test: `test/schema.test.ts` (o el que ya cubra `db:check-schema`)

**Interfaces:**
- Produces: tabla `trip_moments(trip_id TEXT, user_id TEXT, day TEXT, notify_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
  media_id TEXT NULL, selfie_media_id TEXT NULL, taken_at INTEGER NULL, in_window INTEGER NULL, PRIMARY KEY (trip_id, user_id, day))`,
  FKs a `trips` y `users` con `ON DELETE CASCADE`; `trips.moment_mode TEXT NOT NULL DEFAULT 'off'`,
  `trips.moment_window_start INTEGER NOT NULL DEFAULT 540`, `trips.moment_window_end INTEGER NOT NULL DEFAULT 1380`;
  `user_settings.notify_daily_moment INTEGER NOT NULL DEFAULT 1`; `media.moment_day TEXT NULL`, `media.paired_media_id TEXT NULL`.

- [ ] **Step 1:** Escribir la migración y las tablas/columnas en `src/db/schema.ts` (camelCase en TS).
- [ ] **Step 2:** `npm run db:check-schema` → sin diferencias. `npm test` → todo en verde (las migraciones se aplican solas).
- [ ] **Step 3:** Commit `"Momento del día: migración y esquema"`.

### Task B2: Sorteo puro

**Files:**
- Create: `src/lib/moments.ts`
- Test: `test/moments.test.ts`

**Interfaces:**
- Produces:
  - `MOMENT_WINDOW_MS = 300_000`, `MIN_DAY_WINDOW_MS = 1_800_000`
  - `type MomentTrip = { starts_at: number; ends_at: number; timezone: string; moment_window_start: number; moment_window_end: number }`
  - `tripDays(trip: MomentTrip): string[]` — fechas locales `YYYY-MM-DD` de `starts_at` a `ends_at`, inclusive.
  - `dayWindow(trip: MomentTrip, day: string): { from: number; to: number } | null` — intersección de la franja de ese día con
    `[starts_at, ends_at - MOMENT_WINDOW_MS]`, en ms UTC; `null` si dura menos de `MIN_DAY_WINDOW_MS`.
  - `drawNotifyAt(window: { from: number; to: number }, random: () => number): number` — uniforme, redondeado al minuto,
    dentro de `[from, to]`.

- [ ] **Step 1: Tests que fallan** en `test/moments.test.ts`:
  - `tripDays` de un rollo del 11 al 14 de enero en `America/Argentina/Buenos_Aires` → `["2027-01-11", …, "2027-01-14"]`.
  - `dayWindow` de un día completo → `from` = 9:00 local, `to` = 23:00 local (en ms UTC).
  - Primer día con `starts_at` 15:00 local → `from` = 15:00. Último día con `ends_at` 18:00 → `to` = 17:55.
  - `starts_at` 22:45 local → `null`. `ends_at` 9:10 local → `null`.
  - Día de cambio de horario en `America/Santiago` (2027-04-04): `from`/`to` siguen siendo 9:00 y 23:00 locales.
  - `drawNotifyAt` con `random = () => 0` → `from`; con `() => 0.999999` → `≤ to`; siempre múltiplo de 60 000.
- [ ] **Step 2:** `npx vitest run test/moments.test.ts` → FAIL (no existe el módulo).
- [ ] **Step 3:** Implementar. Para la hora local del día usar la misma técnica de zona que `localDate` en `src/lib/util.ts`
  (`Intl.DateTimeFormat` con `timeZone`), buscando el offset de ese día en particular (por el DST).
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5:** Commit `"Momento del día: sorteo de la hora"`.

### Task B3: Config del momento al crear y leer el rollo

**Files:**
- Modify: `src/modules/trips/trips.schemas.ts` (`CreateTripSchema`, schema de respuesta del rollo), `src/modules/trips/trips.service.ts`,
  `src/modules/trips/trips.repository.ts`, `src/lib/util.ts` (`publicTrip`)
- Test: `test/trips.test.ts`

**Interfaces:**
- Produces: en el pedido de crear (opcionales) y en la respuesta del rollo: `momentMode: "off" | "photo" | "photo_selfie"`,
  `momentWindowStart: number`, `momentWindowEnd: number` (minutos, `0..1440`). Validación: `momentWindowEnd - momentWindowStart >= 30`,
  mensaje `"La franja del momento tiene que durar al menos 30 minutos"`. `PATCH /trips/{tripId}` **no** los acepta.

- [ ] **Step 1: Tests que fallan:** crear sin los campos → respuesta con `momentMode: "off"`, `540`, `1380`; crear con
  `{ momentMode: "photo_selfie", momentWindowStart: 600, momentWindowEnd: 1320 }` → los devuelve igual en `GET /trips/{id}`;
  franja de 20 minutos → 400 con el mensaje; `PATCH` con `momentMode` → el campo se ignora o 400 (el que use el resto del schema).
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Correr → PASS.
- [ ] **Step 5:** Commit `"Momento del día: configuración del rollo"`.

### Task B4: Preferencia "Momento del día"

**Files:**
- Modify: `src/lib/settings.ts` (`NOTIFICATION_COLUMNS`)
- Test: `test/me.test.ts` (o `test/notifications.test.ts`, donde ya estén los tests de `/me/settings`)

**Interfaces:**
- Produces: `NOTIFICATION_COLUMNS.dailyMoment = "notify_daily_moment"`, que lo suma a `GET/PATCH /me/settings` como
  `notifications.dailyMoment`.

- [ ] **Step 1: Test que falla:** `GET /me/settings` → `notifications.dailyMoment === true`; `PATCH` con `{ notifications: { dailyMoment: false } }` → `false` y persiste.
- [ ] **Step 2:** FAIL. **Step 3:** agregar la entrada. **Step 4:** PASS (y revisar que el schema de settings la documente).
- [ ] **Step 5:** Commit `"Momento del día: preferencia en Ajustes"`.

### Task B5: `GET /trips/{tripId}/moments`

**Files:**
- Create: `src/modules/moments/moments.router.ts`, `moments.controller.ts`, `moments.service.ts`, `moments.repository.ts`, `moments.schemas.ts`
- Modify: `src/index.ts` (montar el router bajo `/trips`)
- Test: `test/moments-api.test.ts`

**Interfaces:**
- Consumes: `tripDays`, `dayWindow`, `drawNotifyAt` (B2); `getNotificationSettings` (B4).
- Produces: `GET /trips/{tripId}/moments` → `200 { moments: { day: string; notifyAt: number }[] }` (schema `MyMoments`).
  Service: `getMyMoments(db: D1Database, trip: TripRow, userId: string, now: number, random?: () => number): Promise<{ day: string; notifyAt: number }[]>`.
  Repository: `insertMomentsIgnoringExisting(db, rows)`, `listUserMoments(db, tripId, userId)`, `findMoment(db, tripId, userId, day)`.

- [ ] **Step 1: Tests que fallan:**
  - Miembro activo de un rollo con `photo_selfie` → recibe un momento por cada día con ventana, desde hoy (fecha local del
    rollo) hasta el fin, cada `notifyAt` dentro de su `dayWindow`.
  - Pedir dos veces → los mismos `notifyAt` (no re-sortea) y una sola fila por día en `trip_moments`.
  - Otro miembro del mismo rollo → sus propios momentos; nunca aparecen los del primero.
  - Un día de hoy cuya ventana ya terminó (`notifyAt + MOMENT_WINDOW_MS < now`) no se devuelve, pero la fila queda guardada.
  - Rollo con `momentMode: "off"` → `[]` y sin filas. Usuario con `dailyMoment: false` → `[]` y sin filas.
  - No miembro o ex miembro → 404, como `GET /trips/{tripId}`. Rollo revelado o terminado → `[]`.
  - Alguien que se suma con el rollo en curso → momentos desde hoy, no desde el inicio.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar en capas. El sorteo usa `crypto.getRandomValues` por defecto (inyectable para los tests).
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `"Momento del día: endpoint de mis momentos"`.

### Task B6: Subida de la foto del momento y de la selfie

**Files:**
- Modify: `src/modules/media/media.schemas.ts` (`RegisterMediaSchema`), `media.service.ts` (`registerMedia`), `media.repository.ts`
  (conteo del cupo), `src/modules/moments/moments.repository.ts`
- Test: `test/media.test.ts`

**Interfaces:**
- Consumes: `findMoment` (B5), `MOMENT_WINDOW_MS` (B2).
- Produces: `RegisterMediaRequest` suma `momentDay?: string | null` y `pairedMediaId?: string | null`. Repository:
  `recordMomentPhoto(db, tripId, userId, day, mediaId, takenAt, inWindow)`, `recordMomentSelfie(db, tripId, userId, day, selfieId)`.

- [ ] **Step 1: Tests que fallan:**
  - Foto con `momentDay` de un momento existente y `takenAt` dentro de la ventana → 200, `trip_moments.media_id` y `in_window = 1`, y el cupo del día **no** baja (otra foto normal sigue entrando con el cupo lleno de antes).
  - La misma con `takenAt` 2 días después → 200 con `in_window = 0`.
  - `momentDay` sin fila en `trip_moments` → 409. Segunda foto distinta para el mismo `momentDay` → 409. Reintento con el mismo `id` → 200 (idempotente, como hoy).
  - Selfie con `pairedMediaId` de la principal del momento (mismo autor, mismo rollo, con `moment_day`) → 200 y `selfie_media_id` guardado; no descuenta cupo.
  - `pairedMediaId` de una foto ajena, de otro rollo o sin `moment_day` → 400.
  - Un pedido sin los campos nuevos se comporta exactamente como hoy.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar. El conteo del cupo (diario o total, el de "captura y cupo") excluye `moment_day IS NOT NULL`.
  La selfie hereda `moment_day` de la principal.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `"Momento del día: subida de la foto y la selfie"`.

### Task B7: Feed con momento y selfie

**Files:**
- Modify: `src/modules/media/media.schemas.ts` (`FeedItemSchema`), `media.repository.ts` (consulta del feed), `media.controller.ts`
- Test: `test/media.test.ts` (feed)

**Interfaces:**
- Produces: `FeedItem` suma `momentDay?: string | null` y `selfie?: { id: string; width: number | null; height: number | null; thumbhash: string | null; files: { thumb: string; original: string } | null } | null`.
  Las filas con `paired_media_id` nunca salen como ítem.

- [ ] **Step 1: Tests que fallan:** antes del revelado, la foto del momento sale con `momentDay` y `selfie.files === null`;
  la selfie no aparece como ítem. Revelado → `selfie.files` con sus rutas, y la selfie se puede descargar por su `id` con las
  mismas reglas que cualquier media del rollo. El conteo de ítems no cambia para un rollo sin momentos.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** `npm run openapi`, `npm run typecheck`, `npm test` → todo en verde. Commit `"Momento del día: feed y contrato"`.

### Task B8: Seed

**Files:**
- Modify: `scripts/seed.ts`, `CLAUDE.md` del backend

- [ ] **Step 1:** Sumar un rollo en curso con `momentMode: "photo_selfie"` y la franja por defecto, con `juani@rollo.test` adentro, y que el resumen final del seed lo liste.
- [ ] **Step 2:** `npm run seed` contra la base local → corre sin errores y lista el rollo.
- [ ] **Step 3:** Documentar en `CLAUDE.md` (tabla, endpoint, reglas de subida). Commit `"Momento del día: seed y docs"`.

---

## App (`rollo-app/mobile`)

### Task A1: Contrato y crear rollo

**Files:**
- Modify: `src/api/schema.d.ts` (generado), `src/features/trips/create-form.ts`, `src/features/trips/create-screen.tsx`
- Test: `src/features/trips/__tests__/create-form.test.ts`, `__tests__/create.test.tsx` (o el test de pantalla de crear que exista)

**Interfaces:**
- Produces: el formulario manda `momentMode` (default `"photo_selfie"`), `momentWindowStart` (default 540), `momentWindowEnd` (default 1380).

- [ ] **Step 1:** `API_SPEC=<backend>/openapi.json npm run api:generate` y `npm run typecheck` → en verde.
- [ ] **Step 2: Tests que fallan:** crear sin tocar nada manda `photo_selfie`, 540 y 1380; elegir "Apagado" oculta "Desde" y "Hasta" y manda `"off"`; "Solo foto" manda `"photo"`; con "Desde" 22:00 y "Hasta" 22:15 el mensaje del server se muestra inline.
- [ ] **Step 3:** FAIL. **Step 4:** Implementar con `@expo/ui`, como el resto del formulario (sección "Momento del día", selector de tres opciones y dos selectores de hora). **Step 5:** PASS.
- [ ] **Step 6:** Commit `"Momento del día: configuración al crear el rollo"`.

### Task A2: Qué avisos programar (lógica pura)

**Files:**
- Create: `src/features/moments/plan.ts`
- Test: `src/features/moments/__tests__/plan.test.ts`

**Interfaces:**
- Produces:
  - `MOMENT_WINDOW_MS = 300_000`, `MAX_SCHEDULED = 40`, `PREFETCH_DAYS = 3`
  - `type TripMoments = { tripId: string; tripName: string; moments: { day: string; notifyAt: number }[] }`
  - `type PlannedMoment = { id: string; tripId: string; tripName: string; day: string; notifyAt: number }`
  - `momentNotificationId(tripId: string, day: string): string` → `"moment.<tripId>.<day>"`
  - `tripsToSync(trips: { id: string; startsAt: number; endsAt: number; revealed: boolean }[], now: number): string[]` — los ids con `now >= startsAt - PREFETCH_DAYS días` y `now < endsAt` y sin revelar.
  - `planMoments(trips: TripMoments[], now: number): PlannedMoment[]` — los de `notifyAt > now`, ordenados por `notifyAt`, como mucho `MAX_SCHEDULED`.

- [ ] **Step 1: Tests que fallan:** `tripsToSync` incluye un rollo que arranca en 2 días y excluye uno que arranca en 4, uno terminado y uno revelado; `planMoments` descarta los pasados, ordena dos rollos mezclados y corta en 40.
- [ ] **Step 2:** `npx jest src/features/moments/__tests__/plan.test.ts` → FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `"Momento del día: qué avisos programar"`.

### Task A3: Sincronizar los avisos locales

**Files:**
- Create: `src/features/moments/actions.ts`, `src/features/moments/moment-sync.ts`, `src/features/moments/use-moment-sync.ts`
- Modify: `app/(tabs)/_layout.tsx` (montar el hook), `src/features/capture/background-upload.ts` (`runBackgroundUpload`),
  el lugar donde se limpia la sesión al cerrar sesión y en el `401` (el mismo que hoy borra el token de push, `src/features/notifications/push-token.ts` o su llamador)
- Test: `src/features/moments/__tests__/moment-sync.test.ts`

**Interfaces:**
- Consumes: `planMoments`, `tripsToSync`, `momentNotificationId` (A2).
- Produces:
  - `fetchMyMoments(tripId: string): Promise<{ day: string; notifyAt: number }[]>` en `actions.ts` (cliente generado + `unwrap`). **No** se llama desde `useQuery`.
  - `syncMoments(): Promise<void>` — lee los rollos de `GET /me/trips`, baja los momentos de `tripsToSync`, cancela los avisos
    `moment.*` programados que ya no están en el plan y programa los que faltan con `trigger: { type: DATE, date: notifyAt }`,
    contenido de Global Constraints y `data: { url: "/moment?trip=<tripId>&day=<day>&at=<notifyAt>" }`. Si falla la red, no toca
    lo ya programado. Nunca tira.
  - `cancelMomentNotifications(tripId?: string): Promise<void>` — todos los `moment.*`, o solo los de ese rollo.
  - `useMomentSync()` — corre `syncMoments` al montar y cada vez que la app vuelve a primer plano (como `use-offline-map-sync.ts`).

- [ ] **Step 1: Tests que fallan** (con `expo-notifications` mockeado y `fetch` simulado):
  - Programa un aviso por momento futuro con el id, el instante exacto (`date === notifyAt`, sin importar la zona del celular) y la `data.url` esperados.
  - Correrlo dos veces no duplica (mismo id) y cancela un `moment.*` que dejó de estar.
  - Con la red caída no cancela nada.
  - `cancelMomentNotifications()` cancela todos los `moment.*` y ninguna otra notificación programada.
  - La hora no queda en el `queryClient` ni en SecureStore después de sincronizar.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. Llamar a `cancelMomentNotifications()` donde se cierra la sesión (cerrar sesión y `401`), `cancelMomentNotifications(tripId)` en el `onSuccess` de "Salirme del rollo", y `syncMoments()` al principio de `runBackgroundUpload` (con su propio `try/catch`, antes de la pasada de subida).
- [ ] **Step 4:** PASS, y test de pantalla: cerrar sesión deja cero `moment.*` programados.
- [ ] **Step 5:** Commit `"Momento del día: avisos locales"`.

### Task A4: Cola y subida de la foto y la selfie

**Files:**
- Modify: `src/features/capture/queue.ts`, `src/features/capture/uploader.ts`, `src/features/capture/use-send-shot.ts`
- Test: `src/features/capture/__tests__/queue.test.ts`, `src/features/capture/__tests__/uploader.test.ts`

**Interfaces:**
- Produces: `QueuedMedia` suma `momentDay: string | null` y `pairedWith: string | null` (columnas `moment_day TEXT` y `paired_with TEXT` en `ADDED_COLUMNS`). El uploader manda `momentDay` y `pairedMediaId: pairedWith`. `useSendShot` acepta `momentDay?: string` y `selfie?: { asset; takenAt }`: encola la principal y, si hay selfie, otra fila con `pairedWith` = id de la principal.

- [ ] **Step 1: Tests que fallan:**
  - Una fila vieja (sin las columnas) se lee con `momentDay: null` y `pairedWith: null`.
  - El conteo de pendientes para el cupo (`countPending` y el de cupo total) no cuenta filas con `momentDay`.
  - La selfie no se intenta subir mientras su principal siga en la cola; se sube después de que la principal completó.
  - Si la principal queda como fallida para siempre, la selfie queda fallida con el mismo motivo y no se sube.
  - El pedido de registro lleva `momentDay` y `pairedMediaId`; una foto normal no los lleva (o van `null`).
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `"Momento del día: cola y subida"`.

### Task A5: La cámara del momento

**Files:**
- Create: `app/moment.tsx`, `src/features/moments/moment-screen.tsx`, `src/features/moments/moment-camera.tsx`, `src/features/moments/moment-time.ts`
- Modify: `app/_layout.tsx` (pantalla `moment`, `fullScreenModal`, sin header), `src/test/routes.ts`, `app.json` (plugin de `expo-camera` con el texto de permiso), `package.json` (`npx expo install expo-camera`), `src/features/capture/media.ts` (`prepareMedia` acepta `maxDimension?: number`)
- Test: `src/features/moments/__tests__/moment-time.test.ts`, `__tests__/moment.test.tsx`

**Interfaces:**
- Consumes: la pantalla de caption de captura (ya sin "Repetir"); `useSendShot` con `momentDay` y `selfie` (A4); `MOMENT_WINDOW_MS` (A2).
- Produces:
  - `momentState(at: number, now: number): { kind: "open"; leftMs: number } | { kind: "late" }` y `formatLeft(ms: number): string` (`"3:12"`) en `moment-time.ts`.
  - Ruta `/moment?trip=<id>&day=<YYYY-MM-DD>&at=<ms>`.

- [ ] **Step 1: Tests que fallan:** `momentState(at, at + 299_000)` → open con 1 000 ms; `at + 300_001` → late; `formatLeft(192_000) === "3:12"`. Pantalla: con `at` vencido muestra "Se pasó tu momento de hoy" y no abre la cámara; con la ventana abierta muestra la cuenta regresiva; en un rollo `photo_selfie`, después de la foto pide la selfie, y en uno `photo` va directo al caption; mandar encola con `momentDay` igual al `day` del parámetro.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar con `CameraView` de `expo-camera` (trasera, después frontal). La selfie pasa por `prepareMedia(uri, { maxDimension: 1080 })`. Sin permiso de cámara, el mismo mensaje que la captura de siempre.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `"Momento del día: cámara con cuenta regresiva"`.

### Task A6: Abrir el momento desde el aviso o desde Rollo

**Files:**
- Modify: `src/features/notifications/notification-target.ts`, `src/features/notifications/use-notification-response.ts` si hace falta
- Create: `src/features/moments/current-moment.ts`, `src/features/moments/use-current-moment.ts`, `src/features/moments/moment-banner.tsx`
- Modify: la pantalla del tablero de Rollo (`src/features/roll/…-screen.tsx`) para montar el banner
- Test: `src/features/notifications/__tests__/notification-target.test.ts`, `src/features/moments/__tests__/current-moment.test.ts`, `__tests__/moment.test.tsx`

**Interfaces:**
- Consumes: `momentState`, `formatLeft` (A5); `MOMENT_WINDOW_MS` (A2).
- Produces: `currentMoment(delivered: { identifier: string; data: Record<string, unknown> }[], now: number): { tripId: string; day: string; at: number; leftMs: number } | null` — el momento entregado (`moment.*`) cuya ventana sigue abierta.

- [ ] **Step 1: Tests que fallan:** `notificationTarget` con `data.url = "/moment?trip=t1&day=2027-01-12&at=…"` → `{ tripId: "t1", tab: false, href: "/moment?day=…&at=…" }` (deja `trip` como activo); `currentMoment` devuelve el entregado hace 2 minutos y `null` para uno de hace 6; el banner "Tu momento · quedan 3:00" aparece en Rollo solo con un momento abierto y al tocarlo abre `/moment`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. `useCurrentMoment` lee `Notifications.getPresentedNotificationsAsync()` al montar, al volver a primer plano y cada segundo mientras haya uno abierto; la pantalla `/moment` toma `trip` del rollo activo si no viene en la URL.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `"Momento del día: aviso y banner en Rollo"`.

### Task A7: Badge y selfie en el revelado

**Files:**
- Modify: `src/features/media/revealed.ts` (`RevealedPhoto` suma `momentDay: string | null` y `selfie: { id; thumbPath; originalPath; thumbhash; width; height } | null`)
- Create: `src/features/media/moment-badge.tsx` (SF Symbol `bolt.fill` blanco sobre círculo oscuro, del tamaño de la insignia de autor de las destacadas), `src/features/media/selfie-inset.tsx`
- Modify: la celda de la galería, el pin del mapa revelado, el visor de la galería y las historias
- Test: `src/features/media/__tests__/revealed.test.ts`, tests de pantalla de galería, visor e historias

- [ ] **Step 1: Tests que fallan:** `toRevealedPhotos` arma `momentDay` y `selfie` desde el feed; la grilla muestra el badge en la foto del momento y en ninguna otra; el visor muestra el recuadro de la selfie arriba a la izquierda y tocarlo intercambia las dos (`accessibilityLabel` `"Ver la selfie"` / `"Ver la foto"`); sin selfie, el visor muestra el badge; me gusta, comentarios y destacar actúan siempre sobre la principal.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `"Momento del día: badge y selfie en el revelado"`.

### Task A8: Ajustes, desarrollo y docs

**Files:**
- Modify: `src/features/notifications/settings-screen.tsx`, `use-notification-settings.ts`; la sección Desarrollo de Ajustes; `CLAUDE.md`
- Test: el test de pantalla de Ajustes → Notificaciones

**Interfaces:**
- Consumes: `syncMoments`, `cancelMomentNotifications` (A3).

- [ ] **Step 1: Tests que fallan:** el switch "Momento del día" refleja `notifications.dailyMoment`; apagarlo manda el `PATCH` y deja cero `moment.*` programados; prenderlo corre `syncMoments`. En dev, "Probar momento ahora" programa un `moment.*` en 10 s para el rollo activo con `at` = ese instante y `day` = hoy en la zona del rollo.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Actualizar `CLAUDE.md`: el bullet del momento del día (qué está hecho), `expo-camera` en el stack (nativo: `npx expo prebuild --clean` + rebuild), la feature `src/features/moments/` en la estructura y el número de tests.
- [ ] **Step 6:** `npm test` y `npm run typecheck` → en verde. Commit `"Momento del día: Ajustes y docs"`.

---

## Para probar en el iPhone (después de A8)

1. `npx expo prebuild --clean` + `npx expo run:ios --device` (por `expo-camera`).
2. Backend local con el seed (rollo con momento) y `EXPO_PUBLIC_API_URL` apuntando a la Mac.
3. Ajustes → Desarrollo → "Probar momento ahora", poner el celular en modo avión y esperar el aviso: tiene que sonar, abrir la cámara con la cuenta regresiva, pedir la selfie y quedar en la cola. Volver a tener señal: sube la principal y después la selfie.
4. Revelar el rollo desde el backend: el momento aparece con el recuadro de la selfie en el visor y con el badge en la galería.
