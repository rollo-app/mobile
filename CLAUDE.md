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
  contraseña), obligatorio al abrir la app (`app/(auth)/`: **bienvenida** → email → código → "Completá tu perfil" si es nueva o
  no tiene nombre). **Bienvenida** (`welcome.tsx` → `src/features/auth/welcome-screen.tsx`, primera pantalla del grupo; ahí caen el gate, "Cerrar sesión" y los links sin sesión): logo (último cuadro del Lottie de la intro), "Rollo Project" (la marca; el nombre bajo el ícono sigue siendo "Rollo"), una línea de qué es y "Crear cuenta" / "Ya tengo cuenta" (las dos van a la pantalla de email, que crea la cuenta si no existe). Al pie, los logos de Instagram y TikTok en gris (`social-links.tsx`, glifos `assets/share/*-mono.png` de `npm run share-logos` teñidos con `secondaryLabel`) abren las cuentas `@rolloproject`; también con los registros cerrados. **Registros cerrados:** `GET /config` (`src/features/waitlist/`, `useRegistrationsOpen`, sin sesión; si falla o no hay red cuenta como **abierto**: nunca se bloquea a quien ya tiene cuenta; no se guarda en el caché persistido) decide: con `registrationsOpen: false` la bienvenida dice "Estamos abriendo Rollo de a poco" (nunca "beta": regla de Apple) y muestra la **lista de espera** (`waitlist-form.tsx`: email + switch de consentimiento + "Política de privacidad", `POST /waitlist` → "¡Listo! Te mandamos un mail para confirmar." que queda en pantalla) en vez de "Crear cuenta"; "Ya tengo cuenta" sigue. Un alta nueva que el server rechaza con **403 `code: "REGISTRATIONS_CLOSED"`** (verificar código, link mágico, Google, Apple; `ApiError.code`, `isRegistrationsClosed`) muestra el mensaje del server con "Anotarme en la lista" (`RegistrationsClosedNotice`: marca la config como cerrada, la invalida y vuelve a la bienvenida); no se cierra ninguna sesión porque no se creó nada. El perfil es **nombre + foto + descripción opcional** (`bio`, hasta 150 caracteres y 3 renglones; `GET/PATCH /me`, foto con `expo-image-picker` (cámara: recorte nativo 1:1; galería: PHPicker sin edición + recorte propio en `/crop-avatar`, `src/features/crop/photo-crop.tsx`, el mismo que recorta la portada vertical 3:4 de un rollo en `/crop-cover`) →
  512 px JPEG → `POST /me/avatar` → PUT → complete; sin foto, círculo con la inicial y `memberColor`). Además tiene un **nombre de usuario único** (`@usuario`, `PATCH /me`): se pide en "Completá tu perfil" junto al nombre
  (sugerido desde el email, con chequeo de disponibilidad) y se muestra en Perfil, Amigos, miembros y Feed. Crear rollo
  o unirse es solo con el código de 6 (`POST /trips/join`; el server pide nombre en el perfil). **La sesión es un
  único token en SecureStore (`rollo.session`)** que usan todas las llamadas; un `401` en cualquiera cierra la
  sesión local y vuelve al login (`setUnauthorizedHandler` en `src/api/client.ts`). Los rollos salen de
  `GET /me/trips` (cache de TanStack Query); el rollo activo es el último que abriste y solo se guarda su id
  (`rollo.activeTrip`). "Completá tu perfil" tiene su propio "Cerrar sesión" (`complete-profile-screen.tsx`): el server contesta **428** "Completá tu perfil" a una cuenta sin nombre o sin @ (la cola de fotos y el código de amigo esperan, como con un 401). "Cerrar sesión" y "Borrar cuenta" están al final de Ajustes; cerrar sesión **no** borra la
  cola de fotos pendientes. **La cola es por cuenta:** cada foto guarda su dueño (`owner_user_id`, el id de la cuenta al encolarla; el id vive en SecureStore `rollo.sessionUserId`, se guarda en `signIn(token, userId)` y se borra en `signOut`; `getSessionUserId()` lo pide a `GET /me` si falta en una sesión vieja). Solo se suben y se ven (tablero de subidas, contadores, cupo, pins pendientes, nube) las de la cuenta con sesión; las de otra esperan sin marcarse fallidas ni borrarse y se suben solas cuando vuelve su dueña. Las filas sin dueño (de antes de este cambio, o encoladas por una sesión vieja que todavía no sabía su id) las reclama **solo esa misma sesión** cuando aprende su id por `GET /me` (`claimLegacyQueue`); una cuenta que entra después nunca se las queda. "Borrar cuenta" borra sus fotos pendientes (filas y archivos; `discardAccountQueue`). Si `POST /auth/logout` no llega al server, esa sesión queda en `rollo.pendingLogout`
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
  Si el link venció, "Volver a pedir un código" abre `/email` con el email puesto. **Universal Links** (solo el build de producción,
  `associatedDomains` en `app.config.ts`; la cuenta gratis no los firma): `https://…/entrar#…` y `https://…/friends#CODE` abren la app directo y
  `app/+native-intent.tsx` los traduce a `/login?token=…&email=…` y `/friends/<CODE>` (`magicLinkPath`, `friendLinkPath`); sin la app, o con un build
  viejo, quedan las páginas del sitio. El sitio publica `/.well-known/apple-app-site-association` (`application/json` vía `_headers`).
  **Continuar con Google** (botón secundario debajo de "Continuar" en el paso del email; `@react-native-google-signin/google-signin` v17, nativo):
  `signInWithGoogle` (`actions.ts`) abre el selector de cuentas de Google (`getGoogleIdToken` en `google.ts`), manda el ID token a
  `POST /auth/google` y guarda la sesión igual que el código (el gate lleva a "Completá tu perfil" si hace falta). Cerrar el selector no hace
  nada (devuelve `null`); cualquier otra falla es un error inline. El token se pide para el client **web** (`GOOGLE_WEB_CLIENT_ID`, la audiencia
  que chequea el backend) y cada build usa su client de iOS (`googleIosClientId` según el bundle id; IDs en `src/config.ts`, proyecto de Google
  Cloud `rollo-514415`). El URL scheme de vuelta lo pone el plugin en `app.config.ts`, uno por variante. `signOut` (cerrar sesión, borrar
  cuenta, 401) también hace `GoogleSignin.signOut()`, así el próximo login muestra el selector. **Nombre y foto por defecto:** el backend le pone a
  la cuenta nueva el nombre de Google (lo trae `GET /me` y "Completá tu perfil" lo muestra editable). La foto la pone la app: se pide a Google en
  512 px (`profileImageSize`; con el avatar de letra de Google el SDK da `photo: null` y no se usa nada), `signInWithGoogle` la deja en memoria
  (`google-photo.ts`, solo si la cuenta es nueva y sin foto; `signOut` la borra) y "Completá tu perfil" la toma una vez y se la pasa a
  `ProfileForm` (`defaultPhotoUrl`), que al montar la baja (`sendFromUrl` de `useAvatarUpload`) y la sube con el flujo normal del avatar (spinner,
  error con "Reintentar"); "Cambiar foto" la reemplaza. Si no se puede bajar, no pasa nada. Si la app se cierra antes de ese paso, la cuenta
  queda sin foto. En Jest, `jest.setup.ts` mockea el paquete
  (`signIn` resuelve "cancelled" salvo que el test diga otra cosa). **Continuar con Apple** (Sign in with Apple, `expo-apple-authentication`, nativo; lo pide la guideline 4.8 por ofrecer Google): el botón
  oficial de Apple (negro en claro, blanco en oscuro, 50 pt y bordes redondos como `Button`) va entre "Continuar" y Google. `signInWithApple`
  (`actions.ts`, `getAppleAccount` en `apple.ts`) pide nombre y email, manda el identity token a `POST /auth/apple` con el nombre (Apple lo da
  **solo la primera vez**; el backend lo usa para precompletar "Completá tu perfil") y guarda la sesión. Cancelar no hace nada; otro error va
  inline. Apple no da foto. **Solo en el build de producción:** la capability la firma la cuenta paga (`ios.usesAppleSignIn` en la variante de
  producción de `app.config.ts`); el dev build (Personal Team) no puede, así que ahí el botón no aparece (`appleSignInEnabled` /
  `useAppleSignInAvailable`, que además pregunta `isAvailableAsync`). Se prueba en TestFlight. En Jest, `jest.setup.ts` mockea el paquete
  (el botón es un `Pressable` "Continuar con Apple"; `signInAsync` cancela salvo que el test diga otra cosa).
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
- **Fotos en tres archivos** (`prepareMedia`, `Documents/pending/<id>/`): el **original** (~4000 px, JPEG 88 %, para imprimir), la **versión de visualización** `display.jpg` (**2048 px**, JPEG 82 %, tope 4 MB del server, con los mismos EXIF/XMP que el original) y el **thumbnail** ~800 px. La visualización sale del original ya terminado; si la foto ya entra en 2048 px (la frontal del momento, 1080 px) no se vuelve a codificar: es una copia del original (y igual se sube, para que el original se pueda borrar). Si no se puede generar, la foto sube sin ella y el server le guarda el original para siempre. La cola suma `display_uri` y `display_size_bytes` (columnas nuevas, nullable, por migración aditiva en `ADDED_COLUMNS`; no se renombran); el registro manda `displaySizeBytes` solo si la fila tiene visualización (el server devuelve entonces `upload.display`) y las filas viejas suben exactamente como antes. **Sin videos en rollos nuevos** (la cámara saca solo fotos; los videos de rollos viejos se siguen viendo y no llevan visualización).
- **Eventos** (`src/features/events/`; diseño en `docs/superpowers/specs/2026-11-12-modo-evento-design.md`): un evento es un rollo de tipo `event` con **grupos**, pensado para muchos invitados (un casamiento). Quien lo crea es **organizador** (ve todo y arma grupos, concurso y el QR del evento); los **invitados** ven solo las fotos de sus grupos. Se crea desde "Rollo | Evento" en Crear (nombre y al menos un grupo). **Portada, descripción, QR y vista previa ya no son solo de eventos: valen para cualquier rollo** (la portada es siempre una foto vertical 3:4, evento o rollo común; las cuadradas viejas se siguen viendo, recortadas al centro) (ver "Rollo común" abajo); lo propio del evento siguen siendo grupos, concurso, Feed y elegir grupos al unirse. Se entra por el QR o link `https://rolloproject.com/join/<CÓDIGO>` (`app/join.tsx`, también se escribe el código; sirve para cualquier rollo): sin cuenta guarda el código en SecureStore (`rollo.pendingJoin`, 24 h) y lo abre al terminar de crear la cuenta, **esperando la intro de cuenta nueva** (`use-pending-join.ts`); ahí elige uno o varios grupos (mínimo uno). Bajo la portada, sin revelar, una línea con el contador (`joinedLine`, `memberCount` de `GET /events/{code}`): "N personas ya se unieron", "Sé de los primeros en unirte" si el server manda `null` (menos de 5) y nada si el campo no viene (API vieja); sin avatares ni nombres. Dentro del evento, la portada dice "<día> · N personas" y el cupo/"lleno" del rollo usan `detail.memberCount` (total de activos, igual para todos): en un evento `detail.members` solo trae a quien ves (organizadores, vos y quienes comparten grupo), así que **no** se usa su `length` para contar. En la captura salen los chips de grupos (ver abajo). Las tabs de un evento tienen **Feed en vez de Mapa**, y el Feed se oculta tras el revelado; la Galería suma el filtro **"Grupos"**. El tablero del organizador tiene Grupos (crear, renombrar, borrar) y el QR (Skia, se comparte como PNG de ~1024 px; en un rollo común lo muestra cualquier miembro).
  **Rollo común con portada, descripción y QR:** `Crear rollo` (`create-screen.tsx`) tiene Descripción y Portada opcionales también en "Rollo" (no solo en "Evento"); la portada se sube **después** de crear el rollo, en segundo plano (`uploadChosenCover`), y si falla el rollo queda creado y sale un `Burnt.alert` "No se pudo subir la portada" ("Podés elegirla desde Ajustes del rollo"). Al elegir una portada nueva (en Ajustes, o en Crear una vez subida) se abre el modal `/cover-focus` ("Ajustar banner", `src/features/trips/cover-focus-screen.tsx`): se arrastra un recuadro con el aspecto de la tarjeta (ancho de la tarjeta : 180 pt) sobre la foto 3:4 y "Listo" guarda `coverFocusY` (0 arriba … 1 abajo, `null` = al medio; `PATCH /trips/{id}`, `use-update-cover-focus.ts`; el server lo vuelve a `null` al cambiar la portada); la tarjeta en vivo y la miniatura de la lista lo usan como `contentPosition` (`cover-focus.ts`). La fila **"Ajustar banner"** de Ajustes del rollo (con portada, admins, hasta el revelado) lo vuelve a abrir. La portada se cambia **solo** en Ajustes del rollo (Editar rollo tiene solo la Descripción). La descripción se edita en cualquier etapa; la portada, hasta el revelado (el server la congela: 409 "Este rollo ya se reveló."). El tablero (`event-board-hero.tsx`) muestra la portada grande y la descripción en cualquier rollo, con `heroSubtitle` (día del evento, o fechas del viaje con `tripDates`, + "N personas"); sin portada, solo la descripción, y sin ninguna de las dos, nada. "Invitar" ofrece el QR a cualquier miembro (en un evento, solo al organizador) y el mensaje de compartir usa siempre el link. **Unirse** (`join-screen.tsx`): el link o QR de un rollo común muestra la vista previa (portada, nombre, descripción, fechas con `previewDates`, cuánta gente) y "Unirme" entra directo (sin grupos); revelado, "Este rollo ya se reveló." y sin botón; un código escrito de un rollo común se une directo. Si ya estás en ese rollo, el link o QR lo abre sin vista previa ni unirse, aunque la lista de rollos cargue después (`openMine`, una vez por link, se vuelve a chequear cuando llega `trips`). **Concurso de fotos** (`src/features/contest/`; rutas `app/contest-picks.tsx` —el organizador elige las finalistas, **sin tope** (mínimo 2 para revelar; "N elegidas" y, pasadas 15, "· te sugerimos hasta 15", sin bloquear)—, `app/contest.tsx` —votar, desempate y resultado— y `app/contest-winner.tsx` —el revelado de la ganadora, fullScreenModal—, las tres leen `trip` o `tripId`): `ContestCard` aparece en la Galería y en el segmento "Rollo" del evento revelado. **Votar es una por una** (`FinalistPager`, como las historias: progreso "Finalista 2 de 12" —barra continua pasadas 20—, @usuario del autor, "Cierra en …" y "Votar esta" / "Tu voto ✓"; orden al azar fijo por persona). **Resultados:** la ganadora arriba con el sello "Ganadora" y abajo el **ranking por votos** (empates comparten puesto; `ranking.ts`), tocar una la abre a pantalla completa en orden de puesto ("2° puesto"); el desempate de organizadores usa la misma lista con "Elegir ganadora". **Revelado de la ganadora** (`winner-reveal-screen.tsx`, `confetti.tsx`, tiempos en `winner-timeline.ts`): `useWinnerReveal` (montado en `ContestCard` y `ContestScreen`, con guarda para que no abra dos veces) lo abre **una vez por evento** cuando el concurso está cerrado con ganadora (`rollo.contestWinnerSeen.<tripId>`, se marca al abrir): cuarto oscuro rojo → la foto sale de su miniatura con `DevelopImage` (espera la miniatura, con tope, para no mostrarla nítida antes) y háptico que crece → flash + háptico de éxito + obturador → "Ganó la foto de @cami" (o el nombre; "¡Ganó tu foto!" para la autora) con avatar y "12 votos" → confeti chico cobalto y blanco → "Ver resultados" (`router.dismissTo("/contest?trip=…")`: vuelve al concurso si está abajo, si no lo reemplaza). Tocar saltea al final; con "Reducir movimiento", sin shader ni confeti, fundido de 300 ms y un háptico; con la ganadora oculta para vos (`imageAvailable: false`), sin foto. Los avisos `contestResult` abren `/contest?trip=<id>` o `/contest-picks?trip=<id>`: `notification-target.ts` deja ese rollo activo (como `/roll`) y conserva `trip` en el href. Ajustes → Notificaciones tiene el switch "Concurso de fotos" (`contestResult`) en el grupo Rollos. El server rechaza el revelado manual con 409 "Elegí al menos 2 fotos para el concurso o apagalo." si hay concurso y menos de 2 finalistas. La fila **"Revelar ahora"** de Ajustes del rollo (`roll/reveal-now.tsx`, `use-reveal-trip.ts`, `POST /trips/{id}/reveal`) es solo del creador y **solo de eventos** (los rollos comunes siguen como antes), con el evento terminado y sin revelar; pide confirmación con `Alert` (en un evento con concurso suma "Se abre la votación del concurso.") y muestra el error del server (p. ej. ese 409) inline con `ErrorText`.
