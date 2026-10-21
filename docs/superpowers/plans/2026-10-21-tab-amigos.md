# Tab Amigos y Feed dentro del Mapa — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** la barra pasa a Rollo · Mapa · Cámara · **Amigos** · Perfil (antes y después del revelado). El Feed se ve adentro de la tab Mapa con un control "Mapa | Feed", Amigos es una tab con la lista y el perfil de cada amigo ("Rollos en común", "Sumar a un rollo") y, al crear un rollo, se ofrece sumar amigos.

**Architecture:** el backend suma `GET /friends/{userId}` (amigo + rollos en común). En la app, la tab `map` compone el mapa y el feed, que se mudan de `app/` a sus features sin cambiar comportamiento. La tab `feed` desaparece y en su lugar entra `(tabs)/friends`, que reemplaza a la ruta raíz `app/friends.tsx`.

**Tech Stack:** Expo SDK 58, Expo Router (`NativeTabs`), TanStack Query, `@expo/ui` (`SegmentedControl`), `@react-native-menu/menu` (`MenuView`), jest-expo; backend Hono + D1 + zod-openapi + vitest.

**Spec:** este documento (el diseño se decidió en la conversación del 2026-10-21 y no tiene spec aparte). Antes de empezar, cada worker lee el CLAUDE.md de su repo y `docs/superpowers/specs/2026-10-21-amigos-design.md`.

## Global Constraints

- **Privacidad:** un rollo solo existe para sus miembros. Nada de esta feature muestra a alguien un rollo ajeno: ni fotos, ni nombre, ni que existe. "Rollos en común" = rollos donde **los dos** son miembros activos (`removed_at IS NULL AND left_at IS NULL`).
- La cámara queda al centro: la barra tiene siempre 5 triggers en este orden: `roll`, `map`, `camera`, `friends`, `me`.
- Descripción del perfil: hasta **150** caracteres y **3** renglones; opcional.
- Ícono de la tab Amigos: SF `person.2` / `person.2.fill`, md `group`, label oculto `"Amigos"`.
- El segmento "Feed" existe solo antes del revelado (hoy la tab Feed se oculta al revelarse; se mantiene esa regla).
- Cobalto (`colors.tint`) solo en acciones y selección: segmento elegido, filtros activos, "Sumar a un rollo", "Invitar a un amigo".
- Rutas: `/friends` = lista (tab); `/friends/user/<id>` = perfil de un amigo; `/friends/<CODE>` sigue siendo el link de amistad (`app/friends/[code].tsx`, fuera del grupo protegido). Nunca una ruta dinámica de un segmento bajo `(tabs)/friends` (chocaría con `[code]`).
- Código, tests y comentarios en inglés; textos de UI en rioplatense con voseo; commits y PRs en español con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- TDD; en Testing Library 14 `await fireEvent...`. No se renombra nada persistido en el celular (claves de SecureStore, keys de Query).

## Review Focus

- Pasar de Mapa a Feed y volver **no remonta el mapa** (sigue la cámara donde estaba, MapLibre no recarga el estilo). (A2)
- Tocar una fila del Feed pasa al segmento Mapa y enfoca ese pin, como hoy hace `router.navigate("/map", { focus })`. (A2)
- Sin rollos: Mapa muestra `NoRollYet`, pero **Amigos funciona igual** (es global). (A3)
- `/friends/K7M2QX9A` sigue abriendo el link de amistad y `/friends` abre la tab. (A3)
- Perfil de alguien que te borró como amigo (404) o "Sumar a un rollo" en un rollo que se reveló mientras tanto (409): mensaje inline, sin crash ni pantalla vacía. (A4)

---

## Parte 1 — Backend (repo `rollo-app/backend`, rama `feature/perfil-amigo` desde `develop`)

### Task B1: Perfil de un amigo con rollos en común

**Files:**
- Modify: `src/routes/friends.ts` (ruta nueva), `src/schemas.ts` (`CommonTripSchema`, `FriendProfileSchema`), `openapi.json` (regenerado con `npm run openapi`)
- Test: `test/friends.test.ts`

