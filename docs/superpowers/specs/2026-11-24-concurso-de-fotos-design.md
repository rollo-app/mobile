# Concurso de fotos en eventos

Fecha: 24/11/2026. Primer uso real: **el casamiento del 12/12/2026** (el primo de Juani; ~300 invitados, no todos van a usar la app).

## Para qué

Los novios quieren dar un **premio a la mejor foto** del casamiento para que los invitados usen Rollo durante la fiesta. El premio se anuncia en la portada del evento; después del casamiento los organizadores eligen las finalistas, todos votan y se anuncia la ganadora.

## Cómo funciona (lo decidido con Juani)

1. **Descripción del evento.** El evento tiene una descripción opcional en la portada, donde el organizador anuncia el premio. Se ve en el evento y en la página `/join` del sitio (link de invitación). Hoy no existe: `trips` solo tiene nombre, fechas y portada.
2. **Concurso opcional por evento, apagado por defecto.** No todos los eventos lo tienen: se elige **al crear el evento** (switch "Concurso de fotos" + **ventana de votación**, default **3 días**) y se puede prender, apagar o cambiar después desde editar evento, hasta el revelado. Con el concurso apagado, el evento funciona exactamente como hoy.
3. **Revelado previo para organizadores.** Cuando el evento termina y antes del revelado general, los organizadores (miembros activos con `role = 'admin'`: el creador y los admins que sume) ven **todas** las fotos y marcan las **finalistas**. Los invitados siguen sin ver nada.
4. **Las finalistas las elige el organizador sin restricción:** cualquier foto, aunque el autor la haya mandado a un solo grupo. No se le pide permiso al autor: los organizadores son los dueños del evento y tienen criterio para saber qué se puede mostrar. Una finalista la ven **todos** los miembros en la votación.
5. **El revelado general abre la votación.** El creador revela cuando quiere (o llega el `revealAt`); en ese momento todos ven sus fotos como siempre y además la pantalla del concurso con las finalistas.
6. **Cierre.** Al cerrar la ventana se anuncia la ganadora a todos los miembros con un push, y queda visible en el evento. El **autor** de la ganadora recibe un push personalizado.
7. **Todo sale en la misma versión que los eventos**, antes del 12/12 (Juani eligió no partirlo en dos entregas).

## Propuestas mías dentro de lo decidido (Juani no las objetó)

- **Un voto por persona**, se puede cambiar hasta el cierre. No se vota la foto propia. Votan los miembros activos, organizadores incluidos.
- **De 2 a 10 finalistas.**
- **Resultados ocultos hasta el cierre** (ni conteos ni ranking), para evitar el efecto manada.
- **Empate (incluido cero votos):** decide un organizador entre las empatadas; el anuncio sale cuando elige.

## Objetivos

1. Un organizador prende el concurso, anuncia el premio en la descripción y, después del evento, elige las finalistas desde el celular sin ayuda.
2. Un invitado con la app actualizada vota en dos toques desde el evento revelado.
3. La ganadora se anuncia sola al cierre (o cuando el organizador desempata), con el push al autor.

## Fuera de alcance

- Votación en la web.
- Pedir consentimiento al autor de una finalista.
- Premios múltiples (2.º, 3.º puesto) o categorías.
- Concurso en rollos de tipo `trip`.
- **Infra para 300 invitados** (tope de mails de login de Resend, almacenamiento de R2, cupo de 200 por evento en `EVENT_MAX_MEMBERS`): tarea aparte, pero **bloquea el casamiento** igual que esto.

## Lo que sería un fracaso aunque funcione

- Que un invitado vea fotos que no son de sus grupos **fuera** de las finalistas, o antes del revelado.
- Que la votación muestre resultados parciales.
- Que al cierre no se anuncie nada (cron que no corre, empate sin aviso al organizador).
- Que agregar el concurso ponga en riesgo la versión que tiene que estar en el App Store antes del 12/12: si se atrasa, se corta el concurso y sale el resto.

## Restricciones del sistema actual

- `isRevealed(trip)` = `revealed_at IS NOT NULL OR now >= reveal_at`: el revelado puede pasar solo, sin que nadie toque nada y sin escribir `revealed_at`. El cron (cada 5 min) manda el push "Se reveló" reclamando `revealed_notified_at`.
- La visibilidad de fotos de eventos vive en un solo lugar (`src/lib/event-visibility.ts` en el backend); todo camino que muestra fotos la aplica.
- Antes del revelado el feed devuelve solo metadata, y las descargas dan 403 (salvo el momento del día).
- Eventos: grupos, portada y edición congelados tras el revelado; `PATCH /trips/{id}` después del fin solo deja cambiar `name`.
- Reglas del repo: TDD, código en inglés, mensajes al usuario en español, contrato OpenAPI regenerado, migración antes del deploy.