- **Eventos en la captura:** la ubicación se pide y se guarda igual que en un rollo común (el mapa no se muestra en eventos). Con varios grupos para mandar, el caption muestra chips (`GroupChips`; el organizador tiene "Todos los grupos"); la elección viaja en la columna `group_ids` de `pending_media` (JSON de ids, solo eventos, `null` en un rollo común y en filas viejas) y el uploader la manda como `groupIds`. Los últimos grupos elegidos se guardan en SecureStore `rollo.lastGroups.<tripId>` (JSON de ids). Ni la columna ni la clave se renombran.
- **Qué se ve y qué se guarda:** a pantalla completa (visor de la galería, historias, destacadas, selfie del momento grande) la app carga `files.display` (`RevealedPhoto.displayPath`; si no hay, el original) y las miniaturas no cambian; `use-story-prefetch` precarga la visualización. Las destacadas piden la variante `display` (`featuredDisplayPath`). **"Guardar en Fotos" / "Guardar todo"** (`gallery/save.ts`) bajan el **original** mientras `originalAvailable !== false` y, si ya se borró, la visualización (con la misma inyección de metadatos). **Los originales se borran 14 días después del revelado** salvo que el rollo los conserve (`Trip.originals: { keep, expiresAt, purged }`): con `expiresAt` y sin `purged`, el segmento "Rollo" del rollo revelado y el tope de la Galería muestran "Las fotos en máxima calidad se borran el 12 de diciembre. Guardalas en tu celular antes." (fecha en la zona del rollo, `originalsNotice` + `OriginalsNotice` en `trips/`); con `purged`, "…ya se borraron. Quedan en alta calidad para ver y guardar."; con `keep`, nada.
- **Metadatos:** al mandar, el original y la visualización llevan EXIF (fecha/hora local del rollo con offset, GPS, `Software: Rollo`) y XMP
  con caption y autor en Unicode (`piexifjs`, JS puro). Al guardar en Fotos se inyectan si el original no tiene fecha.
- **Límite de fotos por persona**, que el admin elige al crear el rollo: **"Por día"** (10 por defecto) o **"Todo el rollo"** (`photoLimitMode` `daily` | `total` + `totalPhotoLimit`; 20 por defecto). Lo aplica el server, con tope de **30 por día** y **200 en todo el rollo** (`MAX_DAILY_PHOTOS` / `MAX_TOTAL_PHOTOS` de `create-form.ts`, los de los steppers; al crear y al editar; un rollo viejo que ya pasa el tope lo conserva hasta que se cambie ese valor). Con cupo total, el badge de la cámara, "Tenés N fotos en el rollo", el tablero ("Te quedan N de M") y la cola offline (`countPending` sin día) cuentan lo que queda en todo el rollo.
- **Offline first:** al disparar se guardan foto, hora (UTC + zona) y GPS. Pedir ubicación apenas se
  abre la cámara; sin fix, usar la última conocida y guardar su precisión. Cola local en SQLite, subida
  en segundo plano cuando hay señal, **UUID generado en el celular** (reintentar es seguro).
  Si el server contesta **410** (el rollo se borró para todos), la foto se descarta en silencio (fila de la cola y archivos) sin marcarla fallida; el 404 de `complete` sigue como antes.
  Con la app cerrada o suspendida sube `expo-background-task` (tarea `rollo-upload`, BGProcessingTask de iOS: solo
  con red, cuándo corre lo decide el sistema, ~25 s por pasada con corte limpio entre ítems); los PUT usan sesión
  de URLSession en background. Si se mata la app a mano, iOS no la despierta hasta que se vuelva a abrir.
  En dev, la fila "Probar subida en segundo plano" de Ajustes (sección Desarrollo) la dispara.
- **Mapa sin señal automático** (`src/features/map/offline-*.ts`): al abrir la app y al volver a primer plano baja solo
  una zona amplia (300 km, z5–10) y otra detallada (40 km, z10–14) alrededor de la ubicación y de los lugares donde
  sacó fotos el grupo (grilla de 30 km), desde 3 días antes del inicio hasta el fin del rollo (antes del inicio, solo
  con Wi‑Fi; tope ~400 MB). La ventana y el vencimiento salen del resumen de `/me/trips`: el feed se pide solo de los rollos en ventana y el detalle nunca. Los packs usan el mismo `file://` de estilo que el MapView, se nombran
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
  momento, siempre igual o posterior al fin; el rollo dura como mucho 31 días). Las fechas las valida el server; la app muestra su mensaje inline (`src/features/trips/create-form.ts` solo chequea los nombres).
