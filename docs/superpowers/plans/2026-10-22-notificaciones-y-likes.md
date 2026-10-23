# Notificaciones push, ajustes de usuario y "me gusta" — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** push reales con Expo para seis eventos, preferencias por usuario (`user_settings`) con su pantalla, y "me gusta" en fotos reveladas y destacadas.

**Architecture:** el backend guarda tokens, preferencias y "me gusta", manda las push con Expo Push Service desde un módulo único (`src/lib/push.ts`) que filtra preferencias, bloqueos y acciones propias, y un Cron Trigger cada 5 min avisa "arrancó"/"se reveló" y limpia tokens muertos. La app registra el token, pide el permiso con una explicación propia, abre la pantalla correcta al tocar una push, tiene Ajustes → Notificaciones y el corazón de "me gusta".

**Tech Stack:** Cloudflare Workers + D1 + Hono + zod-openapi + vitest; Expo SDK 58, `expo-notifications`, TanStack Query, Reanimated 4, jest-expo.

**Spec:** `docs/superpowers/specs/2026-10-22-notificaciones-y-likes-design.md` (repo de la app). Es la autoridad: cada worker lo lee entero antes de su tarea.

## Global Constraints

- Ramas: backend `feature/notificaciones` desde `origin/develop`, trabajada en el worktree `/Users/juanifraga/Desktop/Rollo/backend-notificaciones` (el checkout normal del backend lo usa el dueño para otra tarea: no tocarlo); app `feature/notificaciones` (ya existe, tiene el spec).
- Migraciones nuevas desde `0012`; nunca editar una aplicada. Rollos que ya arrancaron/revelaron al aplicar la migración quedan marcados como avisados.
- Push: `POST https://exp.host/--/api/v2/push/send`, lotes de ≤100, sin access token por ahora. Nunca rompe la acción que la dispara; se manda después de guardar, con `executionCtx.waitUntil`.
- Nadie recibe avisos de sus propias acciones ni de usuarios con bloqueo en cualquier sentido (tabla `blocks`).
- Claves de preferencia exactas: `addedToTrip`, `newFriend`, `tripStarted`, `tripRevealed`, `photoFeatured`, `photoLiked` (API) ↔ columnas `notify_added_to_trip`, `notify_new_friend`, `notify_trip_started`, `notify_trip_revealed`, `notify_photo_featured`, `notify_photo_liked` (default 1; sin fila = defaults).
- Textos de las push (rioplatense): "Cami te sumó a Bariloche", "Tomi ahora es tu amigo", "Arrancó Bariloche. Tenés 10 fotos hoy.", "Se reveló Bariloche", "Cami destacó una foto tuya", "A Cami le gustó tu foto" / "A Cami y 3 más les gustó tu foto".
- "Me gusta": solo fotos; quién puede = miembro activo de rollo revelado, o quien puede ver (`canSeeProfile`) un perfil donde esa foto está destacada; si no, 404; bloqueo con el autor → 404. Un solo contador por foto. Anti-spam: primer "me gusta" avisa ya; los de los 30 min siguientes se callan y se cuentan; el siguiente después de la ventana avisa sumándolos.
- Clave nueva en el celular: `rollo.pushPrimerSeen` (no se renombra). Se saca el aviso local del revelado.
- Código en inglés, UI en rioplatense con voseo, commits en español con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. TDD. `app/` solo rutea. No crear subagentes. No dejar procesos corriendo.

## Review Focus

- Una push nunca nombra un rollo a alguien que no es miembro activo, y nunca llega por acciones propias o de un bloqueado.
- Doble aviso: el cron que corre dos veces seguidas, o el admin que revela a mano justo antes del cron, no manda dos "se reveló".
- Un token que pasa de una cuenta a otra en el mismo celular deja de recibir avisos de la cuenta anterior.
- "Me gusta" de alguien que no puede ver la foto (no es miembro, perfil privado, foto ya no destacada) → 404 sin filtrar que existe.
- El dev build (cuenta gratis, sin push) no se rompe: registrar el token falla en silencio.

---

## Parte 1 — Backend

### Task N1: Tablas y API de tokens y preferencias

**Files:** `migrations/0012_notifications.sql` (`push_tokens`, `user_settings`, `likes`, columnas de anti-spam en `media`: `like_notified_at`, `likes_since_notified`; en `trips`: `started_notified_at`, `revealed_notified_at` + `UPDATE` que marca los ya pasados), `src/routes/me.ts` (o `src/routes/settings.ts`), `src/schemas.ts`, `src/lib/account.ts` (borrar cuenta limpia tokens/ajustes/likes), `openapi.json`, tests.

**Produces:** `PUT /me/push-tokens/{token}` (204, idempotente; si el token era de otro usuario pasa a este; actualiza `last_seen_at`), `DELETE /me/push-tokens/{token}` (204); `GET /me/settings` → `{ notifications: { addedToTrip, newFriend, tripStarted, tripRevealed, photoFeatured, photoLiked } }` (booleans), `PATCH /me/settings` con subconjunto (400 si sobra o falta tipo); `getNotificationSettings(db, userIds)` para el backend.

- [ ] Tests primero (token idempotente y reasignado entre cuentas, formato inválido 400 — tokens tipo `ExponentPushToken[...]`, settings con y sin fila, PATCH parcial, borrar cuenta limpia) → RED → implementar → `npm test`, `npm run typecheck`, `npm run openapi` → commit "Notificaciones: tokens y preferencias".

### Task N2: Envío, eventos y cron

