package hu.vrg.mobile.kit.github

import hu.vrg.mobile.core.Contents
import hu.vrg.mobile.core.FileAt
import hu.vrg.mobile.core.NoteLog
import hu.vrg.mobile.core.NotesApi
import hu.vrg.mobile.core.PutResult
import hu.vrg.mobile.core.VrgRepo
import java.net.URLEncoder

// Gyorsjegyzet's GitHub calls (WP M6): the contents API and the branch refs, behind kit-core's NotesApi
// so the append rule is tested without GitHub. Writes go to NoteLog.BRANCH only: Contents refuses to
// build a body for any other branch, so no caller can point this at main or a work branch.

object GitHubNotes : NotesApi {
    private fun enc(path: String) = path.split('/').joinToString("/") { URLEncoder.encode(it, "UTF-8").replace("+", "%20") }

    override suspend fun read(path: String, branch: String): FileAt? =
        when (val r = GitHub.get("${VrgRepo.PATH}/contents/${enc(path)}?ref=${URLEncoder.encode(branch, "UTF-8")}")) {
            is Gh.Ok -> Contents.parse(r.value) ?: throw NotesApi.Problem("Érthetetlen válasz a GitHubtól.")
            is Gh.Failed -> if (r.code == 404) null else throw NotesApi.Problem(r.problem() ?: "?")
            else -> throw NotesApi.Problem(r.problem() ?: "?")
        }

    override suspend fun write(path: String, branch: String, text: String, sha: String?, message: String): PutResult {
        val body = Contents.putBody(text, sha, branch, message)
        return when (val r = GitHub.send("PUT", "${VrgRepo.PATH}/contents/${enc(path)}", body)) {
            is Gh.Ok -> PutResult.Ok
            is Gh.Failed -> when {
                r.code == 409 -> PutResult.Conflict
                r.code == 422 && r.message.contains("sha", ignoreCase = true) -> PutResult.Conflict
                else -> PutResult.Failed(r.problem() ?: "?")
            }
            else -> throw NotesApi.Problem(r.problem() ?: "?")
        }
    }

    override suspend fun branchExists(branch: String): Boolean =
        when (val r = GitHub.get("${VrgRepo.PATH}/git/ref/heads/$branch")) {
            is Gh.Ok -> true
            is Gh.Failed -> if (r.code == 404) false else throw NotesApi.Problem(r.problem() ?: "?")
            else -> throw NotesApi.Problem(r.problem() ?: "?")
        }

    override suspend fun createBranch(branch: String, from: String) {
        require(NoteLog.writable(branch)) { "only ${NoteLog.BRANCH} is created" }
        val base = when (val r = GitHub.get("${VrgRepo.PATH}/git/ref/heads/$from")) {
            is Gh.Ok -> Contents.refSha(r.value) ?: throw NotesApi.Problem("Nincs $from branch.")
            else -> throw NotesApi.Problem(r.problem() ?: "?")
        }
        when (val r = GitHub.send("POST", "${VrgRepo.PATH}/git/refs", Contents.refBody(branch, base))) {
            is Gh.Ok -> {}
            is Gh.Failed -> if (r.code != 422) throw NotesApi.Problem(r.problem() ?: "?")   // 422: made meanwhile
            else -> throw NotesApi.Problem(r.problem() ?: "?")
        }
    }
}