- **Privacidad de los rollos:** un rollo solo existe para sus miembros. Nadie más ve sus fotos, su nombre ni que existe
  (la excepción es el código: quien lo tiene —por QR, link o escrito— ve antes de unirse la portada, el nombre, la descripción, las fechas y cuánta gente hay, vía `GET /events/{code}?any=1`, que responde para cualquier rollo solo con ese parámetro (sin él, un rollo común sigue siendo 404 para no romper builds instalados); sin el código, nada. Tampoco en el perfil de un amigo: "Rollos en común" son solo los rollos donde **los dos** son miembros activos). Si algún
  día hay rollos públicos, es una decisión del grupo, no de una persona.
- **Amigos** (`src/features/friends/`): se hace amistad con un **link de amistad** (`POST /friends/link`, vale 1 hora, uno
  vivo a la vez, multiuso): `https://rollo.juanifraga.com/friends#<CODE>` (Universal Link; `rollo://friends/<CODE>` sigue andando) con CODE de 8 caracteres, que también se puede escribir a mano o pegar con el link entero. Abrirlo
  (`app/friends/[code].tsx`, fuera del grupo protegido) llama a `POST /friend-links/claim` **sin sesión** y: con cuenta lista
  canjea (`POST /friends/redeem`) y abre la tab Amigos; sin cuenta guarda el permiso de canje (24 h) en SecureStore
  (`rollo.pendingFriend`, nunca en el cache de Query) y lo canjea cuando el perfil queda completo (`use-pending-friend.ts`,
  el único lugar donde se canjea). Mientras abre dice "Abriendo el link…"; si el link no sirve (400/404 o código mal escrito) muestra "Este link ya no sirve" con "Ir a Rollo", y si no pudo abrirlo (sin red, 5xx, 429) "No pudimos abrir el link" con "Reintentar" e "Ir a Rollo" (`friend-link-failure.ts`). "Completá tu perfil" tiene el campo opcional "¿Te invitó un amigo? Código". La tab **Amigos**
  (`(tabs)/friends`, global: funciona sin rollos) tiene la lista (foto, nombre y @) e "Invitar a un amigo"; tocar uno abre su
  perfil (`/friends/user/<id>`) con su encabezado, sus destacadas ("Fotos | Mapa"), "Rollos en común" (`GET /friends/{userId}`),
  "Sumar a un rollo" y "Borrar amigo" (silencioso). Cualquier miembro suma a **sus** amigos al rollo
  desde "Sumar amigos" (sheet `add-friends`, respuesta por amigo: "Ya está" / "No disponible"); al crear un rollo, si tenés
  amigos, se abre esa sheet encima del rollo nuevo (si no se pueden cargar, no pasa nada), y cualquiera menos el creador
  puede "Salirme del rollo" (conserva sus fotos y puede volver con el código, pero solo antes del revelado; el creador no lo ve: él "Borra el rollo para todos", ver "Roles, archivar y eliminar rollos"). Sin la app, `/friends` del sitio muestra el código, "Abrir Rollo" y el link para bajarla.
  **Solicitudes de amistad** (`friend-request-button.tsx`, `friend-requests-row.tsx`, `friend-requests-screen.tsx`, `use-friend-request.ts`): en el perfil de otra persona, si no son amigos y no la bloqueaste, un botón centrado debajo del encabezado según `friendRequest` (`none` → "Agregar amigo"; `sent` → "Solicitud enviada" (tocarla la cancela, sin menú); `received` → "Aceptar solicitud" y "Rechazar"). Es optimista (el perfil y la lista cambian al toque y vuelven si el server dice que no) y el error va inline. Las recibidas entran por una fila "Solicitudes" con la cantidad arriba en la tab Amigos (solo si hay), que abre la pantalla "Solicitudes" (`(tabs)/friends/requests`) con Aceptar / Rechazar por fila y "No tenés solicitudes pendientes." si no queda ninguna (`GET /me/friend-requests`). Rechazar es silencioso. Séptimo aviso push `friendRequest` ("Cami te mandó una solicitud de amistad", abre la tab Amigos) con su switch "Solicitudes de amistad" en Ajustes → Notificaciones.
- **Buscar usuarios** (tab Amigos, `src/features/friends/use-search-bar.ts`, `friend-search-results.tsx`, `use-user-search.ts`, `search-request-button.tsx`): búsqueda nativa en el header: en iOS 26 una lupa redonda a la derecha del título (la tab Amigos usa título chico para que queden en la misma línea) que se abre hacia la izquierda en el campo ("Buscar por nombre o @usuario"; `headerSearchBarOptions` con `placement: "integratedButton"` y `allowToolbarIntegration: false` vía `navigation.setOptions`, el único archivo que toca la barra es `use-search-bar.ts`). Con texto la tab muestra solo resultados: "Amigos" (los tuyos que coinciden, filtrados en el celular desde 1 caracter, con `value="Amigos"`) y, desde **2 caracteres** (con pausa de 300 ms), "Personas" (`GET /users/search?q=`, hasta 20, sin cursor). Coincide el @usuario por prefijo o el comienzo de alguna palabra del nombre, sin tildes ni mayúsculas (mismas reglas en `search-text.ts` y en el server). **Nunca aparecen:** vos, tus amigos (en Personas), quien bloqueaste o te bloqueó, ni cuentas sin @usuario o sin nombre. Cada fila muestra foto, nombre, "@usuario · N en común" y el botón de solicitud según `friendRequest` ("Agregar" / "Enviada" (tocarla de nuevo la cancela, sin menú) / "Aceptar", optimista, error debajo del botón); tocar la fila abre el perfil. Vacío: "No encontramos a nadie con "{texto}"."; error con "Reintentar" sin perder la sección Amigos; con 20 resultados: "Si no está, escribí más de su nombre o su @.".
- **Perfil de cualquier usuario** (`src/features/friends/user-profile-screen.tsx`, `GET /users/{userId}` →
  `{ user, isFriend, profileVisibility, canSee, friendCount, mutualCount, rollCount, featuredCount }`): sin título en la barra (el nombre está en el
  encabezado, `ProfileHeader`, el mismo del tuyo); nombre, @, foto y **descripción** se ven siempre. Debajo, la **línea de números** "8 rollos · 34 fotos · 12 amigos" (`profile-stats.ts`: `statParts`, plurales sin "1 amigos", miles con punto "1.284"; los ceros no se muestran). Es **un solo botón** (`accessibilityRole="button"`; VoiceOver lee "8 rollos, 34 fotos, 12 amigos", `spokenStats`) que abre `/user/<id>/friends` (`GET /users/{userId}/friends` → "Amigos" con la lista completa si `canSee`, si no "Amigos en común" con solo los comunes) cuando tiene la parte de amigos; sin ella es texto plano (un botón deshabilitado VoiceOver lo anuncia "atenuado"). **Rollos y fotos** salen solo con `canSee` y sin bloqueo (`blockedByMe`): `rollCount` (rollos donde es miembro activo; el server lo manda `null` si no podés verlo) y las fotos = el largo de la grilla de destacadas si ya cargó (`useFeatured`, la misma query de `ProfileShowcase`, sin pedido extra), si no `featuredCount` del server. Los amigos (`friendCount`) se ven siempre, pero con perfil privado y ningún amigo en común no sale nada. **"N amigos en común"** es una línea aparte y tocable debajo (`mutualText`, abre la misma lista; solo en el de otro y si N > 0). Tu Perfil (`src/features/profile/me-screen.tsx`, lee `useUser(me.id)`) arma la línea con `ownStats` (`own-stats.ts`): amigos de `useFriends()` (lleva a la tab Amigos), rollos de `rollCount`, fotos de la grilla (`useFeatured`) o `featuredCount`; mientras no haya amigos cargados no dibuja la línea (sin parpadeo); con 0 amigos y nada más, dice "Todavía no tenés amigos" y lleva igual a Amigos; en el de otro, sin nada que mostrar no hay línea. (`friend-count.ts` se reemplazó por `profile-stats.ts`.) El nombre se parte hasta 3 renglones, el @ va en uno con puntos al medio y un nombre vacío no deja hueco;
  destacadas solo si `canSee` (sos vos, es tu amigo o su perfil es público), si no "Este perfil es privado"; y si es amigo, además lo de amigo
  (`useFriend` solo con `isFriend`). Se llega desde la tab Amigos (`/friends/user/<id>`) y desde afuera con `/user/<id>`
  (push en el stack raíz): tocar un miembro en "En el rollo" (vos no sos tocable), el avatar o el nombre del autor en la
  tarjeta del mapa, en una fila del Feed y en el visor. Tocarte a vos lleva a Perfil (`/me`). Todo pasa por
  `useOpenProfile()`: desde una sheet o el visor (modales) primero se cierra el modal (`leave`) y después
  se hace el push, porque un push después de un modal se presentaría como otro modal.
- **Fotos destacadas** (`src/features/featured/`): de un rollo **revelado** donde sos miembro activo destacás **fotos** (no
  videos), **tuyas o de tus amigos** (el server rechaza las de quien no es amigo con 409 y `canFeature` lo refleja; si dejan de ser amigos o hay un bloqueo, se sacan de los dos perfiles las fotos del otro y volver a ser amigos no las devuelve; "Borrar amigo" y bloquear invalidan `["featured"]` y `["featured-by"]`), hasta **60**: en el visor con el ícono de perfil "Agregar a tu perfil" / "Sacar de tu perfil" (`person.crop.circle.badge.plus` / `.badge.checkmark`) y en la
  grilla con el menú de mantener apretado "Agregar a tu perfil" / "Sacar de tu perfil". Al agregar una, sale la pastilla "Destacada en tu perfil" (`showPill`). El autor puede "No dejar que la
  destaquen" (borra las de otros y bloquea nuevas; él siempre puede destacar las suyas). Nunca sale el rollo, el caption ni la
  coordenada: la ubicación va como **zona de ~5 km** (celda de 0.05°). En un perfil, "Fotos | Mapa": la grilla (con la
  insignia del autor si no es el dueño del perfil; tocar una abre `/featured/<userId>/<mediaId>`) y el mapa por zonas.
  **Adónde pueden ir tus fotos** (cuatro niveles, gana el más restrictivo; `featuring-section.tsx`, `use-featuring-levels.ts`, `use-privacy-settings.ts`):
  cuenta (Ajustes: "Permitir que agreguen mis fotos a su perfil", `PATCH /me/settings` `privacy.allowFeaturing`), rollo ("Tus fotos en otros perfiles" en el
  tablero y en el segmento "Rollo", `PATCH /trips/{id}/members/me`), foto ("No dejar que la destaquen") y **rollo privado** (el creador lo elige al crear y lo cambia
  en el tablero con confirmación, `featuringDisabled`: ninguna foto sale, ni la del autor). Apagar un nivel saca las fotos de los perfiles ajenos; prender no devuelve nada. El feed
  trae `canFeature` por foto: sin él (o sin `featuredByMe`) no aparece "Agregar a tu perfil" en el visor ni en el menú de la grilla (`feature-action.ts`).
  **Visibilidad:** `profileVisibility` `"friends"` (por defecto) o `"public"`, con el switch "Perfil público" de Ajustes
  (`PATCH /me`, error inline): apagado, solo tus amigos ven tus destacadas y tu lista de amigos
  (la descripción y la cantidad de amigos son siempre públicas; rollos y fotos solo con `canSee`).
