# Planes de animación

Salen de la skill `improve-animations` (auditoría del motion de la app, commit `d6da421`, 2026-10-27).
Cada plan es autocontenido: un worker sin contexto lo puede ejecutar. Target: React Native (Reanimated 4 +
worklets, RN `Animated` donde ya se usa), nunca web.

| # | Plan | Severidad | Estado |
| --- | --- | --- | --- |
| 001 | [Fundidos de "Reducir movimiento" que se vean + token ease-out](001-reduce-motion-fades-and-ease-out-token.md) | HIGH | done |
| 002 | [Barra de las historias en el hilo nativo + snap-back](002-story-progress-on-native-thread.md) | HIGH | done |
| 003 | [Cámara: disparo y enfoque como iOS](003-camera-shutter-and-focus-feedback.md) | MEDIUM | done |
| 004 | [Pastilla: ease-out y sin parpadeo al repetirse](004-pill-ease-out-and-retarget.md) | LOW | done |

## Orden recomendado

1. **001** primero: crea `src/ui/motion.ts` (`EASE_OUT_BEZIER`, `easeOut()`, `ownedTiming()`), que usan 003 y 004.
2. **002** es independiente (solo `src/features/presentation/`): puede ir en paralelo con 001.
3. **003** después de 001 (importa `easeOut` / `EASE_OUT_BEZIER`). Toca `src/test/reanimated.ts` (agrega `withSequence`).
4. **004** cuando quieras; si 001 no está hecho, usa los cuatro números de la curva a mano.

Dependencias de archivos: 001 y 003 no comparten archivos de código salvo `src/ui/motion.ts` (001 lo crea, 003 lo lee).
Ninguno toca el "worst case" del perfil que se está haciendo en paralelo.

## Lo que se decidió dejar como está

- Me gusta sin animación (decisión del dueño, CLAUDE.md), cortes secos entre historias, chevron de "Anteriores" (200 ms, raro),
  cuenta regresiva y chips de zoom de la cámara, cámaras del mapa (MapLibre), revelado (`darkroom-intro.tsx`, ya bien con RM),
  salida de "Mandar al rollo", subida del teclado del caption, intro/candado/momento (salvo RM, plan 001).
- Gesto de cerrar las historias con `PanResponder` (hilo JS): moverlo a Gesture Handler pide dependencia nativa + rebuild; después de enero.
- "Mandar al rollo": press de 120 ms simétrico; podría ser asimétrico (100 / 200 ms) pero es polish mínimo.
- Comentario de `src/ui/badge.tsx:9` dice que el punto LIVE late "still with Reduce Motion" y el código lo frena con RM: corregir el comentario cuando se toque el archivo.
