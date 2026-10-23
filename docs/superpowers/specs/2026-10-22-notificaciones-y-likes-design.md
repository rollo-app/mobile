# Notificaciones push, ajustes de usuario y "me gusta" — diseño

Fecha: 2026-10-22. Decidido con el dueño en la conversación; lo marcado *(decisión de Claude)* lo eligió el asistente y el dueño puede cambiarlo.
Va antes del próximo build de TestFlight (que hoy es producción y sale de `main`).

## Por qué

Rollo pasa días sin que nadie abra la app (el viaje, la espera del revelado). Los avisos son lo que trae a la gente de vuelta en los momentos que importan: te sumaron a un rollo, arrancó, se reveló, a alguien le gustó o destacó una foto tuya. Y cada uno tiene que poder elegir qué avisos recibe. Los "me gusta" suman la capa social mínima sobre las fotos reveladas y las destacadas.

## Objetivos

- Push reales en el build de producción (TestFlight), con Expo Push Service.
- Seis eventos que avisan, cada uno con un switch propio en Ajustes → Notificaciones.
- Tabla `user_settings` para preferencias de usuario (empieza con las notificaciones).
- "Me gusta" en fotos reveladas (entre miembros del rollo) y en destacadas de un perfil (quien pueda ver ese perfil).

## No objetivos (ahora)

- Modo viaje (el "momento" diario): usa esta misma infraestructura, pero es otro diseño.
- Comentarios, lista de quién dio "me gusta", feed de actividad/inbox de notificaciones dentro de la app.
- Android.
- Push en el dev build con la cuenta gratis de Apple (Personal Team no puede): ahí registrar el token falla en silencio.

## Anti-objetivos (sería un fracaso aunque funcione)

- Spam: muchos "me gusta" en ráfaga no pueden generar una push por cada uno.
- Filtrar privacidad: una push o un "me gusta" nunca revela un rollo, sus fotos ni sus miembros a alguien que no podía verlos.
- Avisos de alguien que bloqueaste (moderación) o avisos de tus propias acciones.
- Pedir el permiso de notificaciones apenas se abre la app.

## Restricciones

- Backend: Cloudflare Workers + D1 + R2, Hono + zod-openapi, el contrato se genera (`openapi.json` → `src/api/schema.d.ts` en la app). Migraciones nuevas, nunca editar una aplicada (la última aplicada en producción es la de moderación).
- App: Expo SDK 58, `expo-notifications` ya instalado, EAS proyecto `@rollo-app/rollo`. La clave de push de Apple ya está cargada en EAS para `com.juanifraga.rollo.app` (producción).
- El plugin `plugins/without-push-entitlement.js` saca el permiso de push porque el dev build usa la cuenta gratis: tiene que aplicarse **solo** en la variante de desarrollo (`APP_VARIANT` ≠ `production`, ver `app.config.ts`).
- Moderación existente: tabla `blocks` (bloqueos entre usuarios). Respetarla en avisos y "me gusta".
- Reglas de siempre: privacidad de los rollos (solo existen para sus miembros), textos en rioplatense con voseo, código en inglés, TDD, `app/` solo rutea, claves persistidas no se renombran.

## Lo decidido

### Envío: Expo Push Service

- El backend manda con `POST https://exp.host/--/api/v2/push/send` (lotes de hasta 100). *(Decisión de Claude: sin access token de Expo por ahora; si se activa "enhanced security" en expo.dev, se agrega como secret.)*
- Los "tickets" con error `DeviceNotRegistered` borran ese token al toque; los recibos (`/push/getReceipts`) los revisa el cron y borra los tokens muertos.
- Un módulo `src/lib/push.ts` en el backend: `sendPush(env, userIds, kind, message)` que filtra por preferencias y bloqueos, busca los tokens y manda. Nunca tira error hacia la acción que lo disparó (un aviso que falla no rompe "sumar a un rollo").
- Se manda **después** de que la acción quedó guardada, sin hacer esperar la respuesta (`ctx.waitUntil`).

