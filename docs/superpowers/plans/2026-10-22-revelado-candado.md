# Revelado en el cuarto oscuro y candado que se abre — de prueba a producción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dejar en limpio lo que se validó en la prueba `spike/revelado-candado`: el revelado como pantalla propia (cuarto oscuro con grano, fotos que salen del químico, háptico que crece, golpe final) y el momento "Arrancó el rollo" (candado que se abre y pasa a cámara).

**Architecture:** el código ya existe en la rama `feature/revelado-candado` (la prueba rebasada sobre `feature/destacadas`). Este plan no agrega funciones: saca lo provisorio (flags, comentarios "Spike", la intro vieja), ordena los archivos por dominio, cubre con tests lo que quedó sin cubrir, arregla los riesgos que dejó la prueba y documenta.

**Tech Stack:** Expo SDK 58, Reanimated 4.7 + worklets 0.13, `@shopify/react-native-skia` 2.14 (shaders SkSL), `react-native-pulsar` (hápticos continuos), `expo-audio`, módulo local de Expo en Swift `modules/rollo-symbol` (SF Symbols con `.contentTransition(.symbolEffect(.replace.magic))`).

## Diseño (lo que el dueño ya vio y aprobó en el iPhone)

- **Revelado** (`/reveal`, fullScreenModal): se abre solo **una vez por rollo** la primera vez que entrás a un rollo revelado (`useFirstPresentation`, esperando `loaded`). Secuencia de ~7 s: cuarto oscuro rojo con grano animado y "Revelando {rollo}" → 9–12 fotos que salen de su ThumbHash con un umbral de ruido de los bordes al centro, de sepia a color y de borroso a nítido, con háptico que crece → golpe (impacto fuerte + éxito + clic de obturador generado en código), la luz pasa de roja a blanca → título "Se reveló · {rollo} · {fecha}" → `router.replace("/presentation")`. Tocar salta a las historias. Sin fotos o con error, va directo a `/presentation`. Con "Reducir movimiento": fundido simple y solo el háptico de éxito.
- **Presentación** (`/presentation`, botón del centro): **solo las historias**, fondo negro desde el primer frame. Ya no tiene paso de intro.
- **Arrancó el rollo** (`/roll-started`): la primera vez que el rollo activo está en curso, una vez por rollo. Candado grande que se sacude → se abre (magic replace) con un "clac" → pasa a cámara con rebote + éxito. Texto "Arrancó el rollo. Tenés N fotos hoy." y botones "Sacar la primera" (abre la cámara) y "Ahora no". **Pendiente de que el dueño lo pruebe** (Tarea B).
- **Claves persistidas en el celular** (SecureStore, no se renombran nunca): `rollo.presentation-seen.<tripId>` (ya existía: abrir solo el revelado), `rollo.revealIntroSeen.<tripId>` (el revelado se vio), `rollo.rollStartedSeen.<tripId>` (se vio "Arrancó el rollo").
- **Desarrollo** (solo `__DEV__`, Ajustes): "Ver revelado" y "Ver candado" los muestran siempre.

## Global Constraints

- Cero cambios de comportamiento respecto de lo que el dueño probó, salvo los arreglos listados en cada tarea.
- Las claves de SecureStore de arriba quedan con esos nombres exactos.
- Código, comentarios y tests en inglés; textos de UI en rioplatense con voseo; commits en español con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. TDD para lo nuevo. `app/` solo rutea.
- No quedan referencias a "spike" en el código.

## Review Focus

- El sonido del obturador no cambia el modo de audio de toda la app (los videos de las historias tienen que sonar igual que antes).
- Si el módulo nativo `RolloSymbol` no está (por ejemplo, un build viejo), la pantalla del candado no se rompe: muestra el símbolo con `expo-symbols`.
- El revelado y "Arrancó el rollo" nunca se disparan para un rollo que no es el activo (carrera de `useActiveTrip` antes de `loaded`).
- Si el shader de Skia no compila en el dispositivo (`RuntimeEffect.Make` null), las fotos se ven igual (sin efecto), no cuadrados de color.

---

### Task A: Revelado y presentación en limpio

**Files:**
- Move to `src/features/reveal/`: `src/features/presentation/darkroom-intro.tsx`, `darkroom-shaders.ts`, `use-skia-thumbs.ts`, `shutter-sound.ts` (el revelado es del dominio `reveal`; `presentation` ya no los usa).
- Delete: `src/features/presentation/intro-flag.ts` (la constante de duración pasa a `src/features/reveal/`), `src/features/presentation/intro.tsx` (la intro de mosaico vieja) y sus tests si los tiene; `reveal-screen.tsx` usa siempre `DarkroomIntro`.
- Modify: `src/features/reveal/reveal-screen.tsx`, `src/features/presentation/story.ts` y tests que importen lo movido; comentarios "Spike" en todo `src/`, `app/` y `modules/`.

**Arreglos:**
1. `shutter-sound.ts` no llama a `setAudioModeAsync` (el default de `expo-audio` ya respeta el modo silencio y así no se toca la sesión de audio de la app). Test: `prepareShutter` no llama a `setAudioModeAsync`.
2. Si `RuntimeEffect.Make` devuelve null, `DevelopingCell` dibuja la foto tal cual (o el color del ThumbHash mientras carga). Test unitario sobre la función que elige qué dibujar.
3. Lógica pura con test: el muestreo de fotos (`sampleEvenly`), el armado del WAV (cabecera RIFF correcta y largo), y los tiempos de la secuencia en un objeto de constantes (`REVEAL_TIMELINE`) que `RevealScreen` y `DarkroomIntro` comparten.

- [ ] **Step 1:** tests nuevos (los de arriba) y verlos fallar.
- [ ] **Step 2:** mover, borrar, arreglar.
- [ ] **Step 3:** `npm test` y `npm run typecheck` verdes.
- [ ] **Step 4:** commit "Revelado: en limpio, sin la intro vieja ni flags".

### Task B: "Arrancó el rollo" en limpio (después de que el dueño lo pruebe)

**Files:** `modules/rollo-symbol/index.ts` (wrapper JS con fallback a `SymbolView` si `requireNativeView` falla), `src/features/capture/roll-started.tsx`, `src/features/capture/use-roll-started.ts`, `src/storage/roll-started.ts`, `app/roll-started.tsx`, tests nuevos.

- [ ] **Step 1:** tests: storage get/set; `useRollStarted` no hace nada sin `ready`, ni con fase distinta de `active`, ni si ya se vio, y navega una sola vez; la pantalla muestra "Tenés N fotos hoy" con el cupo del rollo activo, "Sacar la primera" abre `/capture` y "Ahora no" cierra; con el módulo nativo ausente se ve el fallback. Ver fallar.
- [ ] **Step 2:** implementar lo que falte y los cambios que pida el dueño después de probarlo.
- [ ] **Step 3:** verdes. **Step 4:** commit "Cámara: Arrancó el rollo, en limpio".

### Task C: Docs y PR

- [ ] CLAUDE.md: revelado como pantalla propia (`/reveal`, una vez por rollo), presentación = solo historias, "Arrancó el rollo", paquetes nativos nuevos (rebuild) y el módulo local `modules/rollo-symbol`, las tres claves de SecureStore, las filas de Desarrollo, el conteo de tests.
- [ ] Push de `feature/revelado-candado` y PR a `feature/destacadas` (apilada sobre la #43; en español; qué probar en el iPhone; que pide recompilar el dev build). No mergear.
