# Buscar usuarios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Search any Rollo account by @username or name from a native search bar in the Amigos tab, and send / cancel / accept a friend request right from the result row.

**Architecture:** Backend (`rollo-app/backend`, `../backend`): a `users.name_search` column (normalized name, written on every profile write and backfilled once) and `GET /users/search?q=` in the `users` module, with its own rate limit `RL_SEARCH`. App (`mobile`): pure normalization/matching in `src/features/friends/`, a debounced TanStack query, and a results view that replaces the Amigos tab content while the search bar has text. Friends are filtered locally from `useFriends()`; the server never returns friends.

**Tech Stack:** Hono + `@hono/zod-openapi` on Cloudflare Workers, D1 (SQLite), Vitest with `@cloudflare/vitest-plugin`; Expo SDK 58, Expo Router (native Stack `headerSearchBarOptions`), TanStack Query, Jest + `expo-router/testing-library`.

**Spec:** `docs/superpowers/specs/2026-11-01-buscar-usuarios-design.md` (read it with this plan).

## Global Constraints

- Code, comments, test names in English; user-visible text, commits and PRs in rioplatense Spanish (voseo).
- Branches: `feature/buscar-usuarios` from `develop` in **both** repos; PRs to `develop`. Never push to `develop`/`main` directly.
- App tests: TDD, only related tests, always `--maxWorkers=2` (`npx jest <path> --maxWorkers=2`). Never the full suite. In Testing Library 14 `fireEvent` is async: `await fireEvent…`.
- Backend tests: `npx vitest run test/<file>.test.ts`.
- `src/api/schema.d.ts` is generated, never edited: `API_SPEC=../backend/openapi.json npm run api:generate` after the backend exports `openapi.json` (`npm run openapi` in `../backend`).
- `app/` files only route; the Amigos tab stays `app/(tabs)/friends/index.tsx` mounting `FriendsScreen`.
- Nobody appears in results: yourself, your friends (server side), anyone with a block in either direction, accounts with `username IS NULL` or empty/null `name`.
- Matching rule (same in app and server): trim, drop one leading `@`, lowercase, NFD + strip combining marks, collapse inner whitespace to one space. Match = `username` starts with q **or** some word of the name starts with q.
- Minimum 2 chars after normalization (server: 400 below 2 or above 30). Max 20 results, no cursor.
- Order: exact `username = q` first; then `mutualCount` desc; then `name COLLATE NOCASE`, then `id`.
- Response row: `{ id, name, username, avatarUrl, mutualCount, friendRequest: "none" | "sent" | "received" }` — nothing else (no email, bio, badge, visibility, trips).
- `RL_SEARCH`: per user, 60 per 60 s, namespace `1005`.
- Copy: section titles "Amigos" and "Personas"; buttons "Agregar", "Enviada", "Aceptar"; menu "Cancelar solicitud"; friend row value "Amigos"; detail "· N en común"; empty "No encontramos a nadie con "{texto}"."; error fallback "No se pudo buscar" + "Reintentar"; 20 results footnote "Si no está, escribí más de su nombre o su @."
- Native changes: none (search bar is react-native-screens, already in the build). Ships as JS only, but **after** the backend is deployed.

## Review Focus

