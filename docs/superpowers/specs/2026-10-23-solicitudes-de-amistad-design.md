# Solicitudes de amistad desde un perfil — diseño (para el próximo build)

Fecha: 2026-10-23. Pedido del dueño: entra en el **build de TestFlight siguiente**, con comentarios, "Tu actividad" y "tus fotos en otros
perfiles". Antes de implementarlo, pasar por un plan (`docs/superpowers/plans/`) como el resto. Lo marcado *(decisión de Claude)* lo
puede cambiar el dueño.

## Por qué

Hoy la única forma de hacerse amigo es el link de amistad (`rollo://friends/<CODE>`). Si entrás al perfil de alguien (un miembro de tu
rollo, el autor de una foto, un amigo de un amigo), no podés agregarlo desde ahí.

## Lo decidido

- En el perfil de otra persona (`user-profile-screen.tsx`), si no son amigos, un botón **"Agregar amigo"** debajo del encabezado.
- Es una **solicitud**: la amistad existe recién cuando el otro la acepta (el link de amistad sigue igual: canjearlo hace amigos al toque).
- Estados del botón *(decisión de Claude)*:
  - no son amigos y no hay solicitud → **"Agregar amigo"**;
  - se la mandaste → **"Solicitud enviada"** (secundario; tocarlo ofrece "Cancelar solicitud");
  - te la mandó él → **"Aceptar solicitud"** (primario) y "Rechazar";
  - ya son amigos → como hoy (sin botón; lo de amigo: "Rollos en común", "Sumar a un rollo", "Borrar amigo").
- Si los dos se mandan solicitud, quedan amigos solos *(decisión de Claude)*.
- **Dónde se ven las recibidas:** arriba en la tab **Amigos**, sección "Solicitudes" con aceptar / rechazar por fila (solo si hay).
- **Push nueva** `friendRequest`: "Cami te mandó una solicitud de amistad" → abre la tab Amigos. Con su switch en Ajustes → Notificaciones
  (default prendido). Al aceptar, al que la mandó le llega el `newFriend` que ya existe ("Cami ahora es tu amigo").
- **Rechazar es silencioso** (el otro sigue viendo "Solicitud enviada"); *(decisión de Claude)* puede volver a mandar recién a los 30 días.

## Privacidad y abuso

- Solo se puede mandar a alguien cuyo perfil podés abrir (hoy: compañeros de rollo, autores de fotos que ves, listas de amigos que podés
  ver). No hay búsqueda de usuarios.
- Con un bloqueo en cualquier sentido: no se puede mandar, y las pendientes se borran. El botón no aparece.
- Tope *(decisión de Claude)*: 30 solicitudes enviadas por día.
- Mandar o cancelar una solicitud no revela nada nuevo: el perfil ya era visible.

## Backend

- Tabla `friend_requests(from_user_id, to_user_id, created_at, rejected_at, PK(from,to))`, FKs cascade.
- `POST /users/{userId}/friend-request` (crea o, si el otro ya te mandó, hace amigos), `DELETE` (cancelar),
  `POST /me/friend-requests/{userId}/accept`, `POST /me/friend-requests/{userId}/reject`, `GET /me/friend-requests` (recibidas).
- `GET /users/{userId}` suma `friendRequest: "none" | "sent" | "received"`.
- Columna `user_settings.notify_friend_request` (default 1) y `notifications.friendRequest` en `GET/PATCH /me/settings`.
- Tests: cada estado, solicitud cruzada, bloqueo, tope diario, rechazo y reenvío a los 30 días, push al destinatario y no al actor.

## App

- `src/features/friends/`: botón en el perfil (`friend-request-button.tsx`), sección "Solicitudes" en la tab Amigos, `use-friend-request.ts`
  (optimista), error inline.
- Ajustes → Notificaciones: switch "Solicitudes de amistad".
