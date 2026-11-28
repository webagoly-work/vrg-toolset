package hu.vrg.mobile.core

import org.json.JSONObject

// Rétegverem / VRG Stack on the phone (WP M17): the rules of the phone's side. The stack is built on the PC
// (H:\VRG\Full\Planner_VRG_U100\Stack); Mobile/stack/publish-stack.js bundles its 3D pages into self-contained HTML
// files and puts them on the `stack-pages` branch as stack/{konnektom.html, holo.html, retegek.html, meta.json} and the
// optional kisokos.html, otletfolyam.html, dontesnaplo.html, vonalak.html, vezerloterem.html, futasnaplo.html,
// commitok.html, erintesnyom.html, labor.html. The phone reads meta.json and downloads a page
// only when the published copy differs from the one it has. An optional page's chip appears once a publish carries it; a
// publish without it (an older one) is still whole.

object StackPages {
    const val BRANCH = "stack-pages"
    const val DIR = "stack"
    const val META = "meta.json"

    /** Every page, in the order of the chips. Ids are stable: settings and deep links (vrg://stack/<id>) use them.
     *  The first three are in every publish; the others are optional, so a publish made before them still loads and a
     *  page whose data was missing on the PC is simply not offered. */
    val PAGES = listOf(
        StackPage("konnektom", "Konnektóm", "konnektom.html"),
        StackPage("holo", "Holo", "holo.html"),
        StackPage("retegek", "Rétegek", "retegek.html"),
        StackPage("kisokos", "Kisokos", "kisokos.html", optional = true),   // the K layer: VRG Kisokos 3D (Stack/kisokos.html)
        StackPage("otletfolyam", "Ötletfolyam", "otletfolyam.html", optional = true),   // layer I (Stack/lineage.html)
        StackPage("dontesnaplo", "Döntésnapló", "dontesnaplo.html", optional = true),   // layer Q (Stack/decisions.html)
        StackPage("vonalak", "Vonaltérkép", "vonalak.html", optional = true),   // layer L (Stack/metro.html)
        StackPage("vezerloterem", "Vezérlőterem", "vezerloterem.html", optional = true),   // layer A (Stack/control.html)
        StackPage("futasnaplo", "Futásnapló", "futasnaplo.html", optional = true),   // layer U (Stack/runs.html)
        StackPage("commitok", "Commit-pixel", "commitok.html", optional = true),   // layer R (Stack/commits.html)
        // Érintésnyom (SL4, 2026-11-25): the layers lit by recorded sessions, replay only on the phone (VIS-Q9)
        StackPage("erintesnyom", "Érintésnyom", "erintesnyom.html", optional = true),
        StackPage("labor", "Labor", "labor.html", optional = true),   // the Konnektóm-labor (Archive/files/konnektom-labor.html)
    )

    /** The pages every publish has. */
    val REQUIRED: List<StackPage> get() = PAGES.filterNot { it.optional }

    fun page(id: String?): StackPage = PAGES.firstOrNull { it.id == id } ?: PAGES.first()
    fun byFile(file: String?): StackPage? = PAGES.firstOrNull { it.file == file }

    /** The contents API path of one file on stack-pages. */
    fun contents(repoPath: String, file: String) = "$repoPath/contents/$DIR/$file?ref=$BRANCH"
}

/** [optional]: a publish may leave it out; the phone then shows the other pages and no chip for it. */
data class StackPage(val id: String, val title: String, val file: String, val optional: Boolean = false)

/** The ◢ dial on the phone's dock (VIS-Q5): every layer of the stack, top to bottom as the Desktop's ◢ lists them
 *  (F I Q L A U R C G K Z), each opening the one view of that layer, then Érintésnyom (the layers lit by recorded work)
 *  and Rétegek (all layers at once) as the last row. */
object StackMenu {
    sealed interface Target {
        /** A page of the Rétegverem feature (vrg://stack/<page>). */
        data class Page(val page: String) : Target
        /** Another feature on the phone. */
        data class Feature(val id: String) : Target
        /** No view on the phone; [why] says where it is. */
        data class None(val why: String) : Target
    }

    data class Row(val layer: String, val title: String, val target: Target)

