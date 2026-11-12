// Alkalmazások (WP M21) as a VRG Mobile feature module: the Desktop's in-shell HTML apps (Planner, the calculators, Készlet,
// MindMap, BuildTree, Valena), read from main through the contents API and shown each on its own https origin in a confined WebView.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.apps"
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
