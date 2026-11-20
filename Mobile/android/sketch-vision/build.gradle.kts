// VRG Sketcher, Kamera 2: the on-device vision behind one small interface (TextReader), so the recogniser can be
// swapped without touching the Sketcher. Today: Google ML Kit's BUNDLED Latin text recognition (v2), which runs
// offline with the model inside the APK (about 4 MB per CPU architecture; D-55 in docs/mobile/DECISIONS.md).
// Face detection is deliberately not here: its bundled model is about 6.9 MB (D-56, a documented later step).
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
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
