# Rediseño del encabezado del Perfil — diseño

Fecha: 2026-11-25. Acordado con el dueño en una charla de brainstorming con maquetas (visual companion). Lo marcado
*(decisión de Claude)* lo puede cambiar el dueño. Toca los dos repos: la app (`mobile`) y `rollo-app/backend` (dos campos
nuevos en `GET /users/{userId}`).

## Para qué es

El encabezado del Perfil de hoy (foto de 80 pt a la izquierda, nombre `type.title` hasta 3 renglones al lado, descripción y
"12 amigos" debajo) no le termina de convencer al dueño: con un nombre largo la columna se aprieta al lado de la foto y la
barra queda vacía salvo los dos botones. Lo que sí quiere sumar son **números**: cuántos **rollos**, cuántas **fotos** y
cuántos **amigos** tiene la persona.

El mismo encabezado (`ProfileHeader`) es el de tu Perfil (`app/(tabs)/me/index.tsx`) y el del perfil de cualquier otro
(`src/features/friends/user-profile-screen.tsx`), así que el rediseño cubre los dos.

## Qué se eligió

Dirección **"C1 · Centrado con una línea de números"** (maqueta elegida por el dueño entre A centrado, B nombre como título
grande, C con números estilo Instagram y tres variantes de C):

```
            ( foto 96 )
           Juani Fraga
     @juanifraga  [FOUNDER]
  Sacando fotos en el casamiento      ← New York (serif), centrada
         de Sofi y Tomi.
   8 rollos · 34 fotos · 12 amigos    ← una línea gris, cifras en negrita
  ┌──────── Fotos | Mapa ────────┐
  ▢▢▢ grilla de punta a punta
```

Perfil de otra persona que no es tu amiga:

```
            ( foto 96 )
   Camila Rodríguez Etcheverry        ← se parte en renglones, centrado
          @camirodriguez
  Montevideo. Siempre con la cámara.
   5 rollos · 21 fotos · 48 amigos
        3 amigos en común
         ( Agregar amigo )            ← botón chico, centrado
  ┌──────── Fotos | Mapa ────────┐
```

- **Todo centrado**: foto de **96 pt** al medio, nombre debajo (`type.title`, centrado, hasta 3 renglones), `@usuario` y la
  insignia en la misma línea (el @ se corta al medio si no entra, como hoy), la descripción centrada en la serif del sistema
  (New York: el mismo detalle de personalidad que los captions).
- **Una línea de números** en texto secundario donde hoy dice "12 amigos": "**8** rollos · **34** fotos · **12** amigos", con
  las cifras en `colors.label` y semibold y las palabras en `colors.secondaryLabel`. Nada de cobalto: son datos, no acciones.
- **Se fue "Lugares"** (cantidad de zonas de ~5 km del mapa): el dueño prefirió **rollos**.
- "Fotos | Mapa", la grilla de punta a punta, la barra (actividad y ajustes en tu Perfil; "…" en el de otro) y lo que viene
  debajo (solicitud, "Rollos en común", "Sumar a un rollo", "Borrar amigo", "Este perfil es privado", "Desbloquear") **no
  cambian**, salvo la forma del botón de solicitud (ver abajo).

## Qué significa cada número

