# Galería "Diario" y Rollos como pantalla principal

Fecha: 2026-11-24 · Estado: borrador para aprobar · Maquetas: visual companion (`.superpowers/brainstorm/…/content/rediseno.html`)

## Por qué

1. **La Galería** (rollo revelado, tab Rollo en "Galería | Rollo") hoy es una grilla 3×3 cuadrada con un título por día: correcta
   pero genérica, igual a cualquier app de fotos. El revelado es el momento fuerte de Rollo y la galería es donde se vuelve
   a ese viaje; tiene que tener la personalidad de la app (hoja de contacto, fotolibro, captions en serif).
2. **Los rollos** se gestionan en una sheet ("Tus rollos", `/trips`) que se abre desde el nombre del header (`TripSwitcher`).
   Juani quiere que la primera pantalla de la app sea la lista de sus rollos, no un modal escondido detrás de un botón.

## Objetivos

- Galería con forma de **diario**: capítulos por día (o por grupo y franja horaria en eventos), una foto protagonista,
  algún caption como cita, el lugar del día, y el filtro por persona a la vista.
- La app abre en **Rollos**: la lista es la raíz de la primera tab; entrar a un rollo es un push dentro de esa tab.
- Mantener lo que ya funciona: tabs nativas, Mapa y Cámara siguiendo al rollo activo, selección y "Guardar todo",
  concurso, filtros de grupo, archivar/salir desde la lista.

## No objetivos

- No cambia el visor (`/photo/[id]`), la presentación, el revelado, el Mapa ni el Feed.
- No hay pantalla nueva "ver un día": un día largo se recorre scrolleando.
- Sin cambios de backend ni de contrato (todo sale de lo que ya trae el feed y `/me/trips`).
- No se rediseña el tablero del rollo (solo deja de depender del header con selector).

## Anti-objetivos (fracaso aunque "funcione")

- "Native slop": cards por todos lados, todo grande, fuentes descargadas, cobalto de relleno. La personalidad va en
  pocos detalles (serif New York, la foto grande, la cita).
- Que la galería se ponga lenta con ~2000 fotos: sigue siendo una sola FlashList virtualizada.
- Que durante el viaje la cámara quede más lejos que hoy.

## Enfoques considerados

**Galería:** A · Diario (elegida), B · Mosaico (filas justificadas con la proporción real; limpio pero sin personalidad),
C · Colecciones (portada con "Lo más lindo", días como montoncitos; escala bien pero agrega un toque para ver todo).
Juani eligió A.

**Navegación:** A · Lista y rollo en la misma tab (elegida), B · cada rollo como espacio propio con su barra de tabs
(clarísimo pero cámara a dos toques y dos barras distintas), C · como A sin tab Mapa, con el mapa como segmento dentro del
rollo (cuatro tabs; el mapa queda más lejos). Juani eligió A: es el cambio más chico y conserva las tabs.

## Diseño: Galería Diario

Vive en `src/features/gallery/` y sigue montada dentro de "Galería | Rollo".

**Encabezado de la galería** (al tope de la lista, `ListHeaderComponent`):
- Línea de resumen en secundario: "412 fotos · 8 personas · 3–8 ene" (en evento de un día: la fecha sola).
- **Fila de caras** para filtrar por persona (scroll horizontal): primero "Todos" (seleccionado por defecto), después cada
  autor con su avatar (`Avatar` de profile, inicial y `memberColor` sin foto) y su nombre corto. La elegida va con anillo
  cobalto (es selección: está permitido). Reemplaza "Filtrar por persona" del menú "⋯"; la etiqueta "Solo Cami" con la "x"
  desaparece (la cara elegida ya lo dice). Orden: el de los miembros (ver decisión 4). Accesible como botones con `selected`.
- Después, lo que ya está: la tarjeta del concurso (`header`) y el aviso de originales.

**Capítulos.** Cada capítulo tiene:
- Rótulo chico en mayúsculas secundario ("DÍA 3"), título en la **serif del sistema** ("Martes 5 de enero",
  `type` nuevo con `fontFamily` serif, tamaño ~22) y una línea secundaria "47 fotos · El Bolsón".
- **Foto grande**: la de más "me gusta" del capítulo (empate: la primera en orden). Ancho completo, proporción 4:3 recortada
  (`contentFit="cover"`). Solo si el capítulo tiene **4 fotos o más**; esa foto no se repite en la grilla.
- **Citas**: hasta **2 por capítulo**, de las fotos con caption (no vacío), elegidas por más "me gusta" y en orden de hora.
  Van en serif itálica con "Cami · 23:14" debajo. Se intercalan en la grilla: la primera después de la primera fila completa
  de fotos y la segunda a mitad del capítulo (si hay lugar). Tocar la cita abre esa foto en el visor. Con filtro por persona
  las citas también se filtran.
