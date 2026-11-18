package hu.vrg.mobile.core

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** The launcher icon per palette: every palette the app offers has its alias and its adaptive icon, generated. */
class LauncherIconTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")
    private val app = File(repo, "Mobile/android/app/src/main")

    @Test fun aliasNames() {
        assertEquals("hu.vrg.mobile.Launcher_melyviz", Look.launcherAlias("melyviz"))
        assertEquals("hu.vrg.mobile.Launcher_kit_ej", Look.launcherAlias("kit-ej"))
        assertEquals("hu.vrg.mobile.Launcher_melyviz", Look.launcherAlias("nincs-ilyen"))     // unknown → the default
    }

    @Test fun everyPaletteHasItsIconAndExactlyOneAliasIsOn() {
        val manifest = File(app, "AndroidManifest.xml").readText()
        val aliases = Regex("""<activity-alias\s+android:name="\.Launcher_(\w+)"[^>]*?android:enabled="(true|false)"""")
            .findAll(manifest).associate { it.groupValues[1] to (it.groupValues[2] == "true") }
        Look.PALETTES.forEach { p ->
            val r = p.replace('-', '_')
            assertTrue(r in aliases, "no launcher alias for palette $p (run node Mobile/catalogue/icon-gen.js)")
            assertTrue(File(app, "res/mipmap-anydpi-v26/ic_launcher_$r.xml").isFile, "no icon for palette $p")
        }
        assertEquals(Look.PALETTES.size, aliases.size, "an alias for a palette the app no longer has")
        assertEquals(listOf("melyviz"), aliases.filterValues { it }.keys.toList(), "exactly the default alias starts enabled")
        assertTrue("android.intent.category.LAUNCHER" !in manifest.substringBefore("<activity-alias"),
            "ShellActivity itself must not be a launcher entry: the aliases are")
    }
}
