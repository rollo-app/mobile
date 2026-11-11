# Etiquetas de privacidad (App Store Connect)

Para Juani. Ruta: App Store Connect → tu app → **Privacidad de la app** (App Privacy) → **Empezar**. Todo esto sale del código real (mobile + backend en origin/main). Si algo cambia (analytics, crash reporting, push), hay que actualizarlo.

Además, en la misma pantalla pide la **URL de la Política de privacidad**: `https://somosrollo.com/privacidad` (la escribe y publica `rollo-app/web`, `docs/legal/privacidad.md`; `rollo.juanifraga.com/privacidad` también anda). Los términos están en `https://somosrollo.com/terminos`.

**Actualizado para la 1.3.0** (login con Apple y Google, noviembre 2026): suma **ID del dispositivo** por el token de push. Apple y Google no suman tipos nuevos (email, nombre, foto e ID de usuario ya estaban).

## Paso 1: ¿Recopilan datos?

Respuesta: **Sí, recopilamos datos de esta app.**
(Aunque no haya terceros de analytics: "recopilar" incluye guardarlos en nuestro servidor.)

## Paso 2: Tipos de datos (marcá solo estos)

Para **cada** uno, Apple te hace tres preguntas: ¿vinculado a la identidad?, ¿se usa para rastreo?, ¿para qué se usa?. Resultado igual en todos: **Vinculado a la identidad: Sí. Rastreo: No. Finalidad: Funcionalidad de la app.**

| Categoría de Apple | Tipo | De dónde sale | Vinculado | Rastreo | Finalidad |
|---|---|---|---|---|---|
| Información de contacto | **Dirección de correo electrónico** | Login con email, Apple (o su reenvío de "Ocultar mi email") o Google (`users.email`) | Sí | No | Funcionalidad de la app |
| Información de contacto | **Nombre** | Perfil (nombre, y @usuario); el de Apple o Google se propone como nombre | Sí | No | Funcionalidad de la app |
| Ubicación | **Ubicación precisa** | GPS al sacar la foto (`media.lat/lng`) | Sí | No | Funcionalidad de la app |
| Contenido del usuario | **Fotos o videos** | Fotos del rollo (y videos de rollos viejos), foto de perfil (incluida la de Google) | Sí | No | Funcionalidad de la app |
| Contenido del usuario | **Otro contenido del usuario** | Epígrafes y comentarios | Sí | No | Funcionalidad de la app |
| Identificadores | **ID de usuario** | `users.id`, @usuario, token de sesión, vínculo con la cuenta de Apple/Google (`user_identities`) | Sí | No | Funcionalidad de la app |
| Identificadores | **ID del dispositivo** | Token de notificaciones push (Expo), `push_tokens` | Sí | No | Funcionalidad de la app |

Notas por tipo:
- **Nombre**: el @usuario también va acá (Apple no tiene "nombre de usuario" aparte; usá "Nombre" e "ID de usuario").
- **Ubicación**: solo "precisa". No marques "aproximada": la app guarda las coordenadas exactas.
- **Fotos o videos**: incluye el avatar. Los videos tienen audio, pero eso queda cubierto por "Fotos o videos"; no hace falta marcar "Datos de audio" (no se graba audio suelto).
- **Otro contenido del usuario**: los epígrafes. Si preferís no marcarlo, es discutible, pero marcarlo es lo más seguro.
- **Identificadores**: marcá **ID de usuario** y **ID del dispositivo** (el token de push que guardamos para mandar avisos). No leemos IDFA ni IDFV.

## Paso 3: Tipos que NO marcás (con motivo)

- **Ubicación aproximada**: no se usa.
- **Información de contacto: teléfono, dirección, otros**: no se piden.
- **Contactos / agenda**: no se accede (los amigos son por link, no por agenda).
- **Datos de uso, Publicidad, Interacción con el producto**: no hay analytics ni publicidad.
- **Diagnósticos (fallos, rendimiento)**: no hay Sentry/Crashlytics ni similar. Verificado en `package.json`. (Apple/TestFlight te dan sus propios datos de fallos; eso no cuenta como nuestra recopilación.)
- **Historial de navegación / búsqueda, compras, datos financieros, salud, datos sensibles, historial de compras**: no.
- **Datos de audio**: no (solo el sonido dentro de un video).

## Paso 4: Rastreo

Respuesta general: **No usamos datos para rastrear.** No hay publicidad, ni se comparten datos con data brokers, ni SDKs de terceros que midan. Por eso no hace falta el aviso de App Tracking Transparency ni `NSUserTrackingUsageDescription`.

## Paso 5: Cosas a tener en cuenta

- **OpenFreeMap** (tiles del mapa) recibe la IP del celular desde la app. No es un SDK de seguimiento y no le mandamos datos tuyos; no se declara como "dato recopilado por nosotros", pero está dicho en la política.
- **Resend** recibe el email para mandar el código: ya cubierto en "Dirección de correo electrónico".
- **Cloudflare** aloja todo: es proveedor de infraestructura, no cambia las respuestas.
- **Dirección IP**: se guarda para limitar intentos (login y links de amistad). Apple la considera dentro de "Identificadores"/"Diagnósticos" solo si se usa para eso de forma vinculada. Recomendación: **no marcar nada extra** (se usa solo para seguridad y antiabuso, y está dicho en la política). Si querés ser ultra conservador, podés sumar "Datos de uso → Otros datos de uso" vinculado, solo funcionalidad; no es obligatorio.
- **Eliminar la cuenta en la app**: ya existe (Perfil → Ajustes → Borrar cuenta). Apple lo exige y lo vas a poder indicar al revisar la app.
- **Cuenta para App Review**: `REVIEW_EMAIL`/`REVIEW_CODE` ya están cargados como secrets del backend. Ponelos en "Información de revisión de la app" (usuario y contraseña) y aclará en las notas que el código es de 6 caracteres y que también se puede entrar con Apple o Google. Conviene que esa cuenta tenga un rollo revelado con fotos.
- **Contenido generado por usuarios (guideline 1.2)**: denunciar (fotos, comentarios y personas) y bloquear ya andan; el contacto de soporte de la ficha es `https://somosrollo.com/soporte`.
- **Login con terceros (guideline 4.8)**: como hay "Continuar con Google", también está "Continuar con Apple".
- **Clasificación por edades**: respondé el cuestionario con "contenido generado por usuarios: sí"; probablemente da 12+ o 17+ según cómo respondas sobre contenido no filtrado. Edad mínima de la política: 13.
- **Push desde el servidor**: ya existe (Expo); por eso va "ID del dispositivo".
