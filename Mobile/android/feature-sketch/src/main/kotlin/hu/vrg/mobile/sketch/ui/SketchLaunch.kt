package hu.vrg.mobile.sketch.ui

import android.widget.Toast
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import hu.vrg.mobile.kit.ui.RcoItem
import hu.vrg.mobile.sketch.Variant
import kotlinx.coroutines.launch

// F4 (WP M49): the variants on the RCO (long press) of the original Sketcher. The Founder: "these variants appear under
// the options (or RCO) of the original version". The home tile and the Asztal dock's Sketcher dial (app module) put
// these lines under their own Megnyitás; the editor's corner toggle has the same list for the open survey.
//
// From outside the Sketcher a variant line starts a NEW survey in that variant (D-70): the long press is the "I am
// starting this kind of job" gesture; switching the survey already open is the corner toggle's job.
object SketchLaunch {
    sealed class Req {
        /** A new survey, in [variant] (null = the original). */
        data class New(val variant: String?) : Req()
        /** The Új variáns kérése dialog, without a survey. */
        object Request : Req()
    }

    /** What the Sketcher does the next time its screen shows; read and cleared by SketchFeature. */
    var pending by mutableStateOf<Req?>(null)
}

/**
 * The Sketcher's variant lines for an RCO menu outside the Sketcher: each variant (a new survey in it), the original,
 * ⟳ refresh from main, ＋ a new variant request. [open] opens the Sketcher; [say] shows a short result.
 */
@Composable
fun sketcherRcoItems(open: () -> Unit, say: ((String) -> Unit)? = null): List<RcoItem> {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val all by SketcherKit.variants.collectAsState()
    val tell: (String) -> Unit = say ?: { Toast.makeText(ctx, it, Toast.LENGTH_SHORT).show() }
    return all.map { v -> RcoItem(v.sym, "Új felmérés: " + v.name) { SketchLaunch.pending = SketchLaunch.Req.New(v.id); open() } } +
        listOf(
            RcoItem("◐", "Új felmérés: eredeti") { SketchLaunch.pending = SketchLaunch.Req.New(null); open() },
            RcoItem("⟳", "Variánsok frissítése") { tell("Frissítés…"); scope.launch { tell(SketcherKit.refresh(ctx)) } },
            RcoItem("＋", "Új variáns kérése") { SketchLaunch.pending = SketchLaunch.Req.Request; open() },
        )
}

/** The same lines for the open survey (the editor's corner toggle): a variant switches this survey to it. */
@Composable
internal fun editorVariantItems(st: EditorState, all: List<Variant>, say: (String) -> Unit): List<RcoItem> {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val on = if (st.sketch.variantOn) st.sketch.variant else null
    return all.map { v -> RcoItem(if (v.id == on) "◉" else v.sym, v.name, enabled = v.id != on) { st.chooseVariant(v) } } +
        listOf(
            RcoItem(if (on == null) "◉" else "◐", "Eredeti Sketcher", enabled = on != null) { st.chooseVariant(null) },
            RcoItem("⟳", "Variánsok frissítése") { say("Frissítés…"); scope.launch { say(SketcherKit.refresh(ctx)) } },
            RcoItem("＋", "Új variáns kérése") { st.ask = Ask.VariantRequest },
        )
}

/** Runs a pending launch inside the Sketcher's screen: a new survey (in a variant), or the request dialog. */
@Composable
internal fun SketchLaunchHost(host: hu.vrg.mobile.kit.FeatureHost, open: (String) -> Unit) {
    val p = SketchLaunch.pending
    var asking by androidx.compose.runtime.remember { mutableStateOf(false) }
    androidx.compose.runtime.LaunchedEffect(p) {
        when (p) {
            is SketchLaunch.Req.New -> {
                SketchLaunch.pending = null
                val store = SketchFeature.store
                val s0 = store.create("Felmérés " + stamp(System.currentTimeMillis()))
                val v = SketcherKit.variant(p.variant)
                if (v != null) store.save(hu.vrg.mobile.sketch.VariantOps.activate(s0, v))
                open(s0.id)
            }
            SketchLaunch.Req.Request -> { SketchLaunch.pending = null; asking = true }
            null -> {}
        }
    }
    if (asking) {
        // no survey yet: the request carries the premise and the toggles only (its counts are all zero)
        val st = androidx.compose.runtime.remember { EditorState(hu.vrg.mobile.sketch.Sketch(id = "variant-request"), {}) }
        VariantRequestDialog(st, inlineNote = true) { asking = false; st.note?.let(host::note) }
    }
}
