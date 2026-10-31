// Haladás (WP M4, D-8 = A) as a VRG Mobile feature module: where the work stands, from main's commits,
// CI and changed tools down to the branches that still hold unmerged work.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.pulse"
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
    implementation("androidx.browser:browser:1.8.0")   // a commit or a PR in a Custom Tab
}
