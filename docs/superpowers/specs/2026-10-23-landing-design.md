# Landing de Rollo — diseño

Fecha: 2026-10-23. Acordado con el dueño en una charla de diseño (con maquetas). Lo marcado *(decisión de Claude)* lo puede
cambiar el dueño. Antes de implementarlo, pasar por un plan (`docs/superpowers/plans/`) como el resto.

## Por qué

`rollo.juanifraga.com` hoy es una página de texto: logo, una frase, "Cómo funciona" en 3 pasos y el soporte. No tiene imágenes,
ni botón para bajar la app, ni dice claramente que es solo para iPhone. La app ya está en TestFlight con link público y en
revisión para la App Store: hace falta una landing que **dé ganas de bajarla y estrenarla con amigos en el próximo viaje o
evento**.

La idea a transmitir, en palabras del dueño: inmortalizar momentos con amigos (un casamiento, un viaje). Sacás la foto en el
momento **sin estar pendiente de cómo salió ni de lo que saca cada uno**; después del evento se revela todo junto y ahí
apreciás **el punto de vista de cada uno**. Además tiene un lado de red social: en tu perfil destacás fotos de rollos pasados,
incluso fotos que sacaron tus amigos en rollos que compartieron.

## Objetivos, no objetivos y anti-objetivos

- **Objetivo:** que alguien que entra (muchas veces desde un link que le pasó un amigo, en el celular) entienda en segundos qué
  es Rollo y toque "Probar la beta en iPhone".