- **Grilla** 3 columnas como hoy (cuadradas, 2 pt), con todo lo de hoy en las celdas (selección, menú de mantener apretado,
  archivadas atenuadas, badge de momento, duración de video).

**Cómo se arman los capítulos** (lógica pura y testeada, extendiendo `group.ts` / `grid-items.ts`):
- **Rollo común:** un capítulo por día (`photo.day`, ya en la zona del rollo). Rótulo "DÍA N" según el día del rollo
  (desde `startsAt` en su zona).
- **Evento:** un capítulo por **grupo** (orden de los grupos del evento). Si un grupo tiene **más de 40 fotos**, se parte en
  sub‑capítulos por **franja de 2 horas** en la zona del rollo ("De 20 a 22 h"); las franjas vacías no aparecen. Sub‑capítulo
  = mismo formato pero el título es la franja y el rótulo el grupo. Si el evento dura más de un día, la franja lleva el día
  ("Sábado · de 20 a 22 h").
  - Una foto mandada a varios grupos aparece **una sola vez**, en el primero de sus grupos según el orden del evento
    (para que contar, seleccionar y guardar no dupliquen). Con el filtro de grupo puesto, aparece en ese grupo.
  - Un invitado que ve un solo grupo no ve el título de grupo: sus capítulos son directamente las franjas.
  - El filtro "Grupos" sigue en el menú "⋯" (no hay fila de grupos).
- Todo sobre arrays con `Map`/`push`, `O(n)`; memoizado en la pantalla.

**Lugar del capítulo.** Centro (mediana) de las coordenadas de las fotos del capítulo con GPS → `reverseGeocodeAsync` de
`expo-location` (ya instalado) → `city` (o `subregion`/`region` si no hay). Una consulta por capítulo, bajo demanda cuando el
capítulo se va a mostrar, con caché persistente por coordenada redondeada (~1 km) para no repetir (el geocodificador de
Apple limita la frecuencia). Sin red, sin GPS o si falla: la línea dice solo "47 fotos". En eventos no se muestra lugar
(el mapa no se muestra en eventos).

**Rendimiento.** Una sola FlashList: los ítems pasan a ser `chapter-header` | `hero` | `quote` | `photo` (cada uno con su
`getItemType`; encabezado, foto grande y cita ocupan las 3 columnas con `overrideItemLayout`). La carga paginada sigue igual:
capítulos y foto grande se calculan sobre lo cargado (la foto grande puede cambiar cuando llega otra página: aceptado;
"lo que se carga mientras scrolleás" ya pasa hoy con los días).

**Sin cambios:** toolbar (Seleccionar, "⋯" con Grupos y "Guardar todo en Fotos"), barra de guardado, selección, visor.

## Diseño: Rollos como pantalla principal

**Tabs:** Rollos · Mapa · Cámara · Amigos · Perfil. La primera pasa a llamarse **"Rollos"** con un ícono fijo (ya no cambia
a "Galería" después del revelado). Mapa y Cámara siguen como hoy, atadas al **rollo activo**, y después del revelado el botón
del centro sigue siendo Presentación.

**Raíz de la tab Rollos: la lista** (reemplaza `trips-screen.tsx` como pantalla, mismo `groupTrips`):
- Título grande "Rollos". Arriba a la derecha "+" (menú nativo): "Nuevo rollo" (`/create`) y "Sumate con un código" (`/join`).
- **Rollos en curso** como tarjeta grande (una por rollo en curso): fondo con el ThumbHash de la portada difuminado, badge
  LIVE, "Día 3 de 6", nombre y "Te quedan 6 fotos hoy" (o del rollo, con cupo total). Un botón redondo cobalto de cámara que
  abre `/capture` para **ese** rollo (lo deja activo antes). Tocar la tarjeta entra al rollo.
- Después los grupos de hoy: "Próximos" (los de `top` que no están en curso), "Revelados", "Anteriores · N" y
  "Archivados · N" plegados como hoy. Filas con **miniatura** cuadrada de 40 pt: el ThumbHash de `coverThumbhash` (la última
  foto subida; `TripSummary` no trae una foto real y no se toca el backend) y, en un evento con portada, `coverUrl`; sin ninguno,
  el degradado de color de hoy (`rowTint`). Nombre y subtítulo (`tripRowState`; revelados: "Se reveló el 2 de nov · 318 fotos",
  con `revealAt` y `totalUploaded`), chevron. Etiqueta "Evento" como hoy. Mantener apretado: archivar / desarchivar /
  salir como hoy (`FullWidthMenuView`).
