# Galería Diario y Rollos como pantalla principal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The revealed gallery becomes a "diary" (chapters with a hero photo, quotes, place and a face filter) and the app opens on a "Rollos" list that pushes into each roll.

**Architecture:** Part 1 (Tasks 1–6) only touches `src/features/gallery/`: pure chapter logic → flat FlashList items → screen. Part 2 (Tasks 7–10) turns the Rollo tab's stack into list (`app/(tabs)/roll/index.tsx`) + roll (`app/(tabs)/roll/[tripId].tsx`), makes the roll screens take an explicit `tripId`, and removes `TripSwitcher` and the `/trips` sheet. The two parts are independent and can go in either order; Task 11 closes both.

**Tech Stack:** Expo SDK 58, Expo Router (NativeTabs, Stack), TypeScript, FlashList v2, TanStack Query (persisted), `expo-location`, Jest + `expo-router/testing-library`.

**Spec:** `docs/superpowers/specs/2026-11-24-galeria-diario-y-rollos-design.md` (read it first; "Decisiones tomadas en la revisión" are binding).

## Global Constraints

- Work on branch `feature/galeria-diario-y-rollos` from `develop` (worktree; never switch the shared checkout's branch). Commits in Spanish, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Follow `mobile/CLAUDE.md`: `app/` only routes; pure logic in `*.ts` with tests in the feature's `__tests__/`; code/tests in English, UI copy in rioplatense voseo.
- TDD. Run only related tests: `npx jest <path> --maxWorkers=2`. Never the full suite.
- Dates only with `dateFormatter` from `src/lib/intl.ts`; trip-local day with `localDay(ms, timeZone)` from `@/features/capture/quota`.
- Cobalto (`colors.tint`) only on actions and selection (face ring, "+", camera button). Serif = `type.quote`'s family (`ui-serif`).
- Gallery stays one FlashList; O(n) with `Map`/`push` over up to ~2000 photos; memoize in the screen.
- No backend or contract changes.
- New/removed routes: update `app/_layout.tsx` and `src/test/routes.ts`.

## Review Focus

1. Active roll changes (push tapped, camera from another card) while a roll screen is open → the open screen keeps showing its own `tripId`. Test in Task 7.
2. Chapter with no likes, only videos, or fewer than 4 photos → hero rule still deterministic (first photo / no hero). Test in Task 2.
3. Event photo with `groupIds: []` → lands in "Otras fotos", counts and "Guardar todo" include it. Test in Task 1.
4. Geocoding offline, denied or throwing → line shows only "N fotos", no retry loop, no crash. Test in Task 4.
5. Cold start from a push `/roll?trip=X` or `/reveal?trip=X` → roll X open with the list underneath; back goes to "Rollos". Test in Task 10.

---

## Part 1 — Galería Diario

### Task 1: Chapters

**Files:**
- Create: `src/features/gallery/chapters.ts`
- Test: `src/features/gallery/__tests__/chapters.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Chapter = { key: string; kicker: string | null; title: string; photos: RevealedPhoto[]; placeable: boolean };
  export type ChapterContext =
    | { kind: "trip"; startDay: string /* "YYYY-MM-DD" in the trip zone */ }
    | { kind: "event"; groups: { id: string; name: string }[]; showGroupTitle: boolean; timeZone: string; multiDay: boolean };
  export const SPLIT_THRESHOLD = 40;
  export function buildChapters(photos: RevealedPhoto[], ctx: ChapterContext): Chapter[];
  export function timeBlockTitle(takenAt: number, timeZone: string, withDay: boolean): string;
  ```

Rules (from the spec):
- Trip: one chapter per `photo.day`, in input order. `kicker` = `"DÍA N"` where N = days from `startDay` to `day` + 1 (days without photos keep the numbering). `title` = `dayTitle(day)` from `group.ts`. `placeable: true`.
- Event: one chapter per group in `ctx.groups` order; a photo goes only to the **first** of its `groupIds` in that order. Photos with no visible group → final chapter `{ kicker: null, title: "Otras fotos" }`. Group ≤ 40 photos → one chapter `kicker: "GRUPO"`, `title: group.name` (if `!showGroupTitle`: `kicker: null`, `title: dayTitle(first photo's day)`). Group > 40 → one chapter per non-empty 2-hour block (trip-zone hour, block start = `floor(h/2)*2`), `kicker: showGroupTitle ? group.name.toUpperCase() : null`, `title: timeBlockTitle(...)`. Events: `placeable: false`.
- `timeBlockTitle`: `"De 20 a 22 h"`, `"De 22 a 0 h"`; with day: `"Sábado · de 20 a 22 h"`.
- Keys stable: `trip:<day>`, `group:<id>`, `group:<id>:<day>:<blockStart>`, `others`.

- [ ] **Step 1: Write failing tests** — `describe("buildChapters")`:
  - `"numbers trip days from the trip start, skipping empty days"`: startDay `2027-01-03`, photos on `03` and `05` → kickers `["DÍA 1","DÍA 3"]`.
  - `"puts an event photo only in its first group by event order"`: groups `[A,B]`, photo `groupIds: ["B","A"]` → only in A.
  - `"collects photos without a visible group in Otras fotos"`: `groupIds: []` → last chapter title `"Otras fotos"`, total photos across chapters equals input length.
  - `"splits a group over 40 photos into 2-hour blocks"`: 41 photos at 20:10 and 22:30 (zone `America/Argentina/Buenos_Aires`) → titles `["De 20 a 22 h","De 22 a 0 h"]`, kicker = group name uppercased.
  - `"keeps a group of 40 as one chapter"`.
  - `"hides the group title for a single-group guest"`: `showGroupTitle: false`, ≤ 40 → `kicker: null`, title is the day.
  - `timeBlockTitle` with `withDay: true` → `"Sábado · de 20 a 22 h"`.
- [ ] **Step 2:** `npx jest src/features/gallery/__tests__/chapters.test.ts --maxWorkers=2` → FAIL (module not found).
- [ ] **Step 3:** Implement in `chapters.ts` (hour via `dateFormatter("es-AR", { timeZone, hour: "numeric", hourCycle: "h23" })`; weekday capitalized like `dayTitle`).
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `Galería: capítulos por día, grupo y franja horaria`.

### Task 2: Hero and quotes

**Files:**
- Create: `src/features/gallery/chapter-picks.ts`
- Test: `src/features/gallery/__tests__/chapter-picks.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const HERO_MIN_PHOTOS = 4;
  export const MAX_QUOTES = 2;
  export function pickHero(photos: RevealedPhoto[]): RevealedPhoto | null;
  export function pickQuotes(photos: RevealedPhoto[], max?: number): RevealedPhoto[];
  ```
- `pickHero`: null if `photos.length < 4`; else most `likeCount` among `type === "photo"` and not `archived`, ties → earliest in array; null if no eligible photo.
- `pickQuotes`: photos with `caption?.trim()`, top `max` by `likeCount` (ties → earlier), returned in input (time) order.

- [ ] **Step 1: Failing tests:** `"no hero under 4 photos"`, `"hero is the most liked photo"`, `"ties go to the first photo"`, `"a video or archived photo is never the hero"`, `"only videos means no hero"`, `"quotes skip empty captions"`, `"quotes are the 2 most liked, in time order"`.
- [ ] **Step 2:** `npx jest src/features/gallery/__tests__/chapter-picks.test.ts --maxWorkers=2` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `Galería: foto grande y citas de cada capítulo`.

### Task 3: Diary grid items

**Files:**
- Modify: `src/features/gallery/grid-items.ts` (replace `gridItems`)
- Test: `src/features/gallery/__tests__/grid-items.test.ts` (rewrite)

**Interfaces:**
- Consumes: `Chapter` (Task 1), `pickHero`, `pickQuotes` (Task 2).
- Produces:
  ```ts
  export type GridItem =
    | { kind: "chapter"; key: string; chapter: Chapter }
    | { kind: "hero"; key: string; photo: RevealedPhoto }
    | { kind: "quote"; key: string; photo: RevealedPhoto }
    | { kind: "photo"; key: string; photo: RevealedPhoto; column: number };
  export function diaryItems(chapters: Chapter[], columns: number): GridItem[];
  ```
- Per chapter: `chapter` → `hero` (if any; hero removed from that chapter's grid) → photos, with quote 1 inserted after the first full row (after `columns` photos) and quote 2 after the row containing the middle photo, only if at least one row separates them; a quote with no room after it goes after the last photo. `column` restarts at 0 after every full-width item. Keys: `chapter:<key>`, `hero:<id>`, `quote:<id>`, `photo:<id>`.

- [ ] **Step 1: Failing tests:** `"starts each chapter with its header and hero"`, `"leaves the hero out of the grid"`, `"puts the first quote after the first full row"`, `"restarts columns after a quote"`, `"a 2-photo chapter has no hero and its quote after the photos"`, `"keys are unique across chapters"`.
- [ ] **Step 2:** `npx jest src/features/gallery/__tests__/grid-items.test.ts --maxWorkers=2` → FAIL.
- [ ] **Step 3:** Implement; delete the old `gridItems` (only `gallery-screen.tsx` uses it; Task 6 switches it).
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `Galería: ítems del diario para la grilla`.

### Task 4: Place of a chapter

**Files:**
- Create: `src/features/gallery/place.ts`, `src/features/gallery/use-chapter-place.ts`
- Test: `src/features/gallery/__tests__/place.test.ts`, `src/features/gallery/__tests__/use-chapter-place.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export function chapterCenter(photos: RevealedPhoto[]): { lat: number; lng: number } | null; // median lat and median lng of photos with GPS
  export function placeKey(c: { lat: number; lng: number }): string; // rounded to 2 decimals (~1 km): "-41.13,-71.31"
  export function placeName(a: Location.LocationGeocodedAddress): string | null; // city ?? subregion ?? region ?? null
  export function useChapterPlace(photos: RevealedPhoto[], enabled: boolean): string | null;
  ```
- Hook: `useQuery({ queryKey: ["place", key], queryFn: reverseGeocodeAsync → placeName, staleTime: Infinity, gcTime: 30 days, retry: false, enabled: enabled && !!center })`. Stays persisted (do **not** exclude it in `shouldDehydrateQuery`). Errors → `null`.

- [ ] **Step 1: Failing tests:** `chapterCenter` `"ignores photos without GPS"`, `"null without any GPS"`, `"uses the median"`; `placeKey` rounding; `placeName` fallbacks; hook (mock `expo-location`): `"returns the city"`, `"returns null when geocoding throws and does not retry"` (mock called once), `"two chapters in the same km geocode once"`, `"does nothing when disabled"`.
- [ ] **Step 2:** `npx jest src/features/gallery/__tests__/place.test.ts src/features/gallery/__tests__/use-chapter-place.test.tsx --maxWorkers=2` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `Galería: lugar de cada capítulo con el geocodificador de iOS`.

### Task 5: Face row

**Files:**
- Create: `src/features/gallery/people-order.ts`, `src/features/gallery/people-row.tsx`
- Test: `src/features/gallery/__tests__/people-order.test.ts`

**Interfaces:**
- Consumes: `previewMembers(members, meId, n)` from `@/features/roll/members-order` (pass `Infinity`), `Avatar` from `@/features/profile/avatar`.
- Produces:
  ```ts
  export type Person = { id: string; name: string; avatarUrl: string | null };
  export function peopleOrder(members: Member[], meId: string, authors: { id: string; name: string }[]): Person[]; // members in previewMembers order, then authors who are no longer members
  export function PeopleRow(props: { people: Person[]; selectedId: string | null; onSelect: (id: string | null) => void }): JSX.Element;
  ```
- Row: horizontal `ScrollView` (bounded list), first "Todos", then 40 pt avatar + first name; selected item has a 2 pt `colors.tint` ring; each is `accessibilityRole="button"` with `accessibilityState={{ selected }}` and label = full name ("Todos" for all).

- [ ] **Step 1: Failing tests:** `"follows the members order"`, `"adds authors who left at the end"`, `"never repeats a person"`.
- [ ] **Step 2:** `npx jest src/features/gallery/__tests__/people-order.test.ts --maxWorkers=2` → FAIL.
- [ ] **Step 3:** Implement both files.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `Galería: fila de caras para filtrar por persona`.

### Task 6: Wire the diary into the gallery

**Files:**
- Modify: `src/features/gallery/gallery-screen.tsx`, `src/features/gallery/gallery-toolbar.tsx`
- Create: `src/features/gallery/chapter-header.tsx`, `src/features/gallery/hero-cell.tsx`, `src/features/gallery/quote-row.tsx`
- Test: `__tests__/gallery.test.tsx` (update)

**Interfaces:**
- Consumes: Tasks 1–5; `rollSummary` from `@/features/roll/summary` + `memberTotal` (as `roll-overview.tsx` does); `sendableGroups`, `isEvent` from `@/features/events/event`.
- Context: trip → `{ kind: "trip", startDay: localDay(detail.trip.startsAt, tz) }`; event → `{ kind: "event", groups: groupId ? [selected] : sendableGroups(detail), showGroupTitle: sendableGroups(detail).length > 1, timeZone: tz, multiDay: localDay(startsAt) !== localDay(endsAt) }`. While `detail` is null: trip context with `startDay` = first photo's day.
- `ChapterHeader`: kicker (`type.caption`, uppercase, secondary), title (`type.title` size with `type.quote`'s fontFamily), line `"47 fotos · El Bolsón"` / `"1 foto"` (place from `useChapterPlace(chapter.photos, chapter.placeable)`).
- `HeroCell`: full width, 4:3, `expo-image` with thumbhash placeholder and `thumbPath` (the ~800 px thumbnail is enough at full width), same press / long-press / selection behavior as `Cell` (reuse `Cell`'s props; selection checkmark included).
- `QuoteRow`: caption in `type.quote` italic, `"Cami · 23:14"` (`type.caption`, secondary, trip-zone time); press opens `/photo/[id]` like a cell (in selection mode, toggles that photo).
- Header list order: summary line → `PeopleRow` → `header` (contest) → `OriginalsNotice` → group filter label (kept). Remove the "Solo {author}" label and the "Filtrar por persona" submenu from `GalleryToolbar` (prop `authors`/`onSelectAuthor` go away).
- `getItemType` = `item.kind`; `overrideItemLayout` spans `chapter`, `hero`, `quote`.

- [ ] **Step 1: Update failing screen tests** in `__tests__/gallery.test.tsx`: `"shows a chapter per day with DÍA N and the count"`, `"shows the most liked photo as the hero"`, `"shows a caption as a quote and opens its photo"`, `"filters by tapping a face and back with Todos"`, `"the menu no longer has Filtrar por persona"`, `"an event shows group chapters and Otras fotos"`; adapt existing tests that used the author menu or the old day headers.
- [ ] **Step 2:** `npx jest __tests__/gallery.test.tsx --maxWorkers=2` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx jest __tests__/gallery.test.tsx src/features/gallery --maxWorkers=2` and `npm run typecheck` → PASS.
- [ ] **Step 5:** Commit `Galería: diario con capítulos, foto grande, citas y caras`.

---

## Part 2 — Rollos como pantalla principal

### Task 7: The roll screen takes its `tripId`

**Files:**
- Create: `app/(tabs)/roll/[tripId].tsx`, `src/features/trips/roll-href.ts`
- Modify: `src/features/roll/roll-screen.tsx`, `src/features/roll/roll-board.tsx`, `app/(tabs)/roll/_layout.tsx`, `src/test/routes.ts`
- Test: `src/features/trips/__tests__/roll-href.test.ts`, `__tests__/screens.test.tsx` (roll cases)

**Interfaces:**
- Produces:
  ```ts
  export function rollHref(tripId: string, view?: "gallery" | "roll"): { pathname: "/roll/[tripId]"; params: { tripId: string; view?: string } };
  export function RollScreen(props: { tripId: string; view?: string }): JSX.Element; // was ({ view })
  export function RollBoard(props: { tripId: string }): JSX.Element;                 // was ()
  ```
- `[tripId].tsx` reads `tripId`, `view` and renders `<RollScreen tripId view />`. `RollScreen` calls `setActiveTripId(tripId)` once on mount (effect); header title = plain trip name text (`title`), no `TripSwitcher`; selection title unchanged. Trip summary from `useActiveTrip().trips.find(t => t.id === tripId)`; unknown id after load → `router.replace("/roll")`.
- `roll/_layout.tsx`: `export const unstable_settings = { initialRouteName: "index" };` and `title: "Rollos"`.

- [ ] **Step 1: Failing tests:** `rollHref` shape; screen: `"opening /roll/<id> makes it the active roll"`, `"keeps showing its roll when the active roll changes"` (call `setActiveTripId(other)` → name stays), `"an unknown roll goes back to the list"`.
- [ ] **Step 2:** `npx jest src/features/trips/__tests__/roll-href.test.ts __tests__/screens.test.tsx --maxWorkers=2` → FAIL.
- [ ] **Step 3:** Implement (`RollBoard` stops calling `useActiveTrip`; `Welcome` leaves `RollScreen`, Task 8 owns it).
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `Rollo: la pantalla del rollo va por id`.

### Task 8: Rows, live card and labels

**Files:**
- Modify: `src/features/trips/row-state.ts`, `src/features/trips/trip-row.tsx`
- Create: `src/features/trips/live-roll-card.tsx`
- Test: `src/features/trips/__tests__/row-state.test.ts`, `src/features/trips/__tests__/trip-row.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export function liveDayLabel(trip: TripSummary, now: number, timeZone: string): string; // "Día 3 de 6"
  // tripRowState: revealed subtitle becomes "Se reveló el 2 de nov · 318 fotos" (revealAt, totalUploaded; "1 foto")
  export function LiveRollCard(props: { trip: TripSummary; onOpen: () => void; onCamera: () => void }): JSX.Element;
  ```
- `TripRow`: drop `selected` and the checkmark; add a 40 pt rounded thumbnail on the left: `coverUrl` (event cover, via `mediaSource`-style public URL as the board does) → else `coverThumbhash` as `expo-image` placeholder-only → else today's `rowTint` gradient. Keep badge, "Evento" label, `FullWidthMenuView` actions.
- `LiveRollCard`: 180 pt, `borderCurve: "continuous"`, blurred thumbhash background + dark gradient, "LIVE" badge + `liveDayLabel`, name (`type.title`, white), line `"Te quedan N fotos hoy"` / `"…en el rollo"` from `useTripDetail(trip.id)` + `useTodayLeft(trip.id, detail)` (hidden while null); round `colors.tint` camera button (`accessibilityLabel="Sacar una foto en {name}"`) → `onCamera`. Whole card pressable → `onOpen`.

- [ ] **Step 1: Failing tests:** `liveDayLabel` (`"day 1 of 1"`, `"day 3 of 6 in the trip zone"`); revealed subtitle with 1 and 318 photos; `TripRow` `"has no checkmark"`, `"shows the event cover"`.
- [ ] **Step 2:** `npx jest src/features/trips/__tests__/row-state.test.ts src/features/trips/__tests__/trip-row.test.tsx --maxWorkers=2` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `Rollos: filas con miniatura y tarjeta del rollo en curso`.

### Task 9: The "Rollos" list as the tab root

**Files:**
- Create: `src/features/trips/rolls-screen.tsx`
- Modify: `app/(tabs)/roll/index.tsx`, `src/features/trips/group-trips.ts`
- Delete: `src/features/trips/trips-screen.tsx`, `app/trips.tsx`, its `Stack.Screen` in `app/_layout.tsx`, its entry in `src/test/routes.ts`
- Test: `__tests__/trips-list.test.tsx` (rewrite), `src/features/trips/__tests__/group-trips.test.ts`

**Interfaces:**
- Consumes: `rollHref` (Task 7), `TripRow`, `LiveRollCard` (Task 8), `Welcome` from `@/features/roll/welcome`.
- `groupTrips` gains `live: TripSummary[]` (rolls in `top` whose `rollPhase` is `"active"`, removed from `top`); signature unchanged otherwise.
- Screen: large title "Rollos"; toolbar right "+" menu: "Nuevo rollo" → `/create`, "Sumate con un código" → `/join`; `live` → `LiveRollCard` each (`onOpen` = push `rollHref(id)`; `onCamera` = `await setActiveTripId(id)` then push `/capture`); `top` under "Próximos"; then "Revelados", "Anteriores · N", "Archivados · N" (keep `FoldedRolls`). Row press = `router.push(rollHref(id))` (no `setActiveTripId` here: the roll screen does it after mounting, spec decision 3). No trips → `<Welcome />`. Loading/error like today's lists (`Loading`, error + "Reintentar").

- [ ] **Step 1: Failing tests:** group-trips `"live rolls leave top"`; screen: `"the app opens on Rollos"`, `"a live roll shows its card with the photos left"`, `"tapping a row opens that roll with Rollos to go back"`, `"the camera button makes that roll active and opens the camera"`, `"+ offers Nuevo rollo and Sumate con un código"`, `"without rolls shows the welcome"`, archive/leave menu cases moved from the old sheet tests.
- [ ] **Step 2:** `npx jest __tests__/trips-list.test.tsx src/features/trips/__tests__/group-trips.test.ts --maxWorkers=2` → FAIL.
- [ ] **Step 3:** Implement and delete the sheet.
- [ ] **Step 4:** → PASS; `npm run typecheck`.
- [ ] **Step 5:** Commit `Rollos: la lista de rollos es la primera pantalla`.

### Task 10: Tabs, headers and every way into a roll

**Files:**
- Modify: `src/features/trips/tabs.ts`, `app/(tabs)/_layout.tsx`, `src/features/map/roll-map.tsx`, `src/features/map/activity-screen.tsx`, `app/index.tsx`, `app/presentation.tsx`, `src/features/notifications/notification-target.ts` (+ its caller `use-notification-response.ts`), `src/features/trips/create-screen.tsx`, `src/features/trips/join-screen.tsx`, `src/features/events/use-pending-join.ts`, `src/features/friends/friend-sections.tsx`, `src/features/friends/use-leave-trip.ts`, `src/features/roll/use-delete-trip.ts`, `src/features/roll/no-roll-yet.tsx`
- Delete: `src/features/trips/trip-switcher.tsx`, `src/features/trips/__tests__/trip-switcher.test.tsx`
- Test: `src/features/trips/__tests__/tabs.test.ts`, `__tests__/notifications.test.tsx`, `__tests__/presentation.test.tsx`, `__tests__/screens.test.tsx`

**Interfaces:**
- Consumes: `rollHref` (Task 7).
- `tabsFor(...).roll` is always `{ sf: { default: "film.stack", selected: "film.stack.fill" }, md: "movie", label: "Rollos" }` (no more Galería icon). Camera with no rolls keeps `target: "/roll"` (now the list).
- `notificationTarget`: `/roll?trip=X` and `/reveal?trip=X` → `{ tripId: X, tab: true, href: "/roll/X" }` (without trip → `/roll`). The caller navigates to `/roll` first and then pushes `rollHref(X)` so the list is underneath (also on cold start, with `initialRouteName` from Task 7).
- Map/Feed header: `title: trip.name` (plain), no switcher.
- `presentation.tsx` `openGallery`: `router.dismissTo(rollHref(trip.id, "gallery"))`.
- Create/join/pending join/"Sumar a un rollo" → `router.dismissTo("/roll")` then `router.push(rollHref(newId))`. Delete/leave from the board → `router.dismissTo("/roll")`.

- [ ] **Step 1: Failing tests:** tabs `"the first tab is always Rollos"`; notifications `"a reveal push opens that roll over the list"`, `"cold start from /roll?trip=X lands on X with back to Rollos"` (Review Focus 5); presentation `"Ver galería goes back to that roll's gallery"`; screens `"creating a roll opens it over the list"`, `"leaving a roll goes back to the list"`, `"the map title is the active roll's name"`.
- [ ] **Step 2:** `npx jest src/features/trips/__tests__/tabs.test.ts __tests__/notifications.test.tsx __tests__/presentation.test.tsx __tests__/screens.test.tsx --maxWorkers=2` → FAIL.
- [ ] **Step 3:** Implement; `git grep -n "TripSwitcher\|\"/trips\"" -- src app` returns nothing.
- [ ] **Step 4:** → PASS; `npm run typecheck`.
- [ ] **Step 5:** Commit `Rollos: tabs, avisos y links abren el rollo sobre la lista`.

### Task 11: Docs and final check

**Files:**
- Modify: `mobile/CLAUDE.md` ("Navegación y diseño": tabs Rollos · Mapa · Cámara · Amigos · Perfil, list + roll by id, no selector; "Varios rollos por persona"; "Tus rollos" grouping incl. `live`; Galería Diario: chapters, hero, quotes, place, faces, event rules)

- [ ] **Step 1:** Update `CLAUDE.md`.
- [ ] **Step 2:** `npx jest --findRelatedTests $(git diff --name-only develop -- src app) --maxWorkers=2` and `npm run typecheck` → PASS.
- [ ] **Step 3:** Run the app on the iPhone (`npm start` with the dev build) with `juani@rollo.test`: list opens first, Bariloche revealed shows the diary, an event shows group chapters; screenshots for the PR.
- [ ] **Step 4:** Commit `CLAUDE.md: Galería Diario y Rollos como pantalla principal` and open the PR to `develop`.
