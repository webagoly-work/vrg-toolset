package hu.vrg.mobile.pager

import org.json.JSONArray
import org.json.JSONObject

// The Csipogó engine: one phone's pager, as plain logic. Android feeds it what the radio heard (advertisements,
// link messages), what the sensors read and the time; it answers with the beacon to put on the air and a list of
// effects (buzz, sound, notify, send on the link). Nothing here touches Android, so PagerEngineTest runs a whole
// crew of simulated phones exchanging beacons on the JVM.
//
// Delivery follows the pager: every message is acknowledged by the receiving *device* (GOTIT — the builder's
// green), and separately by the *person* pressing SEEN (blue); no GOTIT within the window is "NO REPLY" (red).

data class Me(val unit: Int, val name: String, val crew: Crew, val tx1m: Int = Proximity.DEFAULT_TX1M)

enum class SendStatus(val hu: String) {
    SENDING("küldés…"),
    DELIVERED("megkapta ✓"),
    PARTIAL("részben ✓"),
    NO_REPLY("nincs válasz ✗"),
    SEEN("LÁTTA ✓✓"),
}

enum class Sound { PAGE, URGENT, ALARM, CALL, CHIRP, OK, FAIL }

sealed class Effect {
    data class Haptic(val pattern: LongArray, val repeat: Boolean = false) : Effect()
    data class Tone(val sound: Sound) : Effect()
    /** Stop a repeating haptic / ringing (call ended, SEEN pressed). */
    data object Quiet : Effect()
    data class Notify(val key: String, val title: String, val text: String, val urgent: Boolean) : Effect()
    data class ClearNotify(val key: String) : Effect()
    /** Send on the link: to one unit, or to every open link when [to] is null. */
    data class Send(val msg: LinkMsg, val to: Int? = null) : Effect()
    data class Banner(val text: String) : Effect()
}

data class LogLine(val at: Long, val text: String, val bad: Boolean = false)

class Peer(val unit: Int) {
    var name = "Egység $unit"
    val rssi = RssiTrack()
    var battery = 255
    var flags = 0
    var tx1m = Proximity.DEFAULT_TX1M
    var psm = 0
    var lastSeen = 0L
    var relayedOnlyAt = 0L
    var linked = false
    var guard = 0
}

data class PeerView(
    val unit: Int, val name: String, val distanceM: Double?, val zone: Zone, val trend: Trend, val rssi: Int?,
    val battery: Int?, val linked: Boolean, val talking: Boolean, val armed: Boolean, val alarm: Boolean,
    val ageMs: Long, val viaRelay: Boolean,
)

class Outgoing(val frame: Frame, val at: Long, val expect: Set<Int>, var until: Long) {
    val acked = linkedSetOf<Int>()
    val seenBy = linkedSetOf<Int>()
    var status = SendStatus.SENDING
    var resolvedAt = 0L
    val label: String get() = when (frame.ptype) {
        PType.TEXTMSG -> Messages.label(frame.arg)
        PType.ALARM -> "RIASZTÁS: ${AlarmReason.of(frame.arg)?.hu ?: frame.arg}"
        else -> frame.ptype?.label ?: "?"
    }
}

data class Incoming(val frame: Frame, val at: Long, val relayed: Boolean, var seen: Boolean = false) {
    val label: String get() = when (frame.ptype) {
        PType.TEXTMSG -> Messages.label(frame.arg)
        PType.ALARM -> "RIASZTÁS: ${AlarmReason.of(frame.arg)?.hu ?: frame.arg}"
        PType.HOLD -> "HÍVÁS"
        else -> frame.ptype?.label ?: "?"
    }
}

data class ChatEntry(val src: Int, val dst: Int, val seq: Int, val at: Long, val text: String, val mine: Boolean) {
    val acked = linkedSetOf<Int>()
    val key: Long get() = (src.toLong() shl 16) or seq.toLong()

    fun toJson(): JSONObject = JSONObject().put("src", src).put("dst", dst).put("seq", seq).put("at", at)
        .put("text", text).put("mine", mine).put("acked", JSONArray(acked.toList()))

    companion object {
        fun fromJson(o: JSONObject): ChatEntry = ChatEntry(o.getInt("src"), o.getInt("dst"), o.getInt("seq"), o.getLong("at"),
            o.getString("text"), o.optBoolean("mine")).also { e ->
            o.optJSONArray("acked")?.let { a -> for (i in 0 until a.length()) e.acked += a.getInt(i) }
        }
    }
}

