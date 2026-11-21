package hu.vrg.mobile.sketch

// Vázlat is a note taker first: a page you can draw on, hold anywhere to write a memo, and tag. Everything else
// comes from PLUGINS, packs of tools for one kind of field work. The tool rail shows the tools of the plugins
// switched on, in order, so a job that only needs a floor sketch keeps four buttons and switching stays one tap.
//
// The packs today: Alaprajz (rooms and sizes), Villany (points, circuits, Elosztó, nyomvonal) and Fotópont (WP M25:
// a point per room, four photos). Fotópont starts switched off; a sketch that needs it turns it on under ⚙. A new pack is one entry here plus its handling in the screen; the sketch file keeps which packs it used.

data class Tool(
    val id: String,
    val glyph: String,
    val label: String,
    /** One line on the canvas while the tool is active. */
    val hint: String,
    /** False while the tool only exists as a plan (its WP not built yet). */
    val built: Boolean = true,
)

data class Plugin(val id: String, val label: String, val blurb: String, val tools: List<Tool>, val wp: String, val built: Boolean = true)

object Tools {
    val SELECT = Tool("select", "✥", "Mozgat", "Húzd a pontot, jegyzetet, címkét vagy szobát. Két ujjal: nagyítás, görgetés.")
    val MEMO = Tool("memo", "✎", "Memó", "Koppints bárhová: memó oda. Bármely elemen tartva: kerék → Memó.")
    val TAG = Tool("tag", "#", "Címke", "Húzz egy címkét a sávból az elemre vagy a lapra; koppintva a kijelölt címke kerül oda.")
    val ROOM = Tool("room", "▭", "Szoba", "Húzz téglalapot: egy szoba. A szomszéd falához ugrik.")
    val TEMPLATE = Tool("template", "⌗", "Sablon", "Válassz alakot lent (L, U, T, fülkés…), és húzd a szoba méretére.")
    val LINE = Tool("line", "⌇", "Vonal", "Koppints sarokról sarokra; az első pontra koppintva szoba lesz. Kész: nyitott vonal.")
    val MEASURE = Tool("measure", "↔", "Méret", "Koppints egy falra: annak hossza. Szoba belsejébe: szélesség × mélység.")
    val POINT = Tool("point", "•", "Pont", "Koppints a fal mellé: szerelési pont a falon. Tartsd: kerék a típushoz.")
    val CIRCUIT = Tool("circuit", "◌", "Áramkör", "Koppints pontokra az aktív körbe, vagy húzz keretet köréjük.")
    val BOARD = Tool("board", "▣", "Elosztó", "Koppints a falra: Elosztó. Bekötés: minden kör a legközelebbi Elosztóra.")
    val ROUTE = Tool("route", "〰", "Nyomvonal", "Húzd végig, merre megy a kábel; a vége pontra vagy Elosztóra ugrik.")
    val PHOTO = Tool("photo", "◉", "Fotópont", "Koppints a szoba közepére: Fotópont. Koppints rá: kamera, utána húzz arra, amerre a kép néz.")

    val ALL = listOf(SELECT, MEMO, TAG, ROOM, TEMPLATE, LINE, MEASURE, POINT, CIRCUIT, BOARD, ROUTE, PHOTO)
    fun of(id: String?) = ALL.firstOrNull { it.id == id }
}

object Plugins {
    /** Always there: the note taker itself. */
    val NOTE = Plugin("jegyzet", "Jegyzet", "Mozgatás, memó, címkék: a vázlat jegyzetfüzet része.", listOf(Tools.SELECT, Tools.MEMO, Tools.TAG), "M24")
    val PLAN = Plugin("alaprajz", "Alaprajz", "Szobák téglalappal vagy vonallal, méretek a falakon.", listOf(Tools.ROOM, Tools.TEMPLATE, Tools.LINE, Tools.MEASURE), "M24")
    val ELECTRIC = Plugin("villany", "Villany", "Szerelési pontok, áramkörök, Elosztó és nyomvonal.", listOf(Tools.POINT, Tools.CIRCUIT, Tools.BOARD, Tools.ROUTE), "M24")
    val PHOTO = Plugin("fotopont", "Fotópont", "Szobánként egy pont, a szoba négy oldala felé egy-egy fotó.", listOf(Tools.PHOTO), "M25")

    val ALL = listOf(NOTE, PLAN, ELECTRIC, PHOTO)
    val DEFAULT_ON = listOf(NOTE.id, PLAN.id, ELECTRIC.id)

    fun of(id: String?) = ALL.firstOrNull { it.id == id }

    /** The rail: the note taker's tools, then each switched-on plugin's, in the catalogue's order; plans left out. */
    fun rail(on: List<String>, order: List<String>? = null): List<Tool> {
        val tools = ALL.filter { it.id == NOTE.id || (it.id in on && it.built) }.flatMap { it.tools }.filter { it.built }
        if (order.isNullOrEmpty()) return tools
        // a variant's order (WP M31): its tools first in its order, the rest after, as they were
        return tools.sortedBy { t -> order.indexOf(t.id).let { if (it < 0) order.size + tools.indexOf(t) else it } }
    }

    /** Switching a plugin; the note taker cannot be switched off. */
    fun toggle(on: List<String>, id: String): List<String> = when {
        id == NOTE.id || of(id)?.built != true -> on
        id in on -> on - id
        else -> ALL.map { it.id }.filter { it in on || it == id }
    }
}

/** Tags: a few presets that mean something in the Planner, and whatever the user adds. */
object Tags {
    val PRESETS: List<Tag> = listOf(
        Tag("T-furdo", "Fürdő", 0xFF2A8CDB, "kind:furdo"),
        Tag("T-konyha", "Konyha", 0xFFE0B020, "kind:konyha"),
        Tag("T-nedves", "Nedves", 0xFF20A8A0, "wet"),
        Tag("T-ip44", "IP44", 0xFF3DAE5A, "ip44"),
        Tag("T-ded", "Dedikált", 0xFFD64545, "dedicated"),
        Tag("T-bontas", "Bontás", 0xFF8A5CD6, "remove"),
        // the Founder, 2026-11-21 (D-72): an existing point to be replaced; the takeoff counts it as csere
        Tag("T-csere", "Csere", 0xFFE8641C, "replace"),
    )
    private val PALETTE = listOf(0xFFE8641C, 0xFFC03FA8, 0xFF5470B0, 0xFF2A8C8C, 0xFFB07A2A, 0xFF7A5CC0)
    fun colorFor(n: Int) = PALETTE[n % PALETTE.size]
}