**Interfaces:**
- Produces: `GET /friends/{userId}` (sesión) → 200 `{ friend: Friend, commonTrips: CommonTrip[] }` con `CommonTrip = { id: string (uuid), name: string, startsAt: number, endsAt: number, revealed: boolean }`, ordenado por `startsAt` descendente. 404 `"No es tu amigo"` si no hay amistad (también para un id inexistente o el propio).

- [ ] **Step 1:** tests en `friends.test.ts`: (a) dos amigos con un rollo compartido y otro rollo de solo uno → `commonTrips` trae solo el compartido; (b) si uno se salió (`left_at`) o el admin lo sacó (`removed_at`), ese rollo no aparece; (c) no amigos, id inexistente y el propio id → 404 con el mismo mensaje; (d) sin sesión → 401; (e) `revealed` coincide con lo que devuelve `GET /me/trips` para ese rollo; (f) orden por `startsAt` descendente.
- [ ] **Step 2:** `npm test -- test/friends.test.ts`; esperado: fallan (404 de ruta inexistente).
- [ ] **Step 3:** implementar la ruta en `friends.ts` reusando `FriendParams`, `publicFriend` y el mismo cálculo de `revealed` que `/me/trips` en `src/routes/me.ts`.
- [ ] **Step 4:** `npm test`, `npm run typecheck`, `npm run openapi`; esperado: verde y `openapi.json` con la ruta.
- [ ] **Step 5:** commit "Amigos: perfil de un amigo con rollos en común" y PR a `develop` (en español; **no mergear**).

---

### Task B2: Descripción del perfil

**Files:**
- Create: `migrations/<siguiente número>_user_bio.sql` (`ALTER TABLE users ADD COLUMN bio TEXT`)
- Modify: `src/schemas.ts` (`bio` en `UserSchema`, `FriendSchema` y `UpdateProfileSchema`), `src/routes/me.ts` (`GET /me` y `PATCH /me`), `src/routes/friends.ts` (`publicFriend` y las consultas que lo alimentan), `openapi.json`, `CLAUDE.md` del backend
- Test: `test/me.test.ts`, `test/friends.test.ts`

**Interfaces:**
- Produces: `bio: string | null` en `User` (`GET /me`), en `Friend` (lista y `GET /friends/{userId}`) y en el body de `PATCH /me` (opcional). Se guarda con `trim`; vacío → `null`; más de **150** caracteres → 400 `"La descripción puede tener hasta 150 caracteres"`. Los saltos de línea se permiten (máximo 3; más → mismo 400 con `"La descripción puede tener hasta 3 renglones"`).

