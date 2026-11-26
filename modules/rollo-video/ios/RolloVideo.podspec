Pod::Spec.new do |s|
  s.name           = 'RolloVideo'
  s.version        = '0.1.0'
  s.summary        = 'Write frames to an H.264 mp4 and hand a video to Instagram for Rollo'
  s.description    = 'Local Expo module: AVAssetWriter video encoder plus Instagram Stories and Reels sharing'
  s.author         = ''
  s.homepage       = 'https://github.com/rollo-app/mobile'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = "**/*.{h,m,mm,swift}"
end