- **Compartir** (`src/features/share/`; botón "Compartir" en la barra del rollo → `/share-story`: modal "Compartir", `kind` = `collage` | `invite`; diseño en `docs/superpowers/specs/2026-11-25-compartir-en-stories-design.md` y, para el fondo animado y los estilos, `docs/superpowers/specs/2026-11-26-stories-video-y-estilos-design.md`): dos piezas. El **collage** de un rollo **revelado** (oculto en un rollo privado y cuando ninguna foto es `shareable`) y la **invitación** antes del revelado, mientras el rollo no está lleno. Se llega por el **botón "Compartir" de la barra del rollo** (en el tablero, en la vista "Rollo" y también en la **Galería** del revelado, junto al "…"; `shareKind` en `share-options.ts` decide si aparece y con qué `kind`), por **"Compartir" al mantener apretado cualquier rollo de la lista** (`rowActions`, `listShareKind`: revelado → `collage`, si no → `invite`; la lista no sabe si está lleno o es privado, así que `/share-story` lo dice con un `Footnote` en vez de armar la imagen) y por el **botón de compartir de la tarjeta del rollo en curso** (círculo blanco translúcido al lado de la cámara, "Invitar a <rollo>", solo con lugar: `canShareInvite`). Todos abren **directo `/share-story`** (sin hoja intermedia). La pantalla ofrece la vista previa, el selector de estilo **Oscuro/Claro** y, según el `kind`: en el **collage**, la tira de fotos con "+" para elegirlas; en la **invitación**, además, **"Copiar link"** (pill secundaria con el SF Symbol `link`, en su propia línea debajo de las demás: copia el link y muestra el HUD nativo de `burnt` "Link copiado"; un error de portapapeles muestra "No se pudo compartir. Probá de nuevo."). Los destinos son **Instagram** (Stories), **WhatsApp** (solo si está instalado, `whatsAppAvailable`; en la **invitación** manda **solo texto**, `whatsAppInviteMessage` ("Sumate a *<rollo>* en Rollo: <link>", el nombre en negrita de WhatsApp) con el link `/join/<CÓDIGO>`, por `whatsapp://send?text=` (`shareTextToWhatsApp`), así WhatsApp arma la vista previa con la imagen dinámica del sitio; en el **collage** manda la imagen a estado o chat por el menú "Abrir en", que muestra **solo WhatsApp** gracias a que el parche guarda el archivo como `.wai` con UTI `net.whatsapp.image`) y **Más opciones** (hoja del sistema); Más opciones copia antes el link de la invitación. Las filas "Compartir en Stories" (del segmento "Rollo" del revelado y de "Invitar") **ya no existen**: se comparte por el botón de la barra; "Invitar" sigue con el código (menú del sistema) y el QR. El texto de invitación (`inviteMessage`) es "Sumate a "<rollo>" en Rollo: <link>" para cualquier rollo. La pantalla del QR sigue teniendo su botón, ahora "Compartir en Instagram", que abre `/share-story` con la invitación. Modelo Spotify: a Instagram le llega un **video de fondo en loop** (`assets/stories/bg-{dark,light}.mp4`, con su frame `bg-{dark,light}.jpg`; se regeneran con `npm run story-backgrounds`, `scripts/build-story-backgrounds.mjs`) y, encima, una **card como sticker PNG transparente** que se dibuja **offscreen con Skia** (`renderCollageCard` / `renderInviteCard`, medidas en `card-layout.ts`; la card es de 920 px de ancho sobre la historia de **1080×1920**). La pantalla "Compartir" tiene un selector **Oscuro/Claro** (`story-style.ts`, `SegmentedControl` nativo; por defecto Oscuro) y una vista previa en movimiento (`story-preview.tsx`, `expo-video`, con el color base del estilo de fallback). Los assets se cargan con `expo-asset` (`asset-uri.ts`). El botón principal de `/share-story` es **"Compartir en Instagram"** (`instagram-button.tsx`, con el logo a la izquierda, 28 pt, `testID="instagram-logo"`; es un componente propio y no una prop de `Button`, como `google-button.tsx`) y usa `react-native-share` con `META_APP_ID` (`src/config.ts`) y "Más opciones" usa `Share.share` con una **imagen fija** de 1080×1920: la card sobre el `.jpg` del estilo (`compose-still.ts`). Los archivos de share se nombran por tipo, estilo y semilla (`use-story-assets.ts`) para que una entrada cacheada nunca apunte a bytes nuevos. El link de la invitación va en el item del pasteboard de Instagram (`linkText` también como `public.utf8-plain-text`) gracias a un parche de `patch-package` sobre react-native-share (`patches/`, se aplica en `postinstall`; **dos hunks**: `InstagramStories.m` para el `linkText` y `WhatsAppShare.m` para el `.wai`; el módulo reemplaza todo el pasteboard, así que un link copiado antes se perdería); "Más opciones" lo copia con `expo-clipboard`. La invitación ya **no reserva un hueco vacío** para el sticker Enlace: la persona lo ubica donde quiera sobre el fondo, y la pantalla muestra la nota del sticker. Qué fotos entran lo decide el server con `shareable`: la regla de destacar **sin la amistad**, nunca videos, fotos archivadas ni fotos de momento. "Compartir en Instagram" se esconde sin App ID o sin Instagram (`LSApplicationQueriesSchemes` en `app.json`, que ahora suma `whatsapp` además de `instagram-stories` e `instagram`: cambio **nativo**, pide rebuild). Los logos de Instagram y WhatsApp están en `assets/share/` (`instagram.png` y `whatsapp.png`, con `@2x` y `@3x`); se regeneran con `npm run share-logos` (`scripts/build-share-logos.mjs`). La query `"story-image"` no se persiste. La app de Meta es "Rollo Project" (ID `1187882687102371`), en modo **Development**: falta probarlo en el iPhone. Sumar `react-native-share` y `expo-clipboard` es nativo (el fondo animado y los estilos no suman dependencias nativas nuevas: `expo-asset` ya venía con `expo`, solo subió de patch, y alcanza con Metro): pide `npx expo prebuild --clean` y rebuild; la versión es **1.5.0** por eso (producción ya estaba en 1.4.0). La plataforma iOS de la app de Meta es el bundle de producción `com.juanifraga.rollo.app`: puede que compartir en Instagram solo ande en el build de producción (el de desarrollo usa `com.juanifraga.rollo`). Probarlo en el iPhone.
- **Recorrido en video** (`src/features/journey/`, y en Compartir `src/features/share/journey-share.tsx`; diseño en `docs/superpowers/specs/2026-11-26-recorrido-en-video-design.md`): tercera pieza de "Compartir". En un rollo **de viaje revelado, no privado**, cuyas fotos compartibles con ubicación dan **al menos 2 paradas** (`filmBlocked`, `filmStopCount`), y solo en un build con el módulo de video (`videoAvailable`), la pantalla suma arriba el control nativo **"Collage | Recorrido"** (abre en Collage; `kind=journey` abre en Recorrido). El recorrido es una película vertical de hasta **59 s**: portada con el nombre y "24 días · 1.858 km", por cada parada el mapa vuela, aparece el pin y se revelan sus fotos (1 a 4, con encuadres sorteados que nunca repiten el de la parada anterior) con "Día N" y la ciudad, cierre con la ruta entera y una **placa final** de 2,5 s (logo, "Rollo Project" y la insignia oficial de la App Store). Cada foto lleva la **foto de perfil de su autor** como sello centrado en el borde de abajo. Sin sonido y sin luz roja. **Ubicación:** fuera del rollo nunca sale una coordenada: cada parada va al centro de su celda de 0,05° (la de las destacadas), un lugar mide al menos 2,5 km de radio, el zoom no pasa de 10 y el título es solo la ciudad (`FILM_CUTS.share` en `route.ts`; `FILM_CUTS.reveal` es el corte para adentro, todavía sin uso). Entran solo fotos `shareable` con GPS (`filmCandidates`), hasta **15**, hasta 4 por parada (las de más "me gusta"); la tira con "+" abre `/share-pick?kind=journey` para elegirlas (`film-selection.ts`, en memoria) y, si las elegidas dejan una sola parada, dice "Con estas fotos no hay recorrido…" sin ofrecer destinos. El arreglo se sortea una vez al abrir Compartir (no hay botón para cambiarlo). **El motor** es propio: la película es una función del tiempo (`engine/scene.ts`: `buildScene` y `frameAt`, puros) que `engine/draw.ts` dibuja con Skia sobre un cuadro fijo de **432×768** puntos; el mapa son imágenes fijas de MapLibre (`StaticMapImageManager`, `engine/assets.ts`) y el crédito "© OpenStreetMap · OpenFreeMap" va dibujado dentro del video. `use-film.ts` arma todo lo de un rollo (estados `loading` / `no-route` / `error` con `offline` / `ready`) y `film-player.tsx` lo reproduce a cualquier tamaño. **Exportar** (`share/film-export.ts` → `journey/frame-source.ts` + `journey/export-film.ts` → módulo local `modules/rollo-video`): al tocar un destino dibuja cada cuadro fuera de pantalla a 1080×1920 y 30 cuadros por segundo, por tandas en el hilo de JS, con "Armando el video… 42 %" y "Cancelar"; mientras exporta la vista previa no dibuja; el archivo (`rollo-video-<tripId>.mp4` en el caché) se reutiliza para los otros destinos mientras no cambie la versión, y cancelar, cambiar las fotos o salir lo borra. Destinos: **Instagram** (`share-video.ts`: va siempre directo al editor de Stories, sin guardar nada; Meta documenta 20 s para esa vía pero en el iPhone un video de 41 s entró entero — `STORIES_DIRECT_MAX_MS` = 59 s; guardar en Fotos y abrir Instagram queda solo como salida para algo más largo), **"Guardar video"** y **"Más opciones"**. En Jest, `jest.setup.ts` mockea `film-player`, `film-export`, `use-film` y `use-sheet-film` (Skia no carga); los tests de la escena y la ruta son puros. **Banner "El video de tu rollo"** (`share/roll-video-banner.tsx`): en la lista de la **Galería** del revelado, entre el resumen y la fila de caras (la pasa `RevealedRollScreen` por la prop `videoBanner`; la galería lo esconde al seleccionar), con la portada del rollo (o la miniatura de la foto con más "me gusta") de fondo, el primer tipo disponible ("Recorrido" o "Resumen") y dos botones: **ver** (`/roll-video?tripId&kind`) y **compartir** (`/share-story` con `journey` / `sheet`). No aparece hasta saber que hay video; qué videos tiene un rollo lo decide **una sola función** (`roll-videos.ts` / `use-roll-videos.ts`, la misma que usa Compartir). **`/roll-video`** (`roll-video-screen.tsx`, `fullScreenModal` negro): reproduce solo el tipo con el que se abrió (`FilmPlayer` ajustado a 9:16 dentro de las áreas seguras, sin cambiar de tipo), con "Cerrar" arriba y "Compartir" (reemplaza por `/share-story`) abajo.
- **Resumen en video (la hoja de contacto)** (`src/features/journey/sheet/`, `use-sheet-film.ts`, `any-film.ts`; diseño en `docs/superpowers/specs/2026-11-26-hoja-de-contacto-video-design.md`): un video para cualquier rollo revelado, y el único para los rollos **sin recorrido** (eventos, rollos en una ciudad, fotos sin ubicación). En Compartir el control muestra "Collage | Recorrido | Resumen", cada video solo cuando el rollo da para él, así que el usuario elige cuando existen los dos (`kind=journey` abre Recorrido y `kind=sheet` abre Resumen; sin recorrido, `journey` también abre Resumen). **"Resumen"** se ofrece cuando el rollo está revelado, no es privado y tiene al menos **6** fotos compartibles (`sheetBlocked`, `SHEET_MIN`; no hace falta ubicación y vale para eventos). La película: portada con la hoja en gris, el nombre y la fecha → los cuadros se revelan en orden de hora → la cámara se acerca a cada **destacada** con su hora ("23:40", o "Día 2 · 23:40" si abarca varios días; hora de cada foto en la zona del rollo, `sheet/local-time.ts`) y el sello del autor → la hoja entera con "214 fotos · 86 personas" → la misma placa final. Hasta **30** fotos en la hoja y **12** destacadas (`sheet-photos.ts`: `sheetCandidates`, `sheetStates`, `sheetPick`). **Nada sale de los votos** (se puede generar con el concurso abierto): los "me gusta" solo eligen la selección inicial y todo se muestra en orden de hora, con el mismo tiempo y tamaño para cada destacada. **Elegir** (`/share-pick?kind=sheet`, `SheetPickScreen`): arranca llena y un toque rota cada foto entre **en la hoja → destacada → fuera** ("Foto en la hoja" / "Foto destacada" / "Foto fuera del video"; la que quedó fuera no aparece ni en miniatura y no vuelve sola; si quedan lugares entran fotos que no tocaste); al primer toque las destacadas automáticas pasan a ser elecciones a mano, así un toque cambia solo esa foto. Contador "8 destacadas · 22 en la hoja"; "Listo" guarda (`sheet-selection.ts`, en memoria). Con menos de 6 en la hoja, Compartir dice "Faltan fotos para el resumen: dejá al menos 6 en la hoja." y deja el "+". El reproductor, la exportación y los destinos son los del recorrido: `AnyFilm` (`kind: "route" | "sheet"`) y `drawAnyFilm`; `FilmShare` en `journey-share.tsx` tiene una variante por tipo. No usa MapLibre ni geocodificación.
- **Insignias** (`src/features/profile/badge.ts`): `badge` (`"founder"` | `"first_edition"` | null) viene del server en el usuario (`GET /me`, `GET /users/{id}`) y se asigna a mano en el backend. Se muestra solo en el encabezado del perfil (`ProfileHeader`, el tuyo y el de otros) al lado del @ (centrado en la misma fila, `profile-handle-row`), con `Badge` neutral y las etiquetas en inglés **FOUNDER** / **FIRST EDITION**; valores desconocidos no muestran nada. No va en listas, Feed ni mapa.
- **Límites para crear rollos** (los aplica el server en `POST /trips`, **409** con el mensaje): máximo 2 rollos sin revelar creados por vos a la vez y 4 creados en los últimos 30 días; los rollos a los que te sumaste no cuentan y hay usuarios exentos (flag a mano en la DB). La app no chequea nada antes: `create-screen.tsx` muestra el mensaje del server debajo del botón (`ErrorText`, como cualquier error del form) sin perder lo cargado.
- **Roles, archivar y eliminar rollos** (`src/features/trips/roles.ts`, `row-actions.ts`, `use-archive-trip.ts`; `src/features/roll/roll-essentials.tsx y `roll-settings-screen.tsx``): el rol de la API sigue siendo `admin` | `member`; el **creador** es el miembro con `isCreator` (también en `TripSummary`; el trip trae `createdBy`) y se muestra como "Creador", los demás admins como "Admin" (`memberBadge`). Mantener apretado un miembro (`MenuView` + acciones de VoiceOver, `memberActions`) ofrece "Hacer admin" / "Quitar admin" / "Sacar del rollo" (con `Alert`; hooks `use-make-admin`, `use-remove-admin`, `use-remove-member`). Cualquier admin cambia el nombre del rollo con la fila "Nombre" (`Alert.prompt` "Nombre del rollo", `use-rename-trip`; más de 60 caracteres: `ErrorText`). **Archivar** es por miembro y solo de rollos revelados: menú de mantener apretado en la lista de Rollos y fila "Archivar rollo" / "Desarchivar rollo" en el rollo revelado (`useArchiveTrip`, optimista; si falla, `Burnt.alert` "No se pudo archivar" / "No se pudo desarchivar"). **Eliminar** (menú de la fila, no lo ve el creador) es salirse: `useLeaveTrip(tripId, name, { revealed, copy: "list" | "board" })`; en un rollo revelado avisa "…No vas a poder volver a entrar." (a un revelado no se entra de nuevo con el código) y en uno sin revelar "…Podés volver con el código."; si falla desde la lista, `Burnt.alert`. **"Borrar rollo"** (solo el creador, fila roja con `Alert` "¿Borrar "{rollo}" para todos?", `useDeleteTrip`, `DELETE /trips/{id}`) lo borra para todos; un 403 del server dice "Solo quien creó el rollo puede hacer esto".
  **Muchos integrantes** (`members-order.ts`, `member-row.tsx`, `use-member-actions.ts`, `members-screen.tsx`, ruta `app/roll-members.tsx` → `/roll-members?tripId=…`, push en el stack raíz, título "Integrantes"): "En el rollo · N" muestra solo los primeros **10** (`previewMembers`: creador, después los demás admins, después vos, después el resto en el orden del server) y, si hay más, la fila "Ver todos" con el total (`value`) que abre la pantalla con todos, en el mismo orden y con la misma fila (`MemberRow`: badge, perfil, mantener apretado y acciones de VoiceOver). Búsqueda nativa del header (`useSearchBar`) por nombre o @usuario, sin tildes ni mayúsculas (`filterMembers`, contiene); sin coincidencias: "No hay integrantes con ese nombre.". Comparte el caché del detalle (`useTripDetail`), así los cambios de rol se ven también en el tablero.