- **Rollos:** cantidad de rollos **revelados** donde la persona es **miembro activo** (`members.removed_at` y `left_at` nulos,
  rollo no borrado). "Revelado" usa el mismo predicado que las destacadas (`VISIBLE_WHERE` en `featured.repository.ts`:
  `revealed_at IS NOT NULL OR reveal_at <= now`), así los dos números nunca se contradicen *(decisión de Claude)*. Incluye eventos. Cuenta los archivados (archivar es orden personal) *(decisión
  de Claude)*. Los rollos sin revelar no cuentan: un rollo en curso es "secreto" hasta el revelado *(decisión de Claude, aceptada
  implícitamente al elegir "con rollos")*. El número no revela qué rollos son ni su nombre (la regla "un rollo solo existe para
  sus miembros" se mantiene: es un total).
- **Fotos:** cantidad de **fotos destacadas** en su perfil (las mismas que muestra la grilla, tope 60).
- **Amigos:** el `friendCount` de hoy.

## Quién ve qué

- **Rollos y fotos solo si `canSee`** (sos vos, es tu amigo o su perfil es público), igual que las destacadas *(decisión de
  Claude)*. Sin `canSee` la línea queda solo con amigos ("48 amigos"), como hoy, y debajo sigue "Este perfil es privado".
- **Amigos** se ve siempre, como hoy (con las reglas actuales de `formatFriendCount`: en el de otro con 0 amigos no se muestra;
  con lista oculta y 0 en común, tampoco).
- **"N amigos en común"** pasa a un renglón propio debajo de la línea de números (texto secundario, `footnote`), en vez de ir
  pegado con " · 3 en común". Solo en el perfil de otro y si es > 0.

## Ceros y singulares

- Se **omite cada número que vale 0** *(decisión de Claude)*: una cuenta nueva no muestra "0 rollos · 0 fotos". Si en tu
  Perfil quedan los tres en 0, la línea dice "Todavía no tenés amigos" (como hoy) y lleva a la tab Amigos.
- Singulares: "1 rollo", "1 foto", "1 amigo". Miles con punto ("1.284"), como `formatFriendCount`.

## Qué se toca

- **"N amigos"** sigue siendo tocable con el mismo destino de hoy (tu Perfil → tab Amigos; el de otro → `/user/<id>/friends`).
  Solo ese tramo de la línea es el botón (`Text` anidado con `onPress`, o la línea entera como `Pressable` con el label de
  VoiceOver "12 amigos"; lo decide quien implementa mientras el área tocable sea razonable) *(decisión de Claude)*.
- **"N amigos en común"** también abre `/user/<id>/friends`.
- **Rollos y fotos no se tocan** *(decisión de Claude)*: la grilla de fotos está justo debajo, y en el perfil de otro los rollos
  no se pueden listar. Queda abierto para después que "rollos" en tu Perfil abra "Tus rollos".
- VoiceOver lee la línea como una frase: "8 rollos, 34 fotos, 12 amigos".

## Botón de solicitud (perfil de otro)

`FriendRequestButton` pasa a botones **chicos y centrados** (`Button size="small"`), como en la maqueta: "Agregar amigo";
"Solicitud enviada" (secundario); y "Aceptar solicitud" + "Rechazar" uno al lado del otro, centrados *(decisión de Claude, sale
de la maqueta)*. El error sigue inline debajo, centrado. Lógica y optimismo no cambian.

## Backend (`rollo-app/backend`)

- `GET /users/{userId}` (`UserProfile`) suma **`rollCount: number | null`** y **`featuredCount: number | null`**: `null` cuando
  `!canSee`. Se calculan en el server para que la línea salga completa junto con el encabezado, sin esperar la grilla
  *(decisión de Claude)*.
- `rollCount` con la definición de arriba; `featuredCount` = cantidad de destacadas visibles del dueño (mismo filtro que
  `GET /users/{userId}/featured`: sin archivadas, sin las de autores bloqueados o que ya no son amigos, etc.). Conviene sacar el
  conteo de la misma consulta/filtro que el listado para que nunca difieran. Ojo: ese listado depende de **quién mira**
  (`hiddenMediaSql` con el id del viewer), así que `featuredCount` es "las que vos ves en su grilla", no un total global.
- Tests del backend para: miembro activo vs. se salió / lo sacaron, revelado vs. sin revelar, rollo borrado, archivado (cuenta),
  `canSee` falso → `null`, y tu propio perfil.
- Rama del backend con el **mismo nombre** que la de la app (`feature/perfil-rediseno`) para que el job `contract` del CI compare
  contra ella. Después `npm run api:generate` en la app y commitear `schema.d.ts`.

## App

- **Tu Perfil** hoy no pide `GET /users/{id}` (usa `useMe()` + `useFriends()`). Para los números nuevos usa
  **`useUser(me.id)`** (la misma query del perfil de otro) *(decisión de Claude)*; amigos sigue saliendo de `useFriends()` para que
  cambie al toque. Mientras `useUser` carga, la línea muestra solo amigos (sin hueco que salte: se acepta que rollos y fotos
  aparezcan un instante después). Excepción: con 0 amigos no se muestra "Todavía no tenés amigos" hasta que `useUser` resuelva,
  para que no aparezca y se reemplace enseguida *(decisión de Claude)*. Para que "fotos" no quede viejo al destacar o sacar una foto, se usa el largo de la grilla ya
  cargada (`useFeatured`, que ya se invalida en todos esos casos) y `featuredCount` solo mientras la grilla no cargó.
- `ProfileHeader`: nuevo layout centrado; recibe los números ya resueltos (p. ej. `stats: { rolls?: number | null; photos?:
  number | null; friends: {...} }`). La forma exacta de las props la decide quien implementa (evitar props booleanas nuevas; ver
  "Composición" en `CLAUDE.md`).
- `friend-count.ts` → se generaliza a un formateador de la línea (`formatProfileStats` o similar) con tests: ceros omitidos,
  singulares, miles, `canSee` falso, el caso "Todavía no tenés amigos" y "N amigos en común" aparte.
- `worst-case-fixtures.ts` / `worst-case-screen.tsx` (break-ui): sumar números grandes ("1.284 amigos"), un nombre de 3 renglones
  centrado, insignia FIRST EDITION + @ largo en una línea, y texto grande de iOS.
- `CLAUDE.md`: actualizar "Navegación y diseño → Perfil", "Perfil de cualquier usuario" e "Insignias" (la insignia pasa a ir al
  lado del @, no debajo del nombre).

## No objetivos

- Cambiar "Fotos | Mapa", la grilla, el mapa por zonas, la barra o las secciones de amigo.
- Hacer tocables rollos o fotos.
- Mostrar qué rollos son, o contar rollos sin revelar.
- Editar el perfil desde el encabezado (sigue en Ajustes → "Editar perfil").

## Anti-objetivos (aunque ande, sería un fracaso si…)

- Se ve como Instagram: contadores grandes en una barra al lado de la foto. Por eso los números van en **una línea de texto**
  debajo de la descripción.
- El número de rollos deja adivinar algo de un rollo que no es tuyo (nombre, fechas, que existe uno en curso).
- Cobalto en los números o en la línea.
- La línea "salta" o cambia de alto de forma notoria al cargar.

## Alternativas consideradas

- **A · Centrado sin números**: la base de lo elegido; el dueño quería números.
- **B · Nombre como título grande del stack**: llena la barra, pero un nombre largo se corta con "…".
- **C · Números al lado de la foto** (estilo Instagram): le gustaron los números, pero "se parece mucho a Instagram".
- **C2 · Centrado con números grandes en New York y filetes** y **C3 · como hoy con números abajo**: descartados por el dueño
  a favor de la línea simple (C1).
- **Lugares** como tercer número: cantidad de zonas de ~5 km de las destacadas; dice poco (depende de qué destacaste, no de dónde
  estuviste) y repite al segmento Mapa. Reemplazado por rollos.

## Lo que queda a criterio de quien implementa

- Espaciados finos (dentro de los tokens de `spacing`) y si el nombre usa `type.title` o `type.title2` centrado mientras se vea
  como en la maqueta.
- Cómo se arma el área tocable de "N amigos" dentro de la línea.
- La forma de las props de `ProfileHeader`.
