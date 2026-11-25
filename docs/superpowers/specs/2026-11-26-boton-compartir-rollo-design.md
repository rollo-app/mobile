# Botón "Compartir" del rollo — diseño

Fecha: 2026-11-26 · Estado: propuesta para aprobar. Se construye sobre `feature/compartir-en-stories`.

## Qué cambia

1. **"Compartir en Stories" pasa a ser "Compartir en Instagram"**, con el logo de Instagram (botón principal de la pantalla "Compartir" y del QR). La acción no cambia: abre el editor de historias de Instagram.
2. **Se sacan las filas "Compartir en Stories"** del segmento "Rollo" (collage) y de "Invitar" (invitación).
3. **Botón clásico de compartir** (`square.and.arrow.up`) en la barra del rollo, al lado del engranaje de "Ajustes del rollo": en el tablero y en el segmento "Rollo" del revelado. Al tocarlo se abre un **modal "Compartir"** (sheet que se ajusta al contenido, como las hojas de los botones "i") con estas opciones, cada una con su ícono:
   - **Antes del revelado** (invitación), mientras el rollo no esté lleno (`canShareInvite`):
     - **Copiar link** (ícono `link`): copia `rolloproject.com/join/CÓDIGO` y muestra el HUD nativo "Link copiado" (`burnt`, sin toasts propios).
     - **WhatsApp** (logo de WhatsApp): abre WhatsApp con el texto de invitación de hoy (`whatsapp://send?text=…`). Si WhatsApp no está instalado, no aparece.
     - **Instagram** (logo de Instagram): abre la pantalla "Compartir" de la invitación (vista previa, Oscuro/Claro, "Compartir en Instagram").
   - **Después del revelado** (collage), si el rollo no es privado y tiene fotos compartibles:
     - **Copiar link**: no aparece (a un rollo revelado no se entra).
     - **WhatsApp**: abre WhatsApp con la imagen del collage (la imagen fija de 1080×1920 en estilo Oscuro), usando `react-native-share` (`Social.WHATSAPP`). Si WhatsApp no está instalado, no aparece.
     - **Instagram**: abre la pantalla "Compartir" del collage.
   - Si no hay nada para compartir, el botón no aparece.
4. **Logos:** las marcas oficiales de Instagram y WhatsApp en PNG `@1x/@2x/@3x` en `assets/`, sin recolorear, igual que hoy el "G" de Google (`assets/google-g*.png`).

## Lo que no cambia

- La pantalla "Compartir" (vista previa, estilos, "Más opciones", "Otras").
- Quién puede compartir qué, y las reglas de privacidad.
- Tocar el código en "Invitar" sigue abriendo el menú de compartir del sistema.

## Enfoques

Hay uno solo sensato: un modal propio (sheet de Expo Router) con filas, porque el menú del sistema no deja poner logos propios ni ordenar opciones, y un menú contextual nativo (`MenuView`) no muestra logos de marca a color.

## Requisitos

- `app.json`: sumar `whatsapp` a `LSApplicationQueriesSchemes`. Es nativo, pero entra en el build 1.5.0 que ya hay que hacer.
- Ruta nueva `/share-roll?tripId=…` registrada en `app/_layout.tsx` y `src/test/routes.ts`.

## Para quien lo construya

- La forma exacta de las filas (alto, tamaño del logo), dentro del estilo nativo de la app (`Section` / `Row`).
- Cómo sale la imagen para WhatsApp: se reutiliza el armado de la tarjeta y la imagen fija que ya existe.
