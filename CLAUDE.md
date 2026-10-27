# Rollo — app mobile

Contexto para Claude Code. Respondé en español rioplatense (voseo), conciso y con recomendaciones directas.
La UI de la app también va en rioplatense con voseo ("Sumate", "Abrí un rollo", "Te quedan 3 fotos").

## Qué es Rollo

App iOS para fotos y videos en grupo. La unidad es el **rollo**: un viaje, un evento, una fiesta, la última
semana de facultad. Cada uno saca fotos durante el rollo y **una vez mandadas nadie las ve —ni siquiera
las propias— hasta el revelado**, como un rollo de fotos. Es un MVP de red social. Pensada para un viaje con
amigos al sur de Argentina en **enero de 2027** (mucho tramo sin señal) y para armar fotolibros después.

Decisiones de producto:

- **Solo iOS** en la primera versión. **Con cuentas:** login con **email + código de 6 caracteres (letras y números, vale 5 min)** (sin
  contraseña), obligatorio al abrir la app (`app/(auth)/`: email → código → "Completá tu perfil" si es nueva o
  no tiene nombre). El perfil es **nombre + foto + descripción opcional** (`bio`, hasta 150 caracteres y 3 renglones; `GET/PATCH /me`, foto con `expo-image-picker` (cámara: recorte nativo 1:1; galería: PHPicker sin edición + recorte propio en `/crop-avatar`, `avatar-crop.tsx`) →
  512 px JPEG → `POST /me/avatar` → PUT → complete; sin foto, círculo con la inicial y `memberColor`). Además tiene un **nombre de usuario único** (`@usuario`, `PATCH /me`): se pide en "Completá tu perfil" junto al nombre
  (sugerido desde el email, con chequeo de disponibilidad) y se muestra en Perfil, Amigos, miembros y Feed. Crear rollo
  o unirse es solo con el código de 6 (`POST /trips/join`; el server pide nombre en el perfil). **La sesión es un
  único token en SecureStore (`rollo.session`)** que usan todas las llamadas; un `401` en cualquiera cierra la
  sesión local y vuelve al login (`setUnauthorizedHandler` en `src/api/client.ts`). Los rollos salen de
  `GET /me/trips` (cache de TanStack Query); el rollo activo es el último que abriste y solo se guarda su id
  (`rollo.activeTrip`). "Cerrar sesión" y "Borrar cuenta" están al final de Ajustes; cerrar sesión **no** borra la
  cola de fotos pendientes. Si `POST /auth/logout` no llega al server, esa sesión queda en `rollo.pendingLogout`
  (SecureStore) y se reintenta en silencio al abrir la app, al volver a primer plano y al volver la red (`src/features/auth/pending-logout.ts`).
  **Link mágico:** el mail del código trae además un botón a `rollo.juanifraga.com/entrar#t=<token>&e=<email>` (fragmento:
  no llega a ningún server). Esa página estática solo abre `rollo://login?token=…&email=…` y borra el fragmento de la barra.
  La ruta `app/login.tsx` (fuera del grupo protegido, `src/features/auth/magic-link-screen.tsx`) llama a
  `POST /auth/email/verify-link` una sola vez por token (`magic-link.ts`) y guarda la sesión igual que el código. **El link solo
  entra desde el iPhone que pidió el código** (estilo PKCE): `startEmailLogin` (también "Reenviar código") manda
  `linkChallenge` = base64url(SHA-256(verifier)) y guarda `{ email, verifier }` en SecureStore (`rollo.loginLinkVerifier`, se
  pisa en cada pedido, se borra al entrar); sin verifier o con otro email no se llama a la API ("Este link es de otro pedido…"),
  así nadie te mete en su cuenta con su link ni otra app que registre `rollo://` puede usar el token. `/entrar` lleva CSP
  (`connect-src 'none'`, solo su script por hash) y `no-referrer`. Con sesión
  y el mismo email entra; con otra cuenta muestra "Ya tenés la sesión iniciada con…" y **nunca cambia de cuenta sola**.
  Si el link venció, "Volver a pedir un código" abre `/email` con el email puesto. Próximo paso: Universal Links
  (`https://…/entrar` abre la app directo, sin la página), que piden la cuenta paga.
- **Cámara propia** (**VisionCamera** `react-native-vision-camera` v5, módulo compartido `src/features/camera/`, la misma de la captura y del momento): la del sistema
  (`launchCameraAsync`) siempre muestra "Repetir / Usar foto" después de sacar y no se puede evitar, y sin videos ya no hace falta.
  **Calidad máxima en cada iPhone** (`device.ts`): atrás usa la cámara virtual con más lentes (quad > triple > dual-wide > dual > gran angular), así iOS
  cambia de lente solo al hacer zoom; adelante, la gran angular. La foto pide el **4:3 más grande hasta ~24 MP** que lista el dispositivo
  (`getSupportedResolutions("photo")`: 5712×4284 donde está, si no 4032×3024; 48 MP no, porque `prepareMedia` la baja a 4000 px y solo suma ruido,
  demora y archivos de ~25 MB) con `qualityPrioritization: "quality"` (iOS aplica Smart HDR / Deep Fusion solo; `photoHDR` no existe en iOS), JPEG
  calidad 1, corrección de lente y la sesión sesgada a esa resolución (`resolutionBias`); el disparo se precalienta (`prepareSettings`) cuando arranca
  la sesión. La foto se guarda con la orientación en EXIF: `uprightSize` da vuelta ancho y alto si hace falta. La frontal **se guarda
  espejada, tal como se ve en la vista** (a pedido del dueño, distinto de iOS): `mirrorMode: "auto"` y, si la foto de la frontal no viene ya espejada
  (`photo.isMirrored`), `ensureFourThree(…, { mirror })` la espeja. Si eso o el recorte a 4:3 crean otro archivo, se borra el de VisionCamera. Los errores de la cámara van una sola vez a `console.warn`.
  **Zoom como iOS** (`zoom.ts`, con los datos reales del dispositivo): 1× es la gran angular (en una cámara con ultra gran angular, el primer
  `zoomLensSwitchFactors`; si no, el mínimo) y se abre siempre ahí (también al dar vuelta). Chips abajo y al centro del recuadro: "0,5" solo con
  ultra gran angular, 1, 2 y cada teleobjetivo (los siguientes cambios de lente ÷ 1×: [2, 6] → 3×, [2, 10] → 5×); el activo va en cobalto con el valor en
  vivo ("1,4×"). Adelante no hay chips. Tocar un chip hace una rampa suave (`startZoomAnimation`); pellizco continuo (`controller.setZoom`) del mínimo real a 5× el
  teleobjetivo más largo (15× / 25×, como iOS) o 10× sin tele, nunca más allá del máximo real del formato activo.
  **Adelante, "Ampliar encuadre" / "Reducir encuadre"** en vez de chips (`frontExpand` de `zoom.ts`): el 1× de la frontal sale de
  `displayableZoomFactor / zoom` del controller al arrancar (iOS 18+ `displayVideoZoomFactorMultiplier`; en un iPhone 11+ la selfie por
  defecto es un recorte) y el botón hace rampa entre ese 1× (por defecto) y el mínimo real; si el mínimo no es más ancho, no aparece.
  **Exposición como iOS** (`exposure.ts`): tocar el recuadro mide enfoque, exposición y balance de blancos ahí (`focusTo` con
  `modes` según `supportsFocus/Exposure/WhiteBalanceMetering`, `autoResetAfter: null`: no vuelve solo al centro) y muestra el cuadrado
  de enfoque con el sol; después, arrastrar un dedo arriba/abajo cambia el EV (prop `exposure`, 50 pt por paso, ±2 EV como la cámara de iOS
  y nunca más allá de `minExposureBias`/`maxExposureBias` reales); el valor queda hasta tocar en otro lado (vuelve a 0) o remontar/dar vuelta la cámara.
  VoiceOver: "Exposición" ajustable de a 1/3 de paso. El pellizco (dos dedos) sigue igual. **Low-light boost** automático donde el
  dispositivo lo tiene (`enableLowLightBoost={device.supportsLowLightBoost}`).
  **Cuadrícula** 3×3 (botón `grid`, cobalto prendida) que el celular recuerda (`rollo.cameraGrid`, `src/storage/camera-grid.ts`) y
  **temporizador** apagado → 3 s → 10 s (`timer.ts`, botón `timer`, no se guarda): el disparador arranca una cuenta grande sobre la vista
  con un háptico por segundo y saca en 0; tocarlo de nuevo ("Cancelar temporizador") la corta. En el momento también vale y la foto
  cuenta por su hora de captura, con las reglas de siempre.
  **Vista y foto en 4:3** (`frame.ts`): la vista es un recuadro de ancho completo en 3:4 (como la cámara de iOS) con los controles en las bandas negras
  (arriba una fila con "Cerrar" a la izquierda y flash, temporizador y cuadrícula a la derecha, y el título y el aviso del momento
  debajo; abajo disparador y dar vuelta); si igual la foto no saliera 4:3, `ensureFourThree` recorta centrado con
  `expo-image-manipulator` (nunca estira). En el momento, el caption muestra la segunda foto difuminada en un recuadro
  arriba a la izquierda (`insetFrame` de `src/ui/inset-frame.ts`, el mismo del visor).
  Controles: disparador, "Cerrar" (antes de sacar), "Dar vuelta la cámara" (arranca en la trasera), flash que rota automático / prendido / apagado
  (arranca en automático), temporizador, cuadrícula, zoom y exposición. Permiso con `useCameraPermission` de VisionCamera (sin permiso: "Rollo necesita la cámara" + "Abrir Ajustes"); el texto
  del permiso va en `ios.infoPlist.NSCameraUsageDescription` de `app.json` (VisionCamera v5 no trae config plugin). `expo-image-picker` queda solo para la
  foto de perfil. Lo que se saca **no queda en el carrete**: se sube y se borra del caché local.
