package hu.vrg.mobile.core

// Fényjel R1 (shared/fenyjel/DESIGN.md §5, §10): every catalogue feature's pixel glyph. The glyph's family colours it
// (DESIGN.md §4.1), so this map also decides which colour a feature wears everywhere on the phone. FeatureInfo.glyph
// (the old emoji / Unicode sign) stays as the text fallback for places that can only show a string (notifications,
// a share sheet title), and for a feature added to the catalogue before its glyph is drawn.
// FeatureIconsTest: every catalogue id has a glyph here and every glyph named here exists.

object FeatureIcons {
    /** Catalogue id → glyph name in [PixelGlyphs]. */
    val BY_FEATURE: Map<String, String> = mapOf(
        // Kapcsolat (link)
        "airdeck" to "mouse", "pair" to "pair", "net" to "net", "drop" to "drop", "screen" to "screen",
        "pcwin" to "pcwin", "watch" to "watch", "devices" to "devices",
        // Futtatás (run)
        "launch" to "launch", "apps" to "apps", "ports" to "ports", "city" to "city", "pulse" to "pulse",
        "desk" to "desk", "sheets" to "sheets", "devlap" to "devlap",
        // Tudás (know)
        "notes" to "notes", "stack" to "stack", "archive" to "archive", "sphere" to "sphere", "claude" to "claude",
        "catalog" to "catalog", "web" to "web",
        // Tervezés (plan)
        "planner" to "planner", "sketch" to "sketch", "photo" to "photo", "map" to "map",
        // Anyag és pénz (stock)
        "inventory" to "inventory", "calc" to "calc", "workflow" to "quote",
        // Jelzés (alert)
        "inbox" to "inbox", "pager" to "pager", "radar" to "radar", "tag" to "tag",
        // Környezet (env)
        "weather" to "weather",
        // Rendszer (sys)
        "settings" to "settings", "account" to "account", "update" to "update", "vault" to "vault",
    )

    /**
     * Fényjel R2: a tile shows ONE word (DESIGN.md §2 rule 1). The glyph's own name is the word, except where that is
     * too long for a 4-column tile or names the glyph rather than the feature; the full title is behind the i button.
     */
    val SHORT: Map<String, String> = mapOf(
        "apps" to "Appok", "inbox" to "Jelzések", "settings" to "Beállítás", "tag" to "Tárgyak", "stack" to "Verem",
        "pcwin" to "PC ablak", "workflow" to "Workflow", "account" to "Fiók", "airdeck" to "Légegér", "calc" to "Kalkulátor",
    )

    /** The one word under a feature's tile. */
    fun label(f: FeatureInfo): String = SHORT[f.id] ?: of(f)?.hu ?: f.title

    /** The family's Hungarian name ("Kapcsolat"), or null without a glyph. */
    fun familyName(featureId: String?): String? = familyOf(featureId)?.let { PixelGlyphs.FAMILY_NAMES[it] }

    /** The pixel glyph of a catalogue feature, or null when it has none yet (show [FeatureInfo.glyph] then). */
    fun of(featureId: String?): PixelGlyph? = PixelGlyphs.byName(BY_FEATURE[featureId])

    fun of(f: FeatureInfo): PixelGlyph? = of(f.id)

    /** The family a feature belongs to ("run", "link", …), or null without a glyph. */
    fun familyOf(featureId: String?): String? = of(featureId)?.family
}
