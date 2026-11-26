# Afiche del viaje Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A still 1080×1920 poster of a trip roll (map, whole route, photo pins, city names, numbers) offered as an "Afiche" segment in Compartir for rolls that qualify for the Recorrido film.

**Architecture:** A small pure layout module (camera, pins, line, label placement, stats) on top of the journey engine's stops and place names; a Skia offscreen renderer that paints it at 2.5× the film frame on a 1080×1920 surface; a hook that builds everything and writes a JPEG to the cache; a share body mounted by the share screen only while its segment is selected.

**Tech Stack:** TypeScript, React Native (Expo SDK 58), `@shopify/react-native-skia` offscreen surfaces, MapLibre `StaticMapImageManager`, TanStack-free hook (plain effect like `use-film.ts`), Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-26-afiche-del-viaje-design.md`

## Global Constraints

- No new dependencies, no native changes: must run on the installed dev build with a JS reload.
- Code, comments and test descriptions in English; user-visible copy in rioplatense Spanish (exact strings below); commits in Spanish, ending with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- TDD. Run only related tests, always `--maxWorkers=2` (`npx jest <test path> --maxWorkers=2`). Never the full suite. `npm run typecheck` must pass.
- The repo is public: no real photos, coordinates of real people, IPs or keys in fixtures.
- Privacy (never weaken): only `filmCandidates` photos; stops only through `buildStops(…, FILM_CUTS.share, …)` (cell centres); geocode and draw only `stop.lat/lng`, never a photo's coordinates; map zoom ≤ `travelZoom(stops, frame.w, FILM_CUTS.share) - 0.4` (so ≤ 9.6); labels only from `stopLabels(…, true, …)`; no author names or avatars anywhere on the poster; `MAP_CREDIT` always drawn.
- Poster is dark only. Canonical frame is `FILM_FRAME` (432×768 film points); pixels = points × 2.5.
- `app/` is not touched (no new route).
- Commit only files you changed; never stash, reset or switch branches (other sessions share the repo).

## Review Focus

1. All stops in a tiny area (bbox ~0 wide or tall): the camera must stay finite and capped, never NaN/Infinity → Task 1 test.
2. Fifteen stops sharing two cities: one label per distinct city, never two labels overlapping, never a label over a pin → Task 1 tests.
3. Geocoding returns nothing (offline or timeout): the poster is still built, with no labels → Task 2 test.
4. The map image fails or times out: `error` state with `offline` and a working `retry`, never a poster without map → Task 2 test.
5. The Recorrido's photo selection leaves a single place: Afiche shows the no-route notice and no share pills → Task 3 test.

---

### Task 1: Pure poster layout

**Files:**
- Create: `src/features/journey/poster/poster-layout.ts`
- Test: `src/features/journey/poster/__tests__/poster-layout.test.ts`
- Modify: `src/features/journey/engine/scene.ts` (export the existing `thousands`)

**Interfaces:**
- Consumes: `Stop`, `FilmCut`, `FILM_FRAME`, `FILM_CUTS`, `toMercator`, `travelZoom` from `../route`; `MapLayerSpec`, `Pt`, `Size` from `../engine/model`; `thousands` from `../engine/scene`; `dateRange` from `@/features/share/collage`; `dateFormatter` from `@/lib/intl`.
- Produces:

```ts
export const POSTER_SCALE = 2.5;                       // pixels per film point
export const POSTER_BAND = { top: 0.25, bottom: 0.72 }; // fractions of frame.h the map content (pins, labels) may use
export const posterPinRadius = (frame: Size): number => 0.048 * frame.w;

export type PosterLayout = {
  camera: { cx: number; cy: number; zoom: number };
  /** The one map image: the whole frame at the camera, without the map's own names. */
  map: MapLayerSpec;                                    // { cx, cy, zoom, w: frame.w, h: frame.h, labels: false }
  /** One per stop, in route order; `photo` is `stop.shots[0].id`. Frame points. */
  pins: { x: number; y: number; photo: string }[];
  line: Pt[];                                           // the pins' centres, in order
  /** One per distinct place name, at the first stop that has it; stops without a name give none. */
  cities: { text: string; pin: number }[];
};
export function posterLayout(stops: Stop[], places: (string | null)[], cut: FilmCut, frame?: Size /* = FILM_FRAME */): PosterLayout;

