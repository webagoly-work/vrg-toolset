// Tárgykereső (WP M61, experimental): Apple Find My tags (ISYTag, AirTag, other "Works with Apple Find My" tags) seen
// from Android, pure JVM. The advertisement parser (offline finding, near-owner, pairing mode), the key carried in the
// advertisement, the sound protocols' bytes, the tag book with "this one is mine", the address-rotation relink, the
// left-behind watch. Distance comes from pager-core's RssiTrack / Proximity (one radio model for the whole app).
// `gradlew :tag-core:test` proves it on any JDK; feature-tag is the Android shell (BLE scan, GATT, service, screen).
plugins {
    id("org.jetbrains.kotlin.jvm")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}
kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

dependencies {
    api(project(":pager-core"))
    testImplementation(kotlin("test"))
    testImplementation("org.json:json:20240303")   // DiagTest parses the report it writes
}

tasks.test { useJUnitPlatform() }
