# Recorrido en video · paso 1: módulo de video y exportación de la demo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el dev build del iPhone pueda exportar la demo del Reel como un mp4 de 1080×1920 y medir cuánto tarda, con el módulo nativo que después va a usar "Recorrido".

**Architecture:**
- Un módulo local de Expo en Swift, `modules/rollo-video`, recibe cuadros (como bytes BGRA o como textura de Metal) y los escribe con `AVAssetWriter`. Su núcleo, `VideoWriter.swift`, no importa Expo y se prueba en la Mac.
- En JS, `export-film.ts` reparte la exportación en tandas (avance, cancelar, segundo plano) y `frame-source.ts` dibuja cada cuadro en una superficie de Skia fuera de pantalla y se lo pasa al módulo.
- El prototipo (sin commitear) se corre a un lado y gana un botón para exportar la demo con esas piezas. Así se mide en el teléfono antes de portar el motor.

**Tech Stack:** Swift (AVFoundation, CoreVideo, Metal, UIKit), Expo Modules (`expo-modules-core`), `@shopify/react-native-skia` 2.14.0, Jest.

**Spec:** `docs/superpowers/specs/2026-11-26-recorrido-en-video-design.md`. Este plan cubre el paso 1 de su "Orden de trabajo". Los pasos 2 a 4 (motor a código de verdad, "Recorrido" en Compartir, build de producción) llevan su propio plan, que se escribe con los resultados de la Task 8.

## Global Constraints

- Se trabaja en el worktree `mobile-revelado`, en la rama `feature/recorrido-en-video`, creada desde el commit actual (`0ee5c96`, igual a `origin/develop`). Sin push ni PR en este plan.
- **El prototipo no se commitea nunca.** Son `src/features/journey-spike/`, `app/dev/journey.tsx` y los cambios sueltos en `app/_layout.tsx`, `src/features/profile/dev-moment-rows.tsx` y `src/test/routes.ts`. Cada tarea commitea solo los archivos que nombra, con `git add <rutas>`. Nunca `git add -A`, `git add .` ni `git commit -a`.
- El repo es público: la demo del Reel (fotos y videos) vive en `~/Desktop/Rollo/.superpowers/recorrido-demo/` y no entra al repo.
- El código va en inglés. Los commits van en español, con la línea de coautoría de la sesión que commitea.
- Tests: solo los relacionados, con `--maxWorkers=2`. Nunca la suite completa. El typecheck es `npm run typecheck`.
- Solo iOS. Sin dependencias de npm nuevas.
- El módulo se llama `RolloVideo` y vive en `modules/rollo-video`.
- El video: H.264 High, **1080×1920**, **30** cuadros por segundo, **6.000.000** bits por segundo, colores BT.709, sin audio.
- Nada que se cargue al abrir la app puede exigir el módulo nativo: el build instalado (1.5.0) no lo tiene y tiene que seguir andando hasta la Task 8. El envoltorio usa `requireOptionalNativeModule`.
- No se tocan las terminales de Metro ni del backend. El build en el iPhone es la Task 8 y necesita el visto bueno del dueño.

## Review Focus

1. **La app pasa a segundo plano en medio de una exportación:** no queda un mp4 cortado; al volver sigue o empieza de nuevo. Tests en la Task 4 y prueba en el teléfono en la Task 8.
2. **Se cancela en medio:** el archivo a medias se borra. Test en la Task 4 y chequeo 3 de la Task 2.
3. **Este JS llega a un build sin el módulo:** `videoAvailable` es `false` y nada rompe al importar. Test en la Task 3.
4. **Llega al código nativo un cuadro más chico de lo declarado:** se rechaza, no se lee memoria ajena. Chequeo 2 de la Task 2.
5. **No se puede escribir el archivo (carpeta inexistente, sin espacio):** abrir falla con un mensaje y no queda nada. Chequeo 5 de la Task 2 y test en la Task 4.

---

### Task 1: Rama, documentos y prototipo aparte

**Files:**
- Move (untracked, stays untracked): `src/features/journey/` → `src/features/journey-spike/`
- Modify (spike edits, stay uncommitted): `app/dev/journey.tsx`, `src/features/profile/dev-moment-rows.tsx`
- Commit: `docs/superpowers/specs/2026-11-26-recorrido-en-video-design.md`, `docs/superpowers/plans/2026-11-26-recorrido-video-modulo-y-exportacion.md`

**Interfaces:**
- Produces: the folder `src/features/journey/` is free for production code; the prototype answers at `@/features/journey-spike/…`.

- [ ] **Step 1: Create the branch.**
  Run: `git switch -c feature/recorrido-en-video`
  Expected: `Switched to a new branch 'feature/recorrido-en-video'`
- [ ] **Step 2: Move the prototype.** `mv src/features/journey src/features/journey-spike`
- [ ] **Step 3: Point its two callers at the new folder.**
  - `app/dev/journey.tsx`: `@/features/journey/journey-screen` → `@/features/journey-spike/journey-screen`.
  - `src/features/profile/dev-moment-rows.tsx`: both `@/features/journey/share-test` → `@/features/journey-spike/share-test`.
- [ ] **Step 4: Check.**
  Run: `npm run typecheck`
  Expected: no errors.
  Run: `npx jest --findRelatedTests src/features/profile/dev-moment-rows.tsx --maxWorkers=2`
  Expected: all pass.
