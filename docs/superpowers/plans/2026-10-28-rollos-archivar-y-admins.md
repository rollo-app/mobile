# Archivar y eliminar rollos, y varios admins — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada uno archiva rollos revelados o se va de un rollo desde "Tus rollos"; un rollo tiene creador y admins, y el creador puede borrarlo para todos.

**Architecture:** Backend primero (`rollo-app/backend`, rama `feature/rollos-archivar-y-admins` desde `develop`): migración, permisos por
`trips.created_by_user_id`, archivo por miembro, borrado con lápida + cola de R2. Después la app (`rollo-app/mobile`, misma rama, ya creada):
`npm run api:generate`, lógica pura de roles y agrupado, y las pantallas. El rol de la DB y de la API sigue siendo `admin` | `member`;
"creador" es `isCreator`, derivado de `created_by_user_id` (así el 1.1.0 instalado no se rompe).

**Tech Stack:** Cloudflare Worker + Hono OpenAPI + D1 + R2, vitest (`@cloudflare/vitest-plugin`). Expo SDK 58, Expo Router, TanStack Query,
`@expo/ui/community/menu` (`MenuView`), Jest + `expo-router/testing-library`.

**Spec:** `docs/superpowers/specs/2026-10-28-rollos-archivar-y-admins-design.md` (leerlo antes de cada tarea).

## Global Constraints

- Código, comentarios y descripciones de tests en inglés; textos visibles, commits y PRs en español rioplatense.
- Tests de la app: solo los de lo que tocaste, `npx jest <ruta> --maxWorkers=2`; nunca la suite completa. Backend: `npx vitest run test/<archivo>`.
- TDD: test primero, verlo fallar, código mínimo.
- No editar `src/api/schema.d.ts` a mano: `API_SPEC=../backend/openapi.json npm run api:generate` (el backend genera `openapi.json` con su script; ver su CLAUDE.md).
- `role` en la API sigue siendo `"admin" | "member"`: no agregar valores al enum.
- Escrituras de la app con `useMutation` en `use-<verbo>-<cosa>.ts`; errores con `errorMessage(…)`; `app/` solo rutea.
- En backend usar `/usr/bin/git` si el wrapper de git falla en un worktree.
- Mensaje de error de permiso de creador (exacto): `"Solo quien creó el rollo puede hacer esto"`.

## Review Focus

1. **Creador que además es el único admin borra su cuenta** → `created_by_user_id` pasa al admin activo más viejo o, si no hay, al miembro activo más viejo, que queda admin (Task B2).
2. **Admin que se sale y vuelve con el código** → entra como `member`, sin admin (Task B2).
3. **Foto en cola offline de un rollo borrado** → el `POST` o el `complete` responden 410 y la app la borra sin marcarla fallida; un 403 de "ya no sos miembro" sigue igual (Tasks B4, A5).
4. **Rollo archivado que es el activo** → sigue activo y "Archivados" arranca abierto (Task A2).
5. **PATCH del nombre con otro campo junto, hecho por un admin no creador** → 403 entero, no se aplica nada (Task B2).

---

## Backend (`../backend`)

### Task B1: Migración 0029

**Files:**
- Create: `migrations/0029_rollo_roles_archive_delete.sql`
- Modify: `src/db/schema.ts` (columnas y tablas nuevas), `src/types.ts` (`MemberRow.archived_at: number | null`)
- Test: `test/rollo-roles.test.ts` (nuevo)

**Interfaces:**
- Produces: `members.archived_at INTEGER` (NULL = no archivado); tabla `deleted_trips (trip_id TEXT PRIMARY KEY, deleted_at INTEGER NOT NULL)`;
  tabla `r2_purge (key TEXT PRIMARY KEY, created_at INTEGER NOT NULL)`; backfill de `trips.created_by_user_id` donde es NULL:
  admin activo más viejo (`removed_at IS NULL AND left_at IS NULL`, `ORDER BY created_at, id`), y si no hay, miembro activo más viejo
  (y ese miembro pasa a `role = 'admin'`).

- [ ] **Step 1:** Test `"migration backfills a missing creator with the oldest active admin"`: crear rollo con `newTrip`, `UPDATE trips SET created_by_user_id = NULL`, correr el SQL del backfill (exportarlo como const en `src/lib/creator.ts`: `BACKFILL_CREATOR_SQL`) y esperar `created_by_user_id === adminUserId`. Segundo caso: sin admins activos → el miembro activo más viejo es creador y `role = 'admin'`.
- [ ] **Step 2:** `npx vitest run test/rollo-roles.test.ts` → FAIL.
- [ ] **Step 3:** Escribir la migración (la misma SQL del backfill) y `BACKFILL_CREATOR_SQL`.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5:** Commit `Migración: archivo por miembro, lápidas de rollos y creador completo`.

