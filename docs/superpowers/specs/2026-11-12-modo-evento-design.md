# Modo evento con grupos (Tarea 5)

Fecha: 12/11/2026. Primer uso real: **un casamiento el 12/12/2026**.

## Para qué

Rollo hoy sirve para un grupo que se conoce, como un viaje con amigos. En un evento grande, como un casamiento con más de 100 invitados, a cada invitado le interesan solo las fotos de la gente que conoce, no las de 150 desconocidos. Los novios, en cambio, quieren verlo todo.

El modo evento resuelve las dos cosas:

- Un rollo de tipo **evento** con **grupos** adentro ("Amigos del trabajo de él", "Colegio de ella", "Familia de él").
- Un **único QR** en el evento: el invitado lo escanea, entra, elige a qué grupos sumarse y saca fotos.
- Cada invitado ve solo las fotos de sus grupos.
- Los organizadores ven todas: mezcladas en orden cronológico y también separadas por grupo.

El casamiento del 12/12 es la prueba real. Si sale bien, es la base de los eventos pagos de la Fase 4.

## Objetivos

1. Un invitado que no tiene Rollo escanea el QR, instala la app desde la App Store, crea la cuenta, entra al evento, elige su grupo y saca su primera foto, sin ayuda.
2. Un invitado puede estar en **varios grupos**. Al mandar una foto elige a cuáles va, con un toque.
3. Los organizadores arman el evento y sus grupos desde la app, antes del evento.
4. Después del revelado, los organizadores ven todo junto en orden cronológico o separado por grupo. Cada invitado ve solo las fotos de sus grupos.
5. Llegar al 12/12 con la versión nueva **publicada en la App Store**.

## Fuera de alcance (por ahora)

- **Pagos y rangos de invitados** (productos de App Store, precios). Están frenados por la cuenta de Apple (Tarea 4). Este casamiento va regalado: el cupo de participantes se sube desde el panel, que ya existe.
- **Página de eventos en la web** con precios y ejemplos.
- **Etiquetas por etapa de la noche** ("ceremonia", "fiesta"). Ya se decidió no hacerlas; el orden cronológico alcanza.
- **Grupos creados por invitados.** Los grupos los crean **solo los organizadores**.
- **Registros cerrados.** Si en el evento los registros siguen cerrados, los invitados no pueden crear cuenta. Se decide más cerca de la fecha: abrirlos esa semana o hacer una excepción para eventos. No es parte de este diseño, pero **hay que resolverlo antes del 12/12**.

## Lo que sería un fracaso aunque funcione

- Que un invitado tenga que hacer más de un paso extra respecto de un rollo normal para sacar su primera foto. La mayoría está en un solo grupo y para ellos no tiene que haber ningún paso de más al mandar.
- Que un invitado vea fotos de grupos donde no está, o los nombres de gente que no conoce, antes o después del revelado.
- Que alguien con la 1.3 instalada entre a un evento y quede en un estado roto: sin grupos y viendo cosas que no debería.
- Que el QR lleve a una página sin salida para quien no tiene la app.

## Restricciones

- **Fecha:** 12/12/2026. La versión nueva tiene que estar en la App Store antes. Hay que mandarla a revisión con margen para un rechazo: a más tardar el **5/12**, mejor antes. Antes de eso, una prueba con amigos y familia.
- **Versión nativa:** la 1.3 está en la App Store. Este cambio sale en la **1.4**, que además trae el cambio a `rolloproject.com` (`associatedDomains: applinks:rolloproject.com`, ya en `develop`). Conviene no sumar paquetes nativos nuevos. Si hace falta uno, va en esa misma 1.4.
- **Compatibilidad:** las apps 1.3 instaladas no conocen los eventos. El server no las puede dejar entrar a un evento a medias.
- **Reutilizar lo que hay:** cupo de participantes (`max_members`, Tarea 2), cupo de fotos "Todo el rollo", revelado, originales (Tarea 3), Universal Links y el patrón de canje diferido del link de amistad (`rollo.pendingFriend`).

## Lo que se decidió

**El evento es un rollo.** Un evento es un rollo con un tipo nuevo, `event`; el de siempre es `trip`. Tiene nombre, inicio, fin, revelado y cupo de fotos como cualquier rollo, más una **portada** (foto) y una lista de **grupos**.