- [ ] **Step 5: Commit the documents only.**
  ```bash
  git add docs/superpowers/specs/2026-11-26-recorrido-en-video-design.md docs/superpowers/plans/2026-11-26-recorrido-video-modulo-y-exportacion.md
  git commit -m "Docs: diseño y plan del recorrido en video"
  git status --short
  ```
  Expected after the commit: ` M app/_layout.tsx`, ` M src/features/profile/dev-moment-rows.tsx`, ` M src/test/routes.ts`, `?? app/dev/journey.tsx`, `?? src/features/journey-spike/`. Nothing else.

### Task 2: `VideoWriter.swift` y su chequeo en la Mac

**Files:**
- Create: `modules/rollo-video/ios/VideoWriter.swift`
- Create: `modules/rollo-video/check/main.swift` (outside `ios/`, so the pod never compiles it)
- Create: `modules/rollo-video/check/run.sh`
- Modify: `package.json` (script `"check:video-writer": "sh modules/rollo-video/check/run.sh"`)

**Interfaces:**
- Produces (Swift, no Expo imports):
  ```swift
  public struct VideoWriterError: Error, CustomStringConvertible { public let description: String; public init(_ description: String) }
  public final class VideoWriter {
    public static let readyTimeoutMs = 5000
    public private(set) var frames: Int
    public init(url: URL, width: Int, height: Int, fps: Int, bitrate: Int) throws
    public func append(pixels: UnsafeRawPointer, byteCount: Int, bytesPerRow: Int) throws   // BGRA premultiplied, top row first
    public func append(texture: MTLTexture) throws                                         // BGRA8Unorm, CPU-readable, the film's size
    public func finish() async throws -> (bytes: Int, frames: Int)
    public func cancel()                                                                   // safe to call twice
  }
  ```

A version of both files that already passed on this Mac (21 checks) is in `~/Desktop/Rollo/.superpowers/recorrido-demo/video-writer/` (`VideoWriter.swift` and `check/main.swift`). Start from them.

- [ ] **Step 1: Write the check** in `modules/rollo-video/check/main.swift`. It is top-level Swift that prints `OK <n> checks` or one `FAILED <name>` line per failure and exits 1. All at 1080×1920, 30 fps, 6_000_000 bps, in a temp folder it removes. What it asserts:
  1. **Bytes in:** 90 frames (30 red, 30 green, 30 blue) → `finish()` returns `frames == 90`; the file read back with `AVURLAsset` lasts 3.0 s (±0.05), is 1080×1920 at 30 fps (±0.5); the centre pixel at 0.5 s is red (`r > 180, g < 80, b < 80`) and at 2.5 s is blue. This is what catches a swapped channel order.
  2. **Short buffer:** `append(pixels:byteCount:bytesPerRow:)` with 100 bytes throws; with `bytesPerRow = 1080 * 2` throws.
  3. **Cancel:** after 5 frames, `cancel()` twice → the file does not exist; a later `append` throws.
  4. **Empty:** `finish()` with no frames throws and leaves no file.
  5. **Bad open:** width 1081, height 0, fps 0, bitrate 0 and a URL inside a folder that does not exist each throw from `init`.
  6. **Texture in:** a shared `MTLTexture` (BGRA8Unorm, 1080×1920) filled with blue, appended 30 times → `frames == 30` and the centre pixel is blue; a 64×64 texture throws.
- [ ] **Step 2: Write `modules/rollo-video/check/run.sh`.**
  ```sh
  #!/bin/sh
  # Compiles VideoWriter.swift with its check for macOS and runs it.
  set -e
  cd "$(dirname "$0")/.."
  out="${TMPDIR:-/tmp}/rollo-video-check"
  xcrun swiftc -O -suppress-warnings -o "$out" ios/VideoWriter.swift check/main.swift
  "$out"
  ```
  Add the `check:video-writer` script to `package.json`.
- [ ] **Step 3: Run it to see it fail.**
  Run: `npm run check:video-writer`
  Expected: the compiler fails because `ios/VideoWriter.swift` does not exist.
- [ ] **Step 4: Implement `VideoWriter`.** Values the checks don't pin:
  - `AVAssetWriter` with `fileType: .mp4` and `shouldOptimizeForNetworkUse = true`; an existing file at `url` is removed first.
  - Output settings: `AVVideoCodecType.h264`, `AVVideoProfileLevelH264HighAutoLevel`, `AVVideoAverageBitRateKey: bitrate`, `AVVideoMaxKeyFrameIntervalKey: fps * 2`, `AVVideoExpectedSourceFrameRateKey: fps`, and `AVVideoColorPropertiesKey` with the three `ITU_R_709_2` constants (primaries, transfer function, YCbCr matrix).
  - `expectsMediaDataInRealTime = false`. Pixel buffers come from an `AVAssetWriterInputPixelBufferAdaptor` pool of `kCVPixelFormatType_32BGRA`.
  - Frame `n` (from 0) has presentation time `CMTime(value: n, timescale: fps)`; the session ends at `frames / fps`.
  - `append` waits for `isReadyForMoreMediaData` in 1 ms steps, up to `readyTimeoutMs`, then throws. It throws at once if the writer is no longer writing.
  - The texture path copies with `getBytes(_:bytesPerRow:from:mipmapLevel:)` straight into the pool buffer and refuses a `.private` storage mode.
  - The classic `AVAssetWriter` calls are marked deprecated in the iOS 27 SDK. Keep them: the replacement only exists on iOS 27.
- [ ] **Step 5: Run it to see it pass.**
  Run: `npm run check:video-writer`
  Expected: `OK 21 checks`
