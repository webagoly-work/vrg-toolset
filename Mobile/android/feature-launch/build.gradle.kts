// Indítópult (WP M11) as a VRG Mobile feature module: START's tools on the phone, started on the PC by
// the relay (relay-launch.js), with a running dot, the log tail, and "Megnyitás a telefonon" through
// the M8 proxy.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.launch"
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
    implementation("androidx.browser:browser:1.8.0")   // "Megnyitás a telefonon": the proxied page in a Custom Tab
}
