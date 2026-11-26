import ExpoModulesCore
import UIKit

/// Hands a video to Instagram as the background of a Story or a Reel, through the pasteboard.
enum InstagramVideoShare {
  private static let backgroundVideoKey = "com.instagram.sharedSticker.backgroundVideo"
  private static let appIdKey = "com.instagram.sharedSticker.appID"
  private static let pasteboardLifetime: TimeInterval = 300

  /// False when Instagram can't be opened (the pasteboard is left alone). Call on the main queue.
  static func share(target: String, videoUri: String, appId: String) throws -> Bool {
    let urlString: String
    switch target {
    case "stories": urlString = "instagram-stories://share?source_application=\(appId)"
    case "reels": urlString = "instagram-reels://share"
    default: throw Exception(name: "RolloVideoError", description: "unknown target")
    }
    guard let url = URL(string: urlString) else {
      throw Exception(name: "RolloVideoError", description: "bad Instagram url")
    }
    guard let file = URL(string: videoUri), file.isFileURL else {
      throw Exception(name: "RolloVideoError", description: "not a file uri")
    }
    let data: Data
    do {
      data = try Data(contentsOf: file)
    } catch {
      throw Exception(name: "RolloVideoError", description: "cannot read the video: \(error.localizedDescription)")
    }
    guard UIApplication.shared.canOpenURL(url) else { return false }

    var item: [String: Any] = [backgroundVideoKey: data]
    if target == "reels" { item[appIdKey] = appId }
    UIPasteboard.general.setItems(
      [item], options: [.expirationDate: Date().addingTimeInterval(pasteboardLifetime)])
    UIApplication.shared.open(url, options: [:], completionHandler: nil)
    return true
  }
}
