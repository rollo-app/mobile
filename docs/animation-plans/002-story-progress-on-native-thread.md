# 002 — Barra de progreso de las historias en el hilo nativo (y un snap-back sin rebote de más)

- **Status**: done
- **Commit**: d6da421
- **Severity**: HIGH (rendimiento en un momento de firma; el tirón no se puede medir desde el código: confirmar en el feel check)
- **Category**: Performance (+ Interruptibility)
- **Estimated scope**: 3 archivos de código + 2 de tests, ~40 líneas

## Problem

La presentación (historias después del revelado) anima el **ancho** de cada segmento de la barra con el driver de JS,
cuadro por cuadro, durante toda la presentación (4 s por foto, 2 s por día, hasta 15 s por video):

```ts
// src/features/presentation/story-player.tsx:103-108 — current
const anim = Animated.timing(progress, {
  toValue: 1,
  duration: duration * (1 - value.current),
  easing: Easing.linear,
  useNativeDriver: false,
});
```

```tsx
// src/features/presentation/progress-bar.tsx:13-19 — current
<Animated.View
  style={[
    styles.fill,
    {
      width: position.interpolate({ inputRange: [i, i + 1], outputRange: ["0%", "100%"], extrapolate: "clamp" }),
    },
  ]}
/>
```

Más un listener de JS que corre en cada cuadro solo para recordar dónde quedó al pausar:

```ts
// src/features/presentation/story-player.tsx:89-94 — current
useEffect(() => {
  const id = progress.addListener(({ value: v }) => {
    value.current = v;
  });
  return () => progress.removeListener(id);
}, [progress]);
```

`width` es una propiedad de layout: cada cuadro pasa por JS → Yoga → layout. Justo en esta pantalla el hilo de JS está
ocupado con `Image.prefetch`, `Image.clearMemoryCache` en cada día, el `Slide` y videos: la barra (lo único que se
mueve todo el tiempo) es lo primero que tironea. Debe animar `transform` en el hilo nativo.

Además, el snap-back cuando soltás un arrastre corto hacia abajo usa el spring por defecto de RN Animated
(`friction: 7, tension: 40`), lento y con rebote visible:

```ts
// src/features/presentation/story-player.tsx:187-190 y :196 — current
Animated.spring(drag, {
  toValue: 0,
  useNativeDriver: true,
}).start();
// …
Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
```

## Target

1. **Segmento**: el relleno ocupa todo el ancho y escala en X desde la izquierda, con driver nativo:
   ```tsx
   <Animated.View
     style={[
       styles.fill,
       { transform: [{ scaleX: position.interpolate({ inputRange: [i, i + 1], outputRange: [0, 1], extrapolate: "clamp" }) }] },
     ]}
   />
   // styles.fill: { height: 3, width: "100%", backgroundColor: "#fff", transformOrigin: "left" }
   ```
   (`scaleX: 0` acá está bien: es una barra de progreso, no una entrada. No "arreglarlo" a 0.9.)
   El track ya tiene `overflow: "hidden"` y el radio; el relleno no tiene radio, así que escalar no deforma esquinas.

2. **El reloj vive en JS, la barra es solo display**: el paso avanza con un `setTimeout` del tiempo restante (no con
   el callback de la animación), y al pausar se calcula dónde quedó con una función pura, sin listener:
   ```ts
   // src/features/presentation/story.ts — new
   /** Where a linear step's progress is after running `elapsedMs` from `from` (0–1), for a step of `durationMs`. */
   export function elapsedProgress(from: number, elapsedMs: number, durationMs: number): number {
     if (durationMs <= 0) return 1;
     return Math.min(1, Math.max(0, from + elapsedMs / durationMs));
   }
   ```

3. **Snap-back**: spring estilo Apple `duration 0.5, bounce 0.2` traducido a RN Animated
   (stiffness = (2π / 0.5)² ≈ 158; damping = 2 · (1 − 0.2) · √158 ≈ 20; mass 1):
   ```ts
   const SNAP_BACK = { stiffness: 158, damping: 20, mass: 1 } as const;
   Animated.spring(drag, { toValue: 0, ...SNAP_BACK, useNativeDriver: true }).start();
   ```

## Repo conventions to follow

- Lógica pura en `*.ts` con tests en `__tests__/` de la misma feature (`src/features/presentation/__tests__/story.test.ts` ya existe).
- `transformOrigin` es estilo soportado por RN 0.88 (el repo está en 0.88.0) y por el driver nativo.
- Constantes de módulo como `MIN_SCALE`, `HOLD_MS` arriba de `story-player.tsx` (líneas 37-40): `SNAP_BACK` va ahí.
  Es RN `Animated` (no Reanimated): se puede definir a nivel de módulo sin problema.
- Tests de pantalla: `fireEvent` es async (`await fireEvent…`). `__tests__/presentation.test.tsx` usa fake timers y
  `jest.advanceTimersByTime(PHOTO_MS - 400)` para el auto-avance: con el `setTimeout` siguen funcionando igual.

## Steps

1. **Test primero (pura)**: en `src/features/presentation/__tests__/story.test.ts` agregar:
   ```ts
   describe("elapsedProgress", () => {
     it("advances linearly from where the step was", () => {
       expect(elapsedProgress(0, 1000, 4000)).toBe(0.25);
       expect(elapsedProgress(0.5, 1000, 4000)).toBe(0.75);
     });
     it("never goes past the end or below the start", () => {
       expect(elapsedProgress(0.9, 4000, 4000)).toBe(1);
       expect(elapsedProgress(0.2, -50, 4000)).toBe(0.2 - 50 / 4000);
       expect(elapsedProgress(0, -10_000, 4000)).toBe(0);
     });
     it("treats an empty step as done", () => {
       expect(elapsedProgress(0, 0, 0)).toBe(1);
     });
   });
   ```
   (Importar `elapsedProgress` desde `../story`.) Verlo fallar; implementar **Target §2** en `story.ts`; verde.

