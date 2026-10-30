// GitHub fiók (WP M3) as a VRG Mobile feature module: the device-flow sign-in screen and the account
// view. The client itself is kit's GitHub, shared by every online feature.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.account"
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
    implementation("androidx.browser:browser:1.8.0")   // github.com/login/device in a Custom Tab
}
