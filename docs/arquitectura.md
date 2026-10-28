# Arquitectura de la app

Cómo está organizado el repo `mobile` y qué patrones seguimos. El "qué hace la app" está en `CLAUDE.md`; acá va el "cómo".

## Las tres capas

```
app/            rutas de Expo Router (el archivo es la URL). Solo rutean.
src/features/   un dominio por carpeta: auth, trips, capture, map, gallery, friends, profile…
src/api | ui | storage | test   lo compartido: cliente HTTP, primitivas visuales, SecureStore, helpers de tests
```

Fuera de `src/`: `modules/rollo-symbol` (módulo nativo en Swift), `plugins/` (config nativa), `ios/` (generado por
`expo prebuild`, no se versiona), `site/` y `scripts/` (sitio público e íconos), `docs/` (legales y specs).

Cada feature tiene la misma forma:

| Archivo | Rol | Parecido en backend |
| --- | --- | --- |
| `actions.ts` | llamadas HTTP con el cliente tipado | repositorio |
| `use-*.ts` | hooks: lecturas (`useQuery`) y escrituras (`useMutation`) con el cache | servicio |
| `*.ts` sin React | lógica pura (fechas, cupos, agrupaciones), testeada sola | dominio |
| `*-screen.tsx`, `*.tsx` | pantallas y componentes | controller / vista |
| `__tests__/` | tests de todo lo anterior, al lado del código | |

## Cómo viaja un dato

Pantalla → hook (`useTripDetail`) → `actions.ts` → `authedClient()` → `openapi-fetch` → backend.

- El cliente sale del contrato: `npm run api:generate` arma `src/api/schema.d.ts` desde el `openapi.json` del backend, así
  que si el backend cambia un campo TypeScript marca dónde se rompe. El job `contract` del CI falla si quedó atrás.
- `unwrap()` convierte un error del server en `ApiError` (con su mensaje) y la falta de red en `OFFLINE_MESSAGE`.
- Un `401` en cualquier llamada cierra la sesión local (`setUnauthorizedHandler`).

Dónde vive cada dato en el celular:

- **Lo que viene del server:** cache de TanStack Query persistido en disco (`rollo.query-cache`). Por eso abre sin señal.
- **Secretos y marcas chicas:** SecureStore (`src/storage/`): sesión, rollo activo, "ya vio el revelado".
- **Fotos sin subir:** cola SQLite + archivos en `Documents/pending/`; la sube `capture/uploader.ts` en primer plano o
  con la tarea de fondo de iOS.

`app/_layout.tsx` monta el cache y los disparadores de sync y decide con `Stack.Protected` qué se ve según el estado de
la cuenta (`loading` / `login` / `profile` / `app`): no hay forma de llegar a una pantalla sin sesión.

## Patrón: rutas finas

Un archivo de `app/` solo traduce la URL en props y monta la pantalla de su feature. Nada de estado, efectos, llamadas
a la API ni al cache.

```tsx
// app/join.tsx
import { JoinScreen } from "@/features/trips/join-screen";

export default function JoinRoute() {
  return <JoinScreen />;
}
```

Si la ruta tiene params, los lee y los pasa ya validados (ver `app/login.tsx`). La configuración de presentación
(modal, sheet, título) sigue en `app/_layout.tsx`; lo que la pantalla pone en su propio header (`Stack.Toolbar`,
`Stack.Screen options`) va dentro de la pantalla de la feature.

## Patrón: escrituras con `useMutation`

Toda escritura al server (o a la cola local) es un hook `use-<verbo>-<cosa>.ts` en su feature que envuelve `useMutation`:

```ts
// src/features/trips/use-join-trip.ts
export function useJoinTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string }) => joinTrip(input),
    // Cache: what this write makes stale. Returning the promise makes the mutation wait for it.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myTripsKey }),
  });
}
```

```tsx
// src/features/trips/join-screen.tsx
const join = useJoinTrip();
const error = errorMessage(join.error, "No se pudo entrar al rollo");

join.mutate({ code }, {
  onSuccess: () => {
    router.dismissTo("/roll");
    void offerPushAfterJoining();
  },
});
// join.isPending → spinner;  {error && <ErrorText>{error}</ErrorText>}
```

Reglas:

- **`mutationFn` siempre con lambda** (`(input) => joinTrip(input)`), nunca la action directo: TanStack Query v5 le pasa
  un segundo argumento (el contexto de la mutación), que una action con un parámetro opcional tomaría como propio, y
  que rompe los `toHaveBeenCalledWith` de los tests.
- **El hook es dueño del cache** (invalidar, `setQueryData`, `removeQueries`). Así ninguna pantalla se olvida de refrescar
  lo que la escritura cambió, y la misma escritura desde dos lugares se comporta igual.
- **La pantalla es dueña de lo que pasa después** (navegar, ofrecer el permiso de push, cerrar la sheet), con el
  `onSuccess` del `mutate`. Ese callback no corre si la pantalla ya se desmontó, que es lo que queremos.
- **Errores:** `errorMessage(mutation.error, "<fallback en español>")` de `@/api/client` y `ErrorText` inline. Nada de
  `try/catch` + `setError` + `setLoading` a mano: `isPending` y `error` ya los da la mutación. Si hay que limpiar el error
  al reintentar, `mutation.reset()`.
- **Confirmaciones** (`Alert.alert` antes de algo destructivo) pueden vivir en el hook si toda escritura de ese tipo la
  pide (ver `useLeaveTrip`).
- Defaults (`src/api/query-client.ts`): `networkMode: "always"` y `retry: 0`. Una mutación corre enseguida y, sin señal,
  falla una vez con `OFFLINE_MESSAGE` en vez de quedar pausada en silencio. La cola de fotos (local) también depende de esto.
- Las lecturas siguen con `useQuery` y su key exportada (`myTripsKey`, `tripKey(id)`), que es lo que invalidan las mutaciones.

### Estado de la migración

Las pantallas de `app/` y los hooks `use-*.ts` de escritura ya siguen el patrón. Todavía hay componentes con
escrituras a mano (`try/catch` + estado propio): `gallery/photo-viewer.tsx`, `feed/feed-list.tsx`,
`featured/featured-viewer.tsx`, `friends/invite-friend.tsx`, `friends/friend-sections.tsx`,
`friends/add-friends-sheet.tsx`, `profile/profile-form.tsx` y `profile/avatar-crop.tsx`. Se pasan al patrón cuando se
toquen por otro motivo; lo nuevo nace con `useMutation`.
