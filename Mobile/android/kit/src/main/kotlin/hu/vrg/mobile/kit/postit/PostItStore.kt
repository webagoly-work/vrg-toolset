package hu.vrg.mobile.kit.postit

import android.content.Context
import android.net.Uri
import android.os.Build
import hu.vrg.mobile.core.PiAnchor
import hu.vrg.mobile.core.PiAuthor
import hu.vrg.mobile.core.PiInboxEntry
import hu.vrg.mobile.core.PostIt
import hu.vrg.mobile.core.PostItNote
import hu.vrg.mobile.kit.files.FileStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.io.File
import java.time.LocalDate
import java.util.UUID

// Post-it (WP M68, docs/notes/POSTIT.md §6): the phone's store. Switches in SharedPreferences "postit", this phone's notes in
// files/postit/mine.json (a bundle under its own author, so the file is a ready export), the testers' notes called in at
// files/postit/inbox.json. The rules (format, merge, placement) are kit-core's PostIt; this file only carries bytes.

data class PostItState(
    /** Beállítások → Post-it jegyzetek: off = no buttons, no layer, nothing. */
    val enabled: Boolean = false,
    /** 👁: the notes drawn. */
    val show: Boolean = true,
    /** 📌: the next tap places a note. Not stored: an app start never comes up armed. */
    val armed: Boolean = false,
    /** Beállítások → Fejlesztői réteg engedélyezése: the DEV button appears (the developer's phone only). */
    val devAllowed: Boolean = false,
    /** DEV: the testers' notes drawn too. */
    val dev: Boolean = false,
    val name: String = "",
    val me: String = "",
    val mine: List<PostItNote> = emptyList(),
    val inbox: Map<String, PiInboxEntry> = emptyMap(),
    val hidden: Set<String> = emptySet(),
)

object PostItStore {
    private const val PREFS = "postit"
    private lateinit var ctx: Context
    private val _flow = MutableStateFlow(PostItState())
    val flow: StateFlow<PostItState> = _flow
    val value: PostItState get() = _flow.value

    private val dir get() = File(ctx.filesDir, "postit").apply { mkdirs() }
    private val prefs get() = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun init(context: Context) {
        ctx = context.applicationContext
        val p = prefs
        val me = p.getString("me", null)?.takeIf { PostIt.validId(it) }
            ?: ("a-" + UUID.randomUUID().toString().replace("-", "").take(12)).also { p.edit().putString("me", it).apply() }
        _flow.value = PostItState(
            enabled = p.getBoolean("enabled", false),
            show = p.getBoolean("show", true),
            devAllowed = p.getBoolean("devAllowed", false),
            dev = p.getBoolean("dev", false),
            name = p.getString("name", "").orEmpty().take(PostIt.MAX_NAME),
            me = me,
            mine = PostIt.mineFromJson(read("mine.json")),
            inbox = PostIt.inboxFromJson(read("inbox.json")),
            hidden = p.getStringSet("hidden", emptySet()).orEmpty().filter { PostIt.validId(it) }.toSet(),
        )
    }

    val ready get() = ::ctx.isInitialized

    private fun read(name: String): String? = try { File(dir, name).takeIf { it.exists() }?.readText() } catch (e: Exception) { null }
    private fun write(name: String, text: String) {
        val tmp = File(dir, "$name.tmp")
        tmp.writeText(text)
        tmp.renameTo(File(dir, name))
    }

    private fun set(f: (PostItState) -> PostItState) {
        val old = _flow.value
        val n = f(old)
        if (n == old) return
        _flow.value = n
        prefs.edit().putBoolean("enabled", n.enabled).putBoolean("show", n.show).putBoolean("devAllowed", n.devAllowed)
            .putBoolean("dev", n.dev && n.devAllowed).putString("name", n.name).putStringSet("hidden", n.hidden).apply()
        if (n.mine != old.mine) write("mine.json", PostIt.bundle(author(n), n.mine))
        if (n.inbox != old.inbox) write("inbox.json", PostIt.inboxToJson(n.inbox))
    }