**Organizadores.** Quien crea el evento es organizador, y puede hacer organizadores a otros (el otro novio, una wedding planner). Los organizadores:
- ven todos los grupos y todas las fotos;
- crean, renombran y ordenan los grupos, y los editan hasta el evento;
- ven el QR y lo comparten o lo guardan para imprimir.

**Grupos.** Los crean solo los organizadores. Un invitado se suma a **uno o varios** y tiene que elegir al menos uno. Si no encuentra el suyo, elige el que más se acerque (sugerencia para los novios: armar un grupo "Amigos" o "General").

**Un solo QR por evento.** Lleva a `https://rolloproject.com/join/<CÓDIGO>`.
- Con la app instalada, la abre directo en el evento (Universal Link).
- Sin la app, una página del sitio muestra el nombre del evento, el botón de la App Store y el código grande para escribirlo después de instalar.

**Entrar como invitado.** Escanea el QR, se loguea o crea la cuenta si hace falta, completa el perfil (nombre y foto) y llega a una pantalla con la portada, el nombre del evento y la lista de grupos para tildar. Toca "Entrar" y queda en el evento, listo para sacar.

**Mandar una foto.** En la pantalla del caption, si el invitado está en **varios** grupos, aparecen como chips arriba de "Mandar al rollo". Arranca tildado el último grupo que usó y puede tildar más. Si está en **un solo** grupo, no aparece nada y queda igual que hoy. La foto se sube **una sola vez** y aparece en cada grupo elegido. En el cupo cuenta como **una** foto.

**Fotos de los organizadores.** Un organizador elige a qué grupos va su foto, como cualquier invitado, y además tiene la opción **"Todos los grupos"** para que la vea todo el evento, por ejemplo la del vals. No hace falta que esté en ningún grupo para mandar.

**Qué ve cada uno.**
- Un invitado ve las fotos de sus grupos: antes del revelado, su ThumbHash; después, la foto.
- Los organizadores ven todas.
- Después del revelado, los organizadores tienen **las dos vistas**: todo mezclado en orden cronológico y separado por grupo.

**Sin mapa, con ubicación.** En un evento no se muestra el mapa, pero la cámara pide y guarda la ubicación como en cualquier rollo (cambio de Juani del 12/11: puede servir más adelante).

**Cupos.**
- **Fotos:** cupo **total por persona en todo el evento** ("Todo el rollo", ya existe), que elige el organizador.
- **Participantes:** se sube desde el panel (Rollos → cupo). Sin pagos, ese es el camino para el 12/12.

**Revelado.** Fecha y hora que eligen los organizadores, por ejemplo al otro día a la tarde. Igual que hoy.

**Momento del día.** Apagado en los eventos.

## Decisiones mías (revisá estas)

1. **Modelo de datos: un solo rollo con grupos adentro, no un rollo por grupo.** Las tablas nuevas serían:
   - grupos del evento: `id`, `trip_id`, nombre, orden;
   - grupos de cada miembro: `member` ↔ grupo;
   - grupos de cada foto: `media` ↔ grupo.

   Así el revelado, los cupos, las originales y los avisos siguen andando sin cambios y la foto se guarda una sola vez. La alternativa (un rollo por grupo) obligaba a duplicar fotos y a sincronizar revelado y cupos entre rollos.
2. **Organizador = admin del rollo.** Se usa el rol `admin` que ya existe y el creador queda como hoy. No hace falta un rol nuevo.
3. **La 1.3 no entra a un evento.** `POST /trips/join` sin grupos sobre un evento contesta un error con el mensaje "Actualizá Rollo para sumarte a este evento.".
4. **Privacidad entre grupos.**
   - En la lista de integrantes, un invitado ve solo a los de sus grupos. Los organizadores ven a todos.
   - En el feed, los me gusta y los comentarios, solo cuenta lo de las fotos que puede ver.
   - Destacar fotos en el perfil **sigue prendido** en los eventos, como en cualquier rollo (lo decidió Juani). Las reglas que ya existen alcanzan:
     - solo se destacan fotos propias o de amigos;
     - el autor puede bloquearlo en cada foto;
     - una destacada nunca muestra el rollo ni el caption;
     - los organizadores pueden hacer el evento privado (`featuringDisabled`).
