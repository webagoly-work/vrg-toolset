// Varler Workflow Kit (WP M42, D-50 = C): the PC's Workflow Kit jobs on the phone, sealed to this phone's device key
// (Eszközök, WP M35) by tools/workflow-seal.js and carried on the `workflow-sealed` branch. The format and the crypto
// are kit-core's Workflow; the phone's key is kit's Trust.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.workflow"
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
