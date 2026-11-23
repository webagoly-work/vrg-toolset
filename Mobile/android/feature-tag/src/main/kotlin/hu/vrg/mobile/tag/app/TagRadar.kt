package hu.vrg.mobile.tag.app

import hu.vrg.mobile.core.Blip
import hu.vrg.mobile.core.LatLon
import hu.vrg.mobile.core.RadarLayer
import hu.vrg.mobile.core.RadarSource
import hu.vrg.mobile.core.RadarTone
import hu.vrg.mobile.pager.Trend
import hu.vrg.mobile.tag.Battery
import hu.vrg.mobile.tag.FORGET_MS
import hu.vrg.mobile.tag.Seen
import hu.vrg.mobile.tag.TAG_TX1M
import hu.vrg.mobile.tag.TagType

// The Tárgykereső on the radar (WP M66): two layers in kit-core RadarHub. "Saját címke" is mine (the ISYTag, the
// iTag or the paired Q71): live with its distance, trend and RSSI (so Irány keresése works on it), or — when not heard
// for a minute — its last place, which the radar turns into a GPS bearing. "Címkék a közelben" is every other tag heard.

private fun trendOf(s: Seen, now: Long): Int = when (s.rssi.trend(now)) { Trend.CLOSER -> 1; Trend.AWAY -> -1; else -> 0 }

object MineLayer : RadarSource {
    override val layer = RadarLayer("tag", "Saját címke", "🏷", RadarTone.SAND, feature = "tag")

    override fun blips(now: Long): List<Blip> {
        val m = Tags.book.mine ?: return emptyList()
        val s = Tags.book.mineSeen()
        val age = if (m.lastSeenAt > 0) now - m.lastSeenAt else Long.MAX_VALUE
        val linked = Tags.linkedTo(m.address)
        val detail = listOfNotNull(
            m.type.hu,
            m.batteryPct?.let { "elem $it%" } ?: m.battery.takeIf { it != Battery.UNKNOWN }?.let { "elem ${it.hu}" },
            if (linked) "kapcsolódva" else null,
        ).joinToString(" · ")
        if (age <= 60_000 || linked) {
            return listOf(Blip("tag:mine", layer.id, m.name,
                distanceM = s?.takeIf { it.age(now) <= 15_000 }?.distance(m.tx1m),
                trend = s?.let { trendOf(it, now) } ?: 0, ageMs = if (linked) 0 else age, linked = linked, mine = true,
                detail = detail, rssi = s?.takeIf { it.age(now) <= 5_000 }?.rssi?.raw))
        }
        // not heard for a minute: its last place, if there is one
        val lat = m.lastLat; val lon = m.lastLon
        if (lat == null || lon == null) return emptyList()
        return listOf(Blip("tag:mine", layer.id, "${m.name} (utoljára)", ageMs = age, mine = true,
            detail = "utoljára itt hallottam · $detail", place = LatLon(lat, lon)))
    }

    override fun watch(on: Boolean) { Tags.screenForeground(on) }
}

object AroundLayer : RadarSource {
    override val layer = RadarLayer("tags", "Címkék a közelben", "·", RadarTone.MUTED, feature = "tag")

    override fun blips(now: Long): List<Blip> {
        val mine = Tags.book.mine?.address
        return Tags.book.around(now).filter { it.address != mine && it.age(now) <= minOf(FORGET_MS, 120_000L) }.map { s ->
            Blip("tags:${s.address}", layer.id, s.ad.type.takeIf { it != TagType.UNKNOWN }?.hu ?: "címke",
                distanceM = s.distance(TAG_TX1M), trend = trendOf(s, now), ageMs = s.age(now),
                detail = listOfNotNull(s.ad.kind.hu, if (Tags.book.isBackground(s.address)) "biztosan nem a tiéd" else null).joinToString(" · "),
                rssi = s.takeIf { it.age(now) <= 5_000 }?.rssi?.raw)
        }
    }
}
