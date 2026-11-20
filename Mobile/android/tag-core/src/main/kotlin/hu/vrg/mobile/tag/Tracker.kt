package hu.vrg.mobile.tag

import hu.vrg.mobile.pager.Clutter
import hu.vrg.mobile.pager.Proximity
import hu.vrg.mobile.pager.RssiTrack

// The tag book: every Find My tag the phone hears, and the one the user said is theirs ("Ez az enyém"). Android has
// no key to recognise a tag by, so "mine" is learnt the physical way: the tag held against the phone is the strongest
// signal by a clear margin. After that it is followed by its address; when a rotating tag changes address (about once
// a day away from its owner, every ~15 min near an owning iPhone), the one new tag of the same kind that appears as
// the old address goes quiet is taken as the same tag (relink), marked as a guess until the user rings it.
//
// Anything heard at the same moment as "mine" is certainly not mine; those addresses are remembered (background) and
// never taken by a relink. That is what keeps a neighbour's AirTag on the bus from being adopted.

const val TAG_TX1M = -62                  // a coin-cell tag heard at 1 m; calibrated per tag on the screen
const val BIND_RSSI = -60                 // "held against the phone": stronger than this
const val BIND_MARGIN_DB = 8.0            // and this much stronger than the next tag
const val HEARD_MS = 5_000L               // a tag counts as "here now" for this long after its last advertisement
const val COEXIST_MS = 10_000L            // heard together with mine within this window = not mine
const val RELINK_AFTER_MS = 20_000L       // mine quiet this long: look for its new address
const val FORGET_MS = 10 * 60_000L        // drop other tags not heard for this long

class Seen(val address: String, var ad: FindMyAd, val firstAt: Long) {
    var lastAt: Long = firstAt; private set
    var count: Int = 0; private set
    var uuids: Set<Int> = emptySet(); private set
    val rssi = RssiTrack(windowMs = 3_000, alpha = 0.4)

    fun heard(ad: FindMyAd, uuids: Set<Int>, rssi: Int, now: Long) {
        this.ad = ad; this.uuids = uuids; lastAt = now; count++
        this.rssi.add(rssi, now)
    }

    fun age(now: Long): Long = now - lastAt
    fun distance(tx1m: Int, clutter: Clutter = Clutter.SITE): Double? = rssi.value?.let { Proximity.distance(it, tx1m, clutter) }
}

/** The user's own tag. Plain data, stored with [encode] / [decode]. */
data class Mine(
    val name: String,
    val address: String,
    val type: TagType,
    val kind: AdKind,
    val boundAt: Long,
    val tx1m: Int = TAG_TX1M,
    val battery: Battery = Battery.UNKNOWN,
    val sound: SoundProtocol? = null,
    val pastAddresses: List<String> = emptyList(),
    /** True after a relink until the user confirms it (by ringing it or by "Igen, ez az"). */
    val guessed: Boolean = false,
    val lastSeenAt: Long = 0,
    val lastLat: Double? = null,
    val lastLon: Double? = null,
    val lastAccM: Float? = null,
) {
    val rotates: Boolean get() = kind == AdKind.SEPARATED || kind == AdKind.NEAR_OWNER

    fun encode(): String = listOfNotNull(
        "v=1",
        "name=" + name.replace('\n', ' ').trim(),
        "address=$address", "type=${type.name}", "kind=${kind.name}", "boundAt=$boundAt", "tx1m=$tx1m",
        "battery=${battery.name}", sound?.let { "sound=${it.name}" },
        pastAddresses.takeIf { it.isNotEmpty() }?.let { "past=" + it.joinToString(",") },
        "guessed=$guessed", "lastSeenAt=$lastSeenAt",
        lastLat?.let { "lat=$it" }, lastLon?.let { "lon=$it" }, lastAccM?.let { "acc=$it" },
    ).joinToString("\n")

    companion object {
        fun decode(s: String?): Mine? {
            if (s.isNullOrBlank()) return null
            val m = s.lines().mapNotNull { l -> l.indexOf('=').takeIf { it > 0 }?.let { l.substring(0, it) to l.substring(it + 1) } }.toMap()
            val address = m["address"]?.takeIf { FindMy.addressBytes(it) != null } ?: return null
            return Mine(
                name = m["name"]?.ifBlank { null } ?: "Címke",
                address = address,
                type = runCatching { TagType.valueOf(m["type"]!!) }.getOrDefault(TagType.UNKNOWN),
                kind = runCatching { AdKind.valueOf(m["kind"]!!) }.getOrDefault(AdKind.SEPARATED),
                boundAt = m["boundAt"]?.toLongOrNull() ?: 0,
                tx1m = m["tx1m"]?.toIntOrNull()?.takeIf { it in -100..-20 } ?: TAG_TX1M,
                battery = runCatching { Battery.valueOf(m["battery"]!!) }.getOrDefault(Battery.UNKNOWN),
                sound = SoundProtocol.byName(m["sound"]),
                pastAddresses = m["past"]?.split(",")?.filter { FindMy.addressBytes(it) != null } ?: emptyList(),
                guessed = m["guessed"] == "true",
                lastSeenAt = m["lastSeenAt"]?.toLongOrNull() ?: 0,
                lastLat = m["lat"]?.toDoubleOrNull(),
                lastLon = m["lon"]?.toDoubleOrNull(),
                lastAccM = m["acc"]?.toFloatOrNull(),
            )
        }
    }
}

