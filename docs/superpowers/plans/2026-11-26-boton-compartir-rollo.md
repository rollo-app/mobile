# Botón "Compartir" del rollo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar las filas "Compartir en Stories" por un botón de compartir en la barra del rollo. El botón abre un modal con "Copiar link", "WhatsApp" e "Instagram", cada opción con su ícono o logo. Además, "Compartir en Stories" pasa a llamarse "Compartir en Instagram", con el logo.

**Architecture:**
- Una sheet nueva, `/share-roll`, muestra las opciones según el estado del rollo. Esa lógica es pura y testeable.
- Instagram reutiliza la pantalla `/share-story` que ya existe.
- WhatsApp usa `whatsapp://send?text=` para la invitación. Para el collage, manda la imagen fija oscura con `react-native-share`.
- Los logos salen de un script, `@resvg/resvg-js` + `simple-icons`, y quedan como PNG en `assets/share/`.

**Tech Stack:** Expo Router (sheet), `react-native-share` (ya parcheado), `expo-clipboard`, `burnt`, `@resvg/resvg-js` (ya instalado), `simple-icons` (devDependency nueva).

**Spec:** `mobile/docs/superpowers/specs/2026-11-26-boton-compartir-rollo-design.md`

## Global Constraints

- Se trabaja en la rama `feature/compartir-en-stories`, solo en `mobile/`.
- Código en inglés. Los textos de UI van en rioplatense. Commits en español, con la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tests: solo los relacionados, con `--maxWorkers=2`. El typecheck tiene que dar limpio, salvo los errores de rutas tipadas ya conocidos.
- Textos exactos:
  - "Compartir en Instagram" reemplaza a "Compartir en Stories" en todos lados;
  - título de la sheet: "Compartir";
  - opciones: "Copiar link", "WhatsApp", "Instagram";
  - HUD al copiar: `Burnt.toast({ title: "Link copiado", preset: "done" })`;
  - accesibilidad del botón de la barra: "Compartir".
- El botón de la barra usa el SF Symbol `square.and.arrow.up` y va a la derecha, junto a `gearshape`. Aparece en los mismos lugares que el engranaje: en el tablero y en el segmento "Rollo" del revelado.
- `app.json`: hay que sumar `"whatsapp"` a `ios.infoPlist.LSApplicationQueriesSchemes`, sin perder `instagram-stories` ni `instagram`.
- Logos: los oficiales, sin recolorear.
  - Instagram: el glyph con el degradé de marca (`#FEDA75` → `#FA7E1E` → `#D62976` → `#962FBF` → `#4F5BD5`).
  - WhatsApp: el glyph en `#25D366`.
  - Tamaño: 28 pt, en `@1x/@2x/@3x`.

## Review Focus

1. **Rollo revelado privado o sin fotos para compartir:** el botón no aparece. Test en la Task 2.
2. **Rollo lleno antes del revelado:** no hay invitación que compartir, así que el botón no aparece. Test en la Task 2.
3. **WhatsApp sin instalar:** no aparece la opción, pero sí las demás. Test en la Task 2.
4. **WhatsApp con el collage, mientras se arma la imagen:** la fila muestra que está trabajando y no se puede tocar dos veces. Si falla, el error aparece inline en la sheet. Test en la Task 2.
5. **Nombre del rollo con caracteres raros (`&`, `"`, emoji) en el texto de WhatsApp:** el link queda bien codificado. Test en la Task 2 (`whatsAppUrl`).

---

### Task 1: Logos de Instagram y WhatsApp

**Files:**
- Create: `scripts/build-share-logos.mjs` y el script `"share-logos": "node scripts/build-share-logos.mjs"` en `package.json`.
- Install: `npm i -D simple-icons`.
- Create (generados, commiteados): `assets/share/instagram.png`, `instagram@2x.png`, `instagram@3x.png`, `whatsapp.png`, `whatsapp@2x.png`, `whatsapp@3x.png`.

- [ ] **Step 1:** Escribir el script. Toma los paths de `simple-icons` (`siInstagram`, `siWhatsapp`), arma un SVG por logo y lo rasteriza con Resvg a 28, 56 y 84 px, con fondo transparente.
  - Instagram: el path con un `linearGradient` de los colores de marca, en diagonal de abajo a la izquierda hacia arriba a la derecha.
  - WhatsApp: el path en `#25D366`.
