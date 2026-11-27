// VRG Térkép (WP M43) as a VRG Mobile feature module: the PC's Map/vrg-terkep.html from main in a confined WebView on its own
// origin; the map data from the paired PC through the relay, or straight from the public planet files with a tile cache (D-48).
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.map"
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
    implementation(project(":sketch-core"))   // read-only: the Vázlat sites (filesDir/sketch/*.vsketch.json) as pins
}
