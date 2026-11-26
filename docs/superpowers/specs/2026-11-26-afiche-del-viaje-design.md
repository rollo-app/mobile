# Afiche del viaje — diseño

Fecha: 2026-11-26 · Estado: **pendiente de aprobación del dueño**. La versión del afiche (pines con foto + nombres de ciudad) la eligió el dueño de tres maquetas el 2026-11-26.

Es la cuarta pieza de "Compartir", después del collage, el Recorrido y el Resumen (`2026-11-25-compartir-en-stories-design.md`, `2026-11-26-recorrido-en-video-design.md`).

## Para qué

Que quien vuelve de un viaje pueda postear **una sola imagen** con el mapa de todo el recorrido y los números del viaje. Es la versión quieta del Recorrido: no hay que esperar a que se arme un video ni mirarlo entero para entender el viaje.

## Qué se comparte

Una imagen vertical de **1080×1920** (JPEG), siempre con el mapa oscuro:

```
┌──────────────────────────┐
│ Balcanes en auto         │  nombre del rollo (hasta 2 renglones)
│ 3 al 26 de octubre · 2026│  fechas
│                          │
│        ◉ Belgrado        │  mapa oscuro a pantalla completa,
│      ◉                   │  la ruta entera en cobalto,
│   Mostar ◉──◉ Sarajevo   │  un pin redondo con foto en cada parada
│      ◉──◉ Kotor          │  y el nombre de la ciudad al lado
│  ◉ Dubrovnik             │
│                          │
│ 24      1.858     9      │  números en grande
│ días    km        lugares│
│     ◍ Rollo Project      │  marca (logo cobalto) y rolloproject.com
│ © OpenStreetMap · OpenFreeMap
└──────────────────────────┘
```

- **Pines con foto**: los mismos del Recorrido (la primera foto de cada parada, redonda con aro blanco).
- **Nombres de ciudad** *(dueño)*: uno por ciudad distinta, al lado de su pin. Si un nombre no entra sin pisar un pin, otro nombre o los bordes, no se dibuja (el pin queda igual).
- **Números**: días (los del rollo, como en el video), km de la ruta y lugares (cantidad de paradas). Fotos y personas quedan afuera *(propuesta, sin objeción del dueño)*.
- Franjas oscuras arriba y abajo para que el texto se lea sobre el mapa.

## Quién lo tiene

Exactamente los rollos que tienen Recorrido: viaje (no evento), revelado, no privado y con al menos 2 paradas de fotos compartibles con ubicación (`filmBlocked(...) === null`). Eventos y rollos sin recorrido no tienen afiche en esta versión *(dueño)*.

## Dónde vive

Un segmento más en "Compartir": **Collage | Recorrido | Afiche | Resumen**, visible solo cuando el rollo tiene Recorrido. Muestra la vista previa del afiche y las mismas píldoras que el collage: **Instagram** (el afiche va como fondo de la historia, a pantalla completa), **WhatsApp** y **Más opciones**. No hay "Guardar en Fotos" (el collage tampoco lo ofrece; se llega por "Más opciones").

Usa las mismas fotos que el Recorrido: si el usuario eligió fotos para el video, el afiche sale de esas. No tiene selector propio.

## Privacidad

Las reglas del Recorrido, sin excepciones:

- Solo fotos `shareable` (`filmCandidates`), con el corte `FILM_CUTS.share`.
- Ninguna coordenada exacta: cada parada en el centro de su celda de 0,05°, lugares de al menos 2,5 km.
- Zoom del mapa nunca mayor que el del video (tope 10, y el afiche usa la misma cuenta que la vista general del video).
- Nombres: solo la ciudad (`stopLabels` con `cityTitles`), nunca calle ni lugar.
- Ningún nombre de persona ni avatar: los pines llevan foto, no autor.
- El crédito "© OpenStreetMap · OpenFreeMap" siempre visible, abajo a la izquierda.

