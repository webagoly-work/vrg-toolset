package hu.vrg.mobile.pager.app

import hu.vrg.mobile.core.Blip
import hu.vrg.mobile.core.RadarLayer
import hu.vrg.mobile.core.RadarSource
import hu.vrg.mobile.core.RadarTone
import hu.vrg.mobile.pager.Trend

// The Csipogó crew on the radar (WP M66): every phone heard (or linked) in the last minute, with its distance, trend,
// battery and live RSSI (so Irány keresése can find a person too); an alarm or an armed guard pulses. Reads only: the
// radar never starts the pager's radio, that stays the user's tap in Csipogó.

object PagerRadar : RadarSource {
    override val layer = RadarLayer("pager", "Csipogó", "📟", RadarTone.CURRENT, feature = "pager")

    override fun blips(now: Long): List<Blip> = Pager.engine.peers(now)
        .filter { it.linked || it.ageMs <= 60_000 }
        .map { p ->
            Blip("pager:${p.unit}", layer.id, p.name,
                distanceM = p.distanceM,
                trend = when (p.trend) { Trend.CLOSER -> 1; Trend.AWAY -> -1; else -> 0 },
                ageMs = if (p.linked) 0 else p.ageMs, linked = p.linked, alert = p.alarm,
                detail = listOfNotNull("${p.unit}. egység", p.battery?.let { "akku $it%" },
                    if (p.viaRelay) "átjátszón át" else null, if (p.talking) "beszél" else null,
                    if (p.armed) "őrzés" else null, if (p.alarm) "RIASZTÁS" else null).joinToString(" · "),
                rssi = p.rssi?.takeIf { p.ageMs <= 5_000 })
        }
}
