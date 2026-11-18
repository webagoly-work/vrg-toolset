// Csipogó (WP M33) as a VRG Mobile feature module: the Site Pager on phones. pager-core holds every rule (frame,
// beacon, crew MAC, delivery, relay, proximity, ADPCM, guard, man-down); this module is the Android shell around it:
// BLE advertising + scanning, L2CAP links, the microphone and speaker, the accelerometer, vibration, notifications,
// one connectedDevice foreground service, and the screen.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.pager.app"
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
    implementation(project(":pager-core"))
}
