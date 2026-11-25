# Portada, descripción y QR para todos los rollos

Fecha: 2026-11-24 · Estado: borrador para aprobar · Maquetas: visual companion (`portada-qr.html`)
Repos: `rollo-app/backend` y `rollo-app/mobile` (el sitio `rollo-app/web` no necesita cambios de código, ver abajo).

## Por qué

La portada, la descripción y unirse por QR/link nacieron con los eventos, pero sirven para cualquier rollo: un viaje
también quiere su foto de portada, una línea de qué es y un QR para que se sume el grupo sin dictar un código. Hoy
el backend rechaza la portada de un rollo común, la vista previa del link (`GET /events/{code}`) da 404 para rollos
comunes y la app solo muestra QR, portada y descripción en eventos.

## Objetivos

- **Portada** opcional en cualquier rollo: al crearlo, en Editar rollo y en Ajustes del rollo (mismo recorte cuadrado de
  `/crop-cover`, mismo flujo de subida).
- **Descripción** opcional en cualquier rollo: al crearlo y al editarlo.
- **Tablero** de un rollo común con portada: arriba la portada grande de punta a punta con nombre y fechas, y la
  descripción debajo en serif (variante 2A, la misma pieza del tablero de un evento). Sin portada, solo la descripción;
  sin ninguna de las dos, igual que hoy.
- **Invitar**: además del código, la fila **"Código QR"** (la pantalla de QR de eventos) en cualquier rollo. Compartir
  la invitación manda el link `https://rolloproject.com/join/<CÓDIGO>` también en un rollo común.
- **Unirse por QR o link** a un rollo común: antes de entrar se ve portada, nombre, fechas, descripción y cuánta gente
  hay; "Unirme" te suma directo (sin paso de grupos). Sin cuenta, el código se guarda y se abre al terminar el registro,
  igual que con eventos.

## No objetivos

- Grupos, concurso, Feed en vez de Mapa y elegir grupos al entrar siguen siendo solo de eventos.
- No cambia el cupo de personas (`max_members`: 15 en rollos, el de eventos en eventos) ni quién puede invitar.
- No se rediseña la pantalla de QR ni la de unirse: se reusan.

## Anti-objetivos

- Duplicar componentes de eventos para rollos comunes ("trip-hero" copia de "event-hero"). Se generalizan los que hay.
- Romper los builds instalados o el sitio: el endpoint de vista previa mantiene su ruta y su forma.
- Exponer algo de un rollo a quien no tiene su código.

## Decisión de privacidad (de Juani)

**Quien tiene el código (por QR, link o escrito) ve, antes de unirse, la portada, el nombre, la descripción y cuánta
gente hay**, igual que en eventos. Sin el código no se ve nada. El código ya alcanzaba para entrar, así que la vista
previa no expone nada nuevo a quien no podía entrar. La cantidad sigue oculta con menos de 5 personas
(`PUBLIC_MEMBER_COUNT_MIN`). Se actualiza la regla de "Privacidad de los rollos" en `mobile/CLAUDE.md`.

## Enfoques considerados

- **Generalizar las piezas de eventos (elegido):** el backend deja de limitar portada y vista previa a eventos; la app
  usa los mismos componentes (portada, descripción, QR, vista previa) para cualquier rollo, condicionando solo lo que
  sigue siendo de eventos. Menos código y un solo comportamiento.
- **Endpoint y pantallas nuevas para rollos comunes:** separaría las dos cosas pero duplica todo y obliga a mantener dos
  vistas previas y dos QR.
- **Unirse directo sin vista previa ("Nada hasta entrar"):** descartado por Juani: escanear te metería en algo que no viste.

## Diseño

### Backend (`rollo-app/backend`)

