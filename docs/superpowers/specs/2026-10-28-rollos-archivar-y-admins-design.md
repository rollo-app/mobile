# Archivar y eliminar rollos, y varios admins — diseño

Fecha: 2026-10-28. Acordado con el dueño para el próximo build. Toca app y backend (`rollo-app/backend`).
Lo marcado *(decisión de Claude)* lo puede cambiar el dueño.

## Por qué

Con el tiempo "Tus rollos" se llena: cada uno quiere sacar de la vista los rollos que ya no mira, sin borrar nada del
grupo. Y un rollo grande necesita más de una persona que lo administre, sin que el que lo creó pierda el control.

## Lo decidido

### 1. Archivar un rollo (solo para vos)

- Seguís siendo miembro y no cambia nada para el resto del grupo: nadie se entera.
- El rollo deja de aparecer en sus secciones de "Tus rollos" y pasa a **"Archivados · N"**, al final de la lista,
  colapsado como "Anteriores" (fila que se abre en el lugar, no recuerda nada) *(decisión de Claude)*.
- Desde "Archivados" se abre igual que cualquier rollo y se puede **desarchivar**.
- **Solo rollos revelados** *(decisión de Claude)*: esconder uno en curso haría perder el cupo o el momento del día sin
  darse cuenta. Sin revelar, la acción no aparece y el server responde 409.
- Lo guarda el server, por miembro, así se ve igual en otro celular *(decisión de Claude)*: el endpoint que ya existe
  `PATCH /trips/{id}/members/me` suma `archived: boolean`, y `GET /me/trips` trae `archived` en cada rollo.
- Archivar el rollo activo no cambia el activo *(decisión de Claude)*; si hoy el activo está entre los archivados,
  "Archivados" arranca abierto (igual que "Anteriores").
- Los avisos push de un rollo archivado siguen llegando como siempre *(decisión de Claude)*.
- `GET /me/trips` sigue trayendo los archivados completos, con el flag: solo cambia en qué sección los pone la app.

### 2. Eliminar un rollo de tu lista (= salirte)

- Es **salirse del rollo**, que ya existe (`DELETE /trips/{id}/members/me`): dejás de ser miembro, el rollo desaparece
  de tu lista y **tus fotos se quedan en el rollo**. Si no querés que queden, las borrás antes una por una (como hoy,
  "Eliminar" en tus fotos de un rollo revelado). Podés volver con el código.
- Lo nuevo es poder hacerlo **desde "Tus rollos"**, además de "Salirme del rollo" del tablero / segmento "Rollo".
  En la lista la acción se llama **"Eliminar"** y confirma con `Alert`: *¿Eliminar "{rollo}" de tus rollos?* /
  *Salís del rollo y tus fotos se quedan para el grupo. Podés volver con el código.* / "Eliminar" destructivo
  *(textos: decisión de Claude)*. Hace exactamente lo mismo que "Salirme" (cancela momentos, limpia el activo, invalida `myTripsKey`).
- Funciona en cualquier etapa. El **creador no puede** (no aparece; el server ya responde 409): él archiva o borra para todos.

### 3. Roles: creador, admin y miembro

| Puede… | Creador | Admin | Miembro |
| --- | :-: | :-: | :-: |
| Editar el nombre del rollo | ✓ | ✓ | |
| Hacer admin a un miembro | ✓ | ✓ | |
| Sacar a un miembro del rollo (y volver a sumar a alguien sacado) | ✓ | ✓ | |
| Sacar a otro admin del rollo | ✓ | | |
| Quitarle el admin a alguien | ✓ | | |
| Editar fechas, cupo, momento | ✓ | | |
| Revelar antes de tiempo | ✓ | | |
| Rollo privado (prender / apagar) | ✓ | | |
| Borrar el rollo para todos | ✓ | | |
| Borrar comentarios ajenos / fotos ajenas antes del revelado (moderación) | ✓ | ✓ | |
| Salirse del rollo | | ✓ | ✓ |

- **Creador**: el que creó el rollo (`trips.created_by`, ya existe desde la migración 0027). Uno solo; nadie lo puede
  sacar ni quitarle nada. Nadie puede sacar al creador ni a sí mismo. Los permisos de creador se chequean **solo** contra
  `created_by`. Los rollos con `created_by` en NULL se completan en la migración con el admin activo más viejo, y si no hay,
  con el miembro activo más viejo (que además queda admin) *(decisión de Claude)*: después de la migración ningún rollo con
  miembros queda sin creador.
