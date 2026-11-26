# Recorrido en video: exportar y compartir — diseño

Fecha: 2026-11-26 · Estado: **aprobado por el dueño (2026-11-26)**. Dos puntos esperan una prueba en su iPhone (ver "Pendiente de probar"). Plan del primer paso: `docs/superpowers/plans/2026-11-26-recorrido-video-modulo-y-exportacion.md`.

Es la tercera pieza de "Compartir" que anticipaba `2026-11-25-compartir-en-stories-design.md`. El prototipo vive en el worktree `mobile-revelado` (rama `spike/mapa-se-revela`, sin commitear, descartable): `src/features/journey/`.

## Para qué

Que quien vuelve de un viaje pueda postear **el recorrido del rollo como un video**: el mapa vuela de parada en parada, se dibuja la ruta y en cada lugar se revelan las fotos. Es lo que hoy solo existe en el Reel del sitio. Tiene que dar ganas de postearlo y que quien lo vea pregunte con qué se hizo.

El dueño vio la demo en su iPhone (versión con mapa en vivo) y el video generado por el motor propio, y pidió seguir con exportar y compartir.

## Qué se comparte

Un video vertical de **1080×1920**, 30 cuadros por segundo, **de hasta 59 s** (la demo del Reel dura 41 s), sin sonido:

1. Portada: el mapa con todo el recorrido, el nombre del rollo y "24 días · 1.858 km".
2. Por cada parada: el mapa vuela hasta ahí, aparece el pin, se revelan sus fotos (de 1 a 4) y arriba dice "Día 4" y el lugar ("Perast, Montenegro").
3. Cierre: vuelve al mapa completo con la ruta entera, el nombre y "24 días · 1.858 km · 11 fotos".
4. Placa final: fondo negro, el logo de Rollo y la insignia de la App Store (2,5 s).

Cada vez que se arma, las fotos de cada parada se acomodan distinto (una sobre el pin, una grande, dos lado a lado, tres, o cuatro en una hoja), nunca igual que en la parada anterior. "Otra versión" lo vuelve a sortear.

## Objetivos

- Del rollo revelado al video listo para postear en pocos toques y **en menos de 20 s de espera** para un video de 41 s. Es una meta: se mide en el primer paso, en el iPhone del dueño (15 Pro Max), desde el toque hasta el archivo y con las fotos ya bajadas. Hasta 30 s se acepta. *(propuesta)*
- Los mismos encuadres, tiempos y fotos en cualquier iPhone: no depende del tamaño de la pantalla ni de lo que haya encima.
- Que el módulo nativo quede en un build antes del congelamiento de mediados de diciembre. Todo lo demás es JS y puede salir por update.

## No objetivos (esta etapa)

- **Meter el recorrido dentro del revelado** ("el mapa se revela" en vez de la grilla del cuarto oscuro). Es la segunda etapa, con su propio diseño. Es solo JS: no necesita otro build.
- Elegir a mano qué fotos entran (como "Elegir fotos" del collage).
- Sonido o música. Instagram deja ponerle música a la historia.
- Estilo claro. El video usa siempre el mapa oscuro.
- La luz roja de cuarto oscuro sobre el mapa. El video para compartir va **sin tinte**: el mapa oscuro apenas atenuado, para que manden las fotos y la ruta se vea en cobalto *(dueño, 2026-11-26, entre rojo, sin tinte, cobalto y ámbar)*. Las fotos siguen revelándose de sepia borroso a nítido. El rojo queda para el revelado dentro de la app.
- Botón directo a WhatsApp. Se llega por "Más opciones".
- Android.

## Lo que no puede pasar (aunque funcione)