class PagerEngine(me: Me) {
    var me: Me = me; private set
    var clutter = Clutter.SITE
    /** T2 Stair Node: repeat every crew event, not only the weakly heard ones. */
    var repeater = false
    var battery = 255
    var talking = false
    var psm = 0

    private val peers = linkedMapOf<Int, Peer>()
    private val calibration = mutableMapOf<Int, Int>()
    private val outgoing = ArrayList<Outgoing>()
    private val relays = ArrayList<Outgoing>()
    private val acks = ArrayList<Triple<Int, Int, Long>>()          // (src, seq, until)
    private val incoming = ArrayList<Incoming>()
    private val seenKeys = LinkedHashMap<Long, Long>()               // frame key → when
    private val chats = ArrayList<ChatEntry>()
    private val chatKeys = LinkedHashMap<Long, Long>()
    private val calling = mutableMapOf<Int, Long>()                  // src → until
    private val alarmMuted = mutableMapOf<Int, Long>()
    private val log = ArrayList<LogLine>()
    private val effects = ArrayList<Effect>()
    private val rollCall = linkedMapOf<Int, Int>()
    private var rollCallUntil = 0L
    private var seq = 0
    private var chatSeq = 0
    private var holdOut: Outgoing? = null
    private var holdLinkAt = 0L
    private var lowBatterySent = false
    var otherCrews = 0; private set
    var staleBeacons = 0; private set
    var unitClash = false; private set

    val guard = Guard()
    val manDown = ManDown()
    var manDownLeft = 0; private set

    // ---- identity ----------------------------------------------------------------------------------------------

    @Synchronized fun setMe(m: Me) {
        val crewChanged = m.crew.id != me.crew.id || m.crew.code != me.crew.code
        me = m
        if (crewChanged) { peers.clear(); outgoing.clear(); relays.clear(); acks.clear(); calling.clear() }
        unitClash = false
    }

    @Synchronized fun setCalibration(unit: Int, tx1m: Int?) { if (tx1m == null) calibration.remove(unit) else calibration[unit] = tx1m }
    @Synchronized fun calibrations(): Map<Int, Int> = calibration.toMap()

    // ---- what goes on the air ---------------------------------------------------------------------------------

    private fun flags(): Int =
        (if (psm > 0) Flags.LINK else 0) or (if (talking) Flags.TALK else 0) or
            (if (guard.state in setOf(GuardState.EXIT, GuardState.ARMED, GuardState.ENTRY)) Flags.ARMED else 0) or
            (if (guard.state == GuardState.ALARM || manDown.state == ManDownState.ALARM) Flags.ALARM else 0)

    /** The advertisement payload for now. Events and acks take turns, [SLOT_MS] each. */
    @Synchronized fun beacon(now: Long): ByteArray {
        val slot = (now / SLOT_MS).toInt()
        val live = (outgoing.filter { it.until > now && it.status == SendStatus.SENDING || it === holdOut && it.until > now } +
            relays.filter { it.until > now }).distinct()
        val frame = if (live.isEmpty()) Frame(PType.IDLE.code, 0, me.unit, BROADCAST, 0, 0, me.crew.id) else live[slot % live.size].frame
        val ackLive = acks.filter { it.third > now }
        val ack = if (ackLive.isEmpty()) null else ackLive[slot % ackLive.size]
        return Beacon(flags(), me.unit, frame, battery, me.tx1m, psm, ack?.first ?: 0, ack?.second ?: 0, Beacon.minuteOf(now)).encode(me.crew)
    }

    @Synchronized fun nameRecord(): ByteArray = NameRecord.encode(me.unit, me.name)

    // ---- sending ------------------------------------------------------------------------------------------------

    private fun nextSeq(): Int { seq = seq % 255 + 1; return seq }

    private fun present(now: Long): Set<Int> = peers.values.filter { now - it.lastSeen < Proximity.LOST_MS }.map { it.unit }.toSet()

