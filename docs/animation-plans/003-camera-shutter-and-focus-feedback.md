# 003 — Cámara: que el disparo y el enfoque se sientan como en iOS

- **Status**: TODO
- **Commit**: d6da421
- **Severity**: MEDIUM
- **Category**: Missed opportunities (+ Physicality)
- **Depends on**: 001 (usa `easeOut()` / `EASE_OUT_BEZIER` de `src/ui/motion.ts`)
- **Estimated scope**: 1 archivo (`src/features/camera/camera.tsx`) + mock de tests + 1 test, ~50 líneas

## Problem

La cámara propia (`src/features/camera/camera.tsx`, la usan la captura y el momento) quiere ser "como iOS", y es la
acción central de la app ("la sacada es la que es": no hay Repetir). Pero el instante del disparo casi no tiene feedback:

```tsx
// src/features/camera/camera.tsx:468-476 — current
<Pressable
  accessibilityRole="button"
  accessibilityLabel={countdown !== null ? "Cancelar temporizador" : "Sacar foto"}
  disabled={busy}
  onPress={onShutter}
  style={({ pressed }) => [styles.shutter, { opacity: busy ? 0.5 : pressed ? 0.8 : 1 }]}
>
  <View style={countdown !== null ? styles.shutterStop : styles.shutterInner} />
</Pressable>
```

Con `qualityPrioritization: "quality"` (Smart HDR / Deep Fusion) entre el toque y la pantalla del caption pasan
cientos de ms en los que solo cambia la opacidad del aro. En iOS: el disco interior se achica al apretar y la vista
**parpadea en negro** en el instante de la captura, que es lo que te dice "ya está, esta es la foto". Lo mismo con
el temporizador: a los 0 s dispara sin ninguna señal visual.

El cuadrado de enfoque aparece y se atenúa de golpe:

```tsx
// src/features/camera/camera.tsx:357-361 — current
{focus && (
  <View
    testID="focus-square"
    pointerEvents="none"
    style={[styles.focus, { left: focus.x - FOCUS_SIZE / 2, top: focus.y - FOCUS_SIZE / 2, opacity: dim ? 0.5 : 1 }]}
  >
```

En iOS el cuadrado entra un poco más grande y se asienta a su tamaño, y se atenúa suave a los 2 s.

## Target

Tres detalles, todos sobrios y funcionales (nada decorativo):

1. **Disco del disparador** (press feedback asimétrico): al apretar, el disco interior escala a `0.9` en **100 ms**;
   al soltar vuelve a `1` en **200 ms**; curva ease-out `cubic-bezier(0.23, 1, 0.32, 1)`. Con Reducir movimiento: sin
   escala (queda la opacidad 0.8 del aro, como hoy). Mismo mecanismo que "Mandar al rollo" (`capture-preview.tsx:28-37`,
   transiciones CSS de Reanimated 4).
2. **Parpadeo de captura**: al empezar `shoot()` una capa negra sobre la vista (dentro de `camera-frame`) va a opacidad
   `1` en **40 ms** y vuelve a `0` en **220 ms** con ease-out. Se mantiene con Reducir movimiento (es opacidad, no movimiento).
3. **Cuadrado de enfoque**: cada toque nuevo lo hace entrar desde `scale 1.25` a `1` en **200 ms** ease-out (sin escala
   con Reducir movimiento); la atenuación a `0.5` pasa a ser un fundido de **300 ms**; volver a `1` (toque nuevo o cambio
   de EV) es inmediato.

## Repo conventions to follow

- Exemplar de transición CSS en RN (Reanimated 4), construida perezosamente: `src/features/capture/capture-preview.tsx:28-37`
  y su uso en `:127-135`:
  ```ts
  let pressTransition: CSSTransitionProperties | undefined;
  const getPressTransition = () =>
    (pressTransition ??= {
      transitionProperty: ["transform", "opacity"],
      transitionDuration: 120,
      transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
    });
  ```
  En iOS la curva **tiene** que ser `cubicBezier()` (un string "cubic-bezier(...)" tira error nativo).
