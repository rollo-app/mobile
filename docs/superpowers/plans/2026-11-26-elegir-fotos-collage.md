# Elegir las fotos del collage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let the user pick which shareable photos go in the collage (up to 8, numbered, number 1 is the big one) from the "Compartir" screen. The same selection feeds Instagram and WhatsApp.

**Architecture:**
- An in-memory selection store, one per trip.
- A pure helper that turns the selection plus the candidates into the collage's photo list.
- A new `/share-pick` modal with a FlashList grid.
- The "Compartir" screen and the WhatsApp action read the store.

**Tech Stack:** Expo Router modal, `@shopify/flash-list` v2, `expo-image` + `mediaSource`/`useMediaToken` (`src/features/media/revealed.ts`), `expo-haptics`, `useSyncExternalStore`.

**Spec:** `mobile/docs/superpowers/specs/2026-11-26-elegir-fotos-collage-design.md`

## Global Constraints

- Branch `feature/compartir-en-stories`, `mobile/` only.
- Code in English. Rioplatense UI copy. Commits in Spanish ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run only the related tests, with `--maxWorkers=2`. `npm run typecheck` must be clean.
- Exact UI copy:
  - button "Elegir fotos" (replaces "Otras");
  - modal title "Elegir fotos";
  - counter "N de 8";
  - bar buttons "Cancelar" / "Listo";
  - cell accessibility label: `` `Foto ${i + 1} de ${total}` ``, plus `, elegida ${n}` when it's selected.
- Max `COLLAGE_MAX` (8).
- The selection badge is a cobalt circle (`colors.tint`) with the number in `colors.onTint`, top-right of the cell. Selection is one of the places cobalt is allowed.
- The selection is not persisted: not in the Query cache, not in SecureStore.

## Review Focus

1. **Selection order.** Deselecting #2 of 4 renumbers 3→2 and 4→3. The collage uses the new order. Test in Task 1.
2. **A selected photo stops being shareable.** It's skipped. If none are left, the collage goes back to random. Test in Task 1.
3. **A 9th tap.** It's ignored and fires a light haptic. Test in Task 2.
4. **Cancelar.** It discards the changes made in the modal. Test in Task 2.
5. **A roll with hundreds of photos.** The grid uses FlashList, with `memo` cells and a stable `renderItem`. Reviewed in Task 2.

---

### Task 1: Store, selection logic and screen wiring

**Files:**
- Create: `src/features/share/collage-selection.ts` (pure logic + store)
- Modify: `src/features/share/share-story-screen.tsx`, `src/features/share/share-roll-screen.tsx`
- Test: `src/features/share/__tests__/collage-selection.test.ts`, `__tests__/share-story.test.tsx`, `__tests__/share-roll.test.tsx`

**Interfaces (produces):**
- `export function toggleSelection(selection: readonly string[], id: string, max = COLLAGE_MAX): { selection: string[]; full: boolean }`. An id that's already selected is removed, which renumbers the rest. A new id is appended when there's room. When the list is already at `max`, it returns the selection unchanged with `full: true`.
- `export function collagePhotos(candidates: RevealedPhoto[], selection: readonly string[], seed: number): RevealedPhoto[]`. It returns the selected candidates in selection order, skipping ids that aren't candidates. If that leaves nothing, it falls back to `pickCollage(candidates, seed)`.
- Store:
  - `export function useCollageSelection(tripId: string): readonly string[]`, with `useSyncExternalStore`;
  - `export function setCollageSelection(tripId: string, ids: readonly string[]): void`;
  - `export function getCollageSelection(tripId: string): readonly string[]`.
  - A module-level `Map` plus listeners.
- In `share-story-screen.tsx`:
  - the collage build uses `collagePhotos(candidates, selection, seed)`;
  - the selection is part of the image query key, so a new selection rebuilds the image;
  - "Otras" is replaced by a "Elegir fotos" button with the same styling, which pushes `{ pathname: "/share-pick", params: { tripId } }`;
  - remove `nextSeed`/`canShuffle` usage if nothing else needs it, and keep `seed` fixed.
- In `share-roll-screen.tsx`, the WhatsApp collage uses `collagePhotos(candidates, getCollageSelection(tripId), 0)`.

- [ ] Step 1: Write the failing tests.
  - `toggleSelection`: add, remove with renumbering, and `full` at 8.
  - `collagePhotos`: keeps the order, skips non-candidates, and falls back to random when the selection is empty or all of it is invalid.
  - Store: set/get, and the hook updates.
  - Screen: "Elegir fotos" pushes `/share-pick`. With a selection set, `renderCollageCard` receives those photos in order. WhatsApp sends the selected photos.
- [ ] Step 2: Run them. They fail.
- [ ] Step 3: Implement.
- [ ] Step 4: Run `npx jest src/features/share __tests__/share-story.test.tsx __tests__/share-roll.test.tsx --maxWorkers=2` and `npm run typecheck`. Both pass.
- [ ] Step 5: Commit "Compartir: selección de fotos del collage".

---

### Task 2: Pantalla "Elegir fotos"

**Files:**
- Create: `src/features/share/share-pick-screen.tsx`, `src/features/share/pick-cell.tsx`, `app/share-pick.tsx`
- Modify: `app/_layout.tsx` (`presentation: "modal"`, title "Elegir fotos"), `src/test/routes.ts`
- Test: `__tests__/share-pick.test.tsx`

**Interfaces:**
- Consumes: `toggleSelection`, `getCollageSelection`, `setCollageSelection` (Task 1); `collageCandidates`, `COLLAGE_MAX`; `useRevealedPhotos`, `mediaSource`, `useMediaToken`.
- Produces: `export function SharePickScreen({ tripId }: { tripId: string })`.
- Behavior:
  - The draft selection starts as a copy of `getCollageSelection(tripId)` and lives in local state.
  - The grid:
    - 3 columns of square cells, 2 pt gap, built with FlashList v2.
    - It shows the candidates in feed order.
    - Each cell is `pick-cell.tsx`: `memo`, `expo-image` with `recyclingKey`, a badge with the number when selected, and a dimmed overlay when the draft is full and the cell isn't selected.
  - Tapping a cell calls `toggleSelection`. When the result is `full`, fire `Haptics.impactAsync(Light)` and change nothing.
  - The counter "N de 8" sits in the header area under the title, or as the subtitle.
  - "Listo" calls `setCollageSelection(tripId, draft)` and goes back. "Cancelar" goes back without saving.
  - Toolbar pattern: the same as `src/features/trips/join-screen.tsx` (`Stack.Toolbar` left/right).
- [ ] Step 1: Write the failing tests:
  - tapping numbers the cells 1..n;
  - deselecting renumbers;
  - a 9th tap is ignored and fires a haptic;
  - "Listo" saves the draft;
  - "Cancelar" doesn't save;
  - the counter text is right.
- [ ] Step 2: Run them. They fail.
- [ ] Step 3: Implement.
- [ ] Step 4: Run `npx jest __tests__/share-pick.test.tsx src/features/share --maxWorkers=2` and `npm run typecheck`. Both pass.
- [ ] Step 5: Commit "Compartir: pantalla Elegir fotos con numeración".
