# Compartir en Stories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que desde un rollo se pueda compartir en Instagram Stories (o por el menú del sistema) un collage del rollo revelado o una invitación al rollo antes del revelado.

**Architecture:** El backend agrega `shareable` por foto en el feed (la regla de destacar, sin la condición de amistad). La app arma una imagen de 1080×1920 sin mostrarla en pantalla con Skia, la guarda en el caché y la abre en el editor de Stories de Instagram (`react-native-share`) o en el menú de compartir. Todo vive en una feature nueva, `src/features/share/`, con lógica pura testeada (selección, mosaico, textos) separada de los renderers de Skia.

**Tech Stack:** Expo SDK 58 / RN 0.88, `@shopify/react-native-skia` 2.14 (ya instalado), `react-native-share` y `expo-clipboard` (nuevos), Hono + Zod + D1 en el backend (vitest con `@cloudflare/vitest-plugin`).

**Spec:** `mobile/docs/superpowers/specs/2026-11-25-compartir-en-stories-design.md`. Maquetas: `/Users/juanifraga/Desktop/Rollo/.superpowers/brainstorm/11957-1795580908/content/stories-v1.html` (collage = opción B).

## Global Constraints

- Ramas: `feature/compartir-en-stories` en **los dos** repos (`backend/` y `mobile/`), desde `develop`. El job `contract` del CI de la app compara contra la rama del backend con el mismo nombre.
- Código, identificadores y descripciones de tests en inglés. Textos de UI en rioplatense con voseo. Commits y PRs en español.
- Tests: solo los de lo que tocaste, con `--maxWorkers=2` (`npx jest <ruta> --maxWorkers=2`). En el backend: `npx vitest run test/<archivo>`.
- `app/` solo rutea. Una feature no mete mano en otra: se importa lo público.
- Meta App ID: `1187882687102371`. Es público y va en `src/config.ts` como `META_APP_ID`.
- La imagen mide 1080×1920. Fondo `#0b0b0c`, texto siempre blanco. Degradé de las fotos: `rgba(0,0,0,0)` al 40 % → `rgba(0,0,0,0.6)` al 100 %.
- El cobalto (`#3155F5`) se usa solo en el degradé de una invitación sin fotos. Nunca como relleno decorativo en otro lado.
- Marca (en las dos piezas): el logo "Revelado" (círculos en un cuadrado de 120: `(60,60) r34 α.18`, `(66,54) r24 α.38`, `(71,49) r14 α1`, blancos) + "Rollo Project", y debajo `rolloproject.com` con opacidad 0.55. Nada de "Descargá la app".
- Textos exactos:
  - Botones: "Compartir en Stories", "Más opciones", "Otras".
  - Fila de entrada: "Compartir en Stories".
  - Título del modal: "Compartir".
  - Invitación: "Te invito a", "Sumate con el código".
  - Aviso: "Copiamos el link. Pegalo en tu story con el sticker de Enlace".
  - Error: "No se pudo armar la imagen. Probá de nuevo." con "Reintentar".
- La app es solo iOS. Sumar `react-native-share` es nativo: hace falta un build nuevo (ver Task 9).

## Review Focus

1. **Nombre largo del rollo** (60 caracteres): el título se corta en 3 renglones con "…" y nunca tapa el mosaico ni el código. Tests en Tasks 3 y 4 (`titleLines`).
2. **Algunas fotos no bajan** (sin señal a mitad de camino, 404): el collage se arma con las que bajaron. Si no bajó ninguna, error con "Reintentar". Test en Task 5.
3. **Sin Instagram o sin App ID:** no aparece "Compartir en Stories", queda solo "Más opciones". Test en Task 6.
4. **Invitación de un rollo sin fotos todavía:** degradé en cobalto, sin cuadros vacíos. Test en Task 4.
5. **El usuario cierra el editor de Instagram o el menú sin compartir:** no aparece ningún error. Test en Task 6.

---

### Task 1: Backend — `shareable` en el feed

**Repo:** `backend/` (rama `feature/compartir-en-stories` desde `develop`).

