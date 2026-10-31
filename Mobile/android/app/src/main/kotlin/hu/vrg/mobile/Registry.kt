package hu.vrg.mobile

import hu.vrg.legeger.AirDeckFeature
import hu.vrg.mobile.account.AccountFeature
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.FeatureInfo
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.notes.NotesFeature
import hu.vrg.mobile.pair.PairFeature
import hu.vrg.mobile.settings.SettingsFeature
import hu.vrg.mobile.update.UpdateFeature

// The features built into this APK. Adding one: a feature-<id> module with an object implementing
// VrgFeature, its FeatureInfo in Catalogue (stage LIVE or BETA), a line here, and the module in
// settings.gradle.kts + app/build.gradle.kts. A catalogue entry without a line here is shown as a
// plan (PlannedScreen), so the home screen is the roadmap too.

object Registry {
    val built: List<VrgFeature> = listOf(
        AirDeckFeature,
        SettingsFeature,
        PairFeature,
        AccountFeature,
        NotesFeature,
        UpdateFeature,
    )

    fun feature(id: String?): VrgFeature? = built.firstOrNull { it.info.id == id }

    fun isBuilt(info: FeatureInfo): Boolean = feature(info.id) != null

    /** The catalogue as the home screen shows it. */
    val catalogue get() = Catalogue.grouped()
}
