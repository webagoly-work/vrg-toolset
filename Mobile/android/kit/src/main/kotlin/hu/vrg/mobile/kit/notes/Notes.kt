package hu.vrg.mobile.kit.notes

import android.content.Context
import hu.vrg.mobile.core.MirrorItem
import hu.vrg.mobile.core.NoteJson
import hu.vrg.mobile.core.NoteMirror
import hu.vrg.mobile.core.NoteOrigin
import hu.vrg.mobile.core.Notebook
import hu.vrg.mobile.core.NotesKit
import hu.vrg.mobile.core.VNote
import hu.vrg.mobile.kit.VrgLog
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.File

// VRG Jegyzetek's hub (WP M46): the one place every note of the app lives. Any feature reaches it through this
// object, never through its own note store:
//
//   Notes.add("gyors", text)                         a one-way note (quick capture, a share)
//   Notes.mirror("sketcher", "<sketch>/", items)     a linked mirror of a feature's own records (D-57 = A)
//   Notes.pull("sketcher", ref, text)                the text the record should take after an edit in the hub
//   Notes.onOpen("sketcher") { ref -> … }            how the hub's "open in the source" reaches the feature
//
// The rules are kit-core's NoteHub.kt; this keeps the list in files/notes/hub.json and tells the sync (feature-notes)
// that something changed. The kit (modules, versions, origins) is Notes/catalog/noteskit.json, copied into the
// APK's assets by feature-notes' build.

object Notes {
    private const val FILE = "notes/hub.json"
    private lateinit var app: Context
    private val lock = Any()
    private val io = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _all = MutableStateFlow<List<VNote>>(emptyList())
    val all: StateFlow<List<VNote>> get() = _all

    /** The sync's hook (feature-notes): called after every change. */
    @Volatile var changed: (() -> Unit)? = null

    private val openers = mutableMapOf<String, (String) -> Unit>()

    val ready get() = ::app.isInitialized

    /** Idempotent: every feature that writes notes calls it from its own init. */
    fun init(ctx: Context) = synchronized(lock) {
        if (ready) return
        app = ctx.applicationContext
        _all.value = NoteJson.readAll(file().takeIf { it.exists() }?.readText())
    }

    val kit: NotesKit by lazy {
        try { NotesKit.parse(app.assets.open("notes/noteskit.json").bufferedReader().readText()) }
        catch (e: Exception) {
            VrgLog.w("notes", "A jegyzet-készlet nem olvasható: ${e.message}")
            NotesKit(emptyList(), listOf(hu.vrg.mobile.core.NoteProfile("egyszeru", "Egyszerű", "○", "#8a9bb0", "", emptyList(), "lista", emptyList(), true)), emptyList(), emptyList())
        }
    }

    val device: String get() = android.os.Build.MODEL ?: ""

    private fun file() = File(app.filesDir, FILE)

    /** Changes the list through [f] (kit-core's Notebook / NoteMirror functions) and saves it. */
    fun change(f: (List<VNote>) -> List<VNote>) {
        val next: List<VNote>
        synchronized(lock) {
            val cur = _all.value
            next = f(cur)
            if (next == cur) return
            _all.value = next
        }
        save(next)
        changed?.invoke()
    }

    /** The sync's own write-back: no "changed" call, or it would start itself again. */
    fun replace(f: (List<VNote>) -> List<VNote>) {
        val next: List<VNote>
        synchronized(lock) { next = f(_all.value); _all.value = next }
        save(next)
    }

    private fun save(notes: List<VNote>) = io.launch {
        try {
            val f = file(); f.parentFile?.mkdirs()
            val tmp = File(f.parentFile, "hub.tmp")
            tmp.writeText(NoteJson.writeAll(notes))
            if (!tmp.renameTo(f)) { f.writeText(tmp.readText()); tmp.delete() }
        } catch (e: Exception) { VrgLog.w("notes", "Mentés sikertelen: ${e.message}") }
    }

    fun note(id: String) = _all.value.firstOrNull { it.id == id }

    // ---- the plug-in side: what other features call ----

    /** A one-way note from [origin] (an origin id of the kit). Returns its id. */
    fun add(origin: String, text: String, title: String = "", tags: List<String> = emptyList(), label: String = ""): String? {
        if (text.isBlank() && title.isBlank()) return null
        var id: String? = null
        change { ns ->
            val g = if (origin == Notebook.HERE) null else NoteOrigin(origin, label = label)
            Notebook.create(ns, System.currentTimeMillis(), device, title, text.trim(), tags, origin = g, unread = g != null).also { id = it.second.id }.first
        }
        return id
    }

    /** Mirrors every record of one scope (one survey: [scope] = "<sketch id>/") into the hub. */
    fun mirror(origin: String, scope: String, items: List<MirrorItem>) {
        if (!ready) return
        change { NoteMirror.sync(it, origin, scope, items, System.currentTimeMillis(), device) }
    }

    /** The text record [ref] should take because the note was edited in the hub, or null. */
    fun pull(origin: String, ref: String, sourceText: String): String? =
        if (!ready) null else NoteMirror.pull(_all.value, origin, ref, sourceText)

    /** How "open in the source" reaches a feature: it gets the ref and opens that record. */
    fun onOpen(origin: String, open: (String) -> Unit) { synchronized(openers) { openers[origin] = open } }

    /** true when the origin's feature took it (then the caller opens that feature). */
    fun openSource(n: VNote): Boolean {
        val g = n.origin ?: return false
        val f = synchronized(openers) { openers[g.app] } ?: return false
        f(g.ref); return true
    }

    // ---- the version (⚙ → Változat) ----

    private fun prefs() = app.getSharedPreferences("notes-hub", Context.MODE_PRIVATE)
    private val _profile = MutableStateFlow<String?>(null)
    private val _overrides = MutableStateFlow<Map<String, Boolean>>(emptyMap())
    val profile: StateFlow<String?> get() { loadSettings(); return _profile }
    val overrides: StateFlow<Map<String, Boolean>> get() { loadSettings(); return _overrides }
    @Volatile private var settingsLoaded = false

    private fun loadSettings() {
        if (settingsLoaded || !ready) return
        settingsLoaded = true
        _profile.value = prefs().getString("profile", null) ?: kit.defaultProfile.id
        _overrides.value = try {
            val o = JSONObject(prefs().getString("modules", "{}") ?: "{}")
            o.keys().asSequence().associateWith { o.getBoolean(it) }
        } catch (e: Exception) { emptyMap() }
    }

    /** Picks a version; its own module set replaces the user's switches. */
    fun setProfile(id: String) {
        loadSettings()
        _profile.value = id; _overrides.value = emptyMap()
        prefs().edit().putString("profile", id).putString("modules", "{}").apply()
    }

    fun setModule(id: String, on: Boolean) {
        loadSettings()
        val m = _overrides.value + (id to on)
        _overrides.value = m
        prefs().edit().putString("modules", JSONObject(m).toString()).apply()
    }

    fun enabled(): Set<String> { loadSettings(); return kit.enabled(_profile.value, _overrides.value) }
}