1. A query with LIKE wildcards (`%`, `_`, `\`) — e.g. `"a_b"` or `"%"` — must match literally, never everyone. → backend Task 2 test `escapes LIKE wildcards`.
2. Accents and case in either direction ("Martín" found by "martin", "MARTÍN", "@Mart"). → Task 1 unit tests + Task 2 endpoint test `matches ignoring accents and case`.
3. A user who changes their name after the backfill (and a user created via admin edit) must be findable by the new name and not the old. → Task 1 test `updates name_search on PATCH /me` and `on admin edit`.
4. Typing fast: an older response must never overwrite a newer query's results, and the list must not flash empty between keystrokes. → Task 4 hook test `keeps previous results while the next query loads` (query key per normalized text + `keepPreviousData`).
5. Accepting from a row while that person also shows elsewhere (profile cache, Solicitudes): all three agree after success and after failure. → Task 5 test `accept moves the person to Amigos and rolls back on error`.

---

## Backend (`../backend`)

### Task 1: `name_search` column, normalization and backfill

**Files:**
- Create: `migrations/0034_users_name_search.sql`
- Create: `src/lib/search-text.ts`
- Create: `scripts/backfill-name-search.ts`
- Modify: `src/db/schema.ts` (users table: `nameSearch: text("name_search")`)
- Modify: `src/modules/me/me.repository.ts` (`updateProfile` also writes `name_search`)
- Modify: `scripts/seed/lib.ts` (the user INSERT/UPDATE also writes `name_search`)
- Modify: `package.json` (script `"db:backfill-name-search": "tsx scripts/backfill-name-search.ts"`)
- Test: `test/search-text.test.ts`, `test/me.test.ts` (or a new `test/name-search.test.ts`)

**Interfaces:**
- Produces: `searchText(input: string): string` (lowercase, NFD, strip `\p{M}`, trim, collapse whitespace); `normalizeSearchQuery(raw: string): string` (= `searchText` after dropping one leading `@` once trimmed); `nameSearchColumn(name: string | null): string | null` (`null` for null/blank name, else `" " + searchText(name)`); `SEARCH_MIN = 2`, `SEARCH_MAX = 30`.

- [ ] **Step 1: Write failing unit tests** in `test/search-text.test.ts`:
  - `searchText("  Martín   Gómez ")` → `"martin gomez"`; `searchText("ÑANDÚ")` → `"nandu"`.
  - `normalizeSearchQuery("@Cami.P")` → `"cami.p"`; `normalizeSearchQuery(" @ ")` → `""`.
  - `nameSearchColumn("Ana Camila")` → `" ana camila"`; `nameSearchColumn("   ")` → `null`; `nameSearchColumn(null)` → `null`.
- [ ] **Step 2: Write failing DB tests:** `updates name_search on PATCH /me` (signUp "Martín Pérez" → row has `" martin perez"`; PATCH name "Tomi" → `" tomi"`) and `on admin edit` (superadmin `PATCH /admin/users/{id}` name → column updated). Read the column with `env.DB.prepare("SELECT name_search FROM users WHERE id = ?")`.
- [ ] **Step 3: Run** `npx vitest run test/search-text.test.ts test/name-search.test.ts` → FAIL.
- [ ] **Step 4: Implement.** Migration: `ALTER TABLE users ADD COLUMN name_search TEXT;` (comment: normalized name with a leading space, for word-prefix search; see `src/lib/search-text.ts`). Mirror in `schema.ts`. `repo.updateProfile` binds `nameSearchColumn(next.name)` — that one statement covers `PATCH /me`, "Completá tu perfil" and the backoffice (`prepareProfileUpdate`). Seed: compute with the same function.
- [ ] **Step 5: Backfill script** `scripts/backfill-name-search.ts`: flag `--local` (default) or `--remote`; reads `SELECT id, name FROM users WHERE name IS NOT NULL` via `wrangler d1 execute rollo --json --command` (same shape as `d1()` in `scripts/seed/lib.ts`, with `--remote` when asked), writes `UPDATE users SET name_search = '…' WHERE id = '…';` lines to a temp `.sql` and runs it with `wrangler d1 execute rollo --file`. Idempotent; prints how many rows it wrote. Run it once with `--local` against a seeded local DB and check `SELECT COUNT(*) FROM users WHERE name IS NOT NULL AND name_search IS NULL` → 0.
- [ ] **Step 6: Run** the tests → PASS, plus `npm run db:check-schema` → no diff.
- [ ] **Step 7: Commit** `Usuarios: columna name_search para la búsqueda`.

### Task 2: `GET /users/search` with `RL_SEARCH`

**Files:**
- Modify: `src/modules/users/users.router.ts` (new `searchRoute`, registered **before** `profileRoute`: `UserParams` accepts any string, so `/search` would otherwise hit `/{userId}`)
- Modify: `src/modules/users/users.schemas.ts` (`UserSearchQuerySchema`, `UserSearchResultSchema` → `"UserSearchResult"`, `UserSearchSchema` → `"UserSearch"`)
- Modify: `src/modules/users/users.controller.ts`, `users.service.ts`, `users.repository.ts`
- Modify: `src/lib/rate-limit.ts` (`LimiterName` and `rateLimit(...)` accept `"RL_SEARCH"`), `src/types.ts` (`RL_SEARCH?: RateLimitBinding`), `wrangler.jsonc` (`{ "name": "RL_SEARCH", "namespace_id": "1005", "simple": { "limit": 60, "period": 60 } }` with a comment "Per user: user search"), `vitest.config.ts` (add `["RL_SEARCH", "1005"]`), `test/rate-limit.test.ts` (the binding list at line 26 and the env at line 68)
- Test: `test/user-search.test.ts`

**Interfaces:**
- Consumes: `normalizeSearchQuery`, `SEARCH_MIN`, `SEARCH_MAX` (Task 1).
- Produces (contract): `GET /users/search?q=<string>` → `200 { users: UserSearchResult[] }`, `400` (q too short/long after normalizing), `401`, `429`. `UserSearchResult = { id: uuid, name: string, username: string, avatarUrl: string | null, mutualCount: int, friendRequest: "none" | "sent" | "received" }`.
- Produces (internal): in `users.repository.ts`, `friendRequestStateFrom(rows, viewerId, ownerId, now): "none" | "sent" | "received"` extracted from `friendRequestState` (which then calls it), and `friendRequestRowsWith(db, viewerId, ownerIds: string[])` for one batched read.

- [ ] **Step 1: Write failing tests** in `test/user-search.test.ts` (helpers: `signUp(email, name, username)`, `befriend`, `api("PUT", "/blocks/{id}")`, `api("POST", "/users/{id}/friend-request")`). Each test uses unique name/username prefixes (e.g. a random 4-letter tag) so parallel test data never collides:
  - `matches by username prefix and by the start of any word of the name` — "Cami Sosa" (@zzcs), "Ana Camila" (@zzac), "Micaela" (@zzmi): q `cami` returns the first two, not Micaela.
  - `matches ignoring accents and case` — "Martín" found by `MARTIN` and `@Mart`.
  - `escapes LIKE wildcards` — q `a_` / `%%` returns only literal matches (none when nobody has them).
  - `excludes yourself, your friends, blocks either way and incomplete accounts` (`signUp(…, null, …)` and `signUp(…, "X", null)`).
  - `orders exact username, then mutual friends, then name` — exact handle first even with 0 mutual; among the rest 2 mutual before 1 before 0 (alphabetical).
  - `returns at most 20` — 22 matching users → 20.
  - `reports mutualCount and friendRequest` — `sent` after you send, `received` after they send, `none` otherwise.
  - `rejects q shorter than 2 or longer than 30 after normalizing` (`"@a"`, `" a "`, 31 chars → 400) and `requires a session` (401).
  - `has its own rate limit` — `env: { RL_SEARCH: fakeLimiter(0) }` → 429 with `RATE_LIMIT_MESSAGE`; `RL_EXPENSIVE: fakeLimiter(0)` alone does not block it.
- [ ] **Step 2: Run** `npx vitest run test/user-search.test.ts` → FAIL (404).
- [ ] **Step 3: Implement** `service.searchUsers(db, viewerId, rawQ): Promise<UserSearchRow[]>`: normalize; throw `badRequest("Escribí al menos 2 letras.")` / `badRequest("La búsqueda es demasiado larga.")`; one repository query and one batched friend-request read. Query constraints (the SQL is the builder's): viewer's friend ids as a CTE; `u.id <> viewer`, not in friends, `username IS NOT NULL`, `TRIM(COALESCE(name, '')) <> ''`, `NOT EXISTS` block either way; `u.username LIKE ?||'%' ESCAPE '\' OR u.name_search LIKE '% '||?||'%' ESCAPE '\'` with `%`, `_`, `\` escaped in q; `mutual_count` computed in the same query; `ORDER BY (u.username = q) DESC, mutual_count DESC, u.name COLLATE NOCASE, u.id LIMIT 20`. Route: `requireUser`, `rateLimit("RL_SEARCH")`; OpenAPI description states who appears, the order and the cap. Controller maps `avatarUrl(id, avatar_key)`.
- [ ] **Step 4: Run** the new test file plus `test/friend-requests.test.ts test/rate-limit.test.ts test/users*.test.ts` → PASS.
- [ ] **Step 5: Export the contract:** `npm run openapi` → `openapi.json` contains `/users/search`.
- [ ] **Step 6: Docs:** backend `CLAUDE.md` — the endpoint, `name_search` (who writes it, the backfill script) and `RL_SEARCH`.
- [ ] **Step 7: Commit** `Usuarios: GET /users/search con su propio límite`; open the backend PR to `develop`.

---

## App (`mobile`)

### Task 3: Spike the native search bar (manual, throwaway)

**Files:** none kept.

- [ ] **Step 1:** On a scratch commit, add to `FriendsScreen` `<Stack.Screen options={{ headerSearchBarOptions: { placeholder: "Buscar por nombre o @usuario", onChangeText: e => console.log(e.nativeEvent.text), onCancelButtonPress: () => console.log("cancel") } }} />` and run it on the simulator (`npx expo run:ios`, or `npm start` with the installed dev build).
- [ ] **Step 2:** Check: bar under the large title "Amigos", hidden until you pull down; typing logs text; "Cancelar" clears and logs; works inside `NativeTabs` on iOS 26. Take a screenshot.
- [ ] **Step 3:** If it works, drop the scratch change and continue. If it doesn't, **stop and tell the owner** (spec's plan B: a fixed search field above the list) before Task 6.