5. **Sumarse a más grupos después.** El invitado puede sumarse a otro grupo desde el tablero del evento. No puede salirse de su último grupo; para irse, se sale del evento.
6. **Feed antes del revelado.** Hoy vive dentro de la tab Mapa. En un evento esa tab se vuelve **Feed**, sin mapa: cambian el ícono y el título.
7. **Galería revelada.** Un filtro arriba, "Todos" más un chip por grupo, para cualquiera que vea más de un grupo. Los organizadores ven todos; un invitado con un solo grupo no ve el filtro. "Todos" es el orden cronológico de lo que cada uno puede ver.
8. **Portada.** Se sube como la foto de perfil (recorte, JPEG chico, R2). Es opcional; sin portada se muestra el nombre sobre un fondo liso.
9. **QR sin paquetes nativos.** Se genera en JS y se dibuja con `View`s o como imagen desde el server, para no meter `react-native-svg` solo por esto. Lo decide quien lo construya.
10. **Si alguien instala desde el QR, pierde el link.** iOS no pasa el link a una app recién instalada. Por eso la página del sitio muestra el código grande y, al abrir la app por primera vez, la pantalla de unirse pide el código. El link funciona directo para quien ya tiene la app.
11. **Crear un evento.** En "Crear rollo" se elige entre **Rollo** y **Evento**. Un evento pide nombre, inicio, fin, revelado, cupo de fotos (20 por defecto), portada y al menos un grupo. No tiene momento ni cupo diario.
12. **El QR usa el código de siempre del rollo** (el mismo de `POST /trips/join`). No es un código aparte ni se puede renovar. Quien fotografíe el QR impreso puede entrar hasta el revelado; para un casamiento es aceptable.
13. **Se entra a un evento solo con el código y eligiendo grupo.** "Sumar amigos" no existe en los eventos, y volver con el código después de salirse también pide grupos. El server garantiza que todo invitado tiene al menos un grupo; los organizadores pueden no tener ninguno.
14. **La visibilidad se calcula con los grupos de hoy.**
    - Si un invitado se suma a otro grupo, ve también las fotos viejas de ese grupo.
    - Una foto mandada no cambia de grupos.
    - Los organizadores no mueven a los invitados entre grupos. Pueden sacar a alguien del evento, como hoy.
15. **Editar grupos.** Los organizadores agregan y renombran grupos **hasta el revelado**, también durante la fiesta, por si se olvidaron de uno. Un grupo se borra solo si no tiene miembros ni fotos.
16. **Cola offline.** Si una foto pendiente sale con un grupo donde el invitado ya no está, el server ignora ese grupo. Si no le queda ninguno, la foto va a todos los grupos actuales del invitado.
17. **Después del revelado no entra nadie nuevo**, como hoy, con el mensaje "Este evento ya se reveló.". Si está lleno, se muestra el mismo mensaje de la Tarea 2, sin números.
18. **Revisión de Apple.** En las notas para el revisor va un evento de prueba armado en la cuenta de revisión (`REVIEW_EMAIL`), con su código, para que pueda probar el flujo sin escanear nada.
19. **Dominio.** Hay que verificar que `rolloproject.com` sirva `/.well-known/apple-app-site-association` con `/join/*` antes de mandar la 1.4.

## Lo que queda para quien lo construya

- Forma exacta de las tablas, los endpoints y el contrato: cómo viene el `type` en el resumen y el detalle, los grupos del evento y los de cada foto.
- Cómo se filtra el feed por grupo en el server sin romper la paginación (keyset por `taken_at, id` de la Tarea 1).
- La cola offline: una columna nueva, aditiva, con los grupos elegidos de cada foto pendiente.
- La página `/join/<código>` en `rollo-app/web` y el manejo del link en la app (`+native-intent`).
- Qué ve el panel de un evento: como mínimo el tipo y los grupos en el detalle del rollo.
- Textos de la UI en rioplatense, con los "native slop tells" de `expo-design-system` en mente.

## Calendario tentativo

| Cuándo | Qué |
|---|---|
| 13–24/11 | Backend y app: modelo, unirse con grupos, mandar a varios grupos, vistas |
| 25–30/11 | Crear evento, portada, QR, página `/join`; prueba con amigos y familia |
| 1–5/12 | Ajustes, build 1.4 y envío a revisión de Apple |
| 6–11/12 | Margen para un rechazo; decidir registros; imprimir el QR |
| 12/12 | Casamiento |
