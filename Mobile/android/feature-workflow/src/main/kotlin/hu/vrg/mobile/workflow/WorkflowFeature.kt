package hu.vrg.mobile.workflow

import android.app.Application
import android.content.Context
import android.view.WindowManager
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.VrgRepo
import hu.vrg.mobile.core.WkJob
import hu.vrg.mobile.core.WkPack
import hu.vrg.mobile.core.WkSealed
import hu.vrg.mobile.core.Workflow
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.Trust
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.github.Gh
import hu.vrg.mobile.kit.github.GitHub
import hu.vrg.mobile.kit.github.problem
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.Instant
import java.util.Base64

// Varler Workflow Kit (WP M42, D-50 = C). The Kit and its jobs stay on the PC (client data, never in Git in clear).
// The PC packs each job's state, figures and texts and seals the pack to this phone's device key
// (`node tools/workflow-seal.js seal`); the sealed file comes from the `workflow-sealed` branch and is kept as it came.
// It is opened in memory while this screen is shown, never written in clear, and the screen is FLAG_SECURE.
//
// One-time setup, from this screen: Kulcs közzététele writes keys/<ID>.json (the public key only) to the branch
// (creating the branch, orphan, on first use); the Founder then confirms the 6-character code on the PC with
// `workflow-seal.js trust <ID> <CODE>`. The PC never seals to a key it was not told to trust.

object WorkflowFeature : VrgFeature {
    override val info = Catalogue.WORKFLOW
    private const val TAG = "workflow"
    private lateinit var ctx: Context

    override fun init(app: Application) { ctx = app.applicationContext }

    private fun prefs() = ctx.getSharedPreferences("workflow", Context.MODE_PRIVATE)
    private fun sealedFile() = File(ctx.filesDir, "workflow/sealed.json")
    private val pubLine: String get() = Trust.publicKey().let { "${it.x}.${it.y}" }
    private val published: Boolean get() = prefs().getString("published", null) == pubLine

    private val branchRef = "${VrgRepo.PATH}/git/ref/heads/${Workflow.BRANCH}"

    @Composable
    override fun Screen(host: FeatureHost) {
        val scope = rememberCoroutineScope()
        val clipboard = LocalClipboardManager.current
        var note by remember { mutableStateOf<String?>(null) }
        var busy by remember { mutableStateOf(false) }
        var isPublished by remember { mutableStateOf(published) }
        var sealed by remember { mutableStateOf(WkSealed.parse(sealedFile().takeIf { it.isFile }?.readText())) }
        // the opened pack lives only in this screen's state: leaving the screen drops it
        var pack by remember { mutableStateOf<WkPack?>(null) }
        var job by remember { mutableStateOf<WkJob?>(null) }
        var doc by remember { mutableStateOf<String?>(null) }
        val key = remember { Workflow.keyFile(Trust.id, Trust.name, Trust.publicKey(), "") }

        DisposableEffect(Unit) {
            host.activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
            onDispose { host.activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE) }
        }
        LaunchedEffect(sealed) {
            val s = sealed ?: run { pack = null; return@LaunchedEffect }
            pack = withContext(Dispatchers.Default) {
                try { Workflow.parsePack(Trust.withDeviceKey { Workflow.open(s, Trust.id, it) }) }
                catch (e: Exception) { note = "A csomag nem nyílik meg ezen a telefonon: ${e.message ?: "hibás vagy más kulcsra készült."}"; null }
            }
            if (pack == null && note == null) note = "A csomag formátuma ismeretlen."
        }
        BackHandler(job != null) { if (doc != null) doc = null else job = null }