- [ ] **Step 2:** Correr `npm run share-logos` y mirar los PNG generados. Tienen que verse los logos oficiales, nítidos y sin halo.
- [ ] **Step 3:** Commit `"Compartir: logos de Instagram y WhatsApp"`.

---

### Task 2: Sheet "Compartir" y botón en la barra

**Files:**
- Create: `src/features/share/share-options.ts` (pura)
- Create: `src/features/share/share-roll-screen.tsx`
- Create: `app/share-roll.tsx`
- Modify: `app/_layout.tsx` (sheet: `presentation: "formSheet"`, `sheetAllowedDetents: "fitToContents"`, título "Compartir", igual que `info/[topic]`)
- Modify: `src/test/routes.ts`
- Modify: `src/features/share/share-story.ts` (WhatsApp)
- Modify: `src/features/share/invite.ts` (`inviteMessage`)
- Modify: `src/features/roll/roll-essentials.tsx` (usa `inviteMessage`; saca la fila "Compartir en Stories")
- Modify: `src/features/roll/roll-overview.tsx` (saca la fila "Compartir en Stories")
- Modify: `src/features/roll/roll-screen.tsx` (botón en la barra)
- Modify: `app.json`
- Tests:
  - `src/features/share/__tests__/share-options.test.ts`
  - `__tests__/share-roll.test.tsx`
  - actualizar `src/features/roll/__tests__/share-entry.test.tsx`

**Interfaces:**
- Consumes: `canShareInvite`, `inviteLink` (`invite.ts`); `collageCandidates`, `pickCollage`, `collageCaption` (`collage.ts`); `renderCollageCard` (`render-collage.ts`); `composeStill` (`compose-still.ts`); `writeShareFile`, `shareMore` (`share-story.ts`); `useRevealedPhotos`; `useTripDetail`.
- Produces:
  - `export type ShareKind = "invite" | "collage";`
  - `export function shareKind(detail: TripDetail, photos: RevealedPhoto[]): ShareKind | null`, in `share-options.ts`:
    - not revealed → `"invite"` if `canShareInvite(detail)`, otherwise `null`;
    - revealed → `"collage"` if `!detail.trip.featuringDisabled && collageCandidates(photos).length > 0`, otherwise `null`.
  - `export type ShareOption = "link" | "whatsapp" | "instagram";`
  - `export function shareOptions(kind: ShareKind, whatsapp: boolean): ShareOption[]`:
    - invite → `["link", "whatsapp", "instagram"]`;
    - collage → `["whatsapp", "instagram"]`;
    - drops `"whatsapp"` when `!whatsapp`.
  - `export function inviteMessage(detail: TripDetail): string`, in `invite.ts`. It's the same text `RollInvite` uses today:
    - event → `` `Sumate a "${name}" en Rollo: ${joinLinkUrl(code)}` ``;
    - otherwise → `` `Sumate a "${name}" en Rollo con el código ${code}` ``.
    - **Ruling:** for a regular roll, append the link (`: ${joinLinkUrl(code)}`), so WhatsApp and "Copiar link" lead to the same place. Update `RollInvite` to use it.
  - `export const whatsAppUrl = (text: string): string => \`whatsapp://send?text=${encodeURIComponent(text)}\`` and `export async function whatsAppAvailable(): Promise<boolean>`, in `share-story.ts`. The second one is `Linking.canOpenURL("whatsapp://send")`, and returns `false` if it throws.
  - `export async function shareImageToWhatsApp(uri: string): Promise<void>`, in `share-story.ts`: `Share.shareSingle({ social: Share.Social.WHATSAPP, url: uri, type: "image/jpeg" })`. Check the exact option names in the installed `react-native-share` types.
  - `export function ShareRollScreen({ tripId }: { tripId: string })`:
    - a `Section` with one `Row` per option;
    - icon on the left: `link` SF Symbol, or `assets/share/whatsapp.png` / `instagram.png` at 28 pt;
    - "Copiar link" → `Clipboard.setStringAsync(inviteLink(detail))`, then the `Burnt.toast` HUD, then close the sheet;
    - "WhatsApp":
      - invite → `Linking.openURL(whatsAppUrl(inviteMessage(detail)))`;
      - collage → build `renderCollageCard({ name, caption, photos: pickCollage(candidates, 0), style: "dark" })`, then `composeStill(card, "dark")`, then `writeShareFile` (name `rollo-collage-dark-whatsapp-still.jpg`), then `shareImageToWhatsApp(uri)`;
      - while it works, the row shows an `ActivityIndicator` and is disabled;
      - an error shows inline with `ErrorText` "No se pudo compartir. Probá de nuevo.";
    - "Instagram" → close the sheet, then `router.push({ pathname: "/share-story", params: { tripId, kind } })`.
  - In `roll-screen.tsx`, the toolbar on the right gets a `Stack.Toolbar.Button` `icon="square.and.arrow.up"` with `accessibilityLabel="Compartir"`, before the gear. It shows only when `shareKind(detail, photos) !== null`, and opens `/share-roll?tripId=…`. Use the data the screen already has, or `useTripDetail` + `useRevealedPhotos`; that adds no extra requests, since both are already cached.
