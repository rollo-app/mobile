# Buscar usuarios — diseño

Fecha: 2026-11-01. Acordado con el dueño en una charla de brainstorming. Lo marcado *(decisión de Claude)* lo puede cambiar el dueño.
Toca los dos repos: la app (`mobile`) y `rollo-app/backend` (endpoint nuevo + migración). Reemplaza el "buscar perfiles públicos"
que figuraba como "a futuro" en `CLAUDE.md`.

## Para qué es

Encontrar **cualquier cuenta** de Rollo por su **@usuario o su nombre** y mandarle una **solicitud de amistad** sin necesitar su
link de amistad. Hoy la única forma de hacerse amigo de alguien es que te pase el link o que lo veas en un rollo en común.

- **Aparecen todos**, perfil público o "solo amigos" (decisión del dueño: es para buscar cuentas y mandar solicitud). No se
  expone nada nuevo: foto, nombre, @ y descripción ya son públicos en `GET /users/{id}`; lo privado (destacadas, lista de
  amigos) sigue igual.
- **No hay ajuste para salir de la búsqueda** (decisión del dueño, 2026-11-01): todos aparecen, menos los bloqueos y las cuentas a
  medio crear.
- **Los rollos nunca aparecen**, ni en los resultados ni como dato de un resultado.

## No objetivos

- Buscar rollos, fotos o captions.
- Búsquedas recientes, sugerencias ("gente que quizás conozcas") o buscar fuera de la tab Amigos.
- Arreglar las cuentas a medio crear (ver "Pendiente aparte").

## Anti-objetivos (aunque ande, sería un fracaso si…)

- Sirve para listar a todos los usuarios de Rollo (por eso: tope de 20, mínimo 2 caracteres, sin paginar y rate limit propio).
- Aparece alguien que bloqueaste o que te bloqueó, o se filtra un rollo.
- Se ve como una pantalla web metida en la app: tiene que ser la barra de búsqueda nativa de iOS.

## La app

### Primer paso: probar la barra nativa *(decisión de Claude)*

Antes de construir, un spike chico confirma que `headerSearchBarOptions` anda en el Stack de la tab Amigos dentro de `NativeTabs`
(SDK 58, iOS 26): `onChangeText`, "Cancelar", y que se esconde al bajar como en Contactos. Si no anda, el plan B es un campo de
búsqueda propio fijo arriba de la lista (mismo comportamiento, sin barra del sistema) y se avisa al dueño antes de seguir.

La sección "Amigos" filtra `useFriends()`, que trae la lista completa sin paginar (`GET /friends`, con nombre y @): no se pierde
a nadie.

### Dónde (decisión del dueño)