        fun refresh() = scope.launch {
            busy = true
            val (s, problem) = fetch()
            busy = false
            if (s != null) { sealed = s; note = "Letöltve: ${s.jobs} munka, ${s.made.take(16).replace('T', ' ')}." } else note = problem
        }

        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
            Row {
                Text("‹ " + if (job != null) "Munkák" else "Vissza", style = Melyviz.label.copy(color = Melyviz.current),
                    modifier = Modifier.clickable { if (doc != null) doc = null else if (job != null) job = null else host.home() }.padding(vertical = 8.dp))
                Spacer(Modifier.weight(1f))
                if (job == null) Text(if (busy) "…" else "⟳", style = Melyviz.title.copy(color = Melyviz.current),
                    modifier = Modifier.clickable(enabled = !busy) { refresh() }.padding(8.dp))
            }
            Text("WORKFLOW KIT", style = Melyviz.title.copy(fontSize = 18.sp))
            note?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 6.dp)) }

            val j = job
            if (j != null) { JobView(j, doc, onDoc = { doc = it }); Spacer(Modifier.height(24.dp)); return@Column }

            val p = pack
            if (p != null) {
                Text("${p.jobs.size} munka · készült ${p.made.take(16).replace('T', ' ')} · ${p.from}", style = Melyviz.readout, modifier = Modifier.padding(top = 4.dp))
                if (p.jobs.isEmpty()) Text("A csomagban nincs munka.", style = Melyviz.small)
                p.jobs.forEach { jb -> JobCard(jb) { job = jb } }
            } else if (sealed == null) {
                Text("Még nincs csomag ezen a telefonon.", style = Melyviz.label, modifier = Modifier.padding(top = 10.dp))
            }

            // ---- this phone and the PC side
            VrgSectionTitle("Ez a telefon")
            Text("Azonosító: ${key.id}", style = Melyviz.readout)
            Text(key.code, style = Melyviz.title.copy(fontSize = 28.sp, letterSpacing = 4.sp, color = Melyviz.glow, fontFamily = Melyviz.mono, fontWeight = FontWeight.Bold))
            Text(if (isPublished) "A kulcs közzétéve a ${Workflow.BRANCH} ágon. A PC-n egyszer erősítsd meg ezt a kódot, aztán készíts csomagot:"
                else "Először tedd közzé a telefon nyilvános kulcsát (csak a nyilvános felét). Utána a PC-n erősítsd meg ezt a kódot:",
                style = Melyviz.small)
            val cmd = "node tools/workflow-seal.js trust ${key.id} ${key.code}"
            Text(cmd, style = Melyviz.readout.copy(fontSize = 11.sp), modifier = Modifier.padding(vertical = 4.dp))
            Text("majd: node tools/workflow-seal.js seal", style = Melyviz.readout.copy(fontSize = 11.sp))
            Row(Modifier.padding(vertical = 6.dp)) {
                VrgChip(if (busy) "Írás…" else if (isPublished) "Kulcs újra" else "Kulcs közzététele", !isPublished) {
                    if (busy) return@VrgChip
                    scope.launch {
                        busy = true
                        val problem = publish()
                        busy = false
                        isPublished = published
                        note = problem ?: "Kulcs közzétéve. A PC-n: trust, aztán seal; utána ⟳."
                    }
                }
                Spacer(Modifier.width(6.dp))
                VrgChip("Parancs másolása") { clipboard.setText(AnnotatedString(cmd)); note = "Másolva." }
            }
            Row(Modifier.padding(vertical = 2.dp)) {
                VrgChip("PC ablakok ›") { host.open("pcwin") }
                Spacer(Modifier.width(6.dp))
                if (sealed != null) VrgChip("Törlés a telefonról") {
                    sealedFile().delete(); sealed = null; pack = null; note = "A csomag törölve erről a telefonról."
                }
            }
            Text("A PDF-ek nincsenek a csomagban: a PC ablakokban olvashatók (◣ menü → Workflow Kit), párosított PC-vel.",
                style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 4.dp))
            Spacer(Modifier.height(24.dp))
        }
    }

    @Composable
    private fun JobCard(j: WkJob, onClick: () -> Unit) {
        Column(Modifier.fillMaxWidth().padding(vertical = 4.dp).clip(RoundedCornerShape(Melyviz.radiusSmall)).background(Melyviz.surface)
            .clickable(onClick = onClick).padding(12.dp)) {
            Text("${j.code} · ${j.title}", style = Melyviz.label)
            Text(j.stage + (j.updated.takeIf { it.isNotBlank() }?.let { " · ${it.take(10)}" } ?: ""), style = Melyviz.small.copy(color = Melyviz.kelp))
            j.variants.forEach { v -> v.total?.let { Text("${v.key}: ${Workflow.ft(it)}", style = Melyviz.readout) } }
        }
    }

    @Composable
    private fun JobView(j: WkJob, doc: String?, onDoc: (String?) -> Unit) {
        val d = doc?.let { n -> j.docs.firstOrNull { it.name == n } }
        if (d != null) {
            Text(d.name, style = Melyviz.label, modifier = Modifier.padding(top = 8.dp))
            Text(d.text, style = Melyviz.small.copy(color = Melyviz.ink), modifier = Modifier.padding(top = 6.dp))
            return
        }
        Text("${j.code} · ${j.title}", style = Melyviz.title, modifier = Modifier.padding(top = 6.dp))
        j.address?.let { Text(it, style = Melyviz.small) }
        Text("frissítve ${j.updated.take(16).replace('T', ' ')}", style = Melyviz.readout)

        VrgSectionTitle("Lépések")
        Workflow.STEPS.forEach { (id, name) ->
            val done = id in j.steps
            Text((if (done) "✓ " else "· ") + name, style = Melyviz.label.copy(color = if (done) Melyviz.kelp else Melyviz.faint))
        }

        if (j.variants.isNotEmpty()) {
            VrgSectionTitle("Változatok")
            j.variants.forEach { v ->
                Column(Modifier.fillMaxWidth().padding(vertical = 3.dp).clip(RoundedCornerShape(Melyviz.radiusSmall)).background(Melyviz.surface).padding(10.dp)) {
                    Text("${v.key}" + (v.total?.let { ": ${Workflow.ft(it)}" } ?: ""), style = Melyviz.label.copy(color = Melyviz.glow))
                    v.labour?.let { Text("munkadíj ${Workflow.ft(it)}", style = Melyviz.readout) }
                    v.material?.let { Text("anyag ${Workflow.ft(it)}", style = Melyviz.readout) }
                    Workflow.effort(v).takeIf { it.isNotBlank() }?.let { Text(it, style = Melyviz.readout) }
                }
            }
            Text("Az összegek az offer.json-ból, ahogy a PC-n állnak; a dokumentum az irányadó.", style = Melyviz.small.copy(color = Melyviz.faint))
        }

        if (j.docs.isNotEmpty()) {
            VrgSectionTitle("Szövegek")
            j.docs.forEach { x -> Text("▸ " + x.name, style = Melyviz.label.copy(color = Melyviz.current), modifier = Modifier.clickable { onDoc(x.name) }.padding(vertical = 4.dp)) }
        }
        if (j.files.isNotEmpty()) {
            VrgSectionTitle("Fájlok a PC-n (${j.files.size})")
            j.files.take(80).forEach { f -> Text("${f.name} · ${size(f.size)}", style = Melyviz.readout.copy(fontSize = 10.sp)) }
        }
    }

    private fun size(b: Long): String = when {
        b >= 1_048_576 -> "%.1f MB".format(b / 1_048_576.0)
        b >= 1024 -> "${b / 1024} KB"
        else -> "$b B"
    }

    // ---- GitHub -----------------------------------------------------------------------------------------------------

    /** Downloads sealed/<ID>.json from the branch and keeps it as it came (it opens only with this phone's key). */
    private suspend fun fetch(): Pair<WkSealed?, String?> = withContext(Dispatchers.IO) {
        val r = GitHub.get("${VrgRepo.PATH}/contents/${Workflow.sealedPath(Trust.id)}?ref=${Workflow.BRANCH}")
        if (r is Gh.Failed && r.code == 404) return@withContext fail(if (published) "Még nincs csomag ennek a telefonnak. A PC-n: trust, aztán seal." else "Még nincs csomag. Először: Kulcs közzététele.")
        if (r !is Gh.Ok) return@withContext fail(r.problem())
        val o = JSONObject(r.value)
        var b64 = o.optString("content")
        if (b64.isBlank()) {                       // over 1 MB the contents API leaves it out: read the blob
            val blob = GitHub.get("${VrgRepo.PATH}/git/blobs/${o.optString("sha")}")
            if (blob !is Gh.Ok) return@withContext fail(blob.problem())
            b64 = JSONObject(blob.value).optString("content")
        }
        val text = String(Base64.getMimeDecoder().decode(b64), Charsets.UTF_8)
        val s = WkSealed.parse(text) ?: return@withContext fail("A letöltött csomag hibás.")
        sealedFile().parentFile?.mkdirs()
        sealedFile().writeText(text)
        VrgLog.i(TAG, "Csomag letöltve: ${s.jobs} munka")
        Pair<WkSealed?, String?>(s, null)
    }

    private fun fail(why: String?) = Pair<WkSealed?, String?>(null, why)

    /** Writes keys/<ID>.json (public key only) to the branch; creates the branch (orphan) the first time. */
    private suspend fun publish(): String? = withContext(Dispatchers.IO) {
        if (!GitHub.canWrite) return@withContext "Ehhez GitHub belépés kell, írási joggal (GitHub fiók)."
        val k = Workflow.keyFile(Trust.id, Trust.name, Trust.publicKey(), Instant.now().toString())
        val body = k.toJson().toString(2) + "\n"
        val path = Workflow.keyPath(k.id)
        val ref = GitHub.get(branchRef)
        val problem = when {
            ref is Gh.Failed && ref.code == 404 -> createBranch(path, body)
            ref !is Gh.Ok -> ref.problem()
            else -> {
                val cur = GitHub.get("${VrgRepo.PATH}/contents/$path?ref=${Workflow.BRANCH}")
                val sha = (cur as? Gh.Ok)?.let { JSONObject(it.value).optString("sha") }
                if (cur !is Gh.Ok && !(cur is Gh.Failed && cur.code == 404)) cur.problem()
                else {
                    val put = JSONObject().put("message", "workflow-sealed: key of ${k.id} (WP M42)").put("branch", Workflow.BRANCH)
                        .put("content", Base64.getEncoder().encodeToString(body.toByteArray(Charsets.UTF_8)))
                        .apply { if (!sha.isNullOrBlank()) put("sha", sha) }
                    GitHub.send("PUT", "${VrgRepo.PATH}/contents/$path", put.toString()).problem()
                }
            }
        }
        if (problem == null) { prefs().edit().putString("published", pubLine).apply(); VrgLog.i(TAG, "Kulcs közzétéve") }
        problem
    }

    private suspend fun createBranch(keyPath: String, keyBody: String): String? {
        val readme = "# workflow-sealed\n\nVRG Mobile WP M42. Sealed Varler Workflow Kit packs (sealed/<ID>.json) and the phones' public keys " +
            "(keys/<ID>.json). Nothing here is readable without a phone's device key. Written by the phone (keys) and by " +
            "`node tools/workflow-seal.js seal` on the PC (sealed). Never merge this branch.\n"
        val tree = JSONObject().put("tree", JSONArray()
            .put(JSONObject().put("path", "README.md").put("mode", "100644").put("type", "blob").put("content", readme))
            .put(JSONObject().put("path", keyPath).put("mode", "100644").put("type", "blob").put("content", keyBody)))
        val t = GitHub.send("POST", "${VrgRepo.PATH}/git/trees", tree.toString())
        if (t !is Gh.Ok) return t.problem()
        val c = GitHub.send("POST", "${VrgRepo.PATH}/git/commits", JSONObject().put("message", "workflow-sealed: the branch, and the first key (WP M42)")
            .put("tree", JSONObject(t.value).getString("sha")).put("parents", JSONArray()).toString())
        if (c !is Gh.Ok) return c.problem()
        val r = GitHub.send("POST", "${VrgRepo.PATH}/git/refs", JSONObject().put("ref", "refs/heads/${Workflow.BRANCH}")
            .put("sha", JSONObject(c.value).getString("sha")).toString())
        return r.problem()
    }
}