export type LabelBox = { x: number; y: number; w: number; h: number }; // top-left, frame points
/** Greedy, in `cities` order. Tries right, left, below, above of the pin (`gap` away from its edge, centred on the other axis); null when none fits. */
export function placeLabels(input: {
  pins: Pt[]; pinRadius: number; cities: { pin: number }[]; sizes: Size[]; bounds: LabelBox; gap: number;
}): (LabelBox | null)[];

export function posterStats(input: { days: number; km: number; stops: number }): { value: string; label: string }[];
export function posterDates(startsAt: number, endsAt: number, timeZone: string): string;
```

Camera rule (the only algorithm the tests don't fully pin): fit area is x ∈ [0.14w, 0.86w], y ∈ [top·h + 1.6R, bottom·h − 1.6R] (R = `posterPinRadius`). Take the stops' mercator bbox (each side at least 1e-9, as `buildScene` does); `zoom = min(travelZoom(stops, frame.w, cut) − 0.4, log2(min(fitW / (512·dx), fitH / (512·dy))))`; the camera centre is chosen so the bbox centre lands on the fit area's centre. A mercator point projects to `x = w/2 + (mx − cx)·512·2^zoom` (same for y).

A label "fits" when it is fully inside `bounds`, does not intersect any pin's circle grown by 2 points (every pin, not just its own), and does not intersect any already placed label grown by 2 points.

- [ ] **Step 1: Write the failing tests** in `poster-layout.test.ts`. Build stops with the real `buildStops(photos, FILM_CUTS.share, "2027-01-12")` from hand-made `FilmPhoto`s (see `src/features/journey/__tests__/route.test.ts` for a factory). Tests and assertions:
  - `"puts every pin inside the map band"`: three stops spread ~200 km; every pin has `0.14w ≤ x ≤ 0.86w` and `POSTER_BAND.top·h + R ≤ y ≤ POSTER_BAND.bottom·h − R`; `line` equals the pins' `{x, y}`; `pins[i].photo === stops[i].shots[0].id`.
  - `"never zooms past the share cap"`: two stops in neighbouring 0.05° cells; `camera.zoom ≤ FILM_CUTS.share.maxZoom − 0.4` and `Number.isFinite` for `cx`, `cy`, `zoom`, every pin.
  - `"stays finite when the stops line up"`: two stops with the same latitude (bbox 0 tall) → all finite, pins inside the band.
  - `"asks for a bare map of the whole frame"`: `map` equals `{ cx: camera.cx, cy: camera.cy, zoom: camera.zoom, w: 432, h: 768, labels: false }`.
  - `"names each city once, at its first stop"`: places `["Kotor", "Kotor", null, "Mostar"]` → `cities` equals `[{ text: "Kotor", pin: 0 }, { text: "Mostar", pin: 3 }]`.
  - `placeLabels` `"prefers the right side"`: one pin at (100,100), R 20, size 60×20, gap 6, bounds 0,0,432,768 → `[{ x: 126, y: 90, w: 60, h: 20 }]`.
  - `"goes left when the right side leaves the bounds"`: pin at (400,100) → `x === 400 − 20 − 6 − 60`.
  - `"avoids other pins and other labels"`: two pins at (100,100) and (170,100) → first label is not on the right (it would cross pin 2); no two returned boxes intersect; no box intersects a pin circle.
  - `"drops a label with no room"`: a pin boxed in by four neighbours and bounds → `null`.
  - `posterStats` `"formats the three numbers"`: `{ days: 24, km: 1858, stops: 9 }` → `[{ value: "24", label: "días" }, { value: "1.858", label: "km" }, { value: "9", label: "lugares" }]`; `{ days: 1, km: 0, stops: 1 }` → labels `"día"`, `"km"`, `"lugar"`.
  - `posterDates` `"adds the year of the end"`: `Date.UTC(2026, 9, 3, 15)`, `Date.UTC(2026, 9, 26, 15)`, `"America/Argentina/Buenos_Aires"` → `"3 – 26 de octubre · 2026"`.
- [ ] **Step 2: Run** `npx jest src/features/journey/poster --maxWorkers=2` → FAIL (module not found).
- [ ] **Step 3: Implement** `poster-layout.ts` with the signatures above; export `thousands` in `scene.ts` (no behaviour change). The year comes from `dateFormatter("es-AR", { timeZone, year: "numeric" }).format(endsAt)`.
- [ ] **Step 4: Run** the same command → PASS; `npx jest src/features/journey/engine --maxWorkers=2` still PASS.
- [ ] **Step 5: Commit** `git commit -m "Afiche: cámara, pines y nombres (lógica pura)"`.

### Task 2: Map image, renderer and hook

**Files:**
- Modify: `src/features/journey/engine/assets.ts` (add `loadPosterMap`)
- Modify: `src/features/journey/film-photos.ts` (add `toFilmPhoto`, moved from `use-film.ts`), `src/features/journey/use-film.ts` (import it)
- Create: `src/features/journey/poster/render-poster.ts`, `src/features/journey/poster/use-poster.ts`
- Test: `src/features/journey/poster/__tests__/use-poster.test.tsx`
- Modify: `jest.setup.ts` (two mocks, next to the `use-film` ones)

**Interfaces:**
- Consumes: Task 1's exports; `LayerAsset`, `strokePaint`, `fillPaint`, `drawCover` from `../engine/draw`; `loadPhotos` from `../engine/assets`; `MAP_CREDIT` from `../engine/scene`; `makeStory`, `encodeStory`, `disposeSurface`, `layoutText`, `drawText`, `drawBrand`, `TITLE`, `SMALL`, `STORY_W`, `STORY_H` from `@/features/share/story-canvas`; `writeShareFile` from `@/features/share/share-story`; `fileId` from `@/features/share/file-id`; `geocodeStops`, `stopLabels` from `../places`.
- Produces:

```ts
// engine/assets.ts — one map image at `density` pixels per film point; its own one-entry cache (key: density + spec), never touches `lastLayers`.
// One retry; throws if both attempts fail.
export async function loadPosterMap(spec: MapLayerSpec, density: number): Promise<LayerAsset>;