- [ ] **Step 1: Write the failing tests.**
  - `share-options.test.ts`:
    - `shareKind`: unrevealed and not full → `"invite"`; full → `null`; revealed with shareable photos → `"collage"`; private → `null`; no shareable photos → `null`.
    - `shareOptions`: the lists above, with and without WhatsApp.
    - `inviteMessage`: both forms.
    - `whatsAppUrl`: encodes `&`, `"` and emoji.
  - `share-roll.test.tsx`, with `renderRouter`:
    - invite shows the three options in order;
    - "Copiar link" copies the link and calls `Burnt.toast`;
    - "WhatsApp" opens `whatsAppUrl(...)`;
    - "Instagram" navigates to `/share-story` with `kind=invite`;
    - collage shows "WhatsApp" and "Instagram", and "WhatsApp" calls `shareImageToWhatsApp` with the still;
    - without WhatsApp, that option is missing;
    - a WhatsApp failure in the collage shows the inline error.
  - `share-entry.test.tsx`: the "Compartir en Stories" rows are gone. The "Compartir" toolbar button shows or hides with the same conditions as `shareKind` and opens `/share-roll`.
- [ ] **Step 2: Run them and confirm they fail.**
  Run: `npx jest src/features/share/__tests__/share-options.test.ts __tests__/share-roll.test.tsx src/features/roll/__tests__/share-entry.test.tsx --maxWorkers=2`
- [ ] **Step 3: Implement it.**
  - Mock `Linking.canOpenURL` / `openURL` in the screen test the way the existing tests do.
  - `burnt` must already be mocked in `jest.setup.ts`; if it isn't, mock it there.
- [ ] **Step 4: Run them, plus the related share tests and `npm run typecheck`.** Expected: PASS.
- [ ] **Step 5: Commit** `"Compartir: botón en la barra del rollo con Copiar link, WhatsApp e Instagram"`.

---

### Task 3: "Compartir en Instagram" con logo, y docs

**Files:**
- Modify: `src/features/share/share-story-screen.tsx`. The main button changes from "Compartir en Stories" to **"Compartir en Instagram"** and gets the Instagram logo at the left of the text.
  - If `Button` (`@/ui/components`) doesn't accept an icon, use the same pattern as `google-button.tsx`: a button with the logo and the text.
  - Don't add a boolean prop to `Button`: per CLAUDE.md, build an explicit variant or compose.
- Modify: `src/features/events/qr-screen.tsx`. The "Compartir en Stories" button becomes "Compartir en Instagram", with the logo, and still opens `/share-story`.
- Modify: `mobile/CLAUDE.md`, in the "Compartir en Stories" entry:
  - the toolbar button and the "Compartir" sheet with its options for each state;
  - the "Compartir en Instagram" name;
  - `assets/share/` and `npm run share-logos`;
  - `whatsapp` in `LSApplicationQueriesSchemes`.
- Tests: update the existing ones that look up "Compartir en Stories".
- [ ] **Step 1:** Update the tests so they look up "Compartir en Instagram", and add an assertion that the logo is rendered (`testID="instagram-logo"`). Run them and confirm they fail.
- [ ] **Step 2: Implement it.** Then run `npx jest __tests__/share-story.test.tsx src/features/share src/features/roll/__tests__/share-entry.test.tsx --maxWorkers=2` plus the QR screen tests (`--findRelatedTests src/features/events/qr-screen.tsx`). Expected: PASS.
- [ ] **Step 3: Commit** `"Compartir: Compartir en Instagram con logo y docs"`.