- **Editar rollo** (`/edit-trip?tripId=…`: `app/edit-trip.tsx` → `src/features/trips/edit-screen.tsx`; el formulario es el mismo de Crear, `trip-form.tsx`; la lógica pura vive en `edit-form.ts`: `editableFields`, `changedFields`, `lockedNote`; `use-update-trip.ts` hace `PATCH /trips/{id}`): fila "Editar rollo" en el tablero (`roll-people.tsx`), solo para admins y mientras el rollo no terminó. **Cualquier admin** cambia fechas, cupo y momento: antes del inicio, todo; en curso, no el inicio ni el tipo de cupo (nota `lockedNote`); terminado o revelado, solo el nombre (fila "Nombre"). **Solo el creador**: rollo privado, quitar admin, sacar a otro admin, borrar el rollo y **adelantar el revelado** (el server contesta "Solo quien creó el rollo puede adelantar el revelado"). Solo se manda lo que cambió; con el revelado en "Al terminar" sigue al fin. Si cambian fechas o momento, el hook corre `syncMoments()`. Los topes (30 / 200 / 31 días) los pone el server.
- **Varios rollos por persona**, se puede volver a ver uno viejo. El **rollo activo** es el último que
  abriste; se cambia abriendo otro desde la tab Rollos (la lista de tus rollos; no hay selector en el header ni sheet `/trips`). Las fechas del rollo van con
  **inicio y fin** (no "cantidad de días").
- **Momento del día (modo viaje, estilo BeReal)** (`src/features/moments/`): un aviso por día a una hora random distinta para cada uno, dentro de una
  franja (9:00–23:00 por defecto, configurable al crear el rollo con "Apagado" / "Solo foto" / "Dos cámaras"). Si un admin cambia el modo o la franja con el rollo en curso, **rige desde mañana** (`trips.moment_from_day` en el server): el de hoy conserva su hora y su modo (`trip_moments.mode`) y `GET /me/moments` trae el `mode` de cada momento, del que sale el param `selfie` (`plan.ts`); el banner de Rollo reenvía el `selfie` del aviso entregado (`currentMoment`), así la cámara respeta el modo de hoy aunque el rollo ya tenga otro. **Alargar el fin no vuelve a sortear nada**: el server solo borra los momentos sin sacar posteriores al nuevo último día (con inicio, modo o franja nuevos se sortea todo desde mañana); el formulario avisa "Los cambios valen desde mañana." en un rollo en curso. Caso borde conocido: quien estaba sin señal y ya tenía programado el aviso de mañana antes de la edición puede ver "No tenés un momento ese día" al subir esa foto. Hay **15 minutos** para sacar una foto extra, **aparte del
  cupo**; pasado ese tiempo se pierde ("Se pasó tu momento de hoy"; el último día del rollo dice "Era el último del rollo."); la imagen vinculada pendiente no cuenta aparte en las subidas. Son **notificaciones locales**: `syncMoments()` baja en una sola llamada `GET /me/moments` (el server decide qué rollos: miembro activo, momento prendido, desde 3 días antes del
  inicio hasta el fin, nunca uno revelado; si un rollo deja de venir, se cancelan sus avisos; si la llamada falla, no se toca nada) y programa hasta 40 con identificador `moment.<tripId>.<day>` (título "Es tu momento", `data.url` `/moment?trip=…&day=…&at=…&selfie=0|1`, con `momentMode` de `GET /me/trips`);
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
  **El revelado** es una pantalla propia (`/reveal`, `src/features/reveal/`, fullScreenModal; el efecto de revelado (`DevelopImage`), los shaders, el obturador y la descarga de miniaturas (`useThumbBytes`) son compartidos y viven en `src/features/darkroom/`; también los usa el revelado de la ganadora del concurso): se abre sola **una vez por
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
  Tenés N fotos hoy." y botones "Sacar la primera" (abre la cámara) y "Ahora no". En la lista de Rollos el rollo en curso es una tarjeta grande con su badge LIVE.
  La lista de Rollos se agrupa con `groupTrips` (`src/features/trips/group-trips.ts`, que también devuelve `live`, el rollo en curso que va en la tarjeta): en curso, próximos y sin revelar arriba; "Revelados" (últimos 3 meses por fecha de revelado); "Anteriores · N" colapsado (se abre solo si el rollo activo está ahí, sin recordar nada) y, al final, **"Archivados · N"** (`archived`, `archivedExpandedByDefault`: colapsado salvo que el rollo activo esté ahí; los archivados no entran en los otros grupos).