- [ ] **Step 6: Commit.**
  ```bash
  git add modules/rollo-video/ios/VideoWriter.swift modules/rollo-video/check/main.swift modules/rollo-video/check/run.sh package.json
  git commit -m "Video: escritor de mp4 (AVAssetWriter) con su chequeo en la Mac"
  ```

### Task 3: El módulo de Expo `RolloVideo` y su envoltorio

**Files:**
- Create: `modules/rollo-video/expo-module.config.json`
- Create: `modules/rollo-video/ios/RolloVideo.podspec`
- Create: `modules/rollo-video/ios/RolloVideoModule.swift`
- Create: `modules/rollo-video/ios/InstagramVideoShare.swift`
- Create: `modules/rollo-video/index.ts`
- Test: `modules/rollo-video/__tests__/index.test.ts`
- Modify: `CLAUDE.md` (the module, in "Stack" and in "Estructura del código")

**Interfaces:**
- Consumes: `VideoWriter` (Task 2).
- Produces (`modules/rollo-video/index.ts`):
  ```ts
  export type VideoOptions = { uri: string; width: number; height: number; fps: number; bitrate: number };
  export type VideoFile = { uri: string; bytes: number; frames: number };
  export type InstagramTarget = "stories" | "reels";
  /** False in a build without the native module (an older build that got this JS). */
  export const videoAvailable: boolean;
  export function openVideo(options: VideoOptions): void;
  export function appendFrame(pixels: Uint8Array, bytesPerRow: number): void;
  export function appendTexture(pointer: bigint): void;
  export function finishVideo(): Promise<VideoFile>;
  export function cancelVideo(): void;
  export function shareVideoToInstagram(target: InstagramTarget, videoUri: string, appId: string): Promise<boolean>;
  ```

- [ ] **Step 1: Write the failing test.** Same loader as `modules/rollo-symbol/__tests__/index.test.tsx`: `jest.isolateModules` plus `jest.doMock("expo", …)` so `requireOptionalNativeModule("RolloVideo")` returns the fake (or `null`).
  ```ts
  const OPTIONS = { uri: "file:///cache/film.mp4", width: 1080, height: 1920, fps: 30, bitrate: 6_000_000 };

  it("is available only when the build has the native module", () => {
    expect(load(native()).videoAvailable).toBe(true);
    expect(load(null).videoAvailable).toBe(false);
  });
  it("passes the options through on open", () => {
    const fake = native();
    load(fake).openVideo(OPTIONS);
    expect(fake.open).toHaveBeenCalledWith(OPTIONS);
  });
  it("hands the frame bytes and the row size to append", () => {
    const fake = native();
    const pixels = new Uint8Array(8);
    load(fake).appendFrame(pixels, 4320);
    expect(fake.append).toHaveBeenCalledWith(pixels, 4320);
  });
  it("sends a texture pointer as a decimal string", () => {
    const fake = native();
    load(fake).appendTexture(4302123456n);
    expect(fake.appendTexture).toHaveBeenCalledWith("4302123456");
  });
  it("resolves finish with the native file", async () => {
    const fake = native();
    fake.finish.mockResolvedValue({ uri: OPTIONS.uri, bytes: 28280042, frames: 1226 });
    await expect(load(fake).finishVideo()).resolves.toEqual({ uri: OPTIONS.uri, bytes: 28280042, frames: 1226 });
  });
  it("asks the native module to open Instagram with the target, the file and the app id", async () => {
    const fake = native();
    fake.shareToInstagram.mockResolvedValue(true);
    await expect(load(fake).shareVideoToInstagram("reels", OPTIONS.uri, "123")).resolves.toBe(true);
    expect(fake.shareToInstagram).toHaveBeenCalledWith({ target: "reels", videoUri: OPTIONS.uri, appId: "123" });
  });
  it("without the module: writing fails with a clear error, cancel does nothing, Instagram resolves false", async () => {
    const wrapper = load(null);
    expect(() => wrapper.openVideo(OPTIONS)).toThrow("RolloVideo is not in this build");
    expect(() => wrapper.appendFrame(new Uint8Array(4), 4)).toThrow("RolloVideo is not in this build");
    expect(() => wrapper.appendTexture(1n)).toThrow("RolloVideo is not in this build");
    await expect(wrapper.finishVideo()).rejects.toThrow("RolloVideo is not in this build");
    expect(() => wrapper.cancelVideo()).not.toThrow();
    await expect(wrapper.shareVideoToInstagram("stories", OPTIONS.uri, "123")).resolves.toBe(false);
  });
  ```
  `native()` returns `{ open, append, appendTexture, finish, cancel, shareToInstagram }`, each a `jest.fn()`.
- [ ] **Step 2: Run it to see it fail.**
  Run: `npx jest modules/rollo-video --maxWorkers=2`
  Expected: FAIL, cannot find module `..`.
- [ ] **Step 3: Implement `modules/rollo-video/index.ts`** with the signatures above. The native module is looked up once, at load, with `requireOptionalNativeModule("RolloVideo")` from `expo`.
- [ ] **Step 4: Run it to see it pass.**
  Run: `npx jest modules/rollo-video --maxWorkers=2`
  Expected: PASS, 7 tests.
