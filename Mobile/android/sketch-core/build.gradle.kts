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
    // ...and checks it still equals the copy the Planner's test reads (VRG_SKETCH_FIXTURE=update rewrites that copy)
    val repo = rootProject.projectDir.resolve("../..").canonicalFile
    systemProperty("vrg.repo", repo.path)
    System.getenv("VRG_SKETCH_FIXTURE")?.let { systemProperty("vrg.sketch.fixture", it) }
    inputs.file(repo.resolve("Planner/projects/varler-planner/tests/sketch-field.json")).optional()
    // FieldKitTest replays the JS engine's fixture against the Kotlin engine, on the shared catalog and variants
    inputs.dir(repo.resolve("Sketcher/catalog"))
    inputs.dir(repo.resolve("Sketcher/variants"))
    inputs.dir(repo.resolve("Sketcher/test/fixtures"))
}
