// VRG Időjárás (WP M44) as a VRG Mobile feature module: a native screen over weather-core (D-142). The phone calls
// MET Norway, DWD MOSMIX and MeteoAlarm itself (D-143); "Itt" reads the GPS once on a tap, rounded to ~1 km (D-144).
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.weather.app"
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
    implementation(project(":weather-core"))
}