La **barra de búsqueda nativa de iOS** en la tab **Amigos** (`headerSearchBarOptions` del Stack de `(tabs)/friends`, debajo del
título grande; aparece al bajar la lista, como en Contactos). Mientras hay texto, el contenido de la tab ("Solicitudes", "Invitar a
un amigo" y la lista) se reemplaza por los resultados. "Cancelar" de la barra vuelve a la tab como estaba.

`app/(tabs)/friends/index.tsx` sigue fino: la barra se configura desde `FriendsScreen` (o un componente de la feature) con
`<Stack.Screen options={…} />`; el estado del texto vive en la feature.

### Resultados (opción A, elegida por el dueño)

Lista agrupada con dos secciones:

1. **"Amigos"**: tus amigos que coinciden, con la fila de siempre (foto 40 pt, nombre, @) y a la derecha el texto secundario
   "Amigos", sin botón. Se filtra **en el celular** sobre `useFriends()` con la misma regla de coincidencia que el server, así anda
   al toque y sin señal *(decisión de Claude)*. Si no hay ninguno, la sección no aparece.
2. **"Personas"**: lo que devuelve el server (nunca incluye amigos, ver API). Cada fila: foto, nombre, @ y, si hay amigos en
   común, "· 3 en común" junto al @ (texto secundario). A la derecha un botón chico tipo pastilla:
   - `none` → **"Agregar"** (cobalto, `primary`): manda la solicitud.
   - `sent` → **"Enviada"** (gris, `secondary`): tocarlo abre un menú nativo con "Cancelar solicitud", como en el perfil.
   - `received` → **"Aceptar"** (cobalto): acepta la solicitud que esa persona te mandó. "Rechazar" queda en el perfil y en
     "Solicitudes" *(decisión de Claude: una sola acción por fila)*. Al aceptar, la persona pasa de "Personas" a la sección "Amigos" al toque (optimista sobre la lista de amigos).
- **Tocar la fila** (fuera del botón) abre su perfil: `/friends/user/<id>`.
- El botón es **optimista** como `FriendRequestButton`: cambia al toque y vuelve si el server dice que no; el error va inline debajo
  de esa fila (`ErrorText`) *(decisión de Claude)*. Reusar `useFriendRequest`, sumando a su `onMutate`/`onError`/`onSettled` el cache
  de la búsqueda (`["user-search", q]`) para que la fila y el perfil queden de acuerdo.
- VoiceOver: la fila lee "Camilo Pérez, @cami.p, 3 en común"; el botón tiene su propio label ("Agregar a Camilo Pérez", "Solicitud
  enviada a…, cancelar", "Aceptar solicitud de…").

### Mientras escribís *(decisiones de Claude)*

- Se busca desde **2 caracteres** (sin contar un `@` inicial), con una pausa de ~300 ms entre teclas. Con menos de 2 solo se
  muestra la sección "Amigos" local.
- Query de TanStack `["user-search", qNormalizado]` con `placeholderData: keepPreviousData` (no parpadea mientras tipeás) y
  `staleTime` corto (~30 s).
- Cargando la primera vez: `Loading` chico debajo de "Amigos".
- Sin resultados en ninguna sección: "No encontramos a nadie con "xyz"."
- Error (sin señal, 429): estado inline con el mensaje del server o "No se pudo buscar" y "Reintentar"; no se borra lo escrito y la
  sección "Amigos" local se sigue viendo.
- Si el server devuelve 20, abajo un `Footnote`: "Si no está, escribí más de su nombre o su @." (no hay "cargar más").

### Regla de coincidencia (la misma en la app y el server)

- Normalizar el texto buscado: trim, sacar un `@` inicial, minúsculas y **sin tildes ni diacríticos** (NFD + quitar marcas:
  "Martín" → "martin", "ñ" → "n").
- Coincide si el **@ empieza** con eso, o si **alguna palabra del nombre** normalizado **empieza** con eso
  ("cami" → "Cami Sosa" y "Ana Camila"; no "Micaela").
- La normalización va como función pura con tests en los dos repos (en la app, en `src/features/friends/` o donde la use la
  búsqueda; en el backend, en `src/lib/`).

## El backend (`rollo-app/backend`)

### Enfoque elegido por el dueño: comparar texto en D1

Sin FTS5 ni servicio externo: con la escala de Rollo un `LIKE` sobre columnas normalizadas alcanza. (Descartado: FTS5, que obliga
a mantener una tabla virtual sincronizada; y solo por @, que no busca por nombre.)

### Migración

- Columna nueva `users.name_search TEXT`: el nombre normalizado (misma regla de arriba) con un espacio adelante (`" cami sosa"`), así
  "palabra que empieza con" es `LIKE '% ' || q || '%'`.
- Se escribe en **todo lugar que cambia `users.name`**. Revisado el 2026-11-01: el único en `src/` es `updateProfile` de
  `me.repository.ts` (`PATCH /me`, que también usa "Completá tu perfil"); las cuentas nacen con `name` en null al entrar por email.
  Fuera de `src/`, el seed (`scripts/seed/lib.ts`) también lo tiene que escribir. Si aparece otro camino, va igual.
- **Backfill de los usuarios existentes** *(decisión de Claude)*: un script de Node en `backend/scripts/` que lee `users` con
  `wrangler d1 execute --remote`, calcula `name_search` con la misma función de `src/lib/` y escribe los `UPDATE` en un `.sql` que se
  corre con `wrangler d1 execute --remote --file`. Es idempotente (se puede correr de nuevo).
- **Orden del deploy:** migración → backfill → Worker con el endpoint → recién ahí la app (EAS Update o build). Una app que llama a
  `/users/search` contra un Worker viejo recibiría 404.
- Índice sobre `users.username` ya existe (único); `LIKE 'q%'` con `COLLATE` adecuado o `username >= q AND username < q || '{'`
  para usarlo, a elección del builder.

### Endpoint: `GET /users/search?q=…`

- Módulo `users` (`users.router.ts`, `users.service.ts`, `users.repository.ts`). Registrar la ruta **antes** de `/{userId}` o
  asegurarse de que "search" no choque con el param.
- `requireUser` + rate limit propio **`RL_SEARCH`** por usuario (binding nuevo en `wrangler.jsonc`, ~60 por minuto; no se usa
  `RL_EXPENSIVE` porque es de 20/min y lo comparten me gusta, subidas, etc.) *(decisión de Claude: el número)*. 429 con el mensaje
  de siempre.
- `q`: se normaliza en el server (no confía en la app). **400** si después de normalizar tiene menos de 2 o más de 30 caracteres.
  Escapar `%`, `_` y `\` en el `LIKE` (`ESCAPE '\'`); el `_` es válido en un @.
- **Quién sale:** usuarios con `username` y `name` no vacíos (las cuentas a medio crear no salen), que **no** sean vos, **no** sean
  tus amigos (los muestra la app desde su lista), y sin bloqueo en **ninguna dirección**.
- **Orden (decisión del dueño):**
  1. el @ exacto (`username = q`);
  2. más amigos en común primero (solo los que tienen > 0);
  3. el resto por nombre (`COLLATE NOCASE`), y `id` para desempatar.
- **Tope de 20, sin cursor ni paginación** (decisión del dueño).
- Respuesta:

  ```json
  {
    "users": [
      {
        "id": "uuid",
        "name": "Camilo Pérez",
        "username": "cami.p",
        "avatarUrl": "https://… | null",
        "mutualCount": 3,
        "friendRequest": "none | sent | received"
      }
    ]
  }
  ```

  `friendRequest` con la misma semántica que en `UserProfileSchema` *(decisión de Claude: igual que en el perfil, sin excepción para
  la lista)*: una rechazada se sigue viendo como `sent` ("Enviada") 30 días, porque el rechazo es silencioso; después vuelve a `none`.
  Nada de email, bio, badge, visibilidad ni rollos.
- Cuenta de amigos en común y estado de solicitud: calcularlos para las 20 filas en la misma consulta o en una segunda en lote, **no**
  una consulta por fila *(decisión de Claude)*. El orden por amigos en común necesita el conteo de todos los que coinciden antes del
  `LIMIT`; con la escala actual es aceptable, y si algún día pesa se cambia el orden, no el contrato.
- OpenAPI con su descripción (quién sale, orden, tope); después `npm run api:generate` en la app y commitear `schema.d.ts`.

## Tests

- **Backend:** normalización (tildes, `@`, mayúsculas, wildcards); el endpoint: matchea por @ y por palabra del nombre, no matchea
  en el medio de una palabra, excluye a vos, amigos, bloqueos en las dos direcciones y cuentas sin @ o sin nombre, respeta el orden y
  el tope de 20, 400 con `q` corto o largo, `friendRequest` y `mutualCount` correctos.
- **App (TDD, solo los tests relacionados con `--maxWorkers=2`):** la normalización y el filtro local de amigos (puros, en
  `__tests__/` de la feature); pantalla con `renderRouter` mockeando `@/features/friends/actions`: escribir muestra "Amigos" y
  "Personas", "Agregar" → "Enviada" optimista y vuelve si falla, "Aceptar", tocar la fila abre `/friends/user/<id>`, vacío, error
  con "Reintentar", menos de 2 caracteres no llama a la API.

## Documentación

Actualizar `CLAUDE.md` de la app (la tab Amigos con su búsqueda; sacar "buscar perfiles públicos" de "A futuro") y el del backend
(endpoint, `name_search`, `RL_SEARCH`).

## Lo que queda al builder

Nombres de archivos y componentes, cómo se hace el backfill, la consulta SQL exacta, cómo convive el `keepPreviousData` con el
optimista, y el layout fino de la pastilla (reusar `Button` en tamaño chico si existe, o una variante nueva de `src/ui/`).

## Pendiente aparte (no es parte de esta feature)

El dueño quiere investigar **cómo quedan cuentas sin @ o sin nombre**: se puede cortar "Completá tu perfil" a la mitad y la cuenta
queda creada. Según el dueño no debería estar permitido. La búsqueda simplemente no las muestra.
