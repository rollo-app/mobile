# Concurso de fotos — pulido (iteración 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revelado de la ganadora con efecto de cuarto oscuro + confeti, votación una por una, resultados en ranking con votos y finalistas sin tope.

**Architecture:** Backend: dos cambios chicos en `src/modules/contest/` (sin tope, `username` del autor). App: el efecto de revelado y el obturador pasan a un módulo compartido `src/features/darkroom/` (hoy viven en `reveal/`); `src/features/contest/` suma un visor paginado (votar y ver resultados), una lista de ranking y la pantalla del revelado de la ganadora.

**Tech Stack:** Workers + Hono + D1 + vitest (backend); Expo SDK 58, Reanimated 4, Skia (shader existente), react-native-pulsar + expo-haptics, expo-audio (obturador existente), FlashList v2, jest (app). Sin paquetes nativos nuevos.

**Spec:** `docs/superpowers/specs/2026-11-24-concurso-de-fotos-design.md`, sección **"Iteración 2: pulido"** (y lo anterior como contexto).

## Global Constraints

- Ramas `feature/concurso-fotos` en `/Users/juanifraga/Desktop/Rollo/backend-concurso` y `/Users/juanifraga/Desktop/Rollo/mobile-concurso` (worktrees). Sin push.
- TDD; tests solo de lo tocado con `--maxWorkers=2`; salida de tests limpia (QueryClient de tests con `gcTime: 0` y `clear()` en `afterEach`).
- Código en inglés; textos de UI en rioplatense con voseo; commits en español con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Textos exactos: "Ganó la foto de @{username}" · "¡Ganó tu foto!" · "{n} votos" / "1 voto" · "Ganadora" · "Ver resultados" · "Finalista {i} de {n}" · "{p}° puesto" · "Votar esta" · "Tu voto ✓" · "Cierra en …" (helper `countdownLabel` existente) · "{n} elegidas" / "1 elegida" · "te sugerimos hasta 15" · "Elegir ganadora".
- Colores del confeti: solo `tintHex` cobalto (claro `#3155F5`, oscuro `#5C7CFF`) y blanco. Nada multicolor.
- Reglas de la app (mobile CLAUDE.md): `app/` solo rutea; features no tocan internals de otras (lo compartido se sube a un módulo propio); animaciones solo `transform`/`opacity` en UI thread; `useReducedMotion`; listas largas con FlashList; `dateFormatter`; `!!x &&`.
- Clave nueva de SecureStore (no se renombra después): `rollo.contestWinnerSeen.<tripId>`.

## Review Focus

1. **Ganadora sin `username`** (cuenta vieja sin @, o ganadora con cuenta borrada → `winner` null): el revelado no se abre si `winner` es null; sin username dice "Ganó la foto de {name}". Test en Task 6.
2. **Ganadora oculta para quien mira** (`imageAvailable: false`: la bloqueó o la denunció): el revelado no muestra la foto; muestra solo el texto con el avatar. Test en Task 6.
3. **Muchas finalistas (40+)** en el visor una por una: los segmentos de progreso se vuelven una barra continua con "Finalista 12 de 40" en vez de 40 segmentitos. Test en Task 4.
4. **Empate en el ranking**: puestos compartidos ("1°", "1°", "3°") y "Elegir ganadora" solo para organizadores en las empatadas. Test en Task 5.
5. **Reducir movimiento** en el revelado de la ganadora: sin shader ni confeti, fundido y un háptico de éxito. Test en Task 6.

---

## Backend (`/Users/juanifraga/Desktop/Rollo/backend-concurso`)

### Task 1: Sin tope de finalistas y `username` del autor

**Files:**
- Modify: `src/modules/contest/contest.repository.ts` (`MAX_FINALISTS`, insert de finalistas, selects de finalistas y ganadora), `contest.service.ts` (mensaje "Ya hay 10 finalistas."), `contest.schemas.ts` (`AuthorSchema`), `openapi.json`, backend `CLAUDE.md` (sección Concurso)
- Test: `test/contest-finalists.test.ts`

**Interfaces:**
- Produces: `AuthorSchema` = `{ userId, name, username: string | null, avatarUrl }` en `finalists[].author` y `winner.author`. Ya no existe `MAX_FINALISTS` ni el 409 "Ya hay 10 finalistas.".

- [ ] **Step 1: Tests:** `allows more than 10 finalists` (marcar 12 → 12 en `GET /contest`); `finalist and winner authors carry username` (`author.username === "cami"` en finalistas; en `closed`, `winner.author.username`); `username is null for an account without one`. Borrar/ajustar el test del 409 de 10.
- [ ] **Step 2:** FAIL. **Step 3:** sacar el tope (el insert queda `INSERT OR IGNORE` con `position = 1 + MAX`), sumar `u.username` a los selects. **Step 4:** PASS + `test/contest-*.test.ts` + `npm run openapi` + typecheck.
- [ ] **Step 5: Commit** `Concurso: sin tope de finalistas y con @usuario del autor`.

---

## App (`/Users/juanifraga/Desktop/Rollo/mobile-concurso`)

