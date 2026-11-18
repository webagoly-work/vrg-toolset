package hu.vrg.mobile.core

// The home screen's layout (WP M32, D-35): what sits where, as plain data, shared by both homes (the Asztal's home
// window and the Kompakt tile home), so they show the same things in the same order and a test can check that every
// catalogue entry is reachable from the home exactly once.
//
//   1. the hero: VRG Sketcher, full width, with its plugins as chips on it (Fotópont);
//   2. the quick row: four pinned features, one tap each (the QR scan, Légegér, Átadás, Gyorsjegyzet);
//   3. the catalogue's groups, minus what is already above, each one foldable (the folded set is a ShellPrefs value).
//
// Ids only point at Catalogue entries; nothing here renames or re-ids a feature (deep links `vrg://<id>` use them).

object HomeLayout {
    /** The field survey instrument: always the first thing on the home, one tap (D-35). */
    val HERO: FeatureInfo = Catalogue.SKETCH

    /** The hero's plugins, drawn as chips on the hero card instead of tiles of their own. */
    val HERO_PLUGINS: List<FeatureInfo> = listOf(Catalogue.PHOTO)

    /** The quick row, left to right. PAIR's slot starts the QR scanner at once (the 2026-11-14 scan button). */
    val QUICK: List<FeatureInfo> = listOf(Catalogue.PAIR, Catalogue.AIRDECK, Catalogue.DROP, Catalogue.NOTES)

    /** Groups folded on a fresh install: Alkalmazás holds the shell's own parts, reachable from the header too. */
    val DEFAULT_FOLDED: Set<Group> = setOf(Group.APP)

    /** The ids above the groups, which the groups therefore leave out. */
    val pinnedIds: Set<String> get() = (listOf(HERO) + HERO_PLUGINS + QUICK).map { it.id }.toSet()

    /** The catalogue's groups in order, without the pinned entries; a group left empty is dropped. */
    fun sections(all: List<FeatureInfo> = Catalogue.ALL): List<Pair<Group, List<FeatureInfo>>> {
        val pinned = pinnedIds
        return Group.entries.map { g -> g to all.filter { it.group == g && it.id !in pinned } }.filter { it.second.isNotEmpty() }
    }

    /** Lying down the home splits: the hero and the quick row take this share of the width on the left, the groups the rest. */
    const val LANDSCAPE_LEFT = 0.4f

    /** Below this width (dp) a wider-than-tall space still gets the upright column, e.g. a Lapok cell holding the home. */
    const val SPLIT_MIN_WIDTH_DP = 600

    /** Icon columns for the groups' grid: 4 upright (the user's choice), 5 in the right-hand pane lying down. */
    fun columns(landscape: Boolean): Int = if (landscape) 5 else 4
}
