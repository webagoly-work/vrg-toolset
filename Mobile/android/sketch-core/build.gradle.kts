// Vázlat (WP M24): the field sketch's pure Kotlin. The model and its JSON, the tool plugins, the edit operations and
// hit tests, the hold wheels, the measurement solver that turns a rough sketch plus half the sizes into millimetres,
// and the package the Planner imports. No Android here, so `gradlew :sketch-core:test` runs on any JDK.
plugins {
    id("org.jetbrains.kotlin.jvm")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}
kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

dependencies {
    // Android ships org.json in the framework (the kit-core rule).
    compileOnly("org.json:json:20240303")
    testImplementation("org.json:json:20240303")
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
    // SketchExportTest writes the package it builds here, for the Planner's import test (spec-112).
    systemProperty("vrg.sketch.out", layout.buildDirectory.dir("sketch-fixture").get().asFile.path)
}