- [ ] **Step 5: Write the native glue.**
  - `expo-module.config.json`: `{ "platforms": ["apple"], "apple": { "modules": ["RolloVideoModule"] } }`.
  - `RolloVideo.podspec`: the one of `modules/rollo-symbol/ios/RolloSymbol.podspec` with name `RolloVideo` and its own summary.
  - `RolloVideoModule.swift`, `Name("RolloVideo")`, holding at most one `VideoWriter`:
    - `Function("open")` takes a `Record` `{ uri: String, width: Int, height: Int, fps: Int, bitrate: Int }`. It throws `a video is already open` when there is one, and `not a file uri` when `uri` is not a `file://` URL.
    - `Function("append") { (pixels: Uint8Array, bytesPerRow: Int) }` calls `append(pixels: pixels.rawPointer, byteCount: pixels.byteLength, bytesPerRow:)` inside an `autoreleasepool`.
    - `Function("appendTexture") { (pointer: String) }` parses the decimal address (`UInt(pointer)`), takes the object unretained and requires it to be an `MTLTexture`; otherwise `not a Metal texture`.
    - `AsyncFunction("finish")` (async closure) returns `["uri": <the uri given to open>, "bytes": Int, "frames": Int]` and forgets the writer whether it succeeds or throws.
    - `Function("cancel")` cancels and forgets the writer; with none open it does nothing.
    - `append`, `appendTexture` and `finish` with no video open throw `no video is open`.
    - Every error reaches JS as `Exception(name: "RolloVideoError", description: …)`.
  - `InstagramVideoShare.swift`, called from `AsyncFunction("shareToInstagram") { (options: Record { target, videoUri, appId }) -> Bool }.runOnQueue(.main)`:
    - `stories` opens `instagram-stories://share?source_application=<appId>` with the pasteboard item `["com.instagram.sharedSticker.backgroundVideo": <file data>]`.
    - `reels` opens `instagram-reels://share` with `["com.instagram.sharedSticker.backgroundVideo": <file data>, "com.instagram.sharedSticker.appID": <appId>]`.
    - The pasteboard expires in 300 s (`UIPasteboard.general.setItems(_:options:)` with `.expirationDate`).
    - If `UIApplication.shared.canOpenURL` says no, it returns `false` and leaves the pasteboard alone. Otherwise it sets the pasteboard, opens the URL and returns `true`.
    - Any other target throws `unknown target`; an unreadable file throws.
- [ ] **Step 6: Check that the app compiles with the module** (no phone, no signing; it takes a while, run it in the background).
  ```bash
  EXPO_NO_GIT_STATUS=1 LANG=en_US.UTF-8 npx expo prebuild --clean --platform ios
  ls ios | grep xcworkspace
  xcodebuild -workspace ios/RolloDev.xcworkspace -scheme RolloDev -configuration Debug -sdk iphoneos -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build 2>&1 | tail -5
  ```
  Expected: `** BUILD SUCCEEDED **`. Use the workspace name `ls` prints if it is another one. `ios/` is ignored by git. If the build cannot run in this environment (no network for pods, sandbox), say so in the report and go on: Task 8 builds on the phone.
- [ ] **Step 7: Document it in `CLAUDE.md`:** one sentence in "Stack" next to `modules/rollo-symbol` (what it is, that adding or changing it needs `npx expo prebuild --clean` and a rebuild, and `npm run check:video-writer`) and one line in the "Estructura del código" tree.
- [ ] **Step 8: Commit.**
  ```bash
  git add modules/rollo-video/expo-module.config.json modules/rollo-video/ios/RolloVideo.podspec modules/rollo-video/ios/RolloVideoModule.swift modules/rollo-video/ios/InstagramVideoShare.swift modules/rollo-video/index.ts modules/rollo-video/__tests__/index.test.ts CLAUDE.md
  git commit -m "Video: módulo RolloVideo (escribir cuadros y mandar un video a Instagram) con su envoltorio"
  ```

### Task 4: `export-film.ts`, la exportación por tandas

**Files:**
- Create: `src/features/journey/export-film.ts`
- Test: `src/features/journey/__tests__/export-film.test.ts`

**Interfaces:**
- Consumes: the types `VideoOptions` and `VideoFile` from `modules/rollo-video` (type-only import, relative path `../../../modules/rollo-video`).
- Produces:
  ```ts
  export const SLICE_MS = 40;
  export const MAX_RESTARTS = 2;
  export type FilmSink = { open: (options: VideoOptions) => void; finish: () => Promise<VideoFile>; cancel: () => void };
  export type ExportInput = {
    video: VideoOptions;
    durationMs: number;
    /** Draws frame `index` (film time `timeMs`) and hands it to the open video. Throws when the encoder refuses it. */
    writeFrame: (index: number, timeMs: number) => void;
    sink: FilmSink;
    /** The app is in the foreground: the GPU can only be used there. */
    isActive: () => boolean;
    /** Resolves once the app is in the foreground again. */
    untilActive: () => Promise<void>;
    /** Gives the UI a turn between slices. */
    pause: () => Promise<void>;
    now: () => number;
    onProgress?: (done: number, total: number) => void;
    isCancelled: () => boolean;
  };
  /** How many frames a film of `durationMs` has: round(durationMs × fps / 1000), at least 1. Throws RangeError unless both are finite and positive. */
  export function frameCount(durationMs: number, fps: number): number;
  /** Writes the whole film. Resolves with the file, or with `null` when cancelled. */
  export function exportFilm(input: ExportInput): Promise<VideoFile | null>;
  ```

