// Pure Kotlin: the feature catalogue and link routing. No Android here, so `gradlew :kit-core:test`
// runs on any JDK without the Android SDK (cloud sessions included).
plugins {
    id("org.jetbrains.kotlin.jvm")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}
kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

dependencies {
    testImplementation(kotlin("test"))
}

tasks.test { useJUnitPlatform() }