- **Notificaciones push** (`src/features/notifications/`): las manda el backend con Expo Push Service. El token se registra con
  `PUT /me/push-tokens/{token}` atado a la sesión **solo si cambió el token o la sesión** desde el último registro exitoso (`rollo.pushTokenRegistered` en SecureStore: token + hash SHA-256 de la sesión, `src/storage/push-registered.ts`; no se renombra) y se borra al cerrar sesión y cuando un `401` la cierra (así un celular que cambia de
  cuenta no recibe avisos de la anterior). **Permiso con explicación propia** (`/push-primer`, `push-primer.tsx`): se ofrece una sola vez,
  después de crear o unirse a un rollo (`offerPushAfterJoining`; clave nueva `rollo.pushPrimerSeen`, no se renombra); si ya había permiso
  el token se registra en silencio, y si lo negó no pasa nada (queda el aviso en Ajustes). **Tocar una push** abre `data.url` (ruta de la
  app, nunca otro host) y, si trae `trip`/`tripId`, ese rollo pasa a ser el activo (`notification-target.ts`, `use-notification-response.ts`);
  `/roll` y `/reveal` abren el rollo sobre la lista (un revelado sin ver se reproduce desde ahí). **Siete avisos:** te sumaron a un rollo, nuevo amigo,
  arrancó el rollo, se reveló, destacaron tu foto, le gustó tu foto y comentaron tu foto. Nunca por acciones propias ni de usuarios bloqueados. Se **sacó el aviso
  local del revelado**: al abrir la app se cancelan los `reveal.*` que dejaron versiones viejas (`legacy-reveal.ts`).
  **Ajustes → Notificaciones** (`settings-screen.tsx`, `GET/PATCH /me/settings`): un switch por aviso (`addedToTrip`, `newFriend`, `tripStarted`,
  `tripRevealed`, `photoFeatured`, `photoLiked`, `photoCommented`, `friendRequest`, `dailyMoment`, `momentPosted` y `originalsExpiring`, "Fotos por borrarse", en el grupo Rollos: aviso unos días antes de que se borren las fotos en máxima calidad; abre `/roll?trip=<id>`) y, si el permiso del sistema está apagado, un banner que lleva a Ajustes del iPhone.
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
  abre `/me/activity` (lista agrupada con tres filas y su cantidad, el `total` del server: "Me gusta", "Comentarios" y "Destacaron tus fotos"). "Me gusta" (`/me/likes`) es una grilla con
  las fotos que te gustaron, de la más reciente a la más vieja (`GET /me/likes`, paginado con cursor; **lo que hoy podés ver lo filtra el server**,
  nunca la app), con la insignia del autor si no sos vos; tocar una abre el visor de la galería si `source.kind` es `trip` o el de destacadas
  si es `featured` (`likes-target.ts`). Dar o sacar un me gusta (`use-toggle-like.ts`) invalida la query `["my-likes"]`. Vacío: "Todavía no te gustó
  ninguna foto."; error con "Reintentar". **"Comentarios"** (`/me/comments`, `GET /me/comments`, paginado con cursor, filtrado por el server): lista plana, miniatura a la izquierda, tu texto (hasta 2 renglones) y
  "hace 5 min" (`formatAgo`) debajo; tocar abre `/photo/<mediaId>?tripId=…&comments=1` (`activity-targets.ts`); vacío "Todavía no comentaste ninguna foto."; mandar o borrar un comentario invalida `["my-comments"]`.
  **"Destacaron tus fotos"** (`/me/featured-by`, `GET /me/featured-by`): avatar, "Cami destacó tu foto", "hace 2 h" y la miniatura de tu foto a la derecha; tocar abre `/featured/<userId>/<mediaId>`; solo salen
  perfiles que hoy podés ver (si es privado y no son amigos, no); vacío "Nadie destacó tus fotos todavía."; lo invalida todo lo que saca tus fotos de otros perfiles (`["featured-by"]`: "No dejar que la destaquen", Ajustes
  "Permitir que agreguen mis fotos…", el ajuste del rollo, rollo privado, archivar, eliminar, "Borrar amigo" y bloquear). Las filas comparten `ActivityRow` / `ActivityThumb`.
- **Comentarios** (`src/features/comments/`): solo en fotos reveladas (no videos, no en las destacadas de un perfil: mostrarían nombres y charla del
  rollo a gente de afuera) y solo entre miembros activos del rollo. En el visor de la galería, la burbuja `bubble.left` (con la cantidad,
  `commentCount` del feed) abre la sheet `/comments/<mediaId>` (`comments-screen.tsx`): lista (avatar, nombre, texto, "hace 5 min") y campo abajo
  (texto plano, hasta 500, `draft.ts`). **Borrar es deslizando la fila de derecha a izquierda** (`ReanimatedSwipeable`, botón rojo con tacho de 80 pt que borra al tocarlo; abrir una cierra la otra; acción de VoiceOver "Borrar") y solo en filas con `canDelete`, que decide el server: borrás lo tuyo; el dueño de la foto y cualquier admin del rollo, cualquiera. El "…" de cada fila ofrece solo
  "Denunciar" (ajeno; `useReport().reportComment`, mail a soporte como el resto de la moderación; en una fila tuya no hay "…"). Error al enviar: inline y no pierde lo escrito.
  El aviso `photoCommented` ("Cami comentó tu foto", "Cami también comentó una foto") abre `/photo/<id>?tripId=…&comments=1`: el visor abre la sheet
  una vez (`openComments`). Ajustes → Notificaciones: switch "Comentan tu foto".
- **A futuro (no para enero):** feeds públicos de rollos.

## Navegación y diseño

- **Botones "i" de ayuda** (`src/features/info/`): un `info.circle` chico junto a un encabezado o una fila abre una hoja (`/info/<topic>`, `formSheet` con `fitToContents`)
  con título y 2–4 frases. Los textos viven todos en `topics.ts` (`INFO_TOPICS`, tipado por id); la ruta `app/info/[topic].tsx` solo los muestra. `InfoButton` es para pantallas RN
  (`accessory` de `Row`, `labelAccessory` de `SwitchRow`, `titleAccessory` de `Section`) y `NativeInfoButton` para el Form de SwiftUI de Crear rollo. Viven en la feature y no en `ui/`
  porque conocen el catálogo y navegan. Hoy: Crear rollo (fechas, revelado, cupo, momento, franja, rollo privado), Ajustes (perfil público, fotos en otros perfiles, mapa sin señal) y
  "Invitar" del tablero. Un tema nuevo = una entrada en `topics.ts` + su test en `__tests__/info.test.tsx`.

- **Barra de abajo nativa** (`NativeTabs` de `expo-router/native-tabs`, liquid glass en iOS 26), **solo
  íconos SF Symbols**: Rollos · Mapa · **Cámara** (centro) · Amigos · Perfil. La cámara es un trigger
  `disabled` cuyo `tabPress` abre `/capture` encima. El ícono de Rollos es fijo (`film.stack`, `src/features/trips/tabs.ts`) en todas las
  fases: no hay ícono de Galería. Después del revelado el centro pasa a ser Presentación (solo historias).
- **Rollos = la lista y la primera pantalla** (`app/(tabs)/roll/index.tsx` → `src/features/trips/rolls-screen.tsx`; `app/(tabs)/roll/[tripId].tsx` es el
  rollo): tarjeta del rollo en curso (`live-roll-card.tsx`: portada borrosa, día, nombre, "Te quedan N fotos hoy" y un botón de cámara de ese rollo),
  grupos de `groupTrips` (filas con miniatura, `trip-row.tsx`), menú "+" ("Nuevo rollo" / "Sumate con un código"), error con "Reintentar" cuando la lista no carga (sin datos;
  sin red no es "no tenés rollos") y la bienvenida (`roll/welcome.tsx`) si no hay ninguno. Tocar un rollo hace push de `/roll/[tripId]`
  (`rollHref`, `roll-href.ts`), que deja ese rollo como activo al montar. Mapa y Feed llevan de título el nombre del rollo activo. **No hay
  `TripSwitcher` ni ruta `/trips`**: avisos, links, crear y unirse abren el rollo encima de la lista (`notification-target.ts`).
- Mapa = mapa + Feed: control "Mapa | Feed" arriba (param `view`), el mapa queda montado al pasar al Feed y tocar una fila
  vuelve al Mapa enfocando ese pin. El segmento Feed existe solo antes del revelado. "Solo hoy" va en el menú de filtros.
  La lógica vive en `src/features/map/roll-map.tsx`, `src/features/map/activity-screen.tsx` y `src/features/feed/feed-list.tsx`.
- El rollo (`/roll/[tripId]`) = tablero (portada grande y descripción si las tiene, hoja de contacto, cupo de hoy, fechas, estado de subidas, "Invitar" con código, QR y compartir,
  miembros con sus roles, "Nombre" (solo para admins) y "Creado por {nombre}" en el pie de Fechas): muestra el rollo de la ruta (`/roll/[tripId]`, el que se tocó en la lista de Rollos o el rollo en vivo). Revelado, esa pantalla es **"Galería | Rollo"** (el control nativo es el título de la barra, centrado, de 168 pt fijos (`roll-view-switch.tsx`), entre el botón de volver y los de compartir y "…"; param `view`:
  `gallery` por defecto o `roll`, como "Mapa | Feed"; `title` sigue siendo el nombre del rollo para el botón de volver y VoiceOver; al seleccionar fotos la barra muestra solo el conteo al centro y una X redonda (`xmark`, "Cancelar") a la derecha, sin botón a la izquierda, y "Seleccionar todo" / "Deseleccionar todo" pasa al renglón del resumen, donde estaba "Seleccionar"; la galería queda montada y su toolbar solo se ve en Galería). En los dos segmentos, arriba del contenido, va el **nombre del rollo en grande** (`roll-title.tsx`, `type.largeTitle`, hasta 2 renglones, `header`); en Galería, debajo, el resumen a la izquierda y "Seleccionar" (texto en `colors.tint`, 44 pt, `gallery-heading.tsx`) a la derecha, todo parte del encabezado de la lista (se va con el scroll) El
  segmento Rollo es una lista agrupada con el resumen ("64 fotos · 3 videos · 8 personas · 6 días"), Fechas (el mismo
  `RollDates` del tablero), subidas y miembros/invitar, sin "Hoy" ni hoja de contacto (`src/features/roll/revealed-roll-screen.tsx`,
  `roll-overview.tsx`). La actividad
  ("Cami sacó una foto · 14:32", con la hora de captura) vive solo en el Feed (dentro de Mapa).
