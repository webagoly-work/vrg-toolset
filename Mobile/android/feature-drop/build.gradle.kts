// Átadás (WP M12) as a VRG Mobile feature module: the relay's file board (relay-board.js) on the phone,
// files and photos to the PC (to the board, the Planner or the Inventory), downloads into Letöltések,
// and the clipboard both ways.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.drop"
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