2. **Test primero (barra)**: en `src/features/presentation/__tests__/progress-bar.test.tsx` cambiar el helper para leer
   la escala en vez del ancho y las expectativas a números:
   ```ts
   function fillScales(): number[] {
     const out: number[] = [];
     const visit = (node: Node | Node[] | null | undefined) => {
       if (!node) return;
       if (Array.isArray(node)) return node.forEach(visit);
       if (typeof node === "string") return;
       const style = StyleSheet.flatten(node.props?.style as object) as
         | { height?: number; backgroundColor?: string; transform?: { scaleX?: number }[] }
         | undefined;
       if (style?.height === 3 && style.backgroundColor === "#fff") out.push(style.transform?.[0]?.scaleX as number);
       visit(node.children as Node[]);
     };
     visit(screen.toJSON() as Node | Node[] | null);
     return out;
   }
   ```
   Expectativas: `[1, 0.5, 0, 0]`, `[1, 1, 0, 0]`, `[0, 0, 0]`. Verlo fallar.

3. `src/features/presentation/progress-bar.tsx`: aplicar **Target §1** (reemplazar `width` por `transform: [{ scaleX }]`
   con `outputRange: [0, 1]`; `styles.fill` = `{ height: 3, width: "100%", backgroundColor: "#fff", transformOrigin: "left" }`).
   Actualizar el comentario de la línea 7: "One animated position drives every segment (scaleX on the native thread), so none is ever a static value React could fail to update." Test del paso 2: verde.

4. `src/features/presentation/story-player.tsx`:
   - Borrar el effect del listener (líneas 89-94).
   - Reemplazar el effect de las líneas 95-111 por:
     ```ts
     useEffect(() => {
       if (lastIndex.current !== state.index) {
         lastIndex.current = state.index;
         value.current = 0;
         progress.setValue(0);
       }
       const duration = stepDuration(step);
       if (duration == null || state.paused || screenReader) return;
       const from = value.current;
       // Native-driven: JS never sees the frames, so start explicitly from the saved point.
       progress.setValue(from);
       const startedAt = Date.now();
       const anim = Animated.timing(progress, {
         toValue: 1,
         duration: duration * (1 - from),
         easing: Easing.linear,
         useNativeDriver: true,
       });
       anim.start();
       // The clock lives here; the bar only shows it.
       const next = setTimeout(() => dispatch({ type: "next" }), duration * (1 - from));
       return () => {
         clearTimeout(next);
         anim.stop();
         value.current = elapsedProgress(from, Date.now() - startedAt, duration);
       };
     }, [state.index, state.paused, step, progress, screenReader]);
     ```
   - Importar `elapsedProgress` desde `./story`.
   - Arriba, junto a `MIN_SCALE`: `const SNAP_BACK = { stiffness: 158, damping: 20, mass: 1 } as const;`
   - Los dos `Animated.spring(drag, …)` (líneas 187-190 y 196) pasan a
     `Animated.spring(drag, { toValue: 0, ...SNAP_BACK, useNativeDriver: true }).start();`
   - Actualizar el comentario de las líneas 74-75: "Auto-advance: a timer per step; the bar animates on the native thread and, after a pause, resumes from where the clock says it was."

## Boundaries

- NO tocar el gesto (PanResponder, `dismiss.ts`, umbrales), la salida de 180 ms, `Slide`, `DayCard` ni `Outro`.
  Migrar el gesto a Gesture Handler queda fuera (pide dependencia nativa + rebuild).
- NO cambiar duraciones de los pasos (`PHOTO_MS`, `DAY_CARD_MS`, `MAX_VIDEO_MS`).
- NO agregar dependencias.
- Si el código no coincide con los extractos (drift desde `d6da421`), PARÁ y reportá.

## Verification

- **Mecánica**: `npm run typecheck`; `npx jest src/features/presentation __tests__/presentation.test.tsx __tests__/reveal-shell.test.tsx`
  en verde (en especial "a tap right before the photo moves on by itself doesn't also skip the next one"); después `npm test` completo.
- **Feel check (iPhone real, idealmente uno viejo)**: abrir un rollo revelado del seed (Bariloche, `juani@rollo.test`) → botón del centro (Presentación).
  - La barra se llena lisa, sin saltitos, también justo cuando cambia de día (ahí se limpia la caché de imágenes) y mientras carga la próxima foto.
  - Mantener apretado (pausa) a mitad de una foto: la barra se frena **exactamente** donde está; soltar: sigue desde ahí, sin volver atrás ni adelantarse.
  - Tocar a la derecha/izquierda: el segmento anterior queda lleno y el nuevo arranca en 0, sin parpadeo.
  - Arrastrar hacia abajo ~60 pt y soltar: vuelve arriba en ~0,5 s con un rebote apenas perceptible (antes: más lento y gomoso).
  - Con VoiceOver prendido la barra no avanza (igual que antes).
- **Done when**: no queda `useNativeDriver: false` ni `addListener` en `src/features/presentation/`, y la barra se ve lisa en el dispositivo.
