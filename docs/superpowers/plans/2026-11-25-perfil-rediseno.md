# Rediseño del encabezado del Perfil — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encabezado del Perfil (el tuyo y el de otro) centrado, con la línea "8 rollos · 34 fotos · 12 amigos" y los conteos nuevos del backend.

**Architecture:** El backend suma `rollCount` y `featuredCount` (`null` sin `canSee`) a `GET /users/{userId}`. En la app, un formateador puro arma las partes de la línea; `ProfileHeader` pasa a centrado y recibe `stats` en vez de `friends`; tu Perfil se muda a `src/features/profile/me-screen.tsx` y lee `useUser(me.id)` para los conteos.

**Tech Stack:** Backend Hono + zod-openapi + D1, tests con vitest (`cloudflare:workers`). App Expo SDK 58 / RN 0.88, Expo Router, TanStack Query, Jest + `expo-router/testing-library`.

**Spec:** `docs/superpowers/specs/2026-11-25-perfil-rediseno-design.md` (leerlo antes de cada tarea).

## Global Constraints

- Ramas: app `feature/perfil-rediseno` (worktree `/Users/juanifraga/Desktop/Rollo/mobile-perfil`, ya existe). Backend: **misma rama** `feature/perfil-rediseno` desde `origin/develop` en un worktree nuevo `/Users/juanifraga/Desktop/Rollo/backend-perfil`. No tocar `mobile`, `backend` (checkouts compartidos), ni los worktrees `*-galeria`, `*-portada`, `*-contador`.
- Tests de la app: solo los relacionados y siempre `--maxWorkers=2` (`npx jest <ruta> --maxWorkers=2`). Nunca la suite completa.
- TDD: test primero, verlo fallar, código mínimo.
- Código y descripciones de tests en inglés; textos visibles, commits y PRs en español rioplatense.
- Textos exactos: "rollo"/"rollos", "foto"/"fotos", "amigo"/"amigos", "N amigo(s) en común", "Todavía no tenés amigos". Miles con punto ("1.284"). Separador " · ".
- Sin cobalto (`colors.tint`) en la línea de números: cifras `colors.label` semibold (`fontWeight: "600"`), palabras `colors.secondaryLabel`.
- Nada de `{string && <X />}`: usar `!!x &&` o ternario.
- Cada commit termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Conteos con datos viejos en tu Perfil:** destacás o sacás una foto y "fotos" tiene que cambiar al volver al Perfil. Se resuelve usando el largo de la grilla ya cargada (`useFeatured`) antes que `featuredCount` (Task 4, test "prefers the loaded featured list over featuredCount").
- **API vieja o campos ausentes:** un build con `schema.d.ts` nuevo contra un backend sin los campos (o `undefined` en la caché persistida) no debe romper ni mostrar "undefined rollos": tratar `undefined` como `null` (Task 2, test "treats missing counts as null").
- **Perfil privado:** rollos y fotos nunca aparecen sin `canSee`, aunque el server mandara un número (Task 2, test "drops rolls and photos without canSee").
- **Bloqueo:** con `blockedByMe` el perfil de otro sigue mostrando solo encabezado + "Desbloquear"; el server da `canSee: false`, así que la línea queda solo con amigos (Task 1, test "returns null counts when blocked").
- **Texto grande / nombre de 3 renglones centrado / @ largo + FIRST EDITION:** no se superpone ni corta la insignia (Task 3, fixtures de break-ui y test "wraps the handle row").

---

### Task 1: Backend — `rollCount` y `featuredCount` en `GET /users/{userId}`

**Files:**
- Create worktree: `git -C /Users/juanifraga/Desktop/Rollo/backend fetch origin develop && git -C /Users/juanifraga/Desktop/Rollo/backend worktree add -b feature/perfil-rediseno ../backend-perfil origin/develop`, después `npm ci` ahí.
- Modify: `src/modules/users/users.repository.ts` (nueva `rollCount`)
- Modify: `src/modules/featured/featured.repository.ts` (nueva `countVisibleFeatured`)
- Modify: `src/modules/users/users.service.ts` (`UserProfile` + `getProfile`)
- Modify: `src/modules/users/users.schemas.ts` (`UserProfileSchema`)
- Modify: `src/modules/users/users.controller.ts` (pasar los campos)
- Test: `test/users.test.ts` (dentro de `describe("GET /users/{userId}")`)

