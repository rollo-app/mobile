# Comentarios en las fotos reveladas — plan

Diseño: `docs/superpowers/specs/2026-10-23-comentarios-design.md` (las *decisiones de Claude* están aprobadas).
Ramas: `feature/comentarios` en mobile y en backend (worktree `backend-worktrees/comentarios`). TDD en las dos.
Todo aditivo: un cliente viejo sigue andando (endpoints nuevos, campos opcionales).

## Backend (`src/modules/comments/`)

1. **Migración** `0020_comments.sql`:
   - `comments(id, media_id → media CASCADE, user_id → users CASCADE, text, created_at, deleted_at)` + índices por `media_id`.
   - `reports.comment_id` (→ comments CASCADE) + índice único `(reporter_id, comment_id)`. El índice de denuncias a personas
     (`idx_reports_user`) pasa a `WHERE media_id IS NULL AND comment_id IS NULL`, si no una denuncia de comentario chocaría con la de la persona.
   - `media.comment_notified_at`, `media.comments_since_notified` (anti-spam, igual que los "me gusta").
   - `user_settings.notify_photo_commented` (default 1).
2. **Contrato:** `GET /media/{mediaId}/comments`, `POST /media/{mediaId}/comments` (`{ text }`, 1–500, 201), `DELETE /comments/{commentId}` (204),
   `commentId` en `POST /reports`, `commentCount` en los ítems del feed revelado, `photoCommented` en `NotificationSettings`.
3. **Permisos:** miembro activo de un rollo revelado, foto (no video: 400), no borrada, no denunciada por vos ni de un autor bloqueado;
   si no, 404. Borra el autor del comentario o el de la foto (403 a otro miembro, 404 a quien no ve la foto). Soft delete (`deleted_at`).
   Se ocultan los comentarios de usuarios bloqueados (en cualquier sentido) y los que denunciaste.
4. **Push `photoCommented`** (`src/lib/comments.ts`): "Cami comentó tu foto" al autor y "Cami también comentó una foto" a quienes ya
   comentaron (miembros activos), con la ventana anti-spam de 30 min por foto ("Cami y 3 más comentaron tu foto"). Abre
   `/photo/<id>?tripId=<trip>&comments=1`.
5. Borrar cuenta borra sus comentarios; `npm run openapi`; actualizar el CLAUDE.md del backend.

## App (`src/features/comments/`)

1. `npm run api:generate` desde el `openapi.json` del backend.
2. Lógica pura (`format`/validación del texto, tiempo relativo) y `actions.ts`.
3. Hooks: `use-comments` (query), `use-add-comment`, `use-delete-comment` (mutations que invalidan la lista y el feed).
4. Sheet de comentarios (`/comments/[mediaId]`, `comments-screen.tsx`): lista (avatar, nombre, texto, hace cuánto), campo abajo, borrar
   (propio o si sos el autor de la foto) y denunciar (menú; reutiliza `moderation`).
5. Visor de la galería: burbuja `bubble.left` (con cantidad) en la fila de íconos que abre la sheet. No en destacadas ni videos.
6. Ajustes → Notificaciones: switch `photoCommented`. Push: `comments=1` abre la sheet sobre la foto.
7. CLAUDE.md de la app.

## Terminado

`npm test` y `npm run typecheck` en verde en los dos repos, dos PRs en draft que se citan, sin mergear.
