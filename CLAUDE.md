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
  no tiene nombre). El perfil es **nombre + foto** (`GET/PATCH /me`, foto con `expo-image-picker` 1:1 →
  512 px JPEG → `POST /me/avatar` → PUT → complete; sin foto, círculo con la inicial y `memberColor`). Además tiene un **nombre de usuario único** (`@usuario`, `PATCH /me`): se pide en "Completá tu perfil" junto al nombre
  (sugerido desde el email, con chequeo de disponibilidad) y se muestra en Perfil, miembros y Feed. Crear rollo
  o unirse es solo con el código de 6 (`POST /trips/join`; el server pide nombre en el perfil). **La sesión es un
  único token en SecureStore (`rollo.session`)** que usan todas las llamadas; un `401` en cualquiera cierra la
  sesión local y vuelve al login (`setUnauthorizedHandler` en `src/api/client.ts`). Los rollos salen de
  `GET /me/trips` (cache de TanStack Query); el rollo activo es el último que abriste y solo se guarda su id
  (`rollo.activeTrip`). "Cerrar sesión" y "Borrar cuenta" están al final de Perfil; cerrar sesión **no** borra la
  cola de fotos pendientes.
- **Cámara nativa del sistema** (`expo-image-picker` → `launchCameraAsync`), no una cámara propia:
  funciona mejor, sobre todo en video. Lo que se saca **no queda en el carrete**: se sube y se borra
  del caché local.
- **Fotos a resolución completa** (~4000 px, JPEG 85–90 %, para imprimir) + **thumbnail ~800 px** que
  genera el celular. **Videos de hasta 15 s**, comprimidos a 1080p en el celular.
- **Metadatos:** al mandar, la foto lleva EXIF (fecha/hora local del rollo con offset, GPS, `Software: Rollo`) y XMP
  con caption y autor en Unicode (`piexifjs`, JS puro). Al guardar en Fotos se inyectan si el original no tiene fecha.
- **Límite diario** de fotos y videos por persona (lo aplica el server).
- **Offline first:** al disparar se guardan foto, hora (UTC + zona) y GPS. Pedir ubicación apenas se
  abre la cámara; sin fix, usar la última conocida y guardar su precisión. Cola local en SQLite, subida
  en segundo plano cuando hay señal, **UUID generado en el celular** (reintentar es seguro).
  Con la app cerrada o suspendida sube `expo-background-task` (tarea `rollo-upload`, BGProcessingTask de iOS: solo
  con red, cuándo corre lo decide el sistema, ~25 s por pasada con corte limpio entre ítems); los PUT usan sesión
  de URLSession en background. Si se mata la app a mano, iOS no la despierta hasta que se vuelva a abrir.
  En dev, la fila "Probar subida en segundo plano" de Perfil (sección Desarrollo) la dispara.
- **Mapa sin señal automático** (`src/features/map/offline-*.ts`): al abrir la app y al volver a primer plano baja solo
  una zona amplia (300 km, z5–10) y otra detallada (40 km, z10–14) alrededor de la ubicación y de los lugares donde
  sacó fotos el grupo (grilla de 30 km), desde 3 días antes del inicio hasta el fin del rollo (antes del inicio, solo
  con Wi‑Fi; tope ~400 MB). Los packs usan el mismo `file://` de estilo que el MapView, se nombran
  `rollo:{tripId}:{wide|detail}:{lat},{lng}` y se borran 7 días después del fin. Estado en Perfil → "Mapa sin señal" (ajuste del celular, no del rollo).
- **Captura:** cámara nativa con selector foto/video (máx. 15 s); si no quedan videos hoy, abre solo en
  foto. Después, **preview nítido** con "Repetir" o "Mandar al rollo" + caption opcional. Una vez
  mandada no se puede repetir ni ver.
- **Antes del revelado** no se ve ninguna foto, solo su **ThumbHash** (colores difusos, lo genera el
  celular y el server lo devuelve en el feed). Para que den ganas de abrir la app: **mapa en vivo** con
  pins (autor y hora; con la foto de perfil del autor si tiene, hecha en JS como `tab-avatar` y registrada con `Images`, y si no la inicial sobre su color), **feed** y la hoja de contacto del rollo. Se muestra solo el total del grupo.
