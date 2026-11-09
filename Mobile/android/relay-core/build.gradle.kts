// The phone's own relay (WP M7, D-9 = A), pure JVM: a small RFC 6455 WebSocket server (WsServer), the
// envelope and routing rules of Planner/projects/varler-planner/tools/phone-relay-server.js (PhoneRelay), and
// its pairing (codes, keys, signatures). No Android here, so `gradlew :relay-core:test` runs the real server
// on any JDK; feature-net wraps it in a foreground service on the phone.
plugins {
    id("org.jetbrains.kotlin.jvm")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}
kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

dependencies {
    // Android ships org.json in the framework (same rule as kit-core); the envelopes use it.
    compileOnly("org.json:json:20240303")
    testImplementation("org.json:json:20240303")
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
    inputs.file(rootProject.projectDir.resolve("../tests/fixtures/phone-relay-webcrypto.json"))   // PhoneRelayTest
}
