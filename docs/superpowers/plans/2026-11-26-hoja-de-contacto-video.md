# La hoja de contacto en video — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un rollo sin recorrido (un evento, un rollo en un solo lugar) tenga en Compartir su propio video: la hoja de contacto que se revela y se acerca a las fotos destacadas, con la posibilidad de destacar, dejar en la hoja o sacar cada foto.

**Architecture:**
- Una segunda escena sobre el motor del recorrido: `buildSheetScene` / `sheetFrameAt` (puros) y `drawSheetFrame` (Skia) en `src/features/journey/sheet/`, portados del prototipo `src/features/journey-spike/sheet/`.
- El reproductor, la exportación y la pieza de Compartir dejan de conocer una sola película: reciben un `AnyFilm` (`route` o `sheet`) y lo dibujan con `drawAnyFilm`.
- Qué fotos van, con tres estados por foto, es lógica pura (`sheet-photos.ts`) más una selección en memoria; la pantalla de elegir gana un tercer modo.

**Tech Stack:** TypeScript, `@shopify/react-native-skia` 2.14.0, Reanimated 4, TanStack Query, Jest. Sin MapLibre ni geocodificación en esta película.

**Spec:** `docs/superpowers/specs/2026-11-26-hoja-de-contacto-video-design.md` (se apoya en `2026-11-26-recorrido-en-video-design.md`).

## Global Constraints

- Rama `feature/recorrido-en-video`, worktree `mobile-revelado`. Sin push ni PR.
- **El prototipo no se commitea** (`src/features/journey-spike/`, `app/dev/journey.tsx` y los cambios sueltos en `app/_layout.tsx`, `src/features/profile/dev-moment-rows.tsx`, `src/test/routes.ts`): se lee como referencia, no se importa. Cada tarea commitea solo lo que nombra, con `git add <rutas>`; nunca `git add -A`, `git add .` ni `git commit -a`.
- Código en inglés; textos de pantalla en rioplatense, tal como figuran acá; commits en español con la línea de coautoría de la sesión.
- TDD. Tests: solo los relacionados, con `--maxWorkers=2`. Typecheck: `npm run typecheck`.
- Los archivos que Jest carga no importan valores de Skia en el nivel superior salvo los ya mockeados en `jest.setup.ts`. `sheet-scene.ts` y `sheet-photos.ts` son puros.
- Nada de lo que hoy funciona para el recorrido, el collage o la invitación cambia de comportamiento; sus tests siguen pasando sin tocarlos.
- **Valores de la película** (cuadro canónico 432×768):
  - hoja: hasta **30** fotos; destacadas: hasta **12**; hace falta un mínimo de **6** fotos para ofrecerla;
  - columnas: hasta 12 fotos, 3; hasta 20, 4; más, 5; siempre filas completas (con 6 o más fotos quedan fuera las últimas no destacadas que sobren; nunca una destacada);
  - cuadros 3:4, 5 puntos de separación, 20 de margen lateral, la hoja centrada bajo un título de ~110 puntos;
  - tiempos: portada **1800 ms**, revelado **2500 ms** (cada cuadro revela en ~700 ms, escalonados por hora), traslado **800 ms**, pausa **2600 ms** con acercamiento del **5 %** (ease-out), vuelta a la hoja **1500 ms**, cierre **2600 ms**, placa final **2500 ms** (aparece en 400); total **≤ 59.000 ms** acortando las pausas por igual;
  - destacada: el cuadro ocupa **78 %** del ancho, centrado en (50 %, 53 %); borde de 3 px `#FBFAF6`; sello del autor al **11,5 %** del ancho centrado en el borde de abajo; los demás cuadros atenuados con negro al 45 %;
  - título sobre la destacada: la hora "23:40" y debajo el nombre del rollo; si las fotos abarcan más de un día local, "Día 2 · 23:40"; entre dos destacadas la hora saliente se va en los primeros 250 ms del traslado y la entrante aparece en los últimos 250 ms;
  - sin luz roja, sin crédito de mapa, sin números de cuadro, sin sonido ni hápticos.
