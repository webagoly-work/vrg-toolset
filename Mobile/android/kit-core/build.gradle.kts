// Pure Kotlin: the feature catalogue, link routing, the shell's settings rules and the relay pairing.
// No Android here, so `gradlew :kit-core:test` runs on any JDK without the Android SDK (cloud sessions included).
plugins {
    id("org.jetbrains.kotlin.jvm")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}
kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

dependencies {
    // Android ships org.json in the framework (same rule as airdeck-core); the relay messages use it.
    compileOnly("org.json:json:20240303")
    testImplementation("org.json:json:20240303")
    testImplementation(kotlin("test"))
}

tasks.test { useJUnitPlatform() }