The rules the tests pin:
- Frame `i` is written at `i * 1000 / fps`, in order, once.
- A slice ends after the frame at which `now()` is `SLICE_MS` or more past the slice's start. Then: `onProgress(done, total)`, `await pause()`, check `isCancelled()`. After the last frame there is no pause, only `onProgress(total, total)`.
- At the start of every slice, if `isActive()` is false: `await untilActive()` and remember that this run waited in the background.
- If `writeFrame` or `sink.finish` throws in a run that waited in the background (iOS may have taken the encoder away): `sink.cancel()`, `sink.open(video)` and start again from frame 0, at most `MAX_RESTARTS` times. If they throw in a run that never waited, or the restarts ran out: `sink.cancel()` and rethrow.
- Cancelled: `sink.cancel()`, resolve `null`.
- `sink.open` failing: `sink.cancel()` and rethrow, always.

- [ ] **Step 1: Write the failing tests.** A helper `setup(overrides, frameMs = 15)` builds an `ExportInput` for `durationMs: 1000` at 30 fps whose `writeFrame` records `[index, timeMs]` and advances a fake clock by `frameMs`; `calls` records `"open"`, `"finish"`, `"cancel"`, `"pause"` and `"untilActive"` in order.
  ```ts
  it("counts frames by rounding", () => {
    expect(frameCount(1000, 30)).toBe(30);
    expect(frameCount(40866.67, 30)).toBe(1226);
    expect(frameCount(1, 30)).toBe(1);
    for (const [d, f] of [[0, 30], [NaN, 30], [1000, 0], [-5, 30], [Infinity, 30]]) expect(() => frameCount(d!, f!)).toThrow(RangeError);
  });
  it("writes every frame once, in order, at i × 1000 / fps", async () => {
    const { input, calls, written } = setup();
    const file = await exportFilm(input);
    expect(written).toHaveLength(30);
    expect(written[0]).toEqual([0, 0]);
    expect(written[29]).toEqual([29, (29 * 1000) / 30]);
    expect(calls[0]).toBe("open");
    expect(calls.at(-1)).toBe("finish");
    expect(file).toEqual({ uri: "file:///cache/film.mp4", bytes: 123, frames: 30 });
  });
  it("gives the UI a turn every SLICE_MS of work, but not after the last frame", async () => {
    const { input, calls } = setup();                       // 15 ms per frame: a slice is 3 frames
    await exportFilm(input);
    expect(calls.filter((c) => c === "pause")).toHaveLength(9);
  });
  it("reports progress after each slice and once at the end", async () => {
    const onProgress = jest.fn();
    await exportFilm(setup({ onProgress }).input);
    expect(onProgress.mock.calls[0]).toEqual([3, 30]);
    expect(onProgress.mock.calls.at(-1)).toEqual([30, 30]);
    expect(onProgress).toHaveBeenCalledTimes(10);
  });
  it("stops and removes the file when cancelled", async () => {
    let pauses = 0;
    const { input, calls, written } = setup({ isCancelled: () => pauses > 0 });
    input.pause = async () => void (pauses += 1);
    await expect(exportFilm(input)).resolves.toBeNull();
    expect(written).toHaveLength(3);
    expect(calls).toContain("cancel");
    expect(calls).not.toContain("finish");
  });
  it("waits in the background instead of drawing", async () => {
    let active = true;
    const { input, calls, written } = setup();
    input.pause = async () => void (active = written.length !== 3);      // goes to the background after the first slice
    input.isActive = () => active;
    input.untilActive = async () => { calls.push(`untilActive at ${written.length}`); active = true; };
    await exportFilm(input);
    expect(calls).toContain("untilActive at 3");
    expect(written).toHaveLength(30);
  });
  it("starts over when the encoder dies after a background wait", async () => {
    let active = true;
    let broken = false;
    const { input, calls, written } = setup();
    const write = input.writeFrame;
    input.pause = async () => void (active = written.length !== 3);
    input.isActive = () => active;
    input.untilActive = async () => { active = true; broken = true; };
    input.writeFrame = (i, t) => {
      if (broken) { broken = false; throw new Error("the encoder stopped"); }
      write(i, t);
    };
    const file = await exportFilm(input);
    expect(calls.filter((c) => c === "open")).toHaveLength(2);
    expect(calls.filter((c) => c === "cancel")).toHaveLength(1);
    expect(written.slice(0, 4).map(([i]) => i)).toEqual([0, 1, 2, 0]);
    expect(file?.frames).toBe(33);                                       // 3 before the restart + the 30 of the film
  });
  it("an encoder error with no background wait is an error", async () => {
    const { input, calls } = setup({ writeFrame: (i) => { if (i === 5) throw new Error("the encoder stopped"); } });
    await expect(exportFilm(input)).rejects.toThrow("the encoder stopped");
    expect(calls.filter((c) => c === "open")).toHaveLength(1);
    expect(calls).toContain("cancel");
  });
  it("gives up after MAX_RESTARTS restarts", async () => {
    let active = false;
    const { input, calls } = setup({ writeFrame: () => { throw new Error("the encoder stopped"); } });
    input.isActive = () => active;
    input.untilActive = async () => void (active = true);
    const open = input.sink.open;
    input.sink.open = (o) => { active = false; open(o); };                // every run starts in the background
    await expect(exportFilm(input)).rejects.toThrow("the encoder stopped");
    expect(calls.filter((c) => c === "open")).toHaveLength(MAX_RESTARTS + 1);
  });
  it("a failing open or finish leaves nothing behind", async () => {
    const a = setup();
    a.input.sink.open = () => { throw new Error("cannot write"); };
    await expect(exportFilm(a.input)).rejects.toThrow("cannot write");
    expect(a.calls).toContain("cancel");
    const b = setup();
    b.input.sink.finish = async () => { throw new Error("could not finish"); };
    await expect(exportFilm(b.input)).rejects.toThrow("could not finish");
    expect(b.calls).toContain("cancel");
  });
  ```
  In `setup`, `sink.finish` resolves `{ uri: "file:///cache/film.mp4", bytes: 123, frames: written.length }`.