    private fun emit(type: PType, arg: Int, dst: Int, now: Long, track: Boolean = true, windowMs: Long = SEND_WINDOW_MS): Outgoing {
        val f = Frame(type.code, arg, me.unit, dst, nextSeq(), MAX_TTL, me.crew.id)
        val expect = if (dst == BROADCAST) present(now) else setOf(dst)
        val o = Outgoing(f, now, if (track) expect else emptySet(), now + windowMs)
        if (!track) o.status = SendStatus.DELIVERED
        if (track) outgoing += o else relays += o
        while (outgoing.size > 40) outgoing.removeAt(0)
        effects += Effect.Send(LinkMsg.FrameMsg(f), if (dst == BROADCAST) null else dst)
        return o
    }

    @Synchronized fun sendMessage(code: Int, dst: Int, now: Long): Outgoing {
        val o = emit(PType.TEXTMSG, code, dst, now)
        note(now, "→ ${who(dst)}: ${Messages.label(code)}")
        return o
    }

    @Synchronized fun ping(dst: Int, now: Long): Outgoing { note(now, "→ ${who(dst)}: link teszt"); return emit(PType.PING, 0, dst, now) }

    @Synchronized fun rollCall(now: Long): Outgoing {
        rollCall.clear(); rollCallUntil = now + 10_000
        note(now, "Névsorolvasás")
        return emit(PType.ROLLCALL, 0, BROADCAST, now)
    }

    /** CALL pressed: the partner buzzes while it is held. */
    @Synchronized fun holdStart(dst: Int, now: Long) {
        if (holdOut != null) return
        holdOut = emit(PType.HOLD, 1, dst, now, windowMs = Long.MAX_VALUE / 4)
        holdLinkAt = now
        note(now, "HÍVÁS → ${who(dst)}")
    }

    @Synchronized fun holdStop(now: Long) {
        val h = holdOut ?: return
        holdOut = null
        h.until = now
        if (h.status == SendStatus.SENDING) resolve(h, now)
        effects += Effect.Send(LinkMsg.FrameMsg(h.frame.copy(arg = 0)), if (h.frame.dst == BROADCAST) null else h.frame.dst)
    }

    /** SEEN: acknowledges the newest message, call or alarm not yet seen; cancels a man-down pre-alarm. */
    @Synchronized fun seen(now: Long): String {
        effects += Effect.Quiet
        if (manDown.state == ManDownState.PRE_ALARM || manDown.state == ManDownState.ALARM) {
            val crewKnew = manDown.state == ManDownState.ALARM
            onManDown(manDown.cancel(now), now); note(now, "Mozdulatlanság riasztás visszavonva (LÁTTAM)")
            if (crewKnew) emit(PType.SEEN, 0, BROADCAST, now)
            return "Rendben vagy: visszavonva"
        }
        val inc = incoming.lastOrNull { !it.seen && needsSeen(it.frame) }
        if (inc == null) { emit(PType.SEEN, 0, BROADCAST, now); return "LÁTTAM → mindenki" }
        inc.seen = true
        alarmMuted[inc.frame.src] = now + 120_000
        emit(PType.SEEN, inc.frame.seq, inc.frame.src, now)
        effects += Effect.ClearNotify(notifyKey(inc.frame))
        note(now, "LÁTTAM → ${who(inc.frame.src)}: ${inc.label}")
        return "LÁTTAM → ${who(inc.frame.src)}"
    }

    @Synchronized fun sos(now: Long) { note(now, "VÉSZJELZÉS", bad = true); emit(PType.ALARM, AlarmReason.SOS.code, BROADCAST, now) }

    @Synchronized fun chat(text: String, dst: Int, now: Long): ChatEntry? {
        val t = text.trim()
        if (t.isEmpty()) return null
        chatSeq = chatSeq % 65_535 + 1
        val e = ChatEntry(me.unit, dst, chatSeq, now, t, mine = true)
        chats += e; chatKeys[e.key] = now; trimChats()
        effects += Effect.Send(LinkMsg.Chat(me.unit, dst, e.seq, CHAT_TTL, now, t))
        return e
    }

    // ---- guard and man-down ----------------------------------------------------------------------------------

