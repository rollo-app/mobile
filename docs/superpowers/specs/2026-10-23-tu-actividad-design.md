# Tu actividad — diseño (para el próximo build)

Fecha: 2026-10-23. Acordado con el dueño: entra en el **build de TestFlight siguiente**, junto con los comentarios
(`2026-10-23-comentarios-design.md`). Antes de implementarlo, pasar por un plan (`docs/superpowers/plans/`) como el resto.
Lo marcado *(decisión de Claude)* lo puede cambiar el dueño.

## Por qué

En tu Perfil ves lo que ven los demás. Falta un lugar propio, que solo ves vos, para volver a lo que hiciste en la app.
Lo primero: las fotos que te gustaron.

## Lo decidido

- **Solo en tu Perfil** (no en el de otro). *(Decisión de Claude)* No es un tercer segmento de "Fotos | Mapa", porque ese control es lo
  que ven los demás: es una pantalla aparte.
- **Entrada:** un ícono en la barra de arriba del Perfil, al lado del engranaje (`clock.arrow.circlepath`), que abre
  **"Tu actividad"** (`/activity`, push en el stack de Perfil).
- **"Tu actividad"** es una lista agrupada de iOS. Por ahora tiene una sola fila, **"Me gusta"**, con la cantidad. Queda lista
  para sumar después: tus comentarios (cuando lleguen), fotos de otros que destacaste, quién destacó las tuyas.
- **"Me gusta"** abre una grilla con las fotos que te gustaron, de la más reciente a la más vieja (por fecha del me gusta). Lleva la
  insignia del autor si no sos vos, como en las destacadas. Tocar una abre el visor que corresponde:
  - si sos miembro activo del rollo revelado → el visor de la galería (`/photo/<id>?tripId=…`);
  - si no, pero la ves destacada en un perfil → el visor de destacadas (`/featured/<userId>/<mediaId>`).
  Desde el visor se puede sacar el me gusta; al volver, la foto ya no está en la grilla.
- **Sin rollo ni caption en la grilla** *(decisión de Claude)*: igual que en las destacadas, y así la misma pantalla sirve para fotos
  que viste fuera de tus rollos.

## Privacidad

- Solo salen las fotos que **hoy** podés ver, con las mismas reglas que el "me gusta": miembro activo de un rollo revelado, o
  `canSeeProfile` de un perfil donde la foto sigue destacada. Si te gustó una destacada y después el perfil pasó a privado, te
  borraron de amigos, la sacaron del perfil o hay un bloqueo con el autor, deja de aparecer (el me gusta queda guardado y vuelve
  a verse si recuperás el acceso).
- Lo filtra el **server**, nunca la app.

## Backend

- `GET /me/likes?cursor=…` → `{ items: [{ mediaId, likedAt, authorUserId, thumbPath, thumbHash, source: { kind: "trip", tripId } |
  { kind: "featured", userId } }], nextCursor }`, paginado por `likedAt`. Sin migración: la tabla `likes` ya existe (falta revisar si
  conviene un índice por `(user_id, created_at)`).
- Si una foto se puede ver por las dos vías, gana `trip`.
- Tests: cada regla de visibilidad de arriba (rollo no revelado, ex miembro, perfil privado, foto que dejó de estar destacada,
  bloqueo), orden y paginación.

## App

- Feature nueva `src/features/activity/` (pantalla de la lista y grilla de me gusta, `use-my-likes.ts` con `useInfiniteQuery`),
  rutas en `app/(tabs)/me/` y en `src/test/routes.ts`.
- Al dar o sacar un me gusta (`use-toggle-like.ts`), invalidar la query de "Me gusta".
- Vacío: "Todavía no te gustó ninguna foto." Error: estado con "Reintentar".
