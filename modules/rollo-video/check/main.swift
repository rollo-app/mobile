// Checks `ios/VideoWriter.swift` on the Mac: real frames in, a real mp4 out, read back with AVFoundation.
// Run: sh modules/rollo-video/check/run.sh   (prints "OK <n> checks", or the failures and exit code 1)
import AVFoundation
import CoreGraphics
import Foundation
import Metal

var failures: [String] = []
var checks = 0

func check(_ name: String, _ condition: Bool, _ detail: @autoclosure () -> String = "") {
  checks += 1
  if !condition { failures.append("\(name) \(detail())") }
}

func throwsError(_ body: () throws -> Void) -> Bool {
  do {
    try body()
    return false
  } catch {
    return true
  }
}

let W = 1080
let H = 1920
let dir = FileManager.default.temporaryDirectory.appendingPathComponent("rollo-video-check-\(ProcessInfo.processInfo.processIdentifier)")
try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
defer { try? FileManager.default.removeItem(at: dir) }

/// A whole frame of one colour, BGRA.
func solid(blue: UInt8, green: UInt8, red: UInt8) -> [UInt8] {
  var bytes = [UInt8](repeating: 255, count: W * H * 4)
  for i in stride(from: 0, to: bytes.count, by: 4) {
    bytes[i] = blue
    bytes[i + 1] = green
    bytes[i + 2] = red
  }
  return bytes
}