- `src/modules/trips/cover.service.ts`: se saca `assertEvent` (portada para cualquier rollo). Se mantiene que la
  portada queda fija después del revelado, con el mensaje según el tipo ("Este evento ya se reveló." / "Este rollo ya
  se reveló."). Permisos: los mismos que hoy (quien puede editar el rollo).
- `src/modules/events/events.service.ts` (`previewEvent`, ruta `GET /events/{code}`, sin sesión): responde para
  cualquier rollo, con `groups: []` en uno común. Se suman `type`, `startsAt`, `endsAt` y `timezone` a la respuesta
  (aditivo) para que la vista previa muestre las fechas. 404 solo si el código no existe.
- `POST /trips` y `PATCH /trips/{id}` ya aceptan `description` en cualquier rollo: no cambian.
- Contrato: regenerar OpenAPI; la app regenera `schema.d.ts`.
- El texto de la ruta y del router deja de decir "evento" donde ahora es "rollo o evento".

### App (`rollo-app/mobile`)

- **Crear rollo** (`create-screen.tsx`): `DescriptionSection` y la sección de portada (recorte + `useUploadCover`) para
  los dos tipos. Pie de la descripción: "La ve cualquiera que tenga el código o el QR, antes de unirse."
- **Editar rollo / Ajustes del rollo** (`edit-screen.tsx`, `roll-settings-screen.tsx`): portada y descripción para
  cualquier rollo (hoy condicionadas con `isEvent`).
- **Tablero** (`RollBoard` y el segmento "Rollo" del rollo revelado): el hero de portada (`EventBoardHero` deja de
  devolver `null` para rollos comunes; se renombra si su nombre queda engañoso) arriba, antes de la hoja de contacto.
  En un rollo común la línea bajo el nombre son las fechas ("3 al 8 de enero · 8 personas"); en un evento sigue como hoy.
- **Invitar** (`roll-essentials.tsx`, `RollInvite`): "Código QR" para cualquier rollo sin revelar, para quien hoy la ve
  en eventos (organizador) y, en un rollo común, para cualquier miembro (cualquiera puede invitar con el código).
  `Share` manda siempre `joinLinkUrl(code)`.
- **QR** (`app/event-qr.tsx` → `qr-screen.tsx`): sirve para cualquier rollo. La ruta puede quedar como está (no se
  renombra por ahora: la usan builds y tests).
- **Unirse** (`join-screen.tsx`, `use-preview-event.ts`, `join-route.tsx`): con un código de rollo común la vista previa
  muestra portada, nombre, fechas, descripción y cantidad, y "Unirme" llama a `POST /trips/join` sin grupos. Sin portada,
  la vista previa usa el fondo neutro que hoy usa un evento sin portada. Rollo lleno o revelado: el mismo mensaje del
  server que al escribir el código.
- **Rollos**: la tarjeta en curso y las filas ya muestran `coverUrl` (rama `feature/galeria-diario-y-rollos`).

### Sitio (`rollo-app/web`)

La página `/join/<CÓDIGO>` ya pide `GET /events/<CÓDIGO>` y muestra nombre y portada; con el backend nuevo deja de dar
"no es de un evento" para rollos comunes. Revisar sus textos que dicen "evento" y cambiarlos a "rollo" donde aplique
(cambio de copy, fuera de este plan si no hace falta tocar código).

## Decisiones tomadas en la revisión (llamadas de Claude, a confirmar al leer)

1. **Escribir el código** en un rollo común sigue uniéndote directo, como hoy (ya sabés adónde vas). La vista previa es
   para el QR y el link. Si ya sos miembro activo y escaneás el QR, no hay vista previa: se abre el rollo.
2. **Rollo común ya revelado**: la vista previa muestra portada, nombre y "Este rollo ya se reveló." sin "Unirme" (sale de
   `revealed`, como en eventos; no hace falta un campo nuevo).
3. **"Código QR"** en un rollo común: cualquier miembro, solo sin revelar y deshabilitado si está lleno (igual que el
   código). Compartir la invitación ya lo puede hacer cualquier miembro.
4. **Descripción**: la edita cualquier admin en cualquier etapa (el backend ya lo permite: "once ended or revealed only
   `name` and `description`"). La portada, cualquier admin hasta el revelado.
5. **Portada al crear que falla al subir**: el rollo queda creado sin portada y se puede reintentar desde Editar rollo,
   como hoy con eventos (`use-upload-cover`); nunca se vuelve a crear el rollo.
6. **Sitio**: con `groups: []` y los campos nuevos opcionales la página `/join` no se rompe; solo revisar textos que digan
   "evento".

## Restricciones

- Reglas de `mobile/CLAUDE.md` (TDD, `app/` solo rutea, cobalto solo en acciones, rioplatense) y del backend
  (`rollo-app/backend/CLAUDE.md`).
- Compatibilidad: builds instalados siguen funcionando (la vista previa mantiene ruta y forma; los campos nuevos son
  opcionales para la app vieja).
- Los dos repos van en ramas con el mismo nombre para que el job `contract` del CI compare contra la rama del backend.

## Lo que queda para quien construye

- El nombre final de los componentes generalizados (`EventHero` → algo neutro) y si se mueven de `events/` a `trips/`
  (si los usan dos features, `src/ui/` no aplica porque conocen datos).
- Tamaños y la línea bajo el nombre en el hero.
- Orden de las filas en Ajustes del rollo.
