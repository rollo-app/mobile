# Comentarios en las fotos — diseño (para el próximo build)

Fecha: 2026-10-23. Acordado con el dueño: entra en el **build de TestFlight siguiente** al de notificaciones, link mágico y rediseño
del visor. Antes de implementarlo, pasar por un plan (`docs/superpowers/plans/`) como el resto. Lo marcado *(decisión de Claude)* lo
puede cambiar el dueño.

## Por qué

Después del revelado, el grupo quiere comentar las fotos ("¿quién sacó esto?", "jajaja"). Es la conversación natural del rollo y lo
que mantiene viva la app después del viaje.

## Alcance

- **Solo en fotos reveladas** (no videos *(decisión de Claude)*, igual que destacadas y "me gusta"), y **solo entre los miembros
  activos del rollo**.
- Se comenta desde el **visor de la galería**: en la fila de íconos, una burbuja (`bubble.left` / con cantidad) que abre una **sheet**
  con la lista (avatar, nombre, texto, hace cuánto) y un campo para escribir abajo. Texto plano, hasta 500 caracteres *(decisión de Claude)*.
- **No** se ven ni se puede comentar en las **destacadas de un perfil**: mostrar comentarios ahí revelaría nombres y conversaciones
  del rollo a gente de afuera (regla de privacidad de los rollos).
- **No por ahora:** respuestas en hilo, menciones con @, editar un comentario, comentar en las historias.

## Moderación (obligatoria para Apple, guía 1.2)

- Cada uno borra sus comentarios; el **autor de la foto** puede borrar cualquier comentario en su foto.
- Cualquier miembro puede **denunciar** un comentario (con lo que ya existe en `src/features/moderation/`: menú, mail a soporte).
- No se ven los comentarios de usuarios bloqueados (en cualquier sentido).

## Avisos

- Séptimo aviso push, **"Cami comentó tu foto"**, con su switch en Ajustes → Notificaciones (`notify_photo_commented`, `photoCommented`).
- *(Decisión de Claude)* también avisa a quienes ya comentaron esa foto ("Cami también comentó una foto"), con el mismo anti-spam
  que los "me gusta" (un aviso cada 30 min por foto, sumando los callados).
- Nunca por comentarios propios ni de bloqueados. Tocar el aviso abre la foto en la galería del rollo con la sheet de comentarios.

## Backend (esbozo)

- Tabla `comments(id, media_id, user_id, text, created_at, deleted_at)`; migración nueva.
- `GET /media/{mediaId}/comments`, `POST /media/{mediaId}/comments`, `DELETE /comments/{id}`, denuncia reutilizando el endpoint de
  moderación con un tipo `comment`.
- `commentCount` en los ítems del feed revelado. Permisos: miembro activo de un rollo revelado; si no, 404 sin revelar que existe.
