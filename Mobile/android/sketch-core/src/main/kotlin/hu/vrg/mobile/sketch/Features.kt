package hu.vrg.mobile.sketch

// The VRG Sketcher feature registry (WP M51, D-91…D-99; the Founder's rule D-90): every user-facing feature of the
// Sketcher as one entry with its own switch, grouped by front. One setting per phone (per browser on the Desktop),
// never per survey: survey plugins (alaprajz, villany, fotopont) stay per survey and are a separate thing.
//
// The stored value lists the ids whose state differs from their default ("flipped"): for the usual default-on feature
// that is "what the user switched OFF", so a feature added later arrives on. A feature switched off leaves no trace in
// the UI, never deletes data in a survey and never changes what an exported file means (D-93). A feature whose
// prerequisite is off is off too, and is shown greyed
// (GPS törlése never depends on the camera's other switches: privacy on export stays whatever the UI shows) (its own switch is kept, it comes back with the prerequisite).
// A variant can never switch on what the user switched off (D-95): the rail, the plugins and the draw tune a variant
// brings all pass through here.
//
// The same data is Sketcher/catalog/features.json (the Desktop page reads it, Sketcher/lib/features.js); FeaturesTest
// checks the two lists are equal and replays Sketcher/test/fixtures/features.json written by the JS twin.
// CameraFeatures (F3, D-90) is folded in as the kamera.* entries; its own setting stays where it was (D-96).

object Features {
    data class Front(val id: String, val label: String, val sym: String, val color: Long, val bar: Boolean)

    data class Feature(
        val id: String, val front: String, val sym: String, val label: String,
        val requires: List<String> = emptyList(), val default: Boolean = true, val locked: Boolean = false,
        val color: Long? = null,
    )

    private fun F(id: String, front: String, sym: String, label: String, requires: List<String> = emptyList(),
                  default: Boolean = true, locked: Boolean = false) = Feature(id, front, sym, label, requires, default, locked)

    val FRONTS = listOf(
        Front("vazlat", "Vázlat", "◫", 0xFF27C2B0, true), Front("jegyzet", "Jegyzet", "✎", 0xFFE0B020, true),
        Front("munkakor", "Munkakör", "☰", 0xFF3DAE5A, true), Front("kerdes", "Kérdések", "?", 0xFFE8641C, true),
        Front("kamera", "Kamera", "◉", 0xFF2A8CDB, true), Front("helyszin", "Helyszín", "⌖", 0xFF8A5CD6, true),
        Front("nyitott", "Nyitott", "⚑", 0xFFD64545, true), Front("variansok", "Variánsok", "◐", 0xFFB07AD6, false),
        Front("export", "Rendezés / export", "⇪", 0xFF7D8590, false),
    )