### Task 4: Matching, API call and search query hook

**Files:**
- Modify: `src/api/schema.d.ts` (generated: `API_SPEC=../backend/openapi.json npm run api:generate`)
- Create: `src/features/friends/search-text.ts`
- Modify: `src/features/friends/actions.ts` (`searchUsers`)
- Create: `src/features/friends/use-user-search.ts`
- Test: `src/features/friends/__tests__/search-text.test.ts`, `src/features/friends/__tests__/use-user-search.test.tsx`

**Interfaces:**
- Consumes: `GET /users/search` (Task 2).
- Produces: `searchText(input): string`, `normalizeSearch(raw): string` (same rules as backend Task 1), `SEARCH_MIN = 2`, `matchesSearch(user: { name: string; username: string | null }, q: string): boolean` (q already normalized; `""` matches nothing); `type UserSearchResult = Schemas["UserSearchResult"]`; `searchUsers(q: string): Promise<UserSearchResult[]>`; `userSearchKey = (q: string) => ["user-search", q] as const`; `useUserSearch(raw: string): { query: string; results: UserSearchResult[] | null; loading: boolean; error: string | null; refetch(): void; isRefetching: boolean }` — `query` is the normalized text, debounced 300 ms; the request runs only when `query.length >= SEARCH_MIN`; `placeholderData: keepPreviousData`, `staleTime: 30_000`; `error` uses `errorMessage(error, "No se pudo buscar")`.

