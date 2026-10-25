# Momento del día y cupo por rollo — diseño

Fecha: 25/10/2026. Las decisiones del dueño (Juani) van sin marca; lo marcado *(decisión de Claude)* lo puede cambiar él.

## 1. Momento del día (estilo BeReal)

### Por qué

Una vez por día del rollo, a cada miembro le llega un aviso a una hora random para sacar **una foto extra**. Es lo que en
BeReal arma el día: una foto que no elegiste cuándo sacar. En Rollo, además, suma fotos espontáneas al revelado y al
fotolibro. El viaje de enero pasa por muchos tramos sin señal, así que **tiene que andar sin señal**.

### Objetivos, y lo que lo haría fallar

- Suena a horario aunque el celular esté sin señal desde hace horas.
- Consultando la base de datos se sabe a qué hora le tocó a cada uno (trazabilidad).
- **Falla si la hora se filtra antes:** nadie puede saber por la app cuándo le va a tocar, ni a sí mismo ni a otro.
- Falla si rompe el build viejo de TestFlight (que no conoce momentos).
- No es una red de "quién llegó a tiempo": no hay "tardía" ni ranking.

### Reglas de producto

- **Aparte del cupo:** no descuenta del cupo del rollo (diario o total, ver 2). Una por día por persona.
- **Ventana de 5 minutos** desde la hora del aviso. Pasado ese tiempo el momento de ese día se pierde: no se puede sacar.
- **Hora distinta para cada uno.**
- **Franja horaria** configurable al crear el rollo, por defecto **9:00 a 23:00** en la zona del rollo (`trip.timezone`).
  Nunca avisa fuera de la franja.
- **Selfie sí o no**, configurable al crear el rollo.
- **Se puede apagar** en Ajustes → Notificaciones (switch "Momento del día").
- **En el revelado** va mezclada con las demás fotos, distinguida (ver "Selfie y badge").
- *(Decisión de Claude)* **El momento se puede apagar para todo el rollo** al crearlo (una noche de fiesta no lo necesita).
  Prendido por defecto. Al crear: "Momento del día" → Apagado / Solo foto / Foto + selfie (default Foto + selfie).
- *(Decisión de Claude)* **La config no se edita después de crear el rollo** en esta versión (evita re-sortear momentos ya
  bajados a los celulares).

### Planificación: el server sortea, el celular avisa

1. **El server sortea y guarda.** Tabla `trip_moments`, una fila por (rollo, usuario, día del rollo):
   `trip_id`, `user_id`, `day` (fecha local del rollo, `YYYY-MM-DD`), `notify_at` (instante UTC), `created_at`, y cuando
   llega la foto: `media_id`, `selfie_media_id`, `taken_at`, `in_window` (si la hora de captura cayó dentro de los 5
   minutos). PK `(trip_id, user_id, day)`. Esta tabla es la trazabilidad.
2. **Cuándo se sortea** *(decisión de Claude)*: cuando la app de ese usuario pide sus momentos (ver 3). El server sortea en
   ese pedido los días que falten y nunca vuelve a sortear un día ya guardado (idempotente). Así cubre a quien se suma con
   el rollo en curso, y un build viejo, que nunca pide momentos, nunca genera filas.
3. **`GET /trips/{tripId}/moments`** devuelve **solo los momentos del que pide**, de hoy en adelante: `[{ day, notifyAt }]`.
   Nunca devuelve los de otro miembro. Si el rollo tiene el momento apagado, si el usuario lo apagó en Ajustes o si no es
   miembro activo: lista vacía (no miembro: 404 como el resto).
4. **La app los programa como notificaciones locales** (`expo-notifications`, disparador de fecha absoluta: anda sin señal y
   con cualquier zona horaria del celular). Identificador `moment.<tripId>.<day>` para reprogramar sin duplicar.
5. **Cuándo baja y reprograma la app** *(decisión de Claude)*: con el mismo disparador que el mapa sin señal (al abrir la app y
   al volver a primer plano), desde **3 días antes del inicio** hasta el fin del rollo, para cada rollo en curso o por empezar
   donde sea miembro. Baja **todos los días que quedan** del rollo de una vez (un viaje de 2–3 semanas entra holgado en el
   límite de 64 notificaciones locales pendientes de iOS). Si hay más de 40 en total entre rollos, programa los más cercanos.
   *(Decisión de Claude)* Además reprograma desde la tarea de fondo `rollo-upload` cuando corre (ya pide red), así un rollo
   largo o varios rollos a la vez se van completando aunque la app no se abra. Las notificaciones ya programadas suenan sin
   que la app se abra: la tarea solo completa las que falten.
