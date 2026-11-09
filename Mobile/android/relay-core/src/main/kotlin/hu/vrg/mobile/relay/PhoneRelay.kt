package hu.vrg.mobile.relay

import org.json.JSONArray
import org.json.JSONObject
import java.security.SecureRandom

// The phone's relay (WP M7, D-9 = A): the routing of Planner/projects/varler-planner/tools/phone-relay-server.js,
// so Kódváros, the Planner and Légegér need no second protocol, behind a gate the PC relay does not have —
// here EVERY client must be paired (Trust.kt), because the phone's WiFi or hotspot is the open side.
//
// The envelope is the PC relay's: {v:1, from, seq, t, type, payload, to?}; the relay's own messages carry
// from:'relay'. The routing rules, in one place as on the PC (deliverTo):
//   * `to` names a role: only clients of that role get it;
//   * no echo to the same role, and no app-to-app (Planner and Kódváros never hear each other);
//   * each app's last hello is replayed to a phone that says hello later;
//   * phones get {type:'roster', payload:{peers, focus}} on every hello and close;
//   * an app's {type:'focus'} is remembered and travels in the roster.
// The gate:
//   * a client is held until it is trusted: its hello is answered with welcome{challenge, pc, relay:'phone'}
//     (to every role, not only phones), nothing else it sends is routed, nothing is routed to it, and its
//     hello reaches the others only once it is trusted;
//   * pair / auth / unpair to:'relay' work as on the PC (Trust.kt has the handshake);
//   * a client still untrusted after [holdMs] is closed (4401).
// The PC relay's PC-side abilities (screenshots, ports, launch, board, notify, screen) do not exist on a phone:
// a trusted client asking for them gets {ok:false, unsupported:true} under the same type, rather than silence.

