# Compartir en Stories: fondo animado y estilos — diseño

Fecha: 2026-11-26 · Estado: aprobado por el dueño (2026-11-26). Se construye sobre `feature/compartir-en-stories` (diseño base: `2026-11-25-compartir-en-stories-design.md`).

## Para qué

Que la story se vea más viva, **como cuando se comparte desde Spotify**: las fotos quedan quietas y el fondo se mueve. Además, al compartir, la persona elige el estilo (claro u oscuro).

## Qué cambia

- **Fondo animado:** un video corto en loop (unos 8 s) con un **degradé que se mueve lento**. Es la opción "A · Degradé que respira", que eligió el dueño. Maqueta en `.superpowers/brainstorm/64986-1795611471/content/fondos-v1.html` (raíz de Rollo).
  - **Oscuro:** sobre negro `#0b0b0c`, con cobalto oscuro (`#1b2a6b`) y violeta oscuro (`#3a1b4f`).
  - **Claro:** sobre crema `#f3efe8`, con celeste `#cfd9ff`, durazno `#f6e7d8` y lila `#e9e4ff`.
- **Las fotos como tarjeta (sticker):** el collage (mosaico B) y la invitación pasan a ser una **tarjeta** con esquinas redondeadas.
  - En oscuro, el fondo de la tarjeta es `#141416` con texto blanco; en claro, `#fbfaf7` con texto casi negro.
  - Lleva lo mismo que hoy: la línea chica, el nombre, el mosaico (o, en la invitación, la portada o los colores con el código) y la marca chica.
  - En Instagram, la persona puede moverla y achicarla, igual que la tapa en Spotify.
- **Las dos piezas** (collage e invitación) usan el mismo fondo y el mismo estilo. *(propuesta aprobada)*
- **Estilos:** Oscuro (por defecto) y Claro. Agregar otro estilo después es sumar un video y sus colores.

## Pantalla "Compartir"

- Arriba, la **vista previa en movimiento**: el video de fondo en loop (`expo-video`, sin sonido) con la tarjeta encima, en 9:16.
- Debajo, un selector **Oscuro | Claro** (control segmentado nativo, como "Galería | Rollo"). Cambiarlo cambia la vista previa al instante.
- Los botones siguen como están: "Compartir en Stories", "Más opciones" y "Otras" (este último solo en el collage).

## Cómo llega a Instagram

- **"Compartir en Stories":** `react-native-share` con `backgroundVideo` (el mp4 del estilo) y `stickerImage` (la tarjeta en PNG transparente). Instagram junta las dos cosas, como hace Spotify.
  - Se mantiene el patch del link para la invitación (`linkText` también como `public.utf8-plain-text`).
  - Hay que verificar en el iPhone que el patch funcione igual con video de fondo.
- **"Más opciones"** (WhatsApp, guardar…): no hay forma de mandar video más sticker, eso solo lo arma Instagram. Se manda la **imagen fija de 1080×1920**: la tarjeta sobre un cuadro del degradé, en el estilo elegido. Reemplaza al fondo negro de hoy.

## Cómo se hace

Los dos videos de fondo se generan **una sola vez** y van **dentro de la app** como assets (mp4 H.264, 1080×1920, ~8 s, loop sin corte, sin audio, lo más livianos posible, idealmente menos de 1–2 MB cada uno). Se pueden generar con Remotion (ya se usa en `rollo-app/web` para el video del sitio) o con ffmpeg. El script que los genera queda en el repo, como `npm run icons` o `npm run lottie`.

Descartado:
- **Generar el video en el iPhone:** no hace falta, porque el fondo es igual para todos los rollos, y es lo más caro (la app no tiene encoder).
- **Los colores fijos de Instagram** (`backgroundTopColor`/`BottomColor`): no se mueven.

## No objetivos

- Fondos que dependen de cada rollo (opción D).
- Más de dos estilos por ahora.
- Audio.

## Lo que no puede pasar

- Que "Más opciones" se rompa o mande algo vacío.
- Que el tamaño de la app suba de forma notable.
- Que la vista previa se trabe: el video tiene que reproducirse fluido en loop.

## Requisitos

- Sin dependencias nativas nuevas (`expo-video` ya está). Sigue haciendo falta el build nuevo de la rama base (1.5.0).
- Los textos, las reglas de privacidad y quién ve cada botón no cambian respecto del diseño base.

## Lo que queda para quien lo construya

- El tamaño y la posición exactos de la tarjeta dentro del sticker (que se vea bien a la escala por defecto con la que Instagram coloca un sticker).
- Cómo se genera el loop sin corte.
- El texto exacto del selector, si hace falta algo más que "Oscuro" / "Claro".
