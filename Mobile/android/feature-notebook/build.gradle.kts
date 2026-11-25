// VRG Füzet (WP M69) as a VRG Mobile feature module: the screens over notebook-core (pure Kotlin, tested on the JVM).
// The bundled kits are Mobile/notebook/kits, copied into the APK's assets (notebook/kits/...) at build time, the same
// way feature-sketch bundles the Sketcher's catalog: one source for the phone and for an agent writing a new kit.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.notebook.ui"
    compileSdk = 35
    defaultConfig { minSdk = 28 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
}

abstract class NotebookKits : DefaultTask() {
    @get:InputDirectory abstract val kits: DirectoryProperty
    @get:OutputDirectory abstract val out: DirectoryProperty

    @TaskAction fun copy() {
        val o = out.get().asFile
        o.deleteRecursively()
        val d = File(o, "notebook/kits").apply { mkdirs() }
        kits.get().asFile.listFiles { f -> f.name.endsWith(".json") }?.forEach { it.copyTo(File(d, it.name), true) }
    }
}

val notebookKits = tasks.register<NotebookKits>("notebookKits") {
    kits.set(rootProject.file("../notebook/kits"))
    out.set(layout.buildDirectory.dir("generated/notebook-assets"))
}
androidComponents {
    onVariants { v -> v.sources.assets?.addGeneratedSourceDirectory(notebookKits, NotebookKits::out) }
}

dependencies {
    implementation(project(":kit"))
    implementation(project(":notebook-core"))
}
