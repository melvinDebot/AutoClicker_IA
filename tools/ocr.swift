// Runs Apple Vision OCR (same framework as the iOS module) on screenshots and prints JSON.
// Boxes are normalized (0…1), origin top-left, like the DOM boxes.
// Usage: swift tools/ocr.swift [--write] <images…>
//   --write: saves <image>.ocr.json next to each image instead of printing.
import Foundation
import ImageIO
import Vision

let args = Array(CommandLine.arguments.dropFirst())
let write = args.contains("--write")
var results: [[String: Any]] = []
for path in args where path != "--write" {
  let url = URL(fileURLWithPath: path)
  guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
  else {
    FileHandle.standardError.write("cannot read \(path)\n".data(using: .utf8)!)
    continue
  }
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.recognitionLanguages = ["fr-FR", "en-US"]
  request.usesLanguageCorrection = false
  try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])

  var blocks: [[String: Any]] = []
  for observation in request.results ?? [] {
    guard let best = observation.topCandidates(1).first else { continue }
    let b = observation.boundingBox  // Vision: origin bottom-left
    blocks.append([
      "text": best.string,
      "confidence": (Double(best.confidence) * 100).rounded() / 100,
      "box": [
        "x": (b.minX * 1000).rounded() / 1000,
        "y": ((1 - b.maxY) * 1000).rounded() / 1000,
        "w": (b.width * 1000).rounded() / 1000,
        "h": (b.height * 1000).rounded() / 1000,
      ],
    ])
  }
  let result: [String: Any] = ["file": url.lastPathComponent, "width": image.width, "height": image.height, "blocks": blocks]
  if write {
    let out = url.deletingPathExtension().appendingPathExtension("ocr.json")
    try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]).write(to: out)
  } else {
    results.append(result)
  }
}
if !write {
  let data = try JSONSerialization.data(withJSONObject: results, options: [.prettyPrinted, .sortedKeys])
  FileHandle.standardOutput.write(data)
}
