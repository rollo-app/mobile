# Créditos del rollo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After the last photo of a revealed trip roll's stories, show one story step per award ("credits") computed from the roll's own photos, then the outro with the cast.

**Architecture:** Pure award computation in `src/features/presentation/credits.ts`. `buildStory` appends `credit` steps before the `outro` when given a `credits` option; the existing player, clock and progress bar treat them as ordinary timed steps. A new `CreditCard` renders a step; `Outro` shows the cast. A hook decides whether a roll gets credits (not an event, blocked list loaded).

**Tech Stack:** TypeScript, React Native, expo-image, Reanimated 4, Jest + Testing Library. No new dependencies, no native changes, no backend changes.

**Spec:** `docs/superpowers/specs/2026-11-26-creditos-del-rollo-design.md` (read it first; its rules table is binding).

## Global Constraints

- Code, comments and test descriptions in English; user-visible copy in Rioplatense Spanish exactly as written here.
- TDD: write the test, see it fail, then implement. Run only related tests: `npx jest <test path> --maxWorkers=2`. Never the full suite.
- `npm run typecheck` must pass at the end of every task.
- Dates/times only through `dateFormatter` from `@/lib/intl` (cached formatter); never `new Intl.DateTimeFormat` or `toLocale*String`.
- No `{string && <X />}` in JSX. Animate only `transform` and `opacity`.
- Without the `credits` option, `buildStory` output must be byte-for-byte what it is today except `outro.cast === null` (existing tests keep passing).
- Commit after each task, message in Spanish, ending with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`. Do not push.

## Review Focus

1. Clock-window edges: 00:00 is night, 04:59 is night, 05:00 is first light, 08:59 is first light, 09:00 and 23:59 are neither. Hermes may format midnight as "24": force `hourCycle: "h23"`. (Task 1 tests.)
2. A blocked author who would win everything: they win nothing, are absent from the cast, and the remaining photos are re-gated (fewer than 10 → no awards). (Task 1 tests.)
3. Photos without coordinates and blank/whitespace captions never count. (Task 1 tests.)
4. Two long shared names on a small screen must not overflow: `numberOfLines={2}` + `adjustsFontSizeToFit` on the names. (Task 3.)
5. The blocked list arriving after the stories mounted must not rebuild them under the viewer: the screen waits for it. (Task 3 test of the hook's `ready`.)

---

### Task 1: Award computation

**Files:**
- Create: `src/features/presentation/credits.ts`
- Test: `src/features/presentation/__tests__/credits.test.ts` (copy the `photo()` fixture helper from `__tests__/story.test.ts`)

**Interfaces — Produces:**

```ts
export type AwardKind = "firstLight" | "nightShift" | "script" | "locations" | "camera";
export type Award = { kind: AwardKind; title: string; names: string[]; detail: string; photo: RevealedPhoto };
export type Credits = { awards: Award[]; cast: string[] };
export const AWARD_TITLES: Record<AwardKind, string>; // "Primera luz" | "Turno noche" | "Guion" | "Locaciones" | "Cámara"
export const MIN_CREDIT_PHOTOS = 10, MIN_CREDIT_AUTHORS = 2, MIN_CAPTIONS = 3, MIN_PLACES = 3, MIN_CAMERA_PHOTOS = 5;
/** ["Juani"] → "Juani"; ["Juani","Sofi"] → "Juani y Sofi". */
export function awardNames(names: string[]): string;
export function computeCredits(photos: RevealedPhoto[], timeZone: string, blockedUserIds: ReadonlySet<string>): Credits;
```

**Rules (from the spec):**

- *Eligible item*: `!archived` and `!blockedUserIds.has(authorUserId)`. *Eligible photo*: eligible item with `type === "photo"`. Authors are identified by `author.id`; the displayed name is `author.name`.
- `cast`: names of the authors of eligible items (photos or videos), ordered by their first item (`takenAt`, then `id`), one entry per author.
- `awards` is `[]` when eligible photos < `MIN_CREDIT_PHOTOS` or their distinct authors < `MIN_CREDIT_AUTHORS`.
- Awards appear in this order, each only when it has a winner:
  - `firstLight`: among eligible photos whose local clock time (in `timeZone`) is in [05:00:00, 09:00:00), the smallest time of day (to the second); tie → smaller `id`. `names` = its author; `photo` = it; `detail` = `"06:42 · Día 3"`.
  - `nightShift`: same in [00:00:00, 05:00:00), the largest time of day; tie → smaller `id`.
  - `script`: per author, count of eligible photos with `caption?.trim()` non-empty; top count ≥ `MIN_CAPTIONS`. `detail` = `"14 textos"`. `photo` = the first-named winner's photo with the longest trimmed caption (tie: earliest).
  - `locations`: per author, distinct cells `` `${lat.toFixed(2)},${lng.toFixed(2)}` `` over eligible photos with non-null `lat` and `lng`; top count ≥ `MIN_PLACES`. `detail` = `"9 lugares"`. `photo` = the first-named winner's photo (chronological) that added their last new cell.
  - `camera`: per author, count of eligible photos; top count ≥ `MIN_CAMERA_PHOTOS`. `detail` = `"42 fotos"`. `photo` = the first-named winner's photo with the highest `likeCount` (tie: earliest).
- Count ties (`script`, `locations`, `camera`): exactly two authors at the top → `names` has both, ordered by each one's first eligible photo; three or more → the award is omitted.
- `title` = `AWARD_TITLES[kind]`. Counts go through `formatCount` from `./format`.
- Time in `detail`: `formatTime(takenAt, timeZone)` from `@/features/trips/phase`. "Día N": local day of the photo minus the local day of the earliest item in the **unfiltered** `photos` input, plus 1 (so it matches the story's day cards; reuse the `localDay`/`dayNumber` approach of `story.ts` — export those two helpers from `story.ts` rather than duplicating; importing `story.ts` from `credits.ts` is fine as long as `story.ts` only imports *types* from `credits.ts`).
- Time of day: one cached `dateFormatter("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })` + `formatToParts`. One pass with Maps; no per-photo array copies (feeds reach ~2000 photos).

- [ ] **Step 1: Write failing tests** in `credits.test.ts`, TZ `"America/Argentina/Buenos_Aires"` (UTC−3, so `2027-01-05T09:42:00Z` is 06:42 local). Cover, one `it` each:
  - no awards with 9 eligible photos; no awards with 10 photos by a single author; `cast` still listed in both.
  - `firstLight` picks 06:42 over 07:10, detail `"06:42 · Día 3"` when the roll's earliest photo is two local days before; `photo` is that photo.
  - window edges from Review Focus 1 (05:00:00 wins first light; 04:59 goes to night; 09:00 and 23:59 win nothing; 00:00 counts as night and loses to 03:17).
  - `nightShift` picks 03:17 over 01:00.
  - `script`: 3 captions wins with `"3 textos"`, 2 captions gives no award, whitespace-only captions don't count, background is the longest caption.
  - `locations`: 3 distinct cells wins with `"3 lugares"`; photos with `lat: null` don't count; two photos in the same 0.01° cell count once.
  - `camera`: top count below 5 → no award; background is the most liked, earliest on a tie.
  - a two-way tie gives `names` of both ordered by first photo; a three-way tie omits the award.
  - archived photos and videos never count for awards; a video author is in `cast`.
  - a blocked author (via `authorUserId`) wins nothing, is not in `cast`, and the gate is re-evaluated without their photos.
  - `awardNames` for one and two names.
- [ ] **Step 2:** `npx jest src/features/presentation/__tests__/credits.test.ts --maxWorkers=2` → FAIL (module not found).
- [ ] **Step 3:** Implement `credits.ts` (and export `localDay`, `dayNumber` from `story.ts`).
- [ ] **Step 4:** Same command → PASS; also `npx jest src/features/presentation/__tests__/story.test.ts --maxWorkers=2` → PASS; `npm run typecheck` → clean.
- [ ] **Step 5:** Commit `Créditos: cálculo de los premios`.

### Task 2: Credit steps in the story

**Files:**
- Modify: `src/features/presentation/story.ts`, `player.ts`, `upcoming.ts`
- Test: `__tests__/story.test.ts`, `__tests__/player.test.ts`, `__tests__/upcoming.test.ts`

**Interfaces:**
- Consumes: `computeCredits`, `Award` from Task 1.
- Produces:

```ts
export type StoryCredits = { blockedUserIds: ReadonlySet<string> };
export type StoryStep = … | { kind: "credit"; award: Award } | { kind: "outro"; stats: StoryStats; cast: string[] | null };
export const CREDIT_MS = 4500;
export function buildStory(photos: RevealedPhoto[], timeZone: string, options?: { credits?: StoryCredits }): StoryStep[];
```

**Behaviour:**
- With `options.credits`: one `credit` step per award, in order, between the last photo and the outro; `outro.cast` = the computed cast. Without it: no credit steps and `outro.cast === null`.
- `stepDuration(credit)` = `CREDIT_MS`.
- `daySegments` on a credit step: `{ count: <number of credit steps>, current: <its index among them> }` (still `null` on the outro).
- `playerReducer` `"prev"`: stops at the previous step that is a `photo` **or a `credit`** (from the outro → last credit; from the first credit → last photo).
- `upcomingPhotos`: a `credit` step contributes `award.photo` (so the prefetch warms it). `use-story-prefetch.ts` needs no change (it clears the cache only on `day` steps).

- [ ] **Step 1: Failing tests:** credit steps sit between the last photo and the outro and carry the awards of `computeCredits`; no option → no credit steps and `cast: null`; `stepDuration` 4500; `daySegments` over 3 credits at the second → `{ count: 3, current: 1 }`, and a photo's segments ignore credit steps after it; `prev` from the outro lands on the last credit, from the first credit on the last photo; `upcomingPhotos` from the last photo returns the first credits' photos.
- [ ] **Step 2:** Run the three test files → FAIL.
- [ ] **Step 3:** Implement. Fix every `switch`/narrowing TypeScript now flags (`story-player.tsx` may need a temporary `step.kind === "credit"` no-op branch only if typecheck demands it; Task 3 fills it in).
- [ ] **Step 4:** `npx jest src/features/presentation --maxWorkers=2` → PASS; `npm run typecheck` → clean.
- [ ] **Step 5:** Commit `Créditos: pasos de premio en las historias`.

### Task 3: The card, the cast, the wiring and the docs

**Files:**
- Create: `src/features/presentation/credit-card.tsx`, `src/features/presentation/use-story-credits.ts`
- Modify: `src/features/presentation/outro.tsx`, `format.ts`, `story-player.tsx`, `app/presentation.tsx`, `CLAUDE.md`
- Test: `__tests__/credit-card.test.tsx`, `__tests__/use-story-credits.test.ts`, `__tests__/outro.test.tsx`, `__tests__/format.test.ts`; update the existing screen test of `/presentation` under `__tests__/` if one breaks.

**Interfaces — Consumes:** `Award`, `awardNames` (Task 1); `StoryCredits`, the `credit` step and `outro.cast` (Task 2); `useBlocked` from `@/features/moderation/use-blocked` (`blocked: Friend[] | null`, `error: string | null`; check in `src/api/schema.d.ts` which `Friend` field is the **user id** and use that); `isEvent` from `@/features/events/event`.

**Produces:**

```ts
// format.ts — up to `max` names joined by " · "; beyond it, "… y N más" appended after the last shown name: "A · B · y 3 más"
export const CAST_MAX = 24;
export function castLine(cast: string[], max = CAST_MAX): string;
// use-story-credits.ts — event → { ready: true, credits: undefined } without waiting; otherwise ready once the blocked list loaded or failed;
// loaded → credits with the Set of blocked user ids (memoized, stable identity while the ids don't change); failed → credits undefined.
export function useStoryCredits(trip: { type?: "trip" | "event" } | undefined): { ready: boolean; credits: StoryCredits | undefined };
// credit-card.tsx
export function creditLabel(award: Award): string; // "Turno noche: Nico. 03:17, Día 2"  (title: names. detail with " · " → ", ")
export function CreditCard({ award, token }: { award: Award; token: string }): JSX.Element;
// story-player.tsx — new optional prop
credits?: StoryCredits;
```

**CreditCard look** (spec "Cómo se ve"): root `flex: 1`, black. Full-bleed `expo-image` of `mediaSource(award.photo.displayPath, token)`, `contentFit="cover"`, `placeholder={{ thumbhash }}` when the photo has one, `transition={200}`, `accessible={false}`, with `useImageRetry` like `slide.tsx`. Over it a full scrim `rgba(0,0,0,0.55)`. Text block absolutely positioned at the bottom: `paddingHorizontal: spacing.lg`, `paddingBottom: 72`, `gap: spacing.xs`:
- title: `award.title.toUpperCase()`, `type.footnote`, `letterSpacing: 1.5`, color `rgba(255,255,255,0.7)`;
- names: `awardNames(award.names)`, `type.largeTitle` at `fontSize: 40, lineHeight: 46`, white, `numberOfLines={2}`, `adjustsFontSizeToFit`;
- detail: `type.body`, color `rgba(255,255,255,0.7)`.
The whole card is one VoiceOver element: `accessible`, `accessibilityLabel={creditLabel(award)}`. `pointerEvents="none"` on the text so taps reach the story surface.

**Motion:** the text block is an `Animated.View` (Reanimated): on mount a shared value goes 0→1 with `withTiming(1, { duration: 400, easing: easeOut() })` (`@/ui/motion`); style `opacity: p`, `transform: [{ translateY: (1 - p) * 12 }]`. With `useReducedMotion()` from `react-native-reanimated` true: no translate (opacity only). The player renders `<CreditCard key={award.kind} …>` so each card remounts and replays it.

**Outro:** new prop `cast: string[] | null`. With a non-null, non-empty cast: instead of the `topLine` text, a small label `Elenco` (same style as the stat `label`) and under it `castLine(cast)` in `type.body`, white, `numberOfLines={6}`. With `null`: exactly today's screen.

**StoryPlayer:** pass `credits` into `buildStory` (add a stable key of the sorted blocked ids to the `useMemo` deps, next to `photoKey`); render `CreditCard` for `credit` steps and pass `step.cast` to `Outro`; light haptic (`Haptics.impactAsync(Light)`) when entering a `credit` step whose previous step is not a `credit`. The mute button and heart don't show on credits (they already depend on `photo`).

**`app/presentation.tsx`:** `const { ready, credits } = useStoryCredits(trip)`; mount `StoryPlayer` only when `ready` too (keep the spinner meanwhile) and pass `credits`.

**CLAUDE.md:** in the "Después del revelado" bullet, right after the sentence about `/presentation` being only the stories, add a paragraph "**Créditos**" describing: where (trip rolls only, not events), the five awards with their rules and minimums, ties, the cast in the outro, that the app filters blocked users with `useBlocked` and shows no credits if that list can't load, archived photos and videos excluded, no award depends on likes, reduced motion and VoiceOver, files (`credits.ts`, `credit-card.tsx`, `use-story-credits.ts`), and the spec path. Keep it one dense paragraph in the file's style, in Spanish.

- [ ] **Step 1: Failing tests:**
  - `format.test.ts`: `castLine(["Cami","Lu"])` → `"Cami · Lu"`; 26 names with max 24 → the first 24 joined then `" · y 2 más"`.
  - `outro.test.tsx`: with `cast` shows "Elenco" and the line and hides the "sacó más fotos" line; with `cast: null` shows the top line as today (existing tests get `cast={null}`).
  - `credit-card.test.tsx`: renders the title uppercased, the two names as "Juani y Sofi", the detail; `creditLabel` → `"Turno noche: Nico. 03:17, Día 2"`; the card exposes that label.
  - `use-story-credits.test.ts` (mock `@/features/moderation/use-blocked`): event → ready with no credits even while blocked is `null`; trip + `blocked: null, error: null` → not ready; trip + loaded list → ready with a Set of those user ids; trip + error → ready, credits undefined.
- [ ] **Step 2:** Run those four files → FAIL.
- [ ] **Step 3:** Implement everything above. If Reanimated needs a Jest mock beyond what `jest.setup.ts` / `src/test/reanimated.ts` already provide, follow the pattern used by other presentation tests; do not add a global mock of `CreditCard`.
- [ ] **Step 4:** `npx jest src/features/presentation --maxWorkers=2` and `npx jest --findRelatedTests app/presentation.tsx src/features/presentation/story-player.tsx --maxWorkers=2` → PASS; `npm run typecheck` → clean.
- [ ] **Step 5:** Commit `Créditos: tarjeta de premio, elenco y conexión con las historias`.