- **Rollo configurable al crearlo** (lo hace el admin, formulario nativo con `@expo/ui`): nombre, inicio y fin
  **con fecha y hora**, fotos y videos por persona por día, y **cuándo se revela** (al terminar o en otro
  momento, siempre igual o posterior al fin). Las fechas las valida el server; la app muestra su mensaje inline (`src/features/trips/create-form.ts` solo chequea los nombres).
- **Amigos** (`src/features/friends/`): se hace amistad con un **link de amistad** (`POST /friends/link`, vale 1 hora, uno
  vivo a la vez, multiuso): `rollo://friends/<CODE>` con CODE de 8 caracteres, que también se puede escribir a mano. Abrirlo
  (`app/friends/[code].tsx`, fuera del grupo protegido) llama a `POST /friend-links/claim` **sin sesión** y: con cuenta lista
  canjea (`POST /friends/redeem`) y abre la lista; sin cuenta guarda el permiso de canje (24 h) en SecureStore
  (`rollo.pendingFriend`, nunca en el cache de Query) y lo canjea cuando el perfil queda completo (`use-pending-friend.ts`,
  el único lugar donde se canjea). "Completá tu perfil" tiene el campo opcional "¿Te invitó un amigo? Código". Perfil → "Amigos"
  (lista con foto, nombre y @; borrar es silencioso) e "Invitar a un amigo". Cualquier miembro suma a **sus** amigos al rollo
  desde "Sumar amigos" (sheet `add-friends`, respuesta por amigo: "Ya está" / "No disponible"), y cualquiera menos el admin
  puede "Salirme del rollo" (conserva sus fotos y puede volver con el código). Los links `https` (Universal Links) llegan con TestFlight.
- **Varios rollos por persona**, se puede volver a ver uno viejo. El **rollo activo** es el último que
  abriste; se cambia con el selector del header (sheet "Tus rollos"). Las fechas del rollo van con
  **inicio y fin** (no "cantidad de días").
- **Modo viaje:** una notificación por día a un horario random distinto para cada uno, con un
  disparador opcional. Ese "momento" es foto principal + selfie, con cámara propia
  (`react-native-vision-camera` o `expo-camera`); la selfie chica (~1080 px).
- **Después del revelado:** galería, mapa con fotos, timeline por día, descarga y export para fotolibro.
  La ceremonia del revelado será una presentación (a definir).
- **A futuro (no para enero):** feeds públicos de rollos, perfiles públicos y avisar cuando te suman a un rollo (push). No cerrarle la puerta: la tab "Perfil" será
  el perfil completo.

## Navegación y diseño

- **Barra de abajo nativa** (`NativeTabs` de `expo-router/native-tabs`, liquid glass en iOS 26), **solo
  íconos SF Symbols**: Rollo · Mapa · **Cámara** (centro) · Feed · Perfil. La cámara es un trigger
  `disabled` cuyo `tabPress` abre `/capture` encima. Después del revelado: Galería · Mapa · Presentación
  · Días · Perfil.
- Rollo = tablero (hoja de contacto, cupo de hoy, fechas, estado de subidas, "Invitar" con código y compartir,
  miembros): todo lo del rollo activo vive acá. Revelado, la tab es la galería y esos datos
  (invitar, miembros, subidas) salen del botón "Sobre el rollo" del header (sheet `roll-info`). La actividad
  ("Cami sacó una foto · 14:32", con la hora de captura) vive solo en el Feed.
- Perfil = solo la cuenta: foto, nombre y @usuario, "Editar perfil" (ahí se ve el email, de solo lectura),
  "Desarrollo" (solo dev), "Mapa sin señal" (ajuste del celular, fila propia) y "Cerrar sesión" / "Borrar cuenta".
  No carga datos de ningún rollo.
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
    Rollo si hay pendientes y en el tablero de Rollo (sección de subidas, y "Sobre el rollo" una vez revelado) "N fotos esperando señal" / "N no se pudieron subir" con el motivo.
  - **Alerta nativa** (`Alert`) solo para algo grave e irreversible (por ej. el rollo se reveló con fotos
    tuyas sin subir) o para confirmar una acción destructiva (borrar como admin).
  - Si un momento puntual necesita una confirmación fugaz, usar `burnt` (HUD nativo tipo AirPods), no un
    toast hecho a mano.