    val ROWS = listOf(
        Row("F", "Kiemelt", Target.None("az Asztal Áttekintés nézete")),
        Row("I", "Ötletfolyam", Target.Page("otletfolyam")),
        Row("Q", "Döntésnapló", Target.Page("dontesnaplo")),
        Row("L", "Vonaltérkép", Target.Page("vonalak")),
        Row("A", "Vezérlőterem", Target.Page("vezerloterem")),
        Row("U", "Futásnapló", Target.Page("futasnaplo")),
        Row("R", "Commit-pixel", Target.Page("commitok")),
        Row("C", "Kódváros", Target.Feature(Catalogue.CITY.id)),
        Row("G", "Gömb", Target.Feature(Catalogue.SPHERE.id)),
        Row("K", "Kisokos", Target.Page("kisokos")),   // the work handbook (main's K layer, Kisokos 3D)
        Row("Z", "Kódex", Target.None("még nincs nézete")),
        Row("", "Érintésnyom", Target.Page("erintesnyom")),
        Row("", "Rétegek", Target.Page("retegek")),
    )

    /** A layer page that is not in the phone's copy yet: the row says so instead of opening an empty screen. */
    fun available(row: Row, meta: StackMeta?): Boolean = when (val t = row.target) {
        is Target.Page -> meta == null || meta.bytes(StackPages.page(t.page)) > 0L || !StackPages.page(t.page).optional
        is Target.Feature -> true
        is Target.None -> false
    }
}

/** stack/meta.json, as publish-stack.js writes it. */
data class StackMeta(
    /** When the connectome data was generated on the PC (ISO, UTC). */
    val generated: String,
    /** When it was published (ISO, UTC): a new publish is a new version, even with the same data. */
    val published: String,
    val nodes: Int,
    val points: Int,
    val lines: Int,
    /** file name -> bytes, for every page. */
    val files: Map<String, Long>,
) {
    fun toJson(): String {
        val f = JSONObject(); files.forEach { (k, v) -> f.put(k, v) }
        return JSONObject().put("kind", KIND).put("generated", generated).put("published", published)
            .put("nodes", nodes).put("points", points).put("lines", lines).put("files", f).toString()
    }

    /** "2026-11-07 13:54" from the data time (UTC, as written; the screen says so). */
    val generatedLabel: String get() = generated.take(16).replace('T', ' ')

    fun bytes(page: StackPage): Long = files[page.file] ?: 0L
    /** The pages this publish carries: every required one, and the optional ones it has. */
    val pages: List<StackPage> get() = StackPages.PAGES.filter { !it.optional || bytes(it) > 0L }

    /** [id] if this publish has that page, else its first page (a remembered Kisokos on an older publish). */
    fun page(id: String?): StackPage = pages.firstOrNull { it.id == id } ?: pages.first()

    companion object {
        const val KIND = "vrg-stack-meta"

        fun parse(json: String): StackMeta? = try {
            val o = JSONObject(json)
            if (o.optString("kind") != KIND) null
            else {
                val fo = o.optJSONObject("files") ?: JSONObject()
                val files = fo.keys().asSequence().associateWith { fo.optLong(it) }
                StackMeta(o.optString("generated"), o.optString("published"), o.optInt("nodes"), o.optInt("points"), o.optInt("lines"), files)
                    .takeIf { it.published.isNotEmpty() && StackPages.REQUIRED.all { p -> (files[p.file] ?: 0L) > 0L } }
            }
        } catch (e: Exception) { null }
    }
}

/** What to do after asking GitHub for stack/meta.json. */
sealed interface StackSync {
    /** The pages on the phone are that publish: show them. */
    data object Fresh : StackSync
    /** GitHub has another publish (or the phone has none): download the pages. */
    data class Download(val meta: StackMeta) : StackSync
    /** No answer from GitHub: show the phone's copy if there is one. */
    data object Offline : StackSync
    /** GitHub answered and there is nothing published yet. */
    data object Missing : StackSync

    companion object {
        /** [have]: file name -> bytes of the pages on the phone. */
        fun decide(local: StackMeta?, have: Map<String, Long>, remote: StackMeta?, answered: Boolean): StackSync = when {
            !answered -> Offline
            remote == null -> Missing
            local != null && local.published == remote.published &&
                remote.pages.all { have[it.file] == remote.bytes(it) } -> Fresh
            else -> Download(remote)
        }
    }
}