/// The centre pixel of the frame at `seconds`, as (red, green, blue).
func centre(of url: URL, at seconds: Double) async throws -> (Int, Int, Int) {
  let generator = AVAssetImageGenerator(asset: AVURLAsset(url: url))
  generator.requestedTimeToleranceBefore = .zero
  generator.requestedTimeToleranceAfter = .zero
  let image = try await generator.image(at: CMTime(seconds: seconds, preferredTimescale: 600)).image
  var pixel = [UInt8](repeating: 0, count: 4)
  let context = CGContext(data: &pixel, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  context.draw(image, in: CGRect(x: -image.width / 2, y: -image.height / 2, width: image.width, height: image.height))
  return (Int(pixel[0]), Int(pixel[1]), Int(pixel[2]))
}

// 1. Bytes in: 90 frames (30 red, 30 green, 30 blue) come out as a 3 s, 30 fps, 1080x1920 file with the colours in place.
do {
  let url = dir.appendingPathComponent("bytes.mp4")
  let writer = try VideoWriter(url: url, width: W, height: H, fps: 30, bitrate: 6_000_000)
  let colours = [solid(blue: 0, green: 0, red: 255), solid(blue: 0, green: 255, red: 0), solid(blue: 255, green: 0, red: 0)]
  for i in 0..<90 {
    try colours[i / 30].withUnsafeBytes { try writer.append(pixels: $0.baseAddress!, byteCount: $0.count, bytesPerRow: W * 4) }
  }
  let result = try await writer.finish()
  check("bytes: frames", result.frames == 90, "\(result.frames)")
  check("bytes: file size", result.bytes > 1000 && result.bytes < 50_000_000, "\(result.bytes)")
  let asset = AVURLAsset(url: url)
  let duration = try await asset.load(.duration).seconds
  check("bytes: duration 3 s", abs(duration - 3.0) < 0.05, "\(duration)")
  let track = try await asset.loadTracks(withMediaType: .video).first!
  let (size, rate) = try await track.load(.naturalSize, .nominalFrameRate)
  check("bytes: 1080x1920", Int(size.width) == W && Int(size.height) == H, "\(size)")
  check("bytes: 30 fps", abs(rate - 30) < 0.5, "\(rate)")
  let red = try await centre(of: url, at: 0.5)
  check("bytes: first second is red (BGRA order)", red.0 > 180 && red.1 < 80 && red.2 < 80, "\(red)")
  let blue = try await centre(of: url, at: 2.5)
  check("bytes: last second is blue", blue.2 > 180 && blue.0 < 80 && blue.1 < 80, "\(blue)")
} catch {
  failures.append("bytes: threw \(error)")
}

// 2. A buffer shorter than the frame is refused instead of read past its end.
do {
  let writer = try VideoWriter(url: dir.appendingPathComponent("short.mp4"), width: W, height: H, fps: 30, bitrate: 6_000_000)
  let small = [UInt8](repeating: 0, count: 100)
  check("short buffer is refused", throwsError { try small.withUnsafeBytes { try writer.append(pixels: $0.baseAddress!, byteCount: $0.count, bytesPerRow: W * 4) } })
  check("a row narrower than the frame is refused", throwsError {
    let frame = solid(blue: 0, green: 0, red: 0)
    try frame.withUnsafeBytes { try writer.append(pixels: $0.baseAddress!, byteCount: $0.count, bytesPerRow: W * 2) }
  })
  writer.cancel()
} catch {
  failures.append("short buffer: threw \(error)")
}

// 3. Cancel leaves no file, and can be called twice.
do {
  let url = dir.appendingPathComponent("cancelled.mp4")
  let writer = try VideoWriter(url: url, width: W, height: H, fps: 30, bitrate: 6_000_000)
  let frame = solid(blue: 10, green: 20, red: 30)
  for _ in 0..<5 { try frame.withUnsafeBytes { try writer.append(pixels: $0.baseAddress!, byteCount: $0.count, bytesPerRow: W * 4) } }
  writer.cancel()
  writer.cancel()
  check("cancel removes the file", !FileManager.default.fileExists(atPath: url.path))
  check("append after cancel is refused", throwsError { try frame.withUnsafeBytes { try writer.append(pixels: $0.baseAddress!, byteCount: $0.count, bytesPerRow: W * 4) } })
} catch {
  failures.append("cancel: threw \(error)")
}

// 4. Finishing with no frames throws and leaves no file.
do {
  let url = dir.appendingPathComponent("empty.mp4")
  let writer = try VideoWriter(url: url, width: W, height: H, fps: 30, bitrate: 6_000_000)
  var threw = false
  do { _ = try await writer.finish() } catch { threw = true }
  check("finish with no frames throws", threw)
  check("finish with no frames leaves no file", !FileManager.default.fileExists(atPath: url.path))
} catch {
  failures.append("empty: threw \(error)")
}

// 5. Bad parameters and an unwritable place are refused at open.
check("odd width is refused", throwsError { _ = try VideoWriter(url: dir.appendingPathComponent("a.mp4"), width: 1081, height: H, fps: 30, bitrate: 6_000_000) })
check("zero height is refused", throwsError { _ = try VideoWriter(url: dir.appendingPathComponent("b.mp4"), width: W, height: 0, fps: 30, bitrate: 6_000_000) })
check("fps 0 is refused", throwsError { _ = try VideoWriter(url: dir.appendingPathComponent("c.mp4"), width: W, height: H, fps: 0, bitrate: 6_000_000) })
check("bitrate 0 is refused", throwsError { _ = try VideoWriter(url: dir.appendingPathComponent("d.mp4"), width: W, height: H, fps: 30, bitrate: 0) })
check("a folder that does not exist is refused", throwsError { _ = try VideoWriter(url: dir.appendingPathComponent("missing/e.mp4"), width: W, height: H, fps: 30, bitrate: 6_000_000) })

// 6. Texture in: 30 blue frames read from a Metal texture.
do {
  let device = MTLCreateSystemDefaultDevice()!
  let descriptor = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .bgra8Unorm, width: W, height: H, mipmapped: false)
  descriptor.storageMode = .shared
  let texture = device.makeTexture(descriptor: descriptor)!
  let blue = solid(blue: 255, green: 0, red: 0)
  blue.withUnsafeBytes { texture.replace(region: MTLRegionMake2D(0, 0, W, H), mipmapLevel: 0, withBytes: $0.baseAddress!, bytesPerRow: W * 4) }
  let url = dir.appendingPathComponent("texture.mp4")
  let writer = try VideoWriter(url: url, width: W, height: H, fps: 30, bitrate: 6_000_000)
  for _ in 0..<30 { try writer.append(texture: texture) }
  let result = try await writer.finish()
  check("texture: frames", result.frames == 30, "\(result.frames)")
  let colour = try await centre(of: url, at: 0.5)
  check("texture: blue", colour.2 > 180 && colour.0 < 80 && colour.1 < 80, "\(colour)")
  let other = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .bgra8Unorm, width: 64, height: 64, mipmapped: false)
  let wrong = device.makeTexture(descriptor: other)!
  let second = try VideoWriter(url: dir.appendingPathComponent("wrong.mp4"), width: W, height: H, fps: 30, bitrate: 6_000_000)
  check("a texture of another size is refused", throwsError { try second.append(texture: wrong) })
  second.cancel()
} catch {
  failures.append("texture: threw \(error)")
}

if failures.isEmpty {
  print("OK \(checks) checks")
} else {
  for failure in failures { print("FAILED \(failure)") }
  exit(1)
}
