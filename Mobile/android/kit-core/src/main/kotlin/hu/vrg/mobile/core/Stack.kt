package hu.vrg.mobile.core

import org.json.JSONObject

// Rétegverem / VRG Stack on the phone (WP M17): the rules of the phone's side. The stack is built on the PC
// (H:\VRG\Full\Planner_VRG_U100\Stack); Mobile/stack/publish-stack.js bundles its three 3D pages into self-contained HTML
// files and puts them on the `stack-pages` branch as stack/{konnektom.html, holo.html, retegek.html, meta.json}. The phone reads
// meta.json and downloads a page only when the published copy differs from the one it has.

object StackPages {
    const val BRANCH = "stack-pages"
    const val DIR = "stack"
    const val META = "meta.json"

    /** The three pages, in the order of the chips. Ids are stable: settings and deep links use them. */
    val PAGES = listOf(
        StackPage("konnektom", "Konnektóm", "konnektom.html"),
        StackPage("holo", "Holo", "holo.html"),
        StackPage("retegek", "Rétegek", "retegek.html"),
    )

    fun page(id: String?): StackPage = PAGES.firstOrNull { it.id == id } ?: PAGES.first()
    fun byFile(file: String?): StackPage? = PAGES.firstOrNull { it.file == file }

    /** The contents API path of one file on stack-pages. */
    fun contents(repoPath: String, file: String) = "$repoPath/contents/$DIR/$file?ref=$BRANCH"
}

data class StackPage(val id: String, val title: String, val file: String)

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

    companion object {
        const val KIND = "vrg-stack-meta"

        fun parse(json: String): StackMeta? = try {
            val o = JSONObject(json)
            if (o.optString("kind") != KIND) null
            else {
                val fo = o.optJSONObject("files") ?: JSONObject()
                val files = fo.keys().asSequence().associateWith { fo.optLong(it) }
                StackMeta(o.optString("generated"), o.optString("published"), o.optInt("nodes"), o.optInt("points"), o.optInt("lines"), files)
                    .takeIf { it.published.isNotEmpty() && StackPages.PAGES.all { p -> (files[p.file] ?: 0L) > 0L } }
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
                StackPages.PAGES.all { have[it.file] == remote.bytes(it) } -> Fresh
            else -> Download(remote)
        }
    }
}
