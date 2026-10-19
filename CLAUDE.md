# Rollo — app mobile

Contexto para Claude Code. Respondé en español rioplatense (voseo), conciso y con recomendaciones directas.
La UI de la app también va en rioplatense con voseo ("Sumate", "Abrí un rollo", "Te quedan 3 fotos").

## Qué es Rollo

App iOS para fotos y videos de viaje en grupo. Cada uno saca fotos durante el viaje y **nadie ve nada
—ni siquiera lo propio— hasta el revelado al final**, como un rollo de fotos. Pensada para un viaje con
amigos al sur de Argentina en **enero de 2027** (mucho tramo sin señal) y para armar fotolibros después.

Decisiones de producto:

- **Solo iOS** en la primera versión. **Sin cuentas:** crear viaje o unirse con código de 6 + nombre;
  el token de cada viaje va al llavero (SecureStore).
- **Cámara nativa del sistema** (`expo-image-picker` → `launchCameraAsync`), no una cámara propia:
  funciona mejor, sobre todo en video. Lo que se saca **no queda en el carrete**: se sube y se borra
  del caché local.
- **Fotos a resolución completa** (~4000 px, JPEG 85–90 %, para imprimir) + **thumbnail ~800 px** que
  genera el celular. **Videos de hasta 15 s**, comprimidos a 1080p en el celular.
- **Límite diario** de fotos y videos por persona (lo aplica el server).
- **Offline first:** al disparar se guardan foto, hora (UTC + zona) y GPS. Pedir ubicación apenas se
  abre la cámara; sin fix, usar la última conocida y guardar su precisión. Cola local en SQLite, subida
  en segundo plano cuando hay señal, **UUID generado en el celular** (reintentar es seguro).
- **Antes del revelado** no se ve ninguna foto. Para que den ganas de abrir la app: **mapa en vivo**
  con pins (autor y hora, sin imagen), **feed de epígrafes** y contador del rollo.
- **Modo viaje:** una notificación por día a un horario random distinto para cada uno, con un
  disparador opcional. Ese "momento" es foto principal + selfie, con cámara propia
  (`react-native-vision-camera` o `expo-camera`); la selfie chica (~1080 px).
- **Después del revelado:** galería, mapa con fotos, timeline por día, descarga y export para fotolibro.

El backend vive en [rollo-app/backend](https://github.com/rollo-app/backend).

## Stack

- **Expo SDK 58**, React Native 0.88, **Expo Router**, TypeScript estricto. Node **>= 22.13** (`.nvmrc`).
- **Development build** (`expo-dev-client`): Expo Go de la App Store está trabado en un SDK viejo.
- Cliente de la API **generado del contrato**: `openapi-typescript` → `src/api/schema.d.ts` (no editar
  a mano) + `openapi-fetch`. `unwrap()` convierte el `{ error }` del server en `ApiError`.
- `ios/` es generado (`npx expo prebuild`) y está en `.gitignore`. La config nativa va en `app.json`.

```
app/                  rutas (Expo Router): index, create, join, trip/[id]
src/api/              schema.d.ts generado + client.ts
src/features/trips/   acciones (crear, unirse, cargar) — lo que mockean los tests de pantallas
src/storage/          sesiones de viaje en SecureStore
src/ui/               tema (claro/oscuro, acento naranja) y componentes: Screen, Title, Body, Button, Field, Card
__tests__/            tests de pantallas
```

## Cómo trabajamos

- **TDD siempre:** primero el test (descripciones en español), verlo fallar, código mínimo, refactor.
  - Lógica (`src/**/__tests__`): `fetch` simulado con `globalThis.fetch = jest.fn(...)`.
  - Pantallas: `renderRouter` de `expo-router/testing-library` con navegación real, mockeando
    `@/features/*/actions`. En Testing Library 14 **`fireEvent` es async**: siempre `await fireEvent...`.
  - `jest.setup.ts` mockea SecureStore en memoria.
- **Si el backend cambia la API:** `npm run api:generate` (o `API_SPEC=../backend/openapi.json npm run api:generate`)
  y commiteá `schema.d.ts`. El job `contract` del CI falla si quedó atrás.
- **Ramas:** `develop` es la default. Features en `feature/*` desde `develop`, vuelven por PR con CI
  en verde. `main` es producción (PR + CI + 1 aprobación, el admin puede saltearla). Sin push directo.
- Mensajes de commit y PR en español.
- Al agregar paquetes nativos: `npx expo install <paquete>` (respeta las versiones del SDK) y después
  rebuild con `npx expo run:ios --device`. `.npmrc` tiene `legacy-peer-deps=true` por un conflicto de peers del SDK 58.

```bash
npm test                      # 29 tests
npm run test:watch
npm run typecheck
npx expo run:ios --device     # compila e instala el dev build en el iPhone
npm start                     # día a día, con el dev build ya instalado
```

**Contra el backend local** (todavía no está deployado):

```bash
# en ../backend
npm run dev -- --ip 0.0.0.0
# acá
EXPO_PUBLIC_API_URL=http://$(ipconfig getifaddr en0):8787 npx expo start --clear
```

## Apple

- Desarrollo: cuenta gratis de Apple (Personal Team). El build vence a los 7 días y se reinstala con
  el mismo comando. Push notifications, Universal Links y TestFlight **no** funcionan con esta cuenta.
- Para TestFlight y push se va a usar la cuenta de desarrollador de un amigo (cuenta **individual**: no
  permite sumar miembros, él tiene que pasar el código de 2FA). Hacer el primer build de TestFlight
  con tiempo: la primera revisión para testers externos puede tardar.
- Bundle id: `com.juanifraga.rollo` (con Personal Team puede hacer falta un sufijo como `.dev`).

## Estado y plan (octubre 2026)

Hecho: crear viaje, unirse con código, lista de viajes, detalle (código para compartir, miembros, cupo
del día), cliente tipado, CI. Corre en el iPhone con dev build contra el backend local.

Plan para llegar a enero (regla: **nada nuevo después de mediados de diciembre**, solo arreglos):

1. **Cámara y subida offline** (lo central): captura nativa foto/video, GPS, compresión + thumbnail,
   cola en `expo-sqlite`, subida en segundo plano a las URLs firmadas, `complete`, borrar local.
   Paquetes a evaluar para el SDK 58: `expo-image-picker`, `expo-location`, `expo-sqlite`,
   `expo-image-manipulator`, `expo-file-system` (subida en background), `expo-video-thumbnails`,
   `react-native-compressor`.
2. **Antes del revelado:** mapa con pins (`react-native-maps`) + feed de epígrafes + contador.
3. **Revelado:** galería, mapa con fotos, timeline por día, descarga.
4. **Modo viaje:** push con Expo, momento doble (principal + selfie). Es lo primero que se recorta si no llegamos.
5. **Prueba real** en una escapada corta con amigos, antes del viaje.
6. TestFlight con la cuenta del amigo.
