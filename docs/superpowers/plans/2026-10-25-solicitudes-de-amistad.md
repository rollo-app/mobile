# Solicitudes de amistad — plan de implementación

Diseño: `docs/superpowers/specs/2026-10-23-solicitudes-de-amistad-design.md` (las *decisiones de Claude* quedan aprobadas).
Dos ramas `feature/solicitudes-de-amistad` (backend y app). Todo cambio del backend es **aditivo**: un build viejo sigue andando.

## Backend (`rollo-app/backend`, módulo nuevo `src/modules/friend-requests/`)

Contrato:

| Ruta | Qué hace |
|---|---|
| `POST /users/{userId}/friend-request` | Crea la solicitud → `{ status: "sent" }`; si el otro ya te mandó una, hace amigos → `{ status: "friends" }`. Idempotente (ya enviada o ya amigos no es error). 400 a vos mismo, 404 si no existe o hay bloqueo, 429 al pasar 30 por día. Si te rechazó, devuelve `sent` sin avisarle ni reenviar hasta pasados 30 días |
| `DELETE /users/{userId}/friend-request` | Cancela la que mandaste. 204 siempre |
| `GET /me/friend-requests` | Recibidas pendientes (sin rechazadas), más nuevas primero: `{ requests: [{ user, createdAt }] }` |
| `POST /me/friend-requests/{userId}/accept` | Hace amigos → `{ friend }`; 404 si no hay solicitud pendiente. Push `newFriend` a quien la mandó |
| `POST /me/friend-requests/{userId}/reject` | Marca `rejected_at` (silencioso). 204 siempre |
| `GET /users/{userId}` | suma `friendRequest: "none" \| "sent" \| "received"` (campo nuevo: los clientes viejos lo ignoran) |

- Migración `0020_friend_requests.sql`: tabla `friend_requests(from_user_id, to_user_id, created_at, rejected_at, PK(from,to))` + índice por `to_user_id`; `ALTER TABLE user_settings ADD COLUMN notify_friend_request INTEGER NOT NULL DEFAULT 1`. Drizzle (`schema.ts`) alineado (`npm run db:check-schema`).
- Push `friendRequest` ("Cami te mandó una solicitud de amistad", url `/friends`, una ruta que ya existe en el build viejo). Switch en `GET/PATCH /me/settings` (`notifications.friendRequest`, aditivo).
- Bloquear borra las solicitudes en ambos sentidos; borrar la cuenta también.
- Rate limit `RL_EXPENSIVE` en el POST además del tope de 30 por día (cuenta las solicitudes mandadas en las últimas 24 h).
- TDD, tests del diseño: cada estado, cruzada, bloqueo, tope, rechazo y reenvío a los 30 días, push al destinatario y no al actor, ajustes.
- Al final: `npm test`, `npm run typecheck`, `npm run db:check-schema`, `npm run openapi`.

## App (`rollo-app/mobile`)

1. `API_SPEC=<backend>/openapi.json npm run api:generate` (commitear `schema.d.ts`).
2. `src/features/friends/`: `actions.ts` (llamadas), `use-friend-request.ts` (enviar / cancelar / aceptar / rechazar con `useMutation`, optimista en el estado del perfil, invalida `GET /users/{id}`, solicitudes y amigos), `friend-request-button.tsx` (los cuatro estados), `use-friend-requests.ts` (recibidas) y sección "Solicitudes" arriba en la tab Amigos (solo si hay). Error inline con `ErrorText`.
3. Perfil de otro (`user-profile-screen.tsx`): el botón debajo del encabezado si no son amigos; no aparece si hay bloqueo (`blockedByMe`) ni sos vos.
4. Push: `notification-target.ts` abre la tab Amigos con `friendRequest`; Ajustes → Notificaciones suma "Solicitudes de amistad".
5. Lógica pura (estado del botón, optimismo) en `*.ts` con tests; pantallas con `renderRouter` mockeando `actions`.
6. `CLAUDE.md` (app): documentar las solicitudes. `npm test` y `npm run typecheck`.

## Choques esperables al integrar
`openapi.json` / `schema.d.ts`, `src/db/schema.ts` y el número de migración (0020), `user_settings` y `NOTIFICATION_COLUMNS`, `NotificationSettingsSchema`, y el switch de Ajustes → Notificaciones (comentarios también suma uno).
