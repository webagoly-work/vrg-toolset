package hu.vrg.mobile.notebook.ui

import android.app.Application
import android.content.Context
import androidx.compose.runtime.Composable
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.Route
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.notebook.Entry
import hu.vrg.mobile.notebook.Ids
import hu.vrg.mobile.notebook.Kit
import hu.vrg.mobile.notebook.Kits
import hu.vrg.mobile.notebook.Library
import hu.vrg.mobile.notebook.Merge
import hu.vrg.mobile.notebook.Store
import hu.vrg.mobile.notebook.Transfer
import hu.vrg.mobile.notebook.Unreadable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.File

// VRG Füzet (WP M46): the malleable notebook. The store (every entry of every kit) is one plain JSON file in
// filesDir/notebook/store.json, written whole after each change (tmp + rename). The kits are the bundled ones from
// assets/notebook/kits plus the ones the owner imported into filesDir/notebook/kits. All the rules are notebook-core.

/** Where a bundled or imported kit came from, and whether it loaded. */
data class KitSource(val id: String, val file: String, val own: Boolean, val errors: List<String>)

object NotebookFeature : VrgFeature {
    override val info = Catalogue.NOTEBOOK
    private const val TAG = "notebook"
    /** On the first start: the base kit, the work log and the house. Kutya waits for the owner (Personal App Q4). */
    private val FIRST_ON = setOf(Kits.BASE, "munka", "otthon")

    private lateinit var app: Context
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val lock = Mutex()

    val store = MutableStateFlow(Store())
    val library = MutableStateFlow(Library(emptyList()))
    val sources = MutableStateFlow<List<KitSource>>(emptyList())
    /** A note handed in by a link (vrg://notebook/new?text=…), opened in the editor once. */
    val incoming = MutableStateFlow<String?>(null)
    /** The store before the last delete, for one step of undo. */
    val undo = MutableStateFlow<Store?>(null)
    /** A store file that could not be read was put aside under this name; shown once. */
    val problem = MutableStateFlow<String?>(null)

    private fun dir() = File(app.filesDir, "notebook").apply { mkdirs() }
    private fun kitDir() = File(dir(), "kits").apply { mkdirs() }
    private fun file() = File(dir(), "store.json")

    override fun init(app: Application) {
        this.app = app
        loadKits()
        val f = file()
        store.value = if (!f.exists()) Store(kitsOn = FIRST_ON) else try {
            Store.read(f.readText())
        } catch (e: Unreadable) {
            val aside = File(dir(), "store.bad-${System.currentTimeMillis()}.json")
            f.renameTo(aside)
            problem.value = "A füzet fájlja nem volt olvasható (${e.message}). Félretettem: ${aside.name}"
            VrgLog.w(TAG, problem.value ?: "")
            Store(kitsOn = FIRST_ON)
        }
    }

    override fun onForeground(on: Boolean) { if (!on) persist() }

    override fun open(route: Route): Boolean {
        route.params["text"]?.let { incoming.value = it }
        return route.path.isEmpty() || route.path == "new"
    }

    // ---- kits ------------------------------------------------------------------------------------------------------

    fun loadKits() {
        val found = mutableListOf<KitSource>()
        val kits = mutableListOf<Kit>()
        val names = try { app.assets.list("notebook/kits")?.filter { it.endsWith(".json") }?.sorted() ?: emptyList() } catch (e: Exception) { emptyList() }
        names.forEach { n ->
            val p = Kits.parse(app.assets.open("notebook/kits/$n").bufferedReader().use { it.readText() })
            p.kit?.let { kits += it }
            found += KitSource(p.kit?.id ?: n.removeSuffix(".json"), n, false, p.errors)
        }
        kitDir().listFiles { f -> f.name.endsWith(".json") }?.sortedBy { it.name }?.forEach { f ->
            val p = Kits.parse(f.readText())
            p.kit?.let { kits += it }
            found += KitSource(p.kit?.id ?: f.nameWithoutExtension, f.name, true, p.errors)
        }
        library.value = Library(kits)
        sources.value = found
        found.filter { it.errors.isNotEmpty() }.forEach { VrgLog.w(TAG, "${it.file}: ${it.errors.first()}") }
    }

    /** Checks and keeps a kit the owner picked; returns what to tell them. */
    fun importKit(text: String): String {
        val p = Kits.parse(text)
        val kit = p.kit ?: return "A kit nem tölthető be: " + p.errors.take(3).joinToString("; ")
        if (kit.id == Kits.BASE) return "Az alap kitet nem lehet lecserélni."
        File(kitDir(), "${kit.id}.json").writeText(text)
        loadKits()
        change { it.setKit(kit.id, true) }
        return "Betöltve: ${kit.name}" + if (p.warnings.isNotEmpty()) " (figyelmeztetés: ${p.warnings.first()})" else ""
    }

    fun removeOwnKit(id: String) {
        File(kitDir(), "$id.json").delete()
        loadKits()
    }

    // ---- the store -------------------------------------------------------------------------------------------------

    fun change(fn: (Store) -> Store) {
        store.value = fn(store.value)
        persist()
    }

    fun newEntry(kit: String, type: String, text: String = ""): Entry {
        val now = System.currentTimeMillis()
        return Entry(Ids.next(now), kit, type, now, text = text)
    }

    fun save(e: Entry) {
        val now = System.currentTimeMillis()
        change { s -> if (s.byId(e.id) == null) s.add(e).copy(draft = "") else s.update(e.id, now) { e } }
    }

    fun delete(id: String) {
        undo.value = store.value
        change { it.remove(id) }
    }

    fun undoDelete() {
        val back = undo.value ?: return
        undo.value = null
        change { back }
    }

    fun exportText(): String = Transfer.export(store.value)

    fun importStore(text: String): String = try {
        val m: Merge = Transfer.merge(store.value, Store.read(text))
        if (m.changed) change { m.store }
        m.describe()
    } catch (e: Unreadable) { e.message ?: "Nem olvasható fájl." }

    private fun persist() {
        if (!this::app.isInitialized) return
        scope.launch {
            lock.withLock {
                try {
                    val f = file()
                    val tmp = File(dir(), "store.json.tmp")
                    tmp.writeText(store.value.write())
                    if (!tmp.renameTo(f)) { f.writeText(tmp.readText()); tmp.delete() }
                } catch (e: Exception) {
                    VrgLog.w(TAG, "Mentés nem sikerült: ${e.message}")
                }
            }
        }
    }

    @Composable
    override fun Screen(host: FeatureHost) = NotebookScreen(host)
}
