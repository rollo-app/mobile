# Denunciar y bloquear — diseño

Fecha: 2026-10-22. Alcance: backend (`rollo-app/backend`) y app (`rollo-app/mobile`).

## Por qué

Apple (guía 1.2, contenido generado por usuarios) no publica una app social sin una forma de **denunciar contenido**,
**bloquear usuarios**, un **contacto** publicado y **términos aceptados** con tolerancia cero. Los términos y la
política ya publicados en `rollo.juanifraga.com` prometen que se puede denunciar y bloquear desde la app, y que las
denuncias se revisan en 24 h.

Juani lo quiere **solo para que Apple apruebe la app**: Rollo se usa entre amigos y no espera moderar en serio. Se
construye lo mínimo que cumple, bien hecho y con el estilo de la app, y nada más.

## Objetivos

- Denunciar una **foto o video** (incluye su caption) y una **persona**.
- Bloquear a una persona y desbloquearla.
- Que cada denuncia le llegue por mail a Juani (`soporte@juanifraga.com`) con lo necesario para decidir.
- Que Juani pueda sacar una foto o una cuenta en minutos sin tocar SQL a mano.
- Que al entrar se acepten los términos y la política.
- Que el revisor de Apple lo pueda probar con la cuenta de demo.

## No objetivos

- Panel de moderación, cola de denuncias o estados ("en revisión", "resuelta") en la app.
- Ocultar contenido a los demás por cantidad de denuncias, filtros automáticos o de IA.
- Sacar a alguien de un rollo por bloquearlo.
- Avisarle a nadie que fue denunciado o bloqueado.

## Anti-objetivos (sería un fracaso aunque funcione)

