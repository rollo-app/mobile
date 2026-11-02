# Editar rollo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any admin can edit a rollo's dates, photo quota and daily moment after creating it, within stage rules and new caps (30/day, 200 total, 31 days).

**Architecture:** Backend first (`rollo-app/backend`, branch `feature/editar-rollo` from `develop`): caps, a `trip_moments.mode` snapshot so today's moment survives config changes, then the widened `PATCH /trips/{tripId}`. Then the app (`rollo-app/mobile`, branch `feature/editar-rollo` from `develop`): regenerate the client, pure edit logic, the create form split into a shared component, and an "Editar rollo" screen reachable from the board.

**Tech Stack:** Cloudflare Worker + Hono OpenAPI + D1 + vitest (backend); Expo SDK 58, Expo Router, TanStack Query, `@expo/ui/swift-ui` Form, Jest + `renderRouter` (app).

**Spec:** `docs/superpowers/specs/2026-10-29-editar-rollo-design.md` (mobile repo). It amends the roles table of `docs/superpowers/specs/2026-10-28-rollos-archivar-y-admins-design.md`.

## Global Constraints

- Code, comments and test names in English; user-visible copy, commits and PRs in rioplatense Spanish (voseo).
- TDD: failing test first. Run only related tests: backend `npx vitest run <file>`; app `npx jest <path> --maxWorkers=2`. Never the full app suite.
- Backend worktree at `../backend/.claude/worktrees/editar-rollo` (copy `.dev.vars` from `../backend`); app worktree at `.claude/worktrees/editar-rollo`. Use `/usr/bin/git` in worktrees. Never push to `main`, never deploy, never merge.
- New caps, identical in create and update, enforced by the server: `dailyPhotoLimit` max **30**, `totalPhotoLimit` max **200**, `endsAt - startsAt` max **31 days** (`31 * 86_400_000` ms).
- Caps only check the value being sent: an existing rollo above a cap stays as is.
- Error copy (exact): `"El rollo puede durar hasta 31 días"`, `"El rollo ya empezó: el inicio no se cambia"`, `"El rollo ya empezó: el tipo de cupo no se cambia"`, `"El rollo ya terminó: no se puede editar"`, `"El revelado no puede ser antes del fin"` (exists), `"El inicio no puede ser en el pasado"` (exists), `"El fin no puede ser en el pasado"` (exists). zod `max` messages: `"Hasta 30 fotos por día"`, `"Hasta 200 fotos en todo el rollo"`.
- Persisted data on the phone is never renamed (SecureStore keys, SQLite columns, Query keys).
- App: `app/` files only route; writes are `useMutation` hooks `use-<verb>-<thing>.ts`; errors inline with `ErrorText`/form footer, never toasts.

## Review Focus

1. Admin edits the end while today's moment notification is already scheduled → today's moment keeps its time and its mode; tomorrow's are re-drawn. (Task 2/3 tests)
2. Moment turned off mid-rollo while a member has today's moment photo queued offline → the upload is still accepted (row exists), selfie too if the row was `photo_selfie`. (Task 2 test)
3. Rollo starts while an admin has the edit screen open and changes only the end → saving succeeds because `startsAt` is not sent. (Task 5 pure test + Task 6 screen test)
4. Reveal is "Al terminar" (`revealAt == endsAt`) and the admin extends the end → both are sent and the reveal follows; with a custom reveal before the new end the server message shows inline. (Task 5/6)
5. A non-creator admin sends `featuringDisabled` → 403 and nothing applied; sending dates/quota/moment → applied. (Task 3)

---

### Task 1 (B1): Caps on create and update

**Files:**
- Modify: `../backend/src/modules/trips/trips.schemas.ts`, `../backend/src/modules/trips/trips.service.ts` (create path)
- Test: `../backend/test/trip-limits.test.ts`