- [ ] **Step 1: Write failing tests:** the same normalization cases as backend Task 1 Step 1; `matchesSearch` — "Ana Camila" matches `cami`, "Micaela" doesn't, `@cami.p` handle matches `cami.p`, `null` username only matches by name, `""` matches nothing. Hook: `does not call the API below 2 characters`, `calls searchUsers with the normalized text after the pause` (`"@Cámi"` → `"cami"`), `keeps previous results while the next query loads`, `exposes the error message`.
- [ ] **Step 2: Run** `npx jest src/features/friends/__tests__/search-text.test.ts src/features/friends/__tests__/use-user-search.test.tsx --maxWorkers=2` → FAIL.
- [ ] **Step 3: Implement** the three files (debounce as a small `useDebouncedValue` inside the hook file unless one already exists in `src/`).
- [ ] **Step 4: Run** the tests → PASS; `npm run typecheck` → clean.
- [ ] **Step 5: Commit** `Amigos: búsqueda de usuarios (lógica y API)` including `schema.d.ts`.

### Task 5: Request actions from a search row

**Files:**
- Modify: `src/features/friends/friend-request.ts` (`afterSearchAction`)
- Modify: `src/features/friends/use-friend-request.ts` (optimistic update of every `["user-search"]` query and, on accept, the friends list)
- Modify: `src/ui/components.tsx` (`Button` gets `size?: "regular" | "small"`; small = pill, `type.subheadline` semibold, horizontal padding 12, min height 30, full radius)
- Create: `src/features/friends/search-request-button.tsx`
- Test: `src/features/friends/__tests__/friend-request.test.ts`, `src/features/friends/__tests__/use-friend-request.test.tsx` (new)

