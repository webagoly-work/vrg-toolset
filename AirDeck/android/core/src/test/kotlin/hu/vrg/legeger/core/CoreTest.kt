package hu.vrg.legeger.core

import org.json.JSONObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ProtocolTest {
    private val env = Envelopes("test", clock = { 1000L })

    @Test fun helloMatchesTheEnvelopeOf07aLink() {
        val o = JSONObject(env.hello())
        assertEquals(1, o.getInt("v"))
        assertEquals("phone", o.getString("from"))
        assertEquals(1, o.getInt("seq"))
        assertEquals("hello", o.getString("type"))
        assertEquals("phone", o.getJSONObject("payload").getString("role"))
        assertTrue(o.getJSONObject("payload").getJSONArray("caps").toList().contains("state"))
        assertFalse(o.has("to"))
    }

    @Test fun seqCountsUpAndToIsCarried() {
        env.hello()
        val o = JSONObject(env.cmd("time.step", "codecity", mapOf("d" to -1)))
        assertEquals(2, o.getInt("seq"))
        assertEquals("codecity", o.getString("to"))
        assertEquals("time.step", o.getJSONObject("payload").getString("id"))
        assertEquals(-1, o.getJSONObject("payload").getInt("d"))
    }

    @Test fun parsesPlannerHelloTools() {
        val raw = """{"v":1,"from":"planner","seq":1,"t":0,"type":"hello","payload":{"role":"planner","app":"2.0","caps":["state"],
            "tools":[{"mode":"device","key":"1","hint":"Eszköz — kattints"},{"mode":"path","key":null,"hint":""}]}}"""
        val h = assertIs<Incoming.Hello>(Inbound.parse(raw))
        assertEquals("planner", h.role)
        assertEquals(2, h.tools.size)
        assertEquals("Eszköz", h.tools[0].label)
        assertEquals("path", h.tools[1].label)
        assertNull(h.tools[1].key)
    }

    @Test fun ownEchoAndJunk() {
        assertIs<Incoming.Echo>(Inbound.parse(env.hello()))
        assertIs<Incoming.Junk>(Inbound.parse("not json"))
    }

    @Test fun rosterAndFocusFromRelay() {
        val raw = """{"v":1,"from":"relay","type":"roster","payload":{"peers":[{"role":"planner","app":"x"},{"role":"phone","app":null}],
            "focus":{"role":"codecity","app":"codecity","title":"K","t":1}}}"""
        val r = assertIs<Incoming.Roster>(Inbound.parse(raw))
        assertEquals(listOf("planner", "phone"), r.peers.map { it.role })
        assertEquals("codecity", r.focus?.role)
        val f = assertIs<Incoming.FocusChanged>(Inbound.parse("""{"from":"planner","type":"focus","payload":{"app":"planner"}}"""))
        assertEquals("planner", f.focus.role)
    }

    @Test fun stateAndAck() {
        val s = assertIs<Incoming.State>(Inbound.parse("""{"from":"planner","type":"state","payload":{"mode":"wire","level":null,"flat":true}}"""))
        assertEquals(listOf("wire", "2D"), Profiles.stateBits(Target.PLANNER, s.fields))
        val a = assertIs<Incoming.Ack>(Inbound.parse("""{"from":"codecity","type":"ack","payload":{"id":"x","ok":false,"reason":"unknown command"}}"""))
        assertFalse(a.ok); assertEquals("unknown command", a.reason)
    }
}

class HidTest {
    @Test fun reportSizes() {
        assertEquals(5, Hid.mouse(1, 300, -300).size)
        assertEquals(127.toByte(), Hid.mouse(0, 300, 0)[1])
        assertEquals((-127).toByte(), Hid.mouse(0, 0, -300)[2])
        assertEquals(8, Hid.keyboard(Hid.Mod.LCTRL, 0x1D).size)
        assertEquals(listOf(0xE9.toByte(), 0.toByte()), Hid.consumer(Hid.Consumer.VOL_UP).toList())
    }

    @Test fun descriptorIsBalanced() {
        val d = Hid.DESCRIPTOR.map { it.toInt() and 0xFF }
        // walk the short items: collections opened (0xA1) must equal those closed (0xC0)
        var i = 0; var depth = 0; var ids = 0
        while (i < d.size) {
            val b = d[i]
            val size = when (b and 0x03) { 3 -> 4; else -> b and 0x03 }
            if (b == 0xA1) depth++
            if (b == 0xC0) depth--
            if (b == 0x85) ids++
            i += 1 + size
        }
        assertEquals(d.size, i)
        assertEquals(0, depth)
        assertEquals(3, ids)
    }
}

