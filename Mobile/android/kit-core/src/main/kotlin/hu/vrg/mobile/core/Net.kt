package hu.vrg.mobile.core

// Hálózat (WP M7): the rules behind the screen, without Android. Which link an interface name is, what the
// tethering state is from the two signals an ordinary app has (the sticky TETHER_STATE_CHANGED broadcast and the
// interfaces that carry an address), the order of the phone relay's addresses, and the settings pages an app may
// open where it cannot switch a link itself. docs/mobile/research/M7-network.md has the sources.

enum class LinkKind(val label: String) {
    HOTSPOT("WiFi hotspot"),
    USB("USB-megosztás"),
    BLUETOOTH("Bluetooth-megosztás"),
    WIFI("WiFi"),
    MOBILE("Mobilnet"),
    LOOPBACK("Saját"),
    OTHER("ismeretlen"),
}

object NetIfaces {
    private val rules = listOf(
        Regex("^(ap|swlan|softap|wifi_ap|wlan_ap)\\d*$") to LinkKind.HOTSPOT,
        Regex("^(rndis|ncm|usb)\\d*$") to LinkKind.USB,
        Regex("^(bt-pan|bnep)\\d*$") to LinkKind.BLUETOOTH,
        Regex("^wlan\\d*$") to LinkKind.WIFI,
        Regex("^(rmnet|rmnet_data|ccmni|seth_lte|pdp|v4-rmnet|clat|qmimux)\\S*$") to LinkKind.MOBILE,
        Regex("^lo$") to LinkKind.LOOPBACK,
    )

    fun kind(name: String): LinkKind = rules.firstOrNull { it.first.matches(name.trim()) }?.second ?: LinkKind.OTHER
}

/** One interface with an IPv4 address, as java.net.NetworkInterface lists it. */
data class IfaceAddr(val name: String, val address: String)

data class TetherState(
    val hotspot: Boolean,
    val usb: Boolean,
    val bluetooth: Boolean,
    /** The tethered interfaces' names (the broadcast's, or those found by name). */
    val ifaces: List<String>,
    /** True when the system's own broadcast said so; false = guessed from interface names only. */
    val fromBroadcast: Boolean,
)

object Tether {
    /**
     * [tethered] is the broadcast's tetherArray / activeArray, or null when the broadcast was not there.
     * The broadcast wins when present: on some phones the hotspot is `wlan1`, which a name alone cannot tell
     * from a second WiFi radio. Without it, only names that are always tethering count.
     */
    fun state(tethered: List<String>?, up: List<IfaceAddr>): TetherState {
        val names = tethered ?: up.map { it.name }.filter { NetIfaces.kind(it) in setOf(LinkKind.HOTSPOT, LinkKind.USB, LinkKind.BLUETOOTH) }
        val kinds = names.map { n -> NetIfaces.kind(n).let { if (tethered != null && it == LinkKind.WIFI) LinkKind.HOTSPOT else it } }
        return TetherState(LinkKind.HOTSPOT in kinds, LinkKind.USB in kinds, LinkKind.BLUETOOTH in kinds, names.distinct(), tethered != null)
    }

    /** The interface whose bytes are the hotspot clients' (Android 12+ TrafficStats.getRxBytes(iface)). */
    fun hotspotIface(s: TetherState): String? = s.ifaces.firstOrNull {
        NetIfaces.kind(it) == LinkKind.HOTSPOT || (s.fromBroadcast && NetIfaces.kind(it) == LinkKind.WIFI)
    }
}

object RelayAddrs {
    private val ipv4 = Regex("^\\d{1,3}(\\.\\d{1,3}){3}$")

    /**
     * Where a PC can reach the phone relay, best first: the phone's own hotspot or local-only WiFi (the PC is a
     * client there), then USB tethering, then the WiFi the phone is a client of, then the rest. Mobile-network and
     * loopback addresses are never offered: nobody on the PC side can reach them.
     */
    fun order(all: List<IfaceAddr>, tethered: TetherState? = null): List<IfaceAddr> {
        fun rank(a: IfaceAddr): Int {
            val k = NetIfaces.kind(a.name)
            return when {
                k == LinkKind.HOTSPOT || (tethered?.fromBroadcast == true && a.name in tethered.ifaces && k == LinkKind.WIFI) -> 0
                k == LinkKind.USB -> 1
                k == LinkKind.WIFI -> 2
                k == LinkKind.BLUETOOTH -> 3
                else -> 4
            }
        }
        return all.filter { ipv4.matches(it.address) && NetIfaces.kind(it.name) !in setOf(LinkKind.MOBILE, LinkKind.LOOPBACK) }
            .distinctBy { it.address }.sortedBy(::rank)
    }

    /** What to type on the PC: Kódváros / Planner take ?relay=<this>. The default port is left out. */
    fun forPc(a: IfaceAddr, port: Int) = if (port == RelayAddress.DEFAULT_PORT) a.address else "${a.address}:$port"
}

/** A settings page an app may open: an action, or one activity of the Settings app. */
sealed interface SettingsTarget {
    data class Action(val action: String) : SettingsTarget
    data class Component(val pkg: String, val cls: String) : SettingsTarget
}

object NetSettings {
    /** Tried in order until one opens (research §2). The last is public and opens everywhere. */
    val TETHER: List<SettingsTarget> = listOf(
        SettingsTarget.Action("android.settings.TETHER_SETTINGS"),
        SettingsTarget.Component("com.android.settings", "com.android.settings.Settings\$TetherSettingsActivity"),
        SettingsTarget.Component("com.android.settings", "com.android.settings.TetherSettings"),
        SettingsTarget.Action("android.settings.WIRELESS_SETTINGS"),
    )
    val WIFI: List<SettingsTarget> = listOf(SettingsTarget.Action("android.settings.WIFI_SETTINGS"))
    val BLUETOOTH: List<SettingsTarget> = listOf(SettingsTarget.Action("android.settings.BLUETOOTH_SETTINGS"))
    val DATA_USAGE: List<SettingsTarget> = listOf(
        SettingsTarget.Action("android.settings.DATA_USAGE_SETTINGS"),
        SettingsTarget.Action("android.settings.WIRELESS_SETTINGS"),
    )

    /** The one tap left to the person, for a link the app cannot switch. */
    fun hint(kind: LinkKind): String = when (kind) {
        LinkKind.HOTSPOT -> "Kapcsold be: Személyes hotspot (Xiaomi: Kapcsolat és megosztás → Személyes hotspot)."
        LinkKind.USB -> "Dugd be a USB-kábelt, majd kapcsold be: USB-megosztás (USB tethering)."
        LinkKind.BLUETOOTH -> "Párosítsd a PC-t Bluetooth-on, majd kapcsold be: Bluetooth-megosztás."
        else -> ""
    }
}
