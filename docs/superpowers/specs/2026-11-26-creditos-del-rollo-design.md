# Créditos del rollo — diseño

Fecha: 2026-11-26 · Estado: propuesta para aprobar. Rama `feature/creditos-del-rollo` (desde `develop`). Solo app, sin cambios de backend ni paquetes nativos.

## Qué es y por qué

Al final de las historias de un rollo revelado (`/presentation`), antes del cierre, aparecen los **créditos**: una historia por premio, como el final de una película. Cada premio sale de los datos del propio rollo y nombra a alguien del grupo por algo lindo que hizo. La idea es que el final de las historias tenga un remate que dé ganas de comentar ("¿quién sacó una foto a las 3 de la mañana?").

Hoy la última historia es una pantalla negra quieta ("Así fue": números, "X sacó más fotos" y los botones "Ver la galería" / "Ver de nuevo", `outro.tsx`).

## Enfoques considerados

- **A · Créditos que suben** (scroll vertical automático, un toque saltea). Es lo más "cine", pero el dueño marcó que choca con las historias, que avanzan de izquierda a derecha a toques. Descartada.
- **B · Una historia por premio, con la foto que lo ganó de fondo.** Usa el mismo reproductor: misma barrita, mismo toque para avanzar o volver, mismo mantener apretado para pausar. **Elegida por el dueño (2026-11-26).**
- **C · Pantalla quieta** (la de hoy con los premios abajo de los números). La más chica, pero no se siente créditos. Queda como comportamiento con pocas fotos y en eventos (sin premios).

## Cómo se ve

Después de la última foto del último día:

1. **Una historia por premio** (hasta 5). La foto que ganó el premio a pantalla completa, oscurecida (velo negro ~55 %) para que el texto se lea. Abajo a la izquierda: el rubro en chico y gris con letras espaciadas ("TURNO NOCHE"), el nombre grande ("Nico") y una línea de detalle ("03:17 · Día 2"). Arriba, la barrita de progreso con un segmento por premio. Sin corazón, sin autor arriba, sin sonido.
2. **El cierre** (la pantalla de hoy, `Outro`): "Así fue", los números y los botones. En vez de la línea "X sacó más fotos" lleva el **Elenco**: los nombres de todos los que sacaron al menos una foto, en orden de aparición, separados por " · ". Pasados 24 nombres: "… y N más".

Cada premio dura **4,5 s** y avanza solo. Tocar a la derecha pasa al siguiente, a la izquierda vuelve (a un premio anterior, o a la última foto desde el primero), mantener apretado pausa, deslizar hacia abajo cierra. "Ver de nuevo" vuelve al principio de las historias.

**Movimiento:** al entrar cada premio, el texto sube 12 pt y aparece (400 ms, ease-out) y la foto de fondo aparece con un fundido corto. Un háptico suave al entrar al primer premio. Con **"Reducir movimiento"** (`useReducedMotion`): solo el fundido, sin desplazamiento. Con **VoiceOver** no avanza solo (como el resto de las historias) y cada premio se lee entero: "Turno noche: Nico. 03:17, día 2".

## Premios

Nombres de rubro de cine, para no adivinar el género de nadie. Todos positivos. Se calculan solo con **fotos** (no videos) que **no están archivadas** y cuyo autor **no está bloqueado** por quien mira.

| Rubro | Quién gana | Mínimo | Detalle | Foto de fondo |
|---|---|---|---|---|
| Primera luz | Autor de la foto con la hora más temprana entre las 5:00 y las 8:59 (hora del rollo, cualquier día) | Una foto en ese horario | "06:42 · Día 3" | Esa foto |
| Turno noche | Autor de la foto con la hora más tarde entre las 0:00 y las 4:59 | Una foto en ese horario | "03:17 · Día 2" | Esa foto |
| Guion | Quien tiene más fotos con texto (caption no vacío) | 3 | "14 textos" | Su foto con el texto más largo |
| Locaciones | Quien sacó fotos en más lugares distintos (lat/lng redondeadas a 2 decimales, ~1 km; fotos sin ubicación no cuentan) | 3 | "9 lugares" | Su primera foto en el último lugar nuevo al que llegó |
| Cámara | Quien sacó más fotos | 5 | "42 fotos" | Su foto con más me gusta (empate: la más vieja) |

Orden en pantalla: el de la tabla.

Reglas:

- **Sin premios** (solo el cierre con Elenco) si hay menos de 2 autores o menos de 10 fotos que cuenten.
- **Empates** en los rubros por cantidad (Guion, Locaciones, Cámara): si empatan dos, lo comparten ("Juani y Sofi", primero quien sacó antes su primera foto; el fondo es del primero). Si empatan tres o más, ese rubro no sale. En Primera luz y Turno noche gana la hora exacta; si coincide al segundo, la foto de id menor.
- Una persona **puede ganar más de un rubro**: se prefiere que sea verdad.
- **Ningún premio depende de los me gusta** (recién revelado casi no hay). Solo se usan para elegir la foto de fondo de "Cámara". Los premios por me gusta quedan para el "podio" de las 48 horas (otra tarea).
- Días: "Día N" se cuenta como en las tarjetas de día de las historias.

## Dónde aparece

- **Solo rollos comunes.** En un **evento** las historias terminan como hoy, sin premios ni Elenco (con ~80 invitados no entran los nombres, cada invitado ve solo sus grupos y `detail.members` es parcial). Igual criterio que el afiche.
- **Privacidad:** los créditos se ven dentro del rollo, solo sus miembros. El server no saca del feed las fotos de quien bloqueaste (bloquear no saca a nadie del rollo), así que **la app filtra** con la lista de bloqueados (`useBlocked`, `GET /blocks`): sus fotos no cuentan para ningún rubro ni para el Elenco, y su nombre no aparece. Si la lista de bloqueados no se pudo cargar, **no hay créditos** (cierre de hoy): ante la duda, no se nombra a nadie. Las archivadas (solo pueden venir las propias) nunca cuentan.

## Cómo se construye

- `src/features/presentation/credits.ts` (lógica pura, con tests): `computeCredits(photos, timeZone, blockedUserIds)` → `{ awards, cast }`. Cada premio: `{ kind, names, detail, photo }`.
- `story.ts`: nuevo paso `{ kind: "credit", award }` entre la última foto y el `outro`; `buildStory(photos, timeZone, options?)` recibe `credits: { blockedUserIds } | undefined` (sin eso, exactamente lo de hoy). El `outro` suma `cast` (null = línea de hoy). `stepDuration` (4500 ms) y `daySegments` (un segmento por premio) contemplan el paso nuevo.
- `player.ts`: "anterior" se detiene también en un premio.
- `credit-card.tsx`: la tarjeta (expo-image con `displayPath` y ThumbHash de placeholder, velo, textos, entrada con Reanimated).
- `upcoming.ts` / `use-story-prefetch.ts`: también precargan la foto de los próximos premios.
- `app/presentation.tsx` + `StoryPlayer`: pasan `credits` si el rollo no es evento y la lista de bloqueados ya cargó. Se espera a que cargue (o falle) antes de montar las historias, para que no se rearmen debajo de quien mira.
- `outro.tsx` / `format.ts`: Elenco.
- `CLAUDE.md`: describe la feature.

## Lo que no cambia / fuera de alcance

- Las historias, las tarjetas de día y el cierre en eventos.
- Que las historias muestren fotos de alguien bloqueado (ya pasa hoy; se anota como pendiente aparte).
- Nada de compartir los créditos afuera, ni backend, ni notificaciones (eso es el podio).
