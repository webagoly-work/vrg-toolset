// VRG Sketcher, Kamera 2: the on-device vision behind one small interface (TextReader), so the recogniser can be
// swapped without touching the Sketcher. Today: Google ML Kit's BUNDLED Latin text recognition (v2), which runs
// offline with the model inside the APK (about 4 MB per CPU architecture; D-55 in docs/mobile/DECISIONS.md).
// And ML Kit's bundled face detection (FaceFinder, about 6.9 MB per architecture; chosen 2026-11-21, D-56 = B).
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "hu.vrg.mobile.sketch.vision"
    compileSdk = 35
    defaultConfig { minSdk = 28 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("com.google.mlkit:text-recognition:16.0.1")             // bundled Latin model (not the Play-services one)
    implementation("com.google.mlkit:face-detection:16.1.7")               // bundled face model (D-56 = B)
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
