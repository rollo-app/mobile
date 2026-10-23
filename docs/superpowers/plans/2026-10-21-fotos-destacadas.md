# Fotos destacadas en el perfil — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** desde la galería de un rollo revelado agregás fotos a tu perfil; tu perfil (y el de otros) muestra esas fotos en "Fotos | Mapa", el perfil es privado (solo amigos) o público, y al perfil de alguien que no es tu amigo se llega desde los miembros de un rollo.

**Architecture:** el backend suma la tabla `featured`, la visibilidad del perfil, un perfil por usuario (`GET /users/{userId}`), las destacadas de un usuario y una ruta propia para servir sus archivos con el permiso del perfil (no el del rollo). La app suma el botón en el visor y en la grilla, llena `ProfileShowcase` y generaliza el perfil de un amigo a "perfil de un usuario".

**Tech Stack:** backend Hono + D1 + R2 + zod-openapi + vitest; app Expo SDK 58, Expo Router, TanStack Query, `@expo/ui` (`MenuView`, `SegmentedControl`), MapLibre, jest-expo.

**Spec:** este documento (decisiones tomadas con el usuario el 2026-10-21). Cada worker lee el CLAUDE.md de su repo.

## Global Constraints

- **Ramas apiladas:** backend `feature/destacadas` sale de `feature/perfil-amigo` (PR #15); app `feature/destacadas` sale de `feature/tab-amigos` (PR #42). Las PRs nuevas apuntan a esas ramas, no a `develop`.
- **Qué se destaca:** solo **fotos** (no videos) de un rollo **revelado** donde sos **miembro activo**, subidas y no borradas. Fotos tuyas o de otros. Tope **60** por persona.
- **Lo que nunca sale:** ni el rollo (id, nombre, código), ni el caption, ni la coordenada exacta. La ubicación se manda como **zona**: lat/lng redondeadas al centro de una celda de **0.05°** (~5 km; `Math.floor(x / 0.05) * 0.05 + 0.025`, redondeado a 3 decimales); sin GPS → `zone: null`.
- **Autor:** cada destacada muestra quién la sacó si no es el dueño del perfil. El autor puede impedir que otros la destaquen ("No dejar que la destaquen"): eso borra las destacadas de otros de esa foto y bloquea nuevas (409 `"Quien sacó esta foto no quiere que se destaque"`). El autor siempre puede destacar las suyas.
- **Visibilidad del perfil:** `profileVisibility: "friends" | "public"`, por defecto `"friends"`. Puede ver las destacadas (y la descripción) de alguien: él mismo, sus amigos, o cualquiera con sesión si es `"public"`. Nombre, @ y foto se ven siempre (ya se ven en la lista de miembros). Sin permiso → 403 `"Este perfil es privado"`.
- Textos de UI: "Destacar" / "Destacada" (pill del visor), "Destacar en tu perfil" / "Sacar de tu perfil" (menú de la grilla), "No dejar que la destaquen" / "Dejar que la destaquen" (solo el autor), "Perfil público" (switch en Ajustes, footnote "Si está apagado, solo tus amigos ven tus fotos destacadas y tu descripción."), "Este perfil es privado" (perfil ajeno sin permiso), error del tope `"Podés destacar hasta 60 fotos"`.
- Íconos SF: `star` / `star.fill` para destacar.
- Código, tests y comentarios en inglés; UI en rioplatense con voseo; commits y PRs en español con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. TDD. Migraciones nuevas, nunca editar una aplicada. No se renombra nada persistido en el celular.

## Review Focus

- Un usuario que no es amigo, con perfil privado, pide `GET /users/{id}/featured` o un archivo `/featured/...` → 403, sin filtrar nada. (C1, C2)
- Una foto destacada cuyo autor después dice "No dejar que la destaquen", o que se borra, o cuyo dueño del perfil se sale del rollo → deja de verse y su archivo da 404. (C2)
- El JSON de las destacadas no trae `tripId`, nombre del rollo, caption ni lat/lng exactas (test que lo verifica con las claves del objeto). (C2)
- Destacar desde el visor dos veces seguidas, o con la red lenta → no duplica ni deja el botón en un estado mentiroso. (D2)
- Perfil de un miembro que no es amigo y es privado → se ve nombre, @ y foto, y "Este perfil es privado"; nada de "Rollos en común" ni "Borrar amigo". (D4)

---

## Parte 1 — Backend (repo `rollo-app/backend`, rama `feature/destacadas`)

### Task C1: Visibilidad del perfil y perfil de un usuario

**Files:**
- Create: `migrations/0009_featured.sql` (tabla `featured(user_id TEXT, media_id TEXT, created_at INTEGER, PRIMARY KEY (user_id, media_id))` con FKs `ON DELETE CASCADE`, índice `(user_id, created_at)`; `ALTER TABLE users ADD COLUMN profile_visibility TEXT NOT NULL DEFAULT 'friends'`; `ALTER TABLE media ADD COLUMN feature_blocked_at INTEGER`), `src/lib/profile-access.ts`, `src/routes/users.ts`, `test/users.test.ts`
- Modify: `src/routes/friends.ts` y `src/routes/trips.ts` (usar `areFriends` en vez de la consulta inline), `src/routes/me.ts` (`profileVisibility` en `GET/PATCH /me`), `src/schemas.ts`, `src/index.ts` (montar `/users`), `src/types.ts`, `openapi.json`

**Interfaces:**
- Produces: `areFriends(db, a: string, b: string): Promise<boolean>`; `canSeeProfile(db, viewerId: string, owner: { id: string; profile_visibility: string }): Promise<boolean>`. `GET /users/{userId}` (sesión) → 200 `{ user: { id, name, username, avatarUrl, bio: string | null }, isFriend: boolean, profileVisibility: "friends" | "public", canSee: boolean }` (`bio` es `null` si `!canSee`); 404 `"No existe"` si el usuario no existe. `PATCH /me { profileVisibility }` (valores fuera del enum → 400).

- [ ] **Step 1:** tests: `areFriends` en los dos órdenes; `canSeeProfile` para sí mismo, amigo, desconocido con `friends` (false) y con `public` (true); `GET /users/{id}` en esos cuatro casos (bio oculta sin permiso); `PATCH /me` cambia y valida `profileVisibility`; `GET /me` lo devuelve con default `"friends"`.
- [ ] **Step 2:** verificar que fallan. **Step 3:** implementar (migración aplicada con `npm run db:migrate:local`). **Step 4:** `npm test`, `npm run typecheck`, `npm run openapi` verdes.
- [ ] **Step 5:** commit "Perfil: público o privado y perfil de un usuario".

### Task C2: Destacadas

**Files:**
- Create: `src/routes/featured.ts`, `src/lib/zone.ts` + `test/zone.test.ts`, `test/featured.test.ts`
- Modify: `src/routes/media.ts` (en el feed revelado: `featuredByMe: boolean` y `featureBlocked: boolean` por ítem; en **todo** ítem del feed, antes y después del revelado, `author.userId` = id de usuario del autor, además del `author.id` de miembro que ya existe; ruta del autor para bloquear), `src/schemas.ts`, `src/index.ts`, `openapi.json`, `CLAUDE.md` del backend, seed (`scripts/seed/*`: Juani con 5 destacadas de Bariloche, 2 de otros; Tomi público; una foto de Cami bloqueada)

**Interfaces:**
- Consumes: C1 (`canSeeProfile`, tabla `featured`, `media.feature_blocked_at`), `isRevealed`, `loadTripAndMember` / reglas de miembro activo, el streaming de R2 que ya usa `GET /trips/{tripId}/media/{mediaId}/{variant}`.
- Produces:
  - `zoneOf(lat: number | null, lng: number | null): { lat: number; lng: number } | null` con la regla de Global Constraints.
  - `PUT /me/featured/{mediaId}` (sesión) → 204 (idempotente). Errores: 404 si no existe o no sos miembro activo de su rollo; 409 `"Este rollo todavía no se reveló"`; 400 `"Solo se pueden destacar fotos"`; 409 bloqueada (texto de Global Constraints, salvo que seas el autor); 409 `"Podés destacar hasta 60 fotos"`.
  - `DELETE /me/featured/{mediaId}` → 204 (también si no estaba).
  - `PUT /media/{mediaId}/feature-block` y `DELETE /media/{mediaId}/feature-block` (solo el autor, si no 403) → 204; el `PUT` borra las filas de `featured` de esa foto de otros usuarios.
  - `GET /users/{userId}/featured` → 200 `{ photos: FeaturedPhoto[] }` ordenadas por `created_at` desc, con `FeaturedPhoto = { mediaId, takenAt, width, height, thumbhash, author: { id (user id), name, username, avatarUrl } | null (null si el autor es el dueño), zone: { lat, lng } | null, thumbPath: "/featured/{userId}/{mediaId}/thumb", originalPath: "/featured/{userId}/{mediaId}/original" }`; 403 sin permiso. Se excluyen: foto borrada, bloqueada (si el dueño no es el autor), dueño que ya no es miembro activo de ese rollo.
  - `GET /featured/{userId}/{mediaId}/{variant}` (sesión) → el archivo, con el mismo criterio que la lista (403/404) y los mismos headers de cache que la descarga actual.

- [ ] **Step 1:** tests: `zoneOf` (redondeo, negativos, null); destacar ok, idempotente, y cada error; tope 60; bloquear borra las de otros y bloquea nuevas, el autor igual puede; la lista para dueño / amigo / desconocido privado (403) / desconocido público; **las claves de `FeaturedPhoto` son exactamente las del contrato** (sin `tripId`, `caption`, `lat`, `lng`); exclusiones (borrada, bloqueada, dueño que se salió); el archivo sirve con permiso y da 403/404 sin él; el feed revelado trae `featuredByMe` y `featureBlocked`, y todo ítem trae `author.userId` correcto.
- [ ] **Step 2:** verificar que fallan. **Step 3:** implementar. **Step 4:** `npm test`, `npm run typecheck`, `npm run openapi`, `npm run seed -- --reset` contra un server local en otro puerto (no el 8787 del usuario) y chequear las destacadas de Juani.
- [ ] **Step 5:** commit "Destacadas: elegir fotos para el perfil" y PR a `feature/perfil-amigo` (en español; **no mergear**).

---

## Parte 2 — App (repo `rollo-app/mobile`, rama `feature/destacadas`)

### Task D1: Contrato, acciones y hooks

**Files:**
- Modify: `src/api/schema.d.ts` (`API_SPEC=../backend/openapi.json npm run api:generate`, backend en `feature/destacadas` con C1–C2), `src/features/media/revealed.ts` (`featuredByMe`, `featureBlocked`, y `isMine` si hace falta para saber si sos el autor)
- Create: `src/features/featured/actions.ts`, `src/features/featured/use-featured.ts`, `src/features/featured/use-toggle-featured.ts`, `src/features/featured/__tests__/actions.test.ts`, `src/features/featured/__tests__/use-toggle-featured.test.tsx`; `src/features/profile/actions.ts` suma `fetchUser(userId)` y `profileVisibility` en `updateProfile`

**Interfaces:**
- Produces: `featureMedia(mediaId)`, `unfeatureMedia(mediaId)`, `blockFeature(mediaId)`, `unblockFeature(mediaId)`, `fetchFeatured(userId): Promise<FeaturedPhoto[]>`, `export type FeaturedPhoto`; `featuredKey(userId) = ["featured", userId] as const`, `useFeatured(userId)`; `useToggleFeatured()` → `{ toggle(photo: { id: string; featuredByMe: boolean }, tripId: string): Promise<void>, pending: Set<string>, error: string | null }` (optimista sobre la key del feed del rollo, revierte si falla, ignora un segundo toque mientras está pendiente, invalida `featuredKey(me.id)`); `fetchUser(userId)` y `userKey(userId) = ["user", userId] as const`, `useUser(userId)`.

- [ ] **Step 1:** tests: cada acción pega al método y la ruta correctos; `useToggleFeatured` es optimista, revierte con el error del server (p. ej. el del tope) y no manda dos pedidos si se toca dos veces.
- [ ] **Step 2:** verificar que fallan. **Step 3:** implementar. **Step 4:** `npm test`, `npm run typecheck` verdes. **Step 5:** commit "Destacadas: cliente y hooks".

### Task D2: Destacar desde la galería

**Files:**
- Modify: `src/features/gallery/photo-viewer.tsx` (pill "Destacar"/"Destacada" con `star`/`star.fill` en `styles.actions`, solo en fotos; si sos el autor, una pill `ellipsis` con `MenuView` y la acción "No dejar que la destaquen"/"Dejar que la destaquen"), `src/features/gallery/gallery-screen.tsx` (mantener apretada una miniatura abre un `MenuView` con "Destacar en tu perfil"/"Sacar de tu perfil"; no en modo selección ni en videos)
- Test: `__tests__/gallery.test.tsx`

**Interfaces:**
- Consumes: D1 (`useToggleFeatured`, `blockFeature`, `unblockFeature`, los campos nuevos de `RevealedPhoto`).

- [ ] **Step 1:** tests: la pill cambia de "Destacar" a "Destacada" y llama `featureMedia`; tocarla de nuevo llama `unfeatureMedia`; el error del server (tope o bloqueada) se ve inline en el panel del visor; los videos no tienen la pill; el autor ve "No dejar que la destaquen" y llama `blockFeature`; el menú de la grilla destaca y saca; en modo selección no hay menú.
- [ ] **Step 2:** verificar que fallan. **Step 3:** implementar (el cobalto solo en la estrella activa). **Step 4:** verdes. **Step 5:** commit "Galería: destacar fotos en tu perfil".

### Task D3: Fotos y Mapa del perfil

**Files:**
- Modify: `src/features/profile/profile-showcase.tsx` (props nuevas), `app/(tabs)/me/index.tsx`
- Create: `src/features/featured/featured-grid.tsx` (grilla de 3 columnas, miniatura con `mediaSource(thumbPath, token)` y thumbhash; si la foto no la sacó el dueño del perfil (`author` no es null), arriba de la miniatura va un iconito con la foto de perfil del autor: el `Avatar` existente de 22 con borde de 1.5 del color de fondo, en la esquina inferior izquierda con 4 de margen; sin foto, su inicial sobre su color como en el resto de la app; `accessibilityLabel` "Foto de <nombre>". Vale igual en tu perfil y en el de otros, y también en el visor de destacadas), `src/features/featured/featured-map.tsx` (MapLibre con un círculo por zona y la cantidad; sin pins exactos; encuadra todas las zonas), `src/features/featured/zones.ts` + test (agrupa fotos por zona y cuenta), `src/features/featured/featured-viewer.tsx` + `app/featured/[userId]/[mediaId].tsx` (visor a pantalla completa con paginado como el de la galería, autor si no es el dueño, sin caption ni rollo; en tu perfil, pill "Sacar de tu perfil"), registro de la ruta en `app/_layout.tsx` y `src/test/routes.ts`
- Test: `__tests__/profile.test.tsx`, `__tests__/featured-viewer.test.tsx`

**Interfaces:**
- Consumes: D1 (`useFeatured`, `FeaturedPhoto`, `unfeatureMedia`), `mediaSource`/token de `src/features/media/revealed.ts`, el estilo de mapa que ya usa `roll-map.tsx`.
- Produces: `ProfileShowcase(props: { own: boolean; userId: string; canSee: boolean })` (sin permiso no pide nada y muestra "Este perfil es privado"); los estados vacíos actuales quedan para cuando la lista está vacía.

- [ ] **Step 1:** tests: `zones.ts` agrupa y cuenta, e ignora `zone: null`; Perfil propio y perfil de otro muestran la grilla con las destacadas y el iconito del autor (con `accessibilityLabel` "Foto de <nombre>") solo en las que no sacó el dueño; tocar una abre el visor; "Sacar de tu perfil" la quita de la grilla; el segmento Mapa monta el mapa con tantas zonas como corresponde (mock de MapLibre); `canSee={false}` muestra "Este perfil es privado" y no llama `fetchFeatured`; error de carga con "Reintentar".
- [ ] **Step 2:** verificar que fallan. **Step 3:** implementar. **Step 4:** verdes. **Step 5:** commit "Perfil: fotos destacadas y mapa por zonas".

### Task D4: Perfil de cualquier usuario, Ajustes, docs y PR

**Files:**
- Modify: `src/features/friends/friend-profile-screen.tsx` → pasa a ser el perfil de un usuario (usa `useUser(id)` siempre y `useFriend(id)` solo si `isFriend`), `app/(tabs)/friends/user/[id].tsx`; Create: `app/user/[id].tsx` (misma pantalla, push sobre el stack raíz, para llegar desde fuera de la tab Amigos), registro en `app/_layout.tsx` y `src/test/routes.ts`; `src/features/roll/roll-people.tsx` (tocar un miembro que no sos vos abre `/user/<userId>`, con el `userId` que ya trae cada `Member`); `src/features/map/pin-card.tsx` (la tarjeta del carrusel: tocar la miniatura hace lo de hoy —abrir la foto si está revelada—; tocar el avatar o el nombre del autor abre `/user/<author.userId>`, o tu Perfil si sos vos), `src/features/feed/feed-row.tsx` (avatar y nombre → mismo destino; el resto de la fila sigue llevando al mapa), `src/features/gallery/photo-viewer.tsx` (la fila del autor en el panel → mismo destino), `src/features/profile/settings-screen.tsx` (switch "Perfil público" + footnote, `PATCH /me`), `CLAUDE.md`
- Test: `__tests__/friend-profile.test.tsx`, `__tests__/profile.test.tsx`, `__tests__/screens.test.tsx` (o donde estén los de miembros)

**Interfaces:**
- Consumes: D1 (`useUser`, `updateProfile` con `profileVisibility`), D3 (`ProfileShowcase` con `canSee`).

- [ ] **Step 1:** tests: desde "En el rollo" tocar un miembro abre su perfil; no amigo y privado → nombre, @, foto y "Este perfil es privado", sin "Rollos en común", "Sumar a un rollo" ni "Borrar amigo"; no amigo y público → sus destacadas y su descripción, sin acciones de amigo; amigo → como hoy más sus destacadas; tocarte a vos mismo no navega; en la tarjeta del mapa, tocar la miniatura de una foto revelada abre la foto y tocar el avatar o el nombre abre `/user/<userId>` (sin abrir la foto), y lo mismo con el avatar/nombre en una fila del Feed y en el visor; el switch de Ajustes llama `updateProfile({ profileVisibility: "public" })` y muestra el error inline si falla.
- [ ] **Step 2:** verificar que fallan. **Step 3:** implementar. **Step 4:** verdes; actualizar CLAUDE.md (destacadas, visibilidad, perfil de un usuario, conteo de tests) y sacar "fotos destacadas" de "A futuro".
- [ ] **Step 5:** commit "Perfil de un usuario y perfil público", push y PR a `feature/tab-amigos` (en español, **no mergear**, que diga que depende de la PR del backend y qué probar en el iPhone).