**Interfaces:**
- Produces (contrato): `UserProfile.rollCount: number | null` y `UserProfile.featuredCount: number | null`, ambos `z.number().int().nullable()` con descripción ("Revealed rolls where this user is an active member; null without canSee" / "Featured photos you can see on this profile; null without canSee").
- Produces (repo): `rollCount(db: D1Database, userId: string, now: number): Promise<number>` y `countVisibleFeatured(db: D1Database, viewerId: string, ownerId: string, now: number): Promise<number>`.

- [ ] **Step 1: Tests que fallan** en `test/users.test.ts` (usar los helpers de `test/helpers.ts` y el `revealedTrip`/`feature` de `test/featured.test.ts` como modelo; si hace falta, copiar esos dos helpers al archivo):
  - `"counts revealed rolls where the owner is an active member"`: owner en 1 rollo revelado + 1 sin revelar → `rollCount === 1`.
  - `"does not count a roll the owner left or was removed from"`: se sale/lo sacan del revelado → `0`.
  - `"counts an archived roll"`: owner archiva el rollo revelado (`POST /trips/{id}/archive` o el endpoint que use `archive.test.ts`) → `1`.
  - `"does not count a deleted roll"`: el creador lo borra (`DELETE /trips/{id}`) → `0`.
  - `"counts the featured photos the viewer can see"`: owner destaca 2 fotos → amigo que mira ve `featuredCount === 2`; tras archivar una de ellas su autor → `1`.
  - `"returns null counts when the viewer cannot see the profile"`: desconocido + perfil privado → `rollCount === null && featuredCount === null`; `friendCount` sigue numérico.
  - `"returns null counts when blocked"`: bloqueo en cualquier dirección → ambos `null`.
  - `"returns counts on your own profile"`: `GET /users/{me}` → números.

- [ ] **Step 2: Correr y ver que fallan**
  Run: `npx vitest run test/users.test.ts`
  Expected: FAIL (`rollCount` undefined).

- [ ] **Step 3: Implementar**
  - `rollCount`: `COUNT(*)` de `members mb JOIN trips t ON t.id = mb.trip_id WHERE mb.user_id = ? AND mb.removed_at IS NULL AND mb.left_at IS NULL AND (t.revealed_at IS NOT NULL OR t.reveal_at <= ?)`. Sin chequear `deleted_trips`: borrar un rollo borra sus filas de `trips` y `members` (`deleteTripStatements`). No filtrar `archived_at`.
  - `countVisibleFeatured`: `SELECT COUNT(*) FROM ${VISIBLE_FROM} JOIN users u ON u.id = author.user_id WHERE ${VISIBLE_WHERE} AND f.user_id = ? AND ${hiddenMediaSql("m", "author")}` con los mismos binds que `listVisibleFeatured` salvo el del `liked_by_me` (`now, ownerId, viewerId, viewerId`). Mismo `FROM/WHERE` que el listado para que nunca difieran.
  - `getProfile`: con `canSee`, `Promise.all([repo.rollCount(db, owner.id, now), countVisibleFeatured(db, viewerId, owner.id, now)])`; si no, ambos `null`. `now = Date.now()`.

- [ ] **Step 4: Correr y ver que pasan** — `npx vitest run test/users.test.ts test/featured.test.ts` → PASS. Después `npm run typecheck` (o el script equivalente del backend) → sin errores.

- [ ] **Step 5: Exportar el contrato** — `npm run openapi` y verificar que `openapi.json` tiene `rollCount` y `featuredCount` en `UserProfile`. Si el `CLAUDE.md` del backend documenta `GET /users/{userId}`, sumar los dos campos ahí.

