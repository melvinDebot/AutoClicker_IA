Pod::Spec.new do |s|
  s.name           = 'ICloudKV'
  s.version        = '0.1.0'
  s.summary        = 'iCloud key-value store (NSUbiquitousKeyValueStore) for the AutoClicker backup'
  s.description    = s.summary
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
