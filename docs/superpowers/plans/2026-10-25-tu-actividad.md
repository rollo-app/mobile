# Tu actividad — plan de implementación

Diseño: `docs/superpowers/specs/2026-10-23-tu-actividad-design.md` (las decisiones de Claude están aprobadas).
Ramas: `feature/tu-actividad` en `rollo-app/mobile` y en `rollo-app/backend` (PRs en draft que se citan entre sí).

## Compatibilidad

Todo aditivo: endpoint nuevo `GET /me/likes`, sin migración y sin tocar los existentes. Un cliente viejo sigue andando.

## 1. Backend (`src/modules/likes/`)

`GET /me/likes?cursor&limit` → `{ items, nextCursor, total }` (`total` es un campo extra, aditivo, para la cantidad de la fila "Me gusta").

- Filtra **en SQL** (nunca en la app) y pagina por `(likedAt, mediaId)` descendente; cursor opaco base64url. Cursor inválido → 400. `limit` 1–100, default 60.
- Una foto sale si **hoy** se ve por alguna vía:
  - `trip`: miembro activo del rollo revelado (`removed_at`/`left_at` nulos);
  - `featured`: destacada visible (`VISIBLE_FROM`/`VISIBLE_WHERE`, regla única de `featured.repository`) en un perfil de un dueño que `canSeeProfile` (vos, público, o amigo, sin bloqueo en ningún sentido).
  - Si se ve por las dos, gana `trip`.
- Siempre: foto subida, no borrada, ocultas las denunciadas por vos y de autores que bloqueaste (`hiddenMediaSql`), y sin bloqueo del autor hacia vos.
- Tests (`test/likes.test.ts`, bloque `GET /me/likes`): orden por fecha del me gusta, paginación, rollo no revelado, ex miembro que la sigue viendo destacada (→ `featured`) y que no (→ fuera), perfil privado, foto sacada del perfil, bloqueo (ambos sentidos), foto denunciada, `trip` gana a `featured`, video fuera, sin sesión 401.
- `npm run openapi`, y el contrato en el CLAUDE.md del backend.

## 2. App (`src/features/activity/`)

- `npm run api:generate` desde el `openapi.json` del backend.
- `actions.ts` (`fetchMyLikes`), `use-my-likes.ts` (`useInfiniteQuery`, key `["my-likes"]`), lógica pura `likes-target.ts` (a qué visor va cada ítem) con tests.
- Pantallas finas en `app/(tabs)/me/activity.tsx` y `app/(tabs)/me/likes.tsx`; `ActivityScreen` (lista agrupada, fila "Me gusta" con cantidad) y `MyLikesScreen` (grilla con insignia del autor si no sos vos, vacío, error con "Reintentar", paginación al llegar al final).
- Ícono `clock.arrow.circlepath` en la barra del Perfil, al lado del engranaje.
- Dar o sacar un me gusta (`use-toggle-like.ts`) invalida `["my-likes"]`.
- Rutas en `app/_layout.tsx` / `src/test/routes.ts`; tests de pantalla con `renderRouter`.
- CLAUDE.md de la app.