- Que se sienta como una app vigilada: los controles van escondidos en menús que ya existen, nunca botones a la vista.
- Toasts, carteles de "¡Denuncia enviada!" o pantallas nuevas grandes. Éxito = la UI cambia (CLAUDE.md, "Cómo se entera
  el usuario").
- Romper o complicar los flujos actuales (feed, visor, perfil, amigos, sumar a un rollo).

## Lo que decidió Juani

- Alcance mínimo, solo para cumplir con Apple.
- **Bloquear solo oculta para quien bloquea**: no saca a nadie del rollo compartido; los demás lo ven normal.

## Comportamiento

### Denunciar

- **Qué se denuncia:**
  - Una **foto o video**: desde el visor de fotos (revelado y destacadas) y desde la fila del Feed (donde se ve el
    caption antes del revelado). El caption no se denuncia aparte: es parte de la foto.
  - Una **persona**: desde su perfil (`/user/[userId]`). Cubre nombre, @, foto de perfil y descripción.
- **Cómo:** una acción "Denunciar" en el menú que ya tiene cada lugar (el `MenuView` del visor, un `ActionSheetIOS`
  en la fila del Feed, un menú en el perfil). Después se elige el motivo en un action sheet nativo: "Es ofensivo",
  "Es acoso o abuso", "Otro motivo", "Cancelar". No hay texto libre.
- **Qué ve quien denuncia:** la foto denunciada **desaparece para esa persona** en todos lados (feed, mapa, galería,
  presentación, destacadas). En el visor, se cierra o pasa a la siguiente foto. Haptic suave. Sin cartel. Denunciar
  a una persona no la oculta (para eso está bloquear); en su perfil, la acción "Denunciar" queda reemplazada por el
  texto "Denunciaste a esta persona", en gris, sin acción.
- **Sin señal:** la denuncia necesita conexión. Si falla, se muestra el error con un HUD nativo de error (ver "Decisiones
  del diseñador") y no se oculta nada.
- **Denuncias repetidas:** denunciar dos veces lo mismo es inocuo (la segunda no manda otro mail).

### Bloquear

- **Desde dónde:** el perfil de la persona (`/user/[userId]`), acción "Bloquear" (destructiva). Confirmación con
  `Alert` nativo porque es una acción destructiva: "¿Bloquear a Cami? No vas a ver sus fotos ni sus captions en ningún
  rollo, deja de ser tu amiga y no te va a poder sumar a rollos." Botones "Bloquear" (destructivo) y "Cancelar".
- **Qué pasa para quien bloquea:**
  - Desaparecen sus fotos, videos, captions y pins **en todos los rollos** (feed, mapa, galería, presentación,
    hoja de contacto) y sus destacadas.
  - Se borra la amistad (en los dos sentidos).
  - Sigue apareciendo en la lista de miembros del rollo, con su foto y nombre como hoy y "Bloqueado" en
    gris como detalle de la fila. Sus filas de actividad del Feed desaparecen porque son de sus fotos. Los totales del grupo (contadores, "N fotos") no cambian: son del grupo.
  - Su perfil muestra el encabezado (nombre, @, foto) y la acción "Desbloquear"; no muestra destacadas, amigos ni
    rollos en común.
- **Qué pasa para quien es bloqueado (sin que se entere):**
  - No puede canjear un link de amistad de quien lo bloqueó ni usar el suyo con esa persona: la respuesta es la misma
    que para un link vencido o inválido.
  - "Sumar amigos" a un rollo no la ofrece (ya no son amigos) y, si igual se intentara, el server responde
    "No disponible" como hoy.
  - Ve el perfil de quien lo bloqueó como un perfil privado: "Este perfil es privado".
  - Sus fotos siguen visibles para el resto del rollo.
- **Desbloquear:** desde el perfil de la persona, o desde Perfil → "Bloqueados" (fila nueva, solo si hay alguien
  bloqueado), una lista simple con foto, nombre y @. Tocar una fila abre su perfil, donde está "Desbloquear". No
  devuelve la amistad.
- Bloquear a alguien no impide unirse a un rollo con el código (el código lo pasan las personas).

### Aceptar los términos

- En la primera pantalla del login (email), debajo del botón: "Al continuar aceptás los **Términos** y la **Política de
  privacidad**.", en texto secundario, con los dos links a `https://rollo.juanifraga.com/terminos` y `/privacidad`.
  Se abren en el navegador del sistema. No hay checkbox.

### Lo que le llega a Juani

- Un mail por denuncia nueva a `REPORTS_EMAIL` (por defecto `soporte@juanifraga.com`), por Resend, con asunto
  "Denuncia en Rollo: foto de @usuario" o "Denuncia en Rollo: @usuario". Contiene: motivo; quién denuncia (nombre,
  @, email); qué se denunció (autor con nombre, @ y email; rollo; caption; fecha); para una foto, un **link firmado
  de R2 (GET) al original** (foto JPEG o video MP4), válido 7 días, para poder verla (hace falta un helper de
  presign GET; hoy solo existe `presignPut`); y los comandos listos para actuar (abajo).
- Si el mail falla, la denuncia igual queda guardada y la respuesta a la app es éxito (se loguea el error).

### Cómo actúa Juani

- Endpoints de administración protegidos por un secret `ADMIN_TOKEN` (header `Authorization: Bearer …`),
  pensados para usar con `curl` desde la terminal:
  - `DELETE /admin/media/{mediaId}`: saca la foto para todos, igual que cuando la borra el admin del rollo hoy.
  - `DELETE /admin/users/{userId}`: borra la cuenta igual que "Borrar cuenta" (`DELETE /me`), reusando esa lógica.
  - `GET /admin/reports?limit=50`: las últimas denuncias, por si se pierde un mail.
- El mail incluye los `curl` armados para la foto y para el autor (sin el token: `$ROLLO_ADMIN_TOKEN`).
- Las rutas `/admin/*` no van al `openapi.json` público ni al cliente de la app. `DELETE /admin/users/{id}` usa la
  misma función que `DELETE /me` (extraerla a `src/lib/` está bien). Las denuncias sobre esa cuenta se borran con
  ella (los mails quedan en el Gmail de Juani).
- El mail usa `src/lib/email.ts` y el mismo remitente verificado (`rollo@juanifraga.com`).
- Un `docs/moderacion.md` en el backend explica cómo cargar el secret, cómo usar los comandos y que hay que actuar en
  menos de 24 h.

## Datos (backend, D1)

Migración nueva (siguiente número libre en `develop` del backend):

- `reports`: `id`, `reporter_id`, `media_id` (nulo si es una persona), `target_user_id` (el autor de la foto o la
  persona denunciada), `trip_id` (nulo si es una persona), `reason` (`offensive` | `abuse` | `other`), `created_at`.
  Única por (`reporter_id`, `media_id`) y por (`reporter_id`, `target_user_id`) cuando `media_id` es nulo.
- `blocks`: `blocker_id`, `blocked_id`, `created_at`; clave primaria (`blocker_id`, `blocked_id`).
- Al borrar una cuenta se borran sus filas en `reports` (como denunciante y como denunciado) y en `blocks` (en los dos
  lados). La política de privacidad ya dice que borrar la cuenta borra todo; actualizarla si hiciera falta.

## API (backend)

- `POST /reports` con `{ mediaId, reason }` o `{ userId, reason }` → `204`. No se puede denunciar algo propio ni algo
  que no se puede ver (foto de un rollo del que no sos miembro, o destacada que no te toca ver) → `404`.
  Se puede denunciar a cualquier usuario que exista salvo a uno mismo (el encabezado del perfil es visible para
  todos). `reportedByMe` del perfil cuenta solo denuncias a la persona, no a sus fotos.
- `GET /blocks` → lista de personas bloqueadas (mismo formato que la lista de amigos).
- `PUT /blocks/{userId}` → `204` (idempotente; borra la amistad). `DELETE /blocks/{userId}` → `204`.
- Filtrado **en el server** para quien pide: todo lo que lista fotos (feed de un rollo, destacadas, lo que alimenta
  mapa, galería y presentación) excluye fotos de personas que bloqueaste y fotos que denunciaste. Así la app no
  repite la regla en cada pantalla. No hace falta que pedir una foto oculta directo por id dé 404. Contadores,
  totales del grupo y cupos diarios **no** cambian ni por denuncias ni por bloqueos.
- Destacadas existentes: no se borran al bloquear, solo se filtran (en los dos sentidos).
- El perfil de usuario (`GET /users/{id}`) indica `blockedByMe` y `reportedByMe`; si te bloquearon, se responde como
  perfil privado. Los miembros de un rollo indican `blockedByMe`.
- Canje de links de amistad: si hay bloqueo en cualquier sentido, responde igual que un link inválido.
- Regenerar el contrato (`openapi.json`) y, en la app, `npm run api:generate`.

## App

- `src/features/moderation/` (dominio nuevo): `actions.ts` (report, block, unblock, list), hooks
  (`use-report`, `use-block`, `use-blocked`) y la lógica pura del menú de motivos y de los textos.
- Puntos de entrada en features existentes, importando lo público de `moderation`:
  - Visor (`photo-viewer.tsx`, `MenuView`): "Denunciar" en todas las fotos ajenas; no en las propias.
  - Fila del Feed (`feed-row.tsx`, `ActionSheetIOS`): "Denunciar" en filas ajenas (hoy el menú existe para el admin con
    "Borrar foto"; para el resto se agrega el gesto que use ese menú, sin un botón nuevo a la vista).
  - Perfil de usuario (`user-profile-screen.tsx`): menú con "Denunciar" y "Bloquear"/"Desbloquear".
  - Miembros del rollo (`roll-people.tsx` y la sheet "Sobre el rollo"): "Bloqueado" en gris.
  - Perfil propio (`app/(tabs)/me`): fila "Bloqueados" → pantalla nueva `app/blocked.tsx` (registrar en
    `app/_layout.tsx` y `src/test/routes.ts`).
  - Login (`app/(auth)/`): la línea de términos.
- Después de denunciar o bloquear: invalidar las queries afectadas (feed, rollos, destacadas, perfil, amigos) para que
  la UI cambie sola; la foto denunciada se puede sacar del cache al instante (optimista) y si la llamada falla vuelve.
- Textos en rioplatense, código y tests en inglés, TDD (CLAUDE.md).

## Orden

1. Backend: migración, endpoints, filtrado, mail, admin, tests, contrato. PR a `develop`, deploy a producción
   (`main`) y cargar los secrets `ADMIN_TOKEN` y, si hace falta, `REPORTS_EMAIL`.
2. App: regenerar el cliente, la feature `moderation` y los puntos de entrada. PR a `develop`.
3. Build nuevo a TestFlight y probar con dos cuentas (la de Juani y la del revisor): denunciar una foto (desaparece,
   llega el mail, el `curl` la saca), bloquear (desaparecen sus fotos, se borra la amistad, no puede canjear links),
   desbloquear.
4. En App Store Connect, en las notas para el revisor: dónde están "Denunciar" y "Bloquear".

## Decisiones del diseñador (no las pidió Juani; revisar)

- Los endpoints de administración con `ADMIN_TOKEN` en vez de SQL a mano, para que sacar una foto también borre el
  archivo de R2 y reuse la lógica que ya existe.
- El link firmado de 7 días en el mail para ver la foto denunciada.
- Denunciar una persona no la oculta; bloquear es lo que oculta.
- Error de red al denunciar o bloquear: HUD nativo de error con `burnt` (CLAUDE.md lo prevé; `npx expo install burnt`,
  pide rebuild, que igual hace falta para TestFlight).
- El link del mail apunta al original (foto o video), no a una versión nueva.
- Motivos fijos ("Es ofensivo", "Es acoso o abuso", "Otro motivo"), sin texto libre.

## Queda a criterio de quien construye

- Nombres internos, forma exacta de las respuestas y del mail, índices.
- Cómo se filtra en SQL (subconsultas o joins) mientras el resultado sea el descrito.
- El gesto exacto para abrir el menú en la fila del Feed para quien no es admin.
