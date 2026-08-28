require "json"

package = JSON.parse(File.read(File.join(__dir__, "..", "package.json")))

Pod::Spec.new do |s|
  s.name         = "LynxAppLifecycle"
  s.version      = package["version"] == "0.0.0-development" ? "0.0.1" : package["version"]
  s.summary      = "App foreground/background lifecycle events for Lynx"
  s.description  = package["description"]
  s.homepage     = "https://github.com/PopLocker714/lynx-app-lifecycle"
  s.license      = { :type => "MIT", :file => "../LICENSE" }
  s.author       = { "PopLocker714" => "jonirootman714@gmail.com" }
  s.platforms    = { :ios => "12.0" }
  s.source       = { :git => "https://github.com/PopLocker714/lynx-app-lifecycle.git", :tag => "v#{s.version}" }

  s.source_files = "src/**/*.{h,m}"

  # Без ограничения версии: Lynx поставляет хост, а любой пин ломает резолв.
  # Шаблон Sparkling пинит 3.6.0 (latest) или 3.9.0 (rc), а поды Lynx 4.x
  # на CocoaPods не резолвятся вовсе из-за конфликта LynxServiceAPI.
  s.dependency "Lynx"
end