- Que salga una foto que no es `shareable`, o cualquier dato de un rollo privado.
- Que el video muestre un lugar con más precisión que la que hoy mostramos fuera del rollo (ver "Ubicación").
- Que quede un mp4 cortado o roto presentado como bueno: al cancelar, si la app pasa a segundo plano o si el codificador falla.
- Que exportar trabe la app sin poder cancelar, o que iOS la cierre por memoria.
- Que el video pase de 59 s o de 50 MB.
- Que un update de JS llegue a un build sin el módulo nativo y rompa "Compartir": sin el módulo, "Recorrido" no aparece.
- Que el recorrido en sí parezca un aviso: mientras se ven el mapa y las fotos no hay ningún llamado a la acción. El único lugar donde aparece la tienda es la placa final (ver "La marca y el crédito del mapa").
- Que el video salga sin el crédito del mapa.

## Enfoques considerados

### Cómo se genera el video

- **A. Motor propio en el iPhone — elegido.** La película es una función del tiempo: `frameAt(scene, t)` dice qué hay en el cuadro y `drawFrame` lo dibuja con Skia. El mapa son imágenes fijas que saca MapLibre (`StaticMapImageManager`) y que la cámara mueve como fotos. El mismo código reproduce en pantalla y exporta. Da 9:16 exacto, sin pedir permisos y con los mismos encuadres en todos los teléfonos.
- **B. Grabar la pantalla mientras se reproduce** (ReplayKit). Menos trabajo, pero pide permiso de grabación, sale al tamaño de la pantalla, graba lo que haya encima y tarda lo que dura el video.
- **C. Armarlo en el backend** (Remotion). Costo por video, cola y aviso cuando está listo, y habría que mantener el dibujo dos veces.

### Cómo se codifica

- **A. Módulo propio en Swift con `AVAssetWriter`; los cuadros viajan como bytes — elegido.** Skia dibuja fuera de pantalla, se leen los píxeles (`readPixels` sobre un arreglo que se reutiliza) y el módulo los copia al codificador H.264 del teléfono. Unas 150 líneas de Swift que son nuestras. No usa la API que Skia marca "unstable"; el arreglo de destino de `readPixels` está en el código nativo pero no en los tipos publicados, así que va con un cast y, si una versión lo saca, se vuelve a un arreglo nuevo por cuadro (más lento, no roto).
- **B. El mismo módulo recibiendo la textura de Metal** (`surface.flush(true)` + `getNativeTextureUnstable()`). Ahorra una copia y quizás una espera de GPU por cuadro (estimado: de 1 a 4 ms de ~12). La API se llama "unstable". **El módulo trae las dos entradas** y en el paso 1 se miden las dos: después del congelamiento no se puede sumar código nativo, y elegir entre una y otra es solo JS. *(mi decisión)*
- **C. La librería `@azzapp/react-native-skia-video` 0.10.1.** Hace esto mismo (así se confirmó que la técnica anda). Su README se declara beta inestable, la línea para Skia 2 quedó congelada (la 1.0 exige Skia 3 y WebGPU) y trae un reproductor y un decodificador que no usamos.

### Dónde va en la app

- **A. Tercera pieza de "Compartir" — elegido para esta etapa.**
- **B. Dentro del revelado.** La idea original; segunda etapa.
- **C. Pantalla propia "Ver recorrido".** Otra entrada más que explicar; no suma frente a A y B.

## Lo decidido

Lo marcado *(dueño)* lo dijo él. *(mi decisión)* y *(propuesta)* nacieron como ideas mías; el dueño las aprobó junto con el documento.

### Qué rollos y qué fotos

