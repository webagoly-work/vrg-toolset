// Légegér (AirDeck) as a VRG Mobile feature module. The package stays hu.vrg.legeger so the code and
// its history read the same as before the move; the shell (:app) is the APK.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.legeger"
    compileSdk = 35
    defaultConfig {
        minSdk = 28            // BluetoothHidDevice arrived in Android 9
        consumerProguardFiles("consumer-rules.pro")
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
}

dependencies {
    implementation(project(":airdeck-core"))
    implementation(project(":kit"))
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