// film-photos.ts — exactly the function that is private in use-film.ts today.
export function toFilmPhoto(p: RevealedPhoto, token: string): FilmPhoto | null;

// poster/render-poster.ts — Skia only, no React. Returns JPEG bytes of the 1080×1920 poster.
export type PosterInput = {
  name: string; dates: string; stats: { value: string; label: string }[];
  layout: PosterLayout; map: LayerAsset; photos: Record<string, SkImage | null>;
};
export function renderPoster(input: PosterInput): Uint8Array;

// poster/use-poster.ts
export type Poster =
  | { status: "loading" }
  | { status: "error"; offline: boolean; retry: () => void }
  | { status: "no-route" }
  | { status: "ready"; uri: string; version: string };
/** `photos`: the photos the Recorrido uses (already chosen). `enabled` only for a roll where `filmBlocked` is null. */
export function usePoster(args: { tripId: string; photos: RevealedPhoto[]; token: string | null; detail: TripDetail; enabled: boolean }): Poster;
```

`loadPosterMap` reuses the private `snapshot(spec, styleUri, f, label)` with `f = PixelRatio.get() / density` and the bare style for `labels: false`.

`renderPoster` paint order (pixels unless noted; film points are scaled with `canvas.scale(POSTER_SCALE, POSTER_SCALE)` inside a save/restore):
1. `makeStory()`; the map image over the whole frame (src = `map.src`).
2. Route (film points): `strokePaint("#5C7CFF", 10, 0.35)` then `strokePaint("#5C7CFF", 3.5, 1)` through `layout.line`.
3. Pins (film points), in order: white circle of `posterPinRadius`, then the photo `drawCover`ed in a circle 2.5 points smaller (fill `#d9d4c8` when the photo is null).
4. City labels: each as its own paragraph (system font `.AppleSystemUIFont`, 40 px, SemiBold, white, one line, with a black text shadow of blur 10 so it reads over the route); sizes in film points = px / 2.5 go to `placeLabels` with `bounds = { x: 0.03w, y: POSTER_BAND.top·h, w: 0.94w, h: (bottom − top)·h }`, `gap: 3`; paint the non-null ones.
5. Scrims (linear gradients, black): top from alpha 0.78 at y=0 to 0 at y=0.27·1920; bottom from 0 at y=0.68·1920 to 0.88 at y=0.76·1920, solid 0.88 below.
6. Title: `name`, `TITLE` with `maxLines: 2`, at x=72, top y=230, width 936; under it `dates` with `SMALL` at opacity 0.75, 10 px below the title.
7. Stats: three columns starting at x=72, each 312 wide, top y=1430: `value` 88 px Bold with tabular numbers, `label` 34 px opacity 0.7 right under it.
8. Brand: `drawBrand(canvas, STORY_W / 2, 1720, "#ffffff", "#5C7CFF")`.
9. Credit: `MAP_CREDIT`, 26 px, opacity 0.5, x=40, bottom at 1920 − 30.
10. `encodeStory(surface)`; dispose the surface in a `finally`.

