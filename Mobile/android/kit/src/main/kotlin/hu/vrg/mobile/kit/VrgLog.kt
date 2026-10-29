package hu.vrg.mobile.kit

import android.util.Log
import hu.vrg.mobile.core.LogBook
import hu.vrg.mobile.core.LogLine
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

// The one logger every feature uses: the last 200 lines for Beállítások → Napló, and Logcat for adb.
// The tag is the feature id, so the Napló reads "airdeck  Relé: kapcsolódva". Lines are in memory
// only and start empty with each process.

object VrgLog {
    private val book = LogBook(200)
    private val _lines = MutableStateFlow<List<LogLine>>(emptyList())
    val lines: StateFlow<List<LogLine>> = _lines

    fun i(tag: String, text: String) = add(tag, text, false)

    fun w(tag: String, text: String) = add(tag, text, true)

    fun clear() {
        book.clear()
        _lines.value = emptyList()
    }

    private fun add(tag: String, text: String, warn: Boolean) {
        if (warn) Log.w("VRG/$tag", text) else Log.i("VRG/$tag", text)
        _lines.value = book.add(LogLine(System.currentTimeMillis(), tag, text, warn))
    }
}