    val ALL: List<Feature> = listOf(
        F("vazlat.select", "vazlat", "✥", "Mozgat", locked = true),
        F("vazlat.memo", "vazlat", "✎", "Memó"),
        F("vazlat.tag", "vazlat", "#", "Címkék"),
        F("vazlat.room", "vazlat", "▭", "Szoba"),
        F("vazlat.template", "vazlat", "⌗", "Sablon"),
        F("vazlat.line", "vazlat", "⌇", "Vonal"),
        F("vazlat.measure", "vazlat", "↔", "Méret"),
        F("vazlat.point", "vazlat", "•", "Pont"),
        F("vazlat.circuit", "vazlat", "◌", "Áramkör", listOf("vazlat.point")),
        F("vazlat.board", "vazlat", "▣", "Elosztó"),
        F("vazlat.route", "vazlat", "〰", "Nyomvonal"),
        F("vazlat.photo", "vazlat", "◉", "Fotópont"),
        F("vazlat.wheels", "vazlat", "◎", "Tartásra kerék"),
        F("vazlat.drawtune", "vazlat", "⚙", "Rajz-hangolás"),
        F("jegyzet.quick", "jegyzet", "✎", "Gyors jegyzet"),
        F("jegyzet.chips", "jegyzet", "◆", "Gyors chipek", listOf("jegyzet.quick")),
        F("jegyzet.dictation", "jegyzet", "🎤", "Diktálás"),
        F("jegyzet.unclear", "jegyzet", "⚑", "Tisztázandó"),
        F("jegyzet.keywords", "jegyzet", "✦", "Kulcsszó-javaslat"),
        F("jegyzet.log", "jegyzet", "☰", "Jegyzetnapló"),
        F("munkakor.scope", "munkakor", "☰", "Munkakör kapcsolók"),
        F("munkakor.summary", "munkakor", "▤", "Összesítő"),
        F("munkakor.wants", "munkakor", "★", "Igények szobánként", listOf("munkakor.scope")),
        F("munkakor.takeoff", "munkakor", "▦", "Munkakör lap"),
        F("munkakor.implied", "munkakor", "◉", "Dedikált kör nagy gépnek", listOf("munkakor.takeoff"), default = false),
        F("kerdes.questions", "kerdes", "?", "Kérdőív"),
        F("kerdes.later", "kerdes", "⏱", "Később / Nem releváns", listOf("kerdes.questions")),
        F("kerdes.filter", "kerdes", "☺", "Ügyfél / Szemle szűrő", listOf("kerdes.questions")),
        F("kerdes.fresh", "kerdes", "●", "Új kérdés jelzése", listOf("kerdes.questions")),
        F("kamera.capture", "kamera", "◉", "Fotó céllal"),
        F("kamera.shotlist", "kamera", "☑", "Képlista", listOf("kamera.capture")),
        F("kamera.series", "kamera", "⟳", "Sorozat", listOf("kamera.capture")),
        F("kamera.markup", "kamera", "✎", "Jelölés", listOf("kamera.capture")),
        F("kamera.ocr", "kamera", "▤", "Szöveg kiolvasása", listOf("kamera.capture")),
        F("kamera.ocr_auto", "kamera", "▤", "Címkefotó magától", listOf("kamera.capture", "kamera.ocr")),
        F("kamera.blur", "kamera", "▦", "Elmosás", listOf("kamera.capture", "kamera.markup")),
        F("kamera.faces", "kamera", "☺", "Arckeresés", listOf("kamera.capture", "kamera.blur")),
        F("kamera.faces_auto", "kamera", "☺", "Arckeresés személyes fotón", listOf("kamera.capture", "kamera.faces")),
        F("kamera.privacy", "kamera", "👤", "Személyes adat jelölés", listOf("kamera.capture")),
        F("kamera.pairs", "kamera", "◐", "Előtte / utána", listOf("kamera.capture")),
        F("kamera.signature", "kamera", "✍", "Aláírás", listOf("kamera.capture")),
        F("kamera.video", "kamera", "🎥", "Séta videó", listOf("kamera.capture")),
        F("kamera.quick", "kamera", "◉", "Hiányzók elöl", listOf("kamera.capture")),
        F("kamera.again", "kamera", "＋", "„+ még” gomb", listOf("kamera.capture")),
        F("helyszin.address", "helyszin", "⌂", "Cím"),
        F("helyszin.gps", "helyszin", "⌖", "Itt vagyok (GPS)"),
        F("helyszin.search", "helyszin", "🔎", "Keresés a neten"),
        F("helyszin.map", "helyszin", "🗺", "Térkép"),
        F("helyszin.outline", "helyszin", "▱", "Körvonal rajzolása", listOf("helyszin.map")),
        F("helyszin.satellite", "helyszin", "🛰", "Műhold", listOf("helyszin.map")),
        F("helyszin.place", "helyszin", "◫", "Vázlat az épületen"),
        F("helyszin.footprint", "helyszin", "⇔", "Méret-összevetés"),
        F("nyitott.list", "nyitott", "⚑", "Nyitott lista"),
        F("variansok.use", "variansok", "◐", "Variánsok"),
        F("variansok.longpress", "variansok", "☰", "Hosszú nyomásra", listOf("variansok.use")),
        F("variansok.refresh", "variansok", "⟳", "Frissítés a main ágról", listOf("variansok.use")),
        F("variansok.request", "variansok", "＋", "Új variáns kérése"),
        F("export.photos", "export", "◉", "Fotók a csomagban"),
        F("export.burned", "export", "✎", "Jelölt másolatok", listOf("export.photos")),
        F("export.takeoff", "export", "▦", "Munkakör lap fájl", listOf("munkakor.takeoff")),
        F("kamera.gps_strip", "export", "⌖", "GPS törlése kiadáskor"),
    )