`usePoster` mirrors `useFilm` (effect keyed by `version`, `live` flag, `retry` via an attempt counter, `isOffline` through `expo-network`):
`filmCandidates(photos)` → `toFilmPhoto` → `buildStops(used, FILM_CUTS.share, localDay(startsAt, timezone))`; fewer than 2 stops → `no-route`; `geocodeStops(stops, 5000)` → `stopLabels(geocoded, true, geocoded.map((g) => g.spot))`; `posterLayout(stops, places, FILM_CUTS.share)`; `loadPosterMap(layout.map, POSTER_SCALE)`; `loadPhotos(stops.map((s) => ({ id: s.shots[0].id, image: s.shots[0].thumb })))`; `renderPoster({ name, dates: posterDates(startsAt, endsAt, timezone), stats: posterStats({ days, km: routeKm(stops), stops: stops.length }), … })` with `days` computed as in `use-film.ts`; `writeShareFile(bytes, \`rollo-afiche-${fileId(version)}.jpg\`)`. `version = \`${tripId}:${fileId(sorted photo ids joined by ",")}:${fileId(\`${name}|${startsAt}|${endsAt}|${timezone}\`)}\``. A result for another version is never handed out (return `{ status: "loading" }`). No token or not enabled → loading, nothing requested.

`jest.setup.ts` additions:
```ts
jest.mock("@/features/journey/poster/render-poster", () => ({ renderPoster: jest.fn(() => new Uint8Array()) }));
jest.mock("@/features/journey/poster/use-poster", () => ({ usePoster: jest.fn(() => ({ status: "loading" })) }));
```

- [ ] **Step 1: Write the failing test** `use-poster.test.tsx`, modelled on `src/features/journey/__tests__/use-film.test.tsx` (same photo/detail factories, `jest.unmock("../use-poster")`, mock `../../engine/assets` with `loadPosterMap`/`loadPhotos`, mock `../../places` `geocodeStops`, mock `@/features/share/share-story` `writeShareFile` → `"file:///cache/afiche.jpg"`, mock `expo-network`). Tests:
  - `"builds the poster and hands its file"`: two places → `ready` with `uri === "file:///cache/afiche.jpg"`; `loadPosterMap` called with a spec whose `labels === false`, `zoom ≤ 9.6`, and density `2.5`; `renderPoster` called with `stats[2]` equal to `{ value: "2", label: "lugares" }` and `name: "Viaje"`.
  - `"only geocodes cell centres"`: every `{ lat, lng }` passed to `geocodeStops` is a multiple of 0.05 plus 0.025 (to 1e-6), not the photos' coordinates.
  - `"has no route with a single place"` → `no-route`, `loadPosterMap` not called.
  - `"still builds without place names"`: `geocodeStops` resolves all `{ city: null, country: null, spot: null }` → `ready`; `renderPoster` got `layout.cities` equal to `[]`.
  - `"reports a failed map, offline, and retries"`: `loadPosterMap` rejects and network is disconnected → `error` with `offline: true`; make it resolve, call `retry()` → `ready`.
  - `"requests nothing while disabled or without a token"` → `loading`, no calls.
  - `"pins never use an author's avatar"`: every image passed to `loadPhotos` has an id that does not start with `"avatar:"`.
