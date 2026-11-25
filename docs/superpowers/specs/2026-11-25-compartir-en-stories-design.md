# Compartir en Instagram Stories — diseño

Fecha: 2026-11-25 · Estado: aprobado por el dueño (2026-11-25). **Falta la parte visual:** espera al modal de unirse por QR que se está diseñando en la sesión "Rediseño de Galería y sección de Rollos".

## Para qué

Que Rollo se conozca a través de sus usuarios. La gente comparte su rollo en Instagram Stories, la ven sus amigos y les da curiosidad. No hay ningún conector ni login con Instagram: Meta cerró la API para cuentas personales, y publicar en el feed exige una cuenta profesional y pasar la revisión de Meta. Lo que hacemos es *compartir hacia* Instagram.

## Qué se comparte

1. **Collage del rollo revelado.** Una imagen vertical con fotos del rollo y la marca "Rollo Project".
2. **Invitación al rollo.** Solo **antes del revelado** y solo si el rollo no está lleno. Muestra el nombre del rollo, el rollo "sin revelar" y "Sumate al rollo". Sirve para cualquier rollo, no solo para eventos: `rolloproject.com/join/CÓDIGO` ya funciona con cualquier código (`joinLinkUrl`).

Más adelante se va a sumar una tercera pieza: el recorrido del mapa ("Reproducir el viaje"). No es parte de este trabajo, pero el diseño tiene que dejarla entrar sin rehacer nada.

## Objetivos

- Que en uno o dos toques la imagen quede abierta en el editor de Stories de Instagram.
- Que también se pueda mandar por WhatsApp, guardar la imagen, etc.
- Que se reconozca que es Rollo, pero sin que parezca un aviso.

## No objetivos

- Login con Instagram, importar fotos de Instagram o publicar en el feed.
- Generar video dentro de la app. El recorrido del mapa en video queda para después.
- Ponerle a la story un link tocable de forma automática. Instagram no lo permite; ver "Link en la invitación".

## Lo que no puede pasar (aunque funcione)

- **El collage no lleva "Descargá la app"** ni ningún otro llamado a la acción. Solo la marca chica: "Rollo Project" y debajo `rolloproject.com`. Al dueño no le gusta eso como usuario, y si la imagen parece un aviso la gente no la va a postear.
- Que salga en el collage una foto que su autor no deja mostrar fuera del rollo.
- Que la invitación deje ver cualquier foto antes del revelado.

## Enfoques considerados

- **A. Directo a Stories** (`react-native-share`, `Social.InstagramStories`): en un toque abre el editor de Stories con la imagen. Requiere un App ID de Meta (gratis, sin revisión) y un build nuevo.
- **B. Menú de compartir del sistema** (`Share.share`, como el QR de hoy): no suma nada nuevo y sale por OTA. Pero hay que buscar Instagram y elegir Story, y no se puede elegir directamente Stories.
- **C. Las dos — elegida.** Un botón principal "Compartir en Stories" (A) y otro "Más opciones" (B). La imagen se arma igual en los dos casos, así que B no cuesta casi nada, y WhatsApp se usa mucho en rollos de viaje.

## Lo decidido

### Fotos del collage
- **De todos los miembros, elegidas automáticamente**, con un botón **"Otras"** que mezcla de nuevo.
- **Entran las fotos de todos los que dejan destacar sus fotos** (lo decidió el dueño). Se respetan los mismos niveles que para destacar, pero **sin pedir amistad**: la foto no tiene "No dejar que la destaquen", el autor no apagó "Permitir que agreguen mis fotos a su perfil" (cuenta), tampoco "Tus fotos en otros perfiles" (rollo), y el rollo no es privado. Tus propias fotos entran siempre, salvo en un rollo privado.
- `canFeature` no sirve, porque exige ser amigo del autor. **Hace falta un cambio en el backend:** un campo nuevo por foto en el feed (por ejemplo `shareable: boolean`) que calcule el server con esa regla. Va en `rollo-app/backend`, con su rama del mismo nombre y `npm run api:generate` en la app.
- **Rollo privado** (`featuringDisabled`): no hay collage, ni siquiera con tus propias fotos. Respeta la regla "ninguna foto sale, ni la del autor". La invitación sí se puede compartir, porque hoy ya se comparte con el nombre del rollo por WhatsApp. *(mi decisión)*
- Quedan afuera las archivadas y las de momento del día, igual que con destacar. *(mi decisión)*
- El collage lleva el nombre del rollo y las fechas. Lo comparte el usuario por su cuenta, igual que hoy la invitación. *(mi decisión)*
- "Otras" elige otra combinación entre las fotos que se pueden usar. Si no alcanzan para cambiar algo, no aparece. *(mi decisión)*

### Quién ve cada botón *(mis decisiones)*
- Collage: cualquier miembro activo de un rollo revelado, también en eventos. El invitado usa las fotos que ve, que son las de sus grupos.
- Invitación: quien hoy puede tocar el código en "Invitar", con las mismas reglas (sin revelar y no lleno). La pantalla del QR del organizador también puede tener el botón.
- El link se copia al tocar cualquiera de los dos botones de la invitación. El texto del aviso está siempre a la vista en el modal.
- *Propuesta:* solo fotos, sin videos, porque el cuadro fijo de un video suele quedar mal. Si no hay suficientes fotos para el diseño, se usan las que haya. Si no hay ninguna, el botón no aparece.

