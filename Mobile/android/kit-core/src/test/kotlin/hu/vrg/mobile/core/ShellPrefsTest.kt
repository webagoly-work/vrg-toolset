package hu.vrg.mobile.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ShellPrefsTest {

    @Test fun roundTrip() {
        val p = ShellPrefs(
            palette = "laguna", uiScale = 1.15f, startInLast = false, lookAdopted = true,
            pairedPcs = listOf(
                PairedPc("id-1", "pc-1", "Iroda\tPC", "ws://192.168.1.24:47291", 1_761_700_000_000),
                PairedPc("id-2", "pc-2", "Laptop \\ új\nsor", "ws://10.0.0.5:47295", 1_761_700_100_000),
            ),
            relayUrl = "ws://192.168.1.24:47291", relayAdopted = true,
        )
        assertEquals(p, ShellPrefs.fromMap(ShellPrefs.toMap(p)))
    }

    @Test fun emptyStoreIsTheDefault() {
        assertEquals(ShellPrefs(), ShellPrefs.fromMap(emptyMap<String, Any>()))
        assertTrue(ShellPrefs().startInLast, "D-5: reopen the last feature by default")
    }

    @Test fun unknownPaletteFallsBackToMelyviz() {
        assertEquals("melyviz", ShellPrefs.fromMap(mapOf("palette" to "nincs-ilyen")).palette)
        assertEquals("melyviz", ShellPrefs.fromMap(mapOf("palette" to 42)).palette)
        assertEquals("melyviz", Look.palette(null))
        assertEquals("arok", Look.palette("arok"))
    }

    @Test fun scaleIsClamped() {
        assertEquals(1.3f, ShellPrefs.fromMap(mapOf("uiScale" to 9f)).uiScale)
        assertEquals(0.8f, ShellPrefs.fromMap(mapOf("uiScale" to 0.1f)).uiScale)
        assertEquals(1f, ShellPrefs.fromMap(mapOf("uiScale" to Float.NaN)).uiScale)
        assertEquals(1.1f, ShellPrefs.fromMap(mapOf("uiScale" to 1.1)).uiScale)
    }

    @Test fun legegerLookIsAdoptedOnce() {
        val first = ShellPrefs().adoptLook("korall", 1.2f)
        assertEquals("korall", first.palette)
        assertEquals(1.2f, first.uiScale)
        assertTrue(first.lookAdopted)

        // After the first time the shell's own choice wins, even a change back to the default.
        val changed = first.copy(palette = "melyviz", uiScale = 1f)
        assertEquals(changed, changed.adoptLook("korall", 1.2f))

        // The adoption survives storage, so it does not run again after a restart.
        assertEquals(changed, ShellPrefs.fromMap(ShellPrefs.toMap(changed)).adoptLook("moszat", 0.9f))
    }

    @Test fun legegerAdoptionCleansItsValues() {
        val p = ShellPrefs().adoptLook("régi-paletta", 5f)
        assertEquals("melyviz", p.palette)
        assertEquals(1.3f, p.uiScale)
        val none = ShellPrefs(palette = "sekely").adoptLook(null, null)
        assertEquals("sekely", none.palette, "nothing stored in Légegér: keep the shell's value")
        assertTrue(none.lookAdopted)
    }

    @Test fun brokenPcLinesAreDropped() {
        val s = "i1\tpc-1\tIroda\tws://a:1\t100\nrossz sor\ni2\tpc-2\tB\tws://b:2\tnem-szam\n\tpc-3\tnév\tws://c:3\t5\ni4\tpc-1\tDupla\tws://d:4\t7"
        assertEquals(listOf(PairedPc("i1", "pc-1", "Iroda", "ws://a:1", 100)), PcCodec.decode(s))
        assertEquals(emptyList(), PcCodec.decode(null))
        assertEquals(emptyList(), PcCodec.decode(""))
    }

    @Test fun logBookKeepsTheLast200() {
        val log = LogBook()
        repeat(250) { log.add(LogLine(it.toLong(), "t", "sor $it")) }
        val lines = log.lines()
        assertEquals(200, lines.size)
        assertEquals("sor 50", lines.first().text)
        assertEquals("sor 249", lines.last().text)
        log.clear()
        assertFalse(log.lines().isNotEmpty())
    }

    @Test fun logLineFormat() {
        val f = LogLine(0, "legeger", "Relé: kapcsolódva", warn = true).format()
        assertTrue(Regex("\\d\\d:\\d\\d:\\d\\d ! legeger  Relé: kapcsolódva").matches(f), f)
    }

    @Test fun lookIdsMatchTheCatalogueOfPalettes() {
        assertEquals(Look.PALETTES.size, Look.PALETTES.toSet().size)
        assertTrue(Look.DEFAULT_PALETTE in Look.PALETTES)
    }

    @Test fun legegerRelayIsAdoptedOnce() {
        val p = ShellPrefs().adoptRelay("192.168.1.24")
        assertEquals("ws://192.168.1.24:47291", p.relayUrl)
        assertTrue(p.relayAdopted)
        assertEquals(p.copy(relayUrl = ""), p.copy(relayUrl = "").adoptRelay("10.0.0.9"), "after the first time it never comes back")
        assertEquals("ws://pc:47292", ShellPrefs(relayUrl = "ws://pc:47292").adoptRelay("10.0.0.9").relayUrl, "the shell's own address wins")
        assertEquals("", ShellPrefs().adoptRelay(null).relayUrl)
    }

    @Test fun pairedPcsAreKeyedByThePc() {
        val a = PairedPc("id-1", "pc-1", "Iroda", "ws://a:1", 1)
        val again = PairedPc("id-9", "pc-1", "Iroda", "ws://b:1", 2)
        val p = ShellPrefs().withPc(a).withPc(again)
        assertEquals(listOf(again), p.pairedPcs, "re-pairing the same PC keeps one entry")
        assertEquals(again, p.pcById("pc-1"))
        assertEquals(emptyList(), p.withoutPc("pc-1").pairedPcs)
    }
}