class PhoneRelay(
    private val trust: TrustStore,
    /** This relay's identity in the welcome: the phone's stable id and its name. */
    private val selfId: String,
    private val selfName: String,
    /** The phone's own public key (base64 SPKI): trusted as id "self" so the app's own link can prove itself. */
    private val selfPub: String? = null,
    private val clock: () -> Long = System::currentTimeMillis,
    private val rnd: SecureRandom = SecureRandom(),
    private val holdMs: Long = 30_000,
    private val log: (String) -> Unit = {},
) : WsHandler {
    companion object {
        const val PHONE = "phone"
        const val SELF_ID = "self"
        const val CLOSE_UNTRUSTED = 4401
        const val NEED_PAIR = "Párosítás kell: a telefonon Hálózat → Telefon relé → Új kód, és írd be itt."
        private val PAIR_TYPES = setOf("pair", "auth", "unpair")
        /** The PC relay's own abilities, answered as unsupported. Answer type = request type, except these. */
        private val ANSWER = mapOf(
            "screenshot.request" to "screenshot", "ports.list" to "ports", "ports.open" to "ports.opened",
            "launch.list" to "launch", "launch.run" to "launch.ran", "launch.stop" to "launch.stopped",
            "board.list" to "board.listed", "board.remove" to "board.removed", "clip.get" to "clip", "clip.set" to "clip",
            "notify" to "notify.added", "notify.list" to "notify.listed",
        )
    }

    /** One connected client, as the UI shows it. */
    data class Peer(val conn: Int, val remote: String, val role: String?, val app: String?, val device: String?, val trusted: Boolean)

    private class Client(val conn: WsConn, var challenge: String, val opened: Long) {
        var role: String? = null
        var app: String? = null
        var hello: String? = null          // the raw hello, kept for replay once trusted
        var trusted = false
        var pairId: String? = null
        var warned = false
    }

    val codes = CodeBook(rnd, clock)
    private val clients = LinkedHashMap<Int, Client>()
    private var seq = 0
    private var lastFocus: JSONObject? = null

    /** Called (on any thread) whenever the list of peers or the trusted devices change. */
    @Volatile var onChange: () -> Unit = {}

    @Synchronized fun peers(): List<Peer> = clients.values.map { c ->
        Peer(c.conn.id, c.conn.remote, c.role, c.app, c.pairId?.let(::deviceName), c.trusted)
    }

    /** The paired PCs (without "self"). */
    fun devices(): List<TrustedDevice> = trust.list()

    /** Removes a pairing on the phone: its live connections are dropped at once. */
    fun forget(id: String) {
        trust.remove(id)
        val gone = synchronized(this) { clients.values.filter { it.pairId == id }.map { it.conn } }
        gone.forEach { it.close(CLOSE_UNTRUSTED, "A párosítást a telefonon törölték.") }
        onChange()
    }

    private fun deviceName(id: String): String? =
        if (id == SELF_ID) "Ez a telefon" else trust.list().firstOrNull { it.id == id }?.device

    private fun pubOf(id: String?): String? = when {
        id == null -> null
        id == SELF_ID -> selfPub
        else -> trust.list().firstOrNull { it.id == id }?.pub
    }

    private fun pc() = JSONObject().put("id", selfId).put("name", selfName)

    private fun fromRelay(type: String, payload: JSONObject): String = JSONObject()
        .put("v", 1).put("from", "relay").put("seq", ++seq).put("t", clock())
        .put("type", type).put("payload", payload).toString()

    // ---- WsHandler ---------------------------------------------------------------------------------

    override fun onOpen(c: WsConn) {
        synchronized(this) { clients[c.id] = Client(c, PairCodes.hex(rnd, 16), clock()) }
        log("+ ${c.remote}")
        onChange()
    }

    override fun onClose(c: WsConn) {
        val gone = synchronized(this) {
            val cl = clients.remove(c.id) ?: return
            val f = lastFocus
            if (f != null && cl.role == f.optString("role") && clients.values.none { it.role == cl.role }) lastFocus = null
            cl
        }
        log("- ${c.remote}")
        if (gone.trusted && gone.role != null) sendRoster()
        onChange()
    }

    /** Closes the clients that did not prove themselves in time. Call every few seconds. */
    fun tick() {
        val now = clock()
        val late = synchronized(this) { clients.values.filter { !it.trusted && now - it.opened >= holdMs }.map { it.conn } }
        late.forEach { it.close(CLOSE_UNTRUSTED, "Nincs párosítva ezzel a telefonnal.") }
    }

    // One message at a time through the whole relay: the order of trust and routing is then simple to reason
    // about, and a phone relay carries a handful of clients, not hundreds.
    @Synchronized
    override fun onText(c: WsConn, text: String) {
        val me = synchronized(this) { clients[c.id] } ?: return
        val m = try { JSONObject(text) } catch (_: Exception) { null }
        val type = m?.optString("type").orEmpty()
        val from = m?.optString("from")?.takeIf { it.isNotEmpty() }
        val to = m?.opt("to") as? String
        val payload = m?.optJSONObject("payload") ?: JSONObject()

        if (m != null && type == "hello") {
            val first = synchronized(this) {
                val f = me.role == null
                me.role = me.role ?: payload.optString("role").ifEmpty { null } ?: from
                me.app = payload.optString("app").ifEmpty { null } ?: me.app
                me.hello = text
                f
            }
            if (first) log("  ${c.remote} = ${me.role} ${me.app ?: ""}")
            if (!me.trusted) {
                c.send(fromRelay("welcome", JSONObject().put("challenge", me.challenge).put("pc", pc())
                    .put("pairing", true).put("relay", "phone")))
                onChange()
                return
            }
            // a trusted client saying hello again: routed like on the PC
        }

        if (m != null && to == "relay" && type in PAIR_TYPES) { onPair(me, type, payload); return }

        if (!me.trusted) {
            if (!me.warned) {
                me.warned = true
                c.send(fromRelay("trust", JSONObject().put("ok", false).put("pc", pc()).put("reason", NEED_PAIR)))
            }
            return
        }

        if (m != null && to == "relay") {
            c.send(fromRelay(ANSWER[type] ?: type, JSONObject().put("ok", false).put("unsupported", true)
                .put("reason", "Ezt a PC reléje tudja, a telefoné nem.")))
            return
        }

        if (m != null && type == "focus" && isApp(from)) synchronized(this) {
            lastFocus = JSONObject().put("role", from).put("app", payload.optString("app").ifEmpty { null } ?: me.app ?: JSONObject.NULL)
                .put("title", payload.optString("title").ifEmpty { null } ?: JSONObject.NULL).put("t", clock())
        }

        route(me, text, from, to)
        if (m != null && type == "hello") {
            if (me.role == PHONE) replayTo(me)
            sendRoster()
        }
    }

    // ---- routing (phone-relay-server.js deliverTo) -----------------------------------------------------

    private fun isApp(role: String?) = !role.isNullOrEmpty() && role != PHONE

    private fun deliverTo(other: Client, me: Client, from: String?, to: String?): Boolean {
        if (other === me || !other.trusted) return false
        val r = other.role
        if (to != null) return r == to
        if (from != null && r != null && r == from) return false
        if (isApp(from) && isApp(r)) return false
        return true
    }

    private fun route(me: Client, raw: String, from: String?, to: String?) {
        val targets = synchronized(this) { clients.values.filter { deliverTo(it, me, from, to) }.map { it.conn } }
        targets.forEach { it.send(raw) }
    }

    /** Every trusted app's last hello to [phone], which arrived after them (the PC relay's hello replay). */
    private fun replayTo(phone: Client) {
        val apps = synchronized(this) { clients.values.filter { it.trusted && isApp(it.role) && it.hello != null } }
        apps.forEach { a -> phone.conn.send(a.hello!!) }
    }

    private fun sendRoster() {
        val (raw, phones) = synchronized(this) {
            val peers = JSONArray()
            clients.values.filter { it.trusted && it.role != null }.forEach {
                peers.put(JSONObject().put("role", it.role).put("app", it.app ?: JSONObject.NULL))
            }
            fromRelay("roster", JSONObject().put("peers", peers).put("focus", lastFocus ?: JSONObject.NULL)) to
                clients.values.filter { it.trusted && it.role == PHONE }.map { it.conn }
        }
        phones.forEach { it.send(raw) }
    }

    /** The moment a client becomes trusted: its held hello goes out, a phone gets the apps' hellos, phones a roster. */
    private fun admitted(me: Client) {
        log("  ${me.conn.remote} megbízható (${me.pairId})")
        val hello = me.hello
        if (hello != null) {
            val m = try { JSONObject(hello) } catch (_: Exception) { null }
            route(me, hello, m?.optString("from")?.takeIf { it.isNotEmpty() }, m?.opt("to") as? String)
            if (me.role == PHONE) replayTo(me)
        }
        sendRoster()
        onChange()
    }

    // ---- pairing ---------------------------------------------------------------------------------

    private fun onPair(me: Client, type: String, p: JSONObject) {
        val c = me.conn
        when (type) {
            "pair" -> {
                val r = if (!codes.consume(p.optString("code"))) {
                    JSONObject().put("ok", false).put("reason", "A kód hibás vagy lejárt. Kérj újat a telefonon.")
                } else if (RelayKeys.parsePub(p.optString("pub")) == null) {
                    JSONObject().put("ok", false).put("reason", "A kulcs nem P-256.")
                } else {
                    val d = trust.add(p.optString("device").filter { it >= ' ' }.trim().take(60), p.optString("pub"), clock())
                    me.trusted = true; me.pairId = d.id
                    log("  párosítva: ${c.remote} = ${d.device} (${d.id})")
                    JSONObject().put("ok", true).put("id", d.id)
                }
                c.send(fromRelay("paired", r.put("pc", pc())))
                if (me.trusted) admitted(me)
            }
            "auth" -> {
                val id = p.optString("id").ifEmpty { null }
                val pub = pubOf(id)
                val ok = !me.trusted && id != null && pub != null && RelayKeys.verify(pub, me.challenge, id, p.optString("sig"))
                me.challenge = PairCodes.hex(rnd, 16)           // one try per challenge
                if (ok) { me.trusted = true; me.pairId = id }
                c.send(fromRelay("trust", JSONObject().put("ok", ok || me.trusted).put("id", id ?: JSONObject.NULL).put("pc", pc())
                    .put("challenge", me.challenge)
                    .put("reason", if (ok || me.trusted) JSONObject.NULL else "Ez az eszköz nincs párosítva ezzel a telefonnal.")))
                if (ok) admitted(me)
            }
            "unpair" -> {
                val id = p.optString("id")
                if (me.trusted && me.pairId == id && id != SELF_ID) forget(id)
            }
        }
    }
}