- [ ] **Step 2: Run them to see them fail.**
  Run: `npx jest src/features/journey/__tests__/export-film.test.ts --maxWorkers=2`
  Expected: FAIL, cannot find module `../export-film`.
- [ ] **Step 3: Implement `frameCount` and `exportFilm`** in `src/features/journey/export-film.ts`. No React, no Skia, no native imports.
- [ ] **Step 4: Run them to see them pass.**
  Run: `npx jest src/features/journey/__tests__/export-film.test.ts --maxWorkers=2`
  Expected: PASS, 10 tests.
- [ ] **Step 5: Commit.**
  ```bash
  git add src/features/journey/export-film.ts src/features/journey/__tests__/export-film.test.ts
  git commit -m "Recorrido: exportación por tandas (avance, cancelar y segundo plano)"
  ```

### Task 5: `frame-source.ts`, de Skia al módulo

**Files:**
- Create: `src/features/journey/frame-source.ts`
- Test: `src/features/journey/__tests__/frame-source.test.ts`

**Interfaces:**
- Produces:
  ```ts
  import type { SkCanvas, SkSurface } from "@shopify/react-native-skia";   // types only: Jest must be able to load this file
  export type FrameInput = "bytes" | "texture";
  export type FrameStages = { frames: number; drawMs: number; readMs: number; appendMs: number };
  export type FrameSourceOptions = {
    /** `Skia.Surface.MakeOffscreen`. */
    makeSurface: (width: number, height: number) => SkSurface | null;
    width: number;
    height: number;
    /** Film points to pixels (2.5 for the canonical 432×768 frame at 1080×1920). */
    scale: number;
    /** `{ colorType: ColorType.BGRA_8888, alphaType: AlphaType.Premul }`, passed in so this file imports no Skia values. */
    pixelFormat: { colorType: number; alphaType: number };
    draw: (canvas: SkCanvas, timeMs: number) => void;
    input: FrameInput;
    appendBytes: (pixels: Uint8Array, bytesPerRow: number) => void;
    appendTexture: (pointer: bigint) => void;
    now: () => number;
  };
  export type FrameSource = { writeFrame: (index: number, timeMs: number) => void; stages: () => FrameStages; dispose: () => void };
  /** Throws "offscreen surface unavailable" when `makeSurface` returns null. */
  export function createFrameSource(options: FrameSourceOptions): FrameSource;
  ```
- Its `writeFrame` is what `ExportInput.writeFrame` (Task 4) receives.

What each frame does:
- One surface for the whole export. Per frame: `canvas.save()`, `canvas.scale(scale, scale)`, `draw(canvas, timeMs)`, `canvas.restore()`.
- `"bytes"`: `surface.makeImageSnapshot()`, then `readPixels(0, 0, { width, height, ...pixelFormat }, dest)` with one `Uint8Array(width * height * 4)` reused for every frame. The fourth argument is in Skia's native code but not in its TypeScript types: cast. If Skia returns another array (a version that ignores `dest`), use the one returned; `null` throws `readPixels failed`. Dispose the snapshot before returning, then `appendBytes(pixels, width * 4)`.
- `"texture"`: `surface.flush(true)`, then `surface.getNativeTextureUnstable()` gives `{ mtlTexture: bigint }`; without it, throw `no native texture`. `appendTexture(mtlTexture)`.
- `stages()` adds up the time (`now()`) spent drawing, reading (snapshot + read, or flush + texture lookup) and appending.
- `dispose()` disposes the surface.