### Task B2: Creador y admins

**Files:**
- Create: `src/lib/creator.ts` (`isCreator`, `requireCreator`, `BACKFILL_CREATOR_SQL`)
- Modify: `src/lib/auth.ts`, `src/modules/trips/{trips.router.ts,trips.controller.ts,trips.service.ts,members.service.ts,trips.repository.ts,trips.schemas.ts}`,
  `src/schemas.ts` (`MemberSchema`, `TripSchema`), `src/modules/me/{me.schemas.ts,me.repository.ts}` (`TripSummary`),
  `src/modules/account/{account.service.ts,account.repository.ts}`, `src/modules/me/me.router.ts` (descripción de borrar cuenta)
- Test: `test/rollo-roles.test.ts`

**Interfaces:**
- Produces:
  - `isCreator(trip: TripRow, userId: string): boolean`; middleware `requireCreator` (después de `requireTripMember`; 403 con el mensaje de Global Constraints).
  - `MemberSchema.isCreator: boolean`; `TripSchema.createdBy: { userId: string; name: string } | null`; `TripSummary.isCreator: boolean`.
  - `POST /trips/{tripId}/members/{memberId}/admin` → 200 `Member` (cualquier admin; el destino debe ser miembro activo, si no 404; si ya es admin, 200 igual).
  - `DELETE /trips/{tripId}/members/{memberId}/admin` → 200 `Member` (solo creador; destino creador → 400 `"El creador siempre es admin"`).

- [ ] **Step 1: Tests (todos en `test/rollo-roles.test.ts`)**
  - `"an admin makes a member admin"`: el creador hace admin a Ana; Ana hace admin a Beto → 200, `role: "admin"`; un `member` → 403.
  - `"only the creator removes an admin role"`: Ana (admin) intenta quitarle el admin a Beto → 403; creador → 200 `role: "member"`; creador sobre sí mismo → 400.
  - `"admins remove members but not admins or the creator"`: Ana saca a Caro (member) → 204; Ana saca a Beto (admin) → 403; Ana saca al creador → 403; el creador saca a Beto → 204.
  - `"an admin edits only the name"`: Ana `PATCH {name:"Nuevo"}` → 200; Ana `PATCH {name:"X", revealAt}` → 403 y el nombre no cambió; creador `PATCH {revealAt}` → 200.
  - `"only the creator reveals early and toggles the private rollo"`: Ana `POST /reveal` → 403; Ana `PATCH {featuringDisabled:true}` → 403.
  - `"the creator can't leave; an admin who leaves comes back as a member"`: creador `DELETE members/me` → 409; Ana (admin) sale → 204, vuelve con `join` → `role: "member"`.
  - `"detail and my trips say who created it"`: `GET /trips/{id}` → `trip.createdBy = { userId: adminUserId, name: "Juani" }`, `me.isCreator`, cada miembro con `isCreator`; `GET /me/trips` → `isCreator` true solo para el creador.
  - `"when the creator deletes the account the oldest admin becomes creator"`: Ana y Beto admins (Ana primero); el creador borra su cuenta → `createdBy.userId === Ana`. Sin admins: el miembro activo más viejo queda creador y admin.
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3: Implementar**
  - `requireAdmin` queda igual (cualquier admin). `revealRoute` usa `requireCreator`. `updateTrip`: si el actor no es creador y el body tiene algo además de `name` → 403 sin aplicar nada.
  - `removeMember`: destino creador → 403 `"No podés sacar a quien creó el rollo"`; destino admin y actor no creador → 403 con el mensaje de Global Constraints.
  - `leaveTrip`: chequear creador (`isCreator`) en vez de `role === "admin"` → 409 `"Creaste este rollo: no podés salirte"`; `markLeft` también pone `role = 'member'`.
  - Comentarios y borrado de fotos ajenas antes del revelado ya miran `role = 'admin'`: quedan para cualquier admin, sin cambios.
  - `deleteAccount`: si el usuario es `created_by_user_id` de un rollo que sigue con miembros, después de borrar su membresía correr
    el `BACKFILL_CREATOR_SQL` acotado a ese rollo (poner antes `created_by_user_id = NULL`). Reemplaza la promoción vieja.
  - Actualizar las descripciones OpenAPI de las rutas tocadas.
- [ ] **Step 4:** Test → PASS; `npx vitest run test/members* test/account.test.ts test/openapi.test.ts` → PASS.
- [ ] **Step 5:** Commit `Rollos con creador y varios admins`.