- [ ] **Step 2: Run** `npx jest src/features/journey/poster/__tests__/use-poster.test.tsx --maxWorkers=2` → FAIL.
- [ ] **Step 3: Implement** `toFilmPhoto` move, `loadPosterMap`, `render-poster.ts`, `use-poster.ts`, the two `jest.setup.ts` mocks.
- [ ] **Step 4: Run** `npx jest src/features/journey --maxWorkers=2` → PASS (poster and the existing film tests); `npm run typecheck` → no errors.
- [ ] **Step 5: Commit** `git commit -m "Afiche: imagen del mapa, dibujo con Skia y armado"`.

### Task 3: The "Afiche" segment in Compartir

**Files:**
- Modify: `src/features/share/share-story.ts`, `src/features/share/roll-videos.ts`, `src/features/share/use-roll-videos.ts`, `src/features/share/share-story-screen.tsx`
- Create: `src/features/share/poster-share.tsx`
- Test: `src/features/share/__tests__/share-story.test.ts`, `src/features/share/__tests__/roll-videos.test.ts`, `__tests__/share-story.test.tsx`
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-11-26-afiche-del-viaje-design.md` (status line → "aprobado por el dueño (2026-11-26)")

**Interfaces:**
- Consumes: `usePoster`, `Poster` (Task 2); `filmPhotos` from `@/features/journey/film-photos`; `SharePills`, `RetryPill`, `STORY_RATIO`, `shareImageToWhatsApp`, `shareMore`, `isShareCancel` (existing).
- Produces:

```ts
// share-story.ts — the image as the story's full-screen background, nothing on top.
export async function shareImageToInstagramStories(imageUri: string): Promise<void>;
// = Share.shareSingle({ social: INSTAGRAM_STORIES, appId: META_APP_ID, backgroundImage: imageUri })

// roll-videos.ts — the poster needs no video module: only the film's own conditions.
export function rollHasPoster(input: { detail: TripDetail | null; ready: boolean; feedFailed: boolean; poolStops: number }): boolean;
// true iff ready && !feedFailed && detail !== null && filmBlocked(detail, poolStops) === null

// use-roll-videos.ts — one stop count for both answers; useRollVideos becomes `useRollPieces(args).videos`.
export function useRollPieces(args: { detail: TripDetail | null; photos: RevealedPhoto[]; ready: boolean; feedFailed: boolean }): { videos: RollVideoKind[]; poster: boolean };

