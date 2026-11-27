// VRG Füzet (WP M70): the malleable notebook's pure Kotlin. Kits (applications as JSON), the one store of entries,
// the derived open items, search, views and the export / import merge. A fork of the VRG Sketcher's engine ideas
// (docs/sketcher/README.md, the six rules) without the survey. No Android here: `gradlew :notebook-core:test`.
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
    // KitTest validates every bundled kit in Mobile/notebook/kits, the folder the APK copies into its assets
    val repo = rootProject.projectDir.resolve("../..").canonicalFile
    systemProperty("vrg.repo", repo.path)
    inputs.dir(repo.resolve("Mobile/notebook/kits"))
}
