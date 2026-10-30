// Gyorsjegyzet (WP M6) as a VRG Mobile feature module: write, dictate or share a note; it goes to the
// `mobile-log` branch (D-6 = A) through kit's GitHub client, via an outbox that WorkManager sends when
// the phone is online.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.notes"
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
}
