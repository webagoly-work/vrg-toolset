// Vázlat (WP M24) as a VRG Mobile feature module: the field sketch's canvas, tool rail, hold wheels, memos and tags,
// the Rendezés view and the export. Its logic is sketch-core (pure Kotlin, tested on the JVM); this is the screen.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.sketch.ui"
    compileSdk = 35
    defaultConfig { minSdk = 28 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
}

// The VRG Sketcher field kit and its variants come from the repo's Sketcher/ folder, the same files the Desktop page
// inlines (docs/sketcher/README.md section 4): one source, copied into the APK's assets (sketcher/...) at build time.
// Registered through AGP's generated-sources hook, so every task that reads assets (merge, lint) depends on it.
abstract class SketcherAssets : DefaultTask() {
    @get:InputDirectory abstract val catalog: DirectoryProperty
    @get:InputDirectory abstract val variants: DirectoryProperty
    @get:OutputDirectory abstract val out: DirectoryProperty

    @TaskAction fun copy() {
        val o = out.get().asFile
        o.deleteRecursively()
        File(o, "sketcher/variants").mkdirs()
        catalog.get().file("fieldkit.json").asFile.copyTo(File(o, "sketcher/fieldkit.json"), true)
        catalog.get().file("takeoff.json").asFile.copyTo(File(o, "sketcher/takeoff.json"), true)
        variants.get().asFile.listFiles { f -> f.name.endsWith(".json") }?.forEach { it.copyTo(File(o, "sketcher/variants/" + it.name), true) }
    }
}

val sketcherAssets = tasks.register<SketcherAssets>("sketcherAssets") {
    catalog.set(rootProject.file("../../Sketcher/catalog"))
    variants.set(rootProject.file("../../Sketcher/variants"))
    out.set(layout.buildDirectory.dir("generated/sketcher-assets"))
}
androidComponents {
    onVariants { v -> v.sources.assets?.addGeneratedSourceDirectory(sketcherAssets, SketcherAssets::out) }
}

dependencies {
    implementation(project(":kit"))
    implementation(project(":sketch-core"))
}