### Task B3: Archivar (por miembro)

**Files:**
- Modify: `src/modules/trips/{trips.schemas.ts,members.service.ts,trips.repository.ts,trips.controller.ts}`, `src/modules/me/{me.schemas.ts,me.repository.ts}`
- Test: `test/rollo-archive.test.ts` (nuevo)

**Interfaces:**
- Produces: `UpdateMyMembershipSchema` = `{ allowFeaturing?: boolean; archived?: boolean }` (al menos uno, si no 400);
  `MyMembershipSchema` = `{ allowFeaturing: boolean; archived: boolean }`; `TripSummary.archived: boolean`.

- [ ] **Step 1: Tests**
  - `"archives and unarchives a revealed rollo only for me"`: rollo revelado; Ana `PATCH members/me {archived:true}` → 200 `archived: true`; `/me/trips` de Ana → `archived: true`, del creador → `false`; `{archived:false}` → vuelve.
  - `"an unrevealed rollo can't be archived"`: → 409 `"Solo podés archivar rollos revelados"`.
  - `"allowFeaturing alone still works"` y `"an empty body is 400"`.
  - `"leaving clears the archive"`: archivado, sale, vuelve → `archived: false`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (`markLeft` también pone `archived_at = NULL`). **Step 4:** PASS (+ `test/featuring-levels.test.ts`).
- [ ] **Step 5:** Commit `Archivar un rollo revelado, solo para vos`.

### Task B4: Borrar el rollo para todos

**Files:**
- Create: `src/lib/r2-purge.ts` (`purgeDeletedFiles(env: Env, now: number): Promise<void>`, hasta 1000 claves por pasada)
- Modify: `src/modules/trips/{trips.router.ts,trips.controller.ts,trips.service.ts,trips.repository.ts}`, `src/lib/auth.ts` (`loadTripAndMember`), `src/index.ts` (cron)
- Test: `test/rollo-delete.test.ts` (nuevo)

**Interfaces:**
- Produces: `DELETE /trips/{tripId}` → 204 (`requireCreator`). Cualquier ruta con un `tripId` o `mediaId` de un rollo en `deleted_trips` → **410** `{ error: "Este rollo se borró" }`.

- [ ] **Step 1: Tests**
  - `"only the creator deletes the rollo"`: Ana (admin) → 403; creador → 204.
  - `"deleting removes everything at once"`: con fotos, un me gusta, un comentario y una destacada (rollo revelado, amigos): después del 204, `GET /trips/{id}` → 410; `/me/trips` de todos sin el rollo; `/me/likes`, `/me/comments`, `/me/featured-by` y el perfil sin esas fotos; las filas de `media`, `members`, `trips` no existen; `r2_purge` tiene las claves original y thumb.
  - `"uploading to a deleted rollo is 410"`: `POST /trips/{id}/media` → 410; `POST /media/{id}/complete` de una foto registrada antes → 410.
  - `"the cron purges the files"`: `purgeDeletedFiles(env, now)` → los objetos de R2 ya no existen y `r2_purge` queda vacía.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementar** un solo `db.batch`, en este orden: `INSERT INTO r2_purge SELECT original_key … UNION SELECT thumb_key … FROM media WHERE trip_id = ?`
  (con `INSERT OR IGNORE`), `INSERT INTO deleted_trips`, `DELETE FROM media WHERE trip_id`, `DELETE FROM members WHERE trip_id`, `DELETE FROM trips WHERE id`.
  `loadTripAndMember`/`requireMediaMember`: si no está el rollo (o la foto) y el id está en `deleted_trips` → 410. Para `mediaId` sin fila no hay
  forma de saber el rollo: el `complete` de una foto borrada sigue en 404, salvo que la ruta tenga el `tripId` (verificar qué ruta usa la app en
  `src/features/capture/uploader.ts` y cubrir esa; documentarlo en el test).
- [ ] **Step 4:** PASS (+ `test/media.test.ts`, `test/account.test.ts`).
- [ ] **Step 5:** Commit `El creador puede borrar el rollo para todos`.

### Task B5: Seed, docs y contrato

**Files:** `scripts/seed*` (el que use `npm run seed`), `CLAUDE.md` del backend, `openapi.json` regenerado.

- [ ] Seed: un rollo con dos admins (además del creador) y uno revelado archivado por `juani@rollo.test`; imprimirlo en el resumen final.
- [ ] CLAUDE.md: roles (tabla del spec), archivar, borrar rollo, 410 y `r2_purge`.
- [ ] `npm test` del backend entero (lo pide el CI) → PASS. Commit `Seed y docs de roles, archivo y borrado`. Abrir PR a `develop`.

