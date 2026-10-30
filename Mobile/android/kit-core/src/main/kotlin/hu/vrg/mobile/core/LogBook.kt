package hu.vrg.mobile.core

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// The app's own log: the last lines every feature wrote, shown in Beállítások → Napló (WP M1).
// A ring buffer, safe to write from any thread. kit's VrgLog wraps it with a StateFlow and Logcat.

data class LogLine(val at: Long, val tag: String, val text: String, val warn: Boolean = false) {
    fun format(): String = "${TIME.get().format(Date(at))} ${if (warn) "!" else " "} $tag  $text"

    private companion object {
        val TIME: ThreadLocal<SimpleDateFormat> = ThreadLocal.withInitial { SimpleDateFormat("HH:mm:ss", Locale.ROOT) }
    }
}

class LogBook(val capacity: Int = 200) {
    private val lines = ArrayDeque<LogLine>(capacity)

    /** Adds a line and returns the buffer as it now stands, oldest first. */
    @Synchronized
    fun add(line: LogLine): List<LogLine> {
        if (lines.size == capacity) lines.removeFirst()
        lines.addLast(line)
        return lines.toList()
    }

    @Synchronized
    fun lines(): List<LogLine> = lines.toList()

    @Synchronized
    fun clear() = lines.clear()
}
