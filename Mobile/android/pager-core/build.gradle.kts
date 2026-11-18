// Csipogó (WP M24): the Site Pager reimagined on phones, pure JVM. The message set, the 8-byte frame and the
// Bluetooth beacon around it, the crew key, delivery with GOTIT / SEEN, the mesh relay, proximity from RSSI, the
// walkie-talkie codec (IMA ADPCM) and the link framing, the GUARD and man-down machines — all here, so
// `gradlew :pager-core:test` proves them on any JDK. feature-pager is the thin Android shell (BLE, audio, sensors).
plugins {
    id("org.jetbrains.kotlin.jvm")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}
kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

dependencies {
    // Android ships org.json in the framework (same rule as kit-core); the chat log uses it.
    compileOnly("org.json:json:20240303")
    testImplementation("org.json:json:20240303")
    testImplementation(kotlin("test"))
}

tasks.test { useJUnitPlatform() }
