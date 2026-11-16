// Версии плагинов намеренно отсутствуют. Autolink-библиотека собирается как
// Gradle-сабпроект хостового приложения (LynxLibrarySettingsPlugin делает
// settings.include(projectPath) + projectDir = androidDir), поэтому версии
// задаёт сборка хоста. Для standalone-проверки их подставляет ../android-check.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    // НЕ ОПЦИОНАЛЬНО. LynxLibraryBuildPlugin прокидывает аргумент процессора
    // -Alynx.library.packageName только внутри
    //   project.plugins.withId('kotlin-kapt') { ... }
    // и сам плагин никогда не применяет. Без kapt здесь
    // LynxLibraryProcessor.getProviderPackageName() вернёт "" и процессор
    // выйдет, не записав ни одного файла. Без ошибки.
    // Именно kapt, не ksp: lynx-processor это javax.annotation.processing
    // AbstractProcessor, а плагин ищет 'kotlin-kapt' по id.
    id("org.jetbrains.kotlin.kapt")
}

android {
    namespace = "dev.lynxlab.lifecycle"
    compileSdk = 35

    defaultConfig {
        // Нижнюю границу задаёт Lynx, а не эта библиотека.
        minSdk = 23
        consumerProguardFiles("consumer-rules.pro")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = "11"
    }
    lint {
        warningsAsErrors = providers.gradleProperty("lynxLifecycleStrictChecks").orNull == "true"
        abortOnError = true
    }
}

dependencies {
    testImplementation("junit:junit:4.13.2")

    // compileOnly, не implementation: Lynx поставляет хост, а отгрузка его
    // как implementation рискует duplicate-class.
    compileOnly("org.lynxsdk.lynx:lynx:4.0.1")

    // Сгенерированный LynxLibraryProviderImpl помечается @androidx.annotation.Keep,
    // поэтому androidx.annotation должен быть на compile classpath.
    // Preserve the existing host-compatible profile. Owner: Lynx Lab; review by 2026-12-16.
    //noinspection GradleDependency
    compileOnly("androidx.annotation:annotation:1.9.1")

    kapt("org.lynxsdk.lynx:lynx-processor:4.0.1")
}

if (providers.gradleProperty("lynxLifecycleStrictChecks").orNull == "true") {
    tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
        kotlinOptions {
            // KGP 2.0.21 kapt supports 1.9; this opt-in affects only standalone checks.
            languageVersion = "1.9"
            allWarningsAsErrors = true
        }
    }
}
