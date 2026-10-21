# Amigos y sumar amigos a un rollo — diseño

Fecha: 2026-10-21. Alcance: backend (`rollo-app/backend`) y app (`rollo-app/mobile`).
Lo marcado como **(mi decisión)** lo propuse yo y no lo discutimos; lo demás lo decidió Juani.

## Para qué

Hoy se arma un rollo pasando un código de 6 caracteres. Con amigos habría que pasarle el código a cada uno cada vez.
Esta feature agrega una **lista de amigos** para sumarlos a un rollo con un toque. Los amigos son **un atajo**:
no hace falta ser amigo para entrar a un rollo, el código sigue funcionando igual.

Que dos personas sean amigos no se puede forzar desde afuera: nadie puede agregar a otro usuario solo conociendo su @.

## Metas

- Hacerse amigo mediante un **link de amistad**, sin buscar usuarios.
- Lista de amigos (foto, nombre, @) y poder borrar a un amigo.
- Que cualquier miembro de un rollo sume a **sus** amigos, directo, sin aceptación.
- Que alguien sin cuenta que abre el link se registre y quede amigo al terminar.

## No metas (por ahora)

- Mensajes entre usuarios.
- Buscador de usuarios, contactos del celular, sugerencias de gente.
- Notificaciones push (la cuenta de Apple actual no las permite). **Futuro:** avisar cuando alguien te suma a un rollo.
- Seguidores / perfiles públicos / feeds públicos.
- Anti-metas: que una persona pueda sumar a otra a un rollo sin ser su amiga; que un link filtrado siga sirviendo días.

## Amistad por link

- Un usuario genera un **link de amistad**. Vale **1 hora** desde que se genera. Puede generar otro cuando quiera
  (**mi decisión:** al generar uno nuevo, el anterior deja de servir, así hay uno vivo a la vez).
- **Multiuso:** mientras esté vivo lo puede abrir cualquiera que lo reciba, y cada persona que lo abre queda amiga de quien lo generó.
- El vencimiento se chequea **en el momento en que se abre** (o se escribe el código). Alguien sin cuenta puede tardar
  en registrarse y, si abrió el link a tiempo, queda amigo igual.
- Al abrirlo, la amistad se crea **sin pedir aceptación**: generar el link es el consentimiento de quien lo creó, y abrirlo el del otro.
- **(mi decisión)** El link tiene un token largo, no adivinable. Una persona no puede ser amiga de sí misma. Abrir el link de alguien que ya es tu amigo no hace nada ni da error.
- **(mi decisión)** Forma del link: esquema propio de la app (`rollo://amigos/<token>`) para poder probar ya con la cuenta gratis de Apple;
  los links `https` (Universal Links) llegan con TestFlight y la cuenta paga. El mismo token se puede **escribir a mano** como código corto
  (**mi decisión:** 8 caracteres con el alfabeto del código de login) para quien no tiene la app instalada: iOS no recuerda el link a través de la instalación.
- Persona sin cuenta que abre el link (app instalada): la app lleva a registrarse, guarda el token y, al terminar el registro
  (perfil completo), lo canjea. Si el registro lo hace con el código corto, escribe el código en la pantalla de registro (**mi decisión:** un campo opcional "¿Te invitó un amigo? Código").

## Amigos

- Lista de amigos: foto, nombre, @. Se llega desde Perfil (**mi decisión**, ahí vive "Amigos").
- Un amigo se puede **borrar**; ya no podés sumarlo a rollos. Sacar a un amigo de rollos en los que ya está no pasa solo.
  (**mi decisión:** borrar una amistad es silencioso: el otro deja de aparecer en tu lista, sin aviso.)
- Perfil de un amigo: solo foto, nombre y @ (a definir más adelante).

## Sumar a un rollo

- **Cualquier miembro** del rollo puede sumar a **sus propios amigos**, desde la sección del rollo (donde hoy está "Invitar").
  Entran **directo**, sin aceptar. Un amigo que ya es miembro aparece marcado y no se puede volver a sumar.