- **Galería Diario** (spec `docs/superpowers/specs/2026-11-24-galeria-diario-y-rollos-design.md`; `src/features/gallery/`): la grilla es un diario con
  **capítulos** (`chapters.ts`, `buildChapters`): en un viaje uno por día con el kicker "DÍA N" (`dayNumber`, contado desde el inicio del rollo); en un
  evento uno por grupo (la foto va al primer grupo según el orden del evento; el kicker "GRUPO" solo si se muestra el título del grupo) y, si un grupo
  pasa de 40 fotos (`SPLIT_THRESHOLD`), se parte en **bloques de 2 horas** ("De 20 a 22 h", con el día si el evento dura varios) en la zona del
  evento; las que no caen en ningún grupo van al final en "Otras fotos". **Foto grande** (`hero-cell.tsx`, `pickHero` en `chapter-picks.ts`): solo
  en capítulos de 4 fotos o más, la foto (no video, no archivada) con más "me gusta". **Citas** (`quote-row.tsx`, `pickQuotes`): hasta 2 fotos con texto por capítulo, las de más "me gusta" (empate: la más temprana; la foto grande nunca es cita); la foto citada sale de la grilla y tiene un renglón propio: la foto de un lado, del tamaño de una celda normal (la misma `Cell`), y al otro el texto en serif itálica (hasta 4 renglones) con "Fede · 09:59" debajo, centrado; los renglones de cita alternan el lado en toda la lista (`side`: el primero con la foto a la izquierda, el siguiente a la derecha, y así; un capítulo sin citas no gasta turno), con el texto siempre alineado a la izquierda y la foto primero para VoiceOver; tocar el texto abre la foto (o la selecciona al seleccionar). Va en el lugar natural de la foto en el orden del capítulo, ajustado a un límite de fila: las fotos de antes completan sus filas con las que siguen (solo la última fila puede quedar incompleta); dos citas nunca van pegadas (si lo estarían, la segunda vuelve a la grilla). `grid-items.ts` (`diaryItems`) arma todo
  como una lista plana para FlashList. **Lugar** de cada capítulo (`place.ts`, `use-chapter-place.ts`, `chapter-header.tsx`): mediana de las
  coordenadas de **todas** las fotos cargadas del día (sin filtrar, así elegir una cara no vuelve a geocodificar), redondeada a ~1 km (`placeKey`) y geocodificada con `expo-location` (el geocodificador de iOS); se guarda en el caché
  de TanStack Query **7 días** y se comparte entre capítulos cercanos; sin GPS o sin nombre no se muestra nada. **Caras** (`people-row.tsx`,
  `people-order.ts`): una fila de avatares arriba reemplaza al "Filtrar por persona" de la toolbar (miembros en el orden del rollo y después
  autores que ya no están; elegida = aro cobalto; tocar de nuevo la cara elegida vuelve a "Todos"). Los **eventos no llevan línea de lugar** (`placeable: false`: solo los capítulos de un viaje la tienen). **Resumen** arriba con el formato de `rollSummary`
  ("64 fotos · 3 videos · 8 personas · 6 días"); mientras cargan las páginas usa `totalUploaded` del server para que no vaya creciendo.
- Perfil = lo que ven los demás, **sin título visible en la barra** (solo los botones de actividad y ajustes; `title: "Perfil"` queda para el botón de volver y VoiceOver; pantalla en `src/features/profile/me-screen.tsx`): encabezado **centrado** (`profile-header.tsx`; sin card, sobre el fondo: foto de 96 pt arriba; abajo, centrados, nombre (`type.title`, hasta 3 renglones), @usuario con la insignia, descripción (serif del sistema), la línea de números "8 rollos · 34 fotos · 12 amigos" (un solo botón si tiene amigos, ver "Perfil de cualquier usuario") y, en el de otro, "N amigos en común" aparte; un solo margen de 16 pt, el de `Screen`, igual que el control "Fotos | Mapa" y el título grande, con la grilla de punta a punta) y "Fotos | Mapa" (tus destacadas y sus
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
  - **Sí:** la tab activa, los botones `primary`, los links y acciones de texto ("Reintentar"), el aro de la cara elegida en
    la fila de caras de la Galería, el botón de cámara de la tarjeta del rollo en curso, en el Mapa el filtro elegido / el punto de ubicación / el halo
    del pin seleccionado, y "Mandar al rollo".
  - **No:** fondos, textos, cards, contadores, íconos inactivos, `memberColor` ni el badge rojo de la cámara.
  - MapLibre no acepta colores dinámicos: ahí se usa `tintHex[scheme]` según `useColorScheme`.
  - El ícono (claro / oscuro / tinted) y el splash salen de `scripts/build-icons.mjs`: `npm run icons`
    regenera los PNG de `assets/`. Son nativos: cambiarlos pide `npx expo prebuild --clean` + rebuild.
    El ícono de iOS es un bundle de Icon Composer (Liquid Glass) `assets/app.icon` (`ios.icon` en `app.json`; lo genera el mismo script: `icon.json` + un SVG por
    círculo, grande → chico de atrás para adelante, con fondo y colores/opacidades propios para oscuro). En iOS 26 se ve como vidrio; en versiones anteriores Xcode compila
    los PNG de respaldo desde el `.icon`. Los PNG de `assets/` quedan para Android, splash y respaldo. Cambiarlo es nativo: `npx expo prebuild --clean` + rebuild.
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
  la app y respeta el modo silencio) y el **módulo local de Expo en Swift `modules/rollo-symbol`** (SF Symbols animados), más el módulo local **`modules/rollo-video`** (Swift: escribe cuadros a un mp4 H.264 con `VideoWriter` y le pasa un video a Instagram Stories o Reels; wrapper `index.ts`, sin él `videoAvailable` es `false`; su escritor se chequea con `npm run check:video-writer`). Agregarlos o cambiarlos
  pide `npx expo prebuild --clean` + `npx expo run:ios --device`; si no, el dev build viejo no los tiene.
- **Gesture Handler** (`react-native-gesture-handler`, `ReanimatedSwipeable` para borrar comentarios deslizando) es nativo: agregarlo pide `npx expo prebuild --clean` + `npx expo run:ios --device`.
- **VisionCamera** (`react-native-vision-camera` v5 + sus dependencias `react-native-nitro-modules` y `react-native-nitro-image`; cámara de la captura y del
  momento del día, reemplazó a `expo-camera`) es nativo: agregarlo o cambiarlo pide `npx expo prebuild --clean` + `npx expo run:ios --device`.
- `expo-notifications` es nativo: agregarlo pidió `npx expo prebuild --clean` + rebuild.
- Claves de SecureStore del revelado (no se renombran): `rollo.presentation-seen.<tripId>` (se abrió solo el revelado),
  `rollo.revealIntroSeen.<tripId>` (se vio) y `rollo.rollStartedSeen.<tripId>` ("Arrancó el rollo" visto).
- Claves de SecureStore de eventos (no se renombran): `rollo.pendingJoin` (código del link de evento pendiente, 24 h), `rollo.lastGroups.<tripId>` (últimos grupos elegidos al sacar fotos) y `rollo.contestWinnerSeen.<tripId>` (se vio el revelado de la ganadora del concurso).
- Clave de SecureStore de la cuenta (no se renombra): `rollo.sessionUserId` (id del usuario con sesión; la cola offline la usa para saber de quién es cada foto).
- Clave de SecureStore de la cámara (no se renombra): `rollo.cameraGrid` (`"1"`/`"0"`, cuadrícula prendida; ajuste del celular).
- `ios/` es generado (`npx expo prebuild`) y está en `.gitignore`. La config nativa va en `app.json`; `app.config.ts` solo cambia nombre y
  bundle id según `APP_VARIANT` (ver Apple).

## Estructura del código