### Task 2: Regenerar cliente y selección sin tope

**Files:**
- Modify: `src/api/schema.d.ts` (`API_SPEC=../backend-concurso/openapi.json npm run api:generate`), `src/features/contest/contest-state.ts` (`MAX_FINALISTS`, `pickCountLabel`), `picks-screen.tsx`, `picks-row.tsx`
- Test: `src/features/contest/__tests__/contest-state.test.ts`, `contest-picks.test.tsx`

**Interfaces:**
- Produces: `SUGGESTED_FINALISTS = 15`; `pickCountLabel(n: number): string` → `"1 elegida"`, `"4 elegidas"`; `pickHint(n: number): string | null` → `"te sugerimos hasta 15"` si `n > 15`, si no `null`.

- [ ] **Step 1: Tests:** labels de 0/1/4/16; hint null en 15 y texto en 16; la pantalla deja marcar la 11.ª (sin error) y muestra el aviso pasada la 15; la fila del tablero dice "Elegí las finalistas · 4 elegidas".
- [ ] **Step 2–4:** FAIL → implementar → PASS + typecheck. **Step 5: Commit** `Concurso: elegir todas las finalistas, con sugerencia de 15`.

### Task 3: Módulo compartido `darkroom` (efecto de revelado y obturador)

**Files:**
- Create: `src/features/darkroom/` ← mover `darkroom-shaders.ts`, `shutter-sound.ts`, `shutter-wav.ts` desde `src/features/reveal/` (con sus tests si los tienen); crear `src/features/darkroom/develop-image.tsx`
- Modify: `src/features/reveal/darkroom-intro.tsx` (usa `DevelopImage` y los imports nuevos), `reveal-screen.tsx`
- Test: `src/features/darkroom/__tests__/develop-image.test.tsx`; los tests existentes de `reveal` siguen pasando

**Interfaces:**
- Produces: `DevelopImage({ thumbBytes, uri, progress, size, style }: { thumbBytes: ArrayBuffer | null; uri: string | null; progress: SharedValue<number>; size: { width: number; height: number }; style?: ViewStyle })` — dibuja con Skia el `DEVELOP_SKSL` del revelado: con `progress` 0 la imagen es el ThumbHash en sepia/difuso, con 1 la foto nítida (el mismo look de una celda del revelado del rollo). Si el shader no compila o falta el image, cae a `expo-image` sin efecto. `prepareShutter() / playShutter() / releaseShutter()` iguales que hoy, desde `@/features/darkroom/shutter-sound`.
- Refactor sin cambio de comportamiento en el revelado del rollo: la celda de `darkroom-intro.tsx` pasa a ser `DevelopImage`.

- [ ] **Step 1: Test** de `DevelopImage`: con Skia mockeado como en los tests de reveal, renderiza el canvas cuando hay bytes y cae a la imagen plana sin bytes.
- [ ] **Step 2–4:** FAIL → mover/extraer → PASS: `npx jest src/features/darkroom src/features/reveal --maxWorkers=2` + typecheck. **Step 5: Commit** `Revelado: el efecto y el obturador pasan a un módulo compartido`.

### Task 4: Votar una por una (visor paginado)

**Files:**
- Create: `src/features/contest/finalist-pager.tsx`, `src/features/contest/pager-progress.tsx`
- Modify: `contest-screen.tsx` (en `voting`/`closing` muestra el visor en vez de la grilla), `contest-card.tsx` (tocar abre `/contest`), `contest-state.ts`
- Test: `src/features/contest/__tests__/finalist-pager.test.tsx`, `contest-state.test.ts`

**Interfaces:**
- Produces: `FinalistPager({ finalists, initialIndex, token, mode, myVote, myUserId, onVote, votingOpen, onIndexChange })` con `mode: "vote" | "results"`; paginado horizontal (FlashList `horizontal` + `pagingEnabled`, o `ScrollView` paginado si ≤ 50 — decidir por rendimiento y anotarlo), cada página a pantalla completa con `expo-image` (`displayPath`, placeholder ThumbHash, `contentFit="cover"`), abajo avatar + `@username` (o el nombre si no tiene), y:
  - `mode="vote"`: "Cierra en …", botón grande "Votar esta" / "Tu voto ✓" (deshabilitado con hint "No podés votar tu propia foto" en las propias, y cuando `votingOpen` es false: en `closing` dice "Cerrando la votación…").
  - `mode="results"`: "{p}° puesto" arriba y "{n} votos" grande abajo (Task 5 lo usa).
- `PagerProgress({ count, index })`: hasta 20 → segmentos; más de 20 → barra continua; y el título "Finalista {i} de {n}".
- `progressStyle(count: number): "segments" | "bar"` en `contest-state.ts`.

- [ ] **Step 1: Tests:** muestra "Finalista 1 de 3" y avanza al deslizar (simular `onMomentumScrollEnd`/`onViewableItemsChanged`); votar llama a `onVote(mediaId)` y la página muestra "Tu voto ✓"; la propia está deshabilitada; `progressStyle(20) === "segments"`, `progressStyle(21) === "bar"`; muestra `@cami` y cae al nombre sin username.
- [ ] **Step 2–4:** FAIL → implementar → PASS + typecheck. **Step 5: Commit** `Concurso: votar una por una`.

