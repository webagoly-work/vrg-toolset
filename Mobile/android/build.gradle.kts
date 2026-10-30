// The Gradle plugins, on the root classpath so Kotlin and the Android plugin share one classloader.
// A JVM-only build (VRG_JVM_ONLY=1, see settings.gradle.kts) leaves the Android plugin and Google's
// Maven out entirely: that repository is blocked in the cloud sandbox (docs/mobile/CLOUD.md).
buildscript {
    val jvmOnly = System.getenv("VRG_JVM_ONLY") != null || project.hasProperty("vrg.jvmOnly")
    repositories {
        if (!jvmOnly) google()
        mavenCentral()
        gradlePluginPortal()
    }
    dependencies {
        val kotlin = "2.0.21"
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlin")
        if (!jvmOnly) {
            classpath("org.jetbrains.kotlin:compose-compiler-gradle-plugin:$kotlin")
            classpath("com.android.tools.build:gradle:8.7.3")
        }
    }
}