### Token

- App: `Notifications.getExpoPushTokenAsync({ projectId })` (el `projectId` de EAS). Se registra con `PUT /me/push-tokens/{token}` (idempotente) al iniciar sesión y en cada apertura de la app con permiso concedido (el token puede cambiar), y se borra con `DELETE /me/push-tokens/{token}` al cerrar sesión. Borrar la cuenta borra todos.
- Backend: tabla `push_tokens(token PK, user_id FK cascade, created_at, last_seen_at)`. Un usuario puede tener varios celulares; un token pertenece a un solo usuario (si otro usuario registra el mismo token, pasa a ser suyo: es el mismo celular con otra cuenta).
- Permiso *(decisión de Claude)*: hoy `requestRevealPermission()` pide el permiso del sistema después de cada crear o unirse a un rollo, sin explicación. Se reemplaza por:
  - permiso ya concedido → se registra el token en silencio, sin preguntar;
  - permiso denegado → no se pregunta más; queda Ajustes → Notificaciones;
  - nunca pedido → en el próximo crear o unirse se muestra **una vez** una explicación propia ("¿Te avisamos cuando arranque y cuando se revele?", con "Activar" y "Ahora no") y, si acepta, el diálogo del sistema. Se recuerda en SecureStore con la clave nueva `rollo.pushPrimerSeen` (persistida: no se renombra).

### Los seis eventos

| Clave (`notifications.*`) | Cuándo | A quién | Texto (ejemplo) | Al tocarla abre |
|---|---|---|---|---|
| `addedToTrip` | un miembro te suma a un rollo (`POST /trips/{id}/members`, resultado `added`) | al sumado | "Cami te sumó a Bariloche" | el rollo (lo deja activo) |
| `newFriend` | alguien canjea tu link de amistad | al dueño del link | "Tomi ahora es tu amigo" | su perfil |
| `tripStarted` | llega `startsAt` de un rollo | a todos los miembros activos | "Arrancó Bariloche. Tenés 10 fotos hoy." | el rollo |
| `tripRevealed` | llega `revealAt` o el admin revela antes | a todos los miembros activos | "Se reveló Bariloche" | el revelado (`/reveal` si no lo viste) |
| `photoFeatured` | alguien destaca una foto tuya en su perfil | al autor (si no es el mismo) | "Cami destacó una foto tuya" | el perfil de Cami |
| `photoLiked` | a alguien le gusta una foto tuya | al autor (si no es el mismo) | "A Cami le gustó tu foto" | la foto |

- `tripStarted` y `tripRevealed` los dispara un **Cron Trigger del Worker cada 5 minutos** *(decisión de Claude)*: busca rollos con `starts_at`/`reveal_at` ya pasados y sin avisar, y los marca (`trips.started_notified_at`, `trips.revealed_notified_at`) para no repetir. El revelado manual del admin avisa en el momento y marca igual.
- **El aviso local del revelado que existe hoy se saca** *(decisión de Claude)*: con la push alcanza (si no hay señal, Apple la entrega al volver) y así no llega dos veces ni queda desfasado si el admin revela antes.
- **Anti-spam de "me gusta"** *(decisión de Claude)*: el primer "me gusta" de una foto avisa al toque; los que llegan en los 30 minutos siguientes no avisan pero se cuentan; el próximo "me gusta" después de esa ventana avisa sumando los que se callaron ("A Juan y 4 más les gustó tu foto"). Se guarda por foto cuándo fue el último aviso y cuántos se callaron desde entonces (columnas en `media` o una tabla chica); sin avisos pendientes ni trabajo extra del cron. Si nadie más da "me gusta" después de la ventana, los callados no se avisan (aceptado).
- Nadie recibe avisos de acciones propias ni de usuarios con los que hay un bloqueo (en cualquier sentido).
- Los textos de rollos llevan el nombre del rollo: solo los reciben sus miembros. Los de destacar y "me gusta" no nombran el rollo.

### `user_settings`

