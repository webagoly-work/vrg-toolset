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
// F9 (WP M54, D-121): the Felmérési jegyzőkönyv's renderer, the Desktop's own files from Sketcher/lib, into
// assets sketcher/report/. Sketcher/test/report-phone.test.js checks this list; the task checks every copy byte for byte.
val REPORT_ASSETS = listOf("fieldkit.js", "report.js", "report-phone.js")
// skcam K1b (WP M59): the Szobadoboz, the Desktop's own maths and renderer plus the phone's touch UI, into assets
// sketcher/roombox/. Sketcher/test/roombox-phone.test.js checks this list (and that RoomBoxUi.kt loads the same files).
val ROOMBOX_ASSETS = listOf("roombox.js", "roombox-gl.js", "roombox-phone.js")
// skcam K3 (WP M60): the Síkmérés, the Desktop's maths and screen, into assets sketcher/plane/ (checked by
// Sketcher/test/plane.test.js, with PlaneUi.kt).
val PLANE_ASSETS = listOf("plane.js", "plane-ui.js")

abstract class SketcherAssets : DefaultTask() {
    @get:InputDirectory abstract val catalog: DirectoryProperty
    @get:InputDirectory abstract val variants: DirectoryProperty
    @get:InputDirectory abstract val lib: DirectoryProperty
    @get:Input abstract val report: ListProperty<String>
    @get:Input abstract val roombox: ListProperty<String>
    @get:Input abstract val plane: ListProperty<String>
    @get:OutputDirectory abstract val out: DirectoryProperty

    @TaskAction fun copy() {
        val o = out.get().asFile
        o.deleteRecursively()
        File(o, "sketcher/variants").mkdirs()
        catalog.get().file("fieldkit.json").asFile.copyTo(File(o, "sketcher/fieldkit.json"), true)
        catalog.get().file("takeoff.json").asFile.copyTo(File(o, "sketcher/takeoff.json"), true)
        variants.get().asFile.listFiles { f -> f.name.endsWith(".json") }?.forEach { it.copyTo(File(o, "sketcher/variants/" + it.name), true) }
        File(o, "sketcher/report").mkdirs()
        report.get().forEach { n ->
            val src = lib.get().file(n).asFile
            val dst = src.copyTo(File(o, "sketcher/report/" + n), true)
            check(dst.readBytes().contentEquals(src.readBytes())) { "sketcher/report/" + n + " differs from Sketcher/lib/" + n }
        }
        File(o, "sketcher/roombox").mkdirs()
        roombox.get().forEach { n ->
            val src = lib.get().file(n).asFile
            val dst = src.copyTo(File(o, "sketcher/roombox/" + n), true)
            check(dst.readBytes().contentEquals(src.readBytes())) { "sketcher/roombox/" + n + " differs from Sketcher/lib/" + n }
        }
        File(o, "sketcher/plane").mkdirs()
        plane.get().forEach { n ->
            val src = lib.get().file(n).asFile
            val dst = src.copyTo(File(o, "sketcher/plane/" + n), true)
            check(dst.readBytes().contentEquals(src.readBytes())) { "sketcher/plane/" + n + " differs from Sketcher/lib/" + n }
        }
    }
}

val sketcherAssets = tasks.register<SketcherAssets>("sketcherAssets") {
    catalog.set(rootProject.file("../../Sketcher/catalog"))
    variants.set(rootProject.file("../../Sketcher/variants"))
    lib.set(rootProject.file("../../Sketcher/lib"))
    report.set(REPORT_ASSETS)
    roombox.set(ROOMBOX_ASSETS)
    plane.set(PLANE_ASSETS)
    out.set(layout.buildDirectory.dir("generated/sketcher-assets"))
}
androidComponents {
    onVariants { v -> v.sources.assets?.addGeneratedSourceDirectory(sketcherAssets, SketcherAssets::out) }
}

dependencies {
    implementation(project(":kit"))
    implementation(project(":sketch-core"))
    implementation(project(":sketch-vision"))   // Kamera 2: type-plate reading (TextReader)
    // Saját kamera (WP M52, D-100): CameraX, the same version feature-pair's QR scanner already puts in the APK
    val camerax = "1.4.1"
    implementation("androidx.camera:camera-camera2:$camerax")
    implementation("androidx.camera:camera-lifecycle:$camerax")
    implementation("androidx.camera:camera-view:$camerax")
}