    @Synchronized fun guardArm(now: Long) = onGuard(guard.arm(now), now)
    @Synchronized fun guardDisarm(now: Long) = onGuard(guard.disarm(byPartner = false), now)
    /** Arm or disarm a crew member's phone (HUBCMD target 4, as the pager's DISARM / ARM PARTNER). */
    @Synchronized fun remoteGuard(dst: Int, on: Boolean, now: Long) = emit(PType.HUBCMD, (4 shl 4) or (if (on) 1 else 0), dst, now)
    @Synchronized fun setManDown(on: Boolean, now: Long) = onManDown(if (on) manDown.start(now) else manDown.stop(), now)

    @Synchronized fun sensor(a: Accel, now: Long) { onGuard(guard.sample(a, now), now); onManDown(manDown.sample(a, now), now) }

    private fun onGuard(outs: List<Guard.Out>, now: Long) {
        for (o in outs) when (o) {
            is Guard.Out.State -> {
                note(now, "Őrzés: ${o.s.hu}", bad = o.s == GuardState.ALARM)
                val code = when (o.s) { GuardState.OFF -> 0; GuardState.EXIT -> 1; GuardState.ARMED -> 2; GuardState.ENTRY -> 3; GuardState.ALARM -> 3 }
                if (o.s != GuardState.ALARM) emit(PType.ARMSTATE, code, BROADCAST, now, track = false, windowMs = 3_000)
                if (o.s == GuardState.ALARM) { effects += Effect.Haptic(Haptics.ALARM, repeat = true); effects += Effect.Tone(Sound.ALARM) }
                if (o.s == GuardState.OFF) effects += Effect.Quiet
            }
            is Guard.Out.Page -> emit(PType.ALARM, o.reason.code, BROADCAST, now, windowMs = 1_900)
            Guard.Out.Chirp -> effects += Effect.Tone(Sound.CHIRP)
            is Guard.Out.Refused -> { note(now, o.why, bad = true); effects += Effect.Banner(o.why); effects += Effect.Haptic(Haptics.NO_REPLY) }
        }
    }

    private fun onManDown(outs: List<ManDown.Out>, now: Long) {
        for (o in outs) when (o) {
            is ManDown.Out.State -> when (o.s) {
                ManDownState.PRE_ALARM -> { note(now, "Mozdulatlanság: előriasztás", bad = true); effects += Effect.Haptic(Haptics.ALARM, repeat = true); effects += Effect.Tone(Sound.URGENT)
                    effects += Effect.Notify("mandown", "Minden rendben?", "Nyomd meg a LÁTTAM gombot, különben a csapat riasztást kap.", urgent = true) }
                ManDownState.ALARM -> { note(now, "Mozdulatlanság: RIASZTÁS a csapatnak", bad = true) }
                ManDownState.WATCHING -> { manDownLeft = 0; effects += Effect.Quiet; effects += Effect.ClearNotify("mandown") }
                ManDownState.OFF -> { manDownLeft = 0 }
            }
            is ManDown.Out.Countdown -> manDownLeft = o.secondsLeft
            ManDown.Out.Page -> emit(PType.ALARM, AlarmReason.MAN_DOWN.code, BROADCAST, now, windowMs = 1_900)
        }
    }

    // ---- receiving ----------------------------------------------------------------------------------------------

    /** Raw advertisement + scan response bytes, as Android's ScanRecord.getBytes() gives them. */
    /** Returns the crew unit that sent it, or null (not ours, another crew, stale). */
    @Synchronized fun onAdvert(raw: ByteArray, rssi: Int, now: Long): Int? {
        var beaconUnit: Int? = null
        var name: Pair<Int, String>? = null
        for (m in AdParser.manufacturer(raw)) {
            if (m.size >= 2 && m[0] == 'V'.code.toByte() && m[1] == 'N'.code.toByte()) name = NameRecord.decode(m)
            else beaconUnit = onBeacon(m, rssi, now) ?: beaconUnit
        }
        val n = name
        if (n != null && beaconUnit == n.first) peers[n.first]?.name = n.second.ifBlank { "Egység ${n.first}" }
        return beaconUnit
    }