## Enfoques considerados

1. **Todo junto antes del casamiento (elegido).** Una versión con descripción + concurso. Más trabajo en 18 días y más riesgo sobre la versión crítica, a cambio de no depender de una segunda revisión de App Review antes del revelado.
2. Dos entregas: descripción ya, concurso en una actualización antes del revelado. Menos riesgo; Juani lo descartó.
3. Votación en la web: sin App Review, pero obliga a armar login web y parte la experiencia. Descartado.

## Diseño

### Datos (una migración)

- `trips.description TEXT NULL`: trim, vacía → `null`, hasta 300 caracteres y 6 renglones (mismo criterio que `bio`).
- `trips.contest_enabled INTEGER NOT NULL DEFAULT 0`, `trips.contest_voting_hours INTEGER NOT NULL DEFAULT 72` (24 a 336, en la app se elige en días), `trips.contest_closed_at INTEGER NULL`, `trips.contest_winner_media_id TEXT NULL`, `trips.contest_tie_notified_at INTEGER NULL`.
- `contest_finalists (trip_id, media_id, position, created_at)`, PK `(trip_id, media_id)`, cascada con `trips` y `media`.
- `contest_votes (trip_id, user_id, media_id, created_at, updated_at)`, PK `(trip_id, user_id)` (un voto por persona; cambiarlo es un upsert), índice por `(trip_id, media_id)`.

**Cierre:** `closesAt = COALESCE(revealed_at, reveal_at) + contest_voting_hours`. Se calcula, no se guarda, así funciona igual con revelado manual o automático.

### Reglas