/** The outcome of "Ez az enyém" (bind by holding the tag to the phone). */
sealed class BindPick {
    data object None : BindPick()
    /** The strongest is not close enough: hold it against the phone. */
    data class TooFar(val best: Seen) : BindPick()
    /** Two tags are about as close: move the other one away. */
    data class Ambiguous(val a: Seen, val b: Seen) : BindPick()
    data class Ok(val seen: Seen) : BindPick()
}

class TagBook {
    private val seen = LinkedHashMap<String, Seen>()
    private val background = LinkedHashSet<String>()

    var mine: Mine? = null
        private set

    /** Set when a relink moved [mine] to a new address; the screen shows it once. */
    var lastRelink: Pair<String, String>? = null
        private set

    fun load(m: Mine?) { mine = m; lastRelink = null }

    /** One advertisement. Returns what it was, or null if it is not a Find My tag. */
    fun heard(address: String, raw: ByteArray, rssi: Int, now: Long): Seen? {
        val ad = FindMy.parse(raw, address) ?: return null
        val uuids = FindMy.uuid16s(raw)
        val s = seen.getOrPut(address) { Seen(address, ad, now) }
        s.heard(ad, uuids, rssi, now)

        // Proof of "not mine" is another address heard *before* a later advertisement of mine. A new address that
        // only follows mine's last one is not proof: that is exactly what an address rotation looks like.
        val m = mine
        if (m != null && address == m.address) {
            mine = m.copy(lastSeenAt = now, battery = ad.battery.takeIf { it != Battery.UNKNOWN } ?: m.battery)
            seen.values.filter { it.address != address && it.age(now) <= COEXIST_MS }.forEach { noteBackground(it.address) }
        }
        return s
    }

    /** Tags heard recently, nearest first. */
    fun around(now: Long): List<Seen> =
        seen.values.filter { it.age(now) <= FORGET_MS }.sortedWith(compareByDescending<Seen> { it.age(now) <= HEARD_MS }
            .thenByDescending { it.rssi.value ?: -200.0 })

    fun get(address: String): Seen? = seen[address]
    fun mineSeen(): Seen? = mine?.let { seen[it.address] }
    fun isBackground(address: String): Boolean = address in background

    /** Who would "Ez az enyém" take right now. */
    fun bindPick(now: Long): BindPick {
        val here = seen.values.filter { it.age(now) <= HEARD_MS && it.rssi.value != null && it.address !in background }
            .sortedByDescending { it.rssi.value!! }
        val best = here.firstOrNull() ?: return BindPick.None
        if (best.rssi.value!! < BIND_RSSI || best.count < 3) return BindPick.TooFar(best)
        val second = here.getOrNull(1)
        if (second != null && best.rssi.value!! - second.rssi.value!! < BIND_MARGIN_DB) return BindPick.Ambiguous(best, second)
        return BindPick.Ok(best)
    }

    /** Takes [s] as mine. Every other tag heard now goes to the background: it is certainly not this one. */
    fun bind(s: Seen, name: String, now: Long): Mine {
        background.clear()
        seen.values.filter { it.address != s.address && it.age(now) <= COEXIST_MS }.forEach { noteBackground(it.address) }
        val m = Mine(name.trim().ifBlank { "Címke" }, s.address, s.ad.type, s.ad.kind, now,
            battery = s.ad.battery, lastSeenAt = s.lastAt)
        mine = m; lastRelink = null
        return m
    }

    fun forget() { mine = null; background.clear(); lastRelink = null }