**Files:**
- Modify: `src/modules/featured/featured.service.ts` (al lado de `featuringDenial` / `canFeature`)
- Modify: `src/modules/media/media.controller.ts` (`presentFeedItem`, bloque `...(revealed && {...})`)
- Modify: `src/modules/media/media.schemas.ts` (al lado de `canFeature`)
- Modify: `openapi.json` (regenerado)
- Test: `test/shareable.test.ts` (nuevo; copiar los helpers `revealedTrip` / `feedItem` / `setAccount` / `setMember` / `setPrivate` de `test/featuring-levels.test.ts`, **sin** `befriend`)

**Interfaces:**
- Produces: `export type SharingFacts = Omit<FeaturingFacts, "authorIsFriend">` and `export const canShare = (f: SharingFacts): boolean` in `featured.service.ts`. Feed item field `shareable?: boolean` (only after the reveal).

- [ ] **Step 1: Write the failing tests** in `test/shareable.test.ts`, `describe("shareable in the revealed feed (featuring rule without friendship)")`:
  - `"another member's photo is shareable without being friends"`: `feedItem(t.tripId, t.juani.token, t.fedePhoto)` → `toMatchObject({ shareable: true, canFeature: false })`.
  - `"your own photo is shareable"`: own photo → `shareable: true`.
  - `"feature-block makes it not shareable"`: `PUT /media/${fedePhoto}/feature-block` with Fede's token → Juani sees `shareable: false`; Fede still sees his own as `shareable: true`.
  - `"the author's rollo setting and account setting make it not shareable"`: `setMember(tripId, fede.token, false)` → `false`; in a new trip, `setAccount(fede.token, false)` → `false`.
  - `"a private rollo makes nothing shareable, not even your own"`: `setPrivate(tripId, juani.token, true)` → own and others' are `false`.
  - `"moment photos, archived photos and videos are never shareable"`: moment → copy the setup of `test/moment-feed.test.ts`; archived own (`POST /media/{id}/archive`) → `false`; video → `uploadMedia` with video type as the existing tests do → `false`.
  - `"before the reveal the field is absent"`: unrevealed trip → `expect(item).not.toHaveProperty("shareable")`.

- [ ] **Step 2: Run them and check that they fail**
  Run: `npx vitest run test/shareable.test.ts`
  Expected: FAIL (`shareable` undefined).

- [ ] **Step 3: Implement `canShare(f: SharingFacts): boolean`** in `featured.service.ts`. It is `!f.rolloPrivate && (f.viewerIsAuthor || (!f.photoBlocked && f.memberAllows && f.accountAllows))`. Update the header comment of the "Where can a photo go?" block with one line: sharing outside the rollo is the same rule without level 3 (friendship).

- [ ] **Step 4: Add `shareable` to `presentFeedItem`** right after `canFeature`: `r.type === "photo" && r.momentDay === null && !r.archived && canShare({...})`, with the same facts as `canFeature` except `authorIsFriend`. Use the field the row already exposes for the type (the same one that feeds `type` in the item). In `media.schemas.ts` add `shareable: z.boolean().optional()` with this description: `"Only after the reveal: whether you may share it outside the rollo (Instagram Stories collage). Same levels as canFeature without the friendship requirement: false if the rollo is private, if its author blocked it or does not let others (rollo membership or account); always false for videos, archived photos and the photos of a daily moment"`.

- [ ] **Step 5: Run them and check that they pass**, plus the suites that already cover the feed.
  Run: `npx vitest run test/shareable.test.ts test/featuring-levels.test.ts test/featured-friends.test.ts test/archive.test.ts` and `npm run typecheck`.
  Expected: PASS.

- [ ] **Step 6: Regenerate the contract**
  Run: `npm run openapi`. Expected: `openapi.json` has `shareable` in `FeedItem`.

- [ ] **Step 7: Commit and push**
  ```bash
  git add src/modules/featured/featured.service.ts src/modules/media/media.controller.ts src/modules/media/media.schemas.ts openapi.json test/shareable.test.ts
  git commit -m "Feed: shareable por foto (regla de destacar sin amistad) para compartir en Stories"
  git push -u origin feature/compartir-en-stories
  ```

---

