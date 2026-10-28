# Tu actividad: tus comentarios y quién destacó tus fotos — diseño

Fecha: 2026-10-27. Acordado con el dueño: entra antes del deploy del próximo build (es solo JS en la app, pero pide backend nuevo).
Sigue a `2026-10-23-tu-actividad-design.md`. Lo marcado *(decisión de Claude)* lo puede cambiar el dueño.

## Lo decidido

- "Tu actividad" (`/me/activity`) suma dos filas debajo de "Me gusta", cada una con su cantidad:
  - **"Comentarios"**: lo que comentaste.
  - **"Destacaron tus fotos"**: quién agregó una foto tuya a su perfil.
- **"Fotos que destacaste" no va**: ya están en la grilla de tu Perfil con la insignia del autor.

### Comentarios (`/me/comments`)

- Lista plana, del más nuevo al más viejo, una fila por comentario *(decisión de Claude)*: miniatura de la foto a la izquierda,
  tu texto (hasta 2 renglones) y "hace 5 min" debajo, en secundario.
- Tocar la fila abre el visor de la galería con los comentarios abiertos: `/photo/<mediaId>?tripId=…&comments=1`.
- Vacío: "Todavía no comentaste ninguna foto." Error: estado con "Reintentar".
- Mandar o borrar un comentario invalida esta lista.

### Destacaron tus fotos (`/me/featured-by`)

- Lista del más nuevo al más viejo: avatar de la persona, "Cami destacó tu foto", "hace 2 h" y la miniatura de tu foto a la derecha.
- Tocar la fila abre esa foto en su perfil: `/featured/<userId>/<mediaId>`.
- Vacío: "Nadie destacó tus fotos todavía." Error: estado con "Reintentar".
- Solo salen las de **otros** (las tuyas en tu propio perfil no).

## Privacidad (todo lo filtra el server)

- **Comentarios:** solo comentarios tuyos en fotos que **hoy** podés abrir en la galería: miembro activo de un rollo revelado, foto no
  eliminada, no archivada por su autor (salvo que sea tuya), sin bloqueo con el autor y sin denuncia tuya a la foto. Si recuperás el acceso, vuelven.
- **Destacaron tus fotos:** solo si hoy podés ver las destacadas de esa persona (`canSee`: amigos o perfil público) y la foto sigue
  destacada ahí. **Si el perfil es privado y no son amigos, no aparece** (decisión del dueño). Tampoco con un bloqueo en cualquier sentido.
  Apagar "Permitir que agreguen mis fotos a su perfil", el nivel del rollo, "No dejar que la destaquen" o archivar ya sacan la foto de esos
  perfiles, así que deja de salir sola.

## Destacar solo fotos de amigos (pedido del dueño, mismo build)

- Solo podés destacar **tus fotos o las de un amigo**. Se suma a las reglas de siempre (rollo revelado, miembro activo, los cuatro
  niveles de "Adónde pueden ir tus fotos", sin momentos ni videos). El server lo aplica en `PUT /me/featured/{mediaId}` y en `canFeature`
  del feed; la app ya esconde "Agregar a tu perfil" sin `canFeature`.
- **Si dejan de ser amigos** (cualquiera de los dos borra al otro) **o hay un bloqueo**, se sacan de los dos perfiles las fotos del otro.
  Volver a ser amigos no las devuelve (como el resto de los niveles).
- **Migración:** se borran las destacadas de hoy cuyo autor no es amigo del dueño del perfil.
- En la app: "Borrar amigo" y bloquear invalidan las destacadas (tu perfil) además de lo que ya invalidan; los textos de ayuda que hablen de
  destacar (`src/features/info/topics.ts`, CLAUDE.md) dicen que es con fotos de amigos.

## Backend (`rollo-app/backend`)

- `GET /me/comments?cursor=&limit=` → `{ items: [{ commentId, mediaId, tripId, text, createdAt, thumbPath, thumbHash }], nextCursor, total }`.
- `GET /me/featured-by?cursor=&limit=` → `{ items: [{ mediaId, user: <usuario público como en Amigos>, featuredAt, thumbPath, thumbHash }], nextCursor, total }`.
- Mismo estilo que `GET /me/likes`: cursor por fecha, página de 60 por defecto, `total` con los mismos filtros.
- Tests de cada regla de visibilidad, orden, paginación y `total`.

## App

- En `src/features/activity/`: `use-my-comments.ts`, `use-featured-by.ts` (`useInfiniteQuery`, como `use-my-likes.ts`), sus pantallas y
  las rutas `app/(tabs)/me/comments.tsx` y `app/(tabs)/me/featured-by.tsx` (también en `src/test/routes.ts`).
- `use-post-comment` / `use-delete-comment` invalidan `["my-comments"]`; las mutaciones de destacar/privacidad/archivar invalidan `["featured-by"]`.
- `npm run api:generate` contra el contrato nuevo y commitear `schema.d.ts`.