- [ ] **Step 1: Write the failing tests** with a hand-made surface (`fakeSurface()` returns the surface plus the lists of calls it recorded; its canvas records `save`, `scale`, `restore`).
  ```ts
  it("creates one surface for the whole export", () => {
    const { options, made } = setup({ input: "bytes" });
    const source = createFrameSource(options);
    for (let i = 0; i < 3; i++) source.writeFrame(i, i * 33.3);
    expect(made).toEqual([[1080, 1920]]);
  });
  it("draws each frame scaled, inside save and restore", () => {
    const { options, canvasCalls, drawn } = setup({ input: "bytes" });
    createFrameSource(options).writeFrame(0, 100);
    expect(canvasCalls).toEqual(["save", "scale 2.5 2.5", "restore"]);
    expect(drawn).toEqual([100]);
  });
  it("bytes: reads into the same array every frame and appends it with the row size", () => {
    const { options, readInto, appended } = setup({ input: "bytes" });
    const source = createFrameSource(options);
    source.writeFrame(0, 0);
    source.writeFrame(1, 33.3);
    expect(readInto[0]).toBe(readInto[1]);
    expect(readInto[0]).toHaveLength(1080 * 1920 * 4);
    expect(appended).toEqual([[readInto[0], 4320], [readInto[0], 4320]]);
  });
  it("bytes: asks for BGRA premultiplied at the film's size", () => {
    const { options, readInfo } = setup({ input: "bytes" });
    createFrameSource(options).writeFrame(0, 0);
    expect(readInfo[0]).toEqual({ width: 1080, height: 1920, colorType: 6, alphaType: 2 });
  });
  it("bytes: uses the array Skia returns when it ignores the destination", () => {
    const other = new Uint8Array(1080 * 1920 * 4);
    const { options, appended } = setup({ input: "bytes", readReturns: other });
    createFrameSource(options).writeFrame(0, 0);
    expect(appended[0]![0]).toBe(other);
  });
  it("bytes: a failed read is an error, and the snapshot is still disposed", () => {
    const { options, disposed } = setup({ input: "bytes", readReturns: null });
    expect(() => createFrameSource(options).writeFrame(0, 0)).toThrow("readPixels failed");
    expect(disposed).toEqual(["image"]);
  });
  it("bytes: disposes each snapshot before the next frame", () => {
    const { options, disposed } = setup({ input: "bytes" });
    const source = createFrameSource(options);
    source.writeFrame(0, 0);
    source.writeFrame(1, 33.3);
    expect(disposed).toEqual(["image", "image"]);
  });
  it("texture: waits for the GPU, then hands over the Metal texture", () => {
    const { options, flushed, textures } = setup({ input: "texture", texture: { mtlTexture: 4302123456n } });
    createFrameSource(options).writeFrame(0, 0);
    expect(flushed).toEqual([true]);
    expect(textures).toEqual([4302123456n]);
  });
  it("texture: no native texture is an error", () => {
    const { options } = setup({ input: "texture", texture: null });
    expect(() => createFrameSource(options).writeFrame(0, 0)).toThrow("no native texture");
  });
  it("adds up the time of each stage", () => {
    const { options } = setup({ input: "bytes", tickMs: 2 });           // every now() call advances 2 ms
    const source = createFrameSource(options);
    source.writeFrame(0, 0);
    const s = source.stages();
    expect(s.frames).toBe(1);
    expect(s.drawMs).toBeGreaterThan(0);
    expect(s.readMs).toBeGreaterThan(0);
    expect(s.appendMs).toBeGreaterThan(0);
  });
  it("fails clearly without an offscreen surface, and disposes the one it made", () => {
    expect(() => createFrameSource({ ...setup({ input: "bytes" }).options, makeSurface: () => null })).toThrow("offscreen surface unavailable");
    const { options, disposed } = setup({ input: "bytes" });
    createFrameSource(options).dispose();
    expect(disposed).toEqual(["surface"]);
  });
  ```
  `setup({ input, readReturns?, texture?, tickMs? })` uses `width: 1080, height: 1920, scale: 2.5, pixelFormat: { colorType: 6, alphaType: 2 }` and returns `{ options, made, canvasCalls, drawn, readInto, readInfo, appended, textures, flushed, disposed }`:
  - `made`: the sizes asked of `makeSurface`; `drawn`: the `timeMs` each `draw` got.
  - `readInto` and `readInfo`: the destination array and the image info each `readPixels` call received. The fake returns `readReturns` when given (it may be `null`), otherwise the destination.
  - `appended`: the `[pixels, bytesPerRow]` pairs given to `appendBytes`; `textures`: the pointers given to `appendTexture`.
  - `flushed`: the argument of each `surface.flush`; `texture`: what `getNativeTextureUnstable()` returns (default `{ mtlTexture: 1n }`).
  - `disposed`: `"image"` or `"surface"`, in the order they were disposed.
  - `now` advances `tickMs` (default 1) on every call.
- [ ] **Step 2: Run them to see them fail.**
  Run: `npx jest src/features/journey/__tests__/frame-source.test.ts --maxWorkers=2`
  Expected: FAIL, cannot find module `../frame-source`.
- [ ] **Step 3: Implement `createFrameSource`.**
- [ ] **Step 4: Run them to see them pass, and typecheck.**
  Run: `npx jest src/features/journey/__tests__/frame-source.test.ts --maxWorkers=2 && npm run typecheck`
  Expected: PASS, 11 tests; no type errors.
- [ ] **Step 5: Commit.**
  ```bash
  git add src/features/journey/frame-source.ts src/features/journey/__tests__/frame-source.test.ts
  git commit -m "Recorrido: cuadros de Skia fuera de pantalla hacia el módulo de video"
  ```

### Task 6: Exportar la demo desde el prototipo (sin commit)

Código de prototipo: no lleva tests ni commit. Sirve para medir en la Task 8.

**Files (all uncommitted):**
- Create: `src/features/journey-spike/export-test.ts`
- Modify: `src/features/journey-spike/engine/engine-player.tsx`

**Interfaces:**
- Consumes: `exportFilm` (Task 4), `createFrameSource` and `FrameInput` (Task 5), the wrapper of Task 3, and from the prototype `frameAt` (`engine/scene.ts`), `drawFrame` (`engine/draw.ts`), `layoutTexts` and `Assets` (`engine/assets.ts`), `Scene` (`engine/model.ts`).
- Produces: `runExportTest(input: { scene: Scene; assets: Assets; frameWidth: number; input: FrameInput }): Promise<void>`.

