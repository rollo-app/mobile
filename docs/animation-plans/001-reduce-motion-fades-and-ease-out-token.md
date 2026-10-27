# 001 — Que los fundidos de "Reducir movimiento" se vean de verdad (y una sola curva ease-out)

- **Status**: done
- **Commit**: d6da421
- **Severity**: HIGH
- **Category**: Accessibility (+ Cohesion & tokens)
- **Estimated scope**: 1 archivo nuevo (`src/ui/motion.ts`) + su test, 7 archivos editados con cambios de 1–4 líneas

## Problem

Reanimated 4 usa por defecto `reduceMotion: ReduceMotion.System`. Con "Reducir movimiento" prendido, eso hace que
`withTiming` **salte al valor final** y que `withDelay` **se saltee el delay**. El propio repo ya lo sabe
(`src/features/reveal/darkroom-intro.tsx:138-140`):

```ts
// Plain fades, but they must still play: Reanimated's default (ReduceMotion.System) would skip
// the delays and jump to the end, showing the title at frame 0.
const never = { reduceMotion: ReduceMotion.Never };
```

Pero otras pantallas que **ya eligen su propia variante reducida** (solo fundido, sin movimiento) no pasan
`ReduceMotion.Never`, así que con Reducir movimiento su fundido nunca se ve y, peor, los botones aparecen en el
cuadro 0 pero siguen sin responder hasta que vence el timer de JS:

```ts
// src/features/intro/intro-screen.tsx:39-43 — current
const fade = { duration: FADE_MS, easing: Easing.bezier(0.23, 1, 0.32, 1) };
first.set(withDelay(firstLineAt, withTiming(1, fade)));
second.set(withDelay(secondLineAt, withTiming(1, fade)));
button.set(withDelay(buttonAt, withTiming(1, fade)));
const timer = setTimeout(() => setButtonShown(true), buttonAt);
```
→ con RM, "Empezar" se ve al instante pero `pointerEvents="none"` durante 800 ms (botón visible y muerto).

```ts
// src/features/capture/roll-started.tsx:51-53 — current
const timing = { duration: 300, easing: Easing.bezier(0.23, 1, 0.32, 1) };
copy.value = withDelay(TEXT_AT, withTiming(1, timing));
actions.value = withDelay(TEXT_AT + ACTIONS_STAGGER, withTiming(1, timing));
```
→ con RM, "Arrancó el rollo." y los dos botones están en pantalla **antes** de que el candado se abra, y los botones no
responden hasta `TEXT_AT` (1500 ms).

```ts
// src/features/moments/moment-intro.tsx:38 — current
text.set(withDelay(textAt, withTiming(1, { duration: FADE_MS, easing: Easing.bezier(0.23, 1, 0.32, 1) })));
```
→ CLAUDE.md promete "con Reducir movimiento muestra el último cuadro con un fundido": hoy no hay fundido, aparece de golpe.

```ts
// src/features/roll/contact-sheet-view.tsx:73-75 — current
progress.set(
  withTiming(1, { duration: reduced ? 200 : 300, easing: Easing.bezier(0.23, 1, 0.32, 1) }),
);
```
→ la rama `reduced ? 200` es código muerto: con RM Reanimated salta a 1.

```ts
// src/features/capture/upload-status-section.tsx:47 — current
const fade = { entering: FadeIn.duration(200), exiting: FadeOut.duration(150), layout };
```
→ con RM la sección de subidas aparece/desaparece de golpe (el `layout` ya se apaga a propósito con RM; el fundido no debería).

Además, la curva `Easing.bezier(0.23, 1, 0.32, 1)` está tipeada a mano en 7 lugares (los 5 de arriba +
`src/features/reveal/darkroom-intro.tsx:135` y `src/features/capture/capture-preview.tsx:159`, más
`cubicBezier(0.23, 1, 0.32, 1)` en `capture-preview.tsx:35`). No hay token de motion en `src/ui/`.

## Target

1. Un módulo `src/ui/motion.ts` con la curva como dato y dos helpers **perezosos** (nunca llaman a Reanimated al
   importar: las suites de rutas mockean Reanimated como objeto vacío):

