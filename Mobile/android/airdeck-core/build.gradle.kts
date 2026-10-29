// Pure Kotlin: the wire format, HID reports, key layouts and gyro maths. No Android here, so
// `gradlew :core:test` runs on any JDK without the Android SDK.
plugins {
    id("org.jetbrains.kotlin.jvm")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}
kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

dependencies {
    implementation(project(":kit-core"))   // RelayAddress: one relay-address rule for the whole app
    // Android ships org.json in the framework; bundling a second copy into the app breaks lint.
    compileOnly("org.json:json:20240303")
    testImplementation("org.json:json:20240303")
    testImplementation(kotlin("test"))
}

tasks.test { useJUnitPlatform() }
