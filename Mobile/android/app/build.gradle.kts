// VRG Mobile: the shell and the APK. It holds the home screen, the links and the Activity; every
// feature lives in its own feature-<id> module and is listed in Registry.kt.
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile"
    compileSdk = 35

    defaultConfig {
        applicationId = "hu.vrg.mobile"   // D-1 = A: a new app beside the old Légegér APK
        minSdk = 28                       // BluetoothHidDevice (Légegér) arrived in Android 9
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        // GitHub Actions sets GITHUB_SHA; a desktop build says so instead. Beállítások -> Névjegy shows it.
        // The "git:" prefix keeps an all-digit SHA from being read back as a number from the manifest.
        manifestPlaceholders["gitSha"] = "git:" + (System.getenv("GITHUB_SHA")?.take(7) ?: "helyi")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            // Signed with the debug key until WP M9 (self-update) brings a real release key.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true; buildConfig = true }
}

dependencies {
    implementation(project(":kit"))
    implementation(project(":feature-airdeck"))
    implementation(project(":feature-settings"))
    implementation(project(":feature-pair"))
    implementation(project(":feature-account"))
}
