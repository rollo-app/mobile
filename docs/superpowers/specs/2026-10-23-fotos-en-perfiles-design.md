# Tus fotos en otros perfiles — diseño (para el próximo build)

Fecha: 2026-10-23. Acordado con el dueño: entra en el **build de TestFlight siguiente**, junto con los comentarios y "Tu actividad".
Antes de implementarlo, pasar por un plan (`docs/superpowers/plans/`) como el resto. Lo marcado *(decisión de Claude)* lo puede
cambiar el dueño.

## Por qué

Hoy el autor solo puede frenar que otros destaquen sus fotos **foto por foto** ("No dejar que la destaquen" en el "…" del visor).
Falta poder decirlo para un rollo entero o para todas tus fotos. Es otra cosa que el perfil privado: el perfil privado decide
**quién ve tu perfil**; esto decide **adónde pueden ir tus fotos**. Por ejemplo: perfil público, pero las fotos de cierto rollo no
salen a perfiles de otros.

## Lo decidido

Cuatro niveles. **Gana el más restrictivo.**

1. **Para todas tus fotos** (Ajustes → Privacidad): switch "Permitir que agreguen mis fotos a su perfil". Prendido por defecto (como hoy).
   Va en `user_settings` *(decisión de Claude)*.
2. **Por rollo, tus fotos de ese rollo**: switch "Tus fotos en otros perfiles" en el rollo (tablero antes del revelado y segmento
   "Rollo" después). Prendido por defecto. Es por miembro (columna en la membresía).
3. **Por foto**: lo que ya existe ("No dejar que la destaquen" / "Dejar que la destaquen").
4. **Rollo privado** (lo elige el admin al crear el rollo y lo puede cambiar después): "Ninguna foto de este rollo sale a perfiles".
   Con esto prendido nadie puede destacar fotos del rollo, **ni siquiera el autor las suyas**. Va con la regla de que lo que sale de
   un rollo es decisión del grupo.

- **El autor siempre puede destacar sus propias fotos**, salvo con el rollo privado (nivel 4).
- **Al apagar un nivel se limpia**: se borran de los perfiles de otros las fotos que ese nivel ahora frena (y, con el rollo privado,
  también las del propio autor). Igual que hoy con una foto. El dueño del perfil no recibe aviso.
- **Volver a prender** no devuelve nada: solo permite destacar de nuevo.
- En el visor, si la foto no se puede destacar, el ícono de "Agregar a tu perfil" no aparece *(decisión de Claude)* (el server ya
  devuelve si se puede, como `featureBlocked`).

## Backend

- Migración: `user_settings.allow_featuring` (default 1), columna por miembro en la membresía (p. ej. `trip_members.allow_featuring`,
  default 1), `trips.featuring_disabled` (default 0).
- La regla de "¿se puede destacar esta foto?" vive en un solo lugar y la usan destacar, el feed revelado (`featureBlocked` o uno nuevo
  `canFeature`) y la limpieza.
- API: `PATCH /me/settings` suma `privacy.allowFeaturing`; `PATCH /trips/{id}/me` (o similar) para el switch del miembro; crear /
  editar rollo suma `featuringDisabled` (solo el admin).
- Tests: cada nivel frena a otros; el autor puede salvo en rollo privado; la limpieza al apagar cada nivel; prender no restaura.

## App

- Ajustes: sección "Privacidad" con el switch (junto a "Perfil público").
- Rollo: switch "Tus fotos en otros perfiles" con footnote; en crear rollo, "Rollo privado" con su explicación.
- Visor y menú de la grilla: sin la opción de agregar cuando no se puede.
