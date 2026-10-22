import ExpoModulesCore
import SwiftUI
import UIKit

/// A big SF Symbol that goes lock → open lock → camera with SwiftUI's symbol transitions.
public class RolloSymbolModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RolloSymbol")

    View(RolloLockView.self) {
      Prop("phase") { (view, phase: String?) in view.model.phase = phase ?? "locked" }
      Prop("size") { (view, size: Double?) in view.model.size = size ?? 96 }
      Prop("tint") { (view, tint: UIColor?) in view.model.tint = tint.map { Color($0) } ?? .primary }
    }
  }
}

final class LockModel: ObservableObject {
  @Published var phase = "locked"
  @Published var size: Double = 96
  @Published var tint: Color = .primary
}

final class RolloLockView: ExpoView {
  let model = LockModel()
  private lazy var host = UIHostingController(rootView: LockSymbol(model: model))

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    host.view.backgroundColor = .clear
    addSubview(host.view)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    host.view.frame = bounds
  }
}

struct LockSymbol: View {
  @ObservedObject var model: LockModel
  @State private var wiggles = 0

  private var name: String {
    switch model.phase {
    case "camera": return "camera.fill"
    case "unlocking": return "lock.open.fill"
    default: return "lock.fill"
    }
  }

  var body: some View {
    let image = Image(systemName: name)
      .font(.system(size: model.size))
      .foregroundStyle(model.tint)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .animation(.default, value: name)
      .onAppear { DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { wiggles += 1 } }

    if UIAccessibility.isReduceMotionEnabled {
      image.contentTransition(.opacity)
    } else if #available(iOS 18.0, *) {
      // Magic replace morphs lock → open lock; to the camera (unrelated shapes) it falls back to down-up.
      image
        .contentTransition(.symbolEffect(.replace.magic(fallback: .downUp)))
        .symbolEffect(.wiggle, value: wiggles)
        .symbolEffect(.bounce, value: model.phase == "camera")
    } else if #available(iOS 17.0, *) {
      image
        .contentTransition(.symbolEffect(.replace.downUp))
        .symbolEffect(.bounce, value: model.phase == "camera")
    } else {
      image
    }
  }
}