- [ ] **Step 6: Commit** (en `backend-perfil`)
  ```bash
  git add -A && git commit -m "Perfil: rollCount y featuredCount en GET /users/{userId}"
  ```

### Task 2: App — contrato regenerado y formateador de la línea de números

**Files:**
- Modify: `src/api/schema.d.ts` (generado)
- Create: `src/features/profile/profile-stats.ts`
- Delete: `src/features/profile/friend-count.ts` y `src/features/profile/__tests__/friend-count.test.ts` (sus casos pasan al test nuevo)
- Test: `src/features/profile/__tests__/profile-stats.test.ts`

**Interfaces:**
- Consumes: el `openapi.json` de Task 1.
- Produces:
  ```ts
  export type ProfileStatsInput = {
    rolls?: number | null;   // undefined/null → not shown
    photos?: number | null;
    friends: number;
    mutual?: number;          // someone else's profile only
    canSee?: boolean;         // default true
    own?: boolean;            // default false
  };
  export type StatPart = { kind: "rolls" | "photos" | "friends"; count: string; word: string }; // count already formatted ("1.284")
  export function formatCount(n: number): string;
  export function statParts(input: ProfileStatsInput): StatPart[];
  export function emptyStatsText(input: ProfileStatsInput): string | null; // "Todavía no tenés amigos" or null
  export function mutualText(mutual: number | undefined): string | null;   // "3 amigos en común" / "1 amigo en común" / null
  export function spokenStats(parts: StatPart[]): string;                  // "8 rollos, 34 fotos, 12 amigos"
  ```

- [ ] **Step 1: Regenerar el contrato** — en `mobile-perfil`: `API_SPEC=../backend-perfil/openapi.json npm run api:generate`. Verificar con `grep -n "rollCount\|featuredCount" src/api/schema.d.ts` (dos campos en `UserProfile`).

- [ ] **Step 2: Test que falla** `profile-stats.test.ts`:
  - `"lists rolls, photos and friends in that order"`: `{ rolls: 8, photos: 34, friends: 12 }` → kinds `["rolls","photos","friends"]`, words `["rollos","fotos","amigos"]`.
  - `"uses singulars"`: `{ rolls: 1, photos: 1, friends: 1 }` → `["rollo","foto","amigo"]`.
  - `"formats thousands with a dot"`: `friends: 1284` → count `"1.284"`.
  - `"omits zeros"`: `{ rolls: 0, photos: 3, friends: 0, own: true }` → solo photos.
  - `"treats missing counts as null"`: `{ friends: 2 }` y `{ rolls: undefined, photos: null, friends: 2 }` → solo friends.
  - `"drops rolls and photos without canSee"`: `{ rolls: 5, photos: 9, friends: 48, canSee: false, mutual: 3 }` → solo friends.
  - `"hides friends of a hidden list with none in common"`: `{ friends: 48, canSee: false, mutual: 0 }` → `[]` (regla de hoy).
  - `"says Todavía no tenés amigos on your own empty profile"`: `emptyStatsText({ rolls: 0, photos: 0, friends: 0, own: true })` → `"Todavía no tenés amigos"`; con `own: false` → `null`; con `rolls: 2` → `null`.
  - `"writes mutual friends on their own line"`: `mutualText(3)` → `"3 amigos en común"`, `mutualText(1)` → `"1 amigo en común"`, `mutualText(0)` y `mutualText(undefined)` → `null`.
  - `"speaks the line as one phrase"`: `spokenStats(statParts({ rolls: 8, photos: 34, friends: 12 }))` → `"8 rollos, 34 fotos, 12 amigos"`.

- [ ] **Step 3: Ver que falla** — `npx jest src/features/profile/__tests__/profile-stats.test.ts --maxWorkers=2` → FAIL (módulo no existe).

- [ ] **Step 4: Implementar** `profile-stats.ts` (mover `formatCount` de `friend-count.ts`; borrar `friend-count.ts` y su test).

- [ ] **Step 5: Ver que pasa** — mismo comando → PASS.

