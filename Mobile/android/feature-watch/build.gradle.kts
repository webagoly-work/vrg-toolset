// Óra (WP M65) as a VRG Mobile feature module: the Q71 watch without FunDo. kct-core holds the protocol (frames, KCT
// commands, the conversation); this module is the Android shell: the unbonded LE link to Q71_LE, the phone-side GATT
// server (1802 find phone, 1805 time), the connectedDevice foreground service and the screen.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.watch.app"
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
    implementation(project(":kct-core"))
}