class KeysTest {
    @Test fun chords() {
        assertEquals(Chord(Hid.Mod.LCTRL or Hid.Mod.LSHIFT, 0x1D), Keys.chord("Ctrl+Shift+Z"))
        assertEquals(Chord(Hid.Mod.LGUI, 0x07), Keys.chord("Win+D"))
        assertEquals(Chord(Hid.Mod.LGUI, 0), Keys.chord("Win"))
        assertEquals(Chord(0, 0x29), Keys.chord("Escape"))
        assertEquals(Chord(Hid.Mod.LALT, 0x3D), Keys.chord("Alt+F4"))
        assertNull(Keys.chord("Ctrl+Nonsense"))
    }

    @Test fun hungarianSwapsYandZandHasAccents() {
        assertEquals(0x1D, HuLayout.map('y')!!.usage)
        assertEquals(0x1C, HuLayout.map('z')!!.usage)
        assertEquals(Chord(0, 0x35), HuLayout.map('0'))
        assertEquals(Chord(0, 0x33), HuLayout.map('é'))
        assertEquals(Chord(Hid.Mod.LSHIFT, 0x34), HuLayout.map('Á'))
        assertEquals(Chord(Hid.Mod.RALT, 0x19), HuLayout.map('@'))
        assertEquals(Chord(0, 0x1C), UsLayout.map('y'))
        "Árvíztűrő tükörfúrógép".forEach { assertTrue(HuLayout.map(it) != null, "missing $it") }
    }
}

class MotionTest {
    @Test fun stillHandDoesNotMove() {
        val p = AirPointer()
        repeat(100) { assertEquals(0 to 0, p.step(0.01f, 0f, -0.01f, 0.01f)) }
    }

    @Test fun turningLeftMovesLeftAndPitchUpMovesUp() {
        val p = AirPointer(AirTuning(smoothing = 0f))
        var sx = 0; var sy = 0
        repeat(50) { val (dx, dy) = p.step(0.5f, 0f, 0.5f, 0.01f); sx += dx; sy += dy }
        assertTrue(sx < 0, "x=$sx"); assertTrue(sy < 0, "y=$sy")
    }

    @Test fun slowAimStillAccumulates() {
        val p = AirPointer(AirTuning(smoothing = 0f))
        var sx = 0
        repeat(200) { sx += p.step(0f, 0f, -0.08f, 0.01f).first }
        assertTrue(sx > 0)
    }

    @Test fun flickAndRefractory() {
        val f = FlickDetector()
        assertEquals(Flick.RIGHT, f.step(0.5f, -9f, 0))
        assertNull(f.step(0.5f, -9f, 100))
        assertEquals(Flick.UP, f.step(9f, 0.2f, 600))
        assertNull(f.step(8f, 7.5f, 2000))       // no clear axis: nothing
    }

    @Test fun scrubSteps() {
        val s = Scrubber(0.2f)
        var n = 0
        repeat(10) { n += s.step(1f, 0.05f) }      // 0.5 rad
        assertEquals(2, n)
        repeat(10) { n += s.step(-1f, 0.05f) }
        assertEquals(0, n)
    }

    @Test fun poseFlatIsTopDown() {
        val (pitch, yaw) = Pose.fromAndroid(0f, 0f)
        assertEquals(90.0, pitch)
        assertEquals(0.0, yaw)
        assertEquals(5.0, Pose.fromAndroid((-Math.PI / 2).toFloat(), 0f).first, 0.001)
    }

    @Test fun wheelNotches() {
        val w = WheelAccumulator(20f)
        assertEquals(0, w.step(15f)); assertEquals(1, w.step(10f)); assertEquals(-1, w.step(-30f))
    }
}

class RelayUrlTest {
    @Test fun normalizes() {
        assertEquals("ws://192.168.1.24:47291", RelayUrl.normalize(" 192.168.1.24 "))
        assertEquals("ws://192.168.1.24:47292", RelayUrl.normalize("http://192.168.1.24:47292/phone-sender.html"))
        assertEquals("ws://pc:47291", RelayUrl.normalize("ws://pc:47291/"))
        assertEquals("wss://x:443", RelayUrl.normalize("https://x:443"))
        assertEquals("", RelayUrl.normalize("  "))
    }
}
