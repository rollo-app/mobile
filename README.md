# rollo-mobile

App de **Rollo** para iOS (y Android más adelante): Expo SDK 58, React Native, TypeScript y Expo Router.

```
app/                    pantallas (Expo Router: cada archivo es una ruta)
  _layout.tsx           navegación y tema
  index.tsx             tus viajes
  create.tsx            crear un viaje
  join.tsx              unirse con un código
  trip/[id].tsx         detalle del viaje
src/
  api/schema.d.ts       tipos generados del contrato del backend (no editar a mano)
  api/client.ts         cliente tipado (openapi-fetch) + ApiError
  config.ts             URL del backend
  features/trips/       acciones de viajes (crear, unirse, cargar)
  storage/trips.ts      viajes y tokens en el llavero del celular (SecureStore)
  ui/                   componentes y tema (claro/oscuro)
__tests__/              tests de pantallas
```

## Correr la app en el iPhone

Expo Go de la App Store va atrasado varios SDKs, así que usamos un **development build**
(nuestra propia app de desarrollo, que además soporta módulos nativos).

Requisitos (una sola vez):
- Node 22 (`nvm use` toma la versión del `.nvmrc`).
- Xcode instalado y abierto al menos una vez. En Xcode → Settings → Accounts, agregá tu Apple ID.
- iPhone por cable, con **Modo desarrollador** activado (Ajustes → Privacidad y seguridad → Modo desarrollador).

```bash
nvm use
npm install
npx expo run:ios --device   # elegí tu iPhone de la lista
```

La primera vez, si falla la firma: abrí `ios/Rollo.xcworkspace` en Xcode, en *Signing & Capabilities*
elegí tu *Personal Team*, y volvé a correr el comando. En el iPhone, confiá en el certificado
(Ajustes → General → VPN y gestión de dispositivos).

Con la cuenta gratis de Apple el build vence a los 7 días: se vuelve a instalar con el mismo comando.
Después del primer build, para el día a día alcanza con `npm start` y abrir la app Rollo en el iPhone.

Contra el backend local en vez del de producción:

```bash
# en rollo-app/backend
npm run dev
# acá, con la IP de tu Mac en la red local
EXPO_PUBLIC_API_URL=http://192.168.1.50:8787 npm start
```

## Contrato con el backend

No hay tipos escritos a mano para la API: salen del `openapi.json` que publica
[rollo-app/backend](https://github.com/rollo-app/backend).

```bash
npm run api:generate                                    # desde develop del backend
API_SPEC=../backend/openapi.json npm run api:generate   # desde tu copia local
```

Si el backend cambia un endpoint, TypeScript marca en la app todo lo que hay que ajustar.
El job `contract` del CI avisa si `src/api/schema.d.ts` quedó atrás del backend.

## Tests

```bash
npm test             # todo
npm run test:watch   # modo watch para TDD
npm run typecheck
```

- **Lógica** (`src/**/__tests__`): cliente de la API, sesiones en SecureStore y acciones de viajes, con `fetch` simulado.
- **Pantallas** (`__tests__/screens.test.tsx`): navegación real con `renderRouter` de Expo Router; las acciones se mockean.

Trabajamos en TDD: primero el test que describe el comportamiento (en español), lo vemos fallar,
después el código mínimo para que pase, y recién ahí refactor.

> En Testing Library 14, `fireEvent` es async: siempre `await fireEvent.press(...)`.

## Ramas

`develop` es la rama por defecto; las features salen de ahí (`feature/...`) y vuelven por PR.
`main` es producción. Ver las reglas en Settings → Rules.

> `.npmrc` tiene `legacy-peer-deps=true` por un conflicto de peers entre `react` y `react-dom` en el SDK 58.