- El amigo ve el rollo en "Tus rollos". Sin aviso por ahora.
- **Salirse:** un miembro puede **salirse** de un rollo (hoy no existe en el backend). **(mi decisión)** al salirse conserva sus fotos en el rollo
  (igual que cuando lo saca el admin) y puede volver con el código; no entra a la lista de "sacados".
- **Sacar:** el admin puede sacar a un miembro (ya existe: `DELETE /trips/{tripId}/members/{memberId}`; el sacado **no puede volver a entrar** por código).
  **(mi decisión)** Si lo sacó el admin, tampoco se lo puede volver a sumar por amigos.
- Las reglas de cuándo se puede sumar gente son las que ya existen para el código: no se puede sumar a un rollo ya revelado.
- El que suma queda registrado (**mi decisión**: no se muestra en la app por ahora).

## Cómo se arma (decisiones del constructor)

- Backend: tablas nuevas para amistades (par de usuarios, simétrica) y para links de amistad (token hasheado como los de sesión,
  creador, vencimiento); endpoints para generar link, canjear token/código, listar y borrar amigos, sumar un amigo a un rollo y salirse de un rollo.
  El contrato OpenAPI se regenera y la app genera su cliente (flujo habitual).
- App: dominio nuevo `friends` en `src/features/` (hooks, acciones, lógica pura testeada); pantallas de amigos y de "Sumar amigos" como rutas finas en `app/`;
  manejo del link entrante con Expo Router; persistir el token pendiente en SecureStore hasta terminar el registro.
- Todo en TDD y en español rioplatense en la UI, como el resto de la app.
- Nada que ya esté persistido en el celular se renombra.

## Decisiones tomadas tras la revisión (mías, para que las revise Juani)

1. **Salirse vs. que te saquen:** son dos marcas distintas en `members` (`left_at` y `removed_at`). Salirse permite volver con el código; que te saque el admin no. Un amigo que se salió se puede volver a sumar; uno que sacó el admin, no.
   **El admin no puede salirse** mientras haya otros miembros activos (no existe traspaso de admin todavía); si es el único, tampoco: para eso está borrar la cuenta.
2. **Sumar amigos reutiliza el mismo código que entrar con el código** (mismas verificaciones, mismo manejo del nombre del miembro): se extrae una función compartida, no se copia.
3. **Un pedido con varios amigos a la vez**, con respuesta por amigo: sumado, ya era miembro, no disponible. Nunca todo-o-nada. Un amigo que ya no es amigo, o que sacó el admin, vuelve como "no disponible" sin decir por qué.
4. **Privacidad:** en "Sumar amigos" un amigo que ya es miembro aparece marcado "Ya está"; uno que sacó el admin aparece sin poder elegirse ("No disponible"), sin explicar el motivo.
5. **Un solo código por link: 8 caracteres** con el alfabeto del login; el link lleva ese mismo valor. Se guarda hasheado, y al canjear hay límite de intentos fallidos por usuario y por IP (con 1 hora de vida y ese espacio de combinaciones, alcanza).
   **El vencimiento se chequea al abrir el link, en el servidor:** abrir el link llama a un endpoint **sin sesión** que "reclama" el código (si sigue vivo, devuelve nombre y foto de quien lo creó y un permiso de canje que dura 24 horas). El permiso se guarda en el celular y se canjea al terminar el registro, con sesión. Si el permiso venció, se muestra el error en la pantalla.
6. **Cómo reacciona la app al link:** sin sesión → guarda el permiso, va a registrarse y canjea al final. Con sesión y perfil completo → reclama y canjea en el momento y lleva a la lista de amigos con el amigo nuevo (la UI cambia, sin cartel). Link inválido o vencido → mensaje en la pantalla de amigos. Si llega un segundo link con uno pendiente → reemplaza al anterior.
7. **Borrar la cuenta** (`DELETE /me`) borra también sus amistades y sus links. Borrar a un amigo no afecta a ningún rollo.
8. **Quién sumó a quién:** columna `added_by_user_id` (nullable) en `members`; no se muestra.

## Qué queda a criterio del constructor

Nombres de tablas y endpoints, textos exactos de la UI, el orden de las pantallas, y cómo se muestra al admin y al que se sale.