**Interfaces:**
- Produces: exported constants in `trips.schemas.ts`: `MAX_DAILY_PHOTOS = 30`, `MAX_TOTAL_PHOTOS = 200`, `MAX_TRIP_DURATION_MS = 31 * 86_400_000`, `TRIP_TOO_LONG = "El rollo puede durar hasta 31 días"`.

- [ ] **Step 1: Failing tests** in `trip-limits.test.ts`: `POST /trips` with `dailyPhotoLimit: 31` → 400; `30` → 201; `photoLimitMode: "total", totalPhotoLimit: 201` → 400, `200` → 201; `endsAt = startsAt + 31 days + 1 ms` → 400 with error `"El rollo puede durar hasta 31 días"`, exactly 31 days → 201. `PATCH` the same limits on `dailyPhotoLimit`/`totalPhotoLimit` → 400.
- [ ] **Step 2:** Run `npx vitest run test/trip-limits.test.ts` → FAIL.
- [ ] **Step 3:** Set zod `.max(MAX_DAILY_PHOTOS, "Hasta 30 fotos por día")` / `.max(MAX_TOTAL_PHOTOS, "Hasta 200 fotos en todo el rollo")` in both schemas; add a `.refine` on `CreateTripSchema` for duration with path `["endsAt"]`. (Duration on update is Task 3.)
- [ ] **Step 4:** Tests pass; also run `npx vitest run test/trips.test.ts` (existing fixtures above the caps must be lowered if they break).
- [ ] **Step 5:** Commit `Topes del rollo: 30 fotos por día, 200 en total y 31 días`.

### Task 2 (B2): Today's moment survives config changes

**Files:**
- Create: `../backend/migrations/0033_moment_mode_snapshot.sql`
- Modify: `../backend/src/db/schema.ts` (if it mirrors columns), `../backend/src/modules/moments/moments.repository.ts`, `moments.service.ts`, `moments.schemas.ts`
- Test: `../backend/test/me-moments.test.ts`, `../backend/test/moment-upload.test.ts`

