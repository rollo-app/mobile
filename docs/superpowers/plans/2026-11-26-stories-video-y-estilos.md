# Stories: fondo animado y estilos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que "Compartir en Stories" mande a Instagram un video de fondo con un degradé que se mueve y, encima, la tarjeta del collage o de la invitación como sticker, en estilo Oscuro o Claro, elegido en la pantalla "Compartir".

**Architecture:**
- Dos videos de fondo en loop (oscuro y claro) se generan una sola vez con un script de ffmpeg y viajan como assets de la app, junto con un cuadro fijo de cada uno.
- Los renderers de Skia pasan a dibujar una **tarjeta** (PNG con fondo transparente) en lugar de la story completa.
- Para "Más opciones", la tarjeta se compone sobre el cuadro fijo y sale una imagen de 1080×1920.
- Instagram recibe `backgroundVideo` + `stickerImage` a través de `react-native-share` (ya instalado y parcheado).

**Tech Stack:** ffmpeg (script local, `/opt/homebrew/bin/ffmpeg`), `@shopify/react-native-skia`, `expo-video` (ya instalado), `expo-asset`, `@expo/ui` (`SegmentedControl`), `react-native-share` 12.3.1 con su patch.

**Spec:** `mobile/docs/superpowers/specs/2026-11-26-stories-video-y-estilos-design.md` (se apoya en `2026-11-25-compartir-en-stories-design.md`).

## Global Constraints

- Rama `feature/compartir-en-stories` (solo `mobile/`; el backend no cambia).
- El código va en inglés. Los textos de UI van en rioplatense. Los commits van en español, con la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tests: solo los relacionados, con `--maxWorkers=2`. Nunca la suite completa. El typecheck admite solo los errores de rutas tipadas ya conocidos (los de `.expo/types` desactualizado, más `/share-story`).
- Los estilos son exactamente dos: `"dark"` (por defecto, etiqueta "Oscuro") y `"light"` (etiqueta "Claro").
- **Colores del fondo:**
  - oscuro: `#0b0b0c`, `#1b2a6b`, `#0b0b0c`, `#3a1b4f`;
  - claro: `#f3efe8`, `#cfd9ff`, `#f6e7d8`, `#e9e4ff`.
  - Es un degradé a 120° que se desplaza lento (maqueta "A · Degradé que respira", `.superpowers/brainstorm/64986-1795611471/content/fondos-v1.html` en la raíz de Rollo).
- **Tarjeta:**
  - oscuro: fondo `#141416`, texto `#ffffff`;
  - claro: fondo `#fbfaf7`, texto `#111111`.
  - Esquinas redondeadas; el resto del PNG es transparente.
- **Videos de fondo:**
  - mp4 H.264 `yuv420p`, 1080×1920, 30 fps, 8 s;
  - el loop no tiene corte (el último cuadro empalma con el primero);
  - sin audio, `+faststart`, **≤ 2 MB cada uno**.
- No hay dependencias nativas nuevas fuera de `expo-asset`, que ya viene con `expo`; se suma con `npx expo install` si no está en `package.json`.
- "Más opciones" manda la imagen fija de 1080×1920 (la tarjeta sobre el cuadro fijo del fondo del estilo elegido).
- Los textos y reglas de las piezas (qué fotos, quién ve el botón, link de la invitación) no cambian.

## Review Focus

1. **Cambiar de estilo varias veces seguidas:** la vista previa y lo que se comparte quedan siempre en el último estilo elegido. Nunca se mezcla una tarjeta oscura con un fondo claro. Test en la Task 5.
2. **Una tarjeta con un nombre largo (60 caracteres) o con 1 sola foto:** el alto de la tarjeta se adapta y nada se superpone. Test de `cardHeight` en la Task 3.
3. **Sin Instagram:** solo "Más opciones", con la imagen fija del estilo elegido. Test en la Task 5.
4. **El video de la vista previa no llega a cargar:** la tarjeta se ve igual sobre el color de fondo del estilo y no aparece ningún error. Test en la Task 5.
5. **El tamaño de la app:** los dos mp4 juntos pesan menos de 4 MB. Lo verifica el paso de ffprobe de la Task 1.

---

### Task 1: Videos y cuadros fijos de fondo

**Files:**
- Create: `scripts/build-story-backgrounds.mjs`
- Modify: `package.json` (script `"story-backgrounds": "node scripts/build-story-backgrounds.mjs"`)
- Create (generated, committed):
  - `assets/stories/bg-dark.mp4`
  - `assets/stories/bg-light.mp4`
  - `assets/stories/bg-dark.jpg`
  - `assets/stories/bg-light.jpg`