- [ ] **Step 6: Commit**
  ```bash
  git add src/api/schema.d.ts src/features/profile && git commit -m "Perfil: contrato con rollCount/featuredCount y formateador de la línea de números"
  ```
  (Typecheck puede fallar hasta Task 3 porque `profile-header.tsx` importa `friend-count`: en ese caso hacer este commit junto con el de Task 3.)

### Task 3: `ProfileHeader` centrado con la línea de números

**Files:**
- Modify: `src/features/profile/profile-header.tsx`
- Modify: `src/features/profile/worst-case-fixtures.ts`, `src/features/profile/worst-case-screen.tsx`
- Test: `src/features/profile/__tests__/profile-header.test.tsx`, `src/features/profile/__tests__/worst-case-fixtures.test.ts`, `__tests__/worst-case-profile.test.tsx`

**Interfaces:**
- Consumes: `statParts`, `emptyStatsText`, `mutualText`, `spokenStats`, `ProfileStatsInput` (Task 2).
- Produces: `ProfileHeader` props `{ id; name; username; avatarUrl; bio; badge?; stats?: ProfileStatsInput & { onPressFriends: () => void } }` (reemplaza `friends`). Sin `stats` no se dibuja línea.

Layout (spec "Qué se eligió"): columna centrada (`alignItems: "center"`), `Avatar` de **96**; nombre `type.title` centrado `numberOfLines={3}` (testID `profile-name`, sin nodo si está vacío); fila `profile-handle-row` con `flexDirection: "row"`, `flexWrap: "wrap"`, `justifyContent: "center"`, `alignItems: "center"` con el @ (`profile-username`, `numberOfLines={1}`, `ellipsizeMode="middle"`, `flexShrink: 1`) y el `Badge` (mismo `accessibilityLabel` "Insignia: …"); bio (`profile-bio`) con `type.body` + `fontFamily` de `type.quote` (serif, no su tamaño), centrada; línea de números (`profile-stats`); `mutualText` en `type.footnote` secundario debajo (`profile-mutual`). Gaps con `spacing.*`.

Línea: un `Text` (`type.subhead`, `secondaryLabel`, centrado) con `Text` anidados por parte (cifra en `label` + `fontWeight: "600"`, palabra en secundario), separados por " · ". El tramo de amigos es un `Text` anidado con `onPress={stats.onPressFriends}`, `accessibilityRole="button"` y `accessibilityLabel` "12 amigos". El contenedor lleva `accessibilityLabel={spokenStats(parts)}`. Si `parts` está vacío y `emptyStatsText` da texto, la línea es ese texto entero tocable (`onPressFriends`). "N en común" también es tocable con `onPressFriends`.

- [ ] **Step 1: Tests que fallan** (reescribir los de `friends` a `stats`, mantener los de nombre/@ vacíos):
  - `"centers the header"`: estilo aplanado de `profile-header` tiene `alignItems: "center"`; avatar de 96 (por el `size` del `Avatar` o su estilo).
  - `"shows rolls, photos and friends in one line"`: `stats: { rolls: 8, photos: 34, friends: 12, own: true, onPressFriends }` → `getByTestId("profile-stats")` tiene label `"8 rollos, 34 fotos, 12 amigos"`.
  - `"opens the friend list from the friends part"`: `fireEvent.press(getByRole("button", { name: "12 amigos" }))` → `onPressFriends` 1 vez.
  - `"shows the 0-friends line on your own empty profile and it is pressable"`: `stats: { rolls: 0, photos: 0, friends: 0, own: true }` → botón "Todavía no tenés amigos".
  - `"shows no line on someone else's empty profile"`: `stats: { friends: 0, canSee: true }` → `queryByTestId("profile-stats")` null.
  - `"puts mutual friends on their own line"`: `stats: { rolls: 5, photos: 21, friends: 48, mutual: 3, onPressFriends }` → `getByTestId("profile-mutual")` con texto "3 amigos en común".
  - `"wraps the handle row"`: `profile-handle-row` tiene `flexWrap: "wrap"` y contiene @ e insignia.
  - `"sets the bio in the system serif"`: `profile-bio` estilo aplanado tiene `fontFamily` igual a `type.quote.fontFamily` y `textAlign: "center"`.
