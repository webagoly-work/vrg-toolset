package hu.vrg.legeger.core

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

// This module compiles against the desktop org.json, but the phone runs Android's built-in one, which
// has fewer methods. An extension on JSONObject / JSONArray named like a desktop member is silently
// replaced by that member (a member wins), and the phone then dies with NoSuchMethodError. That is how
// Protocol's toMap() crashed the app on 2026-11-06. Same test in kit-core.

class JsonNamesTest {
    private val ext = Regex("""fun\s+(JSONObject|JSONArray)\??\.(\w+)\s*\(""")

    @Test fun noJsonExtensionShadowsADesktopMember() {
        val members = mapOf(
            "JSONObject" to JSONObject::class.java.methods.map { it.name }.toSet(),
            "JSONArray" to JSONArray::class.java.methods.map { it.name }.toSet(),
        )
        val clashes = File("src/main").walkTopDown().filter { it.extension == "kt" }.flatMap { f ->
            ext.findAll(f.readText()).filter { it.groupValues[2] in members.getValue(it.groupValues[1]) }
                .map { "${f.name}: ${it.groupValues[1]}.${it.groupValues[2]}()" }
        }.toList()
        assertTrue(clashes.isEmpty(), "rename these extensions: $clashes")
    }

    @Test fun aStateMessageParsesIntoAPlainMap() {
        val m = Inbound.parse("""{"type":"state","from":"planner","payload":{"tool":"pen","n":2,"x":null}}""")
        val s = assertIs<Incoming.State>(m)
        assertEquals(mapOf("tool" to "pen", "n" to 2, "x" to null), s.fields)
    }
}
