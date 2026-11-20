// VRG Jegyzetek (WP M46, formerly Gyorsjegyzet M6) as a VRG Mobile feature module: the central Notes app. The notes
// themselves live in kit's hub (kit/notes/Notes.kt) so any feature can write into it; this module draws the app and
// runs the sync to the `vrg-notes` branch (D-56 = B). The old M6 day log on `mobile-log` stays as the Projektnapló
// module, through the same outbox and WorkManager fallback.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "hu.vrg.mobile.notes"
    compileSdk = 35
    defaultConfig { minSdk = 28 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
}

// The notes kit (modules, versions, templates, origins) comes from the repo's Notes/catalog/, the one source the
// Desktop page will read too; copied into the APK's assets (notes/noteskit.json), where kit's Notes hub reads it.
abstract class NotesKitAssets : DefaultTask() {
    @get:InputDirectory abstract val catalog: DirectoryProperty
    @get:OutputDirectory abstract val out: DirectoryProperty

    @TaskAction fun copy() {
        val o = out.get().asFile
        o.deleteRecursively()
        File(o, "notes").mkdirs()
        catalog.get().file("noteskit.json").asFile.copyTo(File(o, "notes/noteskit.json"), true)
    }
}

val notesKitAssets = tasks.register<NotesKitAssets>("notesKitAssets") {
    catalog.set(rootProject.file("../../Notes/catalog"))
    out.set(layout.buildDirectory.dir("generated/notes-assets"))
}
androidComponents {
    onVariants { v -> v.sources.assets?.addGeneratedSourceDirectory(notesKitAssets, NotesKitAssets::out) }
}

dependencies {
    implementation(project(":kit"))
    implementation("androidx.work:work-runtime-ktx:2.10.0")
}