- [ ] **Step 1: Write `runExportTest`.**
  - It lays out its own texts (`layoutTexts(scene.texts, scene.input.frame)`) and draws with `{ ...assets, texts }`.
  - Frame source: `makeSurface: (w, h) => Skia.Surface.MakeOffscreen(w, h)`, 1080×1920, `scale: 1080 / frameWidth`, `pixelFormat: { colorType: ColorType.BGRA_8888, alphaType: AlphaType.Premul }`, `draw: (canvas, t) => drawFrame(canvas, scene, frameAt(scene, t), own)`, `appendBytes: appendFrame`, `appendTexture`.
  - Export: `video: { uri: new File(Paths.cache, "recorrido-export-test.mp4").uri, width: 1080, height: 1920, fps: 30, bitrate: 6_000_000 }`, `durationMs: scene.durationMs`, `sink: { open: openVideo, finish: finishVideo, cancel: cancelVideo }`, `isActive: () => AppState.currentState === "active"`, `untilActive` resolving on the next `AppState` change to `"active"`, `pause: () => new Promise((r) => setTimeout(r, 0))`, `isCancelled: () => false`.
  - It logs `[export] start`, every tenth of the way `[export] 40 %`, and at the end `[export] done` with `{ input, frames, seconds, mb, msPerFrame: { draw, read, append } }`; a failure logs `[export] failed <message>`.
  - At the end it shows an `Alert` "Exportado" with the seconds and the MB and four buttons: "Hoja de compartir" (`Share.share({ url })`), "Reels directo" and "Stories directo" (`shareVideoToInstagram(target, uri, META_APP_ID)`, logging `[export] instagram <target> <true|false>`), and "Cerrar".
- [ ] **Step 2: Hook it into the player.** In the end state, next to "Otra versión", two pills: "Exportar (bytes)" and "Exportar (textura)". They only show when `videoAvailable`. While an export runs they are disabled and the on-screen picture draws nothing (the same frame must not be painted from two threads at once).
- [ ] **Step 3: Check.**
  Run: `npm run typecheck`
  Expected: no errors.
  Run: `git status --short`
  Expected: nothing staged; the new file shows only inside `?? src/features/journey-spike/`.

### Task 7: Versión 1.6.0 y el esquema de Reels

Va justo antes del build: hasta acá el build instalado (1.5.0) siguió cargando este worktree desde Metro.

**Files:**
- Modify: `app.json` (`expo.version` and `expo.ios.infoPlist.LSApplicationQueriesSchemes`)
- Test: `__tests__/app-config.test.ts`

- [ ] **Step 1: Change the test first.** Replace the version test and add the scheme test:
  ```ts
  it("is version 1.6.0 (runtimeVersion follows it)", () => {
    expect(appJson.expo.version).toBe("1.6.0");
  });
  it("can ask whether Instagram takes a Reel (the route for a video longer than 20 s)", () => {
    expect(appJson.expo.ios.infoPlist.LSApplicationQueriesSchemes).toEqual(["instagram-stories", "instagram", "whatsapp", "instagram-reels"]);
  });
  ```
- [ ] **Step 2: Run it to see it fail.**
  Run: `npx jest __tests__/app-config.test.ts --maxWorkers=2`
  Expected: FAIL on those two tests.
- [ ] **Step 3: Edit `app.json`:** `"version": "1.6.0"` and add `"instagram-reels"` at the end of `LSApplicationQueriesSchemes`.
- [ ] **Step 4: Run it to see it pass.**
  Run: `npx jest __tests__/app-config.test.ts --maxWorkers=2`
  Expected: PASS.
- [ ] **Step 5: Commit.**
  ```bash
  git add app.json __tests__/app-config.test.ts
  git commit -m "Versión 1.6.0: módulo de video nativo y esquema de Reels"
  ```

### Task 8: Build en el iPhone y mediciones (necesita al dueño)

**Files:**
- Modify: `docs/superpowers/specs/2026-11-26-recorrido-en-video-design.md` (new section "Resultados del paso 1")

- [ ] **Step 1: Ask the owner for the go-ahead**, with his iPhone connected and unlocked. Do not build before he says yes.
- [ ] **Step 2: Build and install Rollo Dev** from this worktree, in the Terminal panel so he can watch it.
  Run: `LANG=en_US.UTF-8 npx expo run:ios --device` (if Task 3 did not prebuild: `EXPO_NO_GIT_STATUS=1 LANG=en_US.UTF-8 npx expo prebuild --clean --platform ios` first)
  Expected: the app installs and opens on the iPhone.
- [ ] **Step 3: Restart Metro with `--clear`** in its terminal, with the same `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_JOURNEY_FIXTURE_URL` it had, and check the demo's files still answer on port 8799 (they are served from `~/Desktop/Rollo/.superpowers/recorrido-demo/journey-fixture` or from the session's copy).
- [ ] **Step 4: The owner runs, in Ajustes → Desarrollo:**
  1. "Motor propio · demo del Reel", to the end.
  2. "Exportar (bytes)", wait for "Exportado", then "Hoja de compartir" and look at the video.
  3. "Otra versión", to the end, "Exportar (textura)".
  4. One more export, locking the phone in the middle and unlocking it: it must end with a whole video or start over, never with a short one.
  5. "Reels directo" and "Stories directo" from the "Exportado" alert.
  6. "Probar compartir video", options 1 to 5.
  He says what Instagram did each time (whole video, cut, error, which screen).
- [ ] **Step 5: Read the numbers in Metro:** `[engine]` (assets ready, fps, worst gap), `[export] done` for both inputs, `[export] instagram`, `[share-test]`.
- [ ] **Step 6: Write "Resultados del paso 1" in the spec:** the numbers, which input is faster, whether the demo exports in 20 s or less (or 30), what each Instagram route did, and what follows from the spec's own rules: which input stays, whether the 30 s limit needs the owner's call (24 frames per second or 720p), and how "Compartir en Instagram" behaves.
- [ ] **Step 7: Commit.**
  ```bash
  git add docs/superpowers/specs/2026-11-26-recorrido-en-video-design.md
  git commit -m "Docs: resultados de exportar la demo en el iPhone"
  ```
