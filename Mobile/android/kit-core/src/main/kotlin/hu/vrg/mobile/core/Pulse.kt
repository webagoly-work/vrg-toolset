package hu.vrg.mobile.core

import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.time.Instant
import java.time.format.DateTimeParseException

// Haladás (WP M4, D-8 = A): where the work stands. main comes first, because every line of work lands
// there; a branch shows only while it holds unmerged, recent work. GitHub's answers and the rules on
// them are here so they are tested on the JVM; the calls are feature-pulse's.

object Pulse {
    const val MAIN = "main"
    const val TOOLS_FILE = "Mobile/catalogue/tools.json"
    const val RECENT_DAYS = 7L
    const val BRANCH_DAYS = 14L
    /** GitHub lists at most this many files in a comparison. */
    const val FILE_LIMIT = 300
    private const val DAY = 24L * 60 * 60

    fun since(nowSeconds: Long, days: Long): String = Instant.ofEpochSecond(nowSeconds - days * DAY).toString()

    /** D-8 = A: ahead of main, a commit in the last 14 days, and not the notes log, which is no work branch. */
    fun isActive(branch: String, ahead: Int, lastCommit: Long, nowSeconds: Long): Boolean =
        branch != MAIN && branch != NoteLog.BRANCH && ahead > 0 && nowSeconds - lastCommit <= BRANCH_DAYS * DAY

    private fun time(s: String): Long = try { Instant.parse(s).epochSecond } catch (e: DateTimeParseException) { 0 }

    fun branches(json: String): List<BranchRef> = try {
        val a = JSONArray(json)
        (0 until a.length()).map { a.getJSONObject(it) }.map { BranchRef(it.getString("name"), it.getJSONObject("commit").getString("sha")) }
    } catch (e: JSONException) { emptyList() }

    /** GET /commits/{sha}, or one entry of GET /commits. */
    fun commit(o: JSONObject): CommitLine? = try {
        val c = o.getJSONObject("commit")
        CommitLine(o.getString("sha"), c.getString("message").lineSequence().first(),
            time(c.getJSONObject("committer").getString("date")), o.optString("html_url"))
    } catch (e: JSONException) { null }

    fun commit(json: String): CommitLine? = try { commit(JSONObject(json)) } catch (e: JSONException) { null }

    fun commits(json: String): List<CommitLine> = try {
        val a = JSONArray(json)
        (0 until a.length()).mapNotNull { commit(a.getJSONObject(it)) }
    } catch (e: JSONException) { emptyList() }

    /** GET /pulls: head branch -> its open PR. */
    fun pulls(json: String): Map<String, OpenPull> = try {
        val a = JSONArray(json)
        (0 until a.length()).map { a.getJSONObject(it) }
            .associate { it.getJSONObject("head").getString("ref") to OpenPull(it.getInt("number"), it.optString("html_url")) }
    } catch (e: JSONException) { emptyMap() }
}

data class BranchRef(val name: String, val sha: String)
data class CommitLine(val sha: String, val message: String, val at: Long, val url: String)
data class OpenPull(val number: Int, val url: String)

/** GET /compare/{base}...{head}. A renamed file counts for its old place too. */
data class Comparison(val ahead: Int, val behind: Int, val files: List<String>, val capped: Boolean) {
    companion object {
        fun parse(json: String): Comparison? = try {
            val o = JSONObject(json)
            val listed = o.optJSONArray("files") ?: JSONArray()
            val files = (0 until listed.length()).map { listed.getJSONObject(it) }.flatMap { f ->
                listOfNotNull(f.getString("filename"), f.optString("previous_filename").ifEmpty { null })
            }
            Comparison(o.getInt("ahead_by"), o.getInt("behind_by"), files.distinct(), listed.length() >= Pulse.FILE_LIMIT)
        } catch (e: JSONException) { null }
    }
}

/** A check-run summary of one commit. */
enum class Ci(val mark: String, val label: String) {
    OK("✓", "CI rendben"), FAILED("✗", "CI hiba"), RUNNING("●", "CI fut"), NONE("–", "Nincs CI ezen a commiton");

    companion object {
        private val BAD = setOf("failure", "timed_out", "cancelled", "action_required", "startup_failure")

        /** GET /commits/{ref}/check-runs. A failed check counts even while others still run. */
        fun parse(json: String): Ci = try {
            val a = JSONObject(json).getJSONArray("check_runs")
            val runs = (0 until a.length()).map { a.getJSONObject(it) }
            when {
                runs.isEmpty() -> NONE
                runs.any { it.optString("conclusion") in BAD } -> FAILED
                runs.any { it.optString("status") != "completed" } -> RUNNING
                else -> OK
            }
        } catch (e: JSONException) { NONE }
    }
}

data class Tool(val id: String, val name: String, val paths: List<String>)

/** Mobile/catalogue/tools.json. A file belongs to the longest path that matches it. */
class ToolMap(val tools: List<Tool>) {
    private val rules = tools.flatMap { t -> t.paths.map { it to t } }.sortedByDescending { it.first.length }

    fun toolOf(file: String): Tool? =
        rules.firstOrNull { (p, _) -> if (p.endsWith("/")) file.startsWith(p) else file == p }?.second

    companion object {
        fun parse(json: String): ToolMap? = try {
            val a = JSONObject(json).getJSONArray("tools")
            ToolMap((0 until a.length()).map { a.getJSONObject(it) }.map { o ->
                val p = o.getJSONArray("paths")
                Tool(o.getString("id"), o.getString("name"), (0 until p.length()).map { p.getString(it) })
            })
        } catch (e: JSONException) { null }
    }
}

/** One line of the tools list: how many files main changed recently, and which branches touch the tool. */
data class ToolRow(val name: String, val mainFiles: Int, val branches: List<String>)

object ToolRows {
    const val OTHER = "Egyéb"

    /** Most changed first; files no tool owns go to a last [OTHER] line. */
    fun build(map: ToolMap, mainFiles: List<String>, branches: Map<String, List<String>>): List<ToolRow> {
        fun name(file: String) = map.toolOf(file)?.name ?: OTHER
        val counts = mainFiles.groupingBy(::name).eachCount()
        val touched = branches.flatMap { (branch, files) -> files.map(::name).distinct().map { it to branch } }
            .groupBy({ it.first }, { it.second })
        return (counts.keys + touched.keys)
            .map { ToolRow(it, counts[it] ?: 0, touched[it].orEmpty().sorted()) }
            .sortedWith(compareBy<ToolRow> { it.name == OTHER }.thenByDescending { it.mainFiles }.thenBy { it.name })
    }
}