    private val byId = ALL.associateBy { it.id }
    fun of(id: String): Feature? = byId[id]
    fun front(id: String): Front? = FRONTS.firstOrNull { it.id == id }
    fun inFront(front: String) = ALL.filter { it.front == front }

    /** The registry id of a rail tool (Tools.*.id) and of a Kamera 2 switch (CameraFeatures.*). */
    fun tool(toolId: String) = "vazlat.$toolId"
    fun camera(camId: String) = "kamera.$camId"

    /** The feature's own switch, prerequisites aside. */
    fun own(flipped: Set<String>, id: String): Boolean {
        val f = of(id) ?: return id !in flipped          // unknown: on unless stored off (a newer app's switch)
        if (f.locked) return true
        return f.default != (id in flipped)
    }

    /** Is [id] on: its own switch and every prerequisite's. An id not in the registry is on (it arrives on). */
    fun on(flipped: Set<String>, id: String): Boolean = on(flipped, id, 0)
    private fun on(flipped: Set<String>, id: String, depth: Int): Boolean {
        if (depth > 16 || !own(flipped, id)) return false
        return of(id)?.requires.orEmpty().all { on(flipped, it, depth + 1) }
    }

    /** The prerequisite that keeps [id] off (its own switch on), or null: the row is shown greyed with its name. */
    fun blockedBy(flipped: Set<String>, id: String): Feature? =
        if (!own(flipped, id)) null else of(id)?.requires.orEmpty().firstOrNull { !on(flipped, it) }?.let { of(it) }

    /** Sets the feature's own switch. A locked feature does not move. */
    fun set(flipped: Set<String>, id: String, on: Boolean): Set<String> {
        val f = of(id)
        if (f?.locked == true) return flipped
        val def = f?.default ?: true
        return if (on == def) flipped - id else flipped + id
    }

    fun toggle(flipped: Set<String>, id: String) = set(flipped, id, !own(flipped, id))

    /**
     * Mind be / Mind ki for one front ([front]) or everything (null). Mind ki switches every feature off; Mind be
     * switches every default-on feature on and leaves the default-off ones (options such as D-79's implied dedicated
     * circuits) as they were, so "all on" never changes a quantity behind the user's back (D-94).
     */
    fun all(flipped: Set<String>, on: Boolean, front: String? = null): Set<String> =
        ALL.filter { front == null || it.front == front }.fold(flipped) { acc, f ->
            if (on && !f.default) acc else set(acc, f.id, on)
        }

    /** Is every default-on feature of the front (or of everything) on? Drives the Mind switch. */
    fun allOn(flipped: Set<String>, front: String? = null) =
        ALL.filter { (front == null || it.front == front) && it.default && !it.locked }.all { own(flipped, it.id) }

    /** The front-bar fronts that still have a feature on, in [order] (the kit's fronts); a front not in the registry stays. */
    fun visibleFronts(flipped: Set<String>, order: List<String> = FRONTS.filter { it.bar }.map { it.id }): List<String> =
        order.filter { fid -> inFront(fid).let { fs -> fs.isEmpty() || fs.any { on(flipped, it.id) } } }

    // ---- what a variant brings passes through here (D-95) --------------------------------------------------------

    /** The rail without the tools switched off, whatever the variant's order or plugins say. */
    fun rail(tools: List<Tool>, flipped: Set<String>): List<Tool> = tools.filter { on(flipped, tool(it.id)) }

