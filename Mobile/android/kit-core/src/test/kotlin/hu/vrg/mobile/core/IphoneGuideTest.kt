package hu.vrg.mobile.core

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** The iPhone guide both apps show (Mobile/web/guide/iphone.json): it parses, and it covers the whole way in. */
class IphoneGuideTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")
    private val g = assertNotNull(IphoneGuide.parse(File(repo, "Mobile/web/guide/iphone.json").readText()), "the guide parses")

    @Test fun pointsAtThePublishedWebApp() {
        assertEquals("https://webagoly-work.github.io/vrg-toolset/mobile/", g.url)
    }

    @Test fun coversEveryStepInOrder() {
        // open → Safari or home screen → request → the owner approves → unlock → check, then the help
        val ids = g.sections.map { it.id }
        listOf("need", "open", "where", "request", "approve", "unlock", "check", "trouble").forEach { assertTrue(it in ids, "section $it") }
        assertTrue(ids.indexOf("open") < ids.indexOf("request") && ids.indexOf("request") < ids.indexOf("approve") &&
            ids.indexOf("approve") < ids.indexOf("unlock") && ids.indexOf("unlock") < ids.indexOf("check"), "in order: $ids")
        assertEquals(GuideSection.Who.OWNER, g.sections.first { it.id == "approve" }.who, "approval happens on the owner's phone")
        assertTrue(g.sections.filter { it.id != "trouble" }.all { it.steps.isNotEmpty() }, "every step section has steps")
        assertTrue(g.sections.first { it.id == "trouble" }.faq.size >= 5, "a real troubleshooting list")
        assertEquals(ids.size, ids.toSet().size, "unique section ids")
    }

    @Test fun mentionsWhatTheScreensSay() {
        // the guide names buttons the apps really have; a renamed button must be renamed here too
        val text = g.sections.joinToString("\n") { s -> (s.steps + s.faq.flatMap { listOf(it.q, it.a) }).joinToString("\n") }
        listOf("Kérés QR-kódja", "QR beolvasása", "Kérés beillesztése", "Engedély beillesztése", "Megjelenés", "Jóváhagyott eszköz")
            .forEach { assertTrue(it in text, "the guide mentions \"$it\"") }
    }

    @Test fun badInputIsNull() {
        assertNull(IphoneGuide.parse("nem json"))
        assertNull(IphoneGuide.parse("""{"url":"http://x","title":"t","intro":"i","sections":[]}"""))
    }
}
