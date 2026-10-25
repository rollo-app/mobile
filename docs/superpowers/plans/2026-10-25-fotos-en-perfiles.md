# Tus fotos en otros perfiles — plan

Diseño: `docs/superpowers/specs/2026-10-23-fotos-en-perfiles-design.md` (las decisiones de Claude están aprobadas).
Ramas: `feature/fotos-en-perfiles` en `rollo-app/mobile` y en `rollo-app/backend`. Todo aditivo (un cliente viejo sigue andando).

## Regla

Gana el más restrictivo. Una sola función pura, `canFeature` (`backend/src/lib/featuring.ts`), la usan destacar y el feed:

1. Rollo privado (`trips.featuring_disabled`): nadie, ni el autor.
2. Si no, el autor siempre puede con las suyas.
3. Si no, para otros: foto (`media.feature_blocked_at`), miembro (`members.allow_featuring`) y cuenta (`user_settings.allow_featuring`) tienen que permitir.

## Backend (TDD, en este orden)

1. Migración `0020_featuring_levels.sql`: `user_settings.allow_featuring`, `members.allow_featuring`, `trips.featuring_disabled` (+ `db/schema.ts`, `types.ts`).
2. Tests de cada nivel (`test/featuring-levels.test.ts`): frena a otros; el autor puede salvo rollo privado; limpieza al apagar; prender no restaura; feed `canFeature`; contrato aditivo (crear rollo sin el campo).
3. `featuring.ts` + `featured.service` usa la regla; limpieza como sentencias en `featured.repository` dentro de un `batch`.
4. API: `PATCH /me/settings` suma `privacy.allowFeaturing` (la respuesta también); `PATCH /trips/{id}/members/me` `{ allowFeaturing }`; `featuringDisabled` en crear/editar rollo (admin) y en `Trip`; `me.allowFeaturing` en el detalle; `canFeature` en el feed revelado.
5. `npm run openapi`, `npm test`, `npm run typecheck`, CLAUDE.md.

## App

1. `npm run api:generate` desde el openapi del backend.
2. Lógica pura + tests: `canFeature` del ítem (viejo server sin el campo → se deduce de `featureBlocked`).
3. Ajustes → "Privacidad": switch "Permitir que agreguen mis fotos a su perfil" (junto a "Perfil público"), `useMutation`, error inline.
4. Rollo (tablero y segmento "Rollo"): switch "Tus fotos en otros perfiles" con footnote; oculto si el rollo es privado.
5. Crear rollo: "Rollo privado" con su explicación (+ editar para el admin en el tablero).
6. Visor y menú de la grilla: sin "Agregar a tu perfil" cuando `canFeature` es falso.
7. `npm test`, `npm run typecheck`, CLAUDE.md, PR en draft.

## Choques esperables al integrar

`openapi.json`, `src/db/schema.ts`, número de migración, `user_settings`, `PATCH /me/settings`, formulario de crear rollo (captura/cupo).