```
app/                    Solo rutas (Expo Router). Pantallas finas: arman hooks y componentes de features.
  (tabs)/               NativeTabs: roll (lista de rollos + roll/[tripId]), map (+ Feed), camera (abre /capture o /presentation), friends, me; cada una con su Stack
  photo/[id].tsx        visor de una foto revelada; presentation.tsx, capture.tsx, create.tsx, join.tsx, settings.tsx...
  friends/[code].tsx    link de amistad (fuera del grupo protegido; el perfil de un amigo es (tabs)/friends/user/[id])
  reveal.tsx, roll-started.tsx  el revelado y "Arrancó el rollo" (fullScreenModal; fino, usan `src/features/reveal` y `capture`)
  roll-video.tsx        el video del rollo a pantalla completa (fullScreenModal; fino, usa `src/features/share/roll-video-screen`)
  user/[id].tsx         perfil de cualquier usuario desde fuera de Amigos (miembros, autor de una foto)
  featured/[userId]/[mediaId].tsx  visor de una foto destacada de un perfil
src/
  features/<dominio>/   Todo lo de un dominio, junto:
                          actions.ts      llamadas a la API (es lo que mockean los tests de pantalla)
                          use-*.ts        hooks (datos con TanStack Query, estado)
                          *.ts            lógica pura, testeable sin React
                          *.tsx           componentes propios del dominio
                          __tests__/      tests de esa lógica, al lado del código
                        Dominios: events (modo evento: unirse por link/QR, grupos, QR, portada, chips de captura), info (botones "i" con explicación), camera (la cámara propia compartida: disparador, flash, zoom, dar vuelta; la usan capture y moments), moments (momento del día: planificador de avisos locales, cuenta regresiva y dos cámaras, banner en Rollo), auth (sesión, login, gate), friends (amigos, link de amistad, perfil de un usuario, sumar a un rollo, salirse), profile (nombre, foto, `Avatar`, `useOpenProfile`, visibilidad), featured (destacadas: grilla, mapa por zonas, visor), share (compartir: pantalla que abre el botón de la barra, collage del rollo revelado, invitación para Instagram Stories y el recorrido en video), journey (el recorrido en video: ruta, escena, dibujo con Skia, reproductor y exportación), trips (el rollo: lista desde el server, rollo activo, detalle, etapas), capture (cámara, cola
                        offline, subida), feed, map, media (fotos reveladas + fuente con token), gallery
                        (grilla, visor, descargas), exif (metadatos de las fotos), presentation, reveal, notifications (push, permiso, Ajustes → Notificaciones), likes (me gusta), roll (tablero), moderation (denunciar y bloquear: menú en Feed, visores y perfil de otro, Ajustes → Bloqueados; los errores van con `burnt`).
  ui/                   theme.ts (tokens) + componentes base compartidos: Screen, Section, Row, SwitchRow, Button,
                        Field, Body, Footnote, ErrorText, Loading
  api/                  cliente generado del contrato (schema.d.ts NO se edita a mano) + client.ts
  storage/              lo que se guarda en el celular (SecureStore). Sus claves NO se renombran
  test/                 helpers de tests: rutas de la app (routes.ts) y SQLite en memoria
__tests__/              tests de pantallas con navegación real (renderRouter)
modules/rollo-symbol/   Módulo local de Expo (Swift): vista nativa de SF Symbols con transición magic replace; wrapper JS con fallback
modules/rollo-video/    Módulo local de Expo (Swift): escribe cuadros a mp4 y manda un video a Instagram; wrapper JS (`videoAvailable`); tocarlo pide `npx expo prebuild --clean` + rebuild
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

## Performance y componentes

Reglas para todo código nuevo (salen de auditar la app con `vercel-react-native-skills`, `vercel-composition-patterns` y
`building-react-native-apps:react-native-best-practices` de Callstack; las dos de Vercel están en `.claude/skills/`, la de
Callstack es un plugin a nivel usuario). Al diseñar o revisar algo con listas, animaciones, arranque o la API de un componente,
consultarlas. Si una regla de esas skills contradice este archivo (p. ej. Galeria para el visor, que acá es propio), gana este archivo.

- **Listas:** una lista que puede pasar de ~50 filas (galería, feed, miembros de un evento, amigos) va con **FlashList v2**
  (`@shopify/flash-list`, solo JS; sin `estimatedItemSize`, que en v2 no existe): nunca `.map` dentro de un `ScrollView`. Filas en
  su propio componente con `memo`, `renderItem` y `keyExtractor` estables (`useCallback` o a nivel módulo) y `extraData` memoizado.
  Grillas con encabezados: lista plana + `getItemType` + `overrideItemLayout` (ver `gallery/grid-items.ts`). Imágenes con
  `expo-image` y `recyclingKey`. Para listas cortas y acotadas (≤ 30, p. ej. grupos de un evento) alcanza `Section`.
- **Fechas:** siempre `dateFormatter(locale, options)` de `src/lib/intl.ts` (cachea el formatter). Nunca `new Intl.DateTimeFormat`
  ni `toLocaleDateString/TimeString` en render, por fila o dentro de un loop: en Hermes crearlo es caro.
- **Render:** nada de `{string && <X />}` (con `""` React Native se cae: "Text strings must be rendered within a <Text>");
  usar `!!x &&` o un ternario con `null`.
- **Arranque:** `app/_layout.tsx` y `app/(tabs)/_layout.tsx` (y todo lo que importan) se evalúan al abrir la app, porque Metro no
  tiene `inlineRequires`. No importar ahí pantallas ni constantes de features pesadas (Skia, VisionCamera, revelado, recorte,
  presentación): los tokens van en `src/ui/theme.ts` (p. ej. `screenBackgrounds`). Las rutas de Expo Router se cargan solas
  cuando se navega a ellas.
- **Inputs:** el estado de un `TextInput` vive en un componente propio (como `CommentComposer`), no en el que tiene la lista: si
  no, cada tecla re-renderiza todas las filas. Filtros sobre listas grandes con `useDeferredValue` + `useMemo`; búsquedas a la API
  con debounce (como `useUserSearch`).
- **Cache persistido:** al sumar una query, decidir si se persiste. `shouldDehydrateQuery` (`src/api/query-client.ts`) excluye lo
  descartable o derivado de datos locales (búsquedas, la cola de SQLite); lo que la app muestra sin señal (feed, rollos, `me`)
  se persiste. Ojo con guardar dos copias del mismo dato grande con keys distintas.
- **Trabajo en el hilo de JS:** nada de `O(n²)` sobre el feed (puede tener ~2000 fotos: Map/Set y `push`, no copiar arrays por
  ítem); cálculos sobre listas grandes con `useMemo`. Nada de leer archivos enteros en base64 en JS si alcanza con una parte.
- **Animaciones:** solo `transform` y `opacity` en el UI thread (ver "Skills de diseño y motion").
- **Memoización:** no hay React Compiler. `memo`/`useCallback`/`useMemo` donde evitan trabajo real (filas de listas, props de
  componentes pesados); no por las dudas. Para optimizar algo que no es obvio, **medir antes y después** (React DevTools →
  Profiler, tecla `j` en Metro).
- **Composición:** antes de sumar una prop booleana a un componente (`isCompact`, `showX`, `withY`), preferir variantes
  explícitas (`<ThingCompact />`) o componentes compuestos (`<Thing.Header />`, `<Thing.Body />`) con el estado en un provider;
  `children` antes que props `renderX`. React 19: sin `forwardRef` (el `ref` es una prop) y `use()` en vez de `useContext()`.

## Skills de diseño y motion

En `.claude/skills/` (copiadas tal cual de sus repos): `emil-design-eng`, `animate-expo`, `review-animations`,
`find-animation-opportunities`, `improve-animations`, `break-ui` (Emil Kowalski) y `text-to-lottie` (Diffusion Studio). Se sacaron por duplicadas: `animate`
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
  Gesture Handler ya es dependencia (la app va envuelta en `GestureHandlerRootView`; en Jest, `jestSetup` y un mock de `ReanimatedSwipeable` en `src/test/reanimated.ts`).
- Para **implementar** usar `animate-expo` (la versión web, `animate`, se sacó por duplicada); `review-animations` sirve por el criterio.
- **`improve-animations`** (auditoría de todo el motion + planes para que los ejecuten modelos más baratos, encaja con "Opus planea, Sonnet
  ejecuta"): los planes van a **`docs/animation-plans/`** (no a un `plans/` en la raíz). Su modo `execute` revisa con `review-animations`, que solo
  invoca el usuario: la revisión la hace Opus (o `emil-design-eng`).
- **`break-ui`** (datos del peor caso realista contra un componente): el selector "Demo / Peor caso" de la skill es web; acá es una **pantalla de
  Desarrollo** (solo `__DEV__`, entrada en Ajustes → Desarrollo) que monta el componente con cada fixture. Los arreglos de CSS se traducen a RN
  (`flexShrink: 0`, `minWidth: 0`, `numberOfLines` + `ellipsizeMode`, `fontVariant: ["tabular-nums"]`, plurales sin "1 amigos"); en vez de zoom al 200 %
  y RTL se mira con **texto grande de iOS** (Dynamic Type) y en **modo oscuro**. Los límites salen de `src/api/schema.d.ts` y del backend.
- **Lottie:** `text-to-lottie` arma un player web de preview (`npx degit diffusionstudio/lottie`): va **fuera del repo** (scratchpad),
  nunca dentro de `mobile/`. Los JSON van a `assets/lottie/` (los del sitio viven en rollo-app/web) y salen de
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
  - **Correr tests sin ahogar la Mac** (varias sesiones a la vez se quedaban sin RAM): corré **solo los tests de lo que
    tocaste**, nunca la suite completa, y siempre con `--maxWorkers=2` (`npx jest --findRelatedTests <archivos> --maxWorkers=2`
    o `npx jest <ruta del test> --maxWorkers=2`). La suite completa la corre el CI, o se corre solo si el usuario la pide.
    `package.json` ya fija `maxWorkers: 2`.
  - Lógica (`src/**/__tests__`): `fetch` simulado con `globalThis.fetch = jest.fn(...)`.
  - Pantallas: `renderRouter` de `expo-router/testing-library` con navegación real, mockeando
    `@/features/*/actions`. En Testing Library 14 **`fireEvent` es async**: siempre `await fireEvent...`.
  - `jest.setup.ts` mockea SecureStore en memoria.
- **Si el backend cambia la API:** `npm run api:generate` (o `API_SPEC=../backend/openapi.json npm run api:generate`)
  y commiteá `schema.d.ts`. El job `contract` del CI falla si quedó atrás: compara contra la rama del backend con el
  mismo nombre que la de la app si tiene commits que `develop` no tiene (feature de los dos repos sin mergear), y si no contra `develop`.
- **Ramas:** `develop` es la default. Features en `feature/*` desde `develop`, vuelven por PR con CI
  en verde. `main` es producción (PR + CI + 1 aprobación, el admin puede saltearla). Sin push directo.
- Mensajes de commit y PR en español.
- Al agregar paquetes nativos: `npx expo install <paquete>` (respeta las versiones del SDK) y después
  rebuild con `npx expo run:ios --device`. `.npmrc` tiene `legacy-peer-deps=true` por un conflicto de peers del SDK 58.

```bash
npm test                      # ~1800 tests
npm run test:watch
npm run typecheck
npm run icons                 # regenera ícono y splash (assets/)
npm run lottie                # regenera los Lottie (momento, bienvenida, intro; assets/lottie/)
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

Vive en su propio repo, [rollo-app/web](https://github.com/rollo-app/web) (se separó el 11/11/2026; la historia anterior
quedó acá): landing, `/soporte`, `/privacidad`, `/terminos`, `/friends` y `/entrar` (las dos que usan los links de la app), el
archivo de Universal Links y el video del hero (Remotion). Se sirve en `rolloproject.com` y sigue en `rollo.juanifraga.com`
(los builds instalados declaran ese dominio para Universal Links). Los legales se editan allá (`docs/legal/`); acá queda
`docs/legal/etiquetas-privacidad.md` (interna, para App Store Connect). El video del hero usa una copia del estilo del mapa
de la app (`src/features/map/style.ts` + `positron.json`): si cambia la paleta, copiarlos también allá.

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
perfil (grilla, mapa por zonas, perfil público o solo amigos, perfil de cualquier miembro o autor), identidad (cobalto, ícono, splash) y el revelado: tabs Rollos · Mapa · (cámara / Presentación) · Amigos · Perfil, cuentas (email + código, perfil con foto y descripción), presentación
(enfoque + historias), galería con visor y descargas a Fotos, y notificaciones push (siete avisos, permiso, Ajustes) con "me gusta" en los visores. Corre en el iPhone
con dev build contra el backend local.

Pendiente antes de enero (ver reports/Estudio de mercado cámaras compartidas.md): estado de subidas en Rollo,
export ordenado por día,
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
