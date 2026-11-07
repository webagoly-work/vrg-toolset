// Rétegverem (WP M17) as a VRG Mobile feature module: the VRG Stack's two 3D pages (Konnektóm, Holo), published
// from the PC on stack-pages (Mobile/stack/publish-stack.js) and shown in a WebView. Touch lives in the pages.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.stack"
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