- **Fotos a resolución completa** (~4000 px, JPEG 85–90 %, para imprimir) + **thumbnail ~800 px** que
  genera el celular. **Sin videos en rollos nuevos** (la cámara saca solo fotos; los videos de rollos viejos se siguen viendo).
- **Metadatos:** al mandar, la foto lleva EXIF (fecha/hora local del rollo con offset, GPS, `Software: Rollo`) y XMP
  con caption y autor en Unicode (`piexifjs`, JS puro). Al guardar en Fotos se inyectan si el original no tiene fecha.
- **Límite de fotos por persona**, que el admin elige al crear el rollo: **"Por día"** (10 por defecto) o **"Todo el rollo"** (`photoLimitMode` `daily` | `total` + `totalPhotoLimit`; 20 por defecto). Lo aplica el server. Con cupo total, el badge de la cámara, "Tenés N fotos en el rollo", el tablero ("Te quedan N de M") y la cola offline (`countPending` sin día) cuentan lo que queda en todo el rollo.
- **Offline first:** al disparar se guardan foto, hora (UTC + zona) y GPS. Pedir ubicación apenas se
  abre la cámara; sin fix, usar la última conocida y guardar su precisión. Cola local en SQLite, subida
  en segundo plano cuando hay señal, **UUID generado en el celular** (reintentar es seguro).
  Con la app cerrada o suspendida sube `expo-background-task` (tarea `rollo-upload`, BGProcessingTask de iOS: solo
  con red, cuándo corre lo decide el sistema, ~25 s por pasada con corte limpio entre ítems); los PUT usan sesión
  de URLSession en background. Si se mata la app a mano, iOS no la despierta hasta que se vuelva a abrir.
  En dev, la fila "Probar subida en segundo plano" de Ajustes (sección Desarrollo) la dispara.
- **Mapa sin señal automático** (`src/features/map/offline-*.ts`): al abrir la app y al volver a primer plano baja solo
  una zona amplia (300 km, z5–10) y otra detallada (40 km, z10–14) alrededor de la ubicación y de los lugares donde
  sacó fotos el grupo (grilla de 30 km), desde 3 días antes del inicio hasta el fin del rollo (antes del inicio, solo
  con Wi‑Fi; tope ~400 MB). Los packs usan el mismo `file://` de estilo que el MapView, se nombran
  `rollo:{tripId}:{wide|detail}:{lat},{lng}` y se borran 7 días después del fin. Estado en Ajustes → "Mapa sin señal" (ajuste del celular, no del rollo).
- **Captura:** cámara propia (`CaptureScreen`) solo de fotos, a resolución completa de la trasera (`quality: 1`; la frontal va con el procesamiento normal, el 1080 px es solo del momento). **No hay "Repetir"** ("la sacada es la que es"): al disparar va directo a la pantalla del caption, la pantalla del caption
  muestra la foto **muy difuminada** (`blurRadius`), con caption opcional y "Mandar al rollo". No hay "Repetir": la "X" de arriba a
  la izquierda solo la descarta (alerta "¿Descartar la foto?", borra el archivo y cierra), así nadie tiene que cerrar la app
  para no subirla. Una vez mandada no se puede repetir ni ver.
- **Antes del revelado** no se ve ninguna foto, solo su **ThumbHash** (colores difusos, lo genera el
  celular y el server lo devuelve en el feed). Para que den ganas de abrir la app: **mapa en vivo** con
  pins (autor y hora; con la foto de perfil del autor si tiene, hecha en JS como `tab-avatar` y registrada con `Images`, y si no la inicial sobre su color), **feed** y la hoja de contacto del rollo. Se muestra solo el total del grupo.
- **Rollo configurable al crearlo** (lo hace el admin, formulario nativo con `@expo/ui`): nombre, inicio y fin
  **con fecha y hora**, fotos por persona (por día o en todo el rollo), y **cuándo se revela** (al terminar o en otro
  momento, siempre igual o posterior al fin). Las fechas las valida el server; la app muestra su mensaje inline (`src/features/trips/create-form.ts` solo chequea los nombres).
- **Privacidad de los rollos:** un rollo solo existe para sus miembros. Nadie más ve sus fotos, su nombre ni que existe
  (tampoco en el perfil de un amigo: "Rollos en común" son solo los rollos donde **los dos** son miembros activos). Si algún
  día hay rollos públicos, es una decisión del grupo, no de una persona.
- **Amigos** (`src/features/friends/`): se hace amistad con un **link de amistad** (`POST /friends/link`, vale 1 hora, uno
  vivo a la vez, multiuso): `rollo://friends/<CODE>` con CODE de 8 caracteres, que también se puede escribir a mano. Abrirlo
  (`app/friends/[code].tsx`, fuera del grupo protegido) llama a `POST /friend-links/claim` **sin sesión** y: con cuenta lista
  canjea (`POST /friends/redeem`) y abre la tab Amigos; sin cuenta guarda el permiso de canje (24 h) en SecureStore
  (`rollo.pendingFriend`, nunca en el cache de Query) y lo canjea cuando el perfil queda completo (`use-pending-friend.ts`,
  el único lugar donde se canjea). "Completá tu perfil" tiene el campo opcional "¿Te invitó un amigo? Código". La tab **Amigos**
  (`(tabs)/friends`, global: funciona sin rollos) tiene la lista (foto, nombre y @) e "Invitar a un amigo"; tocar uno abre su
  perfil (`/friends/user/<id>`) con su encabezado, sus destacadas ("Fotos | Mapa"), "Rollos en común" (`GET /friends/{userId}`),
  "Sumar a un rollo" y "Borrar amigo" (silencioso). Cualquier miembro suma a **sus** amigos al rollo
  desde "Sumar amigos" (sheet `add-friends`, respuesta por amigo: "Ya está" / "No disponible"); al crear un rollo, si tenés
  amigos, se abre esa sheet encima del rollo nuevo (si no se pueden cargar, no pasa nada), y cualquiera menos el admin
  puede "Salirme del rollo" (conserva sus fotos y puede volver con el código). Los links `https` (Universal Links) llegan con TestFlight.
  **Solicitudes de amistad** (`friend-request-button.tsx`, `friend-requests-row.tsx`, `friend-requests-screen.tsx`, `use-friend-request.ts`): en el perfil de otra persona, si no son amigos y no la bloqueaste, un botón debajo del encabezado según `friendRequest` (`none` → "Agregar amigo"; `sent` → "Solicitud enviada", su menú ofrece "Cancelar solicitud"; `received` → "Aceptar solicitud" y "Rechazar"). Es optimista (el perfil y la lista cambian al toque y vuelven si el server dice que no) y el error va inline. Las recibidas entran por una fila "Solicitudes" con la cantidad arriba en la tab Amigos (solo si hay), que abre la pantalla "Solicitudes" (`(tabs)/friends/requests`) con Aceptar / Rechazar por fila y "No tenés solicitudes pendientes." si no queda ninguna (`GET /me/friend-requests`). Rechazar es silencioso. Séptimo aviso push `friendRequest` ("Cami te mandó una solicitud de amistad", abre la tab Amigos) con su switch "Solicitudes de amistad" en Ajustes → Notificaciones.
