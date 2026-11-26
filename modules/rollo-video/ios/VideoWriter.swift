import AVFoundation
import CoreVideo
import Foundation
import Metal

public struct VideoWriterError: Error, CustomStringConvertible {
  public let description: String
  public init(_ description: String) { self.description = description }
}

/// Frames in, an H.264 mp4 out. Not thread-safe: one caller at a time must use a writer (the module serializes access with a lock).
/// No Expo imports: it also compiles on macOS, where `check/main.swift` exercises it.
/// The classic AVAssetWriter calls are marked deprecated in the iOS 27 SDK; they are the only ones that exist before iOS 27.
public final class VideoWriter {
  public let url: URL
  public let width: Int
  public let height: Int
  public let fps: Int
  public private(set) var frames = 0

  private let writer: AVAssetWriter
  private let input: AVAssetWriterInput
  private let adaptor: AVAssetWriterInputPixelBufferAdaptor
  private var closed = false

  /// How long `append` waits for the encoder before giving up.
  public static let readyTimeoutMs = 5000

  public init(url: URL, width: Int, height: Int, fps: Int, bitrate: Int) throws {
    guard width > 0, height > 0, width % 2 == 0, height % 2 == 0 else {
      throw VideoWriterError("size must be even and positive: \(width)x\(height)")
    }
    guard (1...60).contains(fps) else { throw VideoWriterError("fps must be 1 to 60: \(fps)") }
    guard bitrate > 0 else { throw VideoWriterError("bitrate must be positive: \(bitrate)") }
    try? FileManager.default.removeItem(at: url)
    do {
      writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
    } catch {
      throw VideoWriterError("cannot write to \(url.path): \(error.localizedDescription)")
    }
    writer.shouldOptimizeForNetworkUse = true
    input = AVAssetWriterInput(
      mediaType: .video,
      outputSettings: [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
        AVVideoColorPropertiesKey: [
          AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
          AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
          AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
        ],
        AVVideoCompressionPropertiesKey: [
          AVVideoAverageBitRateKey: bitrate,
          AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
          AVVideoMaxKeyFrameIntervalKey: fps * 2,
          AVVideoExpectedSourceFrameRateKey: fps,
        ],
      ]
    )
    input.expectsMediaDataInRealTime = false
    adaptor = AVAssetWriterInputPixelBufferAdaptor(
      assetWriterInput: input,
      sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
        kCVPixelBufferIOSurfacePropertiesKey as String: [String: Any](),
      ]
    )
    guard writer.canAdd(input) else { throw VideoWriterError("cannot add the video input") }
    writer.add(input)
    guard writer.startWriting() else {
      let reason = writer.error?.localizedDescription ?? "unknown"
      try? FileManager.default.removeItem(at: url)
      throw VideoWriterError("cannot write to \(url.path): \(reason)")
    }
    writer.startSession(atSourceTime: .zero)
    self.url = url
    self.width = width
    self.height = height
    self.fps = fps
  }

  /// One frame as bytes: BGRA premultiplied, top row first.
  public func append(pixels: UnsafeRawPointer, byteCount: Int, bytesPerRow: Int) throws {
    let (needed, overflow) = bytesPerRow.multipliedReportingOverflow(by: height)
    guard bytesPerRow >= width * 4, !overflow, byteCount >= needed else {
      throw VideoWriterError("frame buffer too small: \(byteCount) bytes, \(bytesPerRow) per row, for \(width)x\(height)")
    }
    let height = self.height
    try write { base, row in
      if row == bytesPerRow {
        memcpy(base, pixels, row * height)
      } else {
        let n = min(row, bytesPerRow)
        for y in 0..<height { memcpy(base + y * row, pixels + y * bytesPerRow, n) }
      }
    }
  }

  /// One frame read from a Metal texture (BGRA8Unorm, CPU-readable, the film's size). The GPU must have finished drawing it.
  public func append(texture: MTLTexture) throws {
    guard texture.pixelFormat == .bgra8Unorm, texture.width == width, texture.height == height else {
      throw VideoWriterError("texture must be BGRA8Unorm \(width)x\(height), got \(texture.pixelFormat.rawValue) \(texture.width)x\(texture.height)")
    }
    guard texture.storageMode != .private else { throw VideoWriterError("texture is not CPU-readable") }
    let region = MTLRegionMake2D(0, 0, width, height)
    try write { base, row in texture.getBytes(base, bytesPerRow: row, from: region, mipmapLevel: 0) }
  }

  /// Closes the file. With no frames written there is nothing to keep: it cancels and throws.
  public func finish() async throws -> (bytes: Int, frames: Int) {
    guard !closed else { throw VideoWriterError("the video is already closed") }
    guard frames > 0 else {
      cancel()
      throw VideoWriterError("no frames were written")
    }
    // The encoder fails on its own thread, so it can be dead by now; AVFoundation raises (not throws) on a dead writer.
    guard writer.status == .writing else {
      let reason = writer.error?.localizedDescription ?? "status \(writer.status.rawValue)"
      cancel()
      throw VideoWriterError("the encoder stopped before the end: \(reason)")
    }
    closed = true
    input.markAsFinished()
    writer.endSession(atSourceTime: CMTime(value: CMTimeValue(frames), timescale: CMTimeScale(fps)))
    await writer.finishWriting()
    guard writer.status == .completed else {
      let reason = writer.error?.localizedDescription ?? "unknown"
      try? FileManager.default.removeItem(at: url)
      throw VideoWriterError("could not finish the video: \(reason)")
    }
    guard let bytes = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size]) as? Int, bytes > 0 else {
      try? FileManager.default.removeItem(at: url)
      throw VideoWriterError("the video file is missing or empty")
    }
    return (bytes, frames)
  }

  deinit {
    if !closed { cancel() }
  }

  /// Cancels the encoder from the outside, as if it had died on its own. Only for the checks.
  func cancelEncoderForTesting() { writer.cancelWriting() }

  /// Stops and removes whatever was written. Safe to call more than once.
  public func cancel() {
    if !closed {
      closed = true
      if writer.status == .writing { writer.cancelWriting() }
    }
    try? FileManager.default.removeItem(at: url)
  }

  /// An encoder-side failure ends the video: nothing partial is left behind. Caller mistakes (bad buffers) never come here.
  private func abandon(_ message: String) -> VideoWriterError {
    cancel()
    return VideoWriterError(message)
  }

  private func write(_ fill: (UnsafeMutableRawPointer, Int) -> Void) throws {
    guard !closed else { throw VideoWriterError("the video is already closed") }
    var waited = 0
    while !input.isReadyForMoreMediaData {
      guard writer.status == .writing else { throw abandon("the encoder stopped: \(writer.error?.localizedDescription ?? "unknown")") }
      guard waited < VideoWriter.readyTimeoutMs else { throw abandon("the encoder did not take the frame in time") }
      usleep(1000)
      waited += 1
    }
    guard let pool = adaptor.pixelBufferPool else { throw abandon("no pixel buffer pool") }
    var made: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, pool, &made)
    guard let buffer = made else { throw abandon("the pool gave no buffer") }
    CVPixelBufferLockBaseAddress(buffer, [])
    guard let base = CVPixelBufferGetBaseAddress(buffer) else {
      CVPixelBufferUnlockBaseAddress(buffer, [])
      throw abandon("the buffer has no memory")
    }
    fill(base, CVPixelBufferGetBytesPerRow(buffer))
    CVPixelBufferUnlockBaseAddress(buffer, [])
    let time = CMTime(value: CMTimeValue(frames), timescale: CMTimeScale(fps))
    guard adaptor.append(buffer, withPresentationTime: time) else {
      throw abandon("the encoder rejected the frame: \(writer.error?.localizedDescription ?? "unknown")")
    }
    frames += 1
  }
}
