package hu.vrg.mobile.core

import org.json.JSONArray
import org.json.JSONObject

// Archívum on the phone (WP M18): the rules of the phone's side. The archive is one folder in the repo, `Archive/`
// (VRG Desktop WP-46, decision DESKU-Q23): the viewer `vrg-archive.html`, its data `index.js` (generated from
// index.json by Archive/archive.js) and the saved copies `files/<id>.html`. The phone reads that folder straight
// from `main` through the contents API (D-13): no publish step and no second copy of the data. It lists `Archive/`
// and `Archive/files/`, compares each file's git blob sha with the copy it has, and downloads only what changed.

object ArchivePages {
    /** The branch the archive is read from: the folder lives on main, like Mobile/catalogue/tools.json (M4). */
    const val BRANCH = "main"
    /** The folder in the repo. */
    const val DIR = "Archive"
    /** The folder in filesDir and the first URL segment in the WebView. */
    const val LOCAL = "archive"
    const val PAGE = "vrg-archive.html"
    const val INDEX = "index.js"
    const val FILES = "files"
    const val MANIFEST = "manifest.json"

    /** The two files the viewer cannot work without, downloaded first. */
    val ROOT_FILES = listOf(PAGE, INDEX)

    private val SAFE = Regex("[A-Za-z0-9][A-Za-z0-9._-]*\\.html")

    /** The contents API listing of Archive/ ([sub] = "") or Archive/files/ ([sub] = FILES). */
    fun listing(repoPath: String, sub: String = "") =
        "$repoPath/contents/$DIR${if (sub.isEmpty()) "" else "/$sub"}?ref=$BRANCH"

    /** The contents API path of one file, [rel] relative to Archive/ (`index.js`, `files/x.html`). */
    fun contents(repoPath: String, rel: String) = "$repoPath/contents/$DIR/$rel?ref=$BRANCH"

    /**
     * Whether the phone keeps and serves [rel]: the viewer, its data and the saved pages, nothing else. archive.js,
     * index.json and anything a later change puts into the folder stay on GitHub.
     */
    fun keeps(rel: String): Boolean =
        rel in ROOT_FILES || (rel.startsWith("$FILES/") && SAFE.matches(rel.removePrefix("$FILES/")))

    fun mime(rel: String): String = if (rel.endsWith(".js")) "application/javascript" else "text/html"

    /** The file asked for by `https://appassets.androidplatform.net/archive/<rel>`, or null (then 403). */
    fun route(segments: List<String>): String? {
        if (segments.size < 2 || segments[0] != LOCAL) return null
        return segments.drop(1).joinToString("/").takeIf { keeps(it) }
    }
}

/** One file of the archive as GitHub lists it: the git blob sha says whether it changed. */
data class ArchiveEntry(val sha: String, val size: Long)

/** The archive's files (path relative to Archive/ → sha + size), the phone's copy or GitHub's listing. */
data class ArchiveManifest(val files: Map<String, ArchiveEntry>) {
    /** The saved pages (the files/ copies). */
    val pages: Int get() = files.keys.count { it.startsWith(ArchivePages.FILES + "/") }
    val bytes: Long get() = files.values.sumOf { it.size }
    /** The viewer and its data are both there: the archive can open. */
    val complete: Boolean get() = ArchivePages.ROOT_FILES.all { it in files }

    fun toJson(): String {
        val f = JSONObject()
        files.forEach { (k, v) -> f.put(k, JSONObject().put("sha", v.sha).put("size", v.size)) }
        return JSONObject().put("kind", KIND).put("files", f).toString()
    }