### Cómo llega a Instagram
- Se arma una imagen de 1080×1920 sin mostrarla en pantalla, con Skia (`Skia.Surface.MakeOffscreen`), igual que hoy `qrPng` en `src/features/events/qr-canvas.tsx`. Se guarda en `Paths.cache`.
- "Compartir en Stories": `react-native-share` → `Social.InstagramStories` con la imagen como fondo y el `appId` de Meta. Si Instagram no está instalado, el botón no aparece y queda solo "Más opciones".
- "Más opciones": `Share.share({ url })` con el mismo archivo.

### Link en la invitación
Instagram no deja que una app le agregue un link tocable a la story. Por eso, al compartir la invitación, la app **copia el link `rolloproject.com/join/CÓDIGO` al portapapeles**. El aviso no es un toast (en la app no se usan): va como texto fijo en el modal, debajo del botón, *antes* de tocarlo ("Copiamos el link. Pegalo en tu story con el sticker de Enlace"). Además, la imagen muestra el código del rollo, para quien prefiera escribirlo.

### Aspecto de las imágenes (aprobado 2026-11-25)
Siguen el idioma de la pantalla de unirse (`EventHero` en develop): esquinas redondeadas continuas, degradé oscuro abajo (`rgba(0,0,0,0)` 40 % → `rgba(0,0,0,0.6)` 100 %), texto blanco con el título en peso bold y apretado, y un fondo casi negro (`#0b0b0c`/`#1c1c1e`) para que el texto siempre sea blanco. Maquetas en `.superpowers/brainstorm/11957-1795580908/content/stories-v1.html`, en la raíz de Rollo.

- **Marca, en las dos piezas:** abajo y centrada, el logo "Revelado" chico + "Rollo Project" y debajo `rolloproject.com` con poca opacidad. Sin llamado a la acción.
- **Collage (opción B, la eligió el dueño):** arriba, la línea chica "3 – 9 de enero · 8 personas" y el nombre del rollo grande. Debajo, un mosaico con **una foto protagonista grande** (unos 2/3 del ancho y dos filas de alto) y hasta 7 fotos más chicas alrededor, cada una con sus esquinas redondeadas y una separación chica entre ellas. Con menos fotos, el mosaico usa menos celdas y nunca deja huecos (la grilla exacta para 1–8 fotos la define quien lo construya). "Otras" cambia también cuál es la protagonista.
- **Invitación:** un cuadrado como el `EventHero` arriba, con "Te invito a", el nombre y una línea chica. Lo que va en el cuadrado:
  - **Evento con portada:** la portada. La línea dice "12 de diciembre · 84 personas ya se unieron" (`joinedLine`: desde 5 personas; con menos, "Sé de los primeros en unirte").
  - **Rollo o evento sin portada:** los thumbhash de las fotos ya sacadas, en grilla y bien borrosos, como la hoja de contactos. Si todavía no hay fotos, un degradé en cobalto oscuro. La línea dice las fechas y "sin revelar".
  - Debajo: "Sumate con el código" y el código grande con letras espaciadas. Después **un espacio libre** para que el usuario pegue el sticker de Enlace (en la imagen no se dibuja nada ahí).

### Pantalla de compartir
Un modal como el de unirse: `Screen` agrupada, "Cancelar" en la barra a la izquierda, la vista previa de la imagen en 9:16 con esquinas redondeadas y, debajo, el botón principal "Compartir en Stories" (si hay App ID e Instagram instalado), el secundario "Más opciones" y, solo en el collage, "Otras". En la invitación, debajo de los botones, el `Footnote` "Copiamos el link. Pegalo en tu story con el sticker de Enlace".

### Dónde están los botones (propuesta)
- Collage: en el segmento **Rollo** de un rollo revelado (`RollOverview`).
- Invitación: en la sección **Invitar** (`RollInvite`, `roll-essentials.tsx`), como fila "Compartir en Stories", mientras no esté revelado ni lleno. Si el modal de QR nuevo tiene lugar para esto, también ahí.

### Pensado para que entren más piezas
Las piezas comparten la misma tubería: armar la imagen, mostrar la vista previa y compartir. Cada pieza (collage, invitación y, más adelante, recorrido del mapa) aporta solo su dibujo y su lógica.

## Requisitos y costos

- **Build nuevo** (sumar un módulo nativo no puede salir por OTA; `runtimeVersion` es `appVersion`, así que hay que subir la versión).
- **App ID de Meta: `1187882687102371`** (app "Rollo Project" en Meta for Developers, creada por el dueño con su cuenta personal el 2026-11-25, en modo Development, con plataforma iOS `com.juanifraga.rollo.app`). Es público y va en la configuración (`src/config.ts`), no en un secreto. Hay que probar en el iPhone si compartir en Stories funciona en modo Development. Si no funciona, se pasa a Live.
- iOS: `LSApplicationQueriesSchemes` con `instagram-stories` (y `instagram`) en `app.json`.
- Nuevas dependencias: `react-native-share` y `expo-clipboard`.
- Las fotos se bajan con el token de sesión, igual que `src/features/gallery/save.ts`.
- La app es solo iOS: no hay que resolver Android.

- **Sin App ID no hay botón de Stories:** si la configuración no tiene el App ID de Meta, "Compartir en Stories" no aparece y queda solo "Más opciones". Así se puede mergear antes de tener el ID. *(mi decisión)*

## Lo que queda para quien lo construya

- Las medidas exactas, cuántas fotos entran y la grilla del collage (una vez visto el modal de QR).
- Cómo se dibuja "sin revelar" en la invitación (thumbhashes borrosos, como la hoja de contactos).
- Los textos finales de los botones y del aviso del portapapeles.