6. **Se cancelan** al cerrar sesión o cuando un `401` la cierra (otra cuenta en el mismo celular no recibe avisos de la
   anterior), al salirse del rollo y al apagar el switch. Al prender el switch o volver a iniciar sesión, se vuelven a bajar.

### Cómo se sortea la hora

- **La ventana del día** es la intersección de la franja con `[startsAt, endsAt]` del rollo, en la zona del rollo, quitando
  los últimos 5 minutos (el aviso tiene que dejar los 5 minutos dentro del rollo).
- *(Decisión de Claude)* Si esa ventana dura **menos de 30 minutos**, ese día no hay momento (por ejemplo, un rollo que
  arranca a las 22:45).
- La hora es uniforme dentro de la ventana, al minuto. Cambios de horario (DST) se calculan con la zona del rollo.

### Privacidad de la hora

- La hora **nunca se muestra** en ninguna pantalla antes de que suene.
- **No se guarda en el cache de TanStack Query** (se persiste en disco) ni en SecureStore: la respuesta se usa para programar
  las notificaciones y se descarta. El único lugar donde vive en el celular es el planificador de notificaciones del sistema,
  que el usuario no puede ver en iOS.
- El endpoint devuelve solo los propios. La única filtración posible es que alguien intercepte el tráfico de su propio celular
  y vea **su** hora: solo se arruina la sorpresa a sí mismo. Aceptado.