    /** One beacon payload; returns the sending unit when it was a valid crew beacon. */
    @Synchronized fun onBeacon(payload: ByteArray, rssi: Int, now: Long): Int? {
        val b = when (val r = Beacon.decode(payload, me.crew, now)) {
            is Beacon.Companion.Result.Ok -> r.beacon
            Beacon.Companion.Result.OtherCrew -> { otherCrews++; return null }
            Beacon.Companion.Result.Stale -> { staleBeacons++; return null }
            Beacon.Companion.Result.NotOurs -> return null
        }
        if (b.txUnit == me.unit) { if (!unitClash) note(now, "Egy másik telefon is a(z) ${me.unit}. egységszámot használja!", bad = true); unitClash = true; return null }
        if (b.txUnit !in 1..MAX_UNIT) return null
        val p = peers.getOrPut(b.txUnit) { Peer(b.txUnit).also { note(now, "Megjelent: egység ${b.txUnit}") } }
        p.rssi.add(rssi, now); p.lastSeen = now; p.battery = b.battery; p.flags = b.flags; p.tx1m = b.tx1m; p.psm = b.psm
        if (b.ackSrc == me.unit) ackFrom(b.txUnit, b.ackSeq, now)
        if (b.frame.type != PType.IDLE.code) frame(b.frame, now, viaLink = false, rssi = rssi)
        return b.txUnit
    }

    /** A message on a trusted link from [from]. */
    @Synchronized fun onLink(m: LinkMsg, from: Int, now: Long) {
        peers[from]?.let { it.lastSeen = maxOf(it.lastSeen, now) }
        when (m) {
            is LinkMsg.FrameMsg -> if (m.frame.crew == me.crew.id) frame(m.frame, now, viaLink = true, rssi = null)
            is LinkMsg.Chat -> onChat(m, from, now)
            is LinkMsg.ChatAck -> {
                val k = (m.src.toLong() shl 16) or m.seq.toLong()
                chats.firstOrNull { it.key == k }?.acked?.add(m.from)
                val ak = (m.from.toLong() shl 32) or k
                if (m.src != me.unit && chatKeys.put(-1 - ak, now) == null) effects += Effect.Send(m)   // pass it on, once
            }
            else -> {}
        }
    }

    @Synchronized fun linkUp(unit: Int, name: String, now: Long) {
        val p = peers.getOrPut(unit) { Peer(unit) }
        p.linked = true; p.lastSeen = now
        if (name.isNotBlank()) p.name = name
        note(now, "Kapcsolat: ${p.name}")
        // store and forward: my chats from the last hour that this unit has not acknowledged
        chats.filter { it.mine && now - it.at < 3_600_000 && unit !in it.acked && (it.dst == BROADCAST || it.dst == unit) }
            .forEach { effects += Effect.Send(LinkMsg.Chat(it.src, it.dst, it.seq, CHAT_TTL, it.at, it.text), unit) }
    }

    @Synchronized fun linkDown(unit: Int, now: Long) { peers[unit]?.let { if (it.linked) note(now, "Kapcsolat bontva: ${it.name}"); it.linked = false } }

    private fun onChat(m: LinkMsg.Chat, from: Int, now: Long) {
        if (chatKeys.containsKey(m.key) || m.src == me.unit) return
        chatKeys[m.key] = now
        if (m.ttl > 0) effects += Effect.Send(m.copy(ttl = m.ttl - 1))      // the link mesh: on to every link; each drops dupes
        if (m.dst != BROADCAST && m.dst != me.unit) return
        val e = ChatEntry(m.src, m.dst, m.seq, m.at, m.text, mine = false)
        chats += e; trimChats()
        effects += Effect.Send(LinkMsg.ChatAck(me.unit, m.src, m.seq))
        effects += Effect.Haptic(Haptics.DELIVERED)
        effects += Effect.Notify("chat", "${who(m.src)} írt", m.text, urgent = false)
    }

    private fun needsAck(f: Frame) = f.ptype in ACKED
    private fun needsSeen(f: Frame) = f.ptype == PType.TEXTMSG || f.ptype == PType.HOLD || f.ptype == PType.ALARM
    private fun notifyKey(f: Frame) = "pg-${f.src}-${f.seq}"