```ts
import { Easing, ReduceMotion, type WithTimingConfig } from "react-native-reanimated";

/** The app's strong ease-out (entrances and exits): starts fast, settles long. */
export const EASE_OUT_BEZIER = [0.23, 1, 0.32, 1] as const;

/** Built on call, never at module scope: route test suites mock Reanimated as an empty object. */
export function easeOut() {
  return Easing.bezier(...EASE_OUT_BEZIER);
}

/**
 * Timing for motion that already picked its own Reduce Motion variant (fade only, no movement). `ReduceMotion.Never`
 * so Reanimated doesn't also skip it: its default (System) jumps to the end and skips `withDelay`'s delay.
 */
export function ownedTiming(duration: number): WithTimingConfig {
  return { duration, easing: easeOut(), reduceMotion: ReduceMotion.Never };
}
```

2. En cada sitio con variante reducida propia: `withTiming(…, ownedTiming(ms))` y `withDelay(ms, …, ReduceMotion.Never)`.
3. Los layout animations de subidas con `.reduceMotion(ReduceMotion.Never)` en `FadeIn`/`FadeOut` (el `layout` sigue
   apagándose con RM como hoy).
4. Las otras apariciones de la curva usan `easeOut()` / `EASE_OUT_BEZIER` (sin cambio de comportamiento).

Valores: **no cambia ninguna duración ni curva**. Solo se agrega `ReduceMotion.Never` y se centraliza la curva.

## Repo conventions to follow

- Primitivas visuales compartidas viven en `src/ui/` (sin datos ni API). Código, comentarios y tests en inglés.
- Ejemplo correcto ya existente: `src/features/reveal/darkroom-intro.tsx:138-153` (pasa `ReduceMotion.Never` al
  `withTiming` **y** como tercer argumento de `withDelay`/`withSequence`).
- Nunca construir `Easing.bezier(...)` / `cubicBezier(...)` a nivel de módulo (ver comentario en
  `src/features/capture/upload-status-section.tsx:14` y `capture-preview.tsx:28-30`).
- Funciones usadas dentro de `useAnimatedStyle` deben llevar `'worklet'` (acá no se agrega ninguna).
- El mock de tests `src/test/reanimated.ts` ya expone `ReduceMotion`, `Easing.bezier` y los builders con `.reduceMotion()`.
  `withDelay` del mock ignora el tercer argumento: no hace falta tocar el mock.

## Steps

1. **Test primero.** Crear `src/ui/__tests__/motion.test.ts`:

   ```ts
   jest.mock("react-native-reanimated", () => ({
     Easing: { bezier: jest.fn(() => "ease-out-curve") },
     ReduceMotion: { System: "system", Always: "always", Never: "never" },
   }));

   import { Easing } from "react-native-reanimated";
   import { EASE_OUT_BEZIER, easeOut, ownedTiming } from "../motion";

   describe("motion tokens", () => {
     it("builds the app's strong ease-out", () => {
       expect(easeOut()).toBe("ease-out-curve");
       expect(Easing.bezier).toHaveBeenCalledWith(0.23, 1, 0.32, 1);
       expect(EASE_OUT_BEZIER).toEqual([0.23, 1, 0.32, 1]);
     });

     it("keeps the duration and never lets Reanimated skip a timing that already chose its reduced variant", () => {
       expect(ownedTiming(300)).toEqual({ duration: 300, easing: "ease-out-curve", reduceMotion: "never" });
     });
   });
   ```
   Correr `npx jest src/ui/__tests__/motion.test.ts` y verlo fallar (no existe el módulo).

2. Crear `src/ui/motion.ts` con el contenido exacto de **Target §1**. Correr el test: verde.

3. `src/features/intro/intro-screen.tsx`:
   - import: `import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";`
     (sacar `Easing` si queda sin uso) y `import { ownedTiming } from "@/ui/motion";`.
   - Líneas 39-42 pasan a:
     ```ts
     const fade = ownedTiming(FADE_MS);
     first.set(withDelay(firstLineAt, withTiming(1, fade), ReduceMotion.Never));
     second.set(withDelay(secondLineAt, withTiming(1, fade), ReduceMotion.Never));
     button.set(withDelay(buttonAt, withTiming(1, fade), ReduceMotion.Never));
     ```

4. `src/features/moments/moment-intro.tsx` línea 38:
   ```ts
   text.set(withDelay(textAt, withTiming(1, ownedTiming(FADE_MS)), ReduceMotion.Never));
   ```
   Ajustar imports igual que en el paso 3.

