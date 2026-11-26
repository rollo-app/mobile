import ExpoModulesCore
import Metal

struct VideoOpenOptions: Record {
  @Field var uri: String = ""
  @Field var width: Int = 0
  @Field var height: Int = 0
  @Field var fps: Int = 0
  @Field var bitrate: Int = 0
}

struct InstagramShareOptions: Record {
  @Field var target: String = ""
  @Field var videoUri: String = ""
  @Field var appId: String = ""
}

private func videoError(_ description: String) -> Exception {
  Exception(name: "RolloVideoError", description: description)
}

public class RolloVideoModule: Module {
  /// At most one video is written at a time.
  private var writer: VideoWriter?
  private var writerUri: String?

  public func definition() -> ModuleDefinition {
    Name("RolloVideo")

    Function("open") { (options: VideoOpenOptions) in
      guard self.writer == nil else { throw videoError("a video is already open") }
      guard let url = URL(string: options.uri), url.isFileURL else { throw videoError("not a file uri") }
      do {
        self.writer = try VideoWriter(
          url: url, width: options.width, height: options.height, fps: options.fps, bitrate: options.bitrate)
        self.writerUri = options.uri
      } catch {
        throw videoError("\(error)")
      }
    }

    Function("append") { (pixels: Uint8Array, bytesPerRow: Int) in
      guard let writer = self.writer else { throw videoError("no video is open") }
      do {
        try autoreleasepool {
          try writer.append(pixels: pixels.rawPointer, byteCount: pixels.byteLength, bytesPerRow: bytesPerRow)
        }
      } catch {
        throw videoError("\(error)")
      }
    }

    Function("appendTexture") { (pointer: String) in
      guard let writer = self.writer else { throw videoError("no video is open") }
      guard let address = UInt(pointer), let raw = UnsafeRawPointer(bitPattern: address) else {
        throw videoError("not a Metal texture")
      }
      let object = Unmanaged<AnyObject>.fromOpaque(raw).takeUnretainedValue()
      guard let texture = object as? MTLTexture else { throw videoError("not a Metal texture") }
      do {
        try autoreleasepool { try writer.append(texture: texture) }
      } catch {
        throw videoError("\(error)")
      }
    }

    AsyncFunction("finish") { () async throws -> [String: Any] in
      guard let writer = self.writer, let uri = self.writerUri else { throw videoError("no video is open") }
      // The writer is forgotten whether finishing succeeds or throws.
      self.writer = nil
      self.writerUri = nil
      do {
        let result = try await writer.finish()
        return ["uri": uri, "bytes": result.bytes, "frames": result.frames]
      } catch {
        throw videoError("\(error)")
      }
    }

    Function("cancel") { () -> Void in
      self.writer?.cancel()
      self.writer = nil
      self.writerUri = nil
    }

    AsyncFunction("shareToInstagram") { (options: InstagramShareOptions) -> Bool in
      try InstagramVideoShare.share(target: options.target, videoUri: options.videoUri, appId: options.appId)
    }
    .runOnQueue(.main)
  }
}
