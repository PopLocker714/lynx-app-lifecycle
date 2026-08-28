// Обвязка, чтобы android/ можно было скомпилировать без хостового приложения.
// В проде версии плагинов задаёт сборка хоста (LynxLibrarySettingsPlugin
// подключает android/ как сабпроект), поэтому здесь они только для проверки
// и в тарбол этот каталог не уезжает.
pluginManagement {
  repositories {
    google()
    mavenCentral()
    gradlePluginPortal()
  }
  plugins {
    id("com.android.library") version "8.7.0"
    id("org.jetbrains.kotlin.android") version "2.0.21"
    id("org.jetbrains.kotlin.kapt") version "2.0.21"
  }
}

dependencyResolutionManagement {
  repositories {
    google()
    mavenCentral()
  }
}

rootProject.name = "lynx-app-lifecycle-check"

include(":lynx-app-lifecycle")
project(":lynx-app-lifecycle").projectDir = file("../android")
