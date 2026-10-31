// VRG_JVM_ONLY=1 (or -Pvrg.jvmOnly) builds only the pure Kotlin modules and never contacts Google's
// Maven, which is blocked in the cloud sandbox. That is what a cloud session runs (docs/mobile/CLOUD.md);
// the APK is built on a PC (Mobile\mobile.cmd) or by GitHub Actions (.github/workflows/mobile-android.yml).
val jvmOnly = System.getenv("VRG_JVM_ONLY") != null || providers.gradleProperty("vrg.jvmOnly").isPresent

pluginManagement {
    repositories {
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        if (!jvmOnly) google {
            content { includeGroupByRegex("(androidx|com\\.android|com\\.google)\\..*") }
        }
        mavenCentral()
    }
}

rootProject.name = "VRG-Mobile"

// The pure Kotlin modules: build and test on any JDK, no Android SDK.
include(":kit-core", ":airdeck-core")
if (!jvmOnly) include(":kit", ":feature-airdeck", ":feature-settings", ":feature-pair", ":feature-account", ":feature-notes", ":feature-update", ":app")
