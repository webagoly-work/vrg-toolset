package hu.vrg.mobile.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class KitCoreTest {

    @Test fun catalogueIdsAreUniqueAndLinkSafe() {
        val ids = Catalogue.ALL.map { it.id }
        assertEquals(ids.size, ids.toSet().size, "duplicate feature id")
        ids.forEach { assertTrue(Regex("[a-z][a-z0-9]*").matches(it), "id '$it' must be a lowercase word") }
    }

    @Test fun everyFeatureNamesAWorkPackage() {
        Catalogue.ALL.forEach { assertTrue(Regex("M[0-9]+").matches(it.wp), "${it.id}: wp '${it.wp}'") }
        val wps = Catalogue.ALL.map { it.wp }
        assertEquals(wps.size, wps.toSet().size, "two features share a WP")
    }

    @Test fun everyGroupIsShown() {
        assertEquals(Catalogue.ALL.size, Catalogue.grouped().sumOf { it.second.size })
    }

    @Test fun ownScheme() {
        assertEquals(Route("airdeck"), Links.route("vrg://airdeck"))
        assertEquals(Route("notes", "new", mapOf("text" to "szia vilag")), Links.route("vrg://notes/new?text=szia%20vilag"))
        assertEquals(
            Route("pair", "", mapOf("ws" to "ws://192.168.1.24:47291", "c" to "abc")),
            Links.route("vrg://pair?ws=ws%3A%2F%2F192.168.1.24%3A47291&c=abc"),
        )
        assertNull(Links.route("vrg://nincs-ilyen"))
    }

    @Test fun legacyLegegerLinks() {
        assertEquals(
            Route("airdeck", "connect", mapOf("ws" to "ws://192.168.1.24:47291")),
            Links.route("vrgdeck://connect?ws=ws://192.168.1.24:47291"),
        )
        assertEquals(
            Route("airdeck", "connect", mapOf("ws" to "ws://192.168.1.24:47291")),
            Links.route("http://192.168.1.24:47291/phone-sender.html"),
        )
        assertEquals(
            Route("airdeck", "connect", mapOf("ws" to "ws://10.0.0.5:47295")),
            Links.route("http://10.0.0.5:47295/phone-sender.html"),
        )
        assertNull(Links.route("http://192.168.1.24:47291/index.html"))
        assertNull(Links.route("nem link"))
        assertNull(Links.route(null))
    }
}
