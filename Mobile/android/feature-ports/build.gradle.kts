// Localhost (WP M8, D-10 = C) as a VRG Mobile feature module: the PC's local servers from the relay,
// opened on the phone through the relay's /p/<port>/ proxy or in their own window on the PC.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.ports"
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
    implementation("androidx.browser:browser:1.8.0")   // "📱 Itt": the proxied page in a Custom Tab
}