- **Votos:** ningún texto, orden ni énfasis sale de los "me gusta" ni del concurso. Los "me gusta" solo eligen la selección inicial; todo se muestra por hora y todas las destacadas reciben el mismo trato.
- **Fotos:** solo `shareable === true`, `type === "photo"`, no archivadas (no hace falta ubicación). Rollo revelado y no privado; vale para eventos.
- **Cuándo:** en Compartir, la segunda pieza es "Recorrido" si el rollo tiene recorrido (`filmBlocked(...) === null`); si no, y hay al menos 6 fotos, es esta, con la etiqueta **"Resumen"**.
- Textos de pantalla: "Resumen", "Armando el resumen…", "No se pudo armar el resumen. Probá de nuevo.", "Faltan fotos para el resumen: dejá al menos 6 en la hoja.", "8 destacadas · 22 en la hoja", "1 destacada · 1 en la hoja", y los del recorrido para exportar y compartir, sin cambios.

## Review Focus

1. **Una foto que el usuario sacó vuelve a aparecer** (al rellenar la hoja, al reabrir la pantalla de elegir, al cambiar otra foto): nunca. Tests en las Tasks 3 y 6.
2. **El video deja ver quién tiene más votos:** el orden es siempre por hora y ninguna destacada dura más ni va más grande. Tests en las Tasks 1 y 3.
3. **Pocas fotos:** con menos de 6 en la hoja no se ofrecen destinos y lo dice; con cero destacadas la película igual funciona (portada, revelado, cierre). Tests en las Tasks 1, 3 y 5.
4. **Un rollo con recorrido sigue mostrando "Recorrido"** y uno sin recorrido muestra "Resumen", también un evento; un rollo privado, ninguno. Test en la Task 5.
5. **Cambiar la selección en medio de una exportación** cancela y no comparte el video anterior, igual que en el recorrido. Test en la Task 5.

---

### Task 1: La escena de la hoja (`sheet/sheet-scene.ts`)

**Files:**
- Create: `src/features/journey/sheet/sheet-scene.ts`
- Test: `src/features/journey/sheet/__tests__/sheet-scene.test.ts`
- Reference: `src/features/journey-spike/sheet/sheet-scene.ts`

