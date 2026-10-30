package hu.vrg.mobile.core

// Every link the app answers, turned into "which feature, with what". The shell owns the intent
// filters; features only see a Route. Plain string parsing, so it is tested on the JVM.
//
//   vrg://<feature>[/<path>][?k=v&...]           the app's own scheme, e.g. vrg://airdeck
//   vrg://pair?ws=ws://192.168.1.24:47291&c=...  what the PC's QR will carry (M2)
//   vrgdeck://connect?ws=ws://host:port          Légegér's original link, kept working
//   http://<pc>:47291/phone-sender.html          the Planner's phone QR, offered to the app

data class Route(val feature: String, val path: String = "", val params: Map<String, String> = emptyMap())

object Links {
    const val SCHEME = "vrg"
    const val RELAY_PORT = 47291

    fun route(link: String?): Route? {
        val s = link?.trim().orEmpty()
        val i = s.indexOf("://")
        if (i <= 0) return null
        val scheme = s.substring(0, i).lowercase()
        val rest = s.substring(i + 3)
        val (hostPath, query) = rest.split('?', limit = 2).let { it[0] to it.getOrElse(1) { "" } }
        val params = parseQuery(query)
        val host = hostPath.substringBefore('/')
        val path = hostPath.substringAfter('/', "")
        return when (scheme) {
            SCHEME -> Catalogue.byId(host.lowercase())?.let { Route(it.id, path, params) }
            "vrgdeck" -> if (host == "connect") Route(Catalogue.AIRDECK.id, "connect", params) else null
            "http", "https" -> {
                if (path != "phone-sender.html") return null
                val h = host.substringBefore(':')
                val port = host.substringAfter(':', "").toIntOrNull() ?: RELAY_PORT
                Route(Catalogue.AIRDECK.id, "connect", mapOf("ws" to "ws://$h:$port"))
            }
            else -> null
        }
    }

    fun parseQuery(q: String): Map<String, String> =
        q.split('&').filter { it.isNotEmpty() }.associate { kv ->
            val k = kv.substringBefore('=')
            val v = kv.substringAfter('=', "")
            decode(k) to decode(v)
        }

    private fun decode(s: String): String = java.net.URLDecoder.decode(s, "UTF-8")
}