El backend vive en [rollo-app/backend](https://github.com/rollo-app/backend).

## Stack

- **Expo SDK 58**, React Native 0.88, **Expo Router**, TypeScript estricto. Node **>= 22.13** (`.nvmrc`).
- **Development build** (`expo-dev-client`): Expo Go de la App Store está trabado en un SDK viejo.
- Cliente de la API **generado del contrato**: `openapi-typescript` → `src/api/schema.d.ts` (no editar
  a mano) + `openapi-fetch`. `unwrap()` convierte el `{ error }` del server en `ApiError`.
- `ios/` es generado (`npx expo prebuild`) y está en `.gitignore`. La config nativa va en `app.json`; `app.config.ts` solo cambia nombre y
  bundle id según `APP_VARIANT` (ver Apple).

## Estructura del código

```
app/                    Solo rutas (Expo Router). Pantallas finas: arman hooks y componentes de features.
  (tabs)/               NativeTabs: roll, map, camera (abre /capture o /presentation), feed, me; cada una con su Stack
  photo/[id].tsx        visor de una foto revelada; presentation.tsx, capture.tsx, create.tsx, join.tsx...
src/
  features/<dominio>/   Todo lo de un dominio, junto:
                          actions.ts      llamadas a la API (es lo que mockean los tests de pantalla)
                          use-*.ts        hooks (datos con TanStack Query, estado)
                          *.ts            lógica pura, testeable sin React
                          *.tsx           componentes propios del dominio
                          __tests__/      tests de esa lógica, al lado del código
                        Dominios: auth (sesión, login, gate), friends (amigos, link de amistad, sumar a un rollo, salirse), profile (nombre, foto, `Avatar`), trips (el rollo: lista desde el server, rollo activo, detalle, etapas), capture (cámara, cola
                        offline, subida), feed, map, media (fotos reveladas + fuente con token), gallery
                        (grilla, visor, descargas), exif (metadatos de las fotos), presentation, reveal, notifications, roll (tablero).
  ui/                   theme.ts (tokens) + componentes base compartidos: Screen, Section, Row, Button,
                        Field, Body, Footnote, ErrorText, Loading
  api/                  cliente generado del contrato (schema.d.ts NO se edita a mano) + client.ts
  storage/              lo que se guarda en el celular (SecureStore). Sus claves NO se renombran
  test/                 helpers de tests: rutas de la app (routes.ts) y SQLite en memoria
__tests__/              tests de pantallas con navegación real (renderRouter)
```

Reglas:

- **`app/` solo rutea.** Una pantalla no llama a la API ni tiene lógica de negocio: usa hooks y componentes
  de `src/features`. Si una pantalla crece, lo que crece se va a su feature.
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
npm test                      # 679 tests
npm run test:watch
npm run typecheck
npm run icons                 # regenera ícono y splash (assets/)
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

Para entrar a un rollo revelado del seed: login con `juani@rollo.test` (está en los 7 rollos de prueba, incluido Bariloche revelado); el código de 6 dígitos aparece en la consola de `npm run dev:lan` del backend.

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
- El entitlement de push sigue sacado (`./plugins/without-push-entitlement`) hasta que usemos push.
- Pendiente para la revisión de la App Store (no para TestFlight): cuenta de prueba para el revisor en el backend,
  URL de política de privacidad y las etiquetas de privacidad.

## Estado y plan (octubre 2026)

Hecho: crear rollo configurable (fechas, cupos, revelado), unirse con código, etapas del rollo, cámara con
preview, cola offline con subida en segundo plano, cache persistente, Mapa (pins agrupados, carrusel, filtros),
Feed, identidad (cobalto, ícono, splash) y el revelado: tabs Galería · Mapa · Presentación · Perfil, cuentas (email + código, perfil con foto), presentación
(enfoque + historias), galería con visor y descargas a Fotos, y aviso local del revelado. Corre en el iPhone
con dev build contra el backend local.

Pendiente antes de enero (ver reports/Estudio de mercado cámaras compartidas.md): estado de subidas en Rollo,
la cola de fotos de otra cuenta (hoy sigue en el celular al cambiar de cuenta), export ordenado por día,
testing externo en TestFlight (revisión de Apple) y la prueba real. El backend ya está en producción
(`rollo-api.juanifraga.com`) y el build 2 (1.0.0) ya se instala por TestFlight (testing interno).

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
4. **Modo viaje:** push con Expo, momento doble (principal + selfie). Es lo primero que se recorta si no llegamos.
5. **Prueba real** en una escapada corta con amigos, antes del viaje.
6. TestFlight con la cuenta del amigo.
