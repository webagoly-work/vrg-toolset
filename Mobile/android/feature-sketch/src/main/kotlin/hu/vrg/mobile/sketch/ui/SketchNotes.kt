package hu.vrg.mobile.sketch.ui

import hu.vrg.mobile.core.MirrorItem
import hu.vrg.mobile.kit.notes.Notes
import hu.vrg.mobile.sketch.Intake
import hu.vrg.mobile.sketch.Kit
import hu.vrg.mobile.sketch.Sketch

// The VRG Sketcher's Jegyzet front as an origin of VRG Jegyzetek (WP M68, D-178 = A, a linked mirror): every entry
// stays in the survey (it goes to the Planner with it) and the central app holds the same note, id
// `sketcher-<sketch>-<entry>`, tagged by its origin. The three-way rules are kit-core's NoteMirror.

object SketchNotes {
    const val ORIGIN = "sketcher"

    fun scope(s: Sketch) = s.id + "/"

    /** The survey's entries as the hub sees them. */
    fun items(s: Sketch, kit: Kit): List<MirrorItem> = s.entries.map { e ->
        val room = s.room(e.room)?.let { roomTitle(it.name, it.kinds) }
        MirrorItem(
            ref = s.id + "/" + e.id,
            text = e.text,
            label = listOfNotNull(s.name.ifBlank { "Felmérés" }, room).joinToString(" · "),
            facts = e.chips.mapNotNull { kit.chip(it)?.label ?: it },
            open = e.open,
        )
    }

    /** After an edit (the editor's save): the hub takes the survey's entries. */
    fun push(s: Sketch, kit: Kit) = Notes.mirror(ORIGIN, scope(s), items(s, kit))

    /** On opening a survey: texts edited in the central app come into the survey first. */
    fun pull(s: Sketch): Sketch = s.entries.fold(s) { acc, e ->
        Notes.pull(ORIGIN, s.id + "/" + e.id, e.text)?.let { Intake.editEntry(acc, e.id, it, e.chips) } ?: acc
    }

    /** A deleted survey: its notes stay in the hub, marked as gone from the source. */
    fun deleted(sketchId: String) = Notes.mirror(ORIGIN, "$sketchId/", emptyList())
}