    /** The variant's draw tune, or the original when Rajz-hangolás is off. */
    fun draw(tune: DrawTune, flipped: Set<String>): DrawTune = if (on(flipped, "vazlat.drawtune")) tune else DrawTune()

    /** The feature a wheel item belongs to (null: always there, e.g. Törlés, a point type, a room kind). */
    fun wheelFeature(itemId: String): String? = when {
        itemId == "memo" || itemId == "edit" -> "vazlat.memo"
        itemId == "tag" -> "vazlat.tag"
        itemId == "circuit" || itemId == "points" -> "vazlat.circuit"
        itemId == "measure" || itemId == "measure-edge" -> "vazlat.measure"
        itemId == "point-here" -> "vazlat.point"
        itemId == "board-here" -> "vazlat.board"
        itemId.startsWith("shot:") -> "vazlat.photo"
        else -> null
    }

    /** A wheel with the items of switched-off features left as empty sectors (the ring keeps its directions). */
    fun wheel(w: Wheel, flipped: Set<String>): Wheel =
        w.copy(rings = w.rings.map { r -> r.map { it?.takeIf { i -> wheelFeature(i.id)?.let { f -> on(flipped, f) } ?: true } } })

    /** What the map page's site panel leaves out (WP M51): its ▱ Körvonal, 🛰 Műhold and ◫ Vázlat buttons. */
    fun mapHide(flipped: Set<String>): List<String> =
        listOf("outline" to "helyszin.outline", "satellite" to "helyszin.satellite", "place" to "helyszin.place").filter { !on(flipped, it.second) }.map { it.first }

    /** A survey plugin is shown when at least one of its tools is on (the note taker always). */
    fun pluginShown(p: Plugin, flipped: Set<String>) = p.id == Plugins.NOTE.id || p.tools.any { on(flipped, tool(it.id)) }

    // ---- the stored form and the stores it lives in (D-96) -------------------------------------------------------

    fun write(flipped: Set<String>) = flipped.sorted().joinToString(",")
    fun read(s: String?): Set<String> = s.orEmpty().split(',').map { it.trim() }.filter { it.isNotEmpty() }.toSet()

    /** Where the state is kept: F3's camera set (unprefixed ids), D-79's boolean, and the new general set. */
    data class Stores(val cameraOff: Set<String>, val implied: Boolean, val general: Set<String>)

    private val cameraIds = CameraFeatures.ALL.map { it.id }.toSet()

    /** Reads the three stores into one flipped set. Nothing moves: a phone that had settings keeps them bit for bit. */
    fun fromStores(s: Stores): Set<String> {
        val cam = s.cameraOff.map { camera(it) }
        val implied = if (s.implied) setOf("munkakor.implied") else emptySet()
        return s.general.filter { it != "munkakor.implied" && !(it.startsWith("kamera.") && it.removePrefix("kamera.") in cameraIds) }.toSet() + cam + implied
    }

    fun toStores(flipped: Set<String>): Stores {
        val cam = flipped.filter { it.startsWith("kamera.") && it.removePrefix("kamera.") in cameraIds }.map { it.removePrefix("kamera.") }.toSet()
        return Stores(cam, "munkakor.implied" in flipped,
            flipped.filter { it != "munkakor.implied" && !(it.startsWith("kamera.") && it.removePrefix("kamera.") in cameraIds) }.toSet())
    }

    /** [flipped] with its camera switches replaced by F3's [camOff] (what the old Kamera funkciók list writes). */
    fun withCameraOff(flipped: Set<String>, camOff: Set<String>): Set<String> =
        flipped.filter { !(it.startsWith("kamera.") && it.removePrefix("kamera.") in cameraIds) }.toSet() + camOff.filter { it in cameraIds }.map { camera(it) }

    /** The CameraFeatures off-set the Kamera 2 code reads: every camera switch that is effectively off here. */
    fun cameraOff(flipped: Set<String>): Set<String> = CameraFeatures.ALL.filter { !on(flipped, camera(it.id)) }.map { it.id }.toSet()
}