5. `src/features/capture/roll-started.tsx` líneas 51-53 (mantener el estilo `.value =` del archivo):
   ```ts
   const timing = ownedTiming(300);
   copy.value = withDelay(TEXT_AT, withTiming(1, timing), ReduceMotion.Never);
   actions.value = withDelay(TEXT_AT + ACTIONS_STAGGER, withTiming(1, timing), ReduceMotion.Never);
   ```
   Ajustar imports.

6. `src/features/roll/contact-sheet-view.tsx` líneas 73-75:
   ```ts
   progress.set(withTiming(1, ownedTiming(reduced ? 200 : 300)));
   ```
   Ajustar imports (sacar `Easing`).

7. `src/features/capture/upload-status-section.tsx`:
   - línea 3: `import Animated, { FadeIn, FadeOut, LinearTransition, ReduceMotion } from "react-native-reanimated";`
     y `import { easeOut } from "@/ui/motion";`
   - línea 15: `const makeLayout = () => LinearTransition.duration(250).easing(easeOut());`
   - línea 47:
     ```ts
     const fade = {
       entering: FadeIn.duration(200).reduceMotion(ReduceMotion.Never),
       exiting: FadeOut.duration(150).reduceMotion(ReduceMotion.Never),
       layout,
     };
     ```
   - Actualizar el comentario de la línea 17 a: "Position transition for a block next to the upload sections; with Reduce Motion (or still unknown) it just jumps. The fades always play."

8. Solo curva, sin cambio de comportamiento:
   - `src/features/reveal/darkroom-intro.tsx:135`: `const enter = easeOut();` (+ import de `@/ui/motion`).
   - `src/features/capture/capture-preview.tsx:159`: `easing: easeOut(),` en lugar de `Easing.bezier(0.23, 1, 0.32, 1)`.
   - `src/features/capture/capture-preview.tsx:35`: `transitionTimingFunction: cubicBezier(...EASE_OUT_BEZIER),`.
   - Sacar `Easing` de los imports donde quede sin uso.

## Boundaries

- NO cambiar duraciones, delays, curvas ni qué se mueve con/sin RM. Solo `ReduceMotion.Never` + el token.
- NO tocar `src/features/reveal/darkroom-intro.tsx` más allá del paso 8 (ya está bien resuelto).
- NO tocar los archivos del "worst case" del perfil que está haciendo otro worker (`worst-case-*`).
- NO agregar dependencias. NO cambiar `src/test/reanimated.ts`.
- Si alguna línea citada no coincide con lo que encontrás (drift desde `d6da421`), PARÁ y reportá.

## Verification

- **Mecánica**: `npm run typecheck` sin errores; `npx jest src/ui __tests__/intro.test.tsx __tests__/roll-started.test.tsx __tests__/moment.test.tsx __tests__/upload-status.test.tsx __tests__/screens.test.tsx` en verde; después `npm test` completo en verde.
  `grep -rn "bezier(0.23" src` solo devuelve `src/ui/motion.ts` (y su test).
- **Feel check (iPhone, dev build)**: Ajustes del iPhone → Accesibilidad → Movimiento → **Reducir movimiento: ON**.
  - Ajustes de Rollo → Desarrollo → **"Ver intro"**: el logo queda quieto, "Sacá la foto." y "Mirala después." **aparecen con un fundido**
    (no de golpe) a 0 y 200 ms, y "Empezar" aparece con fundido a los ~800 ms y responde apenas se ve.
  - **"Ver candado"**: el texto y los botones **no** están en pantalla al abrir; aparecen con fundido después del cambio a cámara
    (~1,5 s), sin moverse en Y; tocar "Ahora no" funciona apenas se ve.
  - **"Probar momento ahora"** y tocar el aviso: el último cuadro con "Tu momento" entra con un fundido de ~400 ms.
  - Sacar una foto con RM y volver a la tab Rollo: el cuadro nuevo de la hoja de contacto aparece con fundido de 200 ms, sin escalar.
  - Con cola pendiente (modo avión), la sección "N fotos esperando señal" aparece/desaparece con fundido; lo de abajo salta (sin deslizar).
  - **Reducir movimiento: OFF** y repetir: todo igual que antes de este cambio (los textos suben 8 pt y se funden).
- **Done when**: con RM prendido ningún texto o botón de esas pantallas aparece en el cuadro 0, y ningún botón es visible antes de responder.