    private fun frame(f: Frame, now: Long, viaLink: Boolean, rssi: Int?) {
        if (f.src == me.unit) return
        val type = f.ptype ?: return
        val mine = f.addressedTo(me.unit)

        // CALL held: refresh on every copy, duplicates included
        if (type == PType.HOLD && mine) {
            if (f.arg == 0) { endCall(f.src, now); return }
            val was = calling[f.src]
            calling[f.src] = now + CALL_HOLD_MS
            if (was == null || was < now) {
                effects += Effect.Haptic(Haptics.CALL, repeat = true); effects += Effect.Tone(Sound.CALL)
                effects += Effect.Banner("HÍV: ${who(f.src)}")
            }
        }

        // receipts are idempotent and the link's carry seq 0: count them before the duplicate check
        if (type == PType.GOTIT && mine) ackFrom(f.src, f.arg, now)

        val dup = seenKeys.containsKey(f.key)
        if (!dup) seenKeys[f.key] = now
        if (mine && needsAck(f)) ack(f, now, viaLink)
        if (dup || f.seq == 0) return
        trimKeys(now)

        // T2 Stair Node: repeat what may not reach everyone (weakly heard), or everything in repeater mode
        val weak = rssi != null && rssi < RELAY_RSSI
        if (!viaLink && f.ttl > 0 && f.dst != me.unit && type != PType.IDLE && (repeater || weak)) {
            relays += Outgoing(f.copy(ttl = f.ttl - 1), now, emptySet(), now + RELAY_MS)
            while (relays.size > 20) relays.removeAt(0)
        }
        val relayed = f.ttl < MAX_TTL
        if (relayed) peers[f.src]?.let { it.relayedOnlyAt = now } ?: run { peers[f.src] = Peer(f.src).also { it.relayedOnlyAt = now } }
        if (!mine) return

        when (type) {
            PType.SEEN -> {
                if (f.arg == 0) clearAlarms(f.src, now)       // "I am fine" after a man-down alarm
                val o = outgoing.lastOrNull { it.frame.seq == f.arg && f.arg != 0 }
                if (o != null) { o.seenBy += f.src; o.status = SendStatus.SEEN; o.resolvedAt = now }
                note(now, "${who(f.src)} LÁTTA" + (o?.let { ": ${it.label}" } ?: ""))
                effects += Effect.Haptic(Haptics.SEEN_BACK); effects += Effect.Tone(Sound.OK)
            }
            PType.TEXTMSG -> {
                val inc = Incoming(f, now, relayed).also { addIncoming(it) }
                val msg = Messages.byCode(f.arg)
                note(now, "${who(f.src)}: ${inc.label}", bad = msg?.urgent == true)
                effects += Effect.Haptic(Haptics.forMessage(f.arg), repeat = false)
                effects += Effect.Tone(if (msg?.urgent == true) Sound.URGENT else Sound.PAGE)
                effects += Effect.Notify(notifyKey(f), "${who(f.src)}: ${inc.label}",
                    if (msg?.power == true) Messages.POWER_NOTE else "Nyomd meg a LÁTTAM gombot.", urgent = msg?.urgent == true || msg?.power == true)
            }
            PType.HOLD -> if (f.arg != 0) addIncoming(Incoming(f, now, relayed))
            PType.PING -> note(now, "${who(f.src)} link tesztet küldött")
            PType.ROLLCALL -> { note(now, "${who(f.src)} névsort olvas"); emit(PType.HELLO, battery, f.src, now, track = false, windowMs = 3_000) }
            PType.HELLO -> if (now < rollCallUntil) rollCall[f.src] = f.arg
            PType.BATT -> peers[f.src]?.battery = f.arg
            PType.ARMSTATE -> { peers[f.src]?.guard = f.arg; note(now, "${who(f.src)} őrzés: ${listOf("ki", "élesítés", "élesítve", "riasztás előtt").getOrElse(f.arg) { "?" }}") }
            PType.ALARM -> {
                val muted = (alarmMuted[f.src] ?: 0) > now
                if (!muted) {
                    val inc = Incoming(f, now, relayed).also { addIncoming(it) }
                    if (incoming.count { it.frame.src == f.src && it.frame.ptype == PType.ALARM && !it.seen } <= 1) {
                        note(now, "${who(f.src)}: ${inc.label}", bad = true)
                        effects += Effect.Haptic(Haptics.ALARM, repeat = true); effects += Effect.Tone(Sound.ALARM)
                        effects += Effect.Notify("alarm-${f.src}", "RIASZTÁS: ${who(f.src)}", AlarmReason.of(f.arg)?.hu ?: "riasztás", urgent = true)
                    }
                }
            }
            PType.HUBCMD -> {
                val target = f.arg shr 4; val action = f.arg and 15
                if (target == 4) {
                    note(now, "${who(f.src)} távolról: őrzés ${if (action == 1) "BE" else "KI"}")
                    onGuard(if (action == 1) guard.arm(now) else guard.disarm(byPartner = true), now)
                }
            }
            else -> {}
        }
    }