- Rollo **revelado**, de tipo viaje (no evento), **no privado**, cuyas fotos compartibles con ubicación forman **al menos 2 paradas**. Si no, "Recorrido" no aparece. *(mi decisión)*
- Entran solo fotos con `shareable === true` y con GPS. La regla ya la aplica el server (sin videos, archivadas ni momentos). **La ruta también se arma solo con esas fotos**: una parada donde nadie dejó compartir no aparece. *(mi decisión)*
- **Tope de 15 fotos** y **59 s** *(dueño)*. Hasta 4 fotos por parada y hasta 15 paradas.
- La ruta sigue la **secuencia de cada persona** *(dueño: "por secuencia sería lo correcto")*: las fotos se agrupan en lugares y la ruta avanza cuando alguien empieza una visita en otro lugar. Si eso da más paradas de las que entran, cada lugar aparece una vez, en el orden de la primera visita. Es `buildStops` del prototipo.
- **Una sola línea para todo el grupo**, sin colores por persona *(propuesta; la duda era del dueño: "quizás marea")*. **Cada foto lleva la foto de perfil de su autor** (sin foto, el círculo con la inicial y su color, como en el resto de la app), para que se sepa quién la sacó *(dueño, 2026-11-26, al ver el motor en su iPhone)*. No se muestran nombres. Va como un **sello centrado sobre el borde de abajo del papel**, mitad adentro y mitad afuera, de un 11 % del ancho del cuadro (opción D de cuatro maquetas, elegida por el dueño el 2026-11-26); en la hoja de cuatro fotos, uno chico centrado abajo de cada foto. La foto que va sobre el pin se sube y se achica un poco para que el sello no lo pise. Va en el plan del motor.
- De cada parada se eligen las fotos **con más "me gusta"**; si empatan, repartidas en el tiempo. Se muestran en orden cronológico. *(mi decisión; hoy el prototipo solo reparte en el tiempo)*

### Textos del video *(mis decisiones)*

- "Día N" se cuenta desde el inicio del rollo, igual que en la Galería (hoy el prototipo cuenta desde la primera foto).
- El lugar sale del geocodificador de iOS, como los capítulos de la Galería (`gallery/place.ts`), en el idioma del teléfono. Sin nombre, la parada muestra solo el día.
- Los números: **días** del rollo (de inicio a fin), **km** de la ruta que se muestra y **fotos** del rollo entero (el total del resumen), no solo las que entran al video.

### Ubicación *(propuesta)*

Fuera del rollo, hoy una foto nunca muestra su coordenada: en un perfil va como zona de ~5 km (celda de 0,05°). Quien deja compartir sus fotos lo hizo con esa regla, y un video publicado no se puede retirar. El video tiene que respetar lo mismo:

- **La parada se dibuja en el centro de su celda de 0,05°**, la misma grilla de las destacadas, nunca en la coordenada de una foto (hoy el prototipo usa la de la primera foto). Dos paradas seguidas nunca comparten celda.
- Un "lugar" mide como mínimo ~5 km (hoy el prototipo llega a 500 m).
- El mapa no se acerca más que a escala de ciudad (zoom máximo 10: unos 30 km de ancho de cuadro).
- **El título es siempre la ciudad** (y el país si el viaje cruza países). Nunca barrio, calle ni punto de interés (hoy el prototipo baja a eso cuando dos paradas caen en la misma ciudad). Dos paradas pueden llevar el mismo título.

Consecuencias:

- Un rollo que pasa todo dentro de una ciudad no tiene recorrido para compartir.
- En un viaje largo no se nota: en la demo (zoom 6,7) el pin se corre como mucho unos 6 puntos.
- En un viaje de tramos cortos (zoom 10) el pin puede quedar corrido hasta unos 3,5 km, que son unos 60 puntos de los 432 del cuadro, y caer en el agua en un pueblo de costa.

Para el revelado, que solo ven los miembros, nada de esto aplica: son parámetros del corte.

### La pantalla "Compartir"

