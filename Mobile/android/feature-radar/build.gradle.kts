// Radar (WP M67) as a VRG Mobile feature module: the full-screen radar over every registered source (kit-core RadarHub),
// with layers, Irány fel / Észak fel, Irány keresése (the turn-round direction sweep) and the blip card. The radar part
// itself (kit/ui/Radar.kt) and the layout (kit-core Radar.kt) are shared: features embed the same radar for their layer.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.radar"
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