    private fun clearAlarms(src: Int, now: Long) {
        val open = incoming.filter { it.frame.src == src && it.frame.ptype == PType.ALARM && !it.seen }
        if (open.isEmpty()) return
        open.forEach { it.seen = true }
        effects += Effect.Quiet; effects += Effect.ClearNotify("alarm-$src")
        note(now, "${who(src)} visszavonta a riasztást")
    }

    private fun addIncoming(i: Incoming) { incoming += i; while (incoming.size > 60) incoming.removeAt(0) }

    private fun ack(f: Frame, now: Long, viaLink: Boolean) {
        if (acks.none { it.first == f.src && it.second == f.seq && it.third > now }) acks += Triple(f.src, f.seq, now + ACK_MS)
        while (acks.size > 12) acks.removeAt(0)
        val gotit = Frame(PType.GOTIT.code, f.seq, me.unit, f.src, 0, 0, me.crew.id)
        if (viaLink) effects += Effect.Send(LinkMsg.FrameMsg(gotit), f.src)
        // relayed in: the fast ack slot will not reach the sender, so the receipt goes back as an event the relays carry
        if (f.ttl < MAX_TTL && !viaLink) {
            val g = Frame(PType.GOTIT.code, f.seq, me.unit, f.src, nextSeq(), MAX_TTL, me.crew.id)
            relays += Outgoing(g, now, emptySet(), now + RELAY_MS)
        }
    }

    private fun ackFrom(acker: Int, seq: Int, now: Long) {
        val o = outgoing.lastOrNull { it.frame.seq == seq } ?: return
        if (!o.acked.add(acker)) return
        if (o.frame.ptype == PType.ALARM) { if (o.frame.arg == AlarmReason.MAN_DOWN.code) manDown.acknowledged() else guard.acknowledged() }
        if (o.status == SendStatus.SENDING && o !== holdOut && o.expect.isNotEmpty() && o.acked.containsAll(o.expect)) resolve(o, now)
    }

    private fun resolve(o: Outgoing, now: Long) {
        o.resolvedAt = now
        o.status = when {
            o.acked.isEmpty() -> SendStatus.NO_REPLY
            o.acked.containsAll(o.expect) -> SendStatus.DELIVERED
            else -> SendStatus.PARTIAL
        }
        val ping = o.frame.ptype == PType.PING
        when (o.status) {
            SendStatus.NO_REPLY -> { effects += Effect.Haptic(Haptics.NO_REPLY); effects += Effect.Tone(Sound.FAIL) }
            else -> effects += Effect.Haptic(if (ping) Haptics.LINK_OK else Haptics.DELIVERED)
        }
        if (ping) {
            val p = if (o.frame.dst != BROADCAST) peers[o.frame.dst] else null
            val line = if (o.status == SendStatus.NO_REPLY) "NINCS LINK ✗" else
                "LINK OK ✓" + (p?.rssi?.value?.let { " ${it.toInt()} dBm, ${Proximity.label(distanceOf(p, now))}" } ?: " (${o.acked.size} válasz)")
            effects += Effect.Banner(line); note(now, line, bad = o.status == SendStatus.NO_REPLY)
        } else if (o.frame.ptype != PType.HOLD || o.status == SendStatus.NO_REPLY) note(now, "${o.label}: ${o.status.hu}", bad = o.status == SendStatus.NO_REPLY)
    }

    private fun endCall(src: Int, now: Long) {
        if (calling.remove(src) != null) { effects += Effect.Quiet; note(now, "Hívás vége: ${who(src)}") }
    }

    // ---- time ---------------------------------------------------------------------------------------------------

