package hu.vrg.mobile.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Hálózat (WP M7): interface names, the tethering state from the two signals, the relay's address order,
// the settings chain, and the usage-threshold logic the WP asks to be tested.

class NetTest {
    @Test fun interfaceNames() {
        listOf("ap0", "swlan0", "softap0", "wifi_ap0").forEach { assertEquals(LinkKind.HOTSPOT, NetIfaces.kind(it), it) }
        listOf("rndis0", "ncm0", "usb0").forEach { assertEquals(LinkKind.USB, NetIfaces.kind(it), it) }
        listOf("bt-pan", "bnep0").forEach { assertEquals(LinkKind.BLUETOOTH, NetIfaces.kind(it), it) }
        assertEquals(LinkKind.WIFI, NetIfaces.kind("wlan0"))
        listOf("rmnet_data0", "ccmni1", "rmnet0").forEach { assertEquals(LinkKind.MOBILE, NetIfaces.kind(it), it) }
        assertEquals(LinkKind.LOOPBACK, NetIfaces.kind("lo"))
        assertEquals(LinkKind.OTHER, NetIfaces.kind("tun0"))
    }

    @Test fun tetherStateBroadcastWinsOverNames() {
        val up = listOf(IfaceAddr("wlan0", "192.168.1.5"), IfaceAddr("wlan1", "10.40.7.1"), IfaceAddr("rmnet_data0", "100.64.1.2"))
        val guessed = Tether.state(null, up)
        assertFalse(guessed.hotspot, "wlan1 alone is not proof")
        val told = Tether.state(listOf("wlan1"), up)
        assertTrue(told.hotspot); assertTrue(told.fromBroadcast)
        assertEquals("wlan1", Tether.hotspotIface(told))
        val usb = Tether.state(null, listOf(IfaceAddr("rndis0", "192.168.42.129")))
        assertTrue(usb.usb); assertFalse(usb.hotspot); assertFalse(usb.fromBroadcast)
        assertNull(Tether.hotspotIface(usb))
        val bt = Tether.state(listOf("bt-pan"), emptyList())
        assertTrue(bt.bluetooth)
        assertEquals(TetherState(false, false, false, emptyList(), true), Tether.state(emptyList(), up))
        assertTrue(Tether.state(null, listOf(IfaceAddr("ap0", "192.168.43.1"))).hotspot)
    }

    @Test fun relayAddressesBestFirstNeverMobile() {
        val all = listOf(
            IfaceAddr("rmnet_data0", "100.64.1.2"), IfaceAddr("wlan0", "192.168.1.5"), IfaceAddr("lo", "127.0.0.1"),
            IfaceAddr("rndis0", "192.168.42.129"), IfaceAddr("ap0", "192.168.43.1"), IfaceAddr("wlan0", "fe80::1"),
        )
        assertEquals(listOf("ap0", "rndis0", "wlan0"), RelayAddrs.order(all).map { it.name })
        assertEquals("192.168.43.1", RelayAddrs.forPc(IfaceAddr("ap0", "192.168.43.1"), 47291))
        assertEquals("192.168.43.1:47292", RelayAddrs.forPc(IfaceAddr("ap0", "192.168.43.1"), 47292))
        val viaBroadcast = RelayAddrs.order(listOf(IfaceAddr("wlan0", "192.168.1.5"), IfaceAddr("wlan1", "10.40.7.1")),
            Tether.state(listOf("wlan1"), emptyList()))
        assertEquals("wlan1", viaBroadcast.first().name)
    }

    @Test fun settingsChainEndsInAPublicAction() {
        assertEquals(SettingsTarget.Action("android.settings.TETHER_SETTINGS"), NetSettings.TETHER.first())
        assertEquals(SettingsTarget.Action("android.settings.WIRELESS_SETTINGS"), NetSettings.TETHER.last())
        listOf(LinkKind.HOTSPOT, LinkKind.USB, LinkKind.BLUETOOTH).forEach { assertTrue(NetSettings.hint(it).isNotBlank()) }
    }

    @Test fun usageCountsTheDayAcrossAReboot() {
        var d = Usage.sample(null, "2026-11-07", 5_000_000_000)!!
        assertEquals(0, d.today)
        d = Usage.sample(d, "2026-11-07", 5_400_000_000)!!
        assertEquals(400_000_000, d.today)
        d = Usage.sample(d, "2026-11-07", 100_000_000)!!               // rebooted: counter from zero
        assertEquals(500_000_000, d.today)
        d = Usage.sample(d, "2026-11-07", Usage.UNSUPPORTED)!!          // unsupported: unchanged
        assertEquals(500_000_000, d.today)
        d = Usage.sample(d, "2026-11-08", 300_000_000)!!                // a new day
        assertEquals(0, d.today); assertEquals("2026-11-08", d.day)
        assertNull(Usage.sample(null, "x", -1))
        assertEquals(d, UsageDay.decode(d.encode()))
        assertNull(UsageDay.decode("junk"))
    }

    @Test fun thresholdRingsOnceADay() {
        var d = Usage.sample(null, "2026-11-07", 0)!!
        d = Usage.sample(d, "2026-11-07", 999_999_999)!!
        assertFalse(Usage.shouldWarn(d, 1000))
        d = Usage.sample(d, "2026-11-07", 1_000_000_000)!!
        assertTrue(Usage.shouldWarn(d, 1000))
        assertFalse(Usage.shouldWarn(d, 0), "0 = no warning")
        d = Usage.warned(d)
        d = Usage.sample(d, "2026-11-07", 3_000_000_000)!!
        assertFalse(Usage.shouldWarn(d, 1000), "once a day")
        d = Usage.sample(d, "2026-11-08", 3_000_000_000)!!
        d = Usage.sample(d, "2026-11-08", 4_100_000_000)!!
        assertTrue(Usage.shouldWarn(d, 1000), "again the next day")
    }

    @Test fun formatting() {
        assertEquals("1,2 GB", Usage.format(1_234_000_000))
        assertEquals("850 MB", Usage.format(850_000_000))
        assertEquals("12 kB", Usage.format(12_000))
        assertEquals("0 B", Usage.format(-5))
        assertEquals("Hotspot: 300 MB · mobilnet ma: 1,2 GB", Usage.line(UsageDay("d", 0, 1_200_000_000), 300_000_000))
        assertEquals("Hotspot be · mobilnet ma: 0 B", Usage.line(null))
        assertEquals("nincs", Usage.thresholdLabel(0))
        assertEquals("2,0 GB", Usage.thresholdLabel(2000))
    }
}