- Nunca llamar Reanimated a nivel de módulo (las suites de rutas lo mockean como objeto vacío; `src/test/reanimated.ts` lo llena).
- `useReduceMotion()` de `@/ui/use-reduce-motion` devuelve `null` mientras no se sabe: tratar `null` como "reducido"
  (`reduceMotion === false` es la única condición para mover/escalar), igual que `capture-preview.tsx:133`.
- Funciones llamadas dentro de `useAnimatedStyle` deben ser `'worklet'`.

## Steps

1. **Mock**: en `src/test/reanimated.ts` agregar al `Object.assign`:
   ```ts
   // A sequence ends at its last step.
   withSequence: (...steps: unknown[]) => steps[steps.length - 1],
   ```
   (Las suites que renderizan la cámara, `__tests__/capture.test.tsx` y `__tests__/moment.test.tsx`, ya importan `@/test/reanimated`.)

2. **Test primero**: en `__tests__/capture.test.tsx`, dentro del `describe` donde están los tests del `focus-square`
   (`describe("exposure"`, cerca de la línea 779; usar `openCapture()` y `startSession()` como sus vecinos), agregar un test que exija la capa de parpadeo y que sea invisible en reposo:
   ```ts
   it("has a shutter blink over the preview that rests invisible", async () => {
     await openCapture();
     await startSession();
     const blink = screen.getByTestId("shutter-blink");
     expect(StyleSheet.flatten(blink.props.style).opacity).toBe(0);
     expect(blink.props.pointerEvents).toBe("none");
   });
   ```
   (Importar `StyleSheet` de `react-native` si el archivo no lo importa.) Verlo fallar (no existe el testID).

3. `src/features/camera/camera.tsx`, imports:
   ```ts
   import Animated, {
     cubicBezier,
     useAnimatedStyle,
     useSharedValue,
     withSequence,
     withTiming,
     type CSSTransitionProperties,
   } from "react-native-reanimated";
   import { EASE_OUT_BEZIER, easeOut } from "@/ui/motion";
   import { useReduceMotion } from "@/ui/use-reduce-motion";
   ```

4. A nivel de módulo (junto a `FOCUS_DIM_MS`), transición perezosa del disco:
   ```ts
   // Built on first use, never at import: route test suites mock Reanimated as an empty object.
   let shutterTransition: CSSTransitionProperties | undefined;
   const getShutterTransition = (pressed: boolean): CSSTransitionProperties => ({
     ...(shutterTransition ??= { transitionProperty: ["transform"], transitionTimingFunction: cubicBezier(...EASE_OUT_BEZIER) }),
     // Asymmetric: the press lands fast, the release settles.
     transitionDuration: pressed ? 100 : 200,
   });
   ```

5. Dentro del componente (cerca de los otros `useState`): `const reduceMotion = useReduceMotion();`,
   `const blink = useSharedValue(0);`, `const focusScale = useSharedValue(1);`, `const focusOpacity = useSharedValue(1);` y:
   ```ts
   const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.get() }));
   const focusStyle = useAnimatedStyle(() => ({ opacity: focusOpacity.get(), transform: [{ scale: focusScale.get() }] }));
   ```

6. **Parpadeo**: en `shoot()`, inmediatamente después de `setFailed(false);` y antes de `capturePhoto`:
   ```ts
   // The preview blinks at the instant of the shot, like the iPhone's camera (opacity only: also with Reduce Motion).
   blink.set(withSequence(withTiming(1, { duration: 40 }), withTiming(0, { duration: 220, easing: easeOut() })));
   ```
   Y dentro de `<View testID="camera-frame" …>`, **después** del bloque `{grid && …}` (línea 299) y **antes** del `View testID="camera-pinch"` (línea 308):
   ```tsx
   <Animated.View testID="shutter-blink" pointerEvents="none" style={[StyleSheet.absoluteFill, styles.blink, blinkStyle]} />
   ```
   con `blink: { backgroundColor: "#000" }` en `styles`. Test del paso 2: verde.

