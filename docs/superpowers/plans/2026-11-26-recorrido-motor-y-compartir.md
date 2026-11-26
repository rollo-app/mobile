# Recorrido en video · paso 2: el motor de verdad y "Recorrido" en Compartir — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que quien abre "Compartir" en un rollo de viaje revelado pueda ver su recorrido como película, elegir las fotos y mandarlo a Instagram, guardarlo o compartirlo como video.

**Architecture:**
- El prototipo (`src/features/journey-spike/`, sin commitear) pasa a código de verdad en `src/features/journey/`: ruta y tiempos (`route.ts`), escena pura (`engine/scene.ts`), dibujo con Skia (`engine/draw.ts`), carga de imágenes (`engine/assets.ts`) y un reproductor (`film-player.tsx`).
- Un hook, `use-film.ts`, arma todo para un rollo: qué fotos entran, la ruta, la escena y sus imágenes.
- La pantalla "Compartir" gana el control "Collage | Recorrido" y la pieza `journey-share.tsx`, que usa el reproductor, la elección de fotos y la exportación del paso 1 (`export-film.ts`, `frame-source.ts`, `modules/rollo-video`).

**Tech Stack:** TypeScript, `@shopify/react-native-skia` 2.14.0, Reanimated 4, `@maplibre/maplibre-react-native` (`StaticMapImageManager`), `expo-location` (nombres de lugares), `expo-media-library`, TanStack Query, Jest.

**Spec:** `docs/superpowers/specs/2026-11-26-recorrido-en-video-design.md`. Este plan cubre los pasos 2 y 3 de su "Orden de trabajo" y "Elegir las fotos del video para compartir". No cubre el recorrido dentro del revelado (plan aparte) ni el build de producción.

## Global Constraints

- Rama `feature/recorrido-en-video`, worktree `mobile-revelado`. Sin push ni PR.
- **El prototipo no se commitea** (`src/features/journey-spike/`, `app/dev/journey.tsx` y los cambios sueltos en `app/_layout.tsx`, `src/features/profile/dev-moment-rows.tsx`, `src/test/routes.ts`). Cada tarea commitea solo lo que nombra, con `git add <rutas>`. Nunca `git add -A`, `git add .` ni `git commit -a`. Es la referencia de la que se porta: se lee, no se importa desde código de verdad.
- Código en inglés; textos de pantalla en rioplatense, tal como figuran acá; commits en español con la línea de coautoría de la sesión.
- TDD. Tests: solo los relacionados, con `--maxWorkers=2`. Typecheck: `npm run typecheck`.
- Los archivos que Jest carga no importan valores de Skia en el nivel superior salvo los que ya se mockean en `jest.setup.ts`; `route.ts` y `engine/scene.ts` son puros (solo `import type`).
- Sin dependencias nuevas. Nada que se cargue al abrir la app importa esta feature.
- **Corte para compartir (`FILM_CUTS.share`)**, valores exactos:
  - cuadro canónico **432×768** puntos; exportación 1080×1920, 30 cuadros por segundo, 6.000.000 bps;
  - hasta **15** fotos, hasta **4** por parada, hasta **15** paradas; película entera **≤ 59.000 ms**, incluida la placa final de **2.500 ms**;
  - `hookMs 1800`, `diveMs 1400`, `dwellMs 2600`, `extraPhotoMs 1800`, `developMs 600`, `overviewMs 1500`, `hopMinMs 700`, `hopMaxMs 1500`, `titleDelayMs 400`, `doneDelayMs 2600`, `cardLeaveMs 200`, `pushIn 0.05`;
  - sin luz roja; el mapa se atenúa con negro al 20 % mientras hay fotos;
  - ubicación: cada parada va al **centro de su celda de 0,05°**, dos paradas seguidas nunca comparten celda, un lugar mide como mínimo **2,5 km de radio**, zoom de viaje **máximo 10**, título **solo ciudad** (y país si el viaje cruza países).