- **Perfil de cualquier usuario** (`src/features/friends/user-profile-screen.tsx`, `GET /users/{userId}` →
  `{ user, isFriend, profileVisibility, canSee, friendCount, mutualCount }`): sin título en la barra (el nombre está en el
  encabezado); nombre, @, foto, **descripción** y cantidad de amigos se ven siempre ("12 amigos · 3 en común", texto
  secundario tocable: abre `/user/<id>/friends`, `GET /users/{userId}/friends` → "Amigos" con la lista completa si `canSee`,
  si no "Amigos en común" con solo los comunes; en tu Perfil la cantidad sale de `useFriends()` y lleva a la tab Amigos);
  destacadas solo si `canSee` (sos vos, es tu amigo o su perfil es público), si no "Este perfil es privado"; y si es amigo, además lo de amigo
  (`useFriend` solo con `isFriend`). Se llega desde la tab Amigos (`/friends/user/<id>`) y desde afuera con `/user/<id>`
  (push en el stack raíz): tocar un miembro en "En el rollo" (vos no sos tocable), el avatar o el nombre del autor en la
  tarjeta del mapa, en una fila del Feed y en el visor. Tocarte a vos lleva a Perfil (`/me`). Todo pasa por
  `useOpenProfile()`: desde una sheet o el visor (modales) primero se cierra el modal (`leave`) y después
  se hace el push, porque un push después de un modal se presentaría como otro modal.
- **Fotos destacadas** (`src/features/featured/`): de un rollo **revelado** donde sos miembro activo destacás **fotos** (no
  videos), tuyas o de otros, hasta **60**: en el visor con el ícono de perfil "Agregar a tu perfil" / "Sacar de tu perfil" (`person.crop.circle.badge.plus` / `.badge.checkmark`) y en la
  grilla con el menú de mantener apretado "Agregar a tu perfil" / "Sacar de tu perfil". Al agregar una, sale la pastilla "Destacada en tu perfil" (`showPill`). El autor puede "No dejar que la
  destaquen" (borra las de otros y bloquea nuevas; él siempre puede destacar las suyas). Nunca sale el rollo, el caption ni la
  coordenada: la ubicación va como **zona de ~5 km** (celda de 0.05°). En un perfil, "Fotos | Mapa": la grilla (con la
  insignia del autor si no es el dueño del perfil; tocar una abre `/featured/<userId>/<mediaId>`) y el mapa por zonas.
  **Adónde pueden ir tus fotos** (cuatro niveles, gana el más restrictivo; `featuring-section.tsx`, `use-featuring-levels.ts`, `use-privacy-settings.ts`):
  cuenta (Ajustes: "Permitir que agreguen mis fotos a su perfil", `PATCH /me/settings` `privacy.allowFeaturing`), rollo ("Tus fotos en otros perfiles" en el
  tablero y en el segmento "Rollo", `PATCH /trips/{id}/members/me`), foto ("No dejar que la destaquen") y **rollo privado** (el admin lo elige al crear y lo cambia
  en el tablero con confirmación, `featuringDisabled`: ninguna foto sale, ni la del autor). Apagar un nivel saca las fotos de los perfiles ajenos; prender no devuelve nada. El feed
  trae `canFeature` por foto: sin él (o sin `featuredByMe`) no aparece "Agregar a tu perfil" en el visor ni en el menú de la grilla (`feature-action.ts`).
  **Visibilidad:** `profileVisibility` `"friends"` (por defecto) o `"public"`, con el switch "Perfil público" de Ajustes
  (`PATCH /me`, error inline): apagado, solo tus amigos ven tus destacadas y tu lista de amigos
  (la descripción y la cantidad de amigos son siempre públicas).
- **Insignias** (`src/features/profile/badge.ts`): `badge` (`"founder"` | `"first_edition"` | null) viene del server en el usuario (`GET /me`, `GET /users/{id}`) y se asigna a mano en el backend. Se muestra solo en el encabezado del perfil (`ProfileHeader`, el tuyo y el de otros) bajo el nombre, con `Badge` neutral y las etiquetas en inglés **FOUNDER** / **FIRST EDITION**; valores desconocidos no muestran nada. No va en listas, Feed ni mapa.
- **Límites para crear rollos** (los aplica el server en `POST /trips`, **409** con el mensaje): máximo 2 rollos sin revelar creados por vos a la vez y 4 creados en los últimos 30 días; los rollos a los que te sumaste no cuentan y hay usuarios exentos (flag a mano en la DB). La app no chequea nada antes: `create-screen.tsx` muestra el mensaje del server debajo del botón (`ErrorText`, como cualquier error del form) sin perder lo cargado.
- **Varios rollos por persona**, se puede volver a ver uno viejo. El **rollo activo** es el último que
  abriste; se cambia con el selector del header (sheet "Tus rollos"). Las fechas del rollo van con
  **inicio y fin** (no "cantidad de días").