- **Sin rollos:** la lista muestra la bienvenida actual (`roll/welcome.tsx`) como estado vacío.
- Se quita el check de "seleccionado": ya no es un selector.

**Entrar a un rollo:** push dentro del stack de la tab a una ruta con id (p. ej. `(tabs)/roll/[tripId]`), con "‹ Rollos" para
volver. Al abrirlo se guarda como rollo activo (`setActiveTripId`). La pantalla muestra lo de hoy (tablero, o "Galería | Rollo"
si está revelado) **para el `tripId` de la ruta**, no para el activo: si una push cambia el activo, el rollo abierto no cambia
de contenido. Título del header: el nombre del rollo (texto, sin chevron). El engranaje de "Ajustes del rollo" queda donde está.

**La app abre en la lista** (`app/index.tsx` redirige a la lista). Lo que hoy navega a `/roll` (push "se reveló", "arrancó el
rollo", links de evento, crear, unirse, presentación → galería, borrar/salir) pasa a abrir **ese rollo** con la lista debajo
(crear/unirse: el rollo nuevo; borrar/salir: vuelve a la lista).

**Mapa y Cámara:** el título del Mapa y del Feed pasa a ser el nombre del rollo activo como texto (sin selector). Para cambiar
de rollo se vuelve a Rollos y se abre otro. La cámara sin rollos sigue con el candado y lleva a la lista.

**Se borra:** `TripSwitcher`, la sheet `/trips` (ruta y registro en `_layout.tsx` y `src/test/routes.ts`) y la redirección de
la tab a "Galería" en `tabs.ts`. El revelado automático (`useFirstPresentation`) y "Arrancó el rollo" siguen atados al rollo activo.

## Restricciones

- Reglas de `mobile/CLAUDE.md`: `app/` solo rutea, lógica pura con tests, FlashList para listas largas, TDD, `--maxWorkers=2`,
  rioplatense en la UI, cobalto solo en acciones y selección, `dateFormatter` para fechas.
- iOS nativo: título grande, listas agrupadas, `MenuView`/menús nativos.
- Rendimiento con ~2000 fotos en la galería.
- Actualizar `mobile/CLAUDE.md` (Navegación y diseño, "Tus rollos", Galería) al terminar.

## Decisiones tomadas en la revisión (llamadas de Claude, a confirmar al leer)

1. **Datos de la tarjeta en curso.** `TripSummary` no trae cupo ni zona horaria. Cada rollo en curso (casi siempre uno) usa
   `useTripDetail` + `useTodayLeft` como hoy el rollo activo. Mientras no hay detalle (sin señal y sin caché), la tarjeta muestra
   solo "Día 3 de 6" contado con la zona del celular, y la línea del cupo aparece cuando llega el detalle.
2. **Fotos de un evento sin grupo** (`groupIds` vacío): van a un capítulo final "Otras fotos", así no desaparecen de la
   galería, los conteos ni "Guardar todo". Un invitado nunca recibe fotos de grupos que no ve (lo filtra el server).
3. **Revelado al abrir un rollo desde la lista.** Primero el push a `roll/[tripId]` y después `setActiveTripId`, así
   `useFirstPresentation` dispara con el rollo ya debajo. Presentación → "ver galería" vuelve a ese rollo (`dismissTo` de la
   ruta del rollo con `view: "gallery"`), nunca a la lista.
4. **Resumen y caras con la carga paginada.** El resumen usa datos completos (`totalUploaded` del rollo, cantidad de
   miembros del detalle, fechas del rollo), no lo cargado. Las caras siguen el orden de los miembros del detalle (el de
   `previewMembers`), no "más fotos primero", para que no se reordenen bajo el dedo; antes de tener todo ya se ofrecen todos los
   miembros, como hoy. "DÍA N" cuenta desde el inicio del rollo aunque haya días vacíos: un día sin fotos no tiene capítulo, pero
   la numeración sigue siendo la real.
5. **Lista debajo también en arranque en frío.** Un push o un link que abre `roll/[tripId]` con la app cerrada deja la lista
   debajo (`initialRouteName` / ancla del stack de la tab), y "‹ Rollos" siempre funciona.

## Lo que queda para quien construye

- Tamaños finos (serif del título, alto de la foto grande, tarjeta del rollo en curso) dentro de lo nativo.
- Cómo encaja el título grande del rollo con el header sólido de "Galería | Rollo" que hay hoy.
- Nombre exacto de rutas y componentes nuevos.
