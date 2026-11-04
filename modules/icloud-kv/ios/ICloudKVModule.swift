import ExpoModulesCore
import Foundation

// iCloud key-value store of the Apple account signed in on the iPhone: the sessions come back after a
// reinstall or on a new iPhone. Needs the com.apple.developer.ubiquity-kvstore-identifier entitlement
// (app.json › ios.entitlements). Values are written locally at once, iOS uploads them when it can.
public class ICloudKVModule: Module {
  private var observer: NSObjectProtocol?
  private var store: NSUbiquitousKeyValueStore { NSUbiquitousKeyValueStore.default }

  public func definition() -> ModuleDefinition {
    Name("ICloudKV")

    Events("onChange")

    // Nil token: no iCloud account on the device, the store then stays local.
    Function("isSignedIn") { () -> Bool in
      FileManager.default.ubiquityIdentityToken != nil
    }

    Function("get") { (key: String) -> String? in
      self.store.string(forKey: key)
    }

    Function("set") { (key: String, value: String) in
      self.store.set(value, forKey: key)
    }

    Function("remove") { (key: String) in
      self.store.removeObject(forKey: key)
    }

    Function("keys") { () -> [String] in
      Array(self.store.dictionaryRepresentation.keys)
    }

    Function("synchronize") { () -> Bool in
      self.store.synchronize()
    }

    // Changes made by iCloud (another iPhone, first download after install, quota, account switch).
    OnStartObserving {
      self.observer = NotificationCenter.default.addObserver(
        forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
        object: self.store,
        queue: .main
      ) { [weak self] note in
        let reason = note.userInfo?[NSUbiquitousKeyValueStoreChangeReasonKey] as? Int ?? -1
        let keys = note.userInfo?[NSUbiquitousKeyValueStoreChangedKeysKey] as? [String] ?? []
        self?.sendEvent("onChange", ["reason": Self.reasonName(reason), "keys": keys])
      }
      self.store.synchronize()
    }

    OnStopObserving {
      if let observer = self.observer {
        NotificationCenter.default.removeObserver(observer)
      }
      self.observer = nil
    }
  }

  private static func reasonName(_ reason: Int) -> String {
    switch reason {
    case NSUbiquitousKeyValueStoreServerChange: return "server"
    case NSUbiquitousKeyValueStoreInitialSyncChange: return "initialSync"
    case NSUbiquitousKeyValueStoreQuotaViolationChange: return "quota"
    case NSUbiquitousKeyValueStoreAccountChange: return "account"
    default: return "unknown"
    }
  }
}