// poster-share.tsx — mounted only while the Afiche segment is selected.
export function PosterShare(props: {
  tripId: string; detail: TripDetail; /** filmCandidates of the roll */ candidates: RevealedPhoto[];
  /** the Recorrido's selection */ selection: readonly string[]; token: string | null; instagram: boolean; whatsapp: boolean;
}): React.ReactNode;
```

Screen changes: `SharePiece` gains `"poster"` with label `"Afiche"`; `pieces` order is `collage`, `route` (if `canFilm`), `poster` (if `pieces.poster`), `sheet` (if `canSheet`); `<PosterShare key="poster" … />` when `selected === "poster"` (it counts as `journeyOn`, so the collage body is not rendered). No new `kind` param.

`PosterShare` copy and states (preview box and layout as `FilmBody`'s: 9:16 box in the flexible area, `borderRadius: 12`):
- loading: `ActivityIndicator` with `accessibilityLabel="Armando el afiche"` and the text `Armando el afiche…`.
- ready: `expo-image` `Image` of `uri` (`cachePolicy="none"`, `contentFit="cover"`, `accessibilityLabel="Vista previa del afiche"`) and `SharePills` (`disabled={false}`): Instagram → `shareImageToInstagramStories(uri)`, WhatsApp → `shareImageToWhatsApp(uri)`, Más opciones → `shareMore(uri)`. A rejection that is not `isShareCancel` shows `ErrorText` `No se pudo compartir. Probá de nuevo.`
- no-route: `Footnote` `Con estas fotos no hay recorrido: elegí fotos de al menos dos lugares.`, no pills.
- error: `ErrorText` `Para armar el afiche hace falta conexión.` when `offline`, else `No se pudo armar el afiche. Probá de nuevo.`, with `RetryPill` → `retry`.

- [ ] **Step 1: Write the failing tests.**
  - `share-story.test.ts` `"shares an image as the story background"`: `shareImageToInstagramStories("file:///a.jpg")` calls `Share.shareSingle` with an object containing `backgroundImage: "file:///a.jpg"` and `appId`, and no `stickerImage` / `backgroundVideo` keys.
  - `roll-videos.test.ts` `rollHasPoster`: true for a revealed, non-private trip with `poolStops: 2`; false for each of: an event, `featuringDisabled`, unrevealed, `poolStops: 1`, `ready: false`, `feedFailed: true`, `detail: null`. (It has no `videoAvailable` input: that is the point.)
  - `__tests__/share-story.test.tsx` (follow the existing Recorrido tests there for setup; `usePoster` is the global mock, set per test with `jest.mocked(usePoster).mockReturnValue(…)`):
    - `"offers Afiche next to Recorrido on a roll with a route"`: the segmented control's values are `["Collage", "Recorrido", "Afiche", "Resumen"]` (or without "Resumen" if that fixture has fewer than 6 photos — assert the relative order Collage, Recorrido, Afiche).
    - `"does not offer Afiche without a route"`: photos in one place → no "Afiche" value.
    - `"shows the poster and shares it to Instagram"`: select Afiche with `usePoster` ready (`uri: "file:///cache/afiche.jpg"`) → the image labelled "Vista previa del afiche" is shown; pressing "Instagram" calls `Share.shareSingle` with `backgroundImage: "file:///cache/afiche.jpg"`; pressing "Más opciones" calls the system share with `url: "file:///cache/afiche.jpg"`.
    - `"says there is no route when the chosen photos leave one place"`: `usePoster` → `{ status: "no-route" }` → the notice text is shown and there is no "Instagram" button.
    - `"offers a retry when the poster cannot be built"`: `{ status: "error", offline: true, retry }` → "Para armar el afiche hace falta conexión." and pressing "Reintentar" calls `retry`.
- [ ] **Step 2: Run** `npx jest src/features/share/__tests__/share-story.test.ts src/features/share/__tests__/roll-videos.test.ts __tests__/share-story.test.tsx --maxWorkers=2` → the new tests FAIL.
- [ ] **Step 3: Implement** the functions, `PosterShare` and the screen change.
- [ ] **Step 4: Run** the same command plus `npx jest src/features/share --maxWorkers=2` → PASS; `npm run typecheck` → no errors.
- [ ] **Step 5: Update `CLAUDE.md`**: after the "Resumen en video" bullet add one bullet **"Afiche del viaje"** (what it shows, who has it, the "Collage | Recorrido | Afiche | Resumen" control, destinations, the privacy rules it inherits, files: `journey/poster/poster-layout.ts`, `render-poster.ts`, `use-poster.ts`, `engine/assets.ts` `loadPosterMap`, `share/poster-share.tsx`, `rollHasPoster` / `useRollPieces`, the Jest mocks, the spec path); mention `poster` in the `journey` line of "Estructura del código". Set the spec's status line to approved.
- [ ] **Step 6: Commit** `git commit -m "Afiche del viaje en Compartir"`.
