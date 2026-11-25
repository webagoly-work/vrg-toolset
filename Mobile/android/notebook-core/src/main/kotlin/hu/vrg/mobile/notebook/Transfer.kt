package hu.vrg.mobile.notebook

// Export and import: the whole store as one plain JSON file the owner keeps (the "Keep" direction: nothing is lost when
// the app is). Import merges, never replaces: an entry on both sides keeps the newer copy, a deletion on either side
// wins, and the kits switched on and the dismissed items are added up. Merging the same file twice changes nothing.

data class Merge(val store: Store, val added: Int, val updated: Int, val removed: Int) {
    val changed get() = added + updated + removed > 0
    fun describe(): String =
        if (!changed) "Nincs új a fájlban." else listOfNotNull(
            added.takeIf { it > 0 }?.let { "$it új" },
            updated.takeIf { it > 0 }?.let { "$it frissebb" },
            removed.takeIf { it > 0 }?.let { "$it törölt" },
        ).joinToString(", ") + " bejegyzés."
}

object Transfer {
    /** The file name an export suggests: vrg-fuzet-ÉÉÉÉ-HH-NN.json */
    fun fileName(day: java.time.LocalDate) = "vrg-fuzet-$day.json"

    fun export(store: Store): String = store.copy(draft = "").write()

    fun merge(local: Store, incoming: Store): Merge {
        val gone = local.gone + incoming.gone
        val mine = local.entries.associateBy { it.id }
        var added = 0; var updated = 0
        val merged = LinkedHashMap<String, Entry>()
        local.entries.forEach { merged[it.id] = it }
        incoming.entries.forEach { e ->
            val m = mine[e.id]
            when {
                e.id in gone -> {}
                m == null -> { merged[e.id] = e; added++ }
                e.touched > m.touched -> { merged[e.id] = e; updated++ }
            }
        }
        val removed = merged.keys.count { it in gone }
        gone.forEach { merged.remove(it) }
        val entries = merged.values.map { e -> if (e.links.any { it in gone }) e.copy(links = e.links.filterNot { it in gone }) else e }
        return Merge(
            local.copy(entries = entries, gone = gone, kitsOn = local.kitsOn + incoming.kitsOn, dismissed = local.dismissed + incoming.dismissed),
            added, updated, removed,
        )
    }
}