### Task 5: Resultados en ranking y empate

**Files:**
- Create: `src/features/contest/results-list.tsx`, `src/features/contest/ranking.ts`
- Modify: `contest-screen.tsx` (en `closed` y `tied`), `contest-card.tsx` (ganadora con `@username` y avatar)
- Test: `src/features/contest/__tests__/ranking.test.ts`, `results-list.test.tsx`

**Interfaces:**
- Consumes: `FinalistPager` (`mode="results"`) de Task 4.
- Produces: `rankFinalists(finalists): { finalist, place: number, share: number }[]` ordenado por votos desc (empates comparten puesto: 9, 9, 6 → 1, 1, 3; desempate estable por `mediaId`), `share` = votos / máximo (0 si el máximo es 0).
- `ResultsList`: encabezado con la ganadora grande (sello "Ganadora", avatar, `@username`, "{n} votos"), abajo filas: puesto, miniatura, `@username`, barra cobalto proporcional a `share`, "N votos" con `tabular-nums`. Tocar una fila abre el `FinalistPager` en `mode="results"` en orden de puesto. En `tied` (organizador): las empatadas llevan "Elegir ganadora" (con el `Alert` de confirmación que ya existe); el invitado ve la nota de empate existente.

- [ ] **Step 1: Tests:** `rankFinalists` con 9/9/6/0 → puestos 1/1/3/4 y shares 1/1/.67/0; todos en 0 → todos puesto 1 y share 0; la lista muestra "9 votos" y "1 voto"; en `tied` el organizador ve "Elegir ganadora" solo en las empatadas y el invitado no.
- [ ] **Step 2–4:** FAIL → implementar → PASS + typecheck. **Step 5: Commit** `Concurso: resultados ordenados por votos`.

### Task 6: Revelado de la ganadora

**Files:**
- Create: `src/features/contest/winner-reveal-screen.tsx`, `src/features/contest/confetti.tsx`, `src/features/contest/winner-timeline.ts`, `src/features/contest/use-winner-reveal.ts`, `src/storage/contest-winner-seen.ts`, `app/contest-winner.tsx` (+ `app/_layout.tsx` como `fullScreenModal`, `src/test/routes.ts`)
- Modify: `contest-screen.tsx` y `contest-card.tsx` (disparan el revelado la primera vez)
- Test: `src/features/contest/__tests__/winner-reveal.test.tsx`, `winner-timeline.test.ts`

**Interfaces:**
- Consumes: `DevelopImage`, `prepareShutter/playShutter/releaseShutter` (Task 3); `useContest` existente.
- Produces:
  - `WINNER_TIMELINE = { developMs: 2400, flashMs: 350, textDelayMs: 2700, confettiDelayMs: 2900 }` (ajustable, en un solo lugar).
  - `useWinnerReveal(tripId, contest)`: si `contest.status === "closed"`, `contest.winner` no es null y no está la clave `rollo.contestWinnerSeen.<tripId>`, hace `router.push("/contest-winner?trip=<id>")` una sola vez y guarda la clave.
  - Pantalla: fondo rojo de cuarto oscuro → `DevelopImage` con `progress` 0→1 en `developMs` + háptico continuo que crece (pulsar, como el revelado) → flash blanco + `Haptics.notificationAsync(Success)` + `playShutter()` → texto "Ganó la foto de @{username}" con el avatar (círculo 28 pt) y "{n} votos" (para el autor: "¡Ganó tu foto!") → `Confetti` (≈40 piezas, cobalto `tintHex[scheme]` y blanco, caen 2,4 s, Reanimated en UI thread) → botón "Ver resultados" (`router.replace("/contest?trip=…")`). Tocar en cualquier momento salta al estado final. `useReducedMotion()`: sin shader ni confeti, fundido de 300 ms y un solo háptico de éxito. Con `imageAvailable: false`: sin foto, solo texto + avatar.

- [ ] **Step 1: Tests:** abre una sola vez (segundo montaje no navega); no abre si `winner` es null o el estado no es `closed`; muestra "Ganó la foto de @cami" y "12 votos"; autor ve "¡Ganó tu foto!"; sin username usa el nombre; reducir movimiento no monta `Confetti` ni el shader; `imageAvailable: false` no monta la foto; "Ver resultados" reemplaza la ruta.
- [ ] **Step 2–4:** FAIL → implementar → PASS + `npx jest src/features/contest src/features/darkroom --maxWorkers=2` + typecheck. **Step 5: Commit** `Concurso: revelado de la ganadora con confeti`. Actualizar la nota del concurso en mobile `CLAUDE.md` (revelado, una por una, ranking, sin tope, clave `rollo.contestWinnerSeen.<tripId>`).

## Orden

Task 1 → Task 2 (necesita el contrato) → 3 → 4 → 5 → 6. Prueba final en el iPhone con el casamiento de prueba (el backend local ya corre).
