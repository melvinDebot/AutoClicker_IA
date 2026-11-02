import ExpoModulesCore
import UIKit
import WebKit

// Step 1: WKWebView snapshot, temporary file cleanup, WebView data wipe.
// Step 2 adds OCR (VNRecognizeTextRequest) and icon matching (VNGenerateImageFeaturePrintRequest).
public class VisionCheckModule: Module {
  private static let filePrefix = "vision-check-"

  public func definition() -> ModuleDefinition {
    Name("VisionCheck")

    // Snapshot of the visible WKWebView area. Size is in points (= CSS px at zoom 1),
    // `scale` gives the pixel density of the PNG.
    AsyncFunction("snapshot") { (viewTag: Int?, promise: Promise) in
      guard let webView = self.findWebView(viewTag: viewTag) else {
        promise.reject("E_NO_WEBVIEW", "WKWebView introuvable")
        return
      }
      let config = WKSnapshotConfiguration()
      config.afterScreenUpdates = true
      webView.takeSnapshot(with: config) { image, error in
        guard let image, let data = image.pngData() else {
          promise.reject("E_SNAPSHOT", error?.localizedDescription ?? "Capture impossible")
          return
        }
        let url = FileManager.default.temporaryDirectory
          .appendingPathComponent("\(Self.filePrefix)\(UUID().uuidString).png")
        do {
          try data.write(to: url, options: .completeFileProtection)
          promise.resolve([
            "uri": url.absoluteString,
            "width": image.size.width,
            "height": image.size.height,
            "scale": image.scale,
          ])
        } catch {
          promise.reject("E_WRITE", error.localizedDescription)
        }
      }
    }.runOnQueue(.main)

    // No screenshot is kept: every snapshot file is deleted once used.
    AsyncFunction("release") { (uri: String) in
      guard let url = URL(string: uri), url.isFileURL,
        url.lastPathComponent.hasPrefix(Self.filePrefix),
        url.deletingLastPathComponent().standardizedFileURL
          == FileManager.default.temporaryDirectory.standardizedFileURL
      else { return }
      try? FileManager.default.removeItem(at: url)
    }

    AsyncFunction("releaseAll") {
      let tmp = FileManager.default.temporaryDirectory
      let files = (try? FileManager.default.contentsOfDirectory(at: tmp, includingPropertiesForKeys: nil)) ?? []
      for f in files where f.lastPathComponent.hasPrefix(Self.filePrefix) {
        try? FileManager.default.removeItem(at: f)
      }
    }

    // "Tout effacer": cookies, local storage, caches of the WebView (Instagram session included).
    AsyncFunction("clearWebsiteData") { (promise: Promise) in
      let store = WKWebsiteDataStore.default()
      store.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast) {
        promise.resolve(nil)
      }
    }.runOnQueue(.main)
  }

  private func findWebView(viewTag: Int?) -> WKWebView? {
    if let tag = viewTag,
      let view = appContext?.findView(withTag: tag, ofType: UIView.self),
      let webView = Self.firstWebView(in: view)
    {
      return webView
    }
    // Fallback: the app holds a single WKWebView (Home tab).
    let windows = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
    for window in windows {
      if let webView = Self.firstWebView(in: window) { return webView }
    }
    return nil
  }

  private static func firstWebView(in view: UIView) -> WKWebView? {
    if let webView = view as? WKWebView { return webView }
    for sub in view.subviews {
      if let webView = firstWebView(in: sub) { return webView }
    }
    return nil
  }
}