- En un rollo que tiene recorrido, arriba aparece un control **"Collage | Recorrido"**. Abre en Collage, como hoy. Las entradas no cambian (botón de la barra, Galería, lista). *(propuesta)*
- Para saber si hay recorrido hacen falta todas las páginas del feed (el collage ya las carga): el control aparece cuando terminan de cargar.
- En **Recorrido**:
  - La vista previa reproduce la película en el mismo recuadro 9:16 del collage. Mientras se arma (pide las imágenes del mapa: 14 para la demo, hasta 31) dice "Armando el recorrido…" con avance.
  - **"Otra versión"** sortea otro arreglo de las mismas fotos.
  - No hay selector Oscuro/Claro ni tira de fotos.
  - Botones: **"Compartir en Instagram"**, **"Guardar video"** y **"Más opciones"**.
- Al tocar un destino se exporta, si no está ya exportada esa versión: "Armando el video… 42 %" con **"Cancelar"**. El archivo se reutiliza para los otros destinos mientras no cambie la versión.
- Con "Reducir movimiento" la vista previa no arranca sola: muestra el cuadro final y un botón para reproducir. Compartir funciona igual. *(mi decisión)*
- La vista previa no lleva hápticos ni sonido. *(mi decisión)*
- Errores, como en el resto de la app: texto inline con "Reintentar". Sin conexión el mapa no se puede pedir: "Para armar el recorrido hace falta conexión."

### Cómo llega a cada destino

- **"Guardar video":** a Fotos, con el permiso de solo agregar que la app ya pide, y el HUD "Guardado en Fotos".
- **"Más opciones":** la hoja del sistema con el mp4.
- **"Compartir en Instagram":** depende de la prueba en el iPhone. La documentación de Meta dice que el video de fondo de "Sharing to Stories" es de **hasta 20 s**; no dice qué pasa con uno más largo. La regla:
  1. Si Stories directo acepta el video entero, se usa esa vía, la misma del collage.
  2. Si lo corta o lo rechaza, el botón elige por duración: **hasta 20 s, directo; más largo, guarda el video en Fotos y abre Instagram** (cámara de historias o selector, lo que la prueba muestre que anda), con la nota "Lo guardamos en tus fotos. Elegilo en tu historia." Una historia subida desde el carrete admite 60 s. Un recorrido de dos paradas dura unos 15 s, así que los dos casos existen.
  3. Si el build de desarrollo no puede compartir a Instagram (la app de Meta tiene cargado el bundle de producción), el dueño suma el bundle `com.juanifraga.rollo` a la plataforma iOS de la app de Meta. Si eso no alcanza, Instagram se valida recién en un build de TestFlight.
- **Reels directo** (`instagram-reels://share`, documentado de 3 a 60 s): el build lo deja **preparado sin botón** (el esquema en `LSApplicationQueriesSchemes` y el pegado en el módulo). Prenderlo después es solo JS. *(mi decisión, por el congelamiento de diciembre)*

### La marca y el crédito del mapa

- El cierre lleva "SE REVELÓ", el nombre del rollo y los números.
- **Placa final** *(dueño, 2026-11-26)*: después del cierre, la pantalla pasa a negro con el logo de Rollo y la insignia oficial de la App Store. Solo en el video para compartir, no en el revelado. Reemplaza a la marca chica del cierre. Esto cambia lo que decía el diseño base de Compartir ("sin 'Descargá la app'"), que sigue valiendo para el collage.
  - Dura **2,5 s** y **cuenta dentro de los 59 s**: el recorrido en sí tiene como tope **56,5 s** y el tiempo se recorta de los traslados, como hoy. *(mi decisión)*
  - La insignia es el arte oficial de Apple en español ("Consíguelo en el App Store"), sin modificar y con su margen libre, como piden sus pautas. Va como asset de la app. *(mi decisión)*
  - Bajo el logo va **"Rollo Project"** *(dueño, 2026-11-26)*.
  - Durante la placa no hay mapa, así que el crédito del mapa no se muestra ahí.
- **El video lleva el crédito del mapa, "© OpenStreetMap · OpenFreeMap", durante toda la película.** La licencia lo exige mientras el mapa se ve (`map/roll-map.tsx`). Hoy es un texto de React Native encima del lienzo, así que no saldría en el archivo: pasa a dibujarlo el motor, chico y en una esquina. No es publicidad: no choca con "que no parezca un aviso". *(mi decisión)*