- Salirse **pone el rol en `member`**: el que se sale nunca se lleva el admin *(decisión de Claude)*.
- "Volver a sumar a alguien sacado" es lo que ya existe: "Sumar amigos" con `reactivateRemoved`, que hoy solo puede el admin y
  ahora puede cualquier admin. Al sacado le quedan sus fotos en el rollo, como hoy.
- **Admin**: `members.role = 'admin'` (el esquema ya permite varios). El creador también tiene `role = 'admin'`.
- Un admin que se sale vuelve como **miembro** si regresa con el código *(decisión de Claude)*.
- Hacer admin y quitar admin: desde la lista de miembros del tablero / segmento "Rollo", en el menú de cada fila
  ("Hacer admin", "Quitar admin", "Sacar del rollo"; solo las que tu rol permite) *(decisión de Claude)*. Sin confirmación
  para hacer admin; `Alert` para sacar (como hoy) *(decisión de Claude)*. Sin aviso push *(decisión de Claude)*.
- La API sigue mandando `role` (`admin` | `member`, sin valores nuevos, para no romper el 1.1.0 instalado) y suma `isCreator`
  en cada miembro y en cada rollo de `/me/trips`, y `createdBy` (`{ userId, name }` o null) en el rollo; la app muestra u oculta las
  acciones por eso, pero **lo valida siempre el server** (403 si no te toca).
- **Si el creador borra su cuenta**: hoy el admin pasa al miembro activo más viejo. Ahora `created_by` pasa al **admin más
  viejo** que quede, y si no hay ninguno al miembro activo más viejo (que además queda admin) *(decisión de Claude)*:
  siempre hay un creador mientras haya miembros.

### 4. "Creado por"

- En chico y secundario, **"Creado por {nombre}"** en la sección de Fechas (el `RollDates` del tablero y del segmento "Rollo")
  *(decisión de Claude)*.
- En la lista de miembros, al lado del nombre, una etiqueta chica **"Creador"** o **"Admin"** (texto secundario, no cobalto).

### 5. Borrar el rollo para todos (solo el creador)

- Al final del tablero / segmento "Rollo", fila roja **"Borrar rollo"**, cualquier etapa.
- `Alert`: *¿Borrar "{rollo}" para todos?* / *Se borran todas las fotos de todos y no se puede deshacer.* / "Borrar" destructivo.
- Server: `DELETE /trips/{id}` (creador; otro → 403). **Al instante** se borran las filas de la base (un `db.batch`; me gusta,
  comentarios, destacadas y avisos caen en cascada con `media`) y queda una lápida en `deleted_trips` para responder 410; las claves de
  R2 van a una cola `r2_purge` que el **cron** vacía de a tandas *(decisión de Claude, por los límites de los Workers)*. Se borra: fotos y archivos en R2, me gusta, comentarios,
  destacadas en perfiles (también "Tu actividad"), denuncias, códigos, miembros. Sin aviso push *(decisión de Claude)*.
- En los demás celulares el rollo deja de venir en `/me/trips`; si era el activo, se limpia igual que hoy cuando un rollo
  desaparece. Fotos de ese rollo en la cola offline: las subidas a un rollo borrado responden **410** `{ error: "Este rollo se borró" }` (sin código; el `complete` de una foto ya registrada sigue en 404), distinto del 403 de "ya no sos miembro"; solo con ese 410 la app las descarta (fila y archivo) sin marcarse
  "no se pudieron subir". Las de alguien que se salió o al que sacaron siguen como hoy *(decisión de Claude)*. Se cancelan los momentos (`syncMoments` ya lo hace cuando un rollo deja de venir).

## Fuera de alcance

- Pasar el rol de creador a otra persona a mano.
- Avisos push por cambios de rol o por un rollo borrado.
- Archivar rollos sin revelar.
- Borrar todas tus fotos de un rollo de una (se borran una por una).

## Lo que queda para el builder

- Los nombres de columnas y la migración (por ejemplo `members.archived_at`), cómo se borra en R2 (en el request o en el cron)
  y el orden de los PRs (backend primero, después `npm run api:generate`).
- El gesto exacto en "Tus rollos" (deslizar la fila con `ReanimatedSwipeable` como en comentarios, o menú contextual), siempre que
  "Archivar" / "Desarchivar" y "Eliminar" queden accesibles con VoiceOver.
- Actualizar CLAUDE.md (app y backend), `topics.ts` si hace falta un "i" para los roles, y el seed con un rollo con dos admins y uno archivado.