- [ ] **Step 2: Ver que fallan** — `npx jest src/features/profile/__tests__/profile-header.test.tsx --maxWorkers=2` → FAIL.
- [ ] **Step 3: Implementar** el nuevo `ProfileHeader` (actualizar el comentario del componente).
- [ ] **Step 4: Ver que pasan** — mismo comando → PASS.
- [ ] **Step 5: break-ui** — `FixtureProps` cambia `friends` por `stats` (sin `onPressFriends`, que pone la pantalla). Agregar a "Peor caso": `stats: { rolls: 1284, photos: 60, friends: 12840, mutual: 1284 }`, nombre de 30 caracteres que parte en 3 renglones, `username` de 30 + `badge: "first_edition"`. A "Uno": `{ rolls: 1, photos: 1, friends: 1, mutual: 1 }`. A "Mínimo": `{ rolls: 0, photos: 0, friends: 0, own: true }`. Ajustar `worst-case-screen.tsx` para pasar `onPressFriends`.
  Run: `npx jest src/features/profile/__tests__/worst-case-fixtures.test.ts __tests__/worst-case-profile.test.tsx --maxWorkers=2` → PASS (ajustar sus asserts a `stats`).
- [ ] **Step 6: Commit** — `git commit -m "Perfil: encabezado centrado con rollos · fotos · amigos"` (archivos de esta tarea).

### Task 4: Pantallas — tu Perfil, perfil de otro y botón de solicitud

**Files:**
- Create: `src/features/profile/me-screen.tsx` (mueve la lógica de `app/(tabs)/me/index.tsx`; `app/` queda en `export default function MeRoute() { return <MeScreen />; }`)
- Create: `src/features/profile/own-stats.ts` (puro)
- Modify: `src/features/friends/user-profile-screen.tsx`
- Modify: `src/features/friends/friend-request-button.tsx`
- Test: `src/features/profile/__tests__/own-stats.test.ts`, `__tests__/profile.test.tsx`, `__tests__/friend-profile.test.tsx`, `__tests__/friend-requests.test.tsx` (si asserta estilos del botón)

**Interfaces:**
- Consumes: `ProfileHeader` `stats` (Task 3), `useUser`/`userKey` (`src/features/profile/use-user.ts`), `useFeatured` (`src/features/featured/use-featured.ts`), `useFriends`.
- Produces:
  ```ts
  // own-stats.ts
  export function ownStats(input: {
    friends: number | undefined;          // useFriends(); undefined while loading
    profile: { rollCount: number | null; featuredCount: number | null } | null; // useUser(me.id).profile
    featuredLength: number | undefined;    // useFeatured(me.id).photos?.length
  }): ProfileStatsInput | undefined;
  ```
  Reglas: `friends` undefined → `undefined` (sin línea). Sin `profile` y `friends === 0` → `undefined` (no mostrar "Todavía no tenés amigos" hasta resolver). Sin `profile` y `friends > 0` → `{ friends, own: true }`. Con `profile` → `{ rolls: profile.rollCount, photos: featuredLength ?? profile.featuredCount, friends, own: true }`.

- [ ] **Step 1: Test que falla** `own-stats.test.ts`:
  - `"shows nothing while the friend list loads"` → `undefined`.
  - `"waits for the profile before saying Todavía no tenés amigos"`: `{ friends: 0, profile: null }` → `undefined`.
  - `"shows friends only while the profile loads"`: `{ friends: 4, profile: null }` → `{ friends: 4, own: true }`.
  - `"prefers the loaded featured list over featuredCount"`: `{ friends: 4, profile: { rollCount: 2, featuredCount: 10 }, featuredLength: 11 }` → `photos: 11`.
  - `"falls back to featuredCount before the grid loads"`: `featuredLength: undefined` → `photos: 10`.
