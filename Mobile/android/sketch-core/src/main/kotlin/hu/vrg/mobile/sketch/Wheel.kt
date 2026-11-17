package hu.vrg.mobile.sketch

import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.roundToInt

// The hold wheel. Holding anything on the sketch opens an 8-sector wheel under the finger; sliding the finger
// toward a sector and letting go picks it. The geometry is the Planner's room-type wheel (08f-wf-wheel.js):
// sector 0 is North, clockwise, and South (4) moves to the next ring (on the last ring it goes back). Holding on
// empty paper opens the paper's wheel, so a memo can go anywhere.

data class WheelItem(val id: String, val label: String, val glyph: String, val color: Long? = null)

/** [rings] each have 8 slots (null = empty sector). */
data class Wheel(val title: String, val target: String?, val rings: List<List<WheelItem?>>)

/** The Planner's room kinds (05t-needs.js NEED_KINDS + the WP-R1 extras), in its wheel's ring order. */
object RoomKinds {
    val LABEL = linkedMapOf(
        "nappali" to "Nappali", "konyha" to "Konyha", "halo" to "Háló / szoba", "furdo" to "Fürdő",
        "wc" to "WC", "eloszoba" to "Előszoba", "kozlekedo" to "Közlekedő", "etkezo" to "Étkező",
        "dolgozo" to "Dolgozó", "kamra" to "Kamra / tároló", "gepeszet" to "Gépészet / garázs", "gyerek" to "Gyerekszoba",
        "gardrob" to "Gardrób", "mosokonyha" to "Mosókonyha", "kulter" to "Terasz / erkély", "egyeb" to "Egyéb",
    )
    val GLYPH = mapOf(
        "nappali" to "🛋", "konyha" to "🍳", "halo" to "🛏", "furdo" to "🛁", "wc" to "🚽", "eloszoba" to "🚪",
        "kozlekedo" to "↔", "etkezo" to "🍽", "dolgozo" to "💻", "kamra" to "📦", "gepeszet" to "⚙", "gyerek" to "🧸",
        "gardrob" to "👕", "mosokonyha" to "🧺", "kulter" to "🌿", "egyeb" to "…",
    )
    /** The Planner's RW_RINGS: ">" = next ring, "<" = back. */
    val RINGS = listOf(
        listOf("nappali", "konyha", "halo", "furdo", ">", "wc", "eloszoba", "kozlekedo"),
        listOf("etkezo", "dolgozo", "kamra", "gepeszet", ">", "gyerek", "gardrob", "mosokonyha"),
        listOf("kulter", "egyeb", null, null, "<", null, null, null),
    )

    fun label(k: String) = LABEL[k] ?: k
    /** An unnamed room reads as its kinds, as in the Planner (nameAuto). */
    fun autoName(kinds: List<String>) = kinds.joinToString(" + ") { label(it) }
}

object Wheels {
    const val SECTORS = 8
    const val MORE = "more"
    const val BACK = "back"

    /** The sector under a finger at (dx, dy) from the wheel's centre (screen px, y down); null inside the hub. */
    fun sectorAt(dx: Double, dy: Double, hub: Double, n: Int = SECTORS): Int? {
        if (hypot(dx, dy) < hub) return null
        var a = atan2(dy, dx) + PI / 2
        a = (a + 2 * PI) % (2 * PI)
        return (a / (2 * PI / n)).roundToInt() % n
    }

    /** The direction of sector [i] as a unit vector (for drawing). */
    fun dirOf(i: Int, n: Int = SECTORS): Pair<Double, Double> {
        val a = i * 2 * PI / n - PI / 2
        return Math.cos(a) to Math.sin(a)
    }

    private fun more() = WheelItem(MORE, "Tovább", "›")
    private fun back() = WheelItem(BACK, "Vissza", "‹")
    private val MEMO = WheelItem("memo", "Memó", "✎")
    private val TAG = WheelItem("tag", "Címke", "#")
    private val DEL = WheelItem("del", "Törlés", "✕", 0xFFD64545)

