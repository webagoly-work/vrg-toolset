package hu.vrg.mobile.watch.app

import hu.vrg.mobile.core.Blip
import hu.vrg.mobile.core.RadarLayer
import hu.vrg.mobile.core.RadarSource
import hu.vrg.mobile.core.RadarTone

// The Óra on the radar (WP M67): the Q71 while its link is up. A held BLE link means "within Bluetooth range", not a
// distance, so the blip sits on the unknown-distance band, linked; its card opens the Óra.

object WatchRadar : RadarSource {
    override val layer = RadarLayer("watch", "Óra", "⌚", RadarTone.GLOW, feature = "watch")

    override fun blips(now: Long): List<Blip> {
        val link = Watch.link.value
        if (link != Watch.Link.READY) return emptyList()
        return listOf(Blip("watch:q71", layer.id, "Q71", linked = true, detail = link.hu + (Watch.version.value?.let { " · fw $it" } ?: "")))
    }
}
