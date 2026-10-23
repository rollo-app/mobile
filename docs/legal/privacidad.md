# Política de privacidad de Rollo

Última actualización: 23 de octubre de 2026

Rollo es una app para sacar fotos y videos en grupo. Acá te contamos, sin vueltas, qué datos guardamos, para qué y qué control tenés.

## 1. Quién es responsable

Rollo es desarrollada y operada por Juan Ignacio Fraga ("yo", "Rollo"), desde Uruguay. Tratamos tus datos según la Ley N.º 18.331 de Protección de Datos Personales de Uruguay. Para cualquier duda o pedido sobre tus datos escribí a **soporte@juanifraga.com**.

## 2. Qué datos guardamos

**Cuenta y perfil**
- Tu **email**: lo usamos para mandarte el código de ingreso. No hay contraseña.
- Tu **nombre** y tu **@usuario** (único). Los ven los demás miembros de tus rollos y tus amigos.
- Tu **foto de perfil** y una **descripción**, si las agregás (opcionales).
- Las **fotos destacadas** que elegís mostrar en tu perfil (fotos de rollos ya revelados).
- Un **token de sesión** que se guarda en tu celular. En nuestro servidor solo guardamos una versión cifrada (hash) del token y de los códigos de ingreso.

**Lo que sacás en un rollo**
- Las **fotos y videos** que mandás al rollo, en alta resolución, y una miniatura.
- Un **código visual difuso** (ThumbHash) de cada foto, que es lo único "visual" que se ve antes del revelado.
- El **epígrafe** (texto) que escribas, si escribís uno.
- **Cuándo** la sacaste (fecha y hora, con la zona horaria del rollo).
- **Dónde** la sacaste: la **ubicación precisa (GPS)** del celular al disparar, con su precisión. Se guarda en nuestro servidor y también dentro del archivo de la foto (metadatos EXIF).
- Datos del archivo: tamaño, ancho, alto y duración del video.

**Rollos y amigos**
- Los rollos que creás o a los que te sumás (nombre, fechas, código, quiénes participan y su rol).
- Tus **amistades** dentro de Rollo y los **links de amistad** que generás (guardamos solo una versión cifrada del código; vale 1 hora).

**Denuncias y bloqueos**
- Si **denunciás** una foto o a una persona, guardamos quién denunció, qué foto o persona, el motivo y la fecha.
- Si **bloqueás** a alguien, guardamos a quién bloqueaste y cuándo.

**Datos técnicos**
- Tu **dirección IP**, solo cuando pedís un código de ingreso o canjeás un link de amistad. La usamos para frenar abusos (límite de intentos).
- Si el celular no tiene señal, Rollo guarda en tu celular las fotos pendientes, su hora y su ubicación hasta poder subirlas.

**Lo que NO hacemos:** no usamos analíticas, ni publicidad, ni SDKs de seguimiento o de reporte de errores de terceros. No vendemos tus datos. No te rastreamos entre apps ni sitios.

## 3. Para qué los usamos

Solo para que Rollo funcione: iniciar sesión, armar rollos, guardar y revelar las fotos, mostrar el mapa y el feed, permitir amigos y descargas, limitar abusos y atender denuncias. No los usamos para publicidad ni perfilado.

## 4. Permisos del celular

- **Cámara y micrófono**: para sacar fotos y videos (con sonido).
- **Ubicación (mientras usás la app)**: para guardar dónde sacaste cada foto y mostrar el mapa. Podés negarla: la foto igual se manda, sin lugar.
- **Fotos (guardar en el carrete)**: solo cuando elegís descargar fotos o videos del rollo a tu celular.
- **Notificaciones**: solo avisos locales (por ejemplo, cuando se revela un rollo). No usamos notificaciones push desde un servidor.

Las fotos que sacás con Rollo no quedan en tu carrete: se suben al rollo.

## 5. Quién ve qué

- Tus fotos y videos las ven **solo los miembros del rollo**, y **solo después del revelado**. Antes, nadie las ve (ni vos): se ve únicamente el código visual difuso.
- **Antes del revelado**, los miembros del rollo sí ven, en el mapa y el feed, que sacaste una foto: **quién, a qué hora, dónde (pin en el mapa) y el epígrafe**.
- **Después del revelado**, los miembros del rollo pueden ver y descargar las fotos, incluida su **ubicación** (en el mapa y en los metadatos del archivo). Ojo: una vez descargada una foto, quien la tenga puede compartirla; no lo controlamos.
- Tu **nombre, @usuario, foto de perfil, descripción y cantidad de amigos** los puede ver cualquier usuario de Rollo que abra tu perfil.
- Tus **fotos destacadas** y tu lista de amigos los ven **tus amigos**, o **cualquier usuario de Rollo** si activás "Perfil público" en Ajustes. De una destacada nunca se muestra el rollo, el epígrafe ni la ubicación exacta: solo una zona aproximada (unos 5 km). Si el autor de una foto elige "No dejar que la destaquen", nadie más puede destacarla.
- Las **denuncias y bloqueos** no se le muestran a la otra persona. Las denuncias las recibimos nosotros por email para revisarlas. Tu **email** no se muestra a otros usuarios.
- Tu foto de perfil se sirve desde una dirección pública difícil de adivinar; cualquiera que tenga ese link puede verla.
- El admin de un rollo puede borrar fotos de ese rollo antes del revelado (por ejemplo, si alguien sube algo inapropiado) y sacar a miembros.