**Files:** `src/lib/push.ts` (+ tests con `fetch` simulado), hooks en `src/routes/trips.ts` (sumar a un rollo → `addedToTrip`; revelado manual del admin → `tripRevealed` y marca), `src/routes/friends.ts` (canje → `newFriend` al dueño del link), `src/routes/featured.ts` (destacar foto ajena → `photoFeatured` al autor), `src/index.ts` (handler `scheduled`), `wrangler.jsonc` (`triggers.crons: ["*/5 * * * *"]`), lógica pura del cron (`src/lib/trip-notices.ts`).

**Produces:** `sendPush(env, recipients: string[], kind: NotificationKind, message: { title?, body, url })` — filtra preferencias/bloqueos/actor, busca tokens, manda en lotes, borra tokens con `DeviceNotRegistered` en el ticket y guarda los ids de ticket para los recibos (tabla o columna, a elección); el cron: rollos con `starts_at <= now` y `started_notified_at` null → marca y avisa a miembros activos con el cupo del día; idem `reveal_at`/revelado → `tripRevealed`; recibos → borra tokens muertos. Cada push lleva `data.url` (deep link de la app: `/roll?trip=<id>`, `/user/<id>`, `/reveal?trip=<id>`, `/photo/<mediaId>?tripId=<id>`).

- [ ] Tests primero (filtros de `sendPush`; cada evento dispara al destinatario correcto y no al actor; cron idempotente y sin doble aviso con el revelado manual; recibos borran tokens) → RED → implementar → verdes → commit "Notificaciones: envío con Expo, eventos y cron".

### Task N3: "Me gusta"

**Files:** `src/routes/likes.ts` (o en `media.ts`), `src/routes/media.ts` (feed revelado: `likeCount`, `likedByMe` por ítem), `src/routes/featured.ts` (`FeaturedPhoto` suma `likeCount`, `likedByMe`), `src/schemas.ts`, `openapi.json`, seed (algunos "me gusta" en Bariloche), `CLAUDE.md` del backend, tests.

**Produces:** `PUT /media/{mediaId}/like` y `DELETE` (204, idempotentes, permisos de Global Constraints), push `photoLiked` con el anti-spam.

- [ ] Tests primero (permisos: miembro de rollo revelado / no revelado / no miembro / perfil público vs privado con la foto destacada / foto que dejó de estar destacada / bloqueo / video → 404 o 400; idempotencia; contador único; anti-spam: primero avisa, siguientes 30 min callados, el siguiente suma) → RED → implementar → verdes → commit "Me gusta: fotos reveladas y destacadas"; push de la rama y PR a `develop` (no mergear).

---

## Parte 2 — App (después de N3; contrato con `API_SPEC=<worktree del backend>/openapi.json npm run api:generate`)

### Task M1: Token, permiso y abrir la push

**Files:** `src/features/notifications/` (registrar/borrar token: `actions.ts`, `use-push-registration.ts`; permiso: `push-permission.ts` + primer `push-primer.tsx`; respuesta a la push: `use-notification-response.ts`), `src/storage/push-primer.ts`, `app.config.ts` (`without-push-entitlement` solo si `APP_VARIANT !== "production"`; sacarlo de `app.json`), quitar el aviso local del revelado (`reveal.ts`, su uso en `app/(tabs)/_layout.tsx`, `use-reveal-tap.ts` pasa a manejar las push), `create`/`join` (reemplazar `requestRevealPermission`), logout (borra el token del server), tests.

- [ ] Tests primero (registro al iniciar sesión y al volver a primer plano con permiso; nada sin permiso; logout borra; primer se muestra una sola vez y solo con permiso "nunca pedido"; tocar una push navega a su `url`; la variante de producción conserva `aps-environment` y la de desarrollo no) → RED → implementar → verdes → commit "Notificaciones: token, permiso y abrir la push".

### Task M2: Ajustes → Notificaciones

**Files:** `src/features/notifications/settings-screen.tsx` (o en `profile/`), `use-notification-settings.ts`, `app/notifications.tsx` (push en el stack raíz), fila en `src/features/profile/settings-screen.tsx`, rutas en `app/_layout.tsx` y `src/test/routes.ts`, tests.

- [ ] Pantalla con un `SwitchRow` por evento y su footnote; optimista con error inline; banner arriba si el permiso está denegado ("Abrir Ajustes de iOS") o nunca pedido ("Activar notificaciones"). Tests primero → verdes → commit "Ajustes: Notificaciones".

### Task M3: "Me gusta" en la app

**Files:** `src/features/likes/` (`actions.ts`, `use-toggle-like.ts` optimista sobre el feed y las destacadas, `heart-burst.tsx` con Reanimated, `like-button.tsx`), `src/features/gallery/photo-viewer.tsx`, `src/features/featured/featured-viewer.tsx`, `src/features/presentation/slide.tsx` / `story-player.tsx` (doble toque sin contador), tests.

- [ ] Corazón `heart`/`heart.fill` (rojo del sistema cuando te gustó) con la cantidad en el panel de acciones de los dos visores; doble toque sobre la foto da "me gusta" (no lo saca) con el corazón que aparece y se va + háptico; en historias, doble toque sin contador; respeta Reducir movimiento. Tests primero (toggle optimista, revierte con error, doble toque, contador, videos sin corazón) → verdes → commit "Me gusta: corazón en los visores y doble toque".

### Task M4: Docs y PR

- [ ] CLAUDE.md de la app (push, permiso, Notificaciones, "me gusta", clave nueva, el aviso local que se fue, conteo de tests); push de la rama y PR a `develop` que diga que depende de la PR del backend y qué probar en TestFlight (las push no andan en el dev build). No mergear.
