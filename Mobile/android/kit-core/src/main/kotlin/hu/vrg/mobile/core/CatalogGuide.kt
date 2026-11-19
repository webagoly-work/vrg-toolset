package hu.vrg.mobile.core

// Katalógus (2026-11-19): one page per program / feature / function of VRG Mobile and the VRG Desktop, for a new user
// finding their way around. Plain data, Hungarian text (it is phone UI), shown by the shell's Katalógus screen as
// swipeable pages in the home's order, then the Desktop's own programs. CatalogGuideTest checks it against Catalogue.

/** Where a program lives. */
enum class GuideSide(val label: String) {
    PHONE("Telefon"),
    DESKTOP("Asztal (PC)"),
    BOTH("Telefon és Asztal"),
}

data class GuidePage(
    /** The Catalogue feature id when the phone has it (the page offers "Megnyitás"), else a Desktop unit id prefixed "desk:". */
    val id: String,
    val title: String,
    val glyph: String,
    val side: GuideSide,
    /** One or two sentences: what it is for. */
    val what: String,
    /** Two to five short steps or facts: how it is used day to day. */
    val how: List<String>,
    /** What it needs (Bluetooth, the PC's relay, GitHub sign-in, camera, internet), or null. */
    val needs: String? = null,
    /** Its counterpart on the other side, if any (e.g. the Desktop page of the Sketcher), or null. */
    val pair: String? = null,
)

object CatalogGuide {
    /** Filled in by the content pass; the order is the home's page order, then the Desktop-only programs. */
    val PAGES: List<GuidePage> = emptyList()

    fun byId(id: String): GuidePage? = PAGES.firstOrNull { it.id == id }
}