    fun author(s: PostItState = value) =
        PiAuthor(s.me, s.name.ifBlank { "névtelen" }, "mobile", (Build.MANUFACTURER + " " + Build.MODEL).trim().take(80), "VRG Mobile")

    // ---- the switches
    fun setEnabled(on: Boolean) = set { it.copy(enabled = on, armed = false) }
    fun setShow(on: Boolean) = set { it.copy(show = on) }
    fun setArmed(on: Boolean) = set { it.copy(armed = on && it.enabled) }
    fun setDevAllowed(on: Boolean) = set { it.copy(devAllowed = on, dev = it.dev && on) }
    fun setDev(on: Boolean) = set { it.copy(dev = on && it.devAllowed) }
    fun setName(name: String) = set { it.copy(name = name.trim().take(PostIt.MAX_NAME)) }
    fun setHidden(authorId: String, hide: Boolean) = set { it.copy(hidden = if (hide) it.hidden + authorId else it.hidden - authorId) }

    // ---- this phone's notes
    fun add(text: String, anchor: PiAnchor): PostItNote? {
        val n = PostIt.make(text.trim(), anchor)
        if (PostIt.check(n) != null) return null
        set { it.copy(mine = (it.mine + n).takeLast(PostIt.MAX_NOTES), armed = false) }
        return n
    }
    fun edit(id: String, text: String? = null, state: String? = null) = set { s ->
        s.copy(mine = s.mine.map { n ->
            if (n.id != id) n
            else n.copy(text = text?.trim()?.takeIf { it.isNotEmpty() }?.take(PostIt.MAX_TEXT) ?: n.text, state = state ?: n.state, edited = System.currentTimeMillis())
        })
    }
    fun remove(id: String) = set { s -> s.copy(mine = s.mine.filterNot { it.id == id }) }
    fun clearMine() = set { it.copy(mine = emptyList()) }

    // ---- the developer's side
    fun settle(authorId: String, id: String, state: String) = set { s ->
        val e = s.inbox[authorId] ?: return@set s
        s.copy(inbox = s.inbox + (authorId to e.copy(notes = e.notes.map { if (it.id == id) it.copy(state = state) else it })))
    }

    /** One bundle's text (a file, a share): merged into the inbox. Returns a line for the user. */
    fun importText(text: String): String {
        val p = PostIt.parse(text)
        if (p !is PostIt.Parsed.Ok) return "Post-it: hibás fájl (${(p as PostIt.Parsed.Bad).err})"
        if (p.bundle.author.id == value.me) return "Post-it: ez a saját exportod"
        val m = PostIt.mergeInbox(value.inbox, p.bundle)
        set { it.copy(inbox = m.inbox, dev = it.dev || (it.devAllowed && m.added > 0)) }
        return "Post-it: ${p.bundle.author.name} · ${m.added} új, ${m.updated} frissült" +
            if (!value.devAllowed) " (a megjelenítéshez: Beállítások → Fejlesztői réteg)" else ""
    }

    fun importUris(uris: List<Uri>): String = uris.take(50).joinToString("\n") { u ->
        try {
            val text = ctx.contentResolver.openInputStream(u)?.use { s -> s.readBytes().takeIf { it.size <= 2_000_000 }?.toString(Charsets.UTF_8) }
            if (text == null) "Post-it: a fájl nem olvasható" else importText(text)
        } catch (e: Exception) { "Post-it: a fájl nem olvasható" }
    }

    /** The export as a file in cache/postit (shared through the kit's FileProvider); null when there is nothing to export. */
    fun exportFile(): File? {
        val s = value
        if (s.mine.isEmpty()) return null
        val d = File(ctx.cacheDir, "postit").apply { mkdirs() }
        d.listFiles()?.forEach { it.delete() }
        val f = File(d, "postit-${LocalDate.now()}-${s.me}.vrgpostit.json")
        f.writeText(PostIt.bundle(author(s), s.mine))
        return f
    }

    fun shareIntent() = exportFile()?.let { FileStore.shareIntent(ctx, it, "application/json", "Post-it jegyzetek küldése") }
}