- **Objetivo:** que se entienda que es **solo para iPhone**.
- **No objetivo:** el video de onboarding. Se hace aparte (ver "Video"); la landing no lo espera.
- **No objetivo:** versión en inglés, blog, prensa, precios, Android.
- **Anti-objetivo:** que parezca hecha con IA (degradés genéricos, cards por todos lados, íconos en círculos de colores, "todo
  grande", emojis). Es la misma regla que la app: sobria, nativa, con la personalidad en pocos detalles.
- **Anti-objetivo:** mostrar una app que no es la real (por eso nada de levantar la app de Expo en web para grabarla).
- **Anti-objetivo:** que la página le haga pedidos a terceros (analytics, fuentes de Google, CDNs). Hoy no hace ninguno y la
  política de privacidad se apoya en eso.

## Lo decidido

### Dirección visual: "Papel" (elegida entre tres maquetas)

- Fondo papel `#F2F0EB` en claro y `#0E0F14` en oscuro, se adapta solo (`prefers-color-scheme`), como el sitio actual.
- **Cobalto** como único acento (`#3155F5` claro / `#5C7CFF` oscuro), con la misma regla de la app: solo en acciones (botones,
  links) y lo seleccionado, nunca de relleno.
- Titulares en la **serif del sistema** (`ui-serif, "New York", Georgia, serif`); el resto en la del sistema (`-apple-system`).
  Sin fuentes descargadas.
- Logo "Revelado" (los tres círculos, ya está en `scripts/build-site.mjs`).
- "Fotos" sin revelar = manchas difusas de color, como el ThumbHash que muestra la app antes del revelado.

### Las 7 secciones de la home (aprobadas, en este orden)

Siguen el orden en que se vive un rollo.

1. **Primera pantalla.** Logo + "Rollo" arriba. A la izquierda: titular en serif (borrador: **"Sacá la foto. Mirala
   después."**), una línea que explica la idea (borrador: "Un rollo compartido para tu próximo viaje con amigos. Nadie ve las
   fotos hasta el revelado, y ahí descubrís cómo lo vivió cada uno."), el botón y debajo **"Solo para iPhone · Gratis"**. A la
   derecha: un iPhone con la hoja del rollo sin revelar (manchas). En el celular el iPhone va debajo del texto.
2. **Cómo funciona.** Tres pasos cortos: abrís un rollo y sumás a tus amigos con un código; cada uno saca fotos sin verlas;
   al final se revelan todas juntas. Acá va después el **video de onboarding**; mientras tanto, tres pantallas.
3. **Mientras dura el rollo: el mapa.** Pins de quién sacó una foto y dónde, con las fotos todavía difusas, y el feed ("Cami sacó
   una foto · 14:32"). Con **"Funciona sin señal"**: las fotos se guardan y se suben solas cuando vuelve la señal, y el mapa se
   baja antes. Es lo que la diferencia de un álbum compartido en un viaje.
4. **El revelado.** La sección más emotiva: fotos que pasan de borrosas (y en sepia) a nítidas mientras scrolleás, como la
   animación del revelado de la app; después la presentación tipo historias.
5. **Tu perfil.** Destacás tus fotos favoritas de rollos pasados, también las que sacaron tus amigos, con su mapa por zonas.
6. **Privado.** Una línea: un rollo solo lo ven quienes están en él.
7. **Cierre.** Repite el botón y "Solo para iPhone", más un link a soporte.

Los textos de cada sección los escribe el builder siguiendo la voz de la app *(decisión de Claude)*: rioplatense con voseo
("Sacá", "Sumá"), corto, sin signos de exclamación ni marketing inflado. Los textos definitivos se revisan con el dueño.

### El botón principal

- Lleva al link público de TestFlight: **https://testflight.apple.com/join/Q557gZkR**, con el texto **"Probar la beta en
  iPhone"**.
- Cuando Apple apruebe la app, se cambia por el **badge oficial "Descargar en el App Store"** y se saca la palabra "beta" en
  toda la página *(decisión de Claude)*. Que sea un cambio de una línea: el link y el modo (beta / App Store) en una constante
  arriba de `build-site.mjs`.
- No se juntan emails.

### Imágenes (hasta tener screenshots y video)

- Mientras no haya screenshots, las pantallas son **maquetas en HTML/CSS** dentro de un marco de iPhone (manchas difusas, pins,
  filas del feed), no imágenes inventadas que parezcan screenshots *(decisión de Claude)*.
- Cuando estén, se reemplazan por screenshots reales del Simulador (ver "Video"), en WebP/AVIF con `width`/`height` para que no
  salte el layout, y `alt` en español.
- Cada lugar de imagen tiene que poder recibir un screenshot o un video sin rediseñar la sección.

### Movimiento (Motion)

- Se usa **Motion** (motion.dev) en su versión para JavaScript común (el sitio es HTML estático, sin React).
- **Va servida desde el propio sitio**, copiada a `site/dist` al hacer el build, nunca desde un CDN *(decisión de Claude)*.
- Poco y con sentido: la entrada suave de las secciones al aparecer, y en "El revelado" el paso de borroso/sepia a nítido atado
  al scroll. Nada que se mueva solo en loop.
- Con **"Reducir movimiento"**: sin animaciones, todo en su estado final (fotos nítidas). Sin JavaScript: la página se ve completa
  y estática.

### Soporte y el resto del sitio

- El soporte y las preguntas frecuentes se mudan a **`/soporte`** (mismo contenido que hoy en la home). La home queda solo para
  vender la app y tiene un link a soporte en el cierre y en el pie.
- Hay que **cambiar la URL de soporte en App Store Connect** a `https://rollo.juanifraga.com/soporte` (lo hace el dueño). El
  link viejo `/#soporte` no se puede redirigir desde el server *(decisión de Claude: dejar en la home un `id="soporte"` en el
  link a soporte del pie, así ese ancla sigue llevando a algo)*.
- `/privacidad`, `/terminos`, `/entrar` y `404` no cambian. **`/entrar` no carga Motion ni nada nuevo** y mantiene su CSP.
- Todo sigue armándose con `scripts/build-site.mjs` (`npm run site:build` / `npm run site:deploy`, Cloudflare Workers).

### Para compartir el link *(decisión de Claude)*

Como la landing se pasa mucho por WhatsApp, lleva Open Graph: `og:title`, `og:description` y una **imagen de 1200×630** (logo +
titular sobre papel) servida desde el sitio, más `<meta name="theme-color">` en claro y oscuro.

## Video (trabajo aparte, no bloquea la landing)

- Grabar la **app real en el Simulador de iOS** (`xcrun simctl io booted recordVideo`) con el seed del backend local (rollo
  revelado de Bariloche, amigos, destacadas); lo de la cámara, en el iPhone (el simulador no tiene cámara).
- Armarlo con **Remotion**: los clips dentro de un marco de iPhone, textos cortos en la serif y el cobalto.
- Del mismo material salen los screenshots de la landing y de la ficha del App Store.

## Herramientas para el diseño

- Skill **`ui-ux-pro-max`** (instalada en `~/.claude/skills/`) y `frontend-design` para revisar layout, accesibilidad y
  movimiento. La identidad de Rollo (colores, serif, logo, la regla del cobalto) manda sobre cualquier paleta o tipografía que
  sugieran.

## Requisitos de calidad

- Mobile first: se ve bien desde 360 px, gutter de 16 px, sin scroll horizontal.
- Contraste AA, foco visible, el botón de al menos 44 px de alto, `lang="es"`.
- Liviana: sin frameworks; Motion es el único JS de la home.
- Se prueba en Safari de iPhone (claro y oscuro) y en escritorio.

## Detalles técnicos ya resueltos *(decisiones de Claude, tras la revisión)*

- **Headers:** el Worker `rollo-site` solo sirve archivos (`site/wrangler.jsonc`, sin `_headers`); la home no tiene CSP y puede
  llevar su `<style>` inline y un `<script>` propio. `/entrar` conserva su CSP por meta y su CSS no cambia.
- **Motion:** el build completo de JavaScript común (con `animate` y `scroll`), ~20 KB, es aceptable; no se usa `motion/mini`
  porque el revelado necesita animación atada al scroll. Nada de `animation-timeline` de CSS (Safari de iPhone no lo garantiza).
- **Navegadores:** Safari de iOS 17 en adelante y navegadores de escritorio actuales. En versiones viejas alcanza con que se vea
  estático y completo.
- **Sin flash:** el HTML trae las fotos nítidas (estado final). Un script mínimo en el `<head>` agrega una clase (`js-motion`) en
  `<html>` antes del primer pintado, solo si hay JS y no está "Reducir movimiento"; esa clase pone el estado borroso inicial.
- **Maquetas:** estilizadas y en la paleta papel, que se reconozcan como la app sin imitar un screenshot. El mapa es un mapa
  abstracto (tierra, agua, un par de rutas) con pins de iniciales como los de la app, no una copia de MapLibre.
- **"Gratis":** confirmado por el dueño. "Beta" sale solo del modo `beta | appstore` de la constante del build.
- **Badge del App Store:** lo pone el dueño (el SVG oficial de Apple Marketing Resources) en el repo cuando la app esté aprobada;
  hasta entonces el modo `appstore` no se usa. No se inventa un badge.
- **Imagen de Open Graph:** PNG de 1200×630 hecho una vez y commiteado (WhatsApp no muestra SVG); sin generarlo en el build.
- **URL base:** una constante `https://rollo.juanifraga.com` para `og:image` y `canonical`. No hay staging. Nada nuevo lleva
  `noindex` (solo `/entrar`, como ahora).
- **`/soporte`:** el título "Soporte", el email y las 4 preguntas de hoy, con el `page()` y el CSS angosto de las páginas
  legales. La home tiene su propio CSS, más ancho.

## Lo que queda para el builder

- Los textos de cada sección (con la voz de arriba) y el layout fino de las secciones 2 a 7.
- Cómo se ven las maquetas de pantallas (siguiendo cómo es la app de verdad: `CLAUDE.md`).
- Cómo se copia Motion al build (dependencia de desarrollo `motion` y copiar su archivo a `site/dist`).
- La imagen de Open Graph (puede ser un SVG/PNG generado en el build o hecho a mano y commiteado).
- Si `build-site.mjs` crece mucho, partirlo (por ejemplo, la home en su propio archivo).