    companion object {
        const val KIND = "vrg-archive-manifest"

        fun parse(json: String): ArchiveManifest? = try {
            val o = JSONObject(json)
            if (o.optString("kind") != KIND) null
            else {
                val fo = o.optJSONObject("files") ?: JSONObject()
                ArchiveManifest(fo.keys().asSequence().filter { ArchivePages.keeps(it) }.associateWith {
                    val e = fo.getJSONObject(it); ArchiveEntry(e.optString("sha"), e.optLong("size"))
                })
            }
        } catch (e: Exception) { null }

        /**
         * From GitHub's two listings: [root] of Archive/, [files] of Archive/files/ (null when that folder is not
         * there). Only the files the phone keeps. Null when [root] is not a listing.
         */
        fun fromListings(root: String, files: String?): ArchiveManifest? {
            val a = entries(root, "") ?: return null
            val b = files?.let { entries(it, ArchivePages.FILES + "/") } ?: emptyMap()
            return ArchiveManifest(a + b)
        }

        private fun entries(json: String, prefix: String): Map<String, ArchiveEntry>? = try {
            val arr = JSONArray(json)
            (0 until arr.length()).map { arr.getJSONObject(it) }
                .filter { it.optString("type") == "file" }
                .map { (prefix + it.getString("name")) to ArchiveEntry(it.getString("sha"), it.optLong("size")) }
                .filter { ArchivePages.keeps(it.first) }
                .toMap()
        } catch (e: Exception) { null }
    }
}

/** What to do after listing the archive on GitHub. */
sealed interface ArchiveSync {
    /** The phone's copies are main's: show them. */
    data object Fresh : ArchiveSync
    /** Main differs: download [fetch] (relative paths, viewer first), delete [drop]; [remote] is the new state. */
    data class Download(val remote: ArchiveManifest, val fetch: List<String>, val drop: List<String>) : ArchiveSync {
        fun bytes(): Long = fetch.sumOf { remote.files[it]?.size ?: 0L }
    }
    /** No answer from GitHub: show the phone's copy if there is one. */
    data object Offline : ArchiveSync
    /** GitHub answered and main has no archive (yet). */
    data object Missing : ArchiveSync

    companion object {
        /** [have]: relative path → bytes of the files on the phone. */
        fun decide(local: ArchiveManifest?, have: Map<String, Long>, remote: ArchiveManifest?, answered: Boolean): ArchiveSync {
            if (!answered) return Offline
            if (remote == null || !remote.complete) return Missing
            val mine = local?.files ?: emptyMap()
            val fetch = remote.files.filter { (rel, e) -> mine[rel]?.sha != e.sha || have[rel] != e.size }.keys
                .sortedWith(compareBy<String> { if (it in ArchivePages.ROOT_FILES) 0 else 1 }.thenBy { it })
            val drop = (mine.keys + have.keys).filter { it !in remote.files }.distinct().sorted()
            return if (fetch.isEmpty() && drop.isEmpty()) Fresh else Download(remote, fetch, drop)
        }
    }
}

/** The WebView's rules for the archive: what may leave the phone, and the Back button. */
object ArchiveWeb {
    /**
     * The saved pages are published claude.ai artifacts, which may load fonts and libraries from these hosts
     * only (the artifact contract). A GET to one of them goes to the network; every other request off the
     * phone's own origin is refused. On 2026-11-11 the saved pages used Google Fonts and one cdnjs script.
     */
    val CDN = setOf("fonts.googleapis.com", "fonts.gstatic.com", "cdnjs.cloudflare.com", "cdn.jsdelivr.net", "unpkg.com")

    fun mayLoad(scheme: String?, host: String?, method: String?): Boolean =
        scheme == "https" && method.equals("GET", ignoreCase = true) && host in CDN

    /**
     * Back inside the page, run in the WebView. The viewer keeps its place in the hash with replaceState, so the
     * WebView's history cannot step back through it; this asks the page. It answers where Back went:
     * "viewer" (the saved page closed, the entry shows), "detail" (back to the list), or "list" / "none" (the app
     * leaves the archive). Uses only window.VRGArchive's public state() and select().
     */
    const val BACK_JS = "(function(){var a=window.VRGArchive;if(!a||!a.state)return 'none';var s=a.state();" +
        "if(s.open&&s.sel){location.hash='#'+encodeURIComponent(s.sel);return 'viewer'}" +
        "if(s.sel){a.select(null);return 'detail'}return 'list'})()"

    /** True when the page answered that Back is the app's: leave the archive. */
    fun leaves(answer: String?): Boolean = answer == null || answer.trim('"') in setOf("list", "none", "null", "")
}
