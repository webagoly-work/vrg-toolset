// Értesítések (WP M10, D-11 = C) as a VRG Mobile feature module: GitHub polled every 15 minutes by
// WorkManager (conditional requests through kit's GitHub.poll), relay events live while on the PC's WiFi,
// one list grouped by day and phone notifications through kit's VrgNotify channels. The rules are
// kit-core's Inbox.kt. A push service (D-11 B) is a later WP; it would feed the same InboxState.ingest.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.inbox"
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
    implementation("androidx.work:work-runtime-ktx:2.10.0")
    implementation("androidx.browser:browser:1.8.0")   // a tap opens the GitHub page in a Custom Tab
}
