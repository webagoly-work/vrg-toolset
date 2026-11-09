// Hálózat (WP M7, D-9 = A) as a VRG Mobile feature module: every link of the phone on one screen with its honest
// state (tethering, local-only WiFi, usage, Légegér's Bluetooth HID), and the phone's own relay — relay-core's
// WebSocket server in a connectedDevice foreground service. docs/mobile/research/M7-network.md has the limits.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.net"
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
    implementation(project(":relay-core"))
}