- [ ] **Step 2: Ver que falla** — `npx jest src/features/profile/__tests__/own-stats.test.ts --maxWorkers=2` → FAIL.
- [ ] **Step 3: Implementar** `own-stats.ts`; `me-screen.tsx` con `useMe`, `useFriends`, `useUser(me?.id)`, `useFeatured(me?.id)` (misma query que ya pide `ProfileShowcase`: no duplica red) y `stats={s && { ...s, onPressFriends: () => router.navigate("/friends") }}`. Toolbar y `ProfileShowcase` como hoy. `app/(tabs)/me/index.tsx` solo monta `<MeScreen />`.
- [ ] **Step 4: Perfil de otro** — en `user-profile-screen.tsx`: `stats={{ rolls: rollCount, photos: canSee ? (featuredLength ?? featuredCount) : null, friends: friendCount, mutual: mutualCount, canSee, onPressFriends: () => router.push(`/user/${userId}/friends`) }}` con `featuredLength = useFeatured(canSee && !blockedByMe ? userId : undefined).photos?.length`.
- [ ] **Step 5: Botón de solicitud** — `FriendRequestButton`: botones `size="small"`, caja `alignItems: "center"`; en `received`, "Aceptar solicitud" y "Rechazar" en una fila (`flexDirection: "row"`, `gap: spacing.sm`, centrada); `ErrorText` centrado debajo. Lógica igual.
- [ ] **Step 6: Tests de pantalla** — ajustar mocks de `fetchUser` en `__tests__/profile.test.tsx` y `__tests__/friend-profile.test.tsx` para incluir `rollCount`/`featuredCount`, y sumar:
  - profile.test: `"shows your rolls, photos and friends"`: `fetchUser` → `{ rollCount: 3, featuredCount: 2 }`, 2 destacadas, 5 amigos → label `"3 rollos, 2 fotos, 5 amigos"`; tocar "5 amigos" navega a la tab Amigos.
  - friend-profile: `"shows their counts and mutual friends"` → `"5 rollos, 21 fotos, 48 amigos"` (con 21 destacadas mockeadas o `featuredCount: 21` y la grilla sin cargar) y "3 amigos en común".
  - friend-profile: `"shows only friends on a private profile"`: `canSee: false`, `rollCount: null`, `featuredCount: null`, `mutualCount: 3` → label `"48 amigos"` y "Este perfil es privado".
  - Los tests existentes que buscaban "12 amigos · 3 en común" pasan a las dos líneas.
  Run: `npx jest __tests__/profile.test.tsx __tests__/friend-profile.test.tsx __tests__/friend-requests.test.tsx src/features/profile --maxWorkers=2` → PASS. Después `npm run typecheck` → sin errores.
- [ ] **Step 7: Commit** — `git commit -m "Perfil: tu perfil y el de otro con la línea de números; solicitud centrada"`.

### Task 5: Documentación y verificación en el dev build

**Files:**
- Modify: `CLAUDE.md` (app): "Navegación y diseño → Perfil", "Perfil de cualquier usuario" (línea de números, "N amigos en común" aparte, `rollCount`/`featuredCount`) e "Insignias" (al lado del @).
- Modify: `CLAUDE.md` del backend si documenta `GET /users/{userId}` (si no se hizo en Task 1).

- [ ] **Step 1:** Actualizar `CLAUDE.md` con lo de arriba (copiar del spec; sin inventar comportamiento).
- [ ] **Step 2: Verificación visual** con el dev build contra el backend local (`npm run dev:lan` en `backend-perfil`, la app con `EXPO_PUBLIC_API_URL`): tu Perfil con `juani@rollo.test`, el de un amigo, uno privado y uno con nombre largo del seed; también la pantalla break-ui (Ajustes → Desarrollo) en claro, oscuro y con texto grande. Comparar con la maqueta C1.
- [ ] **Step 3: Commit** — `git commit -m "Docs: Perfil centrado con rollos · fotos · amigos"`.
- [ ] **Step 4:** Abrir dos PRs a `develop` (backend y app, misma rama) con descripción en español; el PR de la app menciona que depende del del backend (el job `contract` compara contra la rama del backend del mismo nombre).
