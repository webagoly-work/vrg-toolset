package hu.vrg.mobile.kit.github

import hu.vrg.mobile.core.Contents
import hu.vrg.mobile.core.FileAt
import hu.vrg.mobile.core.NoteContents
import hu.vrg.mobile.core.NoteRemote
import hu.vrg.mobile.core.NoteSync
import hu.vrg.mobile.core.NoteWrite
import hu.vrg.mobile.core.NotesApi
import hu.vrg.mobile.core.VrgRepo
import java.net.URLEncoder

// VRG Jegyzetek's branch (WP M46, D-56 = B): one JSON file per note in notes/ on `vrg-notes`, through the contents
// API. Writes reach NoteSync.BRANCH only: NoteContents refuses to build a body for any other branch.

object GitHubNoteHub : NoteRemote {
    private val ref get() = URLEncoder.encode(NoteSync.BRANCH, "UTF-8")
    private fun enc(path: String) = path.split('/').joinToString("/") { URLEncoder.encode(it, "UTF-8").replace("+", "%20") }

    override suspend fun ensureBranch() {
        val b = NoteSync.BRANCH
        when (val r = GitHub.get("${VrgRepo.PATH}/git/ref/heads/$b")) {
            is Gh.Ok -> return
            is Gh.Failed -> if (r.code != 404) throw NotesApi.Problem(r.problem() ?: "?")
            else -> throw NotesApi.Problem(r.problem() ?: "?")
        }
        val base = when (val r = GitHub.get("${VrgRepo.PATH}/git/ref/heads/${NoteSync.BASE}")) {
            is Gh.Ok -> Contents.refSha(r.value) ?: throw NotesApi.Problem("Nincs ${NoteSync.BASE} branch.")
            else -> throw NotesApi.Problem(r.problem() ?: "?")
        }
        when (val r = GitHub.send("POST", "${VrgRepo.PATH}/git/refs", NoteContents.refBody(b, base))) {
            is Gh.Ok -> {}
            is Gh.Failed -> if (r.code != 422) throw NotesApi.Problem(r.problem() ?: "?")   // 422: made meanwhile
            else -> throw NotesApi.Problem(r.problem() ?: "?")
        }
    }

    override suspend fun list(): Map<String, String> =
        when (val r = GitHub.get("${VrgRepo.PATH}/contents/${NoteSync.DIR}?ref=$ref")) {
            is Gh.Ok -> NoteContents.listing(r.value)
            is Gh.Failed -> if (r.code == 404) emptyMap() else throw NotesApi.Problem(r.problem() ?: "?")
            else -> throw NotesApi.Problem(r.problem() ?: "?")
        }

    override suspend fun read(path: String): FileAt? =
        when (val r = GitHub.get("${VrgRepo.PATH}/contents/${enc(path)}?ref=$ref")) {
            is Gh.Ok -> Contents.parse(r.value) ?: throw NotesApi.Problem("Érthetetlen válasz a GitHubtól.")
            is Gh.Failed -> if (r.code == 404) null else throw NotesApi.Problem(r.problem() ?: "?")
            else -> throw NotesApi.Problem(r.problem() ?: "?")
        }

    override suspend fun write(path: String, text: String, sha: String?, message: String): NoteWrite {
        val body = NoteContents.putBody(text, sha, NoteSync.BRANCH, message)
        return when (val r = GitHub.send("PUT", "${VrgRepo.PATH}/contents/${enc(path)}", body)) {
            is Gh.Ok -> NoteContents.writtenSha(r.value)?.let { NoteWrite.Ok(it) } ?: NoteWrite.Failed("A GitHub nem adta vissza a fájl azonosítóját.")
            is Gh.Failed -> when {
                r.code == 409 -> NoteWrite.Conflict
                r.code == 422 && r.message.contains("sha", ignoreCase = true) -> NoteWrite.Conflict
                else -> NoteWrite.Failed(r.problem() ?: "?")
            }
            else -> throw NotesApi.Problem(r.problem() ?: "?")
        }
    }
}