    private fun type(t: PointType) = WheelItem("type:" + t.id, t.label, t.glyph)

    /** An installation point: its type, its state, memo, tag, circuit, delete. */
    fun forPoint(p: SketchPoint): Wheel {
        val st = WheelItem("state", p.state.other().label, if (p.state == PointState.EXISTING) "○" else "●")
        return Wheel(
            p.type.label, p.id,
            listOf(
                listOf(type(PointType.SOCKET), type(PointType.SWITCH), type(PointType.LIGHT), type(PointType.JUNCTION), more(), MEMO, st, DEL),
                listOf(type(PointType.DATA), type(PointType.FIXED), type(PointType.SENSOR), type(PointType.BOARD), back(), TAG,
                    WheelItem("circuit", "Áramkörbe", "◌"), type(PointType.POINT)),
            ),
        )
    }

    /** A room: name, sizes, memo, tag, then its kinds over three rings (the Planner's room-type wheel). */
    fun forRoom(r: Room): Wheel {
        val actions = listOf(
            WheelItem("name", "Név", "Aa"), WheelItem("measure", "Méret", "↔"), MEMO, TAG,
            WheelItem(MORE, "Típus", "›"), WheelItem("points", "Pontjai körbe", "◌"), DEL, null,
        )
        val kinds = RoomKinds.RINGS.map { ring ->
            ring.map { k ->
                when (k) {
                    null -> null
                    ">" -> more()
                    "<" -> back()
                    else -> WheelItem("kind:$k", RoomKinds.label(k), RoomKinds.GLYPH[k] ?: "•")
                }
            }
        }
        return Wheel(r.name.ifEmpty { RoomKinds.autoName(r.kinds).ifEmpty { "Szoba" } }, r.id, listOf(actions) + kinds)
    }

    /** A wall edge of a room: its size, a point on it, the room's own wheel items. */
    fun forEdge(r: Room, edge: Int): Wheel = Wheel(
        "Fal", r.id + "#" + edge,
        listOf(listOf(
            WheelItem("measure-edge", "Hossza", "↔"), WheelItem("point-here", "Pont ide", "•"), MEMO, TAG,
            null, WheelItem("board-here", "Elosztó ide", "▣"), WheelItem("room", "Szoba", "▭"), null,
        )),
    )

    /**
     * A photo point (WP M25): its four sides at the wheel's four sides (É up, K right, D down, Ny left): picking a side
     * with a photo shows it, one without opens the camera for that side. One ring, so South is a side here, not a ring.
     */
    fun forPhoto(p: PhotoPoint): Wheel {
        fun side(d: Int) = WheelItem("shot:$d", Photos.label(d) + if (Photos.shot(p, d) != null) " ✓" else " +",
            if (Photos.shot(p, d) != null) "▣" else "◉")
        return Wheel("Fotópont ${p.shots.size}/4", p.id, listOf(listOf(side(0), MEMO, side(90), TAG, side(180), DEL, side(270), null)))
    }

    /** Memos, routes, lines, loose tags, circuits: memo, tag, delete (and edit for a memo). */
    fun forOther(title: String, target: String, editable: Boolean = false): Wheel = Wheel(
        title, target,
        listOf(listOf(if (editable) WheelItem("edit", "Szerkesztés", "✎") else MEMO, TAG, null, null, null, null, DEL, null)),
    )

    /** Empty paper: a memo here, a loose tag, a point. */
    fun forPaper(): Wheel = Wheel(
        "Lap", null,
        listOf(listOf(MEMO, TAG, WheelItem("point-here", "Pont ide", "•"), null, null, null, null, null)),
    )

    /** The ring after picking [item] on [ring], or null when the item is an action, not a ring switch. */
    fun nextRing(w: Wheel, ring: Int, item: WheelItem): Int? = when (item.id) {
        MORE -> (ring + 1).coerceAtMost(w.rings.size - 1)
        BACK -> 0
        else -> null
    }
}