    @Synchronized fun tick(now: Long) {
        for (o in outgoing) if (o.status == SendStatus.SENDING && o !== holdOut && now >= o.until) resolve(o, now)
        holdOut?.let { if (now - holdLinkAt >= 300) { holdLinkAt = now; effects += Effect.Send(LinkMsg.FrameMsg(it.frame), if (it.frame.dst == BROADCAST) null else it.frame.dst) } }
        relays.removeAll { it.until <= now }
        acks.removeAll { it.third <= now }
        calling.entries.filter { it.value < now }.map { it.key }.forEach { endCall(it, now) }
        onGuard(guard.tick(now), now)
        onManDown(manDown.tick(now), now)
        if (battery in 0..100) {
            if (battery < 15 && !lowBatterySent) { lowBatterySent = true; sendMessage(14, BROADCAST, now) }
            if (battery > 20) lowBatterySent = false
        }
    }

    @Synchronized fun drain(): List<Effect> { val e = effects.toList(); effects.clear(); return e }

    // ---- what the screen shows --------------------------------------------------------------------------------

    private fun distanceOf(p: Peer, now: Long): Double? {
        val v = p.rssi.value ?: return null
        if (p.rssi.age(now) > Proximity.LOST_MS) return null
        return Proximity.distance(v, calibration[p.unit] ?: p.tx1m, clutter)
    }

    fun who(unit: Int): String = if (unit == BROADCAST) "mindenki" else peers[unit]?.name ?: "Egység $unit"

    @Synchronized fun peers(now: Long): List<PeerView> = peers.values.map { p ->
        val d = distanceOf(p, now)
        val age = minOf(p.rssi.age(now), if (p.linked) 0 else Long.MAX_VALUE)
        val viaRelay = d == null && now - p.relayedOnlyAt < Proximity.LOST_MS
        PeerView(p.unit, p.name, d, if (viaRelay) Zone.EDGE else Proximity.zone(d, p.rssi.age(now)),
            p.rssi.trend(now), p.rssi.value?.toInt(), p.battery.takeIf { it in 0..100 }, p.linked,
            p.flags and Flags.TALK != 0, p.flags and Flags.ARMED != 0, p.flags and Flags.ALARM != 0, age, viaRelay)
    }.sortedWith(compareBy({ it.zone.ordinal }, { it.distanceM ?: 999.0 }))

    @Synchronized fun peer(unit: Int): Peer? = peers[unit]
    @Synchronized fun outgoing(): List<Outgoing> = outgoing.takeLast(12).reversed()
    @Synchronized fun incoming(): List<Incoming> = incoming.takeLast(30).reversed()
    @Synchronized fun unseen(): List<Incoming> = incoming.filter { !it.seen && needsSeen(it.frame) }
    @Synchronized fun chats(): List<ChatEntry> = chats.toList()
    @Synchronized fun log(): List<LogLine> = log.takeLast(80).reversed()
    @Synchronized fun callers(now: Long): List<Int> = calling.filter { it.value >= now }.keys.toList()
    @Synchronized fun rollCallResult(now: Long): Map<Int, Int>? = if (now < rollCallUntil + 20_000) rollCall.toMap() else null
    val holding: Boolean @Synchronized get() = holdOut != null

    @Synchronized fun loadChats(list: List<ChatEntry>) {
        chats.clear(); chats += list.takeLast(MAX_CHATS)
        chats.forEach { chatKeys[it.key] = it.at; if (it.mine) chatSeq = maxOf(chatSeq, it.seq) }
    }

    private fun note(now: Long, text: String, bad: Boolean = false) { log += LogLine(now, text, bad); while (log.size > 200) log.removeAt(0) }

    private fun trimChats() { while (chats.size > MAX_CHATS) chats.removeAt(0) }

    private fun trimKeys(now: Long) {
        val it = seenKeys.entries.iterator()
        while (it.hasNext()) if (now - it.next().value > DEDUPE_MS) it.remove() else break
        val c = chatKeys.entries.iterator()
        while (c.hasNext() && chatKeys.size > 2_000) { c.next(); c.remove() }
    }

    companion object {
        const val SLOT_MS = 400L
        const val SEND_WINDOW_MS = 8_000L
        const val ACK_MS = 2_500L
        const val RELAY_MS = 4_000L
        const val CALL_HOLD_MS = 1_500L
        const val DEDUPE_MS = 60_000L
        const val RELAY_RSSI = -80
        const val CHAT_TTL = 3
        const val MAX_CHATS = 300
        val ACKED = setOf(PType.HOLD, PType.SEEN, PType.TEXTMSG, PType.PING, PType.HUBCMD, PType.ALARM, PType.ROLLCALL)
    }
}
