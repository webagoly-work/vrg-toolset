// VRG Mobile: the shell and the APK. It holds the home screen, the links and the Activity; every
// feature lives in its own feature-<id> module and is listed in Registry.kt.
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// CI: `git rev-list --count HEAD` (mobile-release.yml). A desktop build stays 1, so it never looks newer.
val buildCode = System.getenv("VRG_VERSION_CODE")?.toIntOrNull() ?: 1
// All four come from mobile-release.yml. Without them a local release build keeps the debug key.
val keystore = System.getenv("MOBILE_KEYSTORE_FILE")

android {
    namespace = "hu.vrg.mobile"
    compileSdk = 35

    if (keystore != null) signingConfigs.create("release") {
        storeFile = file(keystore)
        storePassword = System.getenv("MOBILE_KEYSTORE_PASS")
        keyAlias = System.getenv("MOBILE_KEY_ALIAS")
        keyPassword = System.getenv("MOBILE_KEY_PASS")
    }

    defaultConfig {
        applicationId = "hu.vrg.mobile"   // D-1 = A: a new app beside the old Légegér APK
        minSdk = 28                       // BluetoothHidDevice (Légegér) arrived in Android 9
        targetSdk = 35
        versionCode = buildCode
        versionName = "0.9.$buildCode"
        // GitHub Actions sets GITHUB_SHA; a desktop build says so instead. Beállítások -> Névjegy shows it.
        // The "git:" prefix keeps an all-digit SHA from being read back as a number from the manifest.
        manifestPlaceholders["gitSha"] = "git:" + (System.getenv("GITHUB_SHA")?.take(7) ?: "helyi")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            signingConfig = signingConfigs.getByName(if (keystore != null) "release" else "debug")
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
    implementation(project(":feature-notes"))
    implementation(project(":feature-update"))
}
