package hu.vrg.mobile.sketch.ui

import android.content.Context
import hu.vrg.mobile.core.GitHubUrls
import hu.vrg.mobile.core.VrgRepo
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.github.GitHub
import hu.vrg.mobile.kit.github.Gh
import hu.vrg.mobile.sketch.FieldKit
import hu.vrg.mobile.sketch.Kit
import hu.vrg.mobile.sketch.Sketch
import hu.vrg.mobile.sketch.Variant
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.io.File

// The VRG Sketcher field kit on the phone (WP M26, M31). The catalog and the variants are the repo's Sketcher/ files,
// bundled into the APK at build time (feature-sketch/build.gradle.kts, assets sketcher/...). Variants an agent made
// after the release (GO VARIANT) come from GitHub main into files/sketch/variants/, and win over a bundled one with
// the same id. Nothing here needs the network to work: without it the bundled kit is complete.
object SketcherKit {
    private const val RAW = "application/vnd.github.raw"
    private const val DIR = "Sketcher/variants"

    @Volatile private var base: Kit = Kit()
    private val _variants = MutableStateFlow<List<Variant>>(emptyList())
    val variants: StateFlow<List<Variant>> = _variants
    @Volatile private var loaded = false

    private fun dir(ctx: Context) = File(ctx.filesDir, "sketch/variants")

    fun init(ctx: Context) {
        if (loaded) return
        loaded = true
        base = try { FieldKit.parse(ctx.assets.open("sketcher/fieldkit.json").bufferedReader().readText()) }
               catch (e: Exception) { VrgLog.w("sketch", "A field kit nem olvasható: ${e.message}"); Kit() }
        reload(ctx)
    }

    private fun reload(ctx: Context) {
        val bundled = (ctx.assets.list("sketcher/variants") ?: emptyArray()).filter { it.endsWith(".json") }.mapNotNull { n ->
            try { FieldKit.parseVariant(ctx.assets.open("sketcher/variants/$n").bufferedReader().readText()) } catch (e: Exception) { null }
        }
        val fetched = (dir(ctx).listFiles { f -> f.name.endsWith(".json") } ?: emptyArray()).mapNotNull { f ->
            try { FieldKit.parseVariant(f.readText()) } catch (e: Exception) { null }
        }
        _variants.value = (bundled.filter { b -> fetched.none { it.id == b.id } } + fetched).sortedBy { it.name }
    }

    val kit: Kit get() = base
    fun variant(id: String?): Variant? = _variants.value.firstOrNull { it.id == id }

    /** The kit a survey works with: the variant's additions when it is switched on. */
    fun forSketch(s: Sketch): Kit = if (s.variantOn) base.with(variant(s.variant)) else base

    /** Fetches the variants on main (the contents API, the shared M3 token). Returns what to tell the user. */
    suspend fun refresh(ctx: Context): String = withContext(Dispatchers.IO) {
        if (!GitHub.signedIn) return@withContext "A frissítéshez GitHub belépés kell (GitHub fiók)."
        val list = when (val r = GitHub.get("${VrgRepo.PATH}/contents/$DIR?ref=main")) {
            is Gh.Ok -> r.value
            is Gh.Offline -> return@withContext "Nincs internet: a telefonon lévő variánsok maradnak."
            is Gh.Failed -> return@withContext if (r.code == 404) "A main ágon még nincs Sketcher/variants." else "GitHub: ${r.message}"
            else -> return@withContext "GitHub most nem elérhető."
        }
        val names = try {
            val a = JSONArray(list)
            (0 until a.length()).mapNotNull { a.optJSONObject(it)?.optString("name") }.filter { it.endsWith(".json") && Regex("[a-z0-9-]+\\.json").matches(it) }
        } catch (e: Exception) { return@withContext "A variánsok listája nem olvasható." }
        val d = dir(ctx).apply { mkdirs() }
        var n = 0
        for (name in names) {
            val part = File(d, "$name.part")
            val got = GitHub.download(GitHubUrls.API + "${VrgRepo.PATH}/contents/$DIR/$name?ref=main", part, RAW)
            if (got !is Gh.Ok) { part.delete(); continue }
            // only a file that parses as a variant replaces the old one
            val ok = try { FieldKit.parseVariant(part.readText()); true } catch (e: Exception) { false }
            if (ok) { part.renameTo(File(d, name)); n++ } else part.delete()
        }
        reload(ctx)
        "$n variáns a main ágról; összesen ${_variants.value.size}."
    }
}
