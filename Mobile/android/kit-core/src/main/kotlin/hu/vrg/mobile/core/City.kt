package hu.vrg.mobile.core

import org.json.JSONArray
import org.json.JSONObject

// Kódváros online (WP M5, D-7 = A): the rules of the phone's side. GitHub Actions (.github/workflows/mobile-city.yml)
// scans every pushed branch with CodeCity/scan.js and Mobile/city/publish-city.js puts the city on the
// `city-pages` branch as city/<key>/{city.html, city.json, meta.json}. The phone lists city/, reads a branch's
// meta.json, and downloads city.html only when its commit differs from the copy it already has. What is shown
// is always the repo on GitHub, never a PC's working copy.
//
// The key encoding must stay the same as publish-city.js's: both are tested against
// Mobile/tests/fixtures/city-keys.json.

object CityPages {
    const val BRANCH = "city-pages"
    const val DIR = "city"
    const val HTML = "city.html"
    const val META = "meta.json"

    private fun plain(c: Char, first: Boolean) =
        c in 'A'..'Z' || c in 'a'..'z' || c in '0'..'9' || c == '_' || c == '-' || (c == '.' && !first)

    /** A branch name as one path segment: [A-Za-z0-9_-] and a non-leading '.' stay, every other UTF-8 byte is ~xx. */
    fun key(branch: String): String {
        require(branch.isNotEmpty()) { "empty branch name" }
        val out = StringBuilder()
        for (b in branch.toByteArray(Charsets.UTF_8)) {
            val v = b.toInt() and 0xff
            val c = v.toChar()
            if (v < 0x80 && plain(c, out.isEmpty())) out.append(c)
            else out.append('~').append("%02x".format(v))
        }
        return out.toString()
    }

    /** The branch a key stands for, or null when key() could not have written it. */
    fun branchOf(key: String): String? {
        if (key.isEmpty()) return null
        val bytes = java.io.ByteArrayOutputStream()
        var i = 0
        while (i < key.length) {
            val c = key[i]
            if (c == '~') {
                if (i + 3 > key.length) return null
                val h = key.substring(i + 1, i + 3)
                if (!h.all { it in '0'..'9' || it in 'a'..'f' }) return null
                val v = h.toInt(16)
                if (v < 0x80 && plain(v.toChar(), i == 0)) return null   // key() would have kept it as is
                bytes.write(v)
                i += 3
            } else {
                if (!plain(c, i == 0)) return null
                bytes.write(c.code)
                i++
            }
        }
        val raw = bytes.toByteArray()
        val s = String(raw, Charsets.UTF_8)
        return if (s.toByteArray(Charsets.UTF_8).contentEquals(raw)) s else null   // invalid UTF-8 does not round-trip
    }

    /** The contents API path of a branch's file on city-pages (keys are URL-safe as they are). */
    fun contents(repoPath: String, branch: String, file: String) = "$repoPath/contents/$DIR/${key(branch)}/$file?ref=$BRANCH"

    /** The listing of city/ itself. */
    fun listing(repoPath: String) = "$repoPath/contents/$DIR?ref=$BRANCH"

    /**
     * The branches that have a city, from the contents API's listing of city/: main first, then by name.
     * null when the answer is not a listing (city-pages missing gives a 404 before this).
     */
    fun branches(json: String): List<String>? = try {
        val a = JSONArray(json)
        (0 until a.length()).map { a.getJSONObject(it) }
            .filter { it.optString("type") == "dir" }
            .mapNotNull { branchOf(it.optString("name")) }
            .sortedWith(compareBy<String>({ it != "main" }, { it }))
    } catch (e: Exception) { null }
}

/** city/<key>/meta.json, as publish-city.js writes it. */
data class CityMeta(
    val branch: String,
    val key: String,
    val sha: String,
    val head: String,
    /** ISO time of the scan, as written. */
    val scannedAt: String,
    val commits: Int,
    val files: Int,
    val htmlBytes: Long,
    val run: String,
) {
    fun toJson(): String = JSONObject()
        .put("kind", KIND).put("version", 1).put("branch", branch).put("key", key).put("sha", sha).put("head", head)
        .put("scannedAt", scannedAt).put("commits", commits).put("files", files).put("htmlBytes", htmlBytes).put("run", run)
        .toString()

    /** "2026-11-06 15:04" from the ISO time (UTC, as written; the screen says so). */
    val scannedLabel: String get() = scannedAt.take(16).replace('T', ' ')

    companion object {
        const val KIND = "vrg-city-meta"

        fun parse(json: String): CityMeta? = try {
            val o = JSONObject(json)
            if (o.optString("kind") != KIND) null
            else CityMeta(
                o.getString("branch"), o.getString("key"), o.optString("sha"), o.optString("head"),
                o.optString("scannedAt"), o.optInt("commits"), o.optInt("files"), o.optLong("htmlBytes"), o.optString("run"),
            ).takeIf { it.branch.isNotEmpty() && CityPages.key(it.branch) == it.key }
        } catch (e: Exception) { null }
    }
}

/** What to do after asking GitHub for a branch's meta.json. */
sealed interface CitySync {
    /** The copy on the phone is that commit's city: show it, download nothing. */
    data object Fresh : CitySync
    /** GitHub has another city (or the phone has none): download city.html. */
    data class Download(val meta: CityMeta) : CitySync
    /** No answer from GitHub (offline, signed out): show the copy on the phone if there is one. */
    data object Offline : CitySync
    /** GitHub answered, and this branch has no city (yet): Actions has not published it. */
    data object Missing : CitySync

    companion object {
        /**
         * [remote] is the parsed meta.json when GitHub answered with one, [answered] whether GitHub answered at all
         * (a 404 is an answer). [haveHtml]: the page file exists on the phone.
         */
        fun decide(local: CityMeta?, haveHtml: Boolean, remote: CityMeta?, answered: Boolean): CitySync = when {
            !answered -> Offline
            remote == null -> Missing
            local != null && haveHtml && local.sha == remote.sha && local.htmlBytes == remote.htmlBytes -> Fresh
            else -> Download(remote)
        }
    }
}

/** Which downloaded cities the phone keeps: the shown one plus the most recently used, [keep] in all. */
object CityStore {
    const val KEEP = 4

    /** [used]: key -> last time shown (ms). Returns the keys to delete. */
    fun prune(used: Map<String, Long>, current: String?, keep: Int = KEEP): List<String> =
        used.entries.sortedByDescending { if (it.key == current) Long.MAX_VALUE else it.value }
            .drop(keep).map { it.key }
}