- **Corte del revelado (`FILM_CUTS.reveal`)** queda definido pero sin uso en este plan: tiempos del prototipo (`JOURNEY_TUNING`), luz roja, sin placa final, sin celdas ni tope de zoom, hasta 10 paradas con una foto cada una.
- Fotos del video: solo `shareable === true`, `type === "photo"`, con `lat` y `lng`, no archivadas. Rollo revelado, que no sea evento, no privado.
- Autor de cada foto: sello circular centrado sobre el borde de abajo del papel, diámetro **11,5 %** del ancho del cuadro, aro blanco de 2 puntos; sin foto de perfil, la inicial en blanco sobre `memberColor(author.id)`. En la hoja de cuatro fotos, sello al 60 % de **7,5 %** del ancho, centrado abajo dentro de cada foto. La foto que va sobre el pin mide 50 % del ancho y su centro queda a `0.088 × alto` por encima del pin más media altura del papel.
- Placa final: negro, logo (tres círculos `#5C7CFF` con opacidades 0,22 / 0,45 / 1 sobre la caja de 120: centros (60,60) r 34, (66,54) r 24, (71,49) r 14; ancho 26 % del cuadro, centro al 42 % del alto), "Rollo Project" debajo, y la insignia oficial de Apple (el SVG de `web/scripts/site/app-store-badge.svg`, 119,66407 × 40, sin modificar) al 40 % del ancho, centrada al 62 % del alto. Aparece en 400 ms.
- El crédito del mapa, "© OpenStreetMap · OpenFreeMap", lo dibuja el motor en todos los cuadros con mapa (abajo a la izquierda, chico, blanco al 40 %); no en la placa final.
- Sin sonido. Sin hápticos en la vista previa.
- Textos de pantalla: "Collage", "Recorrido", "Armando el recorrido…", "Otra versión", "Instagram", "Guardar video", "Más opciones", "Armando el video… 42 %", "Cancelar", "Guardado en Fotos", "Lo guardamos en tus fotos. Elegilo en tu historia.", "Para armar el recorrido hace falta conexión.", "No se pudo armar el recorrido. Probá de nuevo.", "No se pudo armar el video. Probá de nuevo.", "Con estas fotos no hay recorrido: elegí fotos de al menos dos lugares.", "Reproducir".

## Review Focus

1. **Fotos elegidas que dejan una sola parada:** la pantalla lo dice y no ofrece destinos; nunca arma una película de una parada. Tests en las Tasks 1 y 7.
2. **Un rollo donde ninguna foto compartible tiene ubicación, un evento o un rollo privado:** el control "Collage | Recorrido" no aparece y Compartir queda como hoy. Test en la Task 7.
3. **Sin conexión o con el mapa fallando:** mensaje con "Reintentar", sin pantalla en blanco ni spinner eterno. Test en la Task 5.
4. **Salir de la pantalla o cambiar de versión en medio de una exportación:** se cancela y no queda archivo; no se comparte un video de la versión anterior. Tests en la Task 7.
5. **Un build sin el módulo de video:** "Recorrido" no aparece. Test en la Task 7.

---

### Task 1: `route.ts`, la ruta y los tiempos

**Files:**
- Create: `src/features/journey/route.ts`
- Test: `src/features/journey/__tests__/route.test.ts`
- Reference (read only): `src/features/journey-spike/journey.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ImageRef = { uri: string; headers?: Record<string, string> };
  export type FilmPhoto = { id: string; authorId: string; authorName: string; authorAvatar: ImageRef | null; lat: number; lng: number; takenAt: number; day: string; likeCount: number; thumb: ImageRef; display: ImageRef };
  export type Stop = { index: number; lat: number; lng: number; photos: FilmPhoto[]; shots: FilmPhoto[]; shotDays: number[]; dayNumber: number; lastDayNumber: number };
  export type Timeline = { arrive: number[]; leave: number[]; depart: number[]; move: number[]; swaps: number[][]; overviewAt: number; hitAt: number; titleAt: number; doneAt: number };
  export type FilmCut = { /* every timing above */ maxStops: number; maxPhotos: number; maxPerStop: number; maxTotalMs: number; endCardMs: number; redLight: boolean; snapToCell: boolean; minPlaceKm: number; maxZoom: number; cityTitles: boolean };
  export const FILM_FRAME = { w: 432, h: 768 };
  export const CELL_DEG = 0.05;
  export const FILM_CUTS: { share: FilmCut; reveal: FilmCut };
  export function cellCenter(p: { lat: number; lng: number }): { lat: number; lng: number };
  /** `firstDay`: the roll's first local day ("2026-07-01"); day numbers count from it. */
  export function buildStops(photos: FilmPhoto[], cut: FilmCut, firstDay: string): Stop[];
  export function travelZoom(stops: Stop[], frameWidth: number, cut: FilmCut): number;
  export function buildTimeline(stops: Stop[], zoom: number, frameWidth: number, cut: FilmCut): Timeline;
  /** `timeline.doneAt + cut.endCardMs`. */
  export function filmMs(timeline: Timeline, cut: FilmCut): number;
  export function routeKm(stops: Stop[]): number;
  export function shotTitle(stop: Stop, j: number): string;
  export function toMercator(p: { lat: number; lng: number }): { x: number; y: number };
  ```