### El video

- H.264 High, 1080×1920, 30 fps, unos **6 Mbps** (59 s ≈ 44 MB; Meta recomienda menos de 50 MB), colores marcados como BT.709, sin pista de audio. *(mi decisión)*
- **Cuadro canónico de 432×768 puntos** para armar la escena, en cualquier iPhone. La vista previa lo escala a su recuadro y la exportación lo dibuja ×2,5. Así los encuadres, los tiempos y las fotos son los mismos en todos los teléfonos. *(mi decisión; el prototipo usa el ancho de la pantalla)*
- **El mapa sí depende de la pantalla.** MapLibre saca cada imagen a la densidad del teléfono (2x o 3x) y su API de JS no deja fijarla. Hoy el prototipo compensa pidiendo menos zoom, y entonces los nombres salen 1,5 veces más grandes en un iPhone 3x que en uno 2x. El look de referencia es el de 3x (casi todos los iPhone desde el 12, y el del dueño; el SE y el 11 son 2x); en uno 2x el mapa puede verse con los nombres más chicos o menos nítido. Se ajusta en el paso 1 mirando el teléfono. El video de la Mac que vio el dueño corresponde al look 2x.
- Las fotos del video exportado salen de la **versión de visualización** (2048 px) **reducida a unos 1200 px** del lado largo, no de la miniatura: una foto vertical de miniatura mide 600 px de ancho y en el encuadre grande ocupa unos 760. Se bajan mientras corre la vista previa, no al tocar un destino. *(mi decisión)*
- **Memoria:** una película usa hasta 31 imágenes del mapa (2 + paradas + saltos lejanos; en unos 3.200 viajes al azar el máximo fue 27) y cada una pesa decenas de MB decodificada. Nunca se usan más de 4 en un cuadro: las que el tramo actual no necesita se sueltan y se vuelven a decodificar cuando hagan falta.
- Un archivo por rollo en el caché (el nuevo pisa al anterior).

## Cómo se hace

### Motor (JS, sale del prototipo)

`src/features/journey/`, con lo del prototipo pasado a código de verdad (TDD, sin los `console.log`):

- `route.ts`: lugares, paradas, reparto de fotos, kilómetros, días, zoom de viaje y tiempos (`buildStops`, `buildTimeline`). Puro.
- `engine/model.ts` (contrato), `engine/scene.ts` (`buildScene`, `frameAt`; puro), `engine/draw.ts` (Skia), `engine/assets.ts` (imágenes del mapa, fotos, textos).
- El reproductor en pantalla y `export-film.ts`.
- **No se porta** la primera versión con mapa en vivo (`journey-player.tsx`, `journey-map.tsx`, `route-line.tsx`, `stop-pin.tsx`, `print-card.tsx`) ni la fila de prueba de compartir.

Las comprobaciones que hoy corren a mano pasan a Jest: sobre viajes al azar, ninguna película pasa de 59 s, el mapa siempre cubre el cuadro, ninguna copia sale del cuadro, ninguna parada repite el encuadre de la anterior, y cada imagen del mapa se nombra antes de usarse.

### Exportar

`export-film.ts` corre en el **hilo de JS**, por tandas, para que el avance y "Cancelar" respondan:

1. Una superficie fuera de pantalla de 1080×1920 (`Skia.Surface.MakeOffscreen`), una sola para toda la exportación.
2. Por cada cuadro `i`: `frameAt(scene, i * 1000 / 30)` → `drawFrame` con la escala ×2,5 → leer los píxeles (BGRA) en un `Uint8Array` que se reutiliza → `append` al módulo. La imagen intermedia se libera antes de dibujar el cuadro siguiente.
3. Cada pocos cuadros se devuelve el control para actualizar el avance y ver si se canceló.
4. Al terminar, `finish()` devuelve el archivo. Al cancelar o fallar, `cancel()` borra lo escrito.

