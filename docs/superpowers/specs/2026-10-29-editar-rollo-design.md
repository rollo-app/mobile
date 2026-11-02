# Editar la configuración de un rollo — diseño

Fecha: 2026-10-29. Acordado con el dueño para el próximo build. Toca app y backend (`rollo-app/backend`).
Lo marcado *(decisión de Claude)* lo puede cambiar el dueño.

## Por qué

Un amigo creó un rollo rápido para probar la app, quería que durara más y no lo pudo cambiar: una vez creado, solo se
edita el nombre. Los admins tienen que poder corregir la configuración sobre la marcha, sin que un rollo pueda
volverse infinito.

## Lo decidido

### Quién edita

- **Cualquier admin** (no solo el creador) edita fechas, cupo y momento del día. Esto cambia la tabla de roles de
  `2026-10-28-rollos-archivar-y-admins-design.md`: la fila "Editar fechas, cupo, momento" pasa a ✓ para Admin.
- Siguen siendo **solo del creador**: rollo privado, revelar antes de tiempo, quitar admin, sacar a otro admin y borrar el
  rollo *(decisión de Claude)*.
- Lo valida el server (403 si no sos admin); la app solo muestra u oculta la entrada.

### Qué se puede cambiar y cuándo

| Campo | Antes del inicio | En curso | Terminado / revelado |
| --- | :-: | :-: | :-: |
| Nombre | ✓ | ✓ | ✓ (como hoy) |
| Inicio | ✓ | — | — |
| Fin | ✓ | ✓ | — |
| Revelado | ✓ | ✓ | — |
| Tipo de cupo (por día / todo el rollo) | ✓ | — *(decisión de Claude)* | — |
| Cantidad del cupo | ✓ | ✓ | — |
| Momento del día (Apagado / Solo foto / Dos cámaras) y franja | ✓ | ✓ | — |

- **Inicio:** solo mientras el rollo no empezó (el server compara con la hora actual; si arrancó mientras alguien
  editaba, rechaza con un mensaje y no guarda nada). Nunca en el pasado.
- **Fin:** antes o durante el rollo, para alargarlo o acortarlo; nunca en el pasado. Un rollo **terminado** no se
  edita (ni fechas, ni cupo, ni momento) *(decisión de Claude)*: reabrirlo confunde a todos.
- **Revelado:** igual que al crear ("al terminar" u otro momento, siempre ≥ fin). Si el rollo está en "al terminar"
  (el formulario lo carga así cuando `revealAt == endsAt`), acompaña el nuevo fin: la app manda los dos. Si es otra
  fecha y el fin nuevo queda después, el server rechaza con "El revelado no puede ser antes del fin" y la app lo muestra
  inline; nunca se corre el revelado solo *(decisión de Claude)*. Revelado ya no se edita nada salvo el nombre (y
  archivar, rollo privado, etc., como hoy).
- **Tipo de cupo:** solo antes del inicio, porque cambiarlo en curso deja cuentas raras (fotos de días pasados que de
  golpe cuentan contra un total) *(decisión de Claude)*. La **cantidad** sí se cambia en curso. Si alguien ya sacó
  más que el cupo nuevo, le queda 0; no se borra nada.
- **Momento del día:** modo y franja se cambian en curso. Con el rollo en curso, el cambio vale **desde mañana**: el
  momento de hoy (ya avisado o por avisar) queda como estaba, así nadie gana ni pierde uno por un cambio *(decisión de
  Claude)*. Apagarlo cancela los avisos futuros; los celulares lo levantan con `syncMoments()` (al abrir / volver a
  primer plano, como hoy cuando un rollo deja de venir en `/me/moments`). Prenderlo en curso también arranca mañana.
  Si después se acorta el fin, manda el fin nuevo (incluido "Era el último del rollo."): la config nueva puede no llegar
  a aplicarse nunca, y está bien *(decisión de Claude)*.
- **Solo se manda lo que cambió:** si el rollo arranca mientras un admin edita otra cosa, guardar no falla por el inicio
  que no tocó *(decisión de Claude)*.

### Topes (nuevos, al crear y al editar)

- Cupo **por día: hasta 30** fotos por persona (hoy 100).
- Cupo **de todo el rollo: hasta 200** (hoy 500).
- **Duración: hasta 31 días** entre inicio y fin.
- Los aplica el server en `POST /trips` y en `PATCH /trips/{id}`, con mensaje en español que la app muestra inline. Los
  steppers de Crear y Editar usan los mismos máximos.
- Los rollos que ya existen por encima de un tope quedan como están: el tope solo se chequea sobre el valor que se está
  cambiando (si alguien edita el fin de un rollo de 40 días, el nuevo fin tiene que respetar los 31) *(decisión de Claude)*.

### Dónde y cómo se ve

- Fila **"Editar rollo"** en el tablero (y en el segmento "Rollo" de un rollo revelado no aparece, porque ahí solo
  se edita el nombre, que ya tiene su fila), visible solo para admins y mientras el rollo no terminó *(decisión de Claude)*.
- Abre una pantalla **"Editar rollo"** con el **mismo formulario nativo** de Crear rollo (`@expo/ui`), con los valores
  actuales cargados. Lo que no se puede cambiar en esa etapa se ve **deshabilitado** con una línea de pie que dice por
  qué ("El rollo ya empezó: el inicio no se cambia.") *(decisión de Claude)*. Botón "Guardar"; manda solo lo que cambió.
- Éxito: se cierra y el tablero muestra los datos nuevos (invalidar el detalle y `/me/trips`). Error: inline debajo de
  "Guardar", sin perder lo cargado. Sin confirmación (nada es destructivo).
- **Sin aviso push** a los demás miembros: ven las fechas nuevas en el tablero *(decisión de Claude)*. Si el inicio se
  mueve, el aviso "Arrancó el rollo" y "Arrancó el rollo" en la app ya salen de las fechas del server.
- El nombre se sigue editando con su fila "Nombre" (no se duplica en "Editar rollo") *(decisión de Claude)*.

## Fuera de alcance

- Reabrir un rollo terminado o cambiar algo de uno revelado (salvo nombre).
- Cambiar la zona horaria del rollo.
- Avisos push por cambios de configuración.
- Historial de cambios ("Cami cambió el fin").

## Lo que queda para el builder

- Backend: sumar `startsAt`, `photoLimitMode`, `momentMode`, `momentWindowStart/End` a `UpdateTripSchema`; pasar el
  permiso de `updateTrip` de creador a admin (dejando `featuringDisabled` solo del creador); topes nuevos en create y
  update; reglas por etapa; cómo hacer que el momento de hoy no cambie (por ejemplo, que el cálculo del día use la
  config vigente al empezar ese día, o guardar la config nueva con "desde"). Actualizar la descripción de `momentMode`
  que hoy dice que no se puede cambiar. Tests.
- App: `npm run api:generate`; pantalla y ruta nueva (registrar en `app/_layout.tsx` y `src/test/routes.ts`); reusar el
  formulario de Crear sin duplicarlo; hook `use-update-trip.ts`; steppers con los topes nuevos; tests de pantalla.
- Actualizar CLAUDE.md (app y backend) y la tabla de roles del diseño anterior.
