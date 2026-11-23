// Tárgykereső (WP M61, experimental) as a VRG Mobile feature module: Apple Find My tags from Android over plain BLE.
// tag-core holds every rule (the advertisement, the key, the sound bytes, the tag book, relink, left-behind); this
// module is the Android shell: the filtered scanner, the GATT ring, the left-behind foreground service, the screen.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.tag.app"
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
    implementation(project(":tag-core"))
}
