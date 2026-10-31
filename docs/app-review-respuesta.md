# Respuesta a App Review (Guideline 2.1 – Information Needed)

Pegar el bloque en inglés en **dos lugares**: como respuesta en Resolution Center y en
App Store Connect → la versión → *App Review Information* → *Notes*. Adjuntar el video en la respuesta.

Antes de mandar, completar los `<…>` y verificar que `REVIEW_EMAIL` / `REVIEW_CODE` estén cargados como secrets
del Worker de producción (`npx wrangler secret list`).

---

## Texto para Apple (inglés)

Hello, thank you for the review. Below is the requested information. A screen recording captured on a physical
iPhone running iOS <versión> is attached.

**1. Screen recording**
The attached video starts by launching the app and shows: sign-in with email + one-time code, completing the
profile, creating a "rollo" (shared album), taking a photo, viewing a revealed rollo (gallery, map, feed),
adding a friend, reporting a photo, reporting and blocking a user, the blocked-users list, and deleting the
account (Settings → Delete account).

**2. Purpose and target audience**
Rollo is a shared, disposable-camera-style photo app for groups of friends (a trip, an event, a party).
Everyone in a "rollo" takes photos during the event, but nobody can see them — not even their own — until the
"reveal" date chosen by the group, like developing a film roll. After the reveal, the group gets a shared
gallery, a map and a timeline of the event, and can save the photos.
It is aimed at adults and young adults who travel or attend events together. It solves the problem of photos
ending up scattered across everyone's phones and chats, and brings back the anticipation of a film camera.
The app is free, has no ads, no in-app purchases and no paid content.

**3. How to access the app**
Login is passwordless (email + 6-character code). Demo account:
- Email: `<REVIEW_EMAIL>`
- Code: `<REVIEW_CODE>` (always valid for this email; no email is sent)

Steps:
1. Open the app, enter the email above, tap Continue, enter the code.
2. "Tus rollos" shows the demo rollos. "Budapest" is already revealed: open it to see the gallery, map and
   feed with photos taken by another user (Juani Fraga). "review 2.0" is in progress: tap the camera to take a
   photo (it stays hidden until the reveal).
3. To create a new rollo: "+" → name and dates.
4. Report content: in "Budapest", open any photo → "…" → "Denunciar". Report/block the author: tap their name
   to open their profile → "…" → "Denunciar" / "Bloquear". Blocked users: Settings → "Bloqueados".
5. Delete account: Settings → "Borrar cuenta" (bottom of the screen). Deletion is immediate and permanent.
   Please use a new email if you test deletion, so the demo account stays available.

The app requests camera, photo library (to save photos), location (to place photos on the map) and
notifications; all are optional except the camera to take photos.

**4. External services**
- Cloudflare (Workers, D1, R2): our backend, database and photo/video storage.
- Resend: sends the sign-in code email and moderation alerts to us.
- Expo Push Notification service / Apple Push Notification service: push notifications.
- OpenFreeMap (OpenStreetMap data): map tiles, loaded directly by the device.
- Expo / EAS: build and over-the-air update tooling.
No AI services, no analytics, no ads, no payment processors, no third-party login.

**5. Regional differences**
The app works the same in all regions. The interface is currently in Spanish only.

**6. Regulated industry / third-party material**
Not applicable. Rollo is not in a regulated industry and contains no protected third-party content; all
photos are taken by users. User-generated content is moderated: users can report photos and users and block
users; every report and block sends us an email and we act within 24 hours (removing the content and/or the
account).

---

## Guion del video (grabar en el iPhone, iOS al día)

Grabación de pantalla desde el Centro de Control, en un solo tirón (o pocos cortes), ~2–4 min:

1. Arrancar con la app cerrada y abrirla desde el home.
2. **Registro**: email nuevo → código → "Completá tu perfil" (nombre, @usuario, foto).
3. Crear un rollo, sacar una foto (mostrar que queda oculta).
4. Entrar a un rollo **revelado** con fotos de otra persona: galería, mapa, feed.
5. Agregar un amigo / ver un perfil.
6. **Denunciar una foto** ("Denunciar" en el visor) y **denunciar + bloquear a un usuario** desde su perfil.
7. Ajustes → "Bloqueados" (mostrar que aparece; opcional desbloquear).
8. Cerrar sesión y volver a entrar (login).
9. Ajustes → **"Borrar cuenta"** → confirmar → vuelve al login.

Tip: usá para el registro/borrado una cuenta descartable, no la de review.

## Checklist antes de reenviar

- [x] `REVIEW_EMAIL` y `REVIEW_CODE` cargados en producción (falta probar el login en el build que se mandó).
- [x] La cuenta de review (@appreviewer) tiene "Budapest" **revelado con 8 fotos de Juani** (creado con
      `npm run review:rollo` en el backend, 31/10/2026) y "review 2.0" **en curso** (se revela el 30/11).
- [ ] Si Apple denuncia una foto de "Budapest", no hace falta borrarla: son fotos de prueba.
- [ ] Mismo email y código en *Sign-In Information* de App Store Connect.
- [ ] Screenshots de la ficha muestran la app en uso (no solo login/splash).
- [ ] Video adjunto en la respuesta.