- *(Decisión de Claude)* Antes del revelado, el Feed muestra la foto del momento como cualquier otra ("Cami sacó una foto ·
  14:32"); eso es posterior a que sonó, no filtra nada.

### Los 5 minutos en la app

- **El aviso:** "Es tu momento del día en {rollo}. Tenés 5 minutos." *(texto: decisión de Claude)*. Tocarlo abre la cámara del
  momento (`/moment`, fullScreenModal) y deja ese rollo como activo, como las push que ya existen.
- *(Decisión de Claude)* Si abre la app dentro de la ventana sin tocar el aviso, la tab Rollo muestra arriba un aviso con la
  cuenta regresiva ("Tu momento · quedan 3:12") que abre la cámara. Solo aparece **dentro** de la ventana, nunca antes. La app sabe la hora del momento de hoy leyendo sus
  propias notificaciones programadas y entregadas (`getPresentedNotificationsAsync` / `getAllScheduledNotificationsAsync`),
  sin guardarla aparte.
- **La cámara del momento** es propia (`expo-camera`, ya es un paquete de Expo; *decisión de Claude* sobre
  `react-native-vision-camera`), solo foto, con la **cuenta regresiva** visible. Con selfie: después de la foto principal, la
  cámara pasa sola a la frontal y saca la selfie (~1080 px). Si se cierra la cámara antes de sacar, se puede volver a abrir
  mientras dure la ventana.
- Después, **la misma pantalla de caption que el resto** (foto difuminada, sin "Repetir", caption opcional, "Mandar al
  rollo"; ver el párrafo "Próximo build" de `CLAUDE.md`). Si la ventana vence mientras escribe el caption, la foto vale igual:
  cuenta la hora de captura.
- Pasados los 5 minutos, tocar el aviso abre una pantalla "Se pasó tu momento de hoy" *(decisión de Claude)*.
- Sin permiso de notificaciones no hay aviso, y el momento se pierde en silencio. El banner de Ajustes que ya existe lo explica.

### Subida

- La foto del momento entra a la **cola offline** como cualquier otra, con dos datos más: `momentDay` y, si tiene selfie, un
  segundo ítem `kind: "selfie"` que dice de qué foto es. Columnas nuevas en SQLite con migración que no toca las filas viejas.
- *(Decisión de Claude)* `momentDay` sale del `data` de la notificación que abrió la cámara (`{ tripId, day }`), no del reloj
  del celular, así viajar con otra zona horaria o un momento cerca de medianoche no cambian el día. El server exige que exista
  la fila `(trip, user, day)` en `trip_moments`; si no existe, 409.
- *(Decisión de Claude)* La selfie se sube **después** de que la principal terminó (`complete`), y lleva su `pairedMediaId`.
  Si la principal falla para siempre, la selfie se descarta con ella.
- *(Decisión de Claude)* Las demás reglas de subida son las de cualquier foto (miembro activo, rollo que acepta subidas): una
  foto de momento no tiene excepciones.
- El server la acepta **aunque llegue días después** y aunque `takenAt` caiga fuera de la ventana: no rechaza, solo guarda
  `in_window`. No descuenta cupo. Rechaza una segunda foto de momento para el mismo día (409). Un build viejo nunca manda
  `momentDay`, así que todo lo suyo sigue contando como foto normal.

### Selfie y badge en el revelado

- **La selfie es una foto aparte, vinculada a la principal**, nunca pegada en la imagen: la principal se imprime limpia y el
  fotolibro elige qué usar.
- En el **visor y las historias** se muestra como recuadro arriba a la izquierda; tocarlo intercambia las dos. Ese recuadro
  hace de badge.
- En la **galería y el mapa** cuenta como una sola foto (la principal) con un badge chico. *(Decisión de Claude)* El badge es el
  SF Symbol `bolt.fill` blanco sobre un círculo oscuro, en la esquina, del tamaño de la insignia de autor de las destacadas.
  Sin selfie, el visor y las historias muestran ese mismo badge.
- La selfie no se puede destacar sola ni tiene "me gusta" ni comentarios propios: todo va a la principal.

### Backend (resumen)

- Migración: tabla `trip_moments`; en `trips`, `moment_mode` (`off` | `photo` | `photo_selfie`, default `off` para no cambiar
  rollos viejos; la app nueva manda `photo_selfie` por defecto), `moment_window_start` y `moment_window_end` (minutos desde
  medianoche, default 540 y 1380); en `user_settings`, `notify_daily_moment` (default 1); en `media`, `moment_day` y
  `paired_media_id` (la selfie apunta a la principal).
- Crear rollo acepta los tres campos nuevos (opcionales). `GET /trips/{tripId}` los devuelve.
- `GET /trips/{tripId}/moments` (arriba). El upload de media acepta `momentDay` y `pairedMediaId` opcionales.
- El feed revelado devuelve `momentDay` y la selfie vinculada de cada principal; la selfie **nunca** sale como ítem aparte,
  tampoco para un build viejo, que ve la principal como una foto normal sin badge *(decisión de Claude)*.
- `GET/PATCH /me/settings`: `notifications.dailyMoment`.
- Tests: sorteo dentro de la ventana (franja, inicio y fin del rollo, día de menos de 30 min, DST), idempotencia, solo los
  propios, apagado por rollo y por usuario, foto fuera de ventana aceptada con `in_window = 0`, segunda foto del día rechazada,
  sin cupo, selfie vinculada fuera del feed.

### Para probarlo

*(Decisión de Claude)* En Ajustes → Desarrollo (solo dev), "Probar momento ahora": programa un aviso de momento en 10 s
para el rollo activo, con la ventana de 5 minutos, para probar la cámara y la subida sin esperar la hora random. El seed del
backend suma un rollo en curso con el momento prendido (foto + selfie). Las notificaciones locales sí andan en el dev build
(lo que no anda ahí son las push).

### Lo que queda al builder

- Nombres exactos de columnas, endpoints y campos, siempre que se respete lo de arriba.
- Cómo se ve la cámara del momento y la cuenta regresiva (estilo nativo, como dice `CLAUDE.md`).
- El paquete exacto para leer las notificaciones entregadas y la estrategia de reprogramación, siempre que no deje la hora
  guardada fuera del planificador del sistema.

## 2. Cupo diario o total

En implementación (worker "captura y cupo"). Al crear el rollo el admin elige el tipo de cupo:

- **Diario** (como hoy, por defecto 10 fotos por persona por día).
- **Total del viaje:** por ejemplo 20 fotos por persona para todo el rollo, sin límite por día.

Sin videos (se sacan de la app en el próximo build), el cupo es solo de fotos. Con cupo total la app dice "Te quedan N en el
rollo" y "Ya usaste todas tus fotos del rollo", y el cálculo offline cuenta todas las pendientes del rollo.
