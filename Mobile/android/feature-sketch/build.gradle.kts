// Vázlat (WP M24) as a VRG Mobile feature module: the field sketch's canvas, tool rail, hold wheels, memos and tags,
// the Rendezés view and the export. Its logic is sketch-core (pure Kotlin, tested on the JVM); this is the screen.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.sketch.ui"
    compileSdk = 35
    defaultConfig { minSdk = 28 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
}

dependencies {
    implementation(project(":kit"))
    implementation(project(":sketch-core"))
}
