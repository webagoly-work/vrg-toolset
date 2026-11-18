// Eszközök (WP M35): Proton Vault's device approval for VRG Mobile. This phone's identity and request QR, the owner's
// approval (the trusted list on main, a grant QR), the release lock. The rules and crypto are kit-core's DeviceTrust;
// the phone side (key, list, GitHub writes) is kit's Trust.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.devices"
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