**Interfaces:**
- Produces: the four files at those paths. The `.jpg` files are the frame at t=0, 1080×1920, JPEG quality ~90.

- [ ] **Step 1: Write the script.**
  - It renders each palette with ffmpeg as a linear gradient at 120° whose position goes back and forth with a sine of period 8 s, so the loop has no cut.
  - One way to do it: render the gradient at low resolution (for example 270×480, with `geq` or with frames generated in Node) and scale up with `lanczos`. The gradient is blurry, so it doesn't lose quality.
  - Encoding: `-c:v libx264 -pix_fmt yuv420p -r 30 -t 8 -an -movflags +faststart`, with a `-crf` that leaves each file ≤ 2 MB.
  - It also extracts frame 0 as `.jpg`.
- [ ] **Step 2: Generate and check them.**
  Run:
  ```bash
  npm run story-backgrounds
  ffprobe -v error -show_entries stream=width,height,codec_name,pix_fmt,r_frame_rate -show_entries format=duration,size -of compact assets/stories/bg-dark.mp4
  ```
  Expected: `h264`, `1080`, `1920`, `yuv420p`, `30/1`, duration ≈ 8.0 and `size` ≤ 2097152. Run the same for `bg-light.mp4`.
- [ ] **Step 3: Check the loop.** Compare the first and the last frame:
  ```bash
  ffmpeg -v error -i assets/stories/bg-dark.mp4 -vf "select=eq(n\,0)+eq(n\,239)" -vsync 0 /tmp/f%d.png
  ```
  Then look at both. They have to be practically the same.
- [ ] **Step 4: Commit** `"Compartir: videos de fondo en loop para Stories (oscuro y claro)"`.

---

### Task 2: Estilos

**Files:**
- Create: `src/features/share/story-style.ts`
- Test: `src/features/share/__tests__/story-style.test.ts`

**Interfaces:**
- Produces:
  - `export type StoryStyle = "dark" | "light";`
  - `export const DEFAULT_STYLE: StoryStyle = "dark";`
  - `export const STORY_STYLES: readonly StoryStyle[] = ["dark", "light"];`
  - `export const STYLE_LABEL: Record<StoryStyle, string>` = `{ dark: "Oscuro", light: "Claro" }`
  - `export type StylePalette = { card: string; text: string; base: string }`. `base` is the solid color of the background (`#0b0b0c` / `#f3efe8`), used as the fallback when the video doesn't load.
  - `export const STYLE_PALETTE: Record<StoryStyle, StylePalette>` with the values from the Global Constraints.
  - `export const STYLE_ASSETS: Record<StoryStyle, { video: number; still: number }>`: `require("../../../assets/stories/bg-dark.mp4")`, etc.
  - `export const styleFromLabel = (label: string): StoryStyle`: inverse of `STYLE_LABEL`; anything unknown gives `DEFAULT_STYLE`.

- [ ] **Step 1: Write the failing tests.**
  - The labels and their order `["Oscuro", "Claro"]`.
  - `styleFromLabel("Claro") === "light"` and `styleFromLabel("x") === "dark"`.
  - The palette hex values exactly as in the Global Constraints.
- [ ] **Step 2: Run them and check that they fail** (`npx jest src/features/share/__tests__/story-style.test.ts --maxWorkers=2`).
- [ ] **Step 3: Implement it.** In Jest, `require` of an `.mp4` or `.jpg` must resolve. If the jest config has no `moduleNameMapper` for those extensions, add `mp4` to the existing assets mapper.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** `"Compartir: estilos Oscuro y Claro"`.

---

### Task 3: Renderers de tarjeta y composición fija

