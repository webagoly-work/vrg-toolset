package hu.vrg.mobile.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class AccessTest {
    @Test fun repoNameAcceptsTheUsualSpellings() {
        listOf("webagoly-work/vrg-toolset", "  Webagoly-Work/VRG-Toolset ", "vrg-toolset",
            "https://github.com/webagoly-work/vrg-toolset", "github.com/webagoly-work/vrg-toolset.git",
            "https://github.com/webagoly-work/vrg-toolset/").forEach { assertTrue(RepoName.matches(it), it) }
    }

    @Test fun repoNameRefusesOthers() {
        listOf("", "vrg", "webagoly-work", "someone/vrg-toolset", "webagoly-work/vrg-toolset-x").forEach {
            assertFalse(RepoName.matches(it), it)
        }
    }

    @Test fun deviceCodeIsStableAndShaped() {
        val c = DeviceGate.code("9774d56d682e549c")
        assertEquals(c, DeviceGate.code(" 9774D56D682E549C "))
        assertTrue(Regex("[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}").matches(c), c)
        assertNotEquals(c, DeviceGate.code("9774d56d682e549d"))
    }

    @Test fun gateOffLetsEveryoneIn() {
        assertTrue(DeviceGate.allowed(false, "AAAA-BBBB-CCCC", emptySet()))
    }

    @Test fun gateOnNeedsAListedCode() {
        val list = DeviceGate.parse("aaaa-bbbb-cccc, 1111 2222 3333\n")
        assertEquals(setOf("AAAABBBBCCCC", "111122223333"), list)
        assertTrue(DeviceGate.allowed(true, "AAAA-BBBB-CCCC", list))
        assertTrue(DeviceGate.allowed(true, "1111-2222-3333", list))
        assertFalse(DeviceGate.allowed(true, "AAAA-BBBB-CCCD", list))
        assertFalse(DeviceGate.allowed(true, "AAAA-BBBB-CCCC", emptySet()))
    }
}
