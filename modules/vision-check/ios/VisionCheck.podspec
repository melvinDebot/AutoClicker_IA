Pod::Spec.new do |s|
  s.name           = 'VisionCheck'
  s.version        = '0.1.0'
  s.summary        = 'WKWebView snapshot, Vision OCR and image feature prints for AutoClicker'
  s.description    = s.summary
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WebKit', 'Vision'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
