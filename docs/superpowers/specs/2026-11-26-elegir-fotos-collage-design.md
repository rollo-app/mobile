# Elegir las fotos del collage — diseño

Fecha: 2026-11-26 · Estado: propuesta para aprobar. Se construye sobre `feature/compartir-en-stories`.

## Para qué

Hoy el collage que se comparte en Instagram (y por WhatsApp) toma hasta 8 fotos al azar entre las que se pueden compartir. La persona quiere **elegir cuáles van y cuál va grande**.

## Qué cambia

- En la pantalla "Compartir" del collage, el botón **"Otras" se reemplaza por "Elegir fotos"**.
- "Elegir fotos" abre una pantalla con una **grilla** (3 columnas, miniaturas cuadradas) con **solo las fotos que se pueden compartir** (`collageCandidates`), de la más vieja a la más nueva, como la Galería.
  - Tocar una foto la marca con un **número** (1, 2, 3…) en un círculo cobalto arriba a la derecha. Tocarla de nuevo la desmarca, y las que siguen se renumeran.
  - **La 1 va grande** en el mosaico. El resto va en el orden de los números.
  - **Máximo 8.** Con 8 marcadas, tocar otra no hace nada más que un háptico suave. El encabezado dice "3 de 8".
  - "Listo" vuelve a la vista previa, que se arma con esas fotos en ese orden. "Cancelar" vuelve sin cambios.
  - Si no marca ninguna y toca "Listo", el collage vuelve a salir al azar, como hoy.
- **WhatsApp** (desde el modal "Compartir") manda el collage con la misma selección, si la hay.
- La selección dura mientras la app está abierta (por rollo). No se guarda en el celular.

## Lo que no cambia

- Qué fotos se pueden compartir (`shareable`).
- Los estilos, la vista previa con video, "Compartir en Instagram", "Más opciones".
- La invitación (no tiene fotos para elegir).

## Enfoques

Una sola forma sensata: una pantalla propia con grilla, como la selección de la Galería. Un selector del sistema (`expo-image-picker`) muestra el carrete del iPhone, no las fotos del rollo.

## Detalles para quien lo construya (decisiones mías)

- Ruta `/share-pick?tripId=…` presentada como modal (`presentation: "modal"`), con "Cancelar" a la izquierda y "Listo" a la derecha en la barra, título "Elegir fotos" y el contador "N de 8" como subtítulo o debajo.
- La grilla va con **FlashList v2** (un rollo puede tener cientos de fotos; regla de CLAUDE.md), celdas con `memo` y miniaturas con `expo-image` (`thumbPath` con el token, como la Galería).
- La selección vive en un store chico en memoria por `tripId` (`useSyncExternalStore`), fuera del cache persistido.
- Si una foto elegida deja de ser compartible (por ejemplo, su autor la bloqueó), se omite al armar.
- Accesibilidad: cada celda es un botón con "Foto N de M, elegida 2" / "no elegida".