**Interfaces:**
- Produces: column `trip_moments.mode TEXT NULL` (`'photo' | 'photo_selfie'`; NULL on old rows = use the trip's mode). `GET /me/moments` moments gain optional `mode: "photo" | "photo_selfie"`. Repository: `deleteUntakenMomentsAfter(db, tripId, day: string): D1PreparedStatement` deleting rows with `trip_id = ? AND day > ? AND media_id IS NULL` (consumed by Task 3).

- [ ] **Step 1: Failing tests:**
  - `me-moments`: rows inserted by `getMyMoments` carry `mode` = trip mode and the response includes it.
  - `me-moments`: trip `moment_mode` set to `'off'` directly in the DB after today's row was drawn → `GET /me/moments` still returns that trip with only today's open row (and its `mode`); once `notify_at + 15 min` passes it returns nothing for that trip and draws nothing new.
  - `moment-upload`: today's row drawn with `photo_selfie`, then trip set to `'off'` → main photo registration with `momentDay` → 201, selfie with `pairedMediaId` → 201. Trip set to `'photo'` with a `photo_selfie` row → selfie still 201. A row drawn with `photo` → selfie 400 `"Este rollo no admite selfie del momento"`.
  - `deleteUntakenMomentsAfter` removes future untaken rows and keeps today's and taken ones.
- [ ] **Step 2:** Run those files → FAIL.
- [ ] **Step 3:** Migration `ALTER TABLE trip_moments ADD COLUMN mode TEXT;`. Insert stores `trip.moment_mode`. `listMomentTrips` condition becomes `(t.moment_mode != 'off' OR EXISTS (SELECT 1 FROM trip_moments tm WHERE tm.trip_id = t.id AND tm.user_id = ?1 AND tm.notify_at + 900000 > ?now))` (keep the other filters). `getMyMoments`: when the trip is off, skip drawing but return open rows; return `mode: row.mode ?? trip.moment_mode` (omit when that is `'off'`). `resolveMoment`: the main photo no longer requires `trip.moment_mode !== 'off'` when the member's row exists (keep the 400 when there is no row and the trip is off); the selfie checks `row.mode ?? trip.moment_mode === 'photo_selfie'` for the main photo's day. `MyTripMoments.momentMode` stays `"photo" | "photo_selfie"`: the trip's mode, or, when the trip is off, the mode of its returned row (`row.mode ?? "photo"`).
- [ ] **Step 4:** `npx vitest run test/me-moments.test.ts test/moment-upload.test.ts test/moments-api.test.ts test/moments.test.ts` → PASS.
- [ ] **Step 5:** Commit `El momento de hoy guarda su modo y sobrevive a los cambios del rollo`.

### Task 3 (B3): Admins edit dates, quota and moment

**Files:**
- Modify: `../backend/src/modules/trips/trips.schemas.ts` (`UpdateTripSchema`, `CreateTripSchema` momentMode description), `trips.service.ts` (`updateTrip`), `trips.repository.ts` (`updateTrip` SQL + `TripEdit`), `trips.router.ts` (403/409 descriptions), `../backend/CLAUDE.md`, seed script if it documents what admins can do
- Test: `../backend/test/rollo-roles.test.ts`, new `../backend/test/trip-edit.test.ts`

**Interfaces:**
- Consumes: Task 1 constants, Task 2 `deleteUntakenMomentsAfter`.
- Produces: `UpdateTripRequest` gains optional `startsAt`, `photoLimitMode`, `momentMode`, `momentWindowStart`, `momentWindowEnd` (same ranges as create). Response unchanged (`Trip`).

- [ ] **Step 1: Failing tests** (`trip-edit.test.ts`, with a non-creator admin unless noted):
  - Upcoming rollo: change `startsAt`, `endsAt`, `revealAt`, `photoLimitMode` (daily→total with `totalPhotoLimit`), `momentMode`, window → 200 and `GET /trips/{id}` reflects them.
  - Active rollo: `startsAt` → 409 `"El rollo ya empezó: el inicio no se cambia"`; `photoLimitMode` → 409 `"El rollo ya empezó: el tipo de cupo no se cambia"`; `endsAt` later, `dailyPhotoLimit`, `momentMode` → 200.
  - Ended (`ends_at < now`, not revealed) or revealed: any field except `name` → 409 `"El rollo ya terminó: no se puede editar"`; `name` → 200.
  - `endsAt - startsAt` (resulting) > 31 days → 400 `"El rollo puede durar hasta 31 días"`; a legacy 40-day rollo editing only `dailyPhotoLimit` → 200.
  - `endsAt` after a fixed `revealAt` without sending `revealAt` → 400 `"El revelado no puede ser antes del fin"`.
  - Window shorter than 30 min → 400 `"La franja del momento tiene que durar al menos 30 minutos"`.
  - `photoLimitMode: "total"` without `totalPhotoLimit` and no stored one → 400 `"Elegí cuántas fotos por persona tiene el rollo"`.
  - Active rollo with today's and tomorrow's moment rows drawn: changing `endsAt`, `momentMode` or the window deletes tomorrow's untaken row and keeps today's (same `notify_at`); changing only `dailyPhotoLimit` deletes nothing. Upcoming rollo with prefetched rows: changing `startsAt` deletes them all (all are after "today").
  - Shortening `endsAt` so today's row `notify_at + 15 min > ends_at` → today's untaken row is deleted too.
  - Plain member → 403 (unchanged). Non-creator admin with `featuringDisabled` → 403 `"Solo quien creó el rollo puede hacer esto"` and nothing applied (update the existing `rollo-roles.test.ts` case that expects 403 for dates: it now expects 200).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** In `updateTrip`: creator-only guard narrows to `featuringDisabled`. Stage = `revealed || now > ends_at` → ended; `now >= starts_at` → active; else upcoming. Apply the rules above, compute `next` including `starts_at`, `photo_limit_mode`, `total_photo_limit`, `moment_mode`, window; validate resulting order, duration, reveal and window. If any of `startsAt`/`endsAt`/`momentMode`/window changed, add `deleteUntakenMomentsAfter(db, trip.id, localDate(now, trip.timezone))` to the same `db.batch`, plus a statement deleting today's untaken row when `notify_at + 900000 > next.ends_at`. Update the repository `UPDATE` to write the new columns.
- [ ] **Step 4:** `npx vitest run test/trip-edit.test.ts test/rollo-roles.test.ts test/trips.test.ts test/trip-limits.test.ts` → PASS; `npm run typecheck` and regenerate `openapi.json` (`npm run openapi` or the repo's script) → committed.
- [ ] **Step 5:** Update backend `CLAUDE.md` (who edits what, caps, moment snapshot). Commit `Los admins editan fechas, cupo y momento del rollo`. Open the backend PR to `develop` (do not merge).

### Task 4 (A1): Regenerated client, per-moment mode, caps in the form

**Files:**
- Modify: `src/api/schema.d.ts` (generated: `API_SPEC=<backend worktree>/openapi.json npm run api:generate`), `src/features/moments/plan.ts`, `src/features/moments/actions.ts` (types), `src/features/trips/create-form.ts`, `src/features/trips/create-screen.tsx` (stepper max)
- Test: `src/features/moments/__tests__/plan.test.ts`, `src/features/trips/__tests__/create-form.test.ts`

**Interfaces:**
- Produces: `create-form.ts` exports `MAX_DAILY_PHOTOS = 30`, `MAX_TOTAL_PHOTOS = 200`. `planMoments` uses `m.mode ?? t.momentMode` for each `PlannedMoment.momentMode`.

- [ ] **Step 1:** Failing test: `planMoments` with a trip `momentMode: "photo"` whose moment has `mode: "photo_selfie"` → planned `momentMode === "photo_selfie"`; without `mode` → trip mode.
- [ ] **Step 2–4:** Implement, steppers use the constants, run `npx jest src/features/moments src/features/trips/__tests__/create-form.test.ts --maxWorkers=2` and `npm run typecheck`.
- [ ] **Step 5:** Commit `Cliente nuevo de la API, modo por momento y topes en Crear rollo`.

### Task 5 (A2): Pure edit logic

**Files:**
- Create: `src/features/trips/edit-form.ts`
- Test: `src/features/trips/__tests__/edit-form.test.ts`

**Interfaces:**
- Consumes: `rollPhase` from `phase.ts`, `MomentMode` from `create-form.ts`.
- Produces:
  - `type TripSettings = { startsAt: number; endsAt: number; revealAt: number; photoLimitMode: "daily" | "total"; dailyPhotoLimit: number; totalPhotoLimit: number | null; momentMode: MomentMode; momentWindowStart: number; momentWindowEnd: number }`
  - `settingsOf(trip: TripDetail["trip"]): TripSettings`
  - `editableFields(trip, now): { start: boolean; end: boolean; reveal: boolean; limitMode: boolean; limit: boolean; moment: boolean }` — upcoming: all true; active: `start` and `limitMode` false; ended/revealed: all false.
  - `lockedNote(field: "start" | "limitMode", ...)`: `"El rollo ya empezó: el inicio no se cambia."` / `"El rollo ya empezó: el tipo de cupo no se cambia."`
  - `revealFollowsEnd(s: TripSettings): boolean` → `s.revealAt === s.endsAt`.
  - `type UpdateTripBody = components["schemas"]["UpdateTripRequest"]` (from `@/api/schema`)
  - `changedFields(before: TripSettings, after: TripSettings, revealMode: "end" | "custom"): UpdateTripBody` — only keys whose value differs; with `revealMode === "end"` and a changed end, includes `revealAt = endsAt`; `totalPhotoLimit` only in total mode; never `startsAt` unless it changed.
  - `canSave(changes): boolean` → at least one key.

- [ ] **Step 1:** Failing tests for each function, including: unchanged settings → `{}`; end changed with reveal "end" → `{ endsAt, revealAt }` both equal; end changed with custom reveal → `{ endsAt }` only; start untouched on an active rollo → no `startsAt` key; daily→total → `{ photoLimitMode: "total", totalPhotoLimit }`.
- [ ] **Step 2–4:** Implement; `npx jest src/features/trips/__tests__/edit-form.test.ts --maxWorkers=2`.
- [ ] **Step 5:** Commit `Lógica para editar un rollo`.

### Task 6 (A3): "Editar rollo" screen

**Files:**
- Create: `src/features/trips/trip-form.tsx` (the `<Form>` sections extracted from `create-screen.tsx`: dates, reveal, quota, moment; props = values, setters, and per-section `disabled` + footer note; the name and privacy sections stay in `create-screen.tsx`), `src/features/trips/edit-screen.tsx`, `src/features/trips/use-update-trip.ts`, `app/edit-trip.tsx` (reads `tripId` param, mounts `<EditTripScreen tripId />`)
- Modify: `src/features/trips/create-screen.tsx` (uses `TripForm`, no behavior change), `src/features/trips/actions.ts` (`updateTrip(tripId, body)` → `PATCH /trips/{tripId}`, returns `Trip`), `src/features/roll/roll-people.tsx` (row "Editar rollo" for admins when `editableFields(...).end` is true, i.e. not ended; `router.push({ pathname: "/edit-trip", params: { tripId } })`), `app/_layout.tsx` (register `edit-trip` as a modal like `create`), `src/test/routes.ts`
- Test: new `__tests__/edit-trip.test.tsx`, existing `__tests__/create*.test.tsx` and `__tests__/roll-members.test.tsx` still pass

**Interfaces:**
- Consumes: Task 5 functions; `useTripDetail(tripId)`.
- Produces: `useUpdateTrip(tripId)` — `useMutation` calling `updateTrip`, `onSuccess` invalidates the trip detail key and `myTripsKey`, then runs `syncMoments()` (fire and forget) when the body touched dates or moment.

- [ ] **Step 1:** Failing screen tests (`renderRouter`, mocking `@/features/trips/actions`):
  - Admin on an active rollo sees "Editar rollo" in the board; a member does not; nobody sees it on an ended rollo.
  - The screen loads current values; on an active rollo the start picker is disabled with footer `"El rollo ya empezó: el inicio no se cambia."`.
  - Changing only the end and tapping "Guardar" calls `updateTrip(tripId, { endsAt, revealAt })` (reveal "Al terminar") and closes the screen.
  - "Guardar" is disabled with no changes.
  - Server 400 `"El revelado no puede ser antes del fin"` shows inline in the form and keeps the edited values.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Extract `TripForm` first (run the create tests green), then build the edit screen: toolbar "Cancelar" / "Guardar" (spinner while pending), same sections with `disabled` from `editableFields`, error in the first section's footer like Create.
- [ ] **Step 4:** `npx jest __tests__/edit-trip.test.tsx __tests__/roll-members.test.tsx <create test files> --maxWorkers=2`; `npm run typecheck`.
- [ ] **Step 5:** Commit `Pantalla "Editar rollo" para los admins`.

### Task 7 (A4): Docs

**Files:**
- Modify: `CLAUDE.md` (Roles bullet: admins edit dates/quota/moment, creator-only list; caps in "Límite de fotos por persona" and "Rollo configurable"; moment snapshot note in "Momento del día"), `docs/superpowers/specs/2026-10-28-rollos-archivar-y-admins-design.md` (roles table row "Editar fechas, cupo, momento" → ✓ Admin, with a pointer to the new spec), `src/features/info/topics.ts` only if the quota/dates topics state the old limits.

- [ ] **Step 1:** Edit, then `npx jest __tests__/info.test.tsx --maxWorkers=2` if `topics.ts` changed.
- [ ] **Step 2:** Commit `CLAUDE.md: editar rollo`. Open the app PR to `develop` (do not merge); its `contract` CI job will fail until the backend PR is merged to `develop`.
