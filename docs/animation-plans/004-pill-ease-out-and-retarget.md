# 004 — Pastilla "Destacada en tu perfil": entrada ease-out y sin parpadeo al repetirse

- **Status**: done
- **Commit**: d6da421
- **Severity**: LOW
- **Category**: Easing & duration (+ Interruptibility)
- **Estimated scope**: 1 archivo (`src/ui/pill-host.tsx`) + 1 test, ~6 líneas

## Problem

```ts
// src/ui/pill-host.tsx:32-44 — current
useEffect(() => {
  if (id === undefined) return;
  progress.setValue(0);
  Animated.timing(progress, { toValue: 1, duration: IN_MS, useNativeDriver: true }).start();
  const hide = setTimeout(() => {
    Animated.timing(progress, { toValue: 0, duration: OUT_MS, useNativeDriver: true }).start();
  }, IN_MS + VISIBLE_MS);
  // …
}, [id, progress]);
```

1. Sin `easing`, RN Animated usa `Easing.inOut(Easing.ease)`: la entrada (150 ms) arranca lenta justo cuando la mirás.
   Entradas y salidas van con ease-out fuerte.
2. `progress.setValue(0)` en cada pastilla: si destacás dos fotos seguidas (grilla, mantener apretado → "Agregar a tu
   perfil" dos veces), la pastilla visible **se apaga de golpe y vuelve a entrar** (parpadeo). Debe retomar desde donde
   está (sigue visible y se reinicia su tiempo en pantalla).

## Target

```ts
// src/ui/pill-host.tsx — target (RN Animated; RN's Easing is safe at module scope, it isn't Reanimated)
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

useEffect(() => {
  if (id === undefined) return;
  // No reset to 0: a pill that arrives while one is showing continues from where it is (no flash).
  Animated.timing(progress, { toValue: 1, duration: IN_MS, easing: EASE_OUT, useNativeDriver: true }).start();
  const hide = setTimeout(() => {
    Animated.timing(progress, { toValue: 0, duration: OUT_MS, easing: EASE_OUT, useNativeDriver: true }).start();
  }, IN_MS + VISIBLE_MS);
  // … (remove timer y cleanup sin cambios)
}, [id, progress]);
```

Duraciones sin cambio: `IN_MS = 150`, `VISIBLE_MS = 1500`, `OUT_MS = 200`. Escala de entrada sin cambio (`0.94 → 1`,
sin escala con Reducir movimiento).

## Repo conventions to follow

- `EASE_OUT_BEZIER = [0.23, 1, 0.32, 1]` es la curva de la app (si el plan 001 ya está hecho, vive en `src/ui/motion.ts`;
  acá se usa el `Easing` **de react-native**, no el de Reanimated, así que se escribe
  `Easing.bezier(...EASE_OUT_BEZIER)` importando solo la constante, o los cuatro números si 001 no está hecho).
- Tests en `src/ui/__tests__/pill-host.test.tsx` (fake timers, `AccessibilityInfo` espiado).

## Steps

1. **Test primero**: en `src/ui/__tests__/pill-host.test.tsx` agregar (importar `Animated` de `react-native`):
   ```ts
   it("never resets the pill to invisible when another one arrives (it continues from where it is)", async () => {
     const setValue = jest.spyOn(Animated.Value.prototype, "setValue");
     await render(<PillHost />);
     await act(async () => {
       showPill("Destacada en tu perfil");
     });
     await act(async () => {
       jest.advanceTimersByTime(500);
       showPill("Destacada en tu perfil");
     });
     expect(setValue).not.toHaveBeenCalledWith(0);
     expect(screen.getByText("Destacada en tu perfil", { includeHiddenElements: true })).toBeTruthy();
   });
   ```
   Verlo fallar (hoy se llama `setValue(0)`).
2. Aplicar **Target**: borrar `progress.setValue(0);`, agregar `Easing` al import de `react-native`, la constante
   `EASE_OUT` a nivel de módulo y `easing: EASE_OUT` en los dos `Animated.timing`. Test: verde, y el test existente
   "shows the text, announces it and hides it after the timers" sigue verde.

## Boundaries

- NO cambiar duraciones, posición, estilo ni el `FullWindowOverlay`. NO migrar a Reanimated.
- NO tocar `src/ui/pill.ts` ni dónde se llama `showPill`.
- Si el código no coincide (drift desde `d6da421`), PARÁ y reportá.

## Verification

- **Mecánica**: `npm run typecheck`; `npx jest src/ui` en verde; `npm test`.
- **Feel check (iPhone)**: rollo revelado (Bariloche del seed) → Galería → mantener apretada una foto → "Agregar a tu perfil":
  la pastilla aparece rápido y se asienta (no "arranca lenta"). Agregar otra enseguida (antes de que se vaya): la
  pastilla **no parpadea**, sigue y se queda 1,5 s más. Abrir el visor (modal) y destacar desde ahí: aparece encima.
- **Done when**: no hay `setValue(0)` en `pill-host.tsx` y los dos `Animated.timing` llevan la curva.
