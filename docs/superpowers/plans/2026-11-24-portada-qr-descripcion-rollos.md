# Portada, descripción y QR para todos los rollos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cover, description, QR and the join preview work for regular rollos, not only events.

**Architecture:** Two repos with the same branch name `feature/portada-qr-rollos`. Backend (Tasks 1–2) drops the event-only gates on the cover and on `GET /events/{code}` and adds a few preview fields; the app (Tasks 3–7) regenerates the contract and stops gating the existing event pieces (hero, cover, description, QR, preview) on `isEvent`, keeping groups/contest/Feed event-only.

**Tech Stack:** Backend: Cloudflare Workers, Hono `@hono/zod-openapi`, D1, R2, vitest. App: Expo SDK 58, Expo Router, React Native, TanStack Query, Jest.

**Spec:** `docs/superpowers/specs/2026-11-24-portada-qr-descripcion-rollos-design.md` (read it; "Decisiones tomadas en la revisión" are binding).

## Global Constraints

- Backend worktree: `/Users/juanifraga/Desktop/Rollo/backend-portada`, new branch `feature/portada-qr-rollos` from `origin/develop` (copy `.dev.vars` and `node_modules` from `../backend`). App worktree: `/Users/juanifraga/Desktop/Rollo/mobile-portada` (branch `feature/portada-qr-rollos`, based on `feature/galeria-diario-y-rollos`). Never switch the shared checkouts' branches.
- Commits in Spanish ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Code/tests English, UI copy rioplatense voseo.
- TDD. Backend: `npx vitest run <file>`. App: `npx jest <path> --maxWorkers=2`, never the full suite; `npm run typecheck`.
- Compatibility: `GET /events/{code}` keeps its path and every existing field; new fields are additive. Old builds must keep working.
- Privacy (Juani's decision): with the code you see cover, name, description, dates and member count (hidden below 5) before joining; without the code, nothing.
- Still event-only: groups, contest, Feed instead of Map, picking groups when joining, "Revelar ahora".
- `mobile/CLAUDE.md` app rules (`app/` only routes, cobalt only on actions/selection, FlashList rules, no `{string && …}`).

## Review Focus

1. A member who scans their own roll's QR → the roll opens, no preview, no join call. Test in Task 7.
2. Typing the code of a regular rollo still joins directly (no preview step) even though the preview now answers 200. Test in Task 7.
3. Preview of a revealed regular rollo → "Este rollo ya se reveló." and no "Unirme"; an event still says "Este evento ya se reveló.". Test in Task 7.
4. Cover upload on a revealed regular rollo → 409 "Este rollo ya se reveló."; on an event the old message. Test in Task 1.
5. A regular rollo with neither cover nor description → board unchanged (no empty hero, no gap). Test in Task 4.

---

## Backend (`rollo-app/backend`, worktree `backend-portada`)

### Task 1: Cover for any rollo

**Files:**
- Modify: `src/modules/trips/cover.service.ts` (drop `assertEvent`; `assertNotRevealed` message by type), the cover routes' OpenAPI descriptions that say "event"
- Test: `test/event-cover.test.ts`

**Interfaces:**
- Produces: `POST /trips/{id}/cover` (request) and its complete call accept `type: "trip"`; 409 after the reveal with `"Este rollo ya se reveló."` for a trip, `"Este evento ya se reveló."` for an event. Permissions unchanged (admins).

- [ ] **Step 1:** In `test/event-cover.test.ts` replace `"a regular trip has no cover"` with `"a regular trip can have a cover"` (full request → PUT → complete cycle on a `type: "trip"` rollo, cover served at `coverUrl`) and add `"a revealed regular trip refuses the cover with its own message"` (409, `"Este rollo ya se reveló."`). Keep the event tests as they are.
- [ ] **Step 2:** `npx vitest run test/event-cover.test.ts` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Same command → PASS; `npm run typecheck`.
- [ ] **Step 5:** Commit `Portada: cualquier rollo puede tener portada`.

### Task 2: Join preview for any rollo

**Files:**
- Modify: `src/modules/events/events.service.ts` (`previewEvent`), `src/modules/events/events.schemas.ts` (`EventPreviewSchema`), `src/modules/events/events.router.ts` (description), `openapi.json` (regenerated with `npm run openapi`)
- Test: `test/events.test.ts`

**Interfaces:**
- Produces: `GET /events/{code}` → existing fields plus `type: "trip" | "event"`, `startsAt: number`, `endsAt: number`, `timezone: string`. A regular rollo answers 200 with `groups: []`. 404 only for an unknown code. `memberCount` rule unchanged (null below 5).

- [ ] **Step 1:** Tests in `test/events.test.ts`: `"previews a regular trip by code without a session"` (200, `type: "trip"`, `groups: []`, name, coverUrl, description, dates, timezone), `"a regular trip with fewer than 5 members hides the count"`, `"a revealed regular trip previews as revealed"`, `"the event preview now also carries type and dates"`.
- [ ] **Step 2:** `npx vitest run test/events.test.ts` → FAIL.
- [ ] **Step 3:** Implement; regenerate `openapi.json`.
- [ ] **Step 4:** Same command → PASS; `npm run typecheck`; the contract test (if any) passes.
- [ ] **Step 5:** Commit `Vista previa: cualquier rollo se ve antes de unirse`.

---

## App (`rollo-app/mobile`, worktree `mobile-portada`)

### Task 3: Contract

**Files:**
- Modify: `src/api/schema.d.ts` (generated)

- [ ] **Step 1:** `API_SPEC=../backend-portada/openapi.json npm run api:generate`.
- [ ] **Step 2:** `npm run typecheck` → PASS (fields are additive).
- [ ] **Step 3:** Commit `API: vista previa con tipo y fechas (contrato del backend)`.

### Task 4: Board hero for any rollo

**Files:**
- Modify: `src/features/events/event-board-hero.tsx` (drop the `isEvent` guard), `src/features/events/event.ts` (subtitle helper)
- Test: `src/features/events/__tests__/event.test.ts` (or the existing pure-test file there), `__tests__/event-board.test.tsx`

**Interfaces:**
- Produces: `export function heroSubtitle(detail: TripDetail): string` — event: today's `"<día> · N personas"` (`eventDay` + `peopleLabel`); trip: `"3 al 8 de enero · 8 personas"` (dates in the trip zone with `dateFormatter`; same month → "3 al 8 de enero", different months → "28 de dic al 3 de enero"; `peopleLabel(memberTotal(detail))`).
- `EventBoardHero` renders for any rollo: cover → `EventHero` with `heroSubtitle`; no cover but description → `EventDescription`; neither → `null`. Used already by `roll-board.tsx` and `roll-overview.tsx`.

- [ ] **Step 1:** Tests: `heroSubtitle` for an event (unchanged text), a trip within one month, a trip across months; screen: `"a regular rollo with a cover shows the hero with its dates"`, `"a regular rollo with only a description shows it"`, `"a regular rollo with neither shows the board as before"` (Review Focus 5).
- [ ] **Step 2:** `npx jest src/features/events __tests__/event-board.test.tsx --maxWorkers=2` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** → PASS; typecheck.
- [ ] **Step 5:** Commit `Tablero: portada grande y descripción en cualquier rollo`.

### Task 5: Cover and description when creating and editing

**Files:**
- Modify: `src/features/trips/create-screen.tsx` (cover section + `DescriptionSection` for both kinds; cover upload after create as events do today), `src/features/trips/edit-screen.tsx` (`DescriptionSection` for any rollo), `src/features/roll/roll-settings-screen.tsx` (`EventCover` row for any admin until the reveal), `src/features/trips/contest-section.tsx` (`DescriptionSection` footer copy)
- Test: `src/features/trips/__tests__/create-event.test.tsx`, `__tests__/edit-trip.test.tsx`, roll-settings tests where they live

**Interfaces:**
- Copy: description footer `"La ve cualquiera que tenga el código o el QR, antes de unirse."`. Cover section and preview identical to Crear evento.
- A failed cover upload after `POST /trips` leaves the rollo created; retry lives in Editar rollo / Ajustes (spec decision 5). Never creates twice.

- [ ] **Step 1:** Tests: `"creating a regular rollo sends its description"`, `"creating a regular rollo with a cover uploads it after creating"`, `"a failed cover upload keeps the new rollo and does not create it again"`, `"editing a regular rollo changes its description"`, `"Ajustes del rollo offers the cover for a regular rollo until the reveal"`.
- [ ] **Step 2:** Run those test files → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** → PASS; typecheck.
- [ ] **Step 5:** Commit `Rollo: portada y descripción al crear y editar cualquier rollo`.

### Task 6: QR and invite link for any rollo

**Files:**
- Modify: `src/features/roll/roll-essentials.tsx` (`RollInvite`), `src/features/events/qr-screen.tsx` (doc/copy only if it says "evento")
- Test: `__tests__/event-board.test.tsx` or the board test that covers `RollInvite`

**Interfaces:**
- "Código QR" row: event → as today (organizer, unrevealed); regular rollo → any member, unrevealed, `disabled` when full (same as the code row). Opens `/event-qr?tripId=…`.
- Share message: always `Sumate a "<nombre>" en Rollo: <joinLinkUrl(code)>`.

- [ ] **Step 1:** Tests: `"a member of a regular rollo sees Código QR"`, `"Código QR is disabled when the rollo is full"`, `"a revealed regular rollo has no Código QR"`, `"sharing a regular rollo sends the join link"`, `"the QR screen works for a regular rollo"`.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** → PASS; typecheck.
- [ ] **Step 5:** Commit `Invitar: código QR y link para cualquier rollo`.

### Task 7: Join by QR or link

**Files:**
- Modify: `src/features/trips/join-screen.tsx`, `src/features/events/event.ts` (revealed message helper)
- Test: `__tests__/join-event.test.tsx` (+ a new `describe` for regular rollos)

**Interfaces:**
- `export function revealedMessage(preview: { type: "trip" | "event" }): string` → `"Este rollo ya se reveló."` / `"Este evento ya se reveló."`.
- From a link/QR (`initialCode`): if the code belongs to a rollo you're an active member of (match `joinCode` in `useActiveTrip().trips`) → `router.dismissTo("/roll")` + `router.push(rollHref(id))`, no preview, no join. Otherwise preview; `type: "trip"` → `EventHero` (cover) or plain header (no cover) with the dates line, description, `joinedLine(memberCount)` and "Unirme" (join without groups); revealed → `revealedMessage` and no "Unirme". `type: "event"` → as today.
- Typed code (submit without a link preview on screen): if the preview says `type: "trip"` → join directly, as today; events as today.

- [ ] **Step 1:** Tests: `"a regular rollo's link shows its preview and Unirme joins it"`, `"a regular rollo without a cover shows the preview without the photo"`, `"a revealed regular rollo says Este rollo ya se reveló and has no Unirme"`, `"typing a regular rollo's code joins it directly"`, `"scanning the QR of a rollo you're in opens it"`; existing event tests keep passing.
- [ ] **Step 2:** `npx jest __tests__/join-event.test.tsx --maxWorkers=2` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** → PASS; typecheck.
- [ ] **Step 5:** Commit `Unirse: vista previa por QR o link para cualquier rollo`.

### Task 8: Docs and final check

**Files:**
- Modify: `CLAUDE.md` ("Privacidad de los rollos" → quien tiene el código ve portada, nombre, descripción, fechas y cuánta gente antes de entrar; "Eventos" paragraph: portada, descripción, QR and preview are now for any rollo; Rollo/tablero section)
- Backend `CLAUDE.md` in `backend-portada`: cover and preview for any rollo (commit in the backend repo)

- [ ] **Step 1:** Update both docs.
- [ ] **Step 2:** App: `npx jest --findRelatedTests <changed files> --maxWorkers=2` and `npm run typecheck`. Backend: `npx vitest run test/event-cover.test.ts test/events.test.ts` and `npm run typecheck`.
- [ ] **Step 3:** Commit in each repo `CLAUDE.md: portada, descripción y QR para todos los rollos`. Do not push or open PRs (Juani decides).
- [ ] **Step 4:** Note for Juani: the web `/join` page works with the new API; its copy says "evento" in places (rollo-app/web, separate small change).