Port `buildStops`, `shotCounts`, `routeBySequence`, `findPlaces`, `buildTimeline`, `hopMs`, `travelZoom`, `routeKm`, `shotTitle`, `dayLabel`, `toMercator` and their helpers from the prototype, with these changes:
- The cap that `buildTimeline` enforces is `cut.maxTotalMs - cut.endCardMs`; shortened hops are rounded **down**.
- `minPlaceKm`: the place radius is `clamp(extentKm * 0.06, cut.minPlaceKm, 15)` (prototype: 0.5).
- `snapToCell`: a stop's `lat`/`lng` is `cellCenter` of the median of its photos; after snapping, consecutive stops in the same cell are merged (photos joined, in time order).
- Photos of a stop: the `k` with the most `likeCount`, ties broken by spreading over the stop's time as today, then shown in time order.
- `dayNumber`, `lastDayNumber` and `shotDays` count from `firstDay`, not from the first photo.
- `travelZoom` is clamped to `[3, cut.maxZoom]` (share 10, reveal 13).

- [ ] **Step 1: Write the failing tests.** A helper `photo(id, lat, lng, minutes, over?)` builds a `FilmPhoto` on day `"2026-07-01"` plus `minutes`. Cases, each an `it`:
  - `cellCenter({ lat: -41.137, lng: -71.303 })` is `{ lat: -41.125, lng: -71.325 }` (to 6 decimals).
  - Share cut: three photos within 800 m and one 60 km away give 2 stops, each at a cell centre.
  - Share cut: two groups 3 km apart that fall in the same cell give 1 stop (so no route).
  - Share cut: two groups 1.5 km apart in different cells still give 1 stop (`minPlaceKm` 2.5).
  - Reveal cut: the same two groups 3 km apart give 2 stops at exact coordinates.
  - A stop with likes `[0, 5, 2, 9]` and `maxPerStop` 2 shows the photos with 9 and 5, in time order.
  - With `firstDay` two days before the first photo, the first stop's `dayNumber` is 3.
  - Four people, one split day (the prototype's synthetic trip, port its data): 6 stops.
  - `travelZoom` of stops 2 km apart is 10 in the share cut and above 10 in the reveal cut.
  - 300 seeded random trips per cut (port the generator from `scene-check.mjs`): `filmMs` is `<= 59_000`, every `arrive[i] < leave[i] <= depart[i]`, and in the share cut no two consecutive stops share a cell.
  - `FILM_CUTS.share` has `maxPhotos 15`, `maxStops 15`, `maxPerStop 4`, `endCardMs 2500`, `redLight false`; `FILM_CUTS.reveal` has `endCardMs 0`, `redLight true`, `snapToCell false`.
- [ ] **Step 2: Run to see them fail.** `npx jest src/features/journey/__tests__/route.test.ts --maxWorkers=2` → cannot find `../route`.
- [ ] **Step 3: Implement `route.ts`.** Pure, no imports.
- [ ] **Step 4: Run to see them pass,** then `npm run typecheck`.
- [ ] **Step 5: Commit.** `git add src/features/journey/route.ts src/features/journey/__tests__/route.test.ts` · `Recorrido: ruta, paradas y tiempos de la película`

### Task 2: La escena (`engine/model.ts`, `engine/scene.ts`)

**Files:**
- Create: `src/features/journey/engine/model.ts`, `src/features/journey/engine/scene.ts`
- Test: `src/features/journey/engine/__tests__/scene.test.ts`
- Reference: `src/features/journey-spike/engine/model.ts`, `scene.ts`, `scene-check.mjs`

**Interfaces:**
- Consumes: `Stop`, `Timeline`, `FilmCut`, `toMercator`, `shotTitle` (Task 1).
- Produces: the prototype's contract (`SceneInput`, `Scene`, `FrameModel`, `PrintModel`, `PrintPhoto`, `MapLayerSpec`, `LayoutKind`, `SceneText`, `TextRole`) with:
  - `SceneInput.timing` gains nothing new beyond the prototype's (`endCardMs`, `redLight` are already there);
  - `FrameModel.credit: number` — opacity of the map credit: 1 while the map shows, fading to 0 with the end card;
  - `PrintModel.seal: "edge" | "cell"` is not needed: the renderer derives it from `photos.length`.
  ```ts
  export function buildScene(input: SceneInput): Scene;
  export function frameAt(scene: Scene, t: number): FrameModel;   // "worklet"
  /** The scene input for these stops in this cut, on the canonical frame. */
  export function sceneInput(args: { name: string; stops: Stop[]; places: (string | null)[]; cut: FilmCut; seed: number; days: number; km: number; photos: number }): SceneInput;
  ```
  `sceneInput` builds `hookStats` ("24 días · 1.858 km") and `closingStats` ("24 días · 1.858 km · 11 fotos") with thousands dots and singulars ("1 día", "1 foto"), and `authors` from the stops' shots (initial via the first letter of `authorName`, uppercased, `"?"` when empty; `color` is filled in by the caller — take it as an argument `colorOf: (authorId: string) => string`).

Port `scene.ts` as it is in the prototype (it already has the end card, the seal geometry of the print layouts and the lifted on-the-pin print). Keep every per-frame function a worklet.

- [ ] **Step 1: Write the failing tests** by porting every check of `scene-check.mjs` into Jest `it`s (same generators, same seeds), plus:
  - `sceneInput(...)` texts: `"1 día · 3 km"` and `"24 días · 1.858 km · 11 fotos"`.
  - share cut: `scene.durationMs === timeline.doneAt + 2500`; `frameAt(scene, doneAt).endCard.opacity` is 0, at `doneAt + 400` it is 1; `credit` is 1 before `doneAt` and 0 at the end.
  - reveal cut: `endCard.opacity` is 0 at every sampled time and `durationMs === doneAt`.
  - the on-the-pin print (`layout "print"`) is `0.5 × frame.w` wide.
- [ ] **Step 2: Run to see them fail.**
- [ ] **Step 3: Implement** `model.ts` and `scene.ts`.
- [ ] **Step 4: Run to see them pass,** then typecheck.
- [ ] **Step 5: Commit.** `Recorrido: la escena de la película (pura) y su contrato`

### Task 3: El dibujo (`engine/draw.ts`) y la insignia

**Files:**
- Create: `src/features/journey/engine/draw.ts`, `src/features/journey/engine/badge.ts`
- Reference: `src/features/journey-spike/engine/draw.ts`, `badge.ts`

**Interfaces:**
- Consumes: the contract of Task 2; `Assets` (declare it here, Task 4 fills it):
  ```ts
  export type LayerAsset = { image: SkImage; src: { x: number; y: number; w: number; h: number } };
  export type Assets = { layers: (LayerAsset | null)[]; photos: Record<string, SkImage | null>; texts: (SkParagraph | null)[] };
  export function drawFrame(canvas: SkCanvas, scene: Scene, model: FrameModel, assets: Assets): void;   // "worklet"
  ```

Port `draw.ts` as it is in the prototype (seal, end card with the official badge and its hand-drawn fallback, no-tint dimming, eased develop). Add: the map credit, painted from `model.credit` with a paragraph of role `credit` (add the role to the contract and to `buildScene`'s texts), bottom left, 16 points in, baseline 10 points above the bottom edge.

Jest cannot load Skia, so this task has no unit test. Its check is the type checker here and the rendered frames in Task 8.

- [ ] **Step 1: Port `badge.ts` and `draw.ts`,** with the credit.
- [ ] **Step 2: Check.** `npm run typecheck` → no errors. `npx jest src/features/journey --maxWorkers=2` → still green (nothing imports `draw.ts` yet).
- [ ] **Step 3: Commit.** `Recorrido: el dibujo de cada cuadro con Skia`

### Task 4: Las imágenes (`engine/assets.ts`) y los lugares (`places.ts`)

**Files:**
- Create: `src/features/journey/engine/assets.ts`, `src/features/journey/places.ts`
- Test: `src/features/journey/__tests__/places.test.ts`
- Reference: `src/features/journey-spike/engine/assets.ts`, `use-stop-places.ts`; `src/features/gallery/place.ts`

**Interfaces:**
- Produces:
  ```ts
  // places.ts (pure + one async function)
  /** City (and country when the stops span more than one). Never a district, street or point of interest. */
  export function stopLabels(addresses: ({ city: string | null; country: string | null } | null)[], cityOnly: boolean, spots?: (string | null)[]): (string | null)[];
  /** Reverse-geocodes every stop (expo-location), giving up after `capMs` with what it has. */
  export function geocodeStops(stops: { lat: number; lng: number }[], capMs?: number): Promise<{ city: string | null; country: string | null; spot: string | null }[]>;
  // engine/assets.ts
  export function loadLayers(specs: MapLayerSpec[], onProgress: (done: number, total: number) => void): Promise<(LayerAsset | null)[]>;
  export function loadPhotos(photos: { id: string; image: ImageRef }[]): Promise<Record<string, SkImage | null>>;
  export function layoutTexts(texts: SceneText[], frame: Size): (SkParagraph | null)[];
  /** True when one of the map images is missing: the film cannot be shown. */
  export function incomplete(assets: Assets): boolean;
  ```

Port from the prototype, keeping: the `file://` fix for MapLibre's snapshot path, deleting each snapshot after reading it, the bare (no labels) style file, two snapshots at a time with one retry, the reuse of the last film's layers and photos, decoding photos while loading. Drop the `console.log`s. The text roles gain `credit` (caption size, white 40 %).

- [ ] **Step 1: Write the failing tests** for `stopLabels`:
  - one country: `["Bariloche", "El Bolsón"]`; two countries: `["Budva, Montenegro", "Split, Croatia"]`;
  - `cityOnly` true with two stops in the same city gives the city twice, never the spot;
  - `cityOnly` false with two stops in the same city and spots gives the spots (the prototype's behaviour, for the reveal cut);
  - a stop with no address gives `null`.
- [ ] **Step 2: Run to see them fail.**
- [ ] **Step 3: Implement** `places.ts` and port `engine/assets.ts`.
- [ ] **Step 4: Run to see them pass,** then typecheck.
- [ ] **Step 5: Commit.** `Recorrido: imágenes del mapa, fotos, textos y nombres de lugar`

### Task 5: `use-film.ts`, todo lo de un rollo

**Files:**
- Create: `src/features/journey/film-photos.ts`, `src/features/journey/use-film.ts`
- Test: `src/features/journey/__tests__/film-photos.test.ts`, `src/features/journey/__tests__/use-film.test.tsx`

**Interfaces:**
- Consumes: Tasks 1, 2, 4; `RevealedPhoto` and `mediaSource` (`@/features/media/revealed`), `TripDetail`, `isEvent` (`@/features/events/event`), `memberColor`, `avatarUri`.
- Produces:
  ```ts
  // film-photos.ts (pure)
  export const FILM_MAX = 15;
  /** Photos that may leave the roll in a film: shareable, a photo, with coordinates, not archived. */
  export function filmCandidates(photos: RevealedPhoto[]): RevealedPhoto[];
  /** The chosen candidates (any order), or every candidate when the selection has none usable. */
  export function filmPhotos(candidates: RevealedPhoto[], selection: readonly string[]): RevealedPhoto[];
  /** Why this roll has no film to share, or null: "event" | "private" | "unrevealed" | "no-route". */
  export function filmBlocked(detail: TripDetail, stops: number): "event" | "private" | "unrevealed" | "no-route" | null;
  /** How many stops the share cut gives these candidates (pure and cheap: no geocoding, no images). The screen uses it to decide whether to offer "Recorrido" without loading a film. */
  export function filmStopCount(candidates: RevealedPhoto[], firstDay: string): number;
  // use-film.ts
  export type Film =
    | { status: "loading"; done: number; total: number }
    | { status: "error"; offline: boolean; retry: () => void }
    | { status: "no-route" }
    | { status: "ready"; scene: Scene; assets: Assets; stops: Stop[]; photos: FilmPhoto[]; durationMs: number; version: string };
  /** `version` changes with the trip, the photo set and the seed: an exported file belongs to one version. */
  export function useFilm(args: { tripId: string; photos: RevealedPhoto[]; token: string | null; detail: TripDetail; seed: number; enabled: boolean }): Film;
  ```
  `useFilm` builds stops with `FILM_CUTS.share` and the roll's first local day, geocodes the stops (5 s cap), builds the scene on `FILM_FRAME`, loads the assets (photos: thumbs; avatars under `avatar:<authorId>`), and reports `no-route` for fewer than 2 stops. `offline` comes from `expo-network`. The days of the closing line are the roll's (start to end, inclusive, in its time zone); the photo count is `detail`'s total.

- [ ] **Step 1: Write the failing tests.**
  - `filmCandidates` drops a video, an archived photo, a non-shareable one and one without coordinates.
  - `filmPhotos` with an empty or stale selection returns every candidate; with ids, only those.
  - `filmStopCount`: candidates in one place give 1; in two towns 60 km apart, 2; none, 0.
  - `filmBlocked`: event → `"event"`; `featuringDisabled` → `"private"`; not revealed → `"unrevealed"`; 1 stop → `"no-route"`; otherwise `null`.
  - `useFilm` (mock `./engine/assets` and `./places`): goes `loading` → `ready` with a scene whose `durationMs <= 59_000`; photos in one place → `no-route` and the assets are never requested; a rejected `loadLayers` → `error`, and `retry()` asks again; `version` changes when the seed changes and when a photo leaves the set.
- [ ] **Step 2: Run to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to see them pass,** then typecheck.
- [ ] **Step 5: Commit.** `Recorrido: qué fotos entran y el armado de la película de un rollo`

### Task 6: El reproductor (`film-player.tsx`)

**Files:**
- Create: `src/features/journey/film-player.tsx`
- Modify: `jest.setup.ts` (mock, next to the other Skia mocks)
- Test: `src/features/journey/__tests__/film-player.test.tsx`

**Interfaces:**
- Consumes: `Scene`, `Assets`, `frameAt`, `drawFrame`.
- Produces:
  ```tsx
  /** The film in a 9:16 box of `height`. Plays once from the start when `playing`, holds the last frame before the end card when it ends, and draws nothing while `paused` (an export is drawing the same scene on another thread). */
  export function FilmPlayer(props: { scene: Scene; assets: Assets; height: number; playing: boolean; paused: boolean; onEnd?: () => void }): JSX.Element;
  ```
  It scales the canonical frame to the box (`height × 9/16` wide), runs on Skia's clock like the prototype's player (a `Picture` built in a derived value), has no haptics or sound, and with "Reducir movimiento" does not start by itself: it shows the last frame of the route and a "Reproducir" button.
- `jest.setup.ts`: `jest.mock("@/features/journey/film-player", …)` renders a `View` with `testID="film-player"` and `accessibilityLabel` `"playing"`, `"paused"` or `"idle"`; the player's own test unmocks it only for what does not need Skia (the box size and the "Reproducir" button, with `@shopify/react-native-skia` mocked locally).

- [ ] **Step 1: Write the failing tests:** the box is `height × 9/16` by `height`; with reduce motion on, "Reproducir" shows and pressing it starts; without it, no button.
- [ ] **Step 2: Run to see them fail.**
- [ ] **Step 3: Implement,** porting the drawing loop from `journey-spike/engine/engine-player.tsx` without its logs, cover, buttons or haptics.
- [ ] **Step 4: Run to see them pass,** then typecheck.
- [ ] **Step 5: Commit.** `Recorrido: reproductor de la película`

### Task 7: "Recorrido" en la pantalla Compartir

**Files:**
- Create: `src/features/share/film-selection.ts`, `src/features/share/journey-share.tsx`, `src/features/share/share-video.ts`
- Modify: `src/features/share/share-story-screen.tsx`, `src/features/share/share-pick-screen.tsx`, `app/share-pick.tsx`, `app/share-story.tsx`
- Test: `src/features/share/__tests__/film-selection.test.ts`, `src/features/share/__tests__/share-video.test.ts`, `__tests__/share-story.test.tsx`, `__tests__/share-pick.test.tsx`

**Interfaces:**
- Consumes: `useFilm`, `filmCandidates`, `filmPhotos`, `filmBlocked`, `FILM_MAX` (Task 5); `FilmPlayer` (Task 6); `exportFilm`, `createFrameSource` (paso 1); `videoAvailable`, `openVideo`, `appendFrame`, `appendTexture`, `finishVideo`, `cancelVideo`, `shareVideoToInstagram` (`modules/rollo-video`); `toggleSelection` (`collage-selection.ts`, its `max` argument).
- Produces:
  ```ts
  // film-selection.ts: the same store as collage-selection.ts, keyed apart
  export function getFilmSelection(tripId: string): readonly string[];
  export function setFilmSelection(tripId: string, ids: readonly string[]): void;
  export function useFilmSelection(tripId: string): readonly string[];
  // share-video.ts
  export const STORIES_DIRECT_MAX_MS = 20_000;
  /** "stories" for a film Instagram's Stories route takes whole, "library" for a longer one (save to Photos, then open Instagram). */
  export function instagramRoute(durationMs: number): "stories" | "library";
  export function saveVideo(uri: string): Promise<void>;                       // Photos, add-only permission; throws PermissionDeniedError
  export function shareVideoMore(uri: string): Promise<void>;                  // the system sheet
  export function shareVideoToInstagramApp(uri: string, durationMs: number): Promise<"stories" | "library">;
  ```
  `shareVideoToInstagramApp`: `"stories"` → `shareVideoToInstagram("stories", uri, META_APP_ID)`; `"library"` → `saveVideo`, then `Linking.openURL("instagram://story-camera")`. The paso 1 measurements may change `STORIES_DIRECT_MAX_MS` or the URL; they are the only two values to touch.
- Screen behaviour:
  - `ShareStoryScreen` shows a native segmented control "Collage | Recorrido" above the preview only when `kind` is the collage, `videoAvailable` is true and `filmBlocked(detail, filmStopCount(filmCandidates(photos), firstDay))` is `null`. `useFilm` is enabled only while Recorrido is selected, so opening Compartir on Collage loads no map. It opens on Collage. `app/share-story.tsx` also accepts `kind=journey` (opens on Recorrido).
  - `JourneyShare` (the Recorrido body): `FilmPlayer` in the preview box; while `loading`, "Armando el recorrido…" with a spinner; the photo strip with "+" (the collage's `CollageStrip`, showing the film's photos) opening `/share-pick?tripId=…&kind=journey`; "Otra versión" (new seed); the pills "Instagram" (only with Instagram installed), "Guardar video", "Más opciones".
  - Tapping a destination exports the current `version` if its file does not exist yet: the pills give way to "Armando el video… 42 %" and "Cancelar", the player is `paused`, and at the end the destination runs. The file (`Paths.cache/rollo-recorrido-<tripId>.mp4`) is reused for the other destinations while `version` is the same. The frame source uses `"bytes"` unless the paso 1 measurements say otherwise (one constant, `FRAME_INPUT`).
  - Leaving the screen, "Cancelar", a new selection or "Otra versión" during an export cancel it and remove the file.
  - After "Guardar video": the HUD "Guardado en Fotos". After Instagram by the library route: the note "Lo guardamos en tus fotos. Elegilo en tu historia."
  - Errors inline with a retry pill: `error.offline` → "Para armar el recorrido hace falta conexión."; other load errors → "No se pudo armar el recorrido. Probá de nuevo."; export or share failure → "No se pudo armar el video. Probá de nuevo."
  - A selection that leaves one stop: "Con estas fotos no hay recorrido: elegí fotos de al menos dos lugares.", the strip stays, no pills.
  - `SharePickScreen` takes `kind: "collage" | "journey"`: for `journey` the candidates are `filmCandidates`, the cap is `FILM_MAX` (15), it reads and writes the film selection, the order does not matter (no numbers on the cells), and with nothing saved it starts from the photos the film shows now.

- [ ] **Step 1: Write the failing tests.**
  - `film-selection`: set, get, subscribe; independent from the collage's selection for the same trip.
  - `share-video`: `instagramRoute(19_000)` is `"stories"`, `instagramRoute(20_001)` is `"library"`; the library route saves and then opens `instagram://story-camera`; a denied permission rejects with `PermissionDeniedError` and opens nothing.
  - `__tests__/share-story.test.tsx` (mock `@/features/journey/use-film` and `modules/rollo-video`; add cases, keep the existing ones):
    - a revealed trip roll with a route shows the "Collage | Recorrido" control, opening on Collage;
    - an event, a private roll, a roll whose film is `no-route`, and `videoAvailable` false each show no control;
    - on Recorrido, the three pills show and "Otra versión" asks `useFilm` for another seed;
    - tapping "Guardar video" shows "Armando el video…" and "Cancelar", calls the export once, saves, and a second tap on "Más opciones" does not export again;
    - "Cancelar" during the export calls `cancelVideo` and brings the pills back;
    - changing the selection during an export cancels it;
    - `useFilm` returning `error` with `offline: true` shows "Para armar el recorrido hace falta conexión." and a retry;
    - `no-route` after a selection shows the "Con estas fotos no hay recorrido…" line and no pills.
  - `__tests__/share-pick.test.tsx`: with `kind="journey"` a non-geolocated shareable photo is not offered, the 16th tap is refused, and "Listo" writes the film selection, not the collage's.
- [ ] **Step 2: Run to see them fail.** `npx jest __tests__/share-story.test.tsx __tests__/share-pick.test.tsx src/features/share --maxWorkers=2`
- [ ] **Step 3: Implement.** Keep the export wiring in `journey-share.tsx` behind one hook in the same file (`useFilmExport(film)` → `{ state, start(destination), cancel }`).
- [ ] **Step 4: Run to see them pass,** then typecheck.
- [ ] **Step 5: Commit.** `Compartir: el recorrido en video, con sus fotos elegibles`

### Task 8: Mirarlo, sacar el prototipo y documentar

**Files:**
- Modify: `CLAUDE.md` (the feature under "Compartir" and in the features list), `docs/superpowers/specs/2026-11-26-recorrido-en-video-design.md` (state)
- Remove (uncommitted prototype; only after the owner says the real one is fine): `src/features/journey-spike/`, `app/dev/journey.tsx`, and the spike edits in `app/_layout.tsx`, `src/features/profile/dev-moment-rows.tsx`, `src/test/routes.ts`

- [ ] **Step 1: Render frames off the phone.** The controller points the offline renderer in `~/Desktop/Rollo/.superpowers/recorrido-demo/engine-render` at `src/features/journey/` and looks at the cover, a stop of each layout, a hop, the closing and the end card: seals, credit, no red, badge.
- [ ] **Step 2: The owner tries it on his iPhone** (Compartir → Recorrido on a revealed trip roll): preview, choosing photos, "Otra versión". Exporting and the destinations need the build of paso 1's Task 8; if it is not installed yet, "Recorrido" does not appear and this step waits for it.
- [ ] **Step 3: Document** in `CLAUDE.md`, in the style of the "Compartir" paragraph.
- [ ] **Step 4: Commit.** `git add CLAUDE.md docs/superpowers/specs/2026-11-26-recorrido-en-video-design.md` · `Docs: el recorrido en video en Compartir`
- [ ] **Step 5: With the owner's go-ahead, remove the prototype** (`rm -r` the untracked paths; `git checkout -- app/_layout.tsx src/features/profile/dev-moment-rows.tsx src/test/routes.ts`). Deleting is not undoable: ask first and say what goes.