### Task 2: App — contrato y `shareable` en `RevealedPhoto`

**Repo:** `mobile/` (rama `feature/compartir-en-stories` desde `develop`).

**Files:**
- Modify: `src/api/schema.d.ts` (generado, no se edita a mano)
- Modify: `src/features/media/revealed.ts` (`RevealedPhoto` y `toRevealedPhotos`)
- Test: `src/features/media/__tests__/revealed.test.ts`

**Interfaces:**
- Produces: `RevealedPhoto.shareable: boolean` (false when the server didn't send it).

- [ ] **Step 1: Regenerate the contract**
  Run: `API_SPEC=../backend/openapi.json npm run api:generate`. Expected: `shareable?: boolean` in `FeedItem` of `schema.d.ts`.
- [ ] **Step 2: Write the failing test** in `revealed.test.ts`: `"carries shareable, false when the server omits it"`. An item with `shareable: true` → `true`; one without the field (old API) → `false`.
- [ ] **Step 3: Run it and check that it fails**
  Run: `npx jest src/features/media/__tests__/revealed.test.ts --maxWorkers=2`
- [ ] **Step 4: Implement it.** Add the field with a one-line doc comment, set to `item.shareable ?? false`. If any fixtures of other tests build a `RevealedPhoto` by hand, `npm run typecheck` flags them: add `shareable: false` there.
- [ ] **Step 5: Run the test and `npm run typecheck`.** Expected: PASS.
- [ ] **Step 6: Commit**
  ```bash
  git add src/api/schema.d.ts src/features/media/revealed.ts src/features/media/__tests__/revealed.test.ts
  git commit -m "Contrato: shareable en las fotos reveladas"
  ```

---

### Task 3: Lógica del collage (selección y mosaico)

**Files:**
- Create: `src/features/share/collage.ts`
- Test: `src/features/share/__tests__/collage.test.ts`

**Interfaces:**
- Consumes: `RevealedPhoto` (Task 2).
- Produces:
  - `export const COLLAGE_MAX = 8;`
  - `export function collageCandidates(photos: RevealedPhoto[]): RevealedPhoto[]`: the ones with `shareable === true` (the server already applies the whole rule).
  - `export function pickCollage(candidates: RevealedPhoto[], seed: number): RevealedPhoto[]`: up to `COLLAGE_MAX`, deterministic for each `seed`; the first one is the hero.
  - `export const canShuffle = (candidates: RevealedPhoto[]): boolean`: `candidates.length >= 2`.
  - `export type Rect = { x: number; y: number; w: number; h: number };`
  - `export function collageLayout(count: number, frame: Rect, gap: number): Rect[]`: `count` from 1 to 8, the hero first.
  - `export function dateRange(startsAt: number, endsAt: number, timeZone: string): string` → `"3 – 9 de enero"`. Across two months: `"28 de diciembre – 3 de enero"`; a single day: `"12 de diciembre"`. Use `dateFormatter` from `src/lib/intl.ts`.
  - `export function collageCaption(input: { startsAt: number; endsAt: number; timeZone: string; people: number }): string` → `` `${dateRange(...)} · ${peopleLabel(people)}` ``, for example `"3 – 9 de enero · 8 personas"` (`peopleLabel` from `src/features/events/event.ts`).

- [ ] **Step 1: Write the failing tests**
  - `collageCandidates`: keeps only `shareable: true`.
  - `pickCollage`: with 20 candidates it returns 8, with no repeats; the same `seed` gives the same result; seeds 1 and 2 give a different order or hero; with 3 candidates it returns 3.
  - `collageLayout`: for each `count` from 1 to 8 with `frame {x:0,y:0,w:1000,h:1200}` and `gap 12`:
    - it returns `count` rects inside the frame, with no overlaps;
    - `rects[0]` has the largest area;
    - **no holes:** `Σ (w+gap)(h+gap) ≈ (W+gap)(H+gap)` (tolerance 1 px²·count).
  - With `count 8` it reproduces the layout of option B: a 6×4 grid, the hero takes 4 columns × 2 rows top left, and the other 7 fill the rest.
  - `dateRange` and `collageCaption`: the examples above (same month, two months, a single day, 1 person), in the trip's zone.
- [ ] **Step 2: Run them and check that they fail**
  Run: `npx jest src/features/share/__tests__/collage.test.ts --maxWorkers=2`
- [ ] **Step 3: Implement it.** `pickCollage` shuffles with a PRNG seeded by `seed` (mulberry32 or similar, inline). Use no `Math.random`. `collageLayout` uses one template per `count` over a 6-column grid. The layout for 8 is fixed by the spec; the others are the implementer's call, as long as they pass the no-holes test.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit** `"Compartir: selección y mosaico del collage"`.

---

### Task 4: Lógica de la invitación

**Files:**
- Create: `src/features/share/invite.ts`
- Test: `src/features/share/__tests__/invite.test.ts`

**Interfaces:**
- Consumes: `TripDetail` (`@/features/trips/actions`), `joinedLine` / `eventDay` / `isEvent` (`@/features/events/event`), `memberTotal` (`@/features/trips/member-total`), `joinLinkUrl` (`@/features/events/join-link`), `thumbHashAverageColor` (`@/features/trips/thumbhash-color`).
- Produces:
  - `export function canShareInvite(detail: TripDetail): boolean`: `!detail.trip.revealed && detail.members.length < detail.trip.maxMembers`. This is the same condition `RollInvite` uses for the code.
  - `export function inviteCaption(detail: TripDetail): string`:
    - An event with a cover gives `` `${eventDay(...)} · ${joinedLine(total >= 5 ? total : null)}` ``, for example "12 de diciembre · 84 personas ya se unieron" or "12 de diciembre · Sé de los primeros en unirte".
    - Without a cover it gives `` `${dateRange(...)} · sin revelar` `` (`dateRange` from Task 3).
  - `export function inviteSwatches(thumbhashes: (string | null)[], max = 16): { r: number; g: number; b: number }[]`: the average colors of the thumbhashes that exist, up to `max`; `[]` when there are none.
  - `export const inviteLink = (detail: TripDetail): string => joinLinkUrl(detail.trip.joinCode)`.
- [ ] **Step 1: Write the failing tests** for each function:
  - a regular rollo, an event, a full roll and a revealed roll in `canShareInvite`;
  - an event with a cover and 3 or 84 people, and a rollo without a cover, in `inviteCaption`;
  - `inviteSwatches` with nulls, with more than 16 and with an empty list;
  - `inviteLink` for a regular rollo gives `https://rolloproject.com/join/<CODE>`.
- [ ] **Step 2: Run them and check that they fail** (`npx jest src/features/share/__tests__/invite.test.ts --maxWorkers=2`).
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit** `"Compartir: textos y colores de la invitación"`.

---

### Task 5: Renderers de Skia

**Files:**
- Create: `src/features/share/story-canvas.ts`: the shared pieces: `STORY_W = 1080`, `STORY_H = 1920`, `BACKGROUND = "#0b0b0c"`, `drawBrand(canvas)`, `drawScrim(canvas, rect)`, `clipRounded(canvas, rect, radius)`, `drawText(...)` with Skia's Paragraph API (system font, white), `titleLines`, and `encodeStory(surface): Uint8Array` (JPEG, quality 92).
- Create: `src/features/share/render-collage.ts`
- Create: `src/features/share/render-invite.ts`
- Create: `src/features/share/load-images.ts`
- Test: `src/features/share/__tests__/load-images.test.ts`

**Interfaces:**
- Consumes: Tasks 3 and 4. `API_URL` (`@/config`), `getSession` (`@/features/auth/session`).
- Produces:
  - `export async function loadImages(paths: string[]): Promise<(SkImage | null)[]>`: downloads each `thumbPath` with `Authorization: Bearer <token>` (the same pattern as `gallery/save.ts`), at most 4 at a time, and returns `null` for a failed one, without throwing.
  - `export async function renderCollage(input: { name: string; caption: string; photos: RevealedPhoto[] }): Promise<Uint8Array>`: it throws `new Error("no images")` if none could be downloaded. It redoes `collageLayout` with as many as were downloaded.
  - `export async function renderInvite(input: { name: string; caption: string; code: string; coverUrl: string | null; swatches: RGB[] }): Promise<Uint8Array>`.
- Layout (in px over 1080×1920; the proportions come from the mockup, `stories-v1.html`):
  - **Collage:**
    - Side margin 64.
    - The caption line (`caption`, 34 px, opacity 0.7) at y≈150, and the name below it (bold, 76 px, up to 3 lines with "…").
    - The mosaic in the frame from below the title down to y=1600, `gap 14` and a radius of 28 on each photo (`cover` crop).
    - The brand at the bottom, ending at y≈1840.
  - **Invitation:**
    - The square hero with a radius of 48 at x 64…1016, y 210.
    - Inside, at the bottom over the gradient: "Te invito a" (34 px, 0.85), the name (bold, 76 px, up to 3 lines) and `caption` (34 px, 0.85).
    - Below the square: "Sumate con el código" (34 px, 0.7) and the code (bold, 110 px, `letterSpacing` 18).
    - Then **≈180 px of empty space** for the sticker, and the brand at the bottom.
    - The hero's fill:
      - with `coverUrl`: the cover (public, `${API_URL}${coverUrl}`, with no token);
      - with `swatches`: a 4×4 grid of those colors with `Skia.ImageFilter.MakeBlur(60, 60)`;
      - with neither: a linear gradient from `#3155F5` to `#0b1a5c`.
- [ ] **Step 1: Write the failing tests for `loadImages`**, with `globalThis.fetch = jest.fn(...)` and Skia mocked the way the project already mocks it in Jest (if there is no mock, mock `@shopify/react-native-skia` in the test with `Skia.Data.fromBytes` / `Skia.Image.MakeImageFromEncoded` returning a sentinel):
  - it sends the Bearer token;
  - a 404 or a network error gives `null` in that position;
  - it never runs more than 4 at once.
- [ ] **Step 2: Run them and check that they fail** (`npx jest src/features/share/__tests__/load-images.test.ts --maxWorkers=2`).
- [ ] **Step 3: Implement `loadImages`.** Run the tests. Expected: PASS.
- [ ] **Step 4: Implement `story-canvas.ts`, `render-collage.ts` and `render-invite.ts`** with `Skia.Surface.MakeOffscreen(1080, 1920)`, as in `qrPng` (`src/features/events/qr-canvas.tsx`). These have no unit tests (Skia doesn't draw in Jest). They are checked on the device in Task 9, against the mockup.
- [ ] **Step 5: `npm run typecheck`.** Commit `"Compartir: imágenes del collage y la invitación con Skia"`.

---

### Task 6: Compartir (Instagram Stories y menú) + dependencias nativas

**Files:**
- Modify: `package.json` / `package-lock.json` (`npx expo install react-native-share expo-clipboard`)
- Modify: `app.json`: `ios.infoPlist.LSApplicationQueriesSchemes: ["instagram-stories", "instagram"]`
- Modify: `src/config.ts`: `export const META_APP_ID = "1187882687102371";` with a one-line comment (Meta app "Rollo Project", public)
- Create: `src/features/share/share-story.ts`
- Modify: `jest.setup.ts`: mock `react-native-share` (`shareSingle` resolves) and `expo-clipboard`
- Test: `src/features/share/__tests__/share-story.test.ts`

**Interfaces:**
- Produces:
  - `export async function writeStoryFile(bytes: Uint8Array, name: "collage" | "invite"): Promise<string>`: `File(Paths.cache, \`rollo-${name}.jpg\`)` overwritten. Returns the `file://` uri.
  - `export async function instagramStoriesAvailable(appId: string | null = META_APP_ID): Promise<boolean>`: `false` without an `appId`. Otherwise `Linking.canOpenURL("instagram-stories://share")`, and `false` if that throws.
  - `export async function shareToInstagramStories(uri: string): Promise<void>`: `Share.shareSingle({ social: Share.Social.INSTAGRAM_STORIES, appId: META_APP_ID, backgroundImage: uri })`.
  - `export async function shareMore(uri: string, message?: string): Promise<void>`: React Native's `Share.share({ url: uri, message })`.
  - `export const isShareCancel = (e: unknown): boolean`: true for a user cancel (react-native-share rejects with `"User did not share"`) or when the menu was dismissed.
- [ ] **Step 1: Install and configure.** Run `npx expo install react-native-share expo-clipboard`, edit `app.json` and add `META_APP_ID`. Check whether `react-native-share` brings its own config plugin for Expo. If it does, add it to `plugins`; if not, `LSApplicationQueriesSchemes` is enough.
- [ ] **Step 2: Write the failing tests**:
  - `instagramStoriesAvailable(null)` → `false` (and it doesn't call `canOpenURL`);
  - `instagramStoriesAvailable("1")` with `canOpenURL` true / false / throwing → `true` / `false` / `false`;
  - `shareToInstagramStories` calls `shareSingle` with `appId: "1187882687102371"` and the uri;
  - `isShareCancel(new Error("User did not share"))` → `true`, and any other error → `false`.
- [ ] **Step 3: Run them and check that they fail** (`npx jest src/features/share/__tests__/share-story.test.ts --maxWorkers=2`).
- [ ] **Step 4: Implement it.** Run the tests and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `"Compartir: Instagram Stories y menú del sistema (react-native-share, expo-clipboard)"`.

---

### Task 7: Pantalla "Compartir"

**Files:**
- Create: `app/share-story.tsx`: reads `tripId` and `kind` (`"collage" | "invite"`) and mounts `<ShareStoryScreen />`
- Modify: `app/_layout.tsx`: `<Stack.Screen name="share-story" options={{ title: "Compartir", presentation: "modal" }} />`, next to `event-qr`
- Modify: `src/test/routes.ts`: register the route
- Create: `src/features/share/share-story-screen.tsx`
- Create: `src/features/share/use-story-image.ts`
- Test: `__tests__/share-story.test.tsx` (screen with `renderRouter`; mock `@/features/share/render-collage`, `render-invite`, `share-story` and `@/features/trips/actions`)

**Interfaces:**
- Consumes: Tasks 3–6. `useTripDetail` (`@/features/trips/use-trip-detail`), `useRevealedPhotos` (`@/features/media/revealed`), `useFeed` (`@/features/trips/use-feed`, for the invite's thumbhashes), `Button` / `Footnote` / `ErrorText` / `Screen` / `Loading` (`@/ui/components`), `Clipboard.setStringAsync` (`expo-clipboard`).
- Produces:
  - `export function useStoryImage(build: (() => Promise<Uint8Array>) | null, key: string): { uri: string | null; loading: boolean; error: boolean; retry: () => void }`. It rebuilds when `key` changes (the seed for "Otras"). This is a `useQuery` with a key `["story-image", tripId, kind, seed]` that is **not persisted**: exclude it in `shouldDehydrateQuery` in `src/api/query-client.ts`.
  - `export function ShareStoryScreen({ tripId, kind }: { tripId: string; kind: "collage" | "invite" })`.
- Behavior:
  - `Screen grouped`, with "Cancelar" in the toolbar on the left (`router.back()`).
  - The preview is the `uri` in an `expo-image`, 9:16, `radius.lg`, at most 62 % of the screen height.
  - Buttons:
    - "Compartir en Stories" (`primary`), only if `instagramStoriesAvailable()` is true;
    - "Más opciones" (`secondary`);
    - "Otras" (plain), only for the collage and when `canShuffle`. It increments the seed.
  - Invitation: each of the two buttons first does `Clipboard.setStringAsync(inviteLink(detail))`. "Más opciones" also passes it as `message`. Below the buttons, `Footnote` "Copiamos el link. Pegalo en tu story con el sticker de Enlace".
  - Errors:
    - while the image is being built, `Loading`;
    - if building it fails, `ErrorText` "No se pudo armar la imagen. Probá de nuevo." with a "Reintentar" button;
    - if sharing fails, `ErrorText` under the buttons, unless `isShareCancel`, which shows nothing.
  - Success: the screen doesn't change (Instagram or the menu is already in front).
- [ ] **Step 1: Write the failing screen tests**:
  - `"collage: shows the preview, Compartir en Stories and Otras; Otras rebuilds with a new seed"`;
  - `"collage without Instagram: only Más opciones"`;
  - `"invite: copies the link before opening Stories and shows the sticker note"`;
  - `"render failure shows the error and Reintentar rebuilds"`;
  - `"a cancelled share shows no error; another failure shows it"`.
- [ ] **Step 2: Run them and check that they fail** (`npx jest __tests__/share-story.test.tsx --maxWorkers=2`).
- [ ] **Step 3: Implement the route, the hook and the screen.**
- [ ] **Step 4: Run the tests and `npm run typecheck`.** Expected: PASS.
- [ ] **Step 5: Commit** `"Compartir: pantalla con vista previa, Stories, Más opciones y Otras"`.

---

### Task 8: Entradas — segmento "Rollo" revelado e "Invitar"

**Files:**
- Modify: `src/features/roll/roll-overview.tsx`: "Compartir en Stories" row → `router.push({ pathname: "/share-story", params: { tripId, kind: "collage" } })`. It shows only if `!detail.trip.featuringDisabled && collageCandidates(photos).length > 0`, in its own `Section` right after the summary.
- Modify: `src/features/roll/roll-essentials.tsx` (`RollInvite`): "Compartir en Stories" row → `kind: "invite"`. It shows when `canShareInvite(detail)`, under "Código".
- Modify: `src/features/events/qr-screen.tsx`: secondary "Compartir en Stories" button under the current share button → the same route with `kind: "invite"`. It shows only if `canShareInvite(detail)`.
- Test: `src/features/roll/__tests__/share-entry.test.tsx` (`renderRouter`, mocking `@/features/trips/actions`)

- [ ] **Step 1: Write the failing tests**:
  - the revealed roll with shareable photos shows the row, and tapping it opens `/share-story?kind=collage`;
  - a private rollo, or one with no shareable photos, doesn't show it;
  - an unrevealed roll that isn't full shows the invitation row; a full one doesn't, and a revealed one doesn't either;
  - the organizer's QR shows the button.
- [ ] **Step 2: Run them and check that they fail.**
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run the tests plus those of the files you touched** (`npx jest --findRelatedTests src/features/roll/roll-overview.tsx src/features/roll/roll-essentials.tsx src/features/events/qr-screen.tsx --maxWorkers=2`). Expected: PASS.
- [ ] **Step 5: Commit** `"Compartir: entradas en el rollo revelado, Invitar y el QR"`.

---

### Task 9: Docs, build y prueba en el iPhone

**Files:**
- Modify: `mobile/CLAUDE.md`: a short "Compartir en Stories" entry in "Qué es Rollo":
  - feature `src/features/share/`, route `/share-story`;
  - the `shareable` rule;
  - `META_APP_ID`;
  - rebuild needed for `react-native-share`.
- Modify: `app.json` `version` **only if 1.4.0 already went out in a build** (check with `npx eas-cli@latest build:list -p ios --limit 3`). If it already did, bump it to `1.5.0`: it's a native change and `runtimeVersion` follows the version.

- [ ] **Step 1: Update `CLAUDE.md`** and, if needed, the version. Commit `"Docs: compartir en Stories"`.
- [ ] **Step 2: Native rebuild of the dev build**
  Run: `npx expo prebuild --clean && npx expo run:ios --device`. Expected: it installs and opens.
- [ ] **Step 3: Check it on the device against the mockup** (`stories-v1.html`, collage B), with the backend local on the branch (`npm run dev:lan` in `backend/`, seed with Bariloche revealed):
  - the collage and "Otras";
  - the invitation of a rollo with photos, of one without photos (cobalt) and of an event with a cover;
  - a long name (60 characters);
  - airplane mode halfway through building it.
- [ ] **Step 4: Check Meta.** Check "Compartir en Stories" with the Meta app in **Development** mode. If Instagram rejects it or opens with nothing in it, tell the owner to switch the Meta app to **Live**, and try again.
- [ ] **Step 5: Open the PRs** for both repos to `develop` (the backend first), in Spanish, with what was tested on the device.
