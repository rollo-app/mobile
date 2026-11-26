# La hoja de contacto en video — diseño

Fecha: 2026-11-26 · Estado: **borrador**. El dueño eligió el concepto y vio un prototipo dibujado en la Mac; falta que lo vea en su iPhone y apruebe este documento.

Es el video para los rollos **sin recorrido**. Se apoya en `2026-11-26-recorrido-en-video-design.md`: mismo motor, misma exportación, mismos destinos.

## Para qué

Que un rollo que pasa en un solo lugar también tenga un video para compartir. El dueño lo pidió genérico: "que le sirva a mi primo en su casamiento o que sirva para un evento empresarial de fin de año". Muchos invitados, una sola noche, sin mapa que contar.

## Qué se comparte

Un video vertical de 1080×1920, 30 cuadros por segundo, de hasta 59 s (unos 35 a 45 s con 12 destacadas), sin sonido:

1. **Portada:** la hoja de contacto entera con los cuadros en gris, el nombre del rollo y la fecha.
2. **Revelado:** los cuadros pasan de gris a foto en orden de hora, como una ola.
3. **Destacadas:** la cámara se acerca a cada una hasta que llena el cuadro, con la hora arriba ("23:40") y el sello del autor centrado en el borde de abajo. Pasa de una a otra deslizándose por la hoja; las demás quedan atenuadas.
4. **Cierre:** la hoja completa ya revelada, con el nombre y los totales ("214 fotos · 86 personas").
5. **Placa final:** la misma del recorrido (logo, "Rollo Project", insignia de la App Store), 2,5 s.

## Objetivos

- Que sirva igual para un casamiento que para un evento de empresa: texto neutro, nada que dependa de quién aparece.
- Que compartir siga siendo un toque: la app arma la hoja y elige las destacadas.
- Reutilizar lo del recorrido: efecto de revelado, sello del autor, placa final, exportar, Instagram directo, "Guardar video", "Más opciones".

## No objetivos

- Mostrar votos, "me gusta" o quién ganó el concurso. Una versión "con la ganadora" sería un agregado aparte, solo con el concurso cerrado.
- Presentar a la gente (un video por persona).
- Sonido, estilo claro, Android.

## Lo que no puede pasar

- **Que el video diga o deje entender quién va ganando.** Se puede generar antes de que termine la votación *(dueño)*. Ningún texto, orden ni énfasis sale de los votos.
- Que aparezca, aunque sea en miniatura, una foto que su autor no deja compartir o que el usuario sacó.
- Que la hoja se rellene sola con una foto que el usuario sacó.
- Lo mismo que en el recorrido: sin videos cortados, sin trabar la app, hasta 59 s y 50 MB.

## Enfoques considerados

- **A. La tira del rollo:** una tira de negativos avanza y cada cuadro se revela al llegar al centro. Era la recomendación: más identidad y movimiento continuo.
- **B. La hora en grande:** el reloj arriba y las fotos de a una. Lo más barato, pero se ve como el recorrido sin mapa.
- **C. La hoja de contacto — elegida por el dueño.** Muestra de un vistazo todo lo que se sacó y después se acerca a lo mejor.

Dos dudas de C y cómo se resolvieron:
- Con pocas fotos elegidas la grilla quedaba pobre: la hoja muestra muchas (hasta 30) y las destacadas son pocas (hasta 12).
- En la grilla las fotos se ven chicas: cada destacada se ve a cuadro completo cuando la cámara llega.

## Lo decidido

### Cuándo se usa *(dueño)*

Sola, cuando el rollo no tiene recorrido para compartir: no llega a 2 paradas con la regla de zonas de ~5 km (eventos, rollos en una ciudad, fotos sin ubicación). Nadie lo elige: en Compartir la segunda pieza se llama "Recorrido" si hay recorrido y, si no, es esta. *(el nombre visible de esta pieza queda para definir)*

### Qué fotos

- Solo `shareable`, de tipo foto, no archivadas. No hace falta ubicación. Rollo revelado y no privado; **vale también para eventos**.
- **La hoja:** hasta 30 fotos. **Destacadas:** hasta 12.
- Tres estados por foto, en la pantalla de elegir *(dueño: "cuáles no aparecen ni en miniatura, por las dudas")*:
  - **Destacada:** la cámara se acerca.
  - **En la hoja:** solo miniatura.
  - **Fuera:** no aparece en ningún lado.
- Un toque rota el estado: en la hoja → destacada → fuera → en la hoja. La destacada lleva el aro cobalto; la que quedó fuera va atenuada y con una marca. Arriba, un contador: "8 destacadas · 22 en la hoja".
- **Arranca llena** *(dueño)*: la app arma la hoja y elige las destacadas; el usuario saca lo que no quiere.
- Lo que el usuario sacó no vuelve solo. Si quedan lugares, entran otras fotos disponibles que él no tocó.
- La selección vive en memoria mientras la app está abierta, como la del collage.

### Orden y selección inicial

- Todo va en orden de hora: la hoja y las destacadas.
- La selección inicial usa los "me gusta" solo para elegir (las 30 con más, y de esas las 12 con más como destacadas), y se muestra por hora, así no se nota cuál tiene más. Empates: por hora. *(mi decisión)*
- Todas las destacadas reciben el mismo trato: mismo tiempo, mismo tamaño.
- Los votos del concurso no se usan.

### La hoja *(mis decisiones)*

- Fondo oscuro. Cuadros 3:4 con 5 puntos de separación y 20 de margen lateral.
- Columnas según la cantidad: hasta 12 fotos, 3; hasta 20, 4; más, 5. Siempre filas completas: si sobran fotos para llenar la grilla, quedan fuera las últimas no destacadas.
- Sin números de cuadro.

### Textos *(mis decisiones)*

- Portada: nombre del rollo y la fecha ("12 de diciembre"; un rango si dura varios días).
- Sobre cada destacada: la hora ("23:40") y, debajo, el nombre del rollo. Si las fotos abarcan más de un día, "Día 2 · 23:40". La hora es la del rollo, en su zona horaria.
- Cierre: nombre y "214 fotos · 86 personas" (los totales del rollo).
- Nada de "fiesta", "noche" ni similares.

### Tiempos *(mis decisiones)*

Portada 1,8 s · revelado 2,5 s · cada destacada: 0,8 s de traslado y 2,6 s quieta, con un acercamiento lento del 5 % · vuelta a la hoja 1,5 s · cierre 2,6 s · placa final 2,5 s. Si pasara de 59 s, se acortan las pausas por igual.

### Lo que hereda del recorrido

Sin tinte rojo, sello del autor al 11,5 % del ancho, placa final, crédito del mapa **no** (no hay mapa), exportación a 1080×1920 con avance y "Cancelar", Instagram directo a Stories, "Guardar video", "Más opciones", el arreglo no se elige, sin sonido ni hápticos.

## Cómo se hace

- Otra escena sobre el mismo esquema: `buildSheetScene` y `sheetFrameAt` (puros) y `drawSheetFrame` (Skia), en `src/features/journey/sheet/`. El reproductor, la exportación y `journey-share.tsx` pasan a aceptar cualquiera de las dos películas.
- No usa MapLibre ni geocodificación: carga más rápido y anda sin conexión si las fotos ya están en caché.
- Prototipo: `src/features/journey-spike/sheet/` (sin commitear).

## Lo que queda para quien lo construya

- El nombre visible de la pieza en el control de Compartir.
- El diseño fino de la pantalla de elegir con tres estados.
- Qué se hace con una sola foto compartible, o con ninguna destacada (el prototipo acepta cero: portada, revelado, cierre).