---

## App (`mobile`, rama `feature/rollos-archivar-y-admins`)

### Task A1: Contrato y lógica pura de roles

**Files:**
- Modify: `src/api/schema.d.ts` (generado), `src/features/trips/row-state.ts`
- Create: `src/features/trips/roles.ts`
- Test: `src/features/trips/__tests__/roles.test.ts`, `src/features/trips/__tests__/row-state.test.ts`

**Interfaces:**
- Produces (`roles.ts`):
  - `type MemberAction = "makeAdmin" | "removeAdmin" | "remove"`
  - `memberActions(me: Member, target: Member): MemberAction[]`
  - `canRename(me: Member): boolean` (cualquier admin)
  - `memberBadge(m: Member): "Creador" | "Admin" | null`

- [ ] **Step 1: Tests** de `memberActions`: yo `member` → `[]`; yo admin, destino member → `["makeAdmin","remove"]`; yo admin, destino admin → `[]`;
  yo creador, destino admin → `["removeAdmin","remove"]`; destino creador → `[]`; destino yo → `[]`. `memberBadge`: creador → "Creador" aunque `role` sea admin.
  `row-state`: "Lo creaste vos" sale de `trip.isCreator` (un admin no creador → "Entraste con un código").
- [ ] **Step 2:** `API_SPEC=../backend/openapi.json npm run api:generate`; tests → FAIL. **Step 3:** implementar. **Step 4:** PASS + `npm run typecheck`.
- [ ] **Step 5:** Commit `Roles del rollo: creador y admins (contrato y lógica)`.

### Task A2: "Archivados" y acciones en "Tus rollos"

**Files:**
- Modify: `src/features/trips/{group-trips.ts,trips-screen.tsx,trip-row.tsx,actions.ts}`, `src/features/friends/use-leave-trip.ts`
- Create: `src/features/trips/use-archive-trip.ts`
- Test: `src/features/trips/__tests__/group-trips.test.ts`, `__tests__/trips.test.tsx` (pantalla; si no existe, crear con `renderRouter`)

**Interfaces:**
- Produces: `TripGroups.archived: TripSummary[]` y `archivedExpandedByDefault: boolean` (los archivados salen de `top`/`revealed`/`older`, ordenados por revelado, más nuevo primero);
  `setTripArchived(tripId: string, archived: boolean): Promise<void>` en `trips/actions.ts`;
  `useArchiveTrip(): { setArchived(tripId: string, archived: boolean): void; error: string | null }` (optimista sobre `myTripsKey`, vuelve atrás si falla y muestra `Burnt.alert` "No se pudo archivar");
  `useLeaveTrip(tripId, tripName, copy?: "board" | "list")`: con `"list"` el `Alert` dice *¿Eliminar "{rollo}" de tus rollos?* / *Salís del rollo y tus fotos se quedan para el grupo. Podés volver con el código.* / botón "Eliminar".

- [ ] **Step 1: Tests**
  - `groupTrips`: un archivado no aparece en otra sección; `archivedExpandedByDefault` es true solo si el activo está archivado.
  - Pantalla: "Archivados · 2" colapsado al final; tocarlo muestra las filas; mantener apretada una fila revelada ofrece "Archivar" (o "Desarchivar" si está archivada) y "Eliminar"; en un rollo sin revelar no hay "Archivar"; si `isCreator` no hay "Eliminar"; "Archivar" llama `setTripArchived(id, true)` y la fila pasa a "Archivados" sin esperar.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar. La fila usa `MenuView` de `@expo/ui/community/menu` con apertura por mantener apretado (patrón de `src/features/friends/friend-sections.tsx`) y las mismas acciones en `accessibilityActions`. `OlderRolls` se generaliza a una fila desplegable con `label` (`"Anteriores"`/`"Archivados"`). Archivar no cambia el rollo activo.
- [ ] **Step 4:** PASS + typecheck. **Step 5:** Commit `Archivar y eliminar rollos desde Tus rollos`.

### Task A3: Miembros, roles y "Creado por"

**Files:**
- Modify: `src/features/roll/{roll-people.tsx,roll-dates.tsx}`, `src/features/friends/actions.ts` (o `trips/actions.ts`: `makeAdmin`, `removeAdmin`, `removeMember`)
- Create: `src/features/roll/{use-make-admin.ts,use-remove-admin.ts,use-remove-member.ts,use-rename-trip.ts}`
- Test: `__tests__/roll-members.test.tsx` (nuevo, `renderRouter`)

