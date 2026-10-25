# Captura sin "Repetir", sin videos y cupo diario o total

Decisiones del dueño: `docs/superpowers/specs/2026-10-25-momento-diario-design.md` (sección 2, PR rollo-app/mobile#69) y el párrafo
"Próximo build" de `CLAUDE.md`. Backend en `rollo-app/backend`, rama `feature/captura-y-cupo`.

## Diseño del contrato (backend, aditivo)

- Migración `0020_trip_photo_limit_mode.sql`: `trips.photo_limit_mode TEXT NOT NULL DEFAULT 'daily'` (`'daily' | 'total'`) y
  `trips.total_photo_limit INTEGER` (NULL en `daily`). `daily_photo_limit` y `daily_video_limit` quedan.
- `POST /trips`: `dailyVideoLimit` opcional (default **0**), `photoLimitMode` (default `daily`) y `totalPhotoLimit` (1–500, obligatorio si el
  modo es `total`, se ignora en `daily`). `PATCH /trips/{id}` acepta `totalPhotoLimit` (solo rollos `total`).
- `Trip` (respuestas): suma `photoLimitMode` y `totalPhotoLimit` (`null` en `daily`). `dailyVideoLimit` sigue.
- `today.photosLeft` es lo que queda **hoy** (`daily`) o **en todo el rollo** (`total`); `videosLeft` sigue (un cliente viejo anda igual).
- Registrar media: en `total` cuenta todas las fotos de la persona (pendientes y borradas incluidas) → 429
  "Ya usaste todas tus fotos del rollo". Un video con `dailyVideoLimit` 0 → 400 "Este rollo no admite videos".
- El push "Arrancó" dice "Tenés N fotos en el rollo." en modo `total`.

## App

1. **Captura sin Repetir** (`capture-screen.tsx`, `capture-preview.tsx`): la cámara pide solo `images`; después de disparar, la pantalla del
   caption muestra la foto con `blurRadius` fuerte, caption opcional y "Mandar al rollo". Sin "Repetir", sin "Cancelar" y con
   `gestureEnabled: false` en la ruta: la única salida es mandarla. (Cancelar la cámara del sistema antes de disparar sigue volviendo.)
2. **Sin videos**: `Left`/`remaining`/`tabsFor`/`use-today-left` pasan a contar solo fotos; se saca la fila "Videos" del tablero, el
   stepper de videos de crear rollo y el "videos nuevos" de la pantalla de cupo agotado. La galería, el visor y las historias no se tocan.
3. **Cupo diario o total**: `createTrip` recibe `photoLimit: { mode: "daily", perDay } | { mode: "total", total }`. Crear rollo suma el
   segmento "Por día | Todo el rollo" (`@expo/ui`) con su stepper (1–100 por día, default 10; 1–500 total, default 20). `countPending(tripId, day?)`
   sin día cuenta todas las pendientes del rollo y `loadLeft` (`load-left.ts`) lo usa en modo `total`. Textos: badge igual (lo que queda),
   "Tenés N fotos en el rollo." en "Arrancó el rollo", tablero "Te quedan N de M" y cupo agotado "Ya usaste todas tus fotos del rollo".
   Detalles viejos en cache sin `photoLimitMode` se tratan como `daily`.
4. **Pastilla**: "Destacada en tu perfil".

## Pruebas

TDD: tests primero en `__tests__/capture.test.tsx`, `__tests__/screens.test.tsx`, `__tests__/roll-started.test.tsx` y en
`src/features/{capture,trips}/__tests__`. `npm test` y `npm run typecheck` en verde en los dos repos.

## Choques esperables con otros workers

`openapi.json` / `src/api/schema.d.ts`, `src/db/schema.ts`, el número de migración (0020), el formulario de crear rollo
(`create-screen.tsx`, "Rollo privado" de fotos en perfiles) y el párrafo "Próximo build" de `CLAUDE.md`.
