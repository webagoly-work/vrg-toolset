package hu.vrg.mobile.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

// The home screen's QR button (2026-11-14): what the VRG Asztal's 📱 Telefon panel shows, and what is never opened.
class ScanCodeTest {
    private val t = "0123456789abcdef0123456789abcdef"

    @Test fun thePairingQr() {
        val c = ScanCode.classify("vrg://pair?ws=ws%3A%2F%2F192.168.1.24%3A47291&c=$t&n=IRODA-PC")
        assertIs<ScanCode.PairLink>(c)
        assertEquals("ws://192.168.1.24:47291", c.offer.ws)
    }

    @Test fun aSharedServerQr() {
        // what the relay's GET /share/<port>.json makes (phone-relay-server.js serveShare)
        val c = ScanCode.classify("http://192.168.1.24:47291/p/8124/?vrg_s=$t")
        assertIs<ScanCode.Server>(c)
        assertEquals(8124, c.port); assertEquals(47291, c.relayPort); assertEquals("192.168.1.24", c.host)
        val s = ScanCode.classify("http://192.168.137.1:47292/p/8806/stack-search.html?a=1&vrg_s=$t")
        assertIs<ScanCode.Server>(s)
        assertEquals(8806, s.port)
    }

    @Test fun aSharedLinkOutsideTheLanIsNotTrusted() {
        assertIs<ScanCode.Other>(ScanCode.classify("http://evil.example:47291/p/8124/?vrg_s=$t"))
        assertIs<ScanCode.Lan>(ScanCode.classify("http://192.168.1.24:47291/p/8124/?vrg_s=short"), "a malformed ticket is only a LAN link")
        assertIs<ScanCode.Lan>(ScanCode.classify("http://192.168.1.24:47291/p/99999/?vrg_s=$t"), "no such port")
    }

    @Test fun linksTheAppKnows() {
        val c = ScanCode.classify("http://192.168.1.24:47291/phone-sender.html")
        assertIs<ScanCode.Open>(c)
        assertEquals(Catalogue.AIRDECK.id, c.route.feature)
        assertIs<ScanCode.Open>(ScanCode.classify("vrg://airdeck"))
    }

    @Test fun otherLanPagesAreOfferedNotOpened() {
        assertIs<ScanCode.Lan>(ScanCode.classify("http://10.0.0.5:8124/"))
        assertIs<ScanCode.Other>(ScanCode.classify("https://example.com/"))
        assertIs<ScanCode.Other>(ScanCode.classify("http://user@192.168.1.24/"), "credentials in a URL")
        assertIs<ScanCode.Other>(ScanCode.classify("WIFI:T:WPA;S:Otthon;P:x;;"))
        assertIs<ScanCode.Other>(ScanCode.classify(null))
    }

    @Test fun privateAddresses() {
        assertTrue(ScanCode.isLan("192.168.0.100")); assertTrue(ScanCode.isLan("10.1.2.3")); assertTrue(ScanCode.isLan("172.20.0.1"))
        assertFalse(ScanCode.isLan("172.32.0.1")); assertFalse(ScanCode.isLan("8.8.8.8")); assertFalse(ScanCode.isLan("pc.local")); assertFalse(ScanCode.isLan("192.168.1"))
    }
}