**Interfaces:**
- Consumes: `memberActions`, `memberBadge`, `canRename` (A1); `TripDetail.trip.createdBy`, `me.isCreator`.
- Produces: `makeAdmin(tripId, memberId)`, `removeAdmin(tripId, memberId)`, `removeMember(tripId, memberId)`, `renameTrip(tripId, name)` (cada mutación invalida `tripKey(tripId)` y, el nombre, también `myTripsKey`).

- [ ] **Step 1: Tests**
  - La fila del creador muestra "Creador", la de un admin "Admin" (en `value`, secundario; "Bloqueado" gana como hoy).
  - Siendo admin, mantener apretado un miembro ofrece "Hacer admin" y "Sacar del rollo"; "Sacar del rollo" pide `Alert` *¿Sacar a {nombre} del rollo?* / *Sus fotos se quedan. Solo un admin lo puede volver a sumar.* / "Sacar"; tocar la fila sigue abriendo el perfil.
  - Siendo creador no aparece "Salirme del rollo"; siendo admin no creador sí.
  - "Creado por Juani" aparece en `RollDates` (footer de la sección Fechas); sin `createdBy` no aparece nada.
  - Admin: fila "Nombre" con el nombre como valor; al tocarla, `Alert.prompt` "Nombre del rollo" con el actual; guardar llama `renameTrip`; un miembro no ve la fila.
  - Error de cualquiera de estas mutaciones → `ErrorText` debajo de la sección de miembros.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (menú con `MenuView` por mantener apretado + `accessibilityActions`; nombre: `trim`, 1–60, vacío no manda nada).
- [ ] **Step 4:** PASS + typecheck. **Step 5:** Commit `Creador y admins en la lista de miembros`.

### Task A4: Archivar desde el rollo y "Borrar rollo"

**Files:**
- Modify: `src/features/roll/roll-people.tsx`, `src/features/trips/actions.ts` (`deleteTrip(tripId)`)
- Create: `src/features/roll/use-delete-trip.ts`
- Test: `__tests__/roll-members.test.tsx`

**Interfaces:**
- Consumes: `useArchiveTrip` (A2), `cancelMomentNotifications`, `clearActiveTripId`/`getActiveTripId`, `myTripsKey`, `tripKey`.

- [ ] **Step 1: Tests**
  - Revelado: fila "Archivar rollo" / "Desarchivar rollo" (según `TripSummary.archived` del rollo en `useActiveTrip().trips`).
  - Creador: fila roja "Borrar rollo" al final; `Alert` *¿Borrar "{rollo}" para todos?* / *Se borran todas las fotos de todos y no se puede deshacer.* / "Borrar" destructivo; confirma → `deleteTrip(id)`, cancela momentos, limpia el activo si era este, invalida `myTripsKey`, saca `tripKey`, `router.dismissTo("/roll")`. Un admin no creador no ve la fila.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** Commit `Borrar el rollo para todos (creador)`.

### Task A5: La cola offline y el 410

**Files:** Modify `src/features/capture/uploader.ts`. Test: `src/features/capture/__tests__/uploader.test.ts`.

- [ ] **Step 1:** Tests `"drops a photo whose rollo was deleted without marking it failed"`: `register` responde 410 → `queue.remove(id)` y `removeFiles(id)` llamados, `markFailed` no; lo mismo con 410 en `complete`. Un 403 sigue como hoy.
- [ ] **Step 2:** FAIL. **Step 3:** nuevo `Verdict` `{ kind: "gone" }` para `status === 410` en las dos fases; en el loop: `remove` + `removeFiles` + `onDiscarded?.(tripId)`. **Step 4:** PASS. **Step 5:** Commit `La cola descarta fotos de un rollo borrado`.

### Task A6: Docs

- [ ] CLAUDE.md: roles (creador/admin/miembro, `isCreator`, `createdBy`), archivar ("Archivados", solo revelados, por miembro), eliminar = salirse desde la lista, borrar para todos, 410 en la cola, y la línea `npm test  # N tests` con el número que dé el CI del PR (no correr la suite completa en local).
- [ ] Commit `CLAUDE.md: archivar, eliminar y roles de los rollos`. PR a `develop` cuando el PR del backend esté mergeado (el job `contract` compara el schema).

## Orden y paralelismo

B1 → B2 → B3 → B4 → B5 (mismo repo, comparten archivos). A1 necesita `openapi.json` de B4. Después A2, A3 y A5 pueden ir en paralelo
(archivos distintos; A2 y A3 tocan `trips/actions.ts`/`friends/actions.ts`: que A2 agregue solo `setTripArchived` y A3 sus funciones al final).
A4 después de A2 y A3 (usa `useArchiveTrip` y `roll-people.tsx`). A6 al final.