**Interfaces:**
- Produces (the prototype's, kept): `SheetCellInput`, `SheetInput`, `SheetText`, `SheetLayout`, `SheetScene`, `SheetModel`, `sheetColumns(count)`, `shownCells(cells, highlights)`, `buildSheetScene(input): SheetScene`, `sheetFrameAt(scene, t): SheetModel` (`"worklet"`), and the constants of the film. `SheetInput.frame` is always `FILM_FRAME` from `../route`.

Port the prototype's file as it is (it already has full rows, the 250 ms title hand-over, the eased push-in and the zero-highlights case). Pure: only `import type`, plus `FILM_FRAME`.

- [ ] **Step 1: Write the failing tests.**
  - `sheetColumns`: 1→3, 12→3, 13→4, 20→4, 21→5, 30→5.
  - `shownCells`: 13 cells, no highlights → 12; 19 → 16; 21 → 20; 40 → 30; 5 → 5; 7 cells all highlighted → 7 (a highlight is never dropped); the dropped ones are the last non-highlighted.
  - Layout: every cell is inside the frame, cells do not overlap, the sheet is horizontally centred with 20-point margins when the height allows, and it starts below y = 110.
  - Timeline with 8 highlights of 25 cells: `durationMs === 1800 + 2500 + 8 * (800 + 2600) + 1500 + 2600 + 2500`.
  - With 12 highlights `durationMs <= 59_000`; with a made-up 20 highlights the holds shrink and `durationMs <= 59_000` still holds.
  - Zero highlights: `durationMs === 1800 + 2500 + 1500 + 2600 + 2500` and no frame has a title item.
  - Develop: at `t = 0` every cell's `develop` is `< 0` or 0 (empty paper); at the end of the develop phase every cell is 1; cells develop in time order (the cell with the earliest `takenAt` starts first).
  - While a highlight is held: its camera puts the cell's centre at (0.5 w, 0.53 h) within 0.5 point and its width at `0.78 × w × (1 … 1.05)`; every other cell has `dim > 0`; the held cell has `dim === 0`.
  - **Same treatment:** every highlight's hold lasts the same and reaches the same scale, whatever the cells' order or ids.
  - Highlights are visited in `takenAt` order even when `input.highlights` lists them in another order.
  - Title: with all photos on one local day the item text is `"23:40"`-shaped (`/^\d{2}:\d{2}$/`); with two days, `/^Día \d+ · \d{2}:\d{2}$/`; at the midpoint of a move between two highlights no time item has opacity above 0.
  - End card: opacity 0 at `doneAt`, 1 at `doneAt + 400`.
- [ ] **Step 2: Run to see them fail.** `npx jest src/features/journey/sheet --maxWorkers=2`
- [ ] **Step 3: Implement** by porting.
- [ ] **Step 4: Run to see them pass,** then typecheck.
- [ ] **Step 5: Commit.** `Resumen: la escena de la hoja de contacto`

### Task 2: El dibujo de la hoja (`sheet/sheet-draw.ts`)

**Files:**
- Create: `src/features/journey/sheet/sheet-draw.ts`
- Modify: `src/features/journey/engine/draw.ts` (export the helpers the sheet reuses; no behaviour change)
- Reference: `src/features/journey-spike/sheet/sheet-draw.ts`

**Interfaces:**
- `engine/draw.ts` additionally exports, unchanged: the developing window, the cover-fit image draw, the paint helpers, the paragraph draw, and the end card (`drawWindow`, `drawCover`, `fillPaint`, `strokePaint`, `drawText`, `drawEndCard`) and a seal that takes the author directly: `drawSeal(canvas, assets, author: { initial: string; color: string; avatar: string | null }, initialText: number, develop: number, cx, cy, d)` — `drawAvatar` becomes a thin wrapper over it. `drawEndCard` takes `(canvas, frame: Size, card: { opacity; name; badgeSmall; badgeBig }, assets)`.
- Produces: `export type SheetAssets = { photos: Record<string, SkImage | null>; texts: (SkParagraph | null)[] }` and `export function drawSheetFrame(canvas, scene: SheetScene, model: SheetModel, assets: SheetAssets): void` (`"worklet"`).

The prototype copied those helpers; here the sheet imports them. Keep what the prototype learned: the develop blur is scaled to the cell's size, and the seal's ring and the held cell's border are divided by the camera scale so they stay 2 and 3 px on the frame.

No unit test (Jest cannot load Skia). Its checks: the type checker, the route film's existing tests still green, and the rendered frames in Task 7.

- [ ] **Step 1: Export the helpers** from `engine/draw.ts` and port `sheet-draw.ts` on top of them.
- [ ] **Step 2: Check.** `npm run typecheck`; `npx jest src/features/journey --maxWorkers=2` green.
- [ ] **Step 3: Commit.** `Resumen: el dibujo de la hoja, sobre los mismos trazos del recorrido`

### Task 3: Qué fotos van y en qué estado (`sheet/sheet-photos.ts`, `share/sheet-selection.ts`)

**Files:**
- Create: `src/features/journey/sheet/sheet-photos.ts`, `src/features/share/sheet-selection.ts`
- Test: `src/features/journey/sheet/__tests__/sheet-photos.test.ts`, `src/features/share/__tests__/sheet-selection.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // sheet-photos.ts (pure)
  export const SHEET_MAX = 30;
  export const HIGHLIGHT_MAX = 12;
  export const SHEET_MIN = 6;
  export type SheetState = "sheet" | "highlight" | "out";
  /** What the person changed by hand: photo id → state. A photo not listed follows the automatic pick. */
  export type SheetChoices = Readonly<Record<string, SheetState>>;
  /** Photos that may appear in the film: shareable, a photo, not archived (no coordinates needed). */
  export function sheetCandidates(photos: RevealedPhoto[]): RevealedPhoto[];
  /** The state every candidate ends up in, by id. */
  export function sheetStates(candidates: RevealedPhoto[], choices: SheetChoices): Record<string, SheetState>;
  /** The photos of the sheet (time order) and the highlighted ids (time order). */
  export function sheetPick(candidates: RevealedPhoto[], choices: SheetChoices): { cells: RevealedPhoto[]; highlights: string[] };
  /** The next state on a tap: sheet → highlight → out → sheet. A 13th highlight is skipped (sheet → out). */
  export function nextState(current: SheetState, highlighted: number): SheetState;
  /** "8 destacadas · 22 en la hoja" (singulars: "1 destacada", "1 en la hoja"). */
  export function sheetCounter(pick: { cells: RevealedPhoto[]; highlights: string[] }): string;
  /** Why this roll has no summary film, or null: "private" | "unrevealed" | "few". */
  export function sheetBlocked(detail: TripDetail, sheetPhotos: number): "private" | "unrevealed" | "few" | null;
  // sheet-selection.ts: the same in-memory store pattern as film-selection.ts
  export function getSheetChoices(tripId: string): SheetChoices;
  export function setSheetChoices(tripId: string, choices: SheetChoices): void;
  export function useSheetChoices(tripId: string): SheetChoices;
  ```
- Rules of `sheetStates`:
  1. A photo with a hand-made choice keeps it (`out` stays out, always).
  2. The automatic sheet: among the candidates without a choice, the most liked first (ties: earlier first), until the sheet has `SHEET_MAX` counting the ones chosen as `sheet` or `highlight`.
  3. The automatic highlights: only when the person has chosen **no** highlight by hand, the `HIGHLIGHT_MAX` most liked of the sheet (ties: earlier first). Once they highlight one by hand, only their highlights count.
  4. Everything else is `out`.
- `sheetPick` returns the cells in `takenAt` order (never in order of likes) and the highlights in `takenAt` order.

- [ ] **Step 1: Write the failing tests.**
  - `sheetCandidates` drops a video, an archived and a non-shareable photo; keeps one without coordinates.
  - 40 candidates, no choices: 30 cells, 12 highlights; the cells are the 30 most liked, returned in time order; `highlights` are in time order, not in order of likes.
  - Same likes for all: the pick is by time and stable.
  - **A photo set `out` never comes back:** with 40 candidates and one of the top ones set `out`, it is not in the cells, the sheet still has 30 (the 31st most liked came in), and setting another photo `out` afterwards does not bring the first back.
  - With 10 candidates and 3 set `out`: 7 cells (nothing to refill with).
  - One highlight chosen by hand: `highlights` is exactly that one.
  - A hand-chosen `sheet` on a photo outside the automatic 30 puts it in and pushes the least liked automatic one out; the sheet stays at 30.
  - `nextState("sheet", 3)` → `"highlight"`; `nextState("sheet", 12)` → `"out"`; `nextState("highlight", 5)` → `"out"`; `nextState("out", 5)` → `"sheet"`.
  - `sheetCounter`: `"8 destacadas · 22 en la hoja"`, `"1 destacada · 1 en la hoja"`, `"0 destacadas · 6 en la hoja"`.
  - `sheetBlocked`: private → `"private"`; not revealed → `"unrevealed"`; 5 photos → `"few"`; an event with 6 → `null`.
  - The selection store: set, get, subscribe; independent per trip and from the collage's and the route film's stores.
- [ ] **Step 2: Run to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to see them pass,** then typecheck.
- [ ] **Step 5: Commit.** `Resumen: qué fotos van a la hoja, cuáles se destacan y cuáles quedan fuera`

### Task 4: Una película cualquiera (`any-film.ts`, `use-sheet-film.ts`)

**Files:**
- Create: `src/features/journey/any-film.ts`, `src/features/journey/use-sheet-film.ts`
- Modify: `src/features/journey/film-player.tsx`, `src/features/share/film-export.ts`, `src/features/journey/use-film.ts` (only to return the new shape), `jest.setup.ts`
- Test: `src/features/journey/__tests__/use-sheet-film.test.tsx`, and the existing `film-player.test.tsx`, `use-film.test.tsx` adjusted to the new shape

**Interfaces:**
- Produces:
  ```ts
  // any-film.ts
  export type AnyFilm =
    | { kind: "route"; scene: Scene; assets: Assets; durationMs: number; restAt: number; version: string }
    | { kind: "sheet"; scene: SheetScene; assets: SheetAssets; durationMs: number; restAt: number; version: string };
  /** Paints the film at `t` on the canonical frame. A worklet. */
  export function drawAnyFilm(canvas: SkCanvas, film: AnyFilm, t: number): void;
  /** The same film with its own text layout, for a second thread (the export). */
  export function withOwnTexts(film: AnyFilm): AnyFilm;
  // use-sheet-film.ts
  export type SheetFilm =
    | { status: "loading"; done: number; total: number }
    | { status: "error"; offline: boolean; retry: () => void }
    | { status: "few" }
    | { status: "ready"; film: AnyFilm; photos: RevealedPhoto[] };
  export function useSheetFilm(args: { tripId: string; cells: RevealedPhoto[]; highlights: string[]; token: string | null; detail: TripDetail; seed: number; enabled: boolean }): SheetFilm;
  ```
  - `restAt` is the instant the player holds after the end: the route's `timeline.doneAt`, the sheet's `t.doneAt`.
  - `useFilm`'s `ready` state becomes `{ status: "ready"; film: AnyFilm; stops; photos }` (its `scene`, `assets`, `durationMs`, `version` move inside `film`).
  - `FilmPlayer` takes `film: AnyFilm` instead of `scene` and `assets`; `exportFilmToFile(film: AnyFilm, input, options)` draws with `drawAnyFilm(canvas, withOwnTexts(film), t)`; the file is `rollo-video-<tripId>.mp4` for both kinds.
  - `useSheetFilm`: fewer than `SHEET_MIN` cells → `few`; builds the input (name = the roll's name; date line from the roll's start and end in its zone, the collage's `dateRange`; closing line `"<totalUploaded> fotos · <people> personas"` with singulars, people as `memberTotal(detail)`; each cell's local `day` and the UTC offset from the roll's time zone **per photo** — a daylight-saving change inside the roll must not shift the hours); loads the photos (thumbs) and avatars with `loadPhotos`, lays the texts out; same guards as `useFilm` (does nothing while disabled, ignores superseded runs, never sets state after unmount, a load failure is `error` with `offline`, stale `ready` is not returned for a new `version`). `version` = trip id, seed, cell ids and highlight ids.
- `jest.setup.ts`: mock `@/features/journey/use-sheet-film` globally like `use-film`.

- [ ] **Step 1: Write the failing tests** for `useSheetFilm` (mock `./engine/assets`): `loading` → `ready` with `film.kind === "sheet"` and `film.durationMs <= 59_000`; 5 cells → `few`, nothing requested; a rejected `loadPhotos` → `error`, `retry()` asks again; `version` changes when a highlight changes; the first result after a change is not the old `ready`; two photos at 23:40 local on either side of a daylight-saving change both read "23:40" in the scene's texts. Adjust the existing player and `useFilm` tests to the `film` prop / shape (same assertions).
- [ ] **Step 2: Run to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to see them pass:** `npx jest src/features/journey src/features/share __tests__/share-story.test.tsx --maxWorkers=2`, then typecheck. (The share screen is adapted to the new shape here only as far as it needs to keep compiling and passing; its new behaviour is Task 5.)
- [ ] **Step 5: Commit.** `Recorrido y resumen: el reproductor y la exportación reciben cualquier película`

### Task 5: "Resumen" en la pantalla Compartir

**Files:**
- Modify: `src/features/share/share-story-screen.tsx`, `src/features/share/journey-share.tsx`, `app/share-story.tsx`
- Test: `__tests__/share-story.test.tsx`

**Interfaces:**
- Consumes: `sheetCandidates`, `sheetPick`, `sheetBlocked`, `sheetCounter` (Task 3), `useSheetChoices` (Task 3), `useSheetFilm` (Task 4), and everything the route piece already uses.
- Screen behaviour:
  - The second segment of the control is **"Recorrido"** when the roll has a route (today's rule, unchanged) and **"Resumen"** when it has none and `sheetBlocked(detail, sheetPick(...).cells.length)` is `null`. Still only with `videoAvailable` and for the collage kind; never both. `kind=journey` in the route opens on the second segment whichever it is.
  - The Resumen body is the route's body with these differences: it uses `useSheetFilm`; loading text "Armando el resumen…" (with the percentage when `total > 0`); load error "No se pudo armar el resumen. Probá de nuevo."; under the preview, the counter (`sheetCounter`) and the photo strip (the highlighted photos, or the first of the sheet when there are none) whose "+" opens `/share-pick` with `kind: "sheet"`; with `few`: "Faltan fotos para el resumen: dejá al menos 6 en la hoja.", the strip stays, no pills.
  - Exporting, cancelling, the cached file per `film.version`, the three destinations and their messages are the route's, shared code, not a copy: `JourneyShare` becomes one component that takes which film it is.

- [ ] **Step 1: Write the failing tests** (add; existing ones stay):
  - an event with 10 shareable photos shows "Collage | Resumen"; a trip roll with a route still shows "Collage | Recorrido"; a trip roll in one place shows "Resumen"; a private roll, a roll with 5 shareable photos, and `videoAvailable` false show no control;
  - on Resumen: the player, the counter text and the three pills show; "Guardar video" exports once and saves;
  - `useSheetFilm` returning `few` shows the "Faltan fotos…" line and no pills;
  - changing the sheet choices during an export cancels it and a later share exports again;
  - `useSheetFilm` is given only shareable, non-archived photos, in time order.
- [ ] **Step 2: Run to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to see them pass:** `npx jest __tests__/share-story.test.tsx src/features/share --maxWorkers=2`, then typecheck.
- [ ] **Step 5: Commit.** `Compartir: el resumen en video para los rollos sin recorrido`

### Task 6: Elegir con tres estados

**Files:**
- Modify: `src/features/share/share-pick-screen.tsx`, `src/features/share/pick-cell.tsx`, `src/features/share/pick-tray.tsx`, `app/share-pick.tsx`
- Test: `__tests__/share-pick.test.tsx`

**Interfaces:**
- Consumes: `sheetCandidates`, `sheetStates`, `sheetPick`, `nextState`, `sheetCounter`, `HIGHLIGHT_MAX` (Task 3), `getSheetChoices` / `setSheetChoices`.
- Behaviour with `kind="sheet"` (the collage and journey kinds do not change):
  - The grid shows every candidate, in time order, each in its current state (`sheetStates`): **destacada** with the cobalt ring and a star mark; **en la hoja** plain; **fuera** dimmed to 35 % with a "no" mark (SF Symbol `eye.slash`).
  - A tap rotates the state with `nextState` and records it as a hand-made choice. The 13th highlight is skipped with the light haptic the screen already uses when full.
  - The tray shows `sheetCounter(...)` for the draft, and "Listo" saves the draft with `setSheetChoices`.
  - Each cell's accessibility label says its state: "Foto destacada", "Foto en la hoja", "Foto fuera del video".
  - Reopening the screen shows the saved states: a photo set `out` is still out.

- [ ] **Step 1: Write the failing tests:** three taps on one photo go sheet → highlight → out → sheet (by accessibility label); the tray counter follows; with 12 highlights a tap on a sheet photo makes it "fuera"; "Listo" writes the choices and the collage's and the route film's selections are untouched; reopening shows the photo set out as "Foto fuera del video"; a non-shareable photo is not offered.
- [ ] **Step 2: Run to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to see them pass,** then typecheck.
- [ ] **Step 5: Commit.** `Compartir: destacar, dejar en la hoja o sacar cada foto del resumen`

### Task 7: Mirarlo y documentar

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-11-26-hoja-de-contacto-video-design.md` (state)

- [ ] **Step 1: Render frames off the phone.** The controller points the offline renderer (`~/Desktop/Rollo/.superpowers/recorrido-demo/engine-render`, `build-sheet.cjs` and friends) at `src/features/journey/sheet/` and looks at the cover, the develop wave, two held highlights, a move, the closing and the end card.
- [ ] **Step 2: The owner tries it on his iPhone:** Compartir on a revealed roll without a route → "Resumen": the preview, the counter, the three states in the picker, "Guardar video" and Instagram.
- [ ] **Step 3: Document** in `CLAUDE.md` next to the "Recorrido en video" paragraph, and mark the spec as implemented.
- [ ] **Step 4: Commit.** `Docs: el resumen en video`
