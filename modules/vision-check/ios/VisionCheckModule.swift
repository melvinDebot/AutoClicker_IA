import ExpoModulesCore
import UIKit
import Vision
import WebKit

/// Region in points, in the snapshot / WebView coordinate space.
struct Region: Record {
  @Field var x: Double = 0
  @Field var y: Double = 0
  @Field var w: Double = 0
  @Field var h: Double = 0
}

// WKWebView snapshot, Vision OCR, colour statistics and image feature prints.
// Everything runs on the iPhone, no training, nothing leaves the device.
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

    // Text recognition (French and English) in a region; boxes in points.
    AsyncFunction("ocr") { (uri: String, scale: Double, region: Region?) -> [[String: Any]] in
      let (image, origin) = try Self.crop(uri: uri, scale: scale, region: region)
      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.recognitionLanguages = ["fr-FR", "en-US"]
      request.usesLanguageCorrection = false
      try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
      let w = Double(image.width) / scale
      let h = Double(image.height) / scale
      return (request.results ?? []).compactMap { obs in
        guard let best = obs.topCandidates(1).first else { return nil }
        let b = obs.boundingBox
        return [
          "text": best.string,
          "confidence": Double(best.confidence),
          "box": [
            "x": origin.x + Double(b.minX) * w,
            "y": origin.y + Double(1 - b.maxY) * h,
            "w": Double(b.width) * w,
            "h": Double(b.height) * h,
          ],
        ]
      }
    }

    // Colour statistics of a region (or of the ring around it when `annulus` is true):
    // red = liked heart, saturated = story ring gradient, grey = seen story or highlight ring.
    AsyncFunction("colorStats") { (uri: String, scale: Double, region: Region, annulus: Bool) -> [String: Double] in
      let (image, _) = try Self.crop(uri: uri, scale: scale, region: region)
      return Self.colorStats(image, annulus: annulus)
    }

    // Image feature print distance between a region and template images (lower = closer).
    AsyncFunction("matchIcon") { (uri: String, scale: Double, region: Region, templates: [String]) -> [[String: Any]] in
      let (image, _) = try Self.crop(uri: uri, scale: scale, region: region)
      let print = try Self.featurePrint(image)
      return templates.compactMap { t in
        guard let templateImage = Self.loadImage(t), let tp = try? Self.featurePrint(templateImage) else { return nil }
        var distance: Float = 0
        guard (try? print.computeDistance(&distance, to: tp)) != nil else { return nil }
        return ["template": t, "distance": Double(distance)]
      }
    }

    // Saves a crop as PNG (templates regenerated on the iPhone from DOM boxes).
    AsyncFunction("cropToFile") { (uri: String, scale: Double, region: Region) -> String in
      let (image, _) = try Self.crop(uri: uri, scale: scale, region: region)
      let url = FileManager.default.temporaryDirectory
        .appendingPathComponent("\(Self.filePrefix)crop-\(UUID().uuidString).png")
      guard let data = UIImage(cgImage: image).pngData() else { throw Exception(name: "E_PNG", description: "PNG impossible") }
      try data.write(to: url)
      return url.absoluteString
    }

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

  // MARK: - Images

  private static func loadImage(_ uri: String) -> CGImage? {
    let url = URL(string: uri).flatMap { $0.isFileURL ? $0 : nil } ?? URL(fileURLWithPath: uri)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
    return CGImageSourceCreateImageAtIndex(source, 0, nil)
  }

  /// Crops a region given in points; returns the crop and its origin in points.
  private static func crop(uri: String, scale: Double, region: Region?) throws -> (CGImage, (x: Double, y: Double)) {
    guard let image = loadImage(uri) else { throw Exception(name: "E_IMAGE", description: "Image illisible") }
    guard let r = region, r.w > 0, r.h > 0 else { return (image, (0, 0)) }
    let full = CGRect(x: 0, y: 0, width: image.width, height: image.height)
    let rect = CGRect(x: r.x * scale, y: r.y * scale, width: r.w * scale, height: r.h * scale).integral.intersection(full)
    guard !rect.isEmpty, let cropped = image.cropping(to: rect) else {
      throw Exception(name: "E_REGION", description: "Zone hors de la capture")
    }
    return (cropped, (Double(rect.minX) / scale, Double(rect.minY) / scale))
  }

  private static func featurePrint(_ image: CGImage) throws -> VNFeaturePrintObservation {
    let request = VNGenerateImageFeaturePrintRequest()
    try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
    guard let result = request.results?.first else { throw Exception(name: "E_PRINT", description: "Empreinte impossible") }
    return result
  }

  private static func colorStats(_ image: CGImage, annulus: Bool) -> [String: Double] {
    // Downsample to at most 64×64 RGBA pixels.
    let side = 64
    let w = min(side, image.width), h = min(side, image.height)
    var pixels = [UInt8](repeating: 0, count: w * h * 4)
    let space = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(
      data: &pixels, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: space,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
    else { return [:] }
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))

    var n = 0.0, red = 0.0, saturated = 0.0, grey = 0.0, dark = 0.0, light = 0.0, luma = 0.0
    let cx = Double(w) / 2, cy = Double(h) / 2, radius = Double(min(w, h)) / 2
    for y in 0..<h {
      for x in 0..<w {
        if annulus {
          let d = ((Double(x) + 0.5 - cx) * (Double(x) + 0.5 - cx) + (Double(y) + 0.5 - cy) * (Double(y) + 0.5 - cy)).squareRoot()
          if d < radius * 0.80 || d > radius * 0.99 { continue }
        }
        let i = (y * w + x) * 4
        let r = Double(pixels[i]) / 255, g = Double(pixels[i + 1]) / 255, b = Double(pixels[i + 2]) / 255
        let maxC = max(r, g, b), minC = min(r, g, b)
        let sat = maxC == 0 ? 0 : (maxC - minC) / maxC
        let l = 0.2126 * r + 0.7152 * g + 0.0722 * b
        n += 1
        luma += l
        if r > 0.75 && g < 0.35 && b < 0.45 { red += 1 }
        if sat > 0.45 && maxC > 0.35 { saturated += 1 }
        if sat < 0.12 && l > 0.25 && l < 0.85 { grey += 1 }
        if l < 0.25 { dark += 1 }
        if l > 0.85 { light += 1 }
      }
    }
    guard n > 0 else { return [:] }
    return [
      "red": red / n, "saturated": saturated / n, "grey": grey / n,
      "dark": dark / n, "light": light / n, "meanLuma": luma / n, "samples": n,
    ]
  }

  // MARK: - WebView lookup

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