**Files:**
- Modify: `src/features/share/story-canvas.ts`
  - `TextSpec` and `drawText` take the text color (today it's always white).
  - `drawBrand(canvas, x, bottom, color)` draws the brand at a given position, with the given color.
  - `makeStory()` stays as it is for the still image.
  - Add `makeCard(height: number)`.
- Modify:
  - `src/features/share/render-collage.ts` → `renderCollageCard`
  - `src/features/share/render-invite.ts` → `renderInviteCard`
- Create:
  - `src/features/share/card-layout.ts`: pure math, testable;
  - `src/features/share/compose-still.ts`.
- Test: `src/features/share/__tests__/card-layout.test.ts`

**Interfaces:**
- Consumes: `StoryStyle`, `STYLE_PALETTE`, `STYLE_ASSETS` (Task 2); `collageLayout`, `Rect` (`collage.ts`); `loadImages`, `fetchImage` (`load-images.ts`).
- Produces:
  - `export const CARD_W = 920; export const CARD_PAD = 48; export const CARD_RADIUS = 56;` in `card-layout.ts`.
  - `export function cardHeight(input: { kind: "collage" | "invite"; titleHeight: number }): number` in `card-layout.ts`. It is the total height of the card from its parts:
    - **collage:** padding + the small line (34 px plus spacing) + the title (measured) + the mosaic (a fixed 6×4 grid with aspect ratio 3:2 over `CARD_W - 2*CARD_PAD`) + the brand + padding;
    - **invite:** padding + a square hero of `CARD_W - 2*CARD_PAD` + "Sumate con el código" + the code + the brand + padding.
  - `export type Card = { png: Uint8Array; width: number; height: number };`
  - `export async function renderCollageCard(input: { name: string; caption: string; photos: RevealedPhoto[]; style: StoryStyle }): Promise<Card>`. It throws `Error("no images")` as today.
  - `export async function renderInviteCard(input: { name: string; caption: string; code: string; coverUrl: string | null; swatches: RGB[]; style: StoryStyle }): Promise<Card>`.
  - `export async function composeStill(card: Card, style: StoryStyle): Promise<Uint8Array>` in `compose-still.ts`:
    - draws the style's `.jpg` (loaded with `expo-asset` → `Skia.Data.fromURI`) at 1080×1920;
    - draws the card centered horizontally and vertically;
    - returns a JPEG at quality 92.
  - **Card contents:**
    - The **collage** has, in this order: the small line, the title (up to 3 lines with "…"), the mosaic with a radius of 20 per photo, and the brand (logo + "Rollo Project" + `rolloproject.com` at 0.55) at the bottom.
    - The **invite** has the hero (cover / swatches / cobalt, with the current gradient and texts on top), then "Sumate con el código" and the code, then the brand. It no longer has the empty space for the sticker: the user places the Enlace sticker wherever they want on the background.
    - The PNG keeps the transparent alpha outside the rounded card.
- [ ] **Step 1: Write the failing tests for `cardHeight`.**
  - Collage with a 1-line title (`titleHeight 84`) and with a 3-line one (`252`): the height grows by exactly 168.
  - Invite: the height doesn't depend on `titleHeight`, because the title goes inside the hero.
  - Both always ≤ 1700, so they fit inside 1920 with margin.
- [ ] **Step 2: Run them and check that they fail** (`npx jest src/features/share/__tests__/card-layout.test.ts --maxWorkers=2`).
- [ ] **Step 3: Implement `card-layout.ts`.** Run the tests. Expected: PASS.
- [ ] **Step 4: Implement the card renderers and `composeStill`.** They reuse the current drawing (mosaic, hero, brand) with the new origin, the colors of the style and `encodeToBytes(ImageFormat.PNG)` for the card. The old `renderCollage` / `renderInvite` are removed (there are no other uses besides the screen, which changes in Task 5). Dispose surfaces and images in `finally`, as today.
- [ ] **Step 5: Update the global mocks in `jest.setup.ts`** so they export `renderCollageCard`, `renderInviteCard` and `composeStill`, and drop the old names.
- [ ] **Step 6: Run the checks.** Run `npx jest src/features/share --maxWorkers=2` and `npm run typecheck`. Expected: PASS. In typecheck, only the known route errors plus the screen errors that Task 5 fixes are allowed. If you'd rather keep the typecheck clean, temporarily adapt the screen's two calls.
- [ ] **Step 7: Commit** `"Compartir: tarjeta como sticker y composición fija por estilo"`.

---

### Task 4: Compartir con video de fondo

**Files:**
- Modify: `src/features/share/share-story.ts`
- Test: `src/features/share/__tests__/share-story.test.ts`

**Interfaces:**
- Produces:
  - `export async function writeShareFile(bytes: Uint8Array, name: string): Promise<string>` replaces `writeStoryFile`. The file name includes the extension (`rollo-collage-card.png`, `rollo-collage-still.jpg`, …).
  - `export async function assetUri(module: number): Promise<string>`: `Asset.fromModule(module).downloadAsync()` → `localUri`.
  - `export async function shareToInstagramStories(input: { stickerUri: string; backgroundVideoUri: string; backgroundColor: string; linkText?: string }): Promise<void>`. It calls `shareSingle` with `social: INSTAGRAM_STORIES`, `appId: META_APP_ID`, `stickerImage`, `backgroundVideo`, `linkText` (when given), and `backgroundTopColor` / `backgroundBottomColor` set to `backgroundColor` (the style's `base`).
  - `shareMore` and `instagramStoriesAvailable` stay as they are.
- [ ] **Step 1: Write the failing tests.**
  - `shareToInstagramStories` passes `stickerImage` and `backgroundVideo`, and does **not** pass `backgroundImage`.
  - It passes `linkText` only when given.
  - `writeShareFile` uses the given name.
  - `assetUri` returns the `localUri` of the mocked `expo-asset`.
- [ ] **Step 2: Run them and check that they fail.**
- [ ] **Step 3: Implement it.** Check that the patch in `patches/react-native-share+12.3.1.patch` still applies, since the `linkText` branch doesn't change.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** `"Compartir: Stories con video de fondo y tarjeta como sticker"`.

---

### Task 5: Pantalla — selector de estilo y vista previa en movimiento

**Files:**
- Modify:
  - `src/features/share/share-story-screen.tsx`
  - `src/features/share/use-story-image.ts` → it becomes `use-story-assets.ts`
- Create: `src/features/share/story-preview.tsx`
- Test: `__tests__/share-story.test.tsx`

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces:
  - `export function useStoryAssets(build: (() => Promise<Card>) | null, key: string, name: "collage" | "invite", style: StoryStyle): { card: { uri: string; width: number; height: number } | null; stillUri: string | null; error: boolean; retry: () => void }`.
    - It writes the card PNG and the composed still (`composeStill`).
    - Query key `["story-image", key, style]`, still not persisted.
  - `export function StoryPreview({ style, card }: { style: StoryStyle; card: { uri: string; width: number; height: number } | null })`:
    - a 9:16 box with background color `STYLE_PALETTE[style].base`;
    - the style's video in a loop, muted, without controls (`useVideoPlayer` with `loop = true`, `muted = true`, `play()`; `VideoView` with `contentFit="cover"`, `nativeControls={false}`);
    - the card on top, centered, scaled to the box with its aspect ratio.
- **Behavior:**
  - `SegmentedControl` (`@expo/ui/community/segmented-control`, like `revealed-roll-screen.tsx`) with `STORY_STYLES.map(s => STYLE_LABEL[s])`, placed between the preview and the buttons.
  - `style` lives in `useState(DEFAULT_STYLE)`.
  - "Compartir en Stories" calls `shareToInstagramStories({ stickerUri: card.uri, backgroundVideoUri: await assetUri(STYLE_ASSETS[style].video), backgroundColor: STYLE_PALETTE[style].base, linkText })`, with `linkText` only for the invite.
  - "Más opciones" calls `shareMore(stillUri, link?)` and copies the link first, as today.
  - "Otras", errors, the empty state and the sticker note stay as they are.
- [ ] **Step 1: Write the failing tests** (update the existing ones and add these):
  - `"defaults to Oscuro and switching to Claro rebuilds with the light style"`: the card build receives `style: "light"`.
  - `"Stories shares the card as sticker over the style's video"`.
  - `"Más opciones shares the composed still of the chosen style"`.
  - `"switching style twice shares the last one"` (Review Focus 1).
  - `"without Instagram only Más opciones, with the chosen style's still"`.
  - `"the preview shows the card over the base color even if the video never plays"`: the box has the `base` color and the card image is rendered.
- [ ] **Step 2: Run them and check that they fail** (`npx jest __tests__/share-story.test.tsx --maxWorkers=2`).
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run the tests and the related ones.** Run `npx jest __tests__/share-story.test.tsx src/features/share src/features/roll/__tests__/share-entry.test.tsx --maxWorkers=2` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `"Compartir: selector Oscuro/Claro y vista previa con video"`.

---

### Task 6: Docs y prueba en el iPhone

**Files:**
- Modify: `mobile/CLAUDE.md`, the "Compartir en Stories" entry:
  - background video + card as sticker;
  - the Oscuro/Claro styles;
  - `assets/stories/` and `npm run story-backgrounds`;
  - "Más opciones" uses the composed still.

- [ ] **Step 1: Update CLAUDE.md and commit** `"Docs: Stories con fondo animado y estilos"`.
- [ ] **Step 2: Check it on the device** (the dev build is already installed; with Metro it's enough, since there's nothing new that's native):
  - the preview moves smoothly in both styles;
  - Instagram opens with the moving background and the card as a sticker you can move;
  - "Más opciones" sends the still image in the chosen style;
  - in the invite, the Enlace sticker pastes the link.