7. **Disco**: reemplazar el hijo del `Pressable` del disparador por una función de `pressed`:
   ```tsx
   {({ pressed }) => (
     <Animated.View
       style={[
         countdown !== null ? styles.shutterStop : styles.shutterInner,
         getShutterTransition(pressed),
         { transform: [{ scale: pressed && reduceMotion === false ? 0.9 : 1 }] },
       ]}
     />
   )}
   ```
   El `style` del `Pressable` (opacidad del aro) queda igual.

8. **Enfoque**: en `focusAt`, después de `setFocusState(...)`:
   ```ts
   focusScale.set(reduceMotion === false ? withSequence(withTiming(1.25, { duration: 0 }), withTiming(1, { duration: 200, easing: easeOut() })) : 1);
   ```
   Reemplazar el `useState` de `dim` y su effect (líneas 184-190) por:
   ```ts
   useEffect(() => {
     if (!focus) return;
     focusOpacity.set(1);
     const t = setTimeout(() => focusOpacity.set(withTiming(0.5, { duration: 300, easing: easeOut() })), FOCUS_DIM_MS);
     return () => clearTimeout(t);
   }, [focus, bias]); // eslint-disable-line react-hooks/exhaustive-deps -- the shared value is stable
   ```
   (`dim` no se usa en ningún otro lado: solo en el style inline del cuadrado, que se reemplaza abajo.)
   El cuadrado pasa a `Animated.View`, sin `opacity` en el style inline:
   ```tsx
   <Animated.View
     testID="focus-square"
     pointerEvents="none"
     style={[styles.focus, { left: focus.x - FOCUS_SIZE / 2, top: focus.y - FOCUS_SIZE / 2 }, focusStyle]}
   >
   ```
   (cerrar con `</Animated.View>`).

## Boundaries

- NO tocar zoom (chips, rampa, pellizco), exposición (`exposure.ts`, el sol), flash, temporizador, cuadrícula ni `shoot()` más allá del paso 6.
- NO agregar háptico al disparo (iOS no tiene; el éxito ya suena al mandar) ni sonido.
- NO animar el cambio de tamaño de los chips de zoom ni la cuenta regresiva.
- NO agregar dependencias. Gesture Handler no es dependencia: no usarlo.
- Si las líneas citadas no coinciden (drift desde `d6da421`), PARÁ y reportá.

## Verification

- **Mecánica**: `npm run typecheck`; `npx jest __tests__/capture.test.tsx __tests__/moment.test.tsx src/features/camera` en verde; luego `npm test`.
- **Feel check (iPhone real, es cámara: el simulador no sirve)**:
  - Apretar y mantener el disparador sin soltar: el disco blanco se achica rápido y queda chico; soltar: vuelve más lento. No se ve "rebote".
  - Sacar una foto: la vista parpadea en negro **en el instante** del toque (no cuando aparece la pantalla del caption). Debe ser corto: si se siente como un "flash" de pantalla, bajar la primera opacidad a `0.85` antes de tocar otra cosa.
  - Con temporizador de 3 s: al llegar a 0 la vista parpadea; mientras cuenta el disco no se mueve.
  - Tocar para enfocar: el cuadrado entra apenas más grande y se asienta (~0,2 s); tocar en otro lado repite; a los 2 s se atenúa en un fundido suave, y arrastrar el EV lo vuelve a 1 al instante.
  - Grabar en cámara lenta (otro iPhone a 240 fps) si hay dudas del parpadeo: tiene que durar ~1/4 s en total.
  - **Reducir movimiento ON**: el disco no escala (solo el aro baja a 0.8), el cuadrado aparece sin escalar, el parpadeo y el fundido del cuadrado siguen.
  - Momento del día (Desarrollo → "Probar momento ahora"): lo mismo en las dos fotos.
- **Done when**: los tres detalles se ven en el dispositivo y todos los tests pasan.