- **Momento del día (modo viaje, estilo BeReal)** (`src/features/moments/`): un aviso por día a una hora random distinta para cada uno, dentro de una
  franja (9:00–23:00 por defecto, configurable al crear el rollo con "Apagado" / "Solo foto" / "Dos cámaras"). Hay **15 minutos** para sacar una foto extra, **aparte del
  cupo**; pasado ese tiempo se pierde ("Se pasó tu momento de hoy"; el último día del rollo dice "Era el último del rollo."); la imagen vinculada pendiente no cuenta aparte en las subidas. Son **notificaciones locales**: `syncMoments()` baja `GET /trips/{id}/moments` (desde 3 días antes del
  inicio hasta el fin, nunca de un rollo revelado) y programa hasta 40 con identificador `moment.<tripId>.<day>` (título "Es tu momento", `data.url` `/moment?trip=…&day=…&at=…&selfie=0|1`, con `momentMode` de `GET /me/trips`);
  `cancelMomentNotifications()` las borra, y descarta también las ya entregadas (al cerrar sesión, borrar la cuenta y apagar el switch). Tocar el aviso conserva `trip` en la ruta. La hora de un momento futuro nunca se muestra ni se guarda en Query ni en
  SecureStore: solo vive en el planificador del sistema. La cámara `/moment` (VisionCamera, propia, fullScreenModal) no espera el detalle del rollo (abre ya; que haya segunda foto sale del param `selfie`, después del detalle si cargó, y si no es solo foto; "Cerrar" siempre antes de la foto), tiene cuenta regresiva y arranca en la trasera; **la primera vez que abrís cada momento** (con la ventana abierta) va antes una intro de ~1,7 s sobre negro (`moment-intro.tsx`): el logo "Revelado" se arma y un anillo cobalto da la vuelta (la ventana), en Lottie (`lottie-react-native`, `assets/lottie/moment-intro.json`, lo genera `npm run lottie` con `scripts/build-lottie.mjs`), con "Tu momento" / "Te quedan 14:52" en texto nativo, un háptico en el pop; tocar la saltea; con "Reducir movimiento" muestra el último cuadro con un fundido; clave `rollo.momentIntroSeen.<tripId>.<day>`. La cámara tiene un botón nativo "Dar vuelta la cámara" antes de sacar
  (también en "Solo foto"). **La primera foto que se saca es la principal**, sea de la trasera o de la frontal; si el rollo es "Dos cámaras" (aviso "Sacás con las dos cámaras. La
  primera va a ser la grande."), la cámara pasa sola a **la otra** ("Ahora con la otra cámara.", sin dar vuelta) y esa segunda va como foto aparte vinculada (`pairedWith`). La imagen
  de la frontal se achica a 1080 px (`prepareMedia`), sea la primera o la segunda; la de la trasera va normal. El nombre `selfie` del contrato y del código significa "la imagen vinculada";
  ningún texto visible lo dice; en Rollo hay un banner "Tu momento · quedan m:ss" mientras la ventana está abierta; en el revelado la foto del
  momento lleva un badge y la otra imagen va de recuadro ("Ver la otra foto"; tocarlo intercambia solo para quien mira). **El momento no se destaca en el perfil** (ninguna de las dos imágenes: sin
  "Agregar a tu perfil" en el visor ni en el menú de la grilla; el server lo rechaza y manda `canFeature: false`); me gusta y comentarios van a la principal. "Guardar todo" baja las dos imágenes de cada momento y, en el visor,
  "Guardar en Fotos" guarda la que se ve grande (`withLinkedImages` / `linkedImage` en `gallery/save.ts`; el export para fotolibro todavía no existe: cuando se haga tiene que incluir la vinculada). **Ajustes → Notificaciones → "Momento del día"** (`dailyMoment`): apagarlo hace el `PATCH` y cancela los `moment.*`; prenderlo corre
  `syncMoments()`. **El momento se ve apenas se sube, antes del revelado** (excepción a "nadie ve nada": las demás fotos siguen ocultas): el feed trae sus archivos
  (`files`, con `selfie.files`) solo para fotos de momento, así que `useRevealedPhotos` antes del revelado devuelve solo momentos. En el **Feed** la fila muestra la foto de verdad con el badge
  (`FeedRow`, con `token`) y tocarla abre el visor (`/photo/<id>?tripId=…`, no el mapa); en el **Mapa** hay un filtro "Momentos" (junto a "Solo hoy", aparece cuando el rollo ya tiene
  algún momento) y la tarjeta del pin de un momento muestra la foto y abre el visor (las demás tarjetas siguen difuminadas y sin abrir: `canOpen` en `PinCarousel`). En el visor
  un momento no revelado es **solo lectura** (`readOnly`): sin me gusta (tampoco con doble toque), guardar ni destacar, porque el server los rechaza; **los comentarios sí** (burbuja con contador desde `commentCount` del feed y hoja `/comments/<id>`, también al tocar la push `photoCommented` con `comments=1`); queda "Denunciar" (el server acepta
  denuncias de miembros antes del revelado), "Ver en el mapa" y el intercambio de imágenes. La push `momentPosted` ("{Nombre} subió su momento" / nombre del rollo, `data.url` `/photo/<id>?tripId=…`) abre ese visor y deja el rollo activo;
  switch "Momentos del grupo" en Ajustes → Notificaciones. En Desarrollo, "Probar momento ahora" programa uno en 10 s para el rollo activo. Diseño en `docs/superpowers/specs/2026-10-25-momento-diario-design.md`.
- **Cupo diario o total** (a futuro, mismo diseño): al crear el rollo se elige si el límite es por día (como hoy, 10 por
  persona por día) o total del viaje (por ejemplo 20 por persona en todo el rollo).
- **Después del revelado:** galería, mapa con fotos, timeline por día, descarga y export para fotolibro.
  **El revelado** es una pantalla propia (`/reveal`, `src/features/reveal/`, fullScreenModal): se abre sola **una vez por
  rollo** la primera vez que entrás a un rollo revelado (`useFirstPresentation`, esperando `loaded` para no disparar en un rollo que no es el
  activo). Dura ~7 s: cuarto oscuro rojo con grano animado ("Revelando {rollo}") → 9–12 fotos que salen de su ThumbHash (shader de
  Skia: umbral de ruido, sepia a color, borroso a nítido) con háptico que crece (`react-native-pulsar`) → golpe (impacto + éxito + clic
  de obturador generado en código con `expo-audio`) y la luz pasa de roja a blanca → "Se reveló · {rollo} · {fecha}" →
  `router.replace("/presentation")`. Tocar salta a las historias. Sin fotos o con error va directo a `/presentation`; con "Reducir
  movimiento", fundido simple y solo el háptico de éxito; si el shader no compila, las fotos se ven sin efecto.
  **La presentación** (`/presentation`, botón del centro) son **solo las historias**, sobre negro desde el primer frame.
- **"Arrancó el rollo"** (`/roll-started`, `src/features/capture/roll-started.tsx`, `use-roll-started.ts`): la primera vez que el rollo activo
  está en curso (una vez por rollo) un candado grande se sacude y se abre (SF Symbol `lock` → `lock.open` con `.symbolEffect(.replace.magic)`,
  módulo local `modules/rollo-symbol`; sin el módulo nativo cae a `expo-symbols`) con un "clac" y pasa a cámara. Texto "Arrancó el rollo.
  Tenés N fotos hoy." y botones "Sacar la primera" (abre la cámara) y "Ahora no". En "Tus rollos" el badge del rollo en curso dice LIVE.
  "Tus rollos" se agrupa con `groupTrips` (`src/features/trips/group-trips.ts`): en curso, próximos y sin revelar arriba; "Revelados" (últimos 3 meses por fecha de revelado); y "Anteriores · N" colapsado (se abre solo si el rollo activo está ahí, sin recordar nada).
- **Notificaciones push** (`src/features/notifications/`): las manda el backend con Expo Push Service. El token se registra con
  `PUT /me/push-tokens/{token}` atado a la sesión y se borra al cerrar sesión y cuando un `401` la cierra (así un celular que cambia de
  cuenta no recibe avisos de la anterior). **Permiso con explicación propia** (`/push-primer`, `push-primer.tsx`): se ofrece una sola vez,
  después de crear o unirse a un rollo (`offerPushAfterJoining`; clave nueva `rollo.pushPrimerSeen`, no se renombra); si ya había permiso
  el token se registra en silencio, y si lo negó no pasa nada (queda el aviso en Ajustes). **Tocar una push** abre `data.url` (ruta de la
  app, nunca otro host) y, si trae `trip`/`tripId`, ese rollo pasa a ser el activo (`notification-target.ts`, `use-notification-response.ts`);
  `/roll` y `/reveal` abren la tab Rollo (un revelado sin ver se reproduce desde ahí). **Siete avisos:** te sumaron a un rollo, nuevo amigo,
  arrancó el rollo, se reveló, destacaron tu foto, le gustó tu foto y comentaron tu foto. Nunca por acciones propias ni de usuarios bloqueados. Se **sacó el aviso
  local del revelado**: al abrir la app se cancelan los `reveal.*` que dejaron versiones viejas (`legacy-reveal.ts`).
  **Ajustes → Notificaciones** (`settings-screen.tsx`, `GET/PATCH /me/settings`): un switch por aviso (`addedToTrip`, `newFriend`, `tripStarted`,
  `tripRevealed`, `photoFeatured`, `photoLiked`, `photoCommented`, `friendRequest`, `dailyMoment` y `momentPosted`) y, si el permiso del sistema está apagado, un banner que lleva a Ajustes del iPhone.
- **Archivar y eliminar tus fotos y videos** (`src/features/gallery/`: `actions.ts`, `use-archive-photo.ts`, `use-delete-photo.ts`, `own-photo-actions.ts`):
  solo en **tus fotos y videos** de un rollo **revelado** (los rollos viejos tienen videos; un video no se destaca ni tiene me gusta ni comentarios), desde el "…" del visor y el menú de mantener apretado de la grilla: "Archivar" /
  "Desarchivar" y "Eliminar". **Archivar** es al instante y sin confirmar (optimista sobre el cache del feed; si falla vuelve atrás con
  `Burnt.alert` "No se pudo archivar"): la foto deja de existir para los demás (feed, mapa, historias, "Tu actividad", perfiles, me gusta,
  comentarios, descargas; lo filtra el server) y sale de todos los perfiles donde estaba destacada, también el tuyo (desarchivar no la devuelve). Vos la
  seguís viendo en la galería **atenuada con la etiqueta "Archivada"** (y "Archivada" junto a la hora en el visor), sin "Agregar a tu perfil"
  (`featureActionAvailable`). **Eliminar** pide `Alert` nativa "¿Eliminar esta foto?" (en un video, "¿Eliminar este video?") / "No se puede deshacer." con "Eliminar" destructivo; borra
  para todos (archivos, me gusta, comentarios, destacadas), la saca del cache del feed y en el visor pasa a la siguiente o cierra si era la última;
  si falla, `Burnt.alert` "No se pudo eliminar". En un momento del día, archivar o eliminar la principal arrastra la vinculada. API:
  `POST /media/{id}/archive`, `POST /media/{id}/unarchive`, `DELETE /media/{id}` (el mismo que usa el admin antes del revelado); el feed trae
  `archived` (solo puede ser `true` en tus fotos).
- **"Me gusta"** (`src/features/likes/`): solo fotos reveladas (y destacadas en un perfil). Corazón con contador en el visor de la galería y
  en el de destacadas (fila de íconos sin texto: corazón, estrella, mapa, guardar; el "…" va arriba a la derecha); doble toque en la foto
  da el me gusta (sin animación: el corazón se llena), así que un toque simple espera 250 ms (`tap-gate.ts`) antes de contar como toque
  simple. En las historias, corazón abajo a la derecha sin contador: el doble toque da me gusta y tocarlo lo saca o lo pone. Es optimista y con cache (`like-cache.ts`).
- **Tu actividad** (`src/features/activity/`, solo en tu Perfil): ícono `clock.arrow.circlepath` en la barra del Perfil, al lado del engranaje, que
  abre `/me/activity` (lista agrupada, hoy una fila "Me gusta" con la cantidad, lista para sumar más). "Me gusta" (`/me/likes`) es una grilla con
  las fotos que te gustaron, de la más reciente a la más vieja (`GET /me/likes`, paginado con cursor; **lo que hoy podés ver lo filtra el server**,
  nunca la app), con la insignia del autor si no sos vos; tocar una abre el visor de la galería si `source.kind` es `trip` o el de destacadas
  si es `featured` (`likes-target.ts`). Dar o sacar un me gusta (`use-toggle-like.ts`) invalida la query `["my-likes"]`. Vacío: "Todavía no te gustó
  ninguna foto."; error con "Reintentar".
- **Comentarios** (`src/features/comments/`): solo en fotos reveladas (no videos, no en las destacadas de un perfil: mostrarían nombres y charla del
  rollo a gente de afuera) y solo entre miembros activos del rollo. En el visor de la galería, la burbuja `bubble.left` (con la cantidad,
  `commentCount` del feed) abre la sheet `/comments/<mediaId>` (`comments-screen.tsx`): lista (avatar, nombre, texto, "hace 5 min") y campo abajo
  (texto plano, hasta 500, `draft.ts`). El "…" de cada fila ofrece "Borrar" (tuyo, o cualquiera si la foto es tuya: `canDelete` lo decide el server)
  y "Denunciar" (ajeno; `useReport().reportComment`, mail a soporte como el resto de la moderación). Error al enviar: inline y no pierde lo escrito.
  El aviso `photoCommented` ("Cami comentó tu foto", "Cami también comentó una foto") abre `/photo/<id>?tripId=…&comments=1`: el visor abre la sheet
  una vez (`openComments`). Ajustes → Notificaciones: switch "Comentan tu foto".
- **A futuro (no para enero):** feeds públicos de rollos y buscar perfiles públicos.

## Navegación y diseño

- **Botones "i" de ayuda** (`src/features/info/`): un `info.circle` chico junto a un encabezado o una fila abre una hoja (`/info/<topic>`, `formSheet` con `fitToContents`)
  con título y 2–4 frases. Los textos viven todos en `topics.ts` (`INFO_TOPICS`, tipado por id); la ruta `app/info/[topic].tsx` solo los muestra. `InfoButton` es para pantallas RN
  (`accessory` de `Row`, `labelAccessory` de `SwitchRow`, `titleAccessory` de `Section`) y `NativeInfoButton` para el Form de SwiftUI de Crear rollo. Viven en la feature y no en `ui/`
  porque conocen el catálogo y navegan. Hoy: Crear rollo (fechas, revelado, cupo, momento, franja, rollo privado), Ajustes (perfil público, fotos en otros perfiles, mapa sin señal) y
  "Invitar" del tablero. Un tema nuevo = una entrada en `topics.ts` + su test en `__tests__/info.test.tsx`.

- **Barra de abajo nativa** (`NativeTabs` de `expo-router/native-tabs`, liquid glass en iOS 26), **solo
  íconos SF Symbols**: Rollo · Mapa · **Cámara** (centro) · Amigos · Perfil. La cámara es un trigger
  `disabled` cuyo `tabPress` abre `/capture` encima. Después del revelado: Galería · Mapa · Presentación (solo historias)
  · Amigos · Perfil.
- Mapa = mapa + Feed: control "Mapa | Feed" arriba (param `view`), el mapa queda montado al pasar al Feed y tocar una fila
  vuelve al Mapa enfocando ese pin. El segmento Feed existe solo antes del revelado. "Solo hoy" va en el menú de filtros.
  La lógica vive en `src/features/map/roll-map.tsx`, `src/features/map/activity-screen.tsx` y `src/features/feed/feed-list.tsx`.
- Rollo = tablero (hoja de contacto, cupo de hoy, fechas, estado de subidas, "Invitar" con código y compartir,
  miembros): todo lo del rollo activo vive acá. Revelado, la tab es **"Galería | Rollo"** (control arriba, param `view`:
  `gallery` por defecto o `roll`, como "Mapa | Feed"; la galería queda montada y su toolbar solo se ve en Galería). El
  segmento Rollo es una lista agrupada con el resumen ("64 fotos · 3 videos · 8 personas · 6 días"), Fechas (el mismo
  `RollDates` del tablero), subidas y miembros/invitar, sin "Hoy" ni hoja de contacto (`src/features/roll/revealed-roll-screen.tsx`,
  `roll-overview.tsx`). La actividad
  ("Cami sacó una foto · 14:32", con la hora de captura) vive solo en el Feed (dentro de Mapa).
- Perfil = lo que ven los demás: encabezado (foto, nombre, @usuario y descripción) y "Fotos | Mapa" (tus destacadas y sus
  zonas). No carga datos de ningún rollo. El engranaje abre **Ajustes** (`/settings`): "Editar perfil" (nombre, @, descripción;
  ahí se ve el email, de solo lectura), "Perfil público", "Notificaciones", "Desarrollo" (solo dev: "Probar subida en segundo plano", "Probar momento ahora", "Ver revelado", "Ver candado" y "Ver intro", que muestran esos momentos siempre), "Mapa sin señal" (ajuste del celular) y
  "Cerrar sesión" / "Borrar cuenta".
- **Estilo nativo de iOS a tamaños reales**: tipografía y colores del sistema (`Color` de expo-router,
  se adaptan a oscuro), listas agrupadas, sheets, títulos grandes del stack. Nada de "todo grande",
  cards por todos lados, bordes de wireframe ni fuentes descargadas: se ve hecho con IA. La
  personalidad va en pocos detalles: los captions en la serif del sistema (New York), la hoja de
  contacto del rollo, la animación de "mandar al rollo". Antes de diseñar una pantalla, repasar las 20
  "native slop tells" de la skill `expo-design-system`.
- **Identidad:** logo **"Revelado"** (sobre un cuadrado de 120×120, tres círculos que se concentran hacia
  arriba a la derecha: r 34 / 24 / 14, opacidades 0.18 / 0.38 / 1) y **cobalto** como color de marca
  (`colors.tint`: claro `#3155F5`, oscuro `#5C7CFF`; `colors.onTint` es el blanco del texto encima). Es el
  acento del sistema y aparece **solo en acciones y en lo seleccionado, nunca de relleno**.
  - **Sí:** la tab activa, los botones `primary`, los links y acciones de texto ("Reintentar", chevron del
    TripSwitcher, check del selector de rollos), en el Mapa el filtro elegido / el punto de ubicación / el halo
    del pin seleccionado, y "Mandar al rollo".
  - **No:** fondos, textos, cards, contadores, íconos inactivos, `memberColor` ni el badge rojo de la cámara.
  - MapLibre no acepta colores dinámicos: ahí se usa `tintHex[scheme]` según `useColorScheme`.
  - El ícono (claro / oscuro / tinted) y el splash salen de `scripts/build-icons.mjs`: `npm run icons`
    regenera los PNG de `assets/`. Son nativos: cambiarlos pide `npx expo prebuild --clean` + rebuild.
    Pendiente: un `.icon` de Icon Composer (Liquid Glass) en vez de los PNG.
- **Cómo se entera el usuario de lo que pasa (sin toasts: en iOS no existen):**
  - **Éxito = la UI cambia**, sin cartel: se cierra la sheet, aparece el dato nuevo, vuelve a donde
    estaba. Al mandar una foto: haptic + la animación de "mandar al rollo".
  - **Error de un formulario:** inline debajo del campo o del botón (`ErrorText`), sin perder lo que
    escribió.
  - **Error al cargar una pantalla:** estado de error en la pantalla con botón "Reintentar"; si hay datos
    viejos, se mantienen.
  - **Procesos de fondo (subida de fotos):** nunca toasts ni alertas. Estado persistente: ícono de nube en
    Rollo si hay pendientes y en el tablero de Rollo (sección de subidas, y el segmento "Rollo" una vez revelado) "N fotos esperando señal" / "N no se pudieron subir" con el motivo.
  - **Alerta nativa** (`Alert`) solo para algo grave e irreversible (por ej. el rollo se reveló con fotos
    tuyas sin subir) o para confirmar una acción destructiva (borrar como admin).
  - Si un momento puntual necesita una confirmación fugaz, usar `burnt` (HUD nativo tipo AirPods), no un
    toast hecho a mano. También para los errores de denunciar y bloquear (`Burnt.alert`).
    **Única excepción, a pedido del dueño:** al agregar una foto a tu perfil sale una pastilla chica y centrada "Destacada en tu perfil"
    (sin ícono; `showPill` de `src/ui/pill.ts`, `PillHost` en `app/_layout.tsx` sobre `FullWindowOverlay` para quedar encima de los modales).

El backend vive en [rollo-app/backend](https://github.com/rollo-app/backend).

## Stack

- **Expo SDK 58**, React Native 0.88, **Expo Router**, TypeScript estricto. Node **>= 22.13** (`.nvmrc`).
- **Development build** (`expo-dev-client`): Expo Go de la App Store está trabado en un SDK viejo.
- Cliente de la API **generado del contrato**: `openapi-typescript` → `src/api/schema.d.ts` (no editar
  a mano) + `openapi-fetch`. `unwrap()` convierte el `{ error }` del server en `ApiError`.
- Paquetes nativos del revelado y "Arrancó el rollo": **Reanimated 4 + `react-native-worklets`**, **`@shopify/react-native-skia`** (shaders SkSL),
  **`react-native-pulsar`** (hápticos continuos), **`expo-audio`** (plugin con `enableBackgroundPlayback: false`: no toca la sesión de audio de
  la app y respeta el modo silencio) y el **módulo local de Expo en Swift `modules/rollo-symbol`** (SF Symbols animados). Agregarlos o cambiarlos
  pide `npx expo prebuild --clean` + `npx expo run:ios --device`; si no, el dev build viejo no los tiene.
- **VisionCamera** (`react-native-vision-camera` v5 + sus dependencias `react-native-nitro-modules` y `react-native-nitro-image`; cámara de la captura y del
  momento del día, reemplazó a `expo-camera`) es nativo: agregarlo o cambiarlo pide `npx expo prebuild --clean` + `npx expo run:ios --device`.
- `expo-notifications` es nativo: agregarlo pidió `npx expo prebuild --clean` + rebuild.
- Claves de SecureStore del revelado (no se renombran): `rollo.presentation-seen.<tripId>` (se abrió solo el revelado),
  `rollo.revealIntroSeen.<tripId>` (se vio) y `rollo.rollStartedSeen.<tripId>` ("Arrancó el rollo" visto).
- Clave de SecureStore de la cámara (no se renombra): `rollo.cameraGrid` (`"1"`/`"0"`, cuadrícula prendida; ajuste del celular).
- `ios/` es generado (`npx expo prebuild`) y está en `.gitignore`. La config nativa va en `app.json`; `app.config.ts` solo cambia nombre y
  bundle id según `APP_VARIANT` (ver Apple).

## Estructura del código

```
app/                    Solo rutas (Expo Router). Pantallas finas: arman hooks y componentes de features.
  (tabs)/               NativeTabs: roll, map (+ Feed), camera (abre /capture o /presentation), friends, me; cada una con su Stack
  photo/[id].tsx        visor de una foto revelada; presentation.tsx, capture.tsx, create.tsx, join.tsx, settings.tsx...
  friends/[code].tsx    link de amistad (fuera del grupo protegido; el perfil de un amigo es (tabs)/friends/user/[id])
  reveal.tsx, roll-started.tsx  el revelado y "Arrancó el rollo" (fullScreenModal; fino, usan `src/features/reveal` y `capture`)
  user/[id].tsx         perfil de cualquier usuario desde fuera de Amigos (miembros, autor de una foto)
  featured/[userId]/[mediaId].tsx  visor de una foto destacada de un perfil
src/
  features/<dominio>/   Todo lo de un dominio, junto:
                          actions.ts      llamadas a la API (es lo que mockean los tests de pantalla)
                          use-*.ts        hooks (datos con TanStack Query, estado)
                          *.ts            lógica pura, testeable sin React
                          *.tsx           componentes propios del dominio
                          __tests__/      tests de esa lógica, al lado del código
                        Dominios: info (botones "i" con explicación), camera (la cámara propia compartida: disparador, flash, zoom, dar vuelta; la usan capture y moments), moments (momento del día: planificador de avisos locales, cuenta regresiva y dos cámaras, banner en Rollo), auth (sesión, login, gate), friends (amigos, link de amistad, perfil de un usuario, sumar a un rollo, salirse), profile (nombre, foto, `Avatar`, `useOpenProfile`, visibilidad), featured (destacadas: grilla, mapa por zonas, visor), trips (el rollo: lista desde el server, rollo activo, detalle, etapas), capture (cámara, cola
                        offline, subida), feed, map, media (fotos reveladas + fuente con token), gallery
                        (grilla, visor, descargas), exif (metadatos de las fotos), presentation, reveal, notifications (push, permiso, Ajustes → Notificaciones), likes (me gusta), roll (tablero), moderation (denunciar y bloquear: menú en Feed, visores y perfil de otro, Ajustes → Bloqueados; los errores van con `burnt`).
  ui/                   theme.ts (tokens) + componentes base compartidos: Screen, Section, Row, SwitchRow, Button,
                        Field, Body, Footnote, ErrorText, Loading
  api/                  cliente generado del contrato (schema.d.ts NO se edita a mano) + client.ts
  storage/              lo que se guarda en el celular (SecureStore). Sus claves NO se renombran
  test/                 helpers de tests: rutas de la app (routes.ts) y SQLite en memoria
__tests__/              tests de pantallas con navegación real (renderRouter)
modules/rollo-symbol/   Módulo local de Expo (Swift): vista nativa de SF Symbols con transición magic replace; wrapper JS con fallback
```

Reglas:

- **`app/` solo rutea.** Un archivo de `app/` lee params y monta `<XScreen />` de su feature (`*-screen.tsx`):
  sin estado, efectos, API ni cache. Ejemplo y detalle en `docs/arquitectura.md`.
- **Escrituras con `useMutation`:** cada una es un hook `use-<verbo>-<cosa>.ts` en su feature que invalida el cache que
  cambia; la pantalla navega en el `onSuccess` del `mutate` y muestra `errorMessage(mutation.error, "…")` con `ErrorText`.
  Nada de `try/catch` + `setLoading` a mano en código nuevo.
- **Una feature por dominio, y una feature no mete mano en otra.** Puede importar lo público de otra
  (hooks, tipos, funciones), pero si dos features necesitan la misma pieza, esa pieza se sube a un módulo
  propio (como `media` para galería y presentación) en vez de copiarla o de tocar la otra feature.
- **Componentes compartidos:** un componente vive en su feature hasta que lo usan dos o más features;
  recién ahí pasa a `src/ui/` (que solo tiene primitivas visuales, sin datos ni API).
- **Lógica pura aparte y testeada**: cálculos, formatos, agrupaciones y máquinas de estado van en `*.ts`
  sin React, con tests en `__tests__/` de la misma feature.
- **Nombres:** archivos en kebab-case y en inglés; hooks `use-*.ts`; un componente por archivo cuando es
  público. El dominio en el código se llama `trip` (como en la API) aunque en la UI sea "rollo".
- **Rutas nuevas** se registran en `app/_layout.tsx` (presentación, sheet, modal) y en `src/test/routes.ts`.
- **Datos persistidos en el celular** (claves de SecureStore, base SQLite y sus columnas, key del cache de
  TanStack Query, carpetas `Documents/pending/` y `Documents/map/`): no se renombran, porque rompería los
  datos de quien ya tiene la app.

## Skills de diseño y motion

En `.claude/skills/` (copiadas tal cual de sus repos): `emil-design-eng`, `animate-expo`, `review-animations`,
`find-animation-opportunities` (Emil Kowalski) y `text-to-lottie` (Diffusion Studio). Se sacaron por duplicadas: `animate`
(versión web de `animate-expo`), `design-motion-principles` (se pisa con `emil-design-eng`) y `appllama-app-design-skill`
(sin su MCP lo cubren `expo-design-system` / `expo-native-ui`). `review-animations` solo la invoca el usuario (`/review-animations`).
Si una skill contradice este archivo, **gana este archivo**.

- **El target es React Native, no la web.** Los ejemplos de las skills de Emil son CSS,
  Framer Motion o WAAPI: se toman los principios (cuándo animar, curvas, duraciones, interrupción, salidas) y se implementan con
  **Reanimated 4 + `react-native-worklets` + Gesture Handler** (más `expo-haptics` / `react-native-pulsar` y Skia donde ya se usan).
  Traducción: `transition`/`@keyframes` → `withTiming`/`withSpring`/`withSequence`; `cubic-bezier(...)` → `Easing.bezier(...)`;
  `:active`/hover → `Pressable` con `onPressIn` + shared value (en iOS no hay hover); `prefers-reduced-motion` →
  `useReducedMotion()` / `ReduceMotion.System`; `will-change`/GPU → solo `transform` y `opacity` en el UI thread; `layout` de Framer
  → `LinearTransition` / `entering` / `exiting`. Gestos con `Gesture.Pan()` etc. y nada de `runOnJS`/`scheduleOnRN` por frame.
  Gesture Handler no es dependencia directa todavía: si hace falta, `npx expo install react-native-gesture-handler` + rebuild.
- Para **implementar** usar `animate-expo` (la versión web, `animate`, se sacó por duplicada); `review-animations` sirve por el criterio.
- **Lottie:** `text-to-lottie` arma un player web de preview (`npx degit diffusionstudio/lottie`): va **fuera del repo** (scratchpad),
  nunca dentro de `mobile/`. Los JSON van a `assets/lottie/` (los del sitio a `scripts/site/`) y salen de
  `scripts/build-lottie.mjs`; en la app se reproducen con `lottie-react-native` (nativo: cambiarlo pide rebuild). El revelado (shader de Skia)
  se mantiene; Lottie es para piezas chicas e ilustrativas, nunca para estados de la UI.
  **Intro de una cuenta nueva** (`/intro`, `src/features/intro/`, fullScreenModal): al terminar "Completá tu perfil" se marca pendiente
  (`rollo.appIntroPending`) y, al montar las tabs, se abre una sola vez por celular (`rollo.appIntroSeen`, `use-app-intro.ts`): el logo se arma lento
  (`assets/lottie/app-intro-*.json`), "Sacá la foto." / "Mirala después." y el botón "Empezar" (no se toca ni lo lee VoiceOver hasta que aparece);
  con "Reducir movimiento", logo quieto y fundidos. Marca también `rollo.welcomeIntroSeen`.
  La bienvenida de Rollo (sin rollos todavía, `src/features/roll/welcome.tsx`) lleva el logo arriba del título: la primera vez en el celular se anima (`assets/lottie/logo-intro-*.json`, una vez, sin háptico ni sonido; `rollo.welcomeIntroSeen`) y después queda el último cuadro.

## Cómo trabajamos

- **Modelos (para cuidar el usage):** planear con **Opus** (diseño, decisiones, partir el trabajo) y
  ejecutar con **workers en paralelo con Sonnet** (subagentes o sesiones con `model: sonnet`), cada uno
  con una tarea acotada y su brief completo (archivos, qué es "terminado", cómo testear). Opus revisa
  el resultado; no implementa él mismo lo que puede hacer un worker.
- **Idioma:** el código va en **inglés** (identificadores, comentarios, descripciones de tests, nombres de
  rutas y carpetas). En **español rioplatense** quedan solo los textos que ve el usuario (labels, mensajes,
  `accessibilityLabel`, títulos de pantalla), los commits y los PRs. Las etiquetas visibles de las tabs
  ("Rollo", "Mapa", "Cámara", "Feed", "Perfil") siguen en español aunque la ruta sea `roll`, `map`, etc.
- **TDD siempre:** primero el test (descripciones en inglés), verlo fallar, código mínimo, refactor.
  - Lógica (`src/**/__tests__`): `fetch` simulado con `globalThis.fetch = jest.fn(...)`.
  - Pantallas: `renderRouter` de `expo-router/testing-library` con navegación real, mockeando
    `@/features/*/actions`. En Testing Library 14 **`fireEvent` es async**: siempre `await fireEvent...`.
  - `jest.setup.ts` mockea SecureStore en memoria.
- **Si el backend cambia la API:** `npm run api:generate` (o `API_SPEC=../backend/openapi.json npm run api:generate`)
  y commiteá `schema.d.ts`. El job `contract` del CI falla si quedó atrás.
- **Ramas:** `develop` es la default. Features en `feature/*` desde `develop`, vuelven por PR con CI
  en verde. `main` es producción (PR + CI + 1 aprobación, el admin puede saltearla). Sin push directo.
- Mensajes de commit y PR en español.
- Al agregar paquetes nativos: `npx expo install <paquete>` (respeta las versiones del SDK) y después
  rebuild con `npx expo run:ios --device`. `.npmrc` tiene `legacy-peer-deps=true` por un conflicto de peers del SDK 58.

```bash
npm test                      # 1657 tests
npm run test:watch
npm run typecheck
npm run icons                 # regenera ícono y splash (assets/)
npm run lottie                # regenera los Lottie (momento, bienvenida, intro; assets/lottie/ y scripts/site/)
npx expo run:ios --device     # compila e instala el dev build en el iPhone
npm start                     # día a día, con el dev build ya instalado
```

**Contra el backend local** (sin la variable, la app usa el de producción):

```bash
# en ../backend (dev:lan hace que las URLs de subida apunten a la IP de la Mac)
npm run dev:lan
# acá
EXPO_PUBLIC_API_URL=http://$(ipconfig getifaddr en0):8787 ./node_modules/.bin/expo start --dev-client --clear
```

Si compilar falla:
- `pod install` con error de encoding: correr con `LANG=en_US.UTF-8`.
- MapLibre no baja su binario ("invalid archive" / "already exists"): `cd ios && xcodebuild -resolvePackageDependencies -workspace Rollo.xcworkspace -scheme Rollo` y volver a compilar.
- Después de cambiar de rama o instalar paquetes con Metro abierto, reiniciar Metro con `--clear` (si no, MapLibre se registra dos veces).

Para entrar a un rollo revelado del seed: login con `juani@rollo.test` (está en los rollos de prueba, incluido Bariloche revelado, y es admin de "Finde en Tandil"); el código de 6 caracteres aparece en la consola de `npm run dev:lan` del backend.
`npm run seed` del backend imprime al final cada cuenta y qué probar con ella (amigos con y sin rollos en común, uno que se salió y uno que sacó el admin,
descripciones corta / de 150 / de 3 renglones, `nuevo@rollo.test` vacío, `rocio@rollo.test` sin @usuario), cada rollo con su código y etapa, y un
link de amistad de Lu (`rollo://friends/<CODE>`, vale 1 hora; correr el seed de nuevo lo renueva). El detalle está en el CLAUDE.md del backend.

## Sitio público

`rollo.juanifraga.com` (Cloudflare Workers, solo archivos estáticos, Worker `rollo-site`): la home es la **landing** (8 secciones
con maquetas de la app en HTML/CSS y el botón "Probar la beta en iPhone" a TestFlight), `/soporte` (preguntas frecuentes y contacto;
`/#soporte` cae en el link a esa página), `/privacidad`, `/terminos` y `/entrar` (el link mágico del mail; script inline, sin pedidos a
ningún lado, con su CSP). Los textos legales se escriben **solo** en `docs/legal/*.md` (`etiquetas-privacidad.md` es interna, no
se publica); `scripts/build-site.mjs` arma el HTML en `site/dist/` (la home vive en `scripts/site/home.mjs` y `mockups.mjs`, los
tokens de color compartidos en `scripts/site/tokens.mjs`). `npm run site:build` para verlo, `npm run site:deploy` para publicarlo.
Son las URLs de privacidad, soporte (`https://rollo.juanifraga.com/soporte`) y marketing de App Store Connect.
- **Botón de la home:** constantes `STORE_MODE` (`"beta"` por defecto, o `SITE_STORE_MODE=appstore`) y `APP_STORE_URL` en
  `build-site.mjs`. En modo `appstore` el botón pasa a ser el badge oficial de Apple, que hay que bajar a
  `scripts/site/app-store-badge.svg` (no se dibuja a mano); sin ese archivo o sin `APP_STORE_URL` el build falla.
  El deploy no setea `SITE_STORE_MODE`, así que lo que sale es el default del código. **Para cambiar cuando Apple apruebe:** cambiar
  el default `"beta"` → `"appstore"` en `build-site.mjs`, completar `APP_STORE_URL` y agregar el badge oficial (la ruta del badge se
  puede pisar con `SITE_APP_STORE_BADGE`, lo usa el test).
- **Momento del día:** la sección `#momento` reproduce el Lottie una vez al entrar en pantalla (`lottie-web` light, `/lottie.js`, mismo JSON que la intro de la app en sus variantes `scripts/site/moment-intro-{light,dark}.json`); el SVG estático del HTML es el fallback.
- **Animaciones:** Motion (`animate`, `scroll`, `inView`) empaquetado con esbuild en `/motion.js` (servido desde el sitio, sin CDN) +
  `scripts/site/landing.js`. Con "Reducir movimiento" o sin JS la página queda en su estado final (fotos nítidas).
  Ojo: en Motion no animar a `transform: "none"` (lo vuelve una matriz de escala 0); usar `y`.
- **Imagen para compartir:** `npm run og` regenera `scripts/site/og.png` (1200×630, `scripts/build-og.mjs`); se commitea.
Contacto: `soporte@juanifraga.com` (Email Routing de Cloudflare → Gmail de Juani).

## Apple

- **Dos variantes** (`app.config.ts`, según `APP_VARIANT`), porque el bundle id `com.juanifraga.rollo` ya lo
  registró el Personal Team gratis y no se puede usar en otra cuenta:
  - **Desarrollo** (default, `npx expo run:ios --device`): cuenta gratis de Apple (Personal Team `T7Y7X6AGTX`),
    bundle id `com.juanifraga.rollo`, se llama **"Rollo Dev"** en el celular. El build vence a los 7 días y se
    reinstala con el mismo comando. Push, Universal Links y TestFlight **no** funcionan con esta cuenta.
  - **Producción** (EAS, `APP_VARIANT=production` lo pone `eas.json`): cuenta **paga individual de un amigo**
    (Juani es Admin en App Store Connect; el amigo es el único que acepta los acuerdos/licencias), bundle id
    **`com.juanifraga.rollo.app`**, se llama "Rollo" en el celular (en la App Store tiene otro nombre porque
    "Rollo" estaba tomado). Apunta a `https://rollo-api.juanifraga.com`. Esa cuenta tiene otra app ("Contador
    Truco"): no tocarla.
  - Las dos pueden convivir instaladas en el mismo iPhone (ambas abren `rollo://`).
- **Build y TestFlight** (EAS, proyecto `@rollo-app/rollo`). El certificado de distribución y el perfil viven en
  EAS. Como la cuenta del amigo es individual, Juani no puede entrar al portal con su Apple ID ("no team"): todo
  se hace con la clave de la API de App Store Connect "EAS" (Admin, `.p8` fuera del repo, que es público), que se
  pasa por variables de entorno en la terminal:

  ```bash
  export EXPO_ASC_API_KEY_PATH="/ruta/al/AuthKey_XXXX.p8" EXPO_ASC_KEY_ID=... EXPO_ASC_ISSUER_ID=...
  export EXPO_APPLE_TEAM_ID=UXHNAR4HYC EXPO_APPLE_TEAM_TYPE=INDIVIDUAL
  npx eas-cli@latest build -p ios --profile production    # en la nube; sube solo el build number
  ```

  Al "Do you want to log in to your Apple account?" se contesta que no. `eas submit` no toma esas variables para
  subir: necesita `ascApiKeyPath`, `ascApiKeyId` y `ascApiKeyIssuerId` en `submit.production.ios` de `eas.json`,
  que se agregan **solo en local, sin commitear**, antes de `npx eas-cli@latest submit -p ios --profile production`.
  `ascAppId` (6825843502) es el Apple ID de la app en App Store Connect. El export compliance ya va en el build
  (`usesNonExemptEncryption: false`).
- **Actualizaciones sin pasar por Apple (EAS Update, `expo-updates`):** los builds de producción escuchan el canal `production`
  (`eas.json`). Un cambio **solo de JS, estilos o imágenes** se manda con `npm run update:production -- --message "…"` (fija
  `APP_VARIANT=production` y la URL del backend de producción, así nunca sale apuntando al local). El celular lo baja en segundo
  plano al abrir la app y lo usa **la próxima vez que se abre en frío** (hasta dos aperturas). `runtimeVersion` sigue
  `version` de `app.json` (`policy: appVersion`): un update solo llega a builds con la misma versión. **Regla:** cualquier cambio
  nativo (paquete nativo nuevo, permisos, plugins, ícono, SDK) pide **subir `version`** y build nuevo; si no, un update con JS que
  usa código nativo que el build no tiene rompe la app. Los builds 1.0.0 viejos no tienen `expo-updates`: el primero que recibe
  updates es el próximo build. En el dev build no aplica (se usa Metro).
- **Push solo en producción/TestFlight:** `./plugins/without-push-entitlement` se aplica únicamente a la variante dev de `app.config.ts`
  (la cuenta gratis no tiene push); la de producción lleva el entitlement. En el dev build registrar el token falla en silencio y no llegan
  avisos. Para probarlas: `npx expo prebuild --clean` + build nuevo de EAS.
- Pendiente para la revisión de la App Store (no para TestFlight): cuenta de prueba para el revisor en el backend,
  URL de política de privacidad y las etiquetas de privacidad.

## Estado y plan (octubre 2026)

Hecho: crear rollo configurable (fechas, cupos, revelado), unirse con código, etapas del rollo, cámara con
preview, cola offline con subida en segundo plano, cache persistente, Mapa (pins agrupados, carrusel, filtros)
con el Feed adentro, Amigos (tab, link de amistad, perfil con rollos en común, sumar a un rollo), fotos destacadas en el
perfil (grilla, mapa por zonas, perfil público o solo amigos, perfil de cualquier miembro o autor), identidad (cobalto, ícono, splash) y el revelado: tabs Galería · Mapa · Presentación · Amigos · Perfil, cuentas (email + código, perfil con foto y descripción), presentación
(enfoque + historias), galería con visor y descargas a Fotos, y notificaciones push (siete avisos, permiso, Ajustes) con "me gusta" en los visores. Corre en el iPhone
con dev build contra el backend local.

Pendiente antes de enero (ver reports/Estudio de mercado cámaras compartidas.md): estado de subidas en Rollo,
la cola de fotos de otra cuenta (hoy sigue en el celular al cambiar de cuenta), export ordenado por día,
testing externo en TestFlight (revisión de Apple) y la prueba real. El backend ya está en producción
(`rollo-api.juanifraga.com`) y el build 2 (1.0.0) ya se instala por TestFlight (testing interno).

**Próximo build de TestFlight (features agrupadas):** comentarios en las fotos reveladas, solo entre miembros del rollo
(diseño en `docs/superpowers/specs/2026-10-23-comentarios-design.md`) y "Tu actividad" en tu Perfil, empezando por las fotos que te
gustaron (`docs/superpowers/specs/2026-10-23-tu-actividad-design.md`) y decidir adónde van tus fotos: no dejar que las destaquen
en otros perfiles para todas tus fotos, por rollo o con un rollo privado del admin (`docs/superpowers/specs/2026-10-23-fotos-en-perfiles-design.md`), solicitudes de amistad desde el perfil
de otra persona (`docs/superpowers/specs/2026-10-23-solicitudes-de-amistad-design.md`), un cambio de texto: la pastilla pasa a decir
"Destacada en tu perfil", y **sin "Repetir" en la captura**: la foto que sacaste es la que va, como en un rollo. Después de la cámara ya
no hay preview nítido ni "Repetir": la pantalla del caption muestra la foto en grande pero ya difuminada. Y **sin videos en Rollo**
(no van con un rollo de fotos y pesan mucho): la cámara saca solo fotos, crear rollo ya no pide cupo de videos y el cupo es solo de
fotos (por día o de todo el rollo); los videos que ya se subieron se siguen viendo en los rollos viejos
(`docs/superpowers/plans/2026-10-25-captura-y-cupo.md`). Los builds de EAS se agrupan: el plan gratis da 15 de iOS por mes.

Pendiente (después de enero, no antes del viaje): **migrar el backend a Supabase**. La idea es que Postgres de
Supabase reemplace a D1 y que las fotos sigan en R2 (gratis y sin costo de egress), con el Worker conectado
por Hyperdrive o el backend en Supabase. A tener en cuenta: el plan gratis de Supabase pausa el proyecto tras
7 días sin uso, hay que pasar de SQLite a Postgres y la base queda en una sola región. Se planea y hace en
`rollo-app/backend`; si cambia el contrato, la app solo regenera `schema.d.ts`.

Plan para llegar a enero (regla: **nada nuevo después de mediados de diciembre**, solo arreglos):

1. **Cámara y subida offline** (lo central): captura nativa foto/video, GPS, compresión + thumbnail,
   cola en `expo-sqlite`, subida en segundo plano a las URLs firmadas, `complete`, borrar local.
   Paquetes a evaluar para el SDK 58: `expo-image-picker`, `expo-location`, `expo-sqlite`,
   `expo-image-manipulator`, `expo-file-system` (subida en background), `expo-video-thumbnails`,
   `react-native-compressor`.
2. **Antes del revelado:** mapa con pins (`react-native-maps`) + feed de captions + contador.
3. **Revelado:** galería, mapa con fotos, timeline por día, descarga.
4. **Momento del día** (ver arriba) y **cupo diario o total**. Es lo primero que se recorta si no llegamos.
5. **Prueba real** en una escapada corta con amigos, antes del viaje.
6. TestFlight con la cuenta del amigo.