## No objetivos

- Afiche para eventos o rollos sin recorrido.
- Estilo claro (pediría otro mapa). Solo oscuro.
- Copias de papel sobre el mapa (maqueta 3, descartada: tapa la ruta y es la más cara).
- Selector de fotos propio, "otra versión" o cualquier ajuste del usuario.
- Dependencias nativas nuevas o cambios nativos: tiene que andar en el dev build instalado con solo recargar JS.

## Enfoques considerados

1. **Sacar un cuadro del video** (`frameAt` en el cierre, dibujado con `drawFrame` a 2,5×). Lo más barato, pero el encuadre del video deja la ruta donde el afiche pone los números, el texto del cierre no es el del afiche y no hay nombres de ciudad. Descartado.
2. **Una composición propia sobre las piezas del motor** *(elegido)*: mismas paradas (`buildStops`), mismos nombres (`geocodeStops` + `stopLabels`), misma imagen de mapa (`StaticMapImageManager` vía `engine/assets.ts`), dibujada fuera de pantalla con Skia como la tarjeta del collage. La cámara y la ubicación de los nombres son lógica pura nueva y chica, con tests.
3. **Mapa en vivo + captura de pantalla.** Depende del tamaño del teléfono y de lo que haya encima; es justo lo que el motor propio vino a evitar. Descartado.

## Cómo se arma

- `src/features/journey/poster/poster-layout.ts` (puro, con tests): de las paradas y el cuadro (432×768 "puntos de película", como el video) saca la cámara que mete toda la ruta en la banda libre entre el título y los números, la especificación de la imagen de mapa, la posición de cada pin y la línea. Aparte, `placeLabels`: dados los pines y el tamaño medido de cada nombre, elige para cada ciudad un lado libre (derecha, izquierda, abajo, arriba) o lo descarta. También los textos de los números.
- `src/features/journey/poster/render-poster.ts` (Skia, mockeado en `jest.setup.ts`): dibuja en una superficie de 1080×1920 (escala 2,5 sobre el cuadro) el mapa **sin sus propios nombres** (el estilo "bare" que ya usa el video, para que no se dupliquen con los nuestros), la ruta, los pines, los nombres, las franjas, el título, los números, la marca (`drawBrand`) y el crédito. Devuelve el JPEG.
- `engine/assets.ts`: una función para pedir **una** imagen de mapa a la densidad del afiche (1080 px de ancho) con su propia memoria, sin tocar la de las capas del video.
- `src/features/journey/poster/use-poster.ts` (mockeado en tests de pantalla como `use-film`): paradas → nombres → mapa y fotos → render → archivo en caché. Estados `loading | error (offline) | no-route | ready { uri }`.
- `src/features/share/poster-share.tsx`: el cuerpo del segmento (vista previa 9:16, píldoras, errores con reintento), montado solo mientras el segmento está elegido, como `FilmShare`.
- `share-story.ts`: `shareImageToInstagramStories(uri)` con `backgroundImage` de `react-native-share` (ya soportado por el módulo instalado).
- `share-story-screen.tsx`: el segmento "Afiche" cuando el rollo no está bloqueado para el Recorrido (`filmBlocked` con las paradas de `rollVideoCounts`); no depende de que el módulo de video exista en el build, porque el afiche no lo usa.

## Decisiones mías (no del dueño)

- "Lugares" cuenta paradas, no ciudades distintas.
- Orden de segmentos: Afiche al lado de Recorrido.
- Si no se consigue el nombre de una ciudad (sin conexión al geocodificar), el afiche sale igual, sin ese nombre.
- Pines que se pisan (paradas muy cercanas en un viaje largo) se dibujan en orden, el último arriba, como en el video.

## Queda para quien lo construye

Tamaños y márgenes exactos del texto, radio del pin, opacidad de las franjas: partir de la maqueta (270×480, ×4) y ajustar mirándolo en el iPhone del dueño.