- Tabla `user_settings(user_id PK FK cascade, notify_added_to_trip, notify_new_friend, notify_trip_started, notify_trip_revealed, notify_photo_featured, notify_photo_liked` (enteros 0/1, todos **1 por defecto**)`, updated_at)`. Una columna por preferencia (no clave → valor), para validar y leer simple. Si un usuario no tiene fila, valen los defaults (no hace falta migrar a nadie).
- `profileVisibility` se queda en `users` *(decisión de Claude)*: ya funciona; lo nuevo va a `user_settings`.
- API: `GET /me/settings` → `{ notifications: { addedToTrip, newFriend, tripStarted, tripRevealed, photoFeatured, photoLiked } }` y `PATCH /me/settings` con cualquier subconjunto (lo omitido no cambia).

### Ajustes → Notificaciones (app)

- Fila "Notificaciones" en Ajustes que abre una pantalla con un `SwitchRow` por evento, con su explicación corta debajo (footnote). Guarda al cambiar (optimista, error inline si falla).
- Si el permiso de iOS está denegado o nunca se pidió: arriba, "Las notificaciones están desactivadas" con un botón que pide el permiso (si nunca se pidió) o abre los Ajustes de iOS (`Linking.openSettings()`) si se denegó; los switches se ven igual pero el texto aclara que no van a llegar.

### "Me gusta"

- Tabla `likes(user_id, media_id, created_at, PK(user_id, media_id))`, FKs cascade. Solo fotos (no videos) *(decisión de Claude, igual que destacadas)*. `PUT /media/{mediaId}/like` y `DELETE` (idempotentes).
- **Quién puede dar "me gusta"** (igual que quién puede ver la foto): un miembro activo del rollo, si ya se reveló; o alguien que puede ver un perfil (`canSeeProfile`) en el que esa foto está destacada. Si no, 404 (no revela que existe). Si hay bloqueo con el autor, 404.
- **Un solo contador por foto** *(decisión de Claude)*: los "me gusta" de miembros del rollo y los de quienes la vieron destacada en un perfil son el mismo `likeCount` (una sola tabla, sin origen). El autor recibe la push con el nombre de quien fue aunque no lo conozca (la foto la mostró públicamente el dueño del perfil). Tocarla le abre **su foto en la galería de su rollo** (`/photo/<id>?tripId=…`, que siempre puede ver; deja ese rollo activo).
- **Qué se ve:** cantidad (`likeCount`) y si te gustó (`likedByMe`), en el feed revelado y en las destacadas. *(Decisión de Claude: sin lista de quién dio "me gusta" por ahora; sería una fuga si alguien de afuera del rollo ve nombres de miembros.)*
- **UI:**
  - En el visor de la galería y en el visor de destacadas: corazón (`heart` / `heart.fill`) con la cantidad en el panel de acciones, y **doble toque sobre la foto** para dar "me gusta" (con un corazón que aparece y se va, y un háptico). El cobalto no va en el corazón: va el rojo del sistema cuando te gustó *(decisión de Claude: es el código universal del "me gusta", igual que LIVE)*.
  - En las historias de la presentación: doble toque también, sin contador visible (no distraer).
  - En la grilla no se muestra *(decisión de Claude)*.

## Qué queda para quien construya

- La forma exacta de los mensajes de Expo (sonido, `badge`, `data` para el deep link) y cómo la app abre la pantalla al tocar la push (`Notifications.addNotificationResponseReceivedListener` + el `url` en `data`).
- Cómo testear el cron (función pura que arma la lista de avisos + el handler `scheduled` del Worker).
- La animación del corazón (Reanimated, ya instalado).
- Dónde viven las piezas en la app: dominio nuevo `src/features/notifications/` (ya existe) para token, permiso y pantalla de ajustes; `src/features/likes/` para "me gusta".
- Rollos que ya arrancaron o se revelaron antes de este deploy no avisan: la migración los marca como avisados.
- El plugin `without-push-entitlement` se aplica solo en desarrollo desde `app.config.ts` (hoy está fijo en `app.json`).