    fun update(f: (Mine) -> Mine) { mine = mine?.let(f) }

    /** The user rang it, or said "Igen, ez az": the relink is no longer a guess. */
    fun confirm() { mine = mine?.copy(guessed = false); lastRelink = null }

    /**
     * Mine has gone quiet: is there exactly one new tag that could be it after an address change? It must be heard
     * now, of the same type, not one of its old addresses, never heard together with it, first heard around or after
     * the moment it went quiet, and with the same battery level if both are known.
     */
    fun relinkCandidate(now: Long): Seen? {
        val m = mine ?: return null
        if (!m.rotates || now - m.lastSeenAt < RELINK_AFTER_MS) return null
        val c = seen.values.filter { s ->
            s.address != m.address && s.address !in m.pastAddresses && s.address !in background &&
                s.age(now) <= HEARD_MS &&
                (s.ad.kind == AdKind.SEPARATED || s.ad.kind == AdKind.NEAR_OWNER) &&
                (m.type == TagType.UNKNOWN || s.ad.type == m.type) &&
                s.firstAt >= m.lastSeenAt - COEXIST_MS &&
                (m.battery == Battery.UNKNOWN || s.ad.battery == Battery.UNKNOWN || s.ad.battery == m.battery)
        }
        return c.singleOrNull()
    }

    /** Applies [relinkCandidate]; returns true if mine moved to a new address. */
    fun relink(now: Long): Boolean {
        val m = mine ?: return false
        val c = relinkCandidate(now) ?: return false
        mine = m.copy(address = c.address, kind = c.ad.kind, guessed = true, lastSeenAt = c.lastAt,
            pastAddresses = (listOf(m.address) + m.pastAddresses).distinct().take(10))
        lastRelink = m.address to c.address
        return true
    }

    /** Forget other tags not heard for a while (mine stays). */
    fun prune(now: Long) {
        val keep = mine?.address
        seen.entries.removeAll { (a, s) -> a != keep && s.age(now) > FORGET_MS }
    }

    private fun noteBackground(address: String) {
        background.remove(address); background.add(address)
        while (background.size > 500) background.remove(background.first())
    }
}

/** Ottfelejtve (left behind): rings once when mine has not been heard for [afterMs], and once when it is back. */
class LeftBehind(var afterMs: Long = 90_000) {
    enum class State(val hu: String) { OFF("kikapcsolva"), WITH_ME("velem van"), MISSING("lemaradt") }
    enum class Event { LEFT, BACK }

    var state: State = State.OFF; private set
    private var armedAt = 0L

    fun arm(now: Long) { state = State.WITH_ME; armedAt = now }
    fun disarm() { state = State.OFF }

    /** Call on every scan round with the last time mine was heard (0 = never). */
    fun tick(lastHeardAt: Long, now: Long): Event? {
        if (state == State.OFF) return null
        val quiet = now - maxOf(lastHeardAt, armedAt)
        return when {
            state == State.WITH_ME && quiet >= afterMs -> { state = State.MISSING; Event.LEFT }
            state == State.MISSING && lastHeardAt > armedAt && now - lastHeardAt < HEARD_MS -> { state = State.WITH_ME; Event.BACK }
            else -> null
        }
    }

    companion object {
        /** The choices offered on the screen, in seconds. */
        val CHOICES = listOf(30, 60, 90, 180, 300)
    }
}

object TagText {
    /** "most", "12 mp", "4 perce", "2 órája", "3 napja". */
    fun ago(ms: Long): String = when {
        ms < 5_000 -> "most"
        ms < 60_000 -> "${ms / 1000} mp"
        ms < 3_600_000 -> "${ms / 60_000} perce"
        ms < 86_400_000 -> "${ms / 3_600_000} órája"
        else -> "${ms / 86_400_000} napja"
    }

    fun bindHint(p: BindPick, tx1m: Int = TAG_TX1M): String = when (p) {
        BindPick.None -> "Nem hallok Find My címkét. Nyomd meg a címke gombját, vagy várj fél percet."
        is BindPick.TooFar -> "A legközelebbi ${Proximity.label(p.best.distance(tx1m))}: tartsd a címkét a telefon hátához."
        is BindPick.Ambiguous -> "Két címke is ugyanolyan közel van: vidd távolabb a másikat."
        is BindPick.Ok -> "Megvan: ${p.seen.ad.type.hu}, ${p.seen.ad.kind.hu}."
    }
}