Reglas:

- **Mientras exporta, la vista previa no dibuja** y la exportación arma sus propios textos (`layoutTexts`): los párrafos de Skia no se comparten entre dos hilos que dibujan a la vez.
- Las imágenes del mapa son las que ya cargó la vista previa. Las fotos para exportar (la visualización reducida) se bajan mientras corre la vista previa; si al tocar un destino falta alguna, se espera dentro del mismo avance.
- **Segundo plano:** iOS no deja usar la GPU con la app en segundo plano. Al salir de primer plano la exportación se frena; al volver sigue, y si el codificador quedó en error empieza de nuevo sola.

### Módulo nativo `modules/rollo-video` (Swift, módulo local de Expo como `rollo-symbol`)

Genérico, para que después alcance con cambiar JS:

- `open({ uri, width, height, fps, bitrate })`: una sesión a la vez.
- `append(pixels: Uint8Array, bytesPerRow)`: BGRA premultiplicado, de arriba hacia abajo. Copia a un buffer del pool del codificador y lo agrega con su tiempo (`cuadro / fps`). Si el codificador está ocupado espera; pasado un tope, falla.
- `appendTexture(pointer)`: lo mismo leyendo la textura de Metal de la superficie (enfoque B), para poder elegir desde JS.
- `finish()`: promesa con `{ uri, bytes, frames }`.
- `cancel()`: corta y borra el archivo.
- `shareToInstagram({ target: "stories" | "reels", videoUri, appId })`: pega el video con las claves que documenta Meta y abre Instagram.

El envoltorio de JS usa `requireOptionalNativeModule`: en un build sin el módulo, `available` es falso y "Recorrido" no aparece.

### Lo que ya se sabe

Leído en el código de `@shopify/react-native-skia` 2.14.0 (la versión instalada):

- `Skia.Surface.MakeOffscreen` crea una textura BGRA con el contexto de Metal **del hilo que lo llama** (`thread_local`), así que anda en el hilo de JS. Ya lo usan `renderCollageCard` y el QR.
- `image.readPixels(x, y, info, dest)` acepta un arreglo de destino (cuarto argumento, `cpp/api/JsiSkImage.h`): no hay que crear uno por cuadro. El tipo de TypeScript no lo declara; hay que castear.
- `surface.flush(true)` espera a la GPU y existe justamente para que código nativo lea la textura (enfoque B).
- `Skia.NativeBuffer.MakeFromImage` no sirve acá: copia de más y crea una superficie nueva por cuadro.

Medido fuera del teléfono:

- Con el mismo `scene.ts` y `draw.ts` corriendo en Node sobre CanvasKit: 204 viajes cuadro por cuadro sin huecos ni bordes en el mapa y sin películas de más de 59 s, también con el cuadro canónico de 432×768; la demo completa dibujada a 1080×1920.
- El núcleo del codificador (el Swift de `AVAssetWriter` con buffers BGRA, tal como iría en el módulo) corrió en una Mac M2 Pro con los 1.226 cuadros de la demo: sale un mp4 H.264 High de 1080×1920 a 30 fps, 40,9 s, 28 MB (5,5 Mbps), marcado BT.709, con los colores bien. Codificar llevó 1,9 ms por cuadro. **El codificador no es el cuello de botella**: el tiempo lo va a poner Skia (dibujar y leer cada cuadro).
- En el SDK 27 esa API (`AVAssetWriterInputPixelBufferAdaptor`, `startWriting`, `isReadyForMoreMediaData`) figura como deprecada a favor de una asíncrona nueva. Sigue andando y es la única que existe antes de iOS 27, así que el módulo la usa (con avisos del compilador).

