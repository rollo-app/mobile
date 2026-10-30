# Video de la landing (Remotion)

## Para qué

La primera pantalla de `rollo.juanifraga.com` hoy muestra una maqueta quieta del tablero (`mockups.rollSheet()` dentro de
`.hero .phone`). La reemplazamos por un **video mudo en loop que arranca solo**, dentro del mismo marco de iPhone. Quien entra y se
va a los pocos segundos tiene que llevarse la idea entera de Rollo: **sacás fotos que nadie ve, se ven los puntos en el mapa, después
se revelan, quedan en la galería y las mejores van a tu perfil.**

## Qué cuenta, en orden (pedido por Juani)

1. **Sacar la foto:** la cámara de Rollo (recuadro 4:3, chips de zoom "0,5 · 1 · 2", disparador). Se dispara y va a la pantalla del
   caption con la foto **muy difuminada**, "Mandar al rollo" y la animación de mandar. Nadie la ve, ni quien la sacó.
2. **El mapa:** aparecen pins del grupo (avatar o inicial sobre su color, la hora) uno tras otro. Se ve que el rollo está vivo sin ver fotos.
3. **El revelado:** cuarto oscuro rojo con grano ("Revelando Budapest y Praga"), las fotos salen de manchas de color a nítidas, la luz
   pasa de roja a blanca, "Se reveló".
4. **La galería:** la grilla del rollo revelado con las fotos reales.
5. **El perfil:** encabezado (foto, nombre, @usuario) y la grilla "Fotos | Mapa" de destacadas.
6. **El momento del día, si entra en el tiempo:** pantalla bloqueada de iPhone, llega la notificación "Es tu momento", se toca, la intro
   del momento (anillo cobalto + "Tu momento"), foto con la trasera y después con la frontal, estilo BeReal.

## Decidido

- **Mudo, autoplay, loop, `playsinline`**, en el hero y solo ahí (pedido de Juani).
- **Fotos reales del viaje de Juani por Europa, del 2 al 20 de julio de 2026** (23 fotos en `~/Downloads/Photos-1-001.zip`, HEIC de iPhone 15 Pro Max
  con GPS y hora; los `.MP4` son las Live Photos y no se usan): Dubrovnik, una isla de Croacia (43.16, 16.39), Budapest (la mayoría),
  Moravia (en tren), Praga, Luxemburgo y Metz. Se usan para la galería, el revelado, el perfil y la cámara.
- **Ubicaciones y horas reales** (pedido de Juani): cada pin del mapa y cada hora que se vea salen del EXIF de la foto (GPS y
  `DateTimeOriginal` con su offset +02:00). Un script lee el EXIF una vez y deja `video/src/data/photos.json` (archivo, lat, lng, fecha y hora local, cámara).
- **Remotion** para armarlo (pedido de Juani).

## Mis decisiones (Juani puede cambiarlas)

- **Duración ~22–26 s a 30 fps**, cada escena 3–4 s, cortes con transiciones cortas; el último cuadro vuelve al primero sin salto.
  Si con el momento pasa de ~28 s, el momento queda afuera o se acorta.
- **Solo la pantalla del celular** va en el video; el marco del iPhone sigue siendo el `.phone` de CSS de la landing. Tamaño de render
  **2× del `.phone` del hero** (unos 540×1170, 9:19.5), con los bordes redondeados los pone el CSS.
- **Pantallas recreadas en React web dentro de Remotion**, no grabadas de la app. Se reusa lo que ya existe: tokens (`scripts/site/tokens.mjs`,
  cobalto solo en acciones), el estilo de `scripts/site/mockups.mjs` (personas y colores de miembro, fotos como manchas ThumbHash),
  el logo "Revelado" y el Lottie del momento (`assets/lottie/moment-intro.json`, con `@remotion/lottie`). Textos de UI en rioplatense,
  tomados de la app ("Mandar al rollo", "Es tu momento", "Se reveló").
- **Una sola versión, en modo oscuro de la app**: se ve bien sobre el fondo claro y el oscuro de la landing y evita dos videos.
- **Casi sin texto encima**: como mucho una palabra por escena fuera de la UI ("Sacá." / "Mirala después."), en la serif del sitio.
- **El mapa es un mapa real**: MapLibre GL JS con el mismo estilo de la app (`buildMapStyle("dark")` de `src/features/map/style.ts`,
  importado o copiado tal cual), esperando a que carguen los tiles antes de cada cuadro (`delayRender`). El render necesita red.
  La escena arranca con Europa entera y los pins del recorrido apareciendo en orden de fecha, y se acerca a Budapest donde se ven
  varios pins juntos con su hora.
- **El rollo del video se llama "Europa"** (del 2 al 20 de julio), con 5–6 personas de muestra (las de `mockups.mjs`); las fotos se
  reparten entre ellas para que el mapa tenga varios colores.
