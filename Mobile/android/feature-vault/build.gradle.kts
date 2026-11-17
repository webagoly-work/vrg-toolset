// Széf (WP M24) as a VRG Mobile feature module: the phone's encrypted vault (client data, ID papers, documents,
// folders, files), opened by a PIN / passphrase or a fingerprint / face. Its rules and crypto are in kit-core/Vault.kt.
// The fingerprint prompt is the framework's own (android.hardware.biometrics, API 28+), so no new library is needed.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.vault"
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
