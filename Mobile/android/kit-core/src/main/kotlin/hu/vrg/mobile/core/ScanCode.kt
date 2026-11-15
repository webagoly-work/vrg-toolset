package hu.vrg.mobile.core

// What a QR read by the app's own scanner is (the home screen's "QR beolvasása" button, 2026-11-14). The PC side is the
// VRG Asztal's 📱 Telefon panel (Dashboard/page/phone.js): it shows the relay's pairing QR and one QR per local server,
//   vrg://pair?ws=ws://<pc>:47291&c=<code>&n=<pc name>          -> PairLink: become a trusted phone (M2)
//   http://<pc>:<relay>/p/<port>/<path>?vrg_s=<ticket>           -> Server: that one PC server, opened in a Custom Tab
//   vrg://<feature>…, vrgdeck://…, http://<pc>:47291/phone-sender.html -> Route: the feature it names (Links)
//   any other http(s) link to a private LAN address              -> Lan: offered, opened only on a tap
//   anything else                                                 -> Other: shown as text, never opened
// Plain string rules, so they run on the JVM in ScanCodeTest.

sealed interface ScanCode {
    data class PairLink(val offer: PairOffer) : ScanCode
    data class Server(val url: String, val host: String, val relayPort: Int, val port: Int) : ScanCode
    data class Open(val route: Route) : ScanCode
    data class Lan(val url: String, val host: String) : ScanCode
    data class Other(val text: String) : ScanCode

    companion object {
        private val HTTP = Regex("^(https?)://([^/?#:@]+)(?::(\\d{1,5}))?(/[^#]*)?$", RegexOption.IGNORE_CASE)
        private val SHARED = Regex("^/p/(\\d{1,5})/[^?]*\\?(?:.*&)?vrg_s=[0-9a-f]{32}(?:&.*)?$")

        fun classify(raw: String?): ScanCode {
            val s = raw?.trim().orEmpty()
            PairOffer.parse(s)?.let { return PairLink(it) }
            val m = HTTP.matchEntire(s)
            if (m != null) {
                val host = m.groupValues[2]
                val port = m.groupValues[3].toIntOrNull() ?: if (m.groupValues[1].equals("https", true)) 443 else 80
                val path = m.groupValues[4].ifEmpty { "/" }
                val shared = SHARED.matchEntire(path)
                if (shared != null && isLan(host) && port in 1..65535) {
                    val target = shared.groupValues[1].toInt()
                    if (target in 1..65535) return Server(s, host, port, target)
                }
            }
            Links.route(s)?.let { return Open(it) }
            if (m != null && isLan(m.groupValues[2])) return Lan(s, m.groupValues[2])
            return Other(s.take(200))
        }

        /** A private IPv4 address (10/8, 172.16/12, 192.168/16): the PC on the same WiFi or the Windows hotspot. */
        fun isLan(host: String): Boolean {
            val p = host.split('.').map { it.toIntOrNull() ?: return false }
            if (p.size != 4 || p.any { it !in 0..255 }) return false
            return p[0] == 10 || (p[0] == 172 && p[1] in 16..31) || (p[0] == 192 && p[1] == 168)
        }
    }
}