**Interfaces:**
- Consumes: `UserSearchResult`, `userSearchKey` (Task 4); `useFriendRequest(userId)` (existing: `send`, `cancel`, `accept`, `busy`, `error`).
- Produces: `afterSearchAction(results: UserSearchResult[], userId: string, action: "send" | "cancel" | "accept" | "reject"): UserSearchResult[]` (send → `sent`; cancel/reject → `none`; accept → removes that user); `SearchRequestButton({ user }: { user: UserSearchResult })`: `none` → `Button` small "Agregar" (`accessibilityLabel` "Agregar a {name}"); `sent` → `MenuView` (`@expo/ui/community/menu`, like `friend-sections.tsx`) with action "Cancelar solicitud" over a small secondary "Enviada" ("Solicitud enviada a {name}, cancelar"); `received` → small "Aceptar" ("Aceptar solicitud de {name}"); the error text it renders comes from `useFriendRequest(user.id).error`.

- [ ] **Step 1: Write failing tests:** `afterSearchAction` for the four actions. Hook (render with a `QueryClient` seeded with `userSearchKey("cami")` data and `friendsKey`): `send flips the row to sent at once and back on error`; `accept moves the person to Amigos and rolls back on error` (search row removed and `{ id, name, username, avatarUrl, bio: null }` appended to `friendsKey` optimistically; both restored when `acceptFriendRequest` rejects); `onSettled invalidates ["user-search"]` too.
- [ ] **Step 2: Run** `npx jest src/features/friends/__tests__/friend-request.test.ts src/features/friends/__tests__/use-friend-request.test.tsx --maxWorkers=2` → FAIL.
- [ ] **Step 3: Implement.** In `onMutate`, cancel `["user-search"]`, snapshot `queryClient.getQueriesData({ queryKey: ["user-search"] })`, apply with `setQueriesData`; restore the snapshots in `onError`. Profile behaviour stays as is.
- [ ] **Step 4: Run** the tests plus `npx jest __tests__/friend-profile.test.tsx __tests__/friend-requests.test.tsx --maxWorkers=2` (existing users of the hook) → PASS.
- [ ] **Step 5: Commit** `Amigos: mandar, cancelar y aceptar solicitudes desde un resultado`.

### Task 6: Search bar and results in the Amigos tab

**Files:**
- Create: `src/features/friends/use-search-bar.ts`
- Create: `src/features/friends/friend-search-results.tsx`
- Modify: `src/features/friends/friends-screen.tsx`
- Test: `__tests__/friend-search.test.tsx`

**Interfaces:**
- Consumes: `useUserSearch`, `matchesSearch`, `normalizeSearch`, `SEARCH_MIN` (Task 4); `SearchRequestButton` (Task 5); `useFriends`, `Avatar`, `formatHandle`, `Row`, `Section`, `Footnote`, `Loading`, `ErrorText`, `Button`.
- Produces: `useSearchBar(): string` — sets `headerSearchBarOptions` on the current screen (`placeholder: "Buscar por nombre o @usuario"`, `onChangeText`, `onCancelButtonPress` → `""`) and returns the raw text; it is the only file that touches the native bar, so screen tests `jest.mock("@/features/friends/use-search-bar")`. `FriendSearchResults({ text }: { text: string })`.

