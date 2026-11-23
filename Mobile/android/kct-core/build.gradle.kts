// Óra (WP M65): the Q71 watch's own language, pure JVM. The 18A0 frame (F0F0F0F1, length, RC4 header, plain payload),
// the frame reassembler for multi-read / multi-write frames, the KCT text commands and their replies, the SETNEW
// watch-face block chunker with CRC-32, the notification XML and the watch-face .bin reader. Decoded 2026-11-22 from
// Bluetooth captures and FunDo's libCommand.so (notes/q71-watch, outside git); no FunDo code or asset is in here.
// `gradlew :kct-core:test` proves it on any JDK against the captured frames; feature-watch is the Android shell.
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