- **Fotos elegidas (sujeto a cambio en el armado):**
  - Foto de perfil: `IMG_6386`.
  - Momento del día: `IMG_6073` (trasera, teleobjetivo, el Castillo de Buda con la cúpula de la Basílica, 14:56) como principal y `IMG_6092`
    (frontal, con Budapest atrás, 15:49) como la otra foto. La frontal se ve espejada, como en la app. Los visores de la cámara y del momento
    reproducen el movimiento real del Live Photo (clips H.264 en `video/public/live/`, ignorados por git) hasta el disparador.
  - Cámara (escena 1): `IMG_6198` (Plaza de la Ciudad Vieja, Praga) en el visor.
  - Revelado y galería: las demás de paisaje y ciudad. Las selfies `IMG_6123`, `IMG_6386` y los dos `.jpg` sin GPS solo van en la galería o el perfil, o no se usan.
- **Proyecto aparte en `video/`** con su propio `package.json` (Remotion no entra en las dependencias de la app Expo ni en su Jest).
- **Salida:** `scripts/site/hero.mp4` (H.264) + `hero.webm` (VP9) + `hero-poster.jpg` (un cuadro representativo), apuntando a **menos de 3 MB**
  cada video (tope duro 5 MB). `build-site.mjs` los copia a `site/dist/` como hace con `og.png`. Un script `npm run video` (dentro de `video/`) renderiza y deja los tres archivos.
- **En la landing:** `<video muted autoplay loop playsinline preload="metadata" poster=…>` dentro de `.hero .phone`, `aria-hidden` (la `figure`
  sigue con su `aria-label`). Con "Reducir movimiento" no se reproduce: queda el póster. Sin JS anda igual (el autoplay es del navegador).
  La maqueta `rollSheet()` deja de usarse en el hero.

- **Orden de construcción:** primero las escenas 1–5; el momento (6) se suma después si el total queda en ~28 s o menos.
- **Costura del loop:** el perfil termina con un fundido a negro breve y un destello de obturador que entra de nuevo en la cámara
  (escena 1). El póster es un cuadro de la galería revelada (nunca una foto nítida "antes del revelado").
- **Peso:** objetivo 3 MB por video (aviso por encima), tope duro 5 MB (el render falla). Si no entra, se cede en este orden: grano (más sutil o más grueso),
  después resolución (1,5×), después duración. Nunca se bajan los 30 fps.
- **Tipografía:** se renderiza en la Mac de Juani con las fuentes del sistema (SF Pro y New York vía `-apple-system` / `ui-serif`), igual que el sitio;
  no se corre en CI.
- **Avatares de los pins y miembros:** iniciales sobre su color de miembro, como `mockups.mjs`; sin caras de amigos.
- **Archivos generados:** `hero.mp4`, `hero.webm` y `hero-poster.jpg` se commitean en `scripts/site/`. Si faltan, `build-site.mjs` falla
  (como con el badge en modo `appstore`).
- **Las fotos no entran al repo (es público):** un script (`video/scripts/prepare-photos`) toma el zip o la carpeta, pasa los HEIC a JPEG de
  ~1200 px con la orientación aplicada y los deja en `video/public/photos/`, que está en `.gitignore` junto con `photos.json`. Solo se commitea el
  video ya renderizado. Juani no contestó esto: es mi recomendación y la puede cambiar.

## Fuera

- Sonido, voz o música. Versión horizontal o para redes (se puede hacer después con el mismo proyecto).
- Grabar la app real o el simulador.
- Cambios en la app (`src/`, `app/`).
- Otras secciones de la landing: siguen con sus maquetas.

## Sería un fracaso si…

- Pesa tanto que la home tarda en cargar en un celular con 4G.
- Se ve "hecho con IA": todo grande, cards de wireframe, colores inventados. Tiene que parecer la app (ver "Estilo nativo de iOS" en `CLAUDE.md`).
- Se ve una foto nítida antes del revelado: rompe la idea central.
- El loop salta visiblemente al volver al principio.

## Para el builder

- Cómo hacer el revelado en web (CSS `filter` blur/sepia/saturate más una capa roja y grano, o WebGL): lo que se vea más cerca del
  revelado de la app (`src/features/reveal/darkroom-intro.tsx`, `darkroom-shaders.ts`).
- Curvas y tiempos de cada transición, siguiendo `emil-design-eng` / `animate-expo` (traducido a Remotion: `interpolate`, `spring`).
- Qué fotos van en qué escena, el recorte y la compresión (las fotos se achican antes de entrar al proyecto).
- Nombres de personas del grupo de muestra (los de `mockups.mjs`: Cami, Lu, Tomi, Fede…).
