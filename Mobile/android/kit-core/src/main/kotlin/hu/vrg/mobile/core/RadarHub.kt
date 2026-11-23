package hu.vrg.mobile.core

import java.util.concurrent.CopyOnWriteArrayList

// RadarHub (WP M67, D-174): where programs plug into the radar. A feature registers a RadarSource in its init() — the
// Tárgykereső its tags and paired devices, the Csipogó the crew, the Óra the watch, a later program its own thing — and
// every radar on screen (the Radar feature, the radar inside Tárgykereső or Csipogó) asks the hub for one frame.
// Features never talk to each other: they talk to the hub (architecture rule 2).
//
// Directions found by "Irány keresése" are kept here as compass bearings per blip id, for [SWEEP_KEEP_MS], so every
// radar shows them and they survive leaving the screen. Pure Kotlin: RadarHubTest drives it with fake sources.

interface RadarSource {
    val layer: RadarLayer

    /** The blips now. Called a few times a second while a radar is on screen; keep it cheap, never block. */
    fun blips(now: Long): List<Blip>

    /** A radar showing this layer came on screen (true) or left (false): wake a scanner, or let it sleep. */
    fun watch(on: Boolean) {}
}

object RadarHub {
    const val SWEEP_KEEP_MS = 10 * 60_000L

    data class SweepFix(val bearingDeg: Double, val confidence: Double, val at: Long)

    private val sources = CopyOnWriteArrayList<RadarSource>()
    private val fixes = java.util.concurrent.ConcurrentHashMap<String, SweepFix>()
    private var watching = 0

    /** Adds a source, replacing one with the same layer id (a feature's init may run again). */
    @Synchronized fun register(source: RadarSource) {
        sources.removeAll { it.layer.id == source.layer.id }
        sources += source
        if (watching > 0) runCatching { source.watch(true) }
    }

    @Synchronized fun unregister(layerId: String) { sources.removeAll { it.layer.id == layerId } }

    fun layers(): List<RadarLayer> = sources.map { it.layer }

    /** Every source's blips; a source that throws is skipped (one broken program never blanks the radar). */
    fun blips(now: Long, only: Set<String>? = null): List<Blip> = sources
        .filter { only == null || it.layer.id in only }
        .flatMap { s -> runCatching { s.blips(now) }.getOrDefault(emptyList()).filter { it.layer == s.layer.id } }

    /** One frame for a radar; [only] limits it to some layers (the radar inside a feature). */
    fun frame(now: Long, headingDeg: Double?, here: LatLon?, mode: RadarMode, only: Set<String>? = null): RadarFrame =
        RadarFrame(layers().filter { only == null || it.id in only }, blips(now, only), headingDeg, here, mode)

    /** A radar came on screen / left; the first and the last one wake and calm the sources. */
    @Synchronized fun watch(on: Boolean) {
        val before = watching
        watching = (watching + if (on) 1 else -1).coerceAtLeast(0)
        if ((before == 0) != (watching == 0)) sources.forEach { s -> runCatching { s.watch(watching > 0) } }
    }

    val watched: Boolean get() = watching > 0

    // ---- directions found by turning round ---------------------------------------------------------------------

    fun keepSweep(id: String, bearingDeg: Double, confidence: Double, now: Long) {
        fixes[id] = SweepFix(Radar.norm(bearingDeg), confidence, now)
    }

    fun dropSweep(id: String) { fixes.remove(id) }

    fun sweep(id: String, now: Long): SweepFix? = fixes[id]?.takeIf { now - it.at <= SWEEP_KEEP_MS }

    /** The kept bearings still young enough, for Radar.layout. */
    fun sweeps(now: Long): Map<String, Double> {
        fixes.entries.removeAll { now - it.value.at > SWEEP_KEEP_MS }
        return fixes.mapValues { it.value.bearingDeg }
    }

    /** For tests: forget everything. */
    @Synchronized fun reset() { sources.clear(); fixes.clear(); watching = 0 }
}
