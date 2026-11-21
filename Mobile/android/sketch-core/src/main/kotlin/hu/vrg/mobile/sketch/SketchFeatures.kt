package hu.vrg.mobile.sketch

// F5 (WP M50) under the Founder's rule D-90: the features this fork added are built in and on, and each one (or all at
// once) can be switched off in ⚙ → Felmérés funkciók; the phone stores only what is OFF, so a later feature arrives on.
// A feature switched off leaves no trace in the UI or in what leaves the phone. Same shape as CameraFeatures.
object SketchFeatures {
    data class Feature(val id: String, val sym: String, val label: String, val blurb: String)

    const val CLIENT = "client"
    const val AUDIO = "audio"
    const val CSERE_OLD = "csere_old"
    const val LINE_CLOSE = "line_close"

    val ALL = listOf(
        Feature(CLIENT, "👤", "Ügyféladatok", "név, telefon, e-mail a Helyszínen (személyes adat)"),
        Feature(AUDIO, "🎙", "Hangjegyzet", "hangfelvétel, ha nincs beszédfelismerő"),
        Feature(CSERE_OLD, "↻", "Csere címke régi felmérésben", "megnyitáskor kiegészíti a címkéket"),
        Feature(LINE_CLOSE, "⌇", "Vonal: Kész zár", "a variáns lineClose beállítása (szoba / kérdés)"),
    )

    fun of(id: String) = ALL.firstOrNull { it.id == id }
    fun on(off: Set<String>, id: String) = id !in off
    fun all(on: Boolean): Set<String> = if (on) emptySet() else ALL.map { it.id }.toSet()
    fun allOn(off: Set<String>) = ALL.none { it.id in off }
    fun write(off: Set<String>) = off.sorted().joinToString(",")
    fun read(s: String?): Set<String> = s.orEmpty().split(',').map { it.trim() }.filter { it.isNotEmpty() }.toSet()

    /** A variant's drawing tune with the switches applied: lineClose only when on (D-83). */
    fun tune(off: Set<String>, t: DrawTune): DrawTune = if (on(off, LINE_CLOSE) || t.lineClose.isEmpty()) t else t.copy(lineClose = "")

    /** What the phone does when it opens a survey: the built-in Csere tag for an older one (D-80), when on. */
    fun onOpen(off: Set<String>, s: Sketch): Sketch = if (on(off, CSERE_OLD)) Tags.withBuiltins(s) else s

    /**
     * What leaves the phone: the client's contact only when the feature is on AND kept (D-82); the sound notes only when
     * the feature is on (D-84). The survey on the phone keeps both either way.
     */
    fun forExport(off: Set<String>, s: Sketch): Sketch {
        val c = if (on(off, CLIENT)) ClientInfo.forExport(s) else if (s.client == null) s else s.copy(client = null)
        return if (on(off, AUDIO) || c.captures.none { it.kind == CaptureKind.AUDIO }) c
        else c.copy(captures = c.captures.filter { it.kind != CaptureKind.AUDIO })
    }
}
