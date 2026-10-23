Pod::Spec.new do |s|
  s.name           = 'RolloSymbol'
  s.version        = '0.1.0'
  s.summary        = 'SF Symbol transitions (lock → camera) for Rollo'
  s.description    = 'SwiftUI SF Symbol view with replace / wiggle / bounce effects'
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