- [ ] **Step 1:** tests: (a) `PATCH /me { bio: "  Viajando por el sur  " }` guarda `"Viajando por el sur"` y `GET /me` la devuelve; (b) `bio: ""` la borra (`null`); (c) 151 caracteres → 400 con el mensaje; (d) 4 renglones → 400; (e) `PATCH /me` sin `bio` no la toca; (f) `GET /friends` y `GET /friends/{userId}` traen la `bio` del amigo.
- [ ] **Step 2:** correr y verificar que fallan.
- [ ] **Step 3:** implementar (migración nueva, nunca editar una aplicada; `npm run db:migrate:local`).
- [ ] **Step 4:** `npm test`, `npm run typecheck`, `npm run openapi`; esperado: verde.
- [ ] **Step 5:** commit "Perfil: descripción" en la misma rama `feature/perfil-amigo` y push (la PR #15 la suma).

---

## Parte 2 — App (repo `rollo-app/mobile`, rama `feature/tab-amigos`)

### Task A1: Mudar el mapa y el feed a sus features (sin cambiar comportamiento)

**Files:**
- Create: `src/features/map/roll-map.tsx` (todo `MapBody` de `app/(tabs)/map/index.tsx` con sus estilos y helpers), `src/features/feed/feed-list.tsx` (todo `FeedList` de `app/(tabs)/feed/index.tsx`)
- Modify: `app/(tabs)/map/index.tsx` y `app/(tabs)/feed/index.tsx` quedan como rutas finas (`hasNoTrips` → `NoRollYet`, si no el componente)

**Interfaces:**
- Produces: `export function RollMap(): JSX.Element` y `export function FeedList(props: { onOpenOnMap?: (item: MapItem) => void; contentInsetTop?: number }): JSX.Element`. Sin `onOpenOnMap`, el feed hace lo de hoy (`router.navigate({ pathname: "/map", params: { focus } })`); con `contentInsetTop`, la lista suma ese padding arriba.

- [ ] **Step 1:** mover el código tal cual; los únicos cambios son exports, imports y las dos props nuevas de `FeedList`.
- [ ] **Step 2:** `npm test` y `npm run typecheck`; esperado: verde **sin tocar ningún test** (`map.test.tsx` y `feed.test.tsx` pasan igual).
- [ ] **Step 3:** commit "Mapa y Feed: la lógica pasa a sus features".

### Task A2: Feed dentro de la tab Mapa

**Files:**
- Create: `src/features/map/map-filters.ts` (lógica pura del menú de filtros) + `src/features/map/__tests__/map-filters.test.ts`, `src/features/map/activity-screen.tsx`
- Modify: `src/features/map/roll-map.tsx`, `app/(tabs)/map/index.tsx`, `app/(tabs)/_layout.tsx` y `src/features/trips/tabs.ts` (sacar el trigger `feed` y `feedHidden`), `src/test/routes.ts`
- Delete: `app/(tabs)/feed/` (las dos rutas)
- Test: `__tests__/feed.test.tsx` (pasa a `initialUrl: "/map?view=feed"`), `__tests__/map.test.tsx`, `__tests__/welcome.test.tsx`, `src/features/trips/__tests__/tabs.test.ts` (sin `feedHidden`)

**Diseño:** debajo del header (que sigue siendo `TripSwitcher`) va **una sola fila**: `SegmentedControl` `["Mapa", "Feed"]` y, solo en Mapa, la pastilla de filtros. El "Todo | Hoy" de hoy desaparece como segmentado y pasa adentro del menú: el menú tiene la acción "Solo hoy" (estado on/off, solo si hay día de hoy) y la lista de personas ("Todos" + miembros). El estado de la vista vive en el parámetro de ruta `view` (`"map"` por defecto, o `"feed"`). El mapa **siempre está montado**; en Feed, la lista se dibuja encima con fondo opaco y `contentInsetTop` = alto de la fila. Revelado: no hay segmentado y la vista es siempre Mapa.

**Interfaces:**
- Consumes: A1 (`RollMap`, `FeedList`).
- Produces: `filterLabel(f: { today: boolean; authorName: string | null }): string` → `"Filtros"` | `"Hoy"` | `"Cami"` | `"Hoy · Cami"`; `filterActive(f): boolean`. `ActivityScreen` lee `view` y `focus` con `useLocalSearchParams`; `onOpenOnMap` hace `router.setParams({ view: "map", focus: item.id })`.

- [ ] **Step 1:** tests: `map-filters.test.ts` con los cuatro labels y `filterActive`; en `map.test.tsx`: (a) se ve el segmentado "Mapa | Feed" y tocar "Feed" muestra `feed-list`; (b) volver a "Mapa" no vuelve a montar el mapa (el mock de MapLibre cuenta montajes: 1); (c) el menú de filtros con "Solo hoy" filtra igual que el "Hoy" de antes (mover los tests de `scope` existentes); (d) con el rollo revelado no hay segmentado. En `feed.test.tsx`: todos los casos con `/map?view=feed`, y tocar una fila deja la vista en Mapa con el pin enfocado (`camera.flyTo` llamado, como el test actual de `focus`).
- [ ] **Step 2:** `npm test -- __tests__/map.test.tsx __tests__/feed.test.tsx src/features/map`; esperado: fallan.
- [ ] **Step 3:** implementar `map-filters.ts`, sacar el `SegmentedControl` de scope de `RollMap` y meter "Solo hoy" en su `MenuView` (con `filterLabel` en la pastilla, cobalto si `filterActive`), crear `ActivityScreen` y usarlo en la ruta; borrar la tab `feed`.
- [ ] **Step 4:** `npm test` y `npm run typecheck`; esperado: verde.
- [ ] **Step 5:** commit "Mapa: el Feed se ve adentro, con Mapa | Feed".

### Task A3: Tab Amigos

**Files:**
- Create: `app/(tabs)/friends/_layout.tsx` (Stack, `index` con título "Amigos" y `headerLargeTitle`), `app/(tabs)/friends/index.tsx` (ruta fina con `FriendsScreen`)
- Modify: `app/(tabs)/_layout.tsx` (trigger `friends` entre `camera` y `me`, ícono de Global Constraints, siempre visible), `src/features/friends/friends-screen.tsx` (tocar un amigo hace `router.push(\`/friends/user/${id}\`)` en vez de confirmar el borrado), `app/(tabs)/me/index.tsx` (sacar la sección "Amigos" y `useFriends`), `app/_layout.tsx` (sacar `Stack.Screen name="friends"`), `src/test/routes.ts`
- Delete: `app/friends.tsx`
- Test: `__tests__/friends.test.tsx`, `__tests__/friend-link.test.tsx`, `__tests__/screens.test.tsx`

**Interfaces:**
- Consumes: A2 (la barra sin `feed`).
- Produces: la ruta `/friends` en la tab; A4 registra `/friends/user/[id]`.

- [ ] **Step 1:** tests: (a) la barra tiene el trigger "Amigos" y abre `/friends` con la lista (adaptar `friends.test.tsx`: ya no se entra desde Perfil); (b) Perfil ya no muestra "Amigos"; (c) sin rollos, `/friends` muestra la lista e "Invitar a un amigo" (no `NoRollYet`); (d) con el rollo revelado la tab Amigos sigue estando; (e) `/friends/K7M2QX9A` abre el link de amistad (los tests de `friend-link.test.tsx` siguen pasando sin cambios en su `initialUrl`); (f) tocar un amigo navega a `/friends/user/<id>` (por ahora alcanza con `toHavePathname`). El test del borrado desde la lista se mueve a A4.
- [ ] **Step 2:** verificar que fallan.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** `npm test` y `npm run typecheck` verdes.
- [ ] **Step 5:** commit "Amigos: tab propia en la barra".

### Task A3b: Perfil propio (armazón), Ajustes y descripción

**Files:**
- Create: `src/features/profile/profile-header.tsx`, `src/features/profile/profile-showcase.tsx`, `src/features/profile/settings-screen.tsx` (todo lo que hoy muestra `app/(tabs)/me/index.tsx`), `app/settings.tsx` (ruta fina), `__tests__/profile.test.tsx`
- Modify: `src/api/schema.d.ts` (`API_SPEC=../backend/openapi.json npm run api:generate`, backend en `feature/perfil-amigo` con B1 y B2), `app/(tabs)/me/index.tsx` y `app/(tabs)/me/_layout.tsx`, `src/features/profile/profile-form.tsx` (campo "Descripción"), `app/edit-profile.tsx`, `app/_layout.tsx` y `src/test/routes.ts` (ruta `settings`, push con título "Ajustes"), tests que hoy entran a Cerrar sesión / Borrar cuenta / Mapa sin señal / Desarrollo por Perfil

**Diseño:** Perfil es lo que los demás ven de vos. Arriba `ProfileHeader` centrado: `Avatar` 72, nombre, @ y la descripción debajo (texto normal, centrado, solo si hay). En el header del stack, a la derecha, un botón con SF `gearshape` (`accessibilityLabel` "Ajustes") que hace push a `/settings`. Debajo, `ProfileShowcase`: `SegmentedControl` `["Fotos", "Mapa"]` y, por ahora, solo el estado vacío de cada segmento (las fotos destacadas son otro plan): propio → Fotos "Cuando se revele un rollo, vas a poder elegir tus mejores fotos para mostrar acá." y Mapa "Acá vas a ver las zonas donde sacaste tus fotos destacadas."; de un amigo → Fotos "Todavía no destacó fotos." y Mapa "Todavía no hay lugares.". Nada de MapLibre todavía. "Descripción" va solo en Editar perfil (no en "Completá tu perfil"): campo multilínea con contador `n/150`, guarda con el mismo `PATCH /me` del formulario.

**Interfaces:**
- Consumes: B2 (`bio`), A3 (Perfil ya sin la fila Amigos).
- Produces: `ProfileHeader(props: { id: string; name: string; username: string | null; avatarUrl: string | null; bio: string | null })` y `ProfileShowcase(props: { own: boolean })`, que A4 reusa para el perfil de un amigo.

- [ ] **Step 1:** tests: (a) Perfil muestra foto, nombre, @ y descripción, y no muestra "Cerrar sesión"; (b) sin descripción no hay texto vacío; (c) el engranaje abre `/settings` con Editar perfil, Mapa sin señal, Cerrar sesión y Borrar cuenta (mover ahí los tests existentes de esas filas); (d) el segmentado cambia entre los dos estados vacíos; (e) Editar perfil guarda la descripción (`updateProfile` llamado con `bio`), muestra el contador y el error del server inline; (f) "Completá tu perfil" no muestra "Descripción".
- [ ] **Step 2:** verificar que fallan.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** `npm test` y `npm run typecheck` verdes.
- [ ] **Step 5:** commit "Perfil: lo que ven los demás, Ajustes aparte y descripción".

### Task A4: Perfil de un amigo

**Files:**
- Modify: `src/features/friends/actions.ts` (el contrato ya se regeneró en A3b), `src/features/friends/__tests__/actions.test.ts`
- Create: `src/features/friends/use-friend.ts`, `src/features/friends/friend-profile-screen.tsx`, `src/features/friends/addable-trips.ts` + `__tests__/addable-trips.test.ts`, `app/(tabs)/friends/user/[id].tsx` (ruta fina)
- Modify: `app/(tabs)/friends/_layout.tsx` (pantalla `user/[id]`, título = nombre del amigo), `src/test/routes.ts`
- Test: `__tests__/friend-profile.test.tsx`

**Diseño (lista agrupada, nada de cards):** arriba `ProfileHeader` con los datos del amigo (incluida su `bio`) y `ProfileShowcase own={false}` (de A3b), y debajo las secciones. Sección "Rollos en común": una fila por rollo con nombre y fechas (con el formato de fechas que ya usa el selector de rollos), y "Revelado" como detalle si corresponde; tocarla hace `setActiveTripId(id)` + `router.navigate("/roll")`. Vacío: `Footnote` "Todavía no tienen rollos en común.". Fila "Sumar a un rollo" (cobalto) con `MenuView` de los rollos donde se lo puede sumar; si no hay ninguno, la fila no aparece. Al final, "Borrar amigo" (`tone="danger"`) con el `Alert` que hoy está en la lista; al confirmar, vuelve a `/friends`.

**Interfaces:**
- Consumes: B1 (`GET /friends/{userId}`), A3b (`ProfileHeader`, `ProfileShowcase`), `addFriendsToTrip(tripId, friendIds)` y `removeFriend(userId)` existentes, `useActiveTrip().trips`, `setActiveTripId` de `@/storage/active-trip`.
- Produces: `fetchFriend(userId: string): Promise<{ friend: Friend; commonTrips: CommonTrip[] }>` y `export type CommonTrip` en `actions.ts`; `friendKey(userId) = ["friends", userId] as const` y `useFriend(userId)` en `use-friend.ts`; `addableTrips(myTrips: TripSummary[], common: CommonTrip[]): TripSummary[]` (con `type TripSummary = Schemas["TripSummary"]`, el tipo de `useActiveTrip().trips`) = tus rollos no revelados que no están en común, en el orden de `myTrips`.

- [ ] **Step 1:** tests: `actions.test.ts` → `fetchFriend` hace `GET /friends/<id>`; `addable-trips.test.ts` excluye revelados y comunes; `friend-profile.test.tsx` (mockeando `@/features/friends/actions`): (a) muestra nombre, @ y los rollos en común; (b) tocar un rollo lo deja activo y abre `/roll`; (c) "Sumar a un rollo" → elegir uno llama `addFriendsToTrip(tripId, [id])` y, con `added`, el rollo aparece en común (refetch de `friendKey`); con `unavailable` o error (409), mensaje inline "No se pudo sumar a <nombre>" o el del server; (d) sin rollos para sumar, la fila no está; (e) 404 → `ErrorText` "No es tu amigo" y nada más; (f) "Borrar amigo" pide confirmación, llama `removeFriend` y vuelve a `/friends` sin esa persona (test movido de A3).
- [ ] **Step 2:** verificar que fallan.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** `npm test` y `npm run typecheck` verdes. (El job `contract` del CI va a quedar en rojo hasta que se mergee B1.)
- [ ] **Step 5:** commit "Amigos: perfil de un amigo con rollos en común".

### Task A5: Sumar amigos al crear un rollo, docs y PR

**Files:**
- Modify: `app/create.tsx` (después de crear), `CLAUDE.md`
- Test: `__tests__/screens.test.tsx` (o donde estén los tests de crear rollo)

**Interfaces:**
- Consumes: `friendsKey` y `fetchFriends` de `@/features/friends`, la sheet `/add-friends` existente (usa el rollo activo, y `createTrip` ya lo deja activo).

- [ ] **Step 1:** tests: (a) crear un rollo teniendo amigos termina en `/add-friends` encima de `/roll`; (b) sin amigos, termina en `/roll` como hoy; (c) si cargar los amigos falla, también termina en `/roll` (el rollo ya se creó: no se muestra error).
- [ ] **Step 2:** verificar que fallan.
- [ ] **Step 3:** después de `router.dismissTo("/roll")`, `queryClient.ensureQueryData({ queryKey: friendsKey, queryFn: fetchFriends })` dentro de un `try`; si hay ≥ 1 amigo, `router.push("/add-friends")`.
- [ ] **Step 4:** `npm test` y `npm run typecheck` verdes. Actualizar CLAUDE.md: barra Rollo · Mapa · Cámara · Amigos · Perfil (y después del revelado Galería · Mapa · Presentación · Amigos · Perfil), Feed adentro del Mapa, Amigos como tab con perfil y rollos en común, Perfil = lo que ven los demás (encabezado con descripción, Fotos | Mapa) con Ajustes detrás del engranaje, el principio de privacidad de los rollos, y el conteo de tests.
- [ ] **Step 5:** commit "Crear rollo: ofrecer sumar amigos" y PR a `develop` (en español, **no mergear**, que diga que depende de la PR del backend); reportar qué probar en el iPhone.

## Fuera de alcance (anotado para después)

- Badge de actividad nueva en el ícono del Mapa (hoy no hay registro de "visto").
- "Tomi te sumó a Bariloche" (usa `added_by_user_id`, ya guardado) y notificaciones push.
- Feeds o perfiles públicos: solo si el grupo decide publicar un rollo.
- **Fotos destacadas en tu perfil** (idea del usuario, 2026-10-21): de los rollos revelados en los que estás, elegís fotos que se ven en tu perfil sin el nombre del rollo (solo el autor si no sos vos) y en un mapa de dónde estuviste. Se ven en el perfil de amigo de A4, que es su lugar natural. Pendientes de diseño: consentimiento del autor cuando la foto no es tuya, ubicación aproximada con un radio grande (zona o ciudad, nunca la coordenada exacta; confirmado por el usuario) y quién la ve (amigos primero).