- [ ] **Step 1: Write failing screen tests** with `renderRouter(routes, { initialUrl: "/friends" })`, `signInAs`, mocked `@/features/friends/actions` and a mocked `useSearchBar` returning a variable the test sets before rendering:
  - `shows the normal tab with no text` ("Invitar a un amigo" visible, `searchUsers` not called).
  - `with one character shows only matching friends` (section "Amigos" with "Cami"; `searchUsers` not called).
  - `shows Amigos and Personas` (`useFriends` has Cami; `searchUsers` resolves Camilo with `mutualCount: 3` → row detail "@cami.p · 3 en común", button "Agregar a Camilo Pérez").
  - `Agregar turns into Enviada at once` (await press → "Solicitud enviada a Camilo Pérez, cancelar"; `sendFriendRequest` called with his id).
  - `tapping a row opens the profile` (→ pathname `/friends/user/<id>`).
  - `shows the empty message` ("No encontramos a nadie con "zz".").
  - `shows the error with Reintentar and keeps the friends section`.
  - `shows the footnote with 20 results`.
- [ ] **Step 2: Run** `npx jest __tests__/friend-search.test.tsx --maxWorkers=2` → FAIL.
- [ ] **Step 3: Implement.** `FriendsScreen`: `const text = useSearchBar()`; when `normalizeSearch(text)` is non-empty, render `<Screen grouped><FriendSearchResults text={text} /></Screen>` instead of the usual content. `FriendSearchResults`: "Amigos" section = `friends.filter(f => matchesSearch(f, q))`, rows like the friends list with `value="Amigos"` and `chevron` default; "Personas" section only when `q.length >= SEARCH_MIN`, rows with `leading` avatar (40), `label` name, `detail` handle plus `· N en común` when `mutualCount > 0`, `accessory={<SearchRequestButton user={r} />}`, `onPress` → `router.push(\`/friends/user/${id}\`)`; `Loading` while there are no results yet; empty / error / 20-cap states with the exact copy from Global Constraints. The per-row error from `SearchRequestButton` shows as `ErrorText` right under that row (if `Section` draws a separator under it, render it below the section instead).
- [ ] **Step 4: Run** the new test plus `npx jest __tests__/friends.test.tsx --maxWorkers=2` (the existing tab must not change) → PASS; `npm run typecheck`.
- [ ] **Step 5: Check on the simulator** against the local backend (`npm run dev:lan` in `../backend` after `npm run db:migrate:local` + `npm run seed`; app with `EXPO_PUBLIC_API_URL=http://$(ipconfig getifaddr en0):8787`): search "lu", send and cancel a request, open a profile, light and dark mode, Dynamic Type large. Screenshot for the PR.
- [ ] **Step 6: Docs:** app `CLAUDE.md` — Amigos tab with the search bar (what it finds, who never appears, row actions), drop "buscar perfiles públicos" from "A futuro".
- [ ] **Step 7: Commit** `Amigos: barra de búsqueda de usuarios`; open the app PR to `develop` (with the spec and this plan).

### Task 7: Release order (needs the owner's OK at each prod step)

- [ ] **Step 1:** Merge the backend PR; release `develop` → `main` as usual; `npm run db:migrate:remote`.
- [ ] **Step 2:** `npm run deploy` (Worker with `RL_SEARCH`; it tolerates `name_search` NULL, while an old Worker would write `name` without `name_search` after a backfill); smoke test `GET /users/search?q=ju` with a real session → 200.
- [ ] **Step 3:** `npm run db:backfill-name-search -- --remote`; verify `SELECT COUNT(*) FROM users WHERE name IS NOT NULL AND TRIM(name) <> '' AND name_search IS NULL` → 0 on remote.
- [ ] **Step 4:** Only then ship the app (EAS Update `npm run update:production -- --message "…"` or the next build).