**No medido:** el motor nunca corrió en un iPhone. Fluidez, tiempo de carga de las imágenes del mapa, memoria y velocidad de exportación son estimaciones (unos 10–15 ms por cuadro: entre 12 y 18 s para la demo). Solo se puede medir en el iPhone del dueño: en teléfonos más viejos o de pantalla 2x queda sin probar hasta TestFlight. Si ahí falla, un update de JS puede esconder "Recorrido".

**La demo del Reel** (el JSON, las fotos, los videos de prueba de 19 y 41 s, y los scripts que dibujan la película en la Mac) no está en ningún repo, porque son fotos personales y el repo es público. Vive en `~/Desktop/Rollo/.superpowers/recorrido-demo/` y se sirve por la red local: la app la lee de `EXPO_PUBLIC_JOURNEY_FIXTURE_URL`.

## Primera corrida del motor en el iPhone (2026-11-26)

iPhone 15 Pro Max, build 1.5.0 instalado, demo del Reel (8 paradas, 14 imágenes del mapa):

- Todo cargado en **1,8 s** (las 14 imágenes del mapa y las 11 fotos; 245 MB decodificados).
- **120 cuadros por segundo** sostenidos; armar cada cuadro lleva 0,2 a 0,6 ms.
- Un solo tirón, de 67 ms, a los 4 s (la primera parada). El resto, entre 8 y 19 ms.
- "Otra versión" reutiliza las 14 imágenes: vuelve a arrancar en 12 ms.

Lo que pidió el dueño al verlo: un botón de cerrar a la vista durante la película (o cerrar deslizando hacia abajo) y la foto de perfil del autor en cada foto.

## Pendiente de probar en el iPhone del dueño

1. **El motor en pantalla** (Ajustes → Desarrollo → "Motor propio · demo del Reel"): fluidez, carga y memoria. Los números salen en Metro (`[engine]`).
2. **Las vías a Instagram** (fila "Probar compartir video", con videos de 19 y 41 s): Stories directo con cada uno, la hoja del sistema, y guardar + abrir Instagram. Define el botón "Compartir en Instagram". También dice si el App ID de Meta anda en modo Development con el build de desarrollo.

## Orden de trabajo

1. **Módulo nativo y exportación de la demo en el dev build.** Mide la velocidad real por etapa (dibujar, leer, codificar) con las dos entradas del módulo y se queda con la mejor. Si igual pasa de 30 s, se le llevan los números al dueño con las salidas que son solo JS: 24 cuadros por segundo o 720p. Reels directo se prueba acá.
2. Motor a código de verdad, con sus tests.
3. "Recorrido" en la pantalla "Compartir".
4. Build de producción con el módulo. Lo que falte de 2 y 3 puede salir por update.

## Requisitos

- Cambio nativo: `version` pasa a **1.6.0**, `npx expo prebuild --clean` y rebuild de Rollo Dev en el iPhone del dueño (con su visto bueno) y después build de EAS.
- `instagram-reels` en `LSApplicationQueriesSchemes` de `app.json`.
- Sin dependencias de npm nuevas.
- La app de Meta tiene que estar en modo **Live** para que comparta gente que no es admin ni tester de esa app. Vale también para el collage.
- Privacidad y quién ve "Compartir" no cambian respecto del diseño base.

## Lo que queda para quien lo construya

- El tamaño de cada tanda y cómo se devuelve el control.
- Cómo espera `append` al codificador y cuánto.
- El nombre exacto del archivo y cuándo se borra.
- El diseño fino del avance y del estado "Armando el recorrido…".
- Qué pasa si faltan una o dos imágenes del mapa (hoy el prototipo reintenta una vez).
- La densidad de las imágenes del mapa en un iPhone 2x, para que el mapa quieto no se vea blando a 1080 px.
- Cómo se sueltan y se vuelven a decodificar las imágenes del mapa, y cuántas fotos quedan en memoria a la vez.
- Dónde va exactamente la marca en el cierre.