- **Configurar al crear** (`POST /trips` con `type: "event"`): acepta `description`, `contestEnabled` (default `false`) y `contestVotingHours` (default 72). En un `trip`, `contestEnabled: true` → 400.
- **Configurar después** (`PATCH /trips/{id}`, organizadores): `description` se puede editar siempre (como `name`). `contestEnabled` y `contestVotingHours` solo hasta el revelado; solo en eventos (en un `trip` → 400). Apagar el concurso borra las finalistas elegidas.
- **Revelado previo:** desde `ends_at` hasta el revelado, con el concurso prendido, un organizador puede listar y bajar **todas** las fotos del evento (thumb y display) para elegir. Antes de `ends_at` no: la fiesta sigue y la regla de "nadie ve nada" vale.
- **Finalistas** (`PUT/DELETE /trips/{id}/contest/finalists/{mediaId}`, organizadores): solo entre `ends_at` y el revelado, solo fotos (no videos, no la imagen vinculada de un momento), subidas y no borradas; máximo 10 (409). Congeladas al revelar.
- **Tiempo para elegir (decisión mía):** con el concurso prendido, `reveal_at` tiene que ser al menos **2 horas después de `ends_at`** (409 "Con concurso, el revelado tiene que ser al menos 2 horas después del fin, para que elijas las finalistas."); al prender el concurso, la app pasa el revelado a "Otro momento" y lo propone al día siguiente del fin. Al llegar `ends_at` el cron manda a los organizadores "Ya podés elegir las finalistas" (una vez, columna `contest_select_notified_at`), y si faltan finalistas 2 horas antes de `reveal_at`, un recordatorio (`contest_reminder_notified_at`).
- **Al revelar con menos de 2 finalistas:** el revelado manual da 409 "Elegí al menos 2 fotos para el concurso o apagalo." (también si se intenta antes de `ends_at`). Si el revelado es automático por `reveal_at`, el concurso queda **cancelado** (no se abre votación) y el cron avisa a los organizadores por push; las fotos se revelan igual. No se atrasa el revelado solo: eso lo decide el organizador.
- **Fotos que llegan después del fin** (cola offline): aparecen en la grilla de selección al refrescar y pueden ser finalistas.
- **Votar** (`PUT /trips/{id}/contest/vote` `{ mediaId }`): miembro activo, rollo revelado, antes de `closesAt`, la foto es finalista y no es propia (400). `DELETE` saca el voto. Si hay bloqueo con el autor o denunciaste la foto, esa finalista no se te muestra y no la podés votar.
- **Ver el concurso** (`GET /trips/{id}/contest`): estado (`off`, `selecting`, `voting`, `tied`, `closed`, `cancelled`), `closesAt`, finalistas (id, autor, archivos, dimensiones), `myVote`, y al cerrar la ganadora con su autor y la cantidad de votos de cada finalista. Durante `voting` nunca trae conteos.
- **Archivos de finalistas:** cualquier miembro activo los baja durante y después de la votación aunque no comparta grupo, por una ruta del concurso que solo sirve finalistas. La regla general de `event-visibility.ts` no cambia: el feed, los "me gusta" y los comentarios siguen igual, así que una finalista de otro grupo no aparece en tu feed ni se puede comentar.
- **Foto finalista archivada, borrada o con el autor fuera del evento:** sale del concurso; sus votos se descartan y esa gente puede volver a votar. La votación sigue con las que quedan: al cierre, con 1 gana esa; con 0 el concurso queda `cancelled` y se avisa a los organizadores.
- **Ganadora eliminada después del cierre:** `contest_winner_media_id` no tiene FK con cascada (queda el id); la tarjeta muestra "Ganó la foto de {autor}" sin imagen. Si fue archivada por el autor, igual: no se muestra la imagen a otros.
- **Cierre (cron):** cuando `now >= closesAt` y `contest_closed_at IS NULL`, se cuenta. Ganadora única → `UPDATE ... SET contest_closed_at, contest_winner_media_id WHERE contest_closed_at IS NULL` (un solo ganador del reclamo) y push. Empate → estado `tied`, push a los organizadores ("Hay un empate en el concurso: elegí la ganadora") una vez (`contest_tie_notified_at`), y `POST /trips/{id}/contest/winner` `{ mediaId }` (organizador, solo entre las empatadas) cierra y dispara el anuncio. Si nadie desempata, el cron repite el aviso a los organizadores **una vez por día** (`contest_tie_notified_at` guarda el último); no hay ganador automático.
- **Cómo se corta si no llegamos:** sin flag del lado del server. El concurso solo se prende desde la app nueva, así que si se recorta la app (no se muestra la sección "Concurso de fotos"), nadie lo prende y el backend queda inerte. La descripción va aparte y no depende del concurso.
- **Push:** al revelar un evento con concurso, el texto del push de revelado suma "¡Ya podés votar la mejor foto!". Al cierre: a todos los miembros activos "Ganó la foto de {autor} 🏆" (abre el concurso); al autor, en vez de ese, "¡Tu foto ganó el concurso de {evento}!". Usan `sendPush` (bloqueos y actor como siempre) con un tipo nuevo `contestResult` y su preferencia (`notify_contest_result`, default prendida).

### App

- **Crear evento** ("Rollo | Evento"): campo "Descripción" y sección "Concurso de fotos" con un switch **apagado por defecto**; al prenderlo aparece "Votación de N días" (1 a 14, default 3) y un botón "i" que explica cómo funciona. **Editar evento:** lo mismo, hasta el revelado.
- **Hero del evento:** la descripción debajo del nombre (se expande si es larga). La página `/join` del sitio (repo web) también la muestra, vía `GET /events/{code}`.
- **Organizador, entre el fin y el revelado:** en el evento aparece "Elegí las finalistas": grilla de todas las fotos (filtrable por grupo, como la vista de organizador), tocar marca/desmarca, contador "4 de 10". Al revelar avisa si faltan finalistas.
- **Todos, después del revelado:** tarjeta "Concurso de fotos" en el evento con la cuenta regresiva → pantalla con las finalistas, foto en grande, botón "Votar esta" / "Tu voto", no disponible en las propias.
- **Empate:** el organizador ve las empatadas con "Elegir ganadora".
- **Cerrado:** la tarjeta muestra la ganadora con su autor; la pantalla muestra los votos de cada una.
- **Builds viejos:** no ven nada del concurso (ignoran los campos nuevos); el resto funciona igual.

## Lo que queda para quien lo construya

- Nombres exactos de rutas, schemas y componentes, y si el estado del concurso va también dentro de `Trip`/detalle o solo en `GET /contest`.
- Cómo se ven las pantallas, dentro del estilo actual de eventos.
- El orden de las finalistas en la votación (sugerencia: al azar por persona, para no favorecer la primera).
- Partir el trabajo backend/app en workers.