## 6. Proveedores que usamos

Compartimos datos con terceros solo en la medida necesaria para dar el servicio:

- **Cloudflare** (Workers, D1 y R2): aloja el servidor, la base de datos y el almacenamiento de fotos y videos. Recibe todo lo que guardamos y las IPs de las conexiones.
- **Resend**: envía el email con tu código de ingreso (recibe tu email) y nos manda a nosotros los avisos de denuncias y bloqueos, con los datos de las personas involucradas y, si es una foto, un link temporal (7 días) para verla.
- **OpenFreeMap**: provee los mapas. Cuando mirás o descargás mapas, tu celular se conecta directo a sus servidores, que ven tu dirección IP y la zona que mirás. No les mandamos tu cuenta ni tus fotos.
- **Apple**: App Store, TestFlight y el sistema del iPhone. Rige su propia política.
- **Expo / EAS**: la usamos para compilar y distribuir la app. La app no les manda datos de uso.

## 7. Dónde se guardan y por cuánto tiempo

Los datos se guardan en servidores de Cloudflare, que pueden estar fuera de Uruguay y de Argentina. Al usar Rollo aceptás esa transferencia internacional.

- **Cuenta, perfil, rollos y fotos**: mientras tengas la cuenta, o hasta que se borren como se explica abajo.
- **Sesión**: dura un año desde la última vez que usaste la app. Podés cerrarla antes con "Cerrar sesión".
- **Códigos de ingreso**: valen 5 minutos. Los registros de códigos (con email e IP) se conservan hasta que borrás tu cuenta.
- **Intentos de link de amistad (con IP)**: se limpian automáticamente al cabo de una hora.
- **Denuncias y bloqueos**: mientras exista la cuenta de quien denunció o bloqueó y la de la otra persona. Si sacamos una foto o una cuenta por una denuncia, se borra como en "Borrar cuenta".

## 8. Tus derechos y borrar tu cuenta

Podés acceder, corregir y borrar tus datos. Nombre, @usuario, foto y descripción los editás en la app (Perfil → Ajustes → Editar perfil). Las personas que bloqueaste las ves y desbloqueás en Perfil → Ajustes → Bloqueados.

**Borrar cuenta** (Perfil → Ajustes → Borrar cuenta). Es definitivo y borra:
- tus **fotos y videos de todos los rollos** (archivos y registros), incluso de rollos compartidos y aunque ya estén revelados;
- tu membresía en cada rollo (si eras admin, pasa a otro miembro; si no queda nadie, se borra todo el rollo);
- tus amistades, links de amistad, foto de perfil, destacadas, sesiones y códigos de ingreso;
- las denuncias y bloqueos que hiciste y los que te involucran;
- tu cuenta y tu email.

Lo que ya descargaste en tu celular o en el de otros miembros, no lo podemos borrar. Si salís de un rollo ("Salirme del rollo") sin borrar la cuenta, **tus fotos quedan en ese rollo**; si querés que se borren, borrá la cuenta o pedínoslo por mail.

Para ejercer tus derechos (acceso, rectificación, supresión, oposición) o hacer cualquier consulta, escribí a **soporte@juanifraga.com**. También podés acudir a la Unidad Reguladora y de Control de Datos Personales (URCDP) de Uruguay; si sos de Argentina, a la Agencia de Acceso a la Información Pública (AAIP).

## 9. Menores

Rollo **no está pensada para menores de 13 años** y no recolectamos datos de ellos a sabiendas. Si sos menor de 18, usala con el permiso de tu madre, padre o tutor. Si te enterás de que un menor de 13 abrió una cuenta, avisanos y la borramos.

## 10. Seguridad

Usamos conexiones cifradas (HTTPS), guardamos solo hashes de tokens y códigos, y las fotos de un rollo solo se entregan a sus miembros. Ningún sistema es 100 % seguro, pero cuidamos tus datos.

## 11. Cambios

Si cambiamos esta política, actualizamos la fecha de arriba y, si es un cambio importante, te avisamos en la app.

## 12. Contacto

**soporte@juanifraga.com**
