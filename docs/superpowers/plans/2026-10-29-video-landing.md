# Video de la landing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A silent ~22 s looping Remotion video of the app's main flows (capture → map → reveal → gallery → profile → daily moment) that replaces the static mockup in the landing hero.

**Architecture:** A standalone Remotion project in `video/` (own `package.json`, outside the Expo app's Jest/tsc). App screens are rebuilt in React web with the app's dark tokens; the map is real MapLibre GL JS with the app's own style. Juani's photos are prepared locally (gitignored) into JPEGs + `photos.json` with real GPS/time; only the rendered `hero.mp4` / `hero.webm` / `hero-poster.jpg` are committed to `scripts/site/` and wired into `build-site.mjs`.

**Tech Stack:** Remotion 4 (`remotion`, `@remotion/cli`, `@remotion/transitions`, `@remotion/lottie`), React 19, TypeScript, `maplibre-gl`, `exifr`, `node:test` (via `tsx --test`), macOS `sips` for HEIC → JPEG.

**Spec:** `docs/superpowers/specs/2026-10-29-video-landing-design.md`

## Global Constraints

- Silent, `muted autoplay loop playsinline`, hero only. No audio track in the render (`--muted`).
- 30 fps, 540×1170 (9:19.5), total 660 frames (22 s). Never drop fps to save size.
- Size target ≤ 2 MB per video, hard ceiling 3 MB. If over: grain first, then scale 1.5× (405×878), then duration.
- One version, the app's **dark** scheme. Tint `#5C7CFF` only on actions/selected (tab, primary button, chip activo, filter chosen, "Mandar al rollo"). Member colors from `scripts/site/mockups.mjs` `PEOPLE`.
- System fonts only: `-apple-system, "SF Pro Text", system-ui` and serif `ui-serif, "New York", Georgia`. Render on the Mac.
- Copy in rioplatense, taken from the app: "Agregá un caption", "Mandar al rollo", "Revelando Europa", "Se reveló", "Es tu momento", "Tenés 15 minutos para sacar tu foto de Europa.", "Mapa", "Feed", "Galería", "Rollo", "Fotos", "Mapa". No extra overlay words (the hero `<h1>` already says "Sacá la foto. Mirala después.").
- Trip "Europa", 2–20 jul 2026, offset +02:00. Every pin position and every visible time comes from the photo's EXIF.
- Before the reveal scene, no photo is ever shown sharp (camera viewfinder excepted: it's the live view).
- Photos never enter git: `video/public/photos/` and `video/src/data/photos.json` are gitignored. Code identifiers/comments/tests in English.
- Don't touch `src/` or `app/` of the app. Importing `src/features/map/style.ts` read-only is allowed.

## Review Focus

- **Photos not prepared** (fresh clone, no zip): `remotion studio`/render must fail with one clear message naming `npm run photos -- <zip>`, not a blank video. → test in Task 2.
- **HEIC orientation 5/6** (portrait/front camera): photos must render upright, front-camera ones mirrored only in the moment scene. → test in Task 2 (`toPhotoRecord` keeps `orientation`, `prepare` output dims are portrait for orientation 6).
- **Photos without GPS** (the two `.jpg`): excluded from the map, never placed at 0,0. → test in Task 3.
- **Loop seam**: frame 659 → frame 0 must not jump (both are inside the shutter flash). → test in Task 3 on the timeline + still check in Task 10.
- **Map tiles not loaded at a frame**: render must wait (`delayRender`) and fail after timeout rather than ship grey frames. → Task 6 step.

---

### Task 1: Scaffold `video/` and keep it out of the app

**Files:**
- Create: `video/package.json`, `video/tsconfig.json`, `video/remotion.config.ts`, `video/src/index.ts`, `video/src/Root.tsx`, `video/src/Hero.tsx`, `video/.gitignore`
- Modify: `.gitignore`, `tsconfig.json` (`exclude` += `"video"`), `package.json` jest config `testPathIgnorePatterns` += `"<rootDir>/video/"`

**Interfaces:**
- Produces: composition id `"Hero"`, `fps: 30`, `width: 540`, `height: 1170`, `durationInFrames: 660`, component `Hero` from `video/src/Hero.tsx`. Scripts in `video/package.json`: `studio`, `still`, `render`, `test` (`tsx --test src/**/*.test.ts scripts/**/*.test.ts`), `photos`.

- [ ] **Step 1:** In `video/`, `npx create-video@latest --blank` (or equivalent) and pin exact versions of `remotion`, `@remotion/cli`, `@remotion/transitions`, `@remotion/lottie` (all same version). Add `maplibre-gl`, `exifr`, `tsx`. Black `Hero` placeholder.
- [ ] **Step 2:** `video/.gitignore`: `node_modules/`, `out/`, `public/photos/`, `src/data/photos.json`.
- [ ] **Step 3:** Root excludes so the app's `npm test` and `npm run typecheck` ignore `video/`.
- [ ] **Step 4: Verify** `cd video && npx remotion compositions` → lists `Hero 30 540x1170 660`. From root, `npx tsc --noEmit` still passes.
- [ ] **Step 5: Commit** `Video de la landing: proyecto de Remotion en video/`

### Task 2: Photo preparation (EXIF → JPEG + photos.json)

**Files:**
- Create: `video/scripts/prepare-photos.mjs`, `video/scripts/photo-record.ts`, `video/scripts/photo-record.test.ts`, `video/src/data/load-photos.ts`

**Interfaces:**
- Produces:
  ```ts
  type PhotoRecord = { id: string; file: string; lat: number | null; lng: number | null;
    takenAt: string /* "2026-07-09T12:04:40+02:00" */; camera: "back" | "front"; orientation: number };
  function toPhotoRecord(id: string, exif: Record<string, unknown>): PhotoRecord;
  function loadPhotos(): PhotoRecord[]; // throws Error("Faltan las fotos: corré `npm run photos -- <zip o carpeta>` en video/") if photos.json missing
  function photoById(id: string): PhotoRecord; // throws on unknown id
  ```
- `npm run photos -- <zip|dir>`: unzips to a temp dir, skips `.MP4`, for each HEIC/JPG: `sips -s format jpeg -s formatOptions 82 -Z 1200` into `public/photos/<id>.jpg` (id = basename without extension), reads EXIF with `exifr` (`gps: true`, `tiff`, `exif`), writes `src/data/photos.json` sorted by `takenAt` (records without a date go last).

- [ ] **Step 1: Failing tests** in `photo-record.test.ts`:
  - `toPhotoRecord("IMG_5926", { latitude: 47.50056, longitude: 19.051, DateTimeOriginal: new Date("2026-07-09T10:04:40Z"), OffsetTimeOriginal: "+02:00", LensModel: "iPhone 15 Pro Max back triple camera 6.765mm f/1.78", Orientation: 6 })` → `{ id: "IMG_5926", file: "photos/IMG_5926.jpg", lat: 47.50056, lng: 19.051, takenAt: "2026-07-09T12:04:40+02:00", camera: "back", orientation: 6 }`
  - lens containing `"front"` → `camera: "front"`
  - no GPS → `lat: null, lng: null`
  - `loadPhotos` with missing file throws the exact message above.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement `photo-record.ts` and `load-photos.ts`; `prepare-photos.mjs` wires sips + exifr. `sips` keeps the EXIF orientation tag; Chromium applies it (`image-orientation: from-image` default), so no pixel rotation needed — verify in Step 5.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Verify** `npm run photos -- ~/Downloads/Photos-1-001.zip` → 23 JPEGs, `photos.json` with 21 GPS records; `npx remotion still Hero --frame 0` on a temp component showing `IMG_5926` and `IMG_5930` → both upright. Then remove the temp component.
- [ ] **Step 6: Commit** (no photos) `Video: preparar fotos con su ubicación y hora reales`

### Task 3: Timeline, cast and pure helpers

**Files:**
- Create: `video/src/timeline.ts`, `video/src/cast.ts`, `video/src/format.ts`, `video/src/selection.ts`, tests `video/src/*.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // timeline.ts
  type SceneId = "camera" | "map" | "reveal" | "gallery" | "profile" | "moment";
  const SCENES: { id: SceneId; frames: number }[]; // camera 120, map 135, reveal 135, gallery 90, profile 90, moment 150
  const TRANSITION_FRAMES = 12; const SEAM_FRAMES = 14; const FPS = 30;
  function totalFrames(): number; // sum(frames) - TRANSITION_FRAMES*(n-1) === 660
  function sceneStart(id: SceneId): number;
  // cast.ts — PEOPLE copied from scripts/site/mockups.mjs (cami, lu, juani, tomi, fede, juan) with display names
  type Person = { id: string; name: string; initial: string; color: string };
  function authorOf(photo: PhotoRecord): Person; // juani for camera==="front"; others round-robin by takenAt index over non-juani people, deterministic
  // format.ts
  function formatHour(takenAt: string): string; // "12:04" (local time of the offset, never the machine's TZ)
  function formatRevealDate(iso: string): string; // "20 jul 2026"
  // selection.ts — ids from the spec
  const PROFILE_AVATAR = "IMG_6092"; const MOMENT_MAIN = "IMG_5926"; const MOMENT_SECOND = "IMG_5930";
  const CAMERA_VIEW = "IMG_6198"; const GALLERY: string[]; const REVEAL: string[]; // 9–12 non-selfie ids
  function mapPhotos(all: PhotoRecord[]): PhotoRecord[]; // only lat/lng !== null, sorted by takenAt
  ```
- [ ] **Step 1: Failing tests:** `totalFrames() === 660`; `sceneStart("camera") === 0`, `sceneStart("map") === 108`; `formatHour("2026-07-09T12:04:40+02:00") === "12:04"` with `process.env.TZ = "America/Montevideo"`; `formatRevealDate("2026-07-20T22:00:00+02:00") === "20 jul 2026"`; `mapPhotos` drops records with `lat: null`; `authorOf` gives the same person twice for the same input and `juani` for a front photo; every id in `GALLERY`/`REVEAL` is unique and not a selfie id.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS.
- [ ] **Step 5: Commit** `Video: línea de tiempo, elenco y formatos`

### Task 4: Shared UI primitives

**Files:**
- Create: `video/src/ui/theme.ts`, `video/src/ui/Screen.tsx` (status bar 9:41 + home indicator, black/`#000` systemBackground dark), `video/src/ui/Photo.tsx`, `video/src/ui/Avatar.tsx`, `video/src/ui/TabBar.tsx`, `video/src/ui/Segmented.tsx`

**Interfaces:**
- Produces: `colors` (dark iOS: `background #000`, `secondaryBackground #1C1C1E`, `label #FFF`, `secondaryLabel rgba(235,235,245,.6)`, `separator #38383A`, `tint #5C7CFF`, `onTint #FFF`), `fonts.sans`, `fonts.serif`. `<Screen>{children}</Screen>`; `<Photo id blur?={number px} mirror?={boolean} style?>` (uses `staticFile(record.file)`, `object-fit: cover`); `<Avatar person size photoId?>` (initial on `person.color` or photo circle); `<TabBar active={"roll"|"map"|"camera"|"friends"|"me"} revealed?>` (SF-like glyphs as inline SVG, active in tint, liquid-glass pill style); `<Segmented items={string[]} active={number}>`.
- [ ] **Step 1:** Implement; a `Playground` composition (not rendered to the site) shows each primitive.
- [ ] **Step 2: Verify** `npx remotion still Playground out/playground.png` and eyeball against the "native slop tells" in `expo-design-system` (real sizes: body 17 pt → 34 px at 2×, no cards everywhere).
- [ ] **Step 3: Commit** `Video: piezas base de la UI`

### Task 5: Scene 1 — Camera → caption → send

**Files:** Create `video/src/scenes/CameraScene.tsx`
**Interfaces:** Consumes `CAMERA_VIEW`, `Photo`, `Screen`, `colors`. Produces `<CameraScene />` (120 frames, local frame 0-based).

Beats (local frames): 0–40 viewfinder (4:3 box full width, black bands; top row Cerrar/flash/timer/grid; chips "0,5 · 1× · 2" with 1× in tint; shutter) with a slow 1.0→1.04 zoom; 40–46 shutter press scale 1→0.9→1 + white flash 0→0.6→0; 46–100 caption screen: same photo `blur={60}`, caption field with only its placeholder "Agregá un caption"; button "Mandar al rollo" in tint, pressed at 90; 100–120 the blurred photo shrinks and flies toward the bottom-center (camera tab) with opacity → 0.
- [ ] **Step 1:** Implement with `interpolate` / `spring({ damping: 200 })`, `Easing.bezier(0.23, 1, 0.32, 1)` for exits.
- [ ] **Step 2: Verify** stills at local frames 20, 43, 70, 110 → viewfinder sharp, flash, caption blurred (no recognizable detail), fly-out.
- [ ] **Step 3: Commit** `Video: escena de la cámara`

### Task 6: Scene 2 — Real map

**Files:** Create `video/src/scenes/MapScene.tsx`, `video/src/map/use-map.ts`
**Interfaces:** Consumes `buildMapStyle` from `../../src/features/map/style` (relative import; if the bundler can't resolve the `@maplibre/maplibre-react-native` type import, copy `style.ts` + `positron.json` to `video/src/map/` with a header comment "copied from the app, keep in sync"), `mapPhotos`, `authorOf`, `formatHour`, `Avatar`, `Segmented`, `TabBar active="map"`.

Beats: 0–60 Europe framed on all pins (bounds of `mapPhotos`), pins appear in `takenAt` order, one every ~3 frames, each a 28 px avatar pin with spring pop; 60–110 camera eases (`map.jumpTo` per frame with interpolated center/zoom, never `flyTo`) to Budapest (center 47.50, 19.05, zoom 12.5); 110–135 the latest Budapest pin gets the tint halo and a bottom card: avatar, name, `formatHour`, ThumbHash-like blurred photo (`Photo blur={40}`). Header `Segmented ["Mapa","Feed"]` active 0.
- [ ] **Step 1:** `use-map.ts`: create the map once (`interactive: false`, `fadeDuration: 0`, `preserveDrawingBuffer: true`), and on every frame call `jumpTo` then `delayRender` until `map.once("idle")`; `continueRender` on idle; fail via `delayRender` timeout 30 s. Pins are React-positioned with `map.project()`.
- [ ] **Step 2: Verify** stills at local 0, 50, 90, 130 → tiles visible (no grey), pins over Croatia/Budapest/Praga/Luxemburgo/Metz in the right places, Budapest close-up with time label matching `photos.json`.
- [ ] **Step 3: Commit** `Video: escena del mapa con ubicaciones reales`

### Task 7: Scene 3 — Reveal

**Files:** Create `video/src/scenes/RevealScene.tsx`, `video/src/ui/Grain.tsx`
**Interfaces:** Consumes `REVEAL`, `Photo`, `formatRevealDate`. Mirror timings of `src/features/reveal/darkroom-intro.tsx` compressed to 135 frames.

Beats: 0–25 dark red (`#2a0000` → `#5a0606`) with animated grain and centered "Revelando Europa" (serif); 25–100 a 3×4 grid of `REVEAL` photos develops staggered (~5 frames apart): per photo `filter: blur(30px→0) sepia(1→0) saturate(0.3→1) brightness(0.6→1)` plus a red multiply overlay fading; 100–108 light goes red → white (flash); 108–135 normal colors, "Se reveló" (kicker) + "Europa" + "20 jul 2026".
- [ ] **Step 1:** `Grain` = SVG `feTurbulence` with `seed={frame % 8}` at low opacity (≤ 0.12) — it's the first thing to tone down if size is over budget.
- [ ] **Step 2: Verify** stills at 10, 60, 104, 125.
- [ ] **Step 3: Commit** `Video: escena del revelado`

### Task 8: Scenes 4–5 — Gallery and profile

**Files:** Create `video/src/scenes/GalleryScene.tsx`, `video/src/scenes/ProfileScene.tsx`
**Interfaces:** Consumes `GALLERY`, `PROFILE_AVATAR`, cast `juani`, `Segmented`, `TabBar`.

Gallery (90): `Segmented ["Galería","Rollo"]`, 3-column grid with 2 px gaps of `GALLERY`, slow upward scroll (~1.5 screens); `TabBar revealed active="roll"`.
Profile (90): no nav title, header on background: 80 pt avatar (`PROFILE_AVATAR`, 160 px), name "Juani" (title), "@juani", badge "FOUNDER" (neutral), bio "Viajando con amigos." , "12 amigos · 3 en común" in secondary; `Segmented ["Fotos","Mapa"]` active 0; edge-to-edge 3-col grid of 6 featured photos; at ~45 one gallery photo lands into the grid and the pill "Destacada en tu perfil" shows for ~30 frames (the one sanctioned pill). `TabBar active="me"`.
- [ ] **Step 1:** Implement. **Step 2: Verify** stills at gallery 45 and profile 20, 60. **Step 3: Commit** `Video: galería y perfil`

### Task 9: Scene 6 — Daily moment

**Files:** Create `video/src/scenes/MomentScene.tsx`; copy `assets/lottie/moment-intro.json` → `video/public/moment-intro.json`
**Interfaces:** Consumes `MOMENT_MAIN`, `MOMENT_SECOND`, `@remotion/lottie` `<Lottie animationData>`.

Beats (150): 0–40 iOS lock screen (blurred `MOMENT_MAIN` wallpaper, big "12:04", date "jueves 9 de julio"), notification slides down at 10 (app icon = Revelado logo on tint, "ROLLO", title "Es tu momento", body "Tenés 15 minutos para sacar tu foto de Europa."), tap ripple at 35; 40–75 moment intro Lottie on black with "Tu momento" / "Te quedan 14:52"; 75–110 viewfinder with `MOMENT_MAIN`, shutter at 100; 110–150 switches to the front camera with `MOMENT_SECOND` mirrored, shutter at 135, result: main photo large with `MOMENT_SECOND` inset top-left (inset frame like `src/ui/inset-frame.ts`), held to the end.
- [ ] **Step 1:** Implement. **Step 2: Verify** stills at 20, 55, 95, 145 (front image mirrored). **Step 3: Commit** `Video: escena del momento del día`

### Task 10: Assemble, loop seam, render

**Files:** Modify `video/src/Hero.tsx`; create `video/scripts/render.mjs`
**Interfaces:** Consumes all scenes + `SCENES`, `TRANSITION_FRAMES`, `SEAM_FRAMES`. Produces `scripts/site/hero.mp4`, `scripts/site/hero.webm`, `scripts/site/hero-poster.jpg`; `npm run render` in `video/`.

- `Hero` = `TransitionSeries` in `SCENES` order with `fade()` 12-frame transitions (map→reveal uses a quick dip to black instead). Loop seam: an overlay white shutter flash covering frames `660-SEAM_FRAMES/2 … 659` and `0 … SEAM_FRAMES/2`, so first and last frames are both full white-ish (`opacity` symmetric around the wrap).
- `render.mjs`: `npx remotion render Hero out/hero.mp4 --codec h264 --crf 28 --muted --pixel-format yuv420p`; `--codec vp9 --crf 36 --muted` for webm; `npx remotion still Hero out/hero-poster.jpg --frame=<sceneStart("gallery") + 30> --image-format jpeg --jpeg-quality 80`; then copy to `scripts/site/` and print sizes; exit 1 if any video > 3 MB, warn if > 2 MB.
- [ ] **Step 1:** Implement. **Step 2: Verify** `npm run render` → sizes printed, both ≤ 3 MB; stills of frames 655, 659, 0, 5 look continuous; watch the mp4 in QuickTime looped (Juani reviews too).
- [ ] **Step 3: Commit** (videos included) `Video: armado, loop y render`

### Task 11: Wire into the landing

**Files:** Modify `scripts/site/home.mjs` (hero `shot`), `scripts/build-site.mjs` (copy 3 files from `SITE_HERO_DIR`, default `scripts/site/`; fail if missing like the appstore badge), `scripts/site/landing.js` (reduced motion), tests `scripts/__tests__/build-site.test.ts`, `scripts/__tests__/landing.test.ts`; CLAUDE.md "Sitio público" (one bullet: video del hero, `video/`, `npm run photos` + `npm run render`, fotos fuera de git).

Hero markup inside `.phone`: `<video class="hero-video" src="/hero.mp4" muted autoplay loop playsinline preload="metadata" poster="/hero-poster.jpg" aria-hidden="true"><source src="/hero.webm" type="video/webm"><source src="/hero.mp4" type="video/mp4"></video>` (sources, no `src` attr), styled `width:100%;height:100%;object-fit:cover;border-radius:31px;display:block`. `landing.js`: if `matchMedia("(prefers-reduced-motion: reduce)").matches`, for `.hero-video`: `removeAttribute("autoplay")`, `pause()`, `load()` (back to poster).
- [ ] **Step 1: Failing tests:** built `index.html` contains `hero.webm`, `hero.mp4`, `poster="/hero-poster.jpg"`, `muted`, `playsinline`, `loop`, and no longer the `rollSheet` hero markup (assert on a class unique to it); `dist` has the three files; build with `SITE_HERO_DIR` pointing to an empty dir fails with a message naming `npm run render`. `landing.test.ts`: with reduced motion the fake video gets `pause` + `load` called and loses `autoplay`; without it, untouched.
- [ ] **Step 2:** `npx jest scripts/__tests__ --maxWorkers=2` → FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5: Verify** `npm run site:build` and open `site/dist/index.html` in the browser pane: video plays in the hero phone, light and dark page; reduced motion shows the poster.
- [ ] **Step 6: Commit** `Landing: video en la primera pantalla`. Deploy (`npm run site:deploy`) only when Juani says so.
