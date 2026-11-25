// Böngésző (WP M68, T7 of docs/browser/TRAJECTORIES.md): the phone's work browser, a confined WebView that keeps the VRG
// Böngésző's rules (kit-core WebRules) and its bookmarks and history in vrg.web-links v1 (kit-core WebLinks).
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.web"
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
}
