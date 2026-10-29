package hu.vrg.legeger.core

// The Bluetooth HID personality: one combined device with three report ids, so the PC sees a
// mouse, a keyboard and a media remote without any software on its side.
//
//   id 1  mouse     buttons(5 bits) · x · y · wheel · AC pan        5 bytes
//   id 2  keyboard  modifiers · reserved · 6 key usages              8 bytes
//   id 3  consumer  one 16-bit usage (volume, play/pause, ...)       2 bytes
//   id 4  touch     2 contacts × (tip·range, id, x, y) + count      13 bytes
//
// The touchscreen (id 4) is what makes phone mode feel native: an Android phone on the other end
// sees a real multi-touch digitizer (Linux hid-multitouch, INPUT_PROP_DIRECT), so a finger on the pad
// is a finger on its screen — taps, long presses, swipes, edge gestures, pinch. Windows lists it as
// a touch screen too, which is harmless. iOS ignores HID digitizers; there the mouse is the fallback.
//
// BluetoothHidDevice.sendReport(device, id, data) takes the id separately: the arrays built here
// never include it.

object Hid {
    const val ID_MOUSE = 1
    const val ID_KEYBOARD = 2
    const val ID_CONSUMER = 3
    const val ID_TOUCH = 4

    /** Logical range of the touchscreen axes: 0..TOUCH_MAX, mapped by the host onto its display. */
    const val TOUCH_MAX = 32767
    const val TOUCH_CONTACTS = 2

    object Btn {
        const val LEFT = 0x01
        const val RIGHT = 0x02
        const val MIDDLE = 0x04
        const val BACK = 0x08
        const val FORWARD = 0x10
    }

    object Mod {
        const val LCTRL = 0x01
        const val LSHIFT = 0x02
        const val LALT = 0x04
        const val LGUI = 0x08
        const val RCTRL = 0x10
        const val RSHIFT = 0x20
        const val RALT = 0x40   // AltGr on the Hungarian layout
        const val RGUI = 0x80
    }

    object Consumer {
        const val PLAY_PAUSE = 0xCD
        const val NEXT = 0xB5
        const val PREV = 0xB6
        const val MUTE = 0xE2
        const val VOL_UP = 0xE9
        const val VOL_DOWN = 0xEA
        const val POWER = 0x30
        const val AC_SEARCH = 0x221
        const val AC_HOME = 0x223      // Android: HOME
        const val AC_BACK = 0x224      // Android: BACK
    }

    val DESCRIPTOR: ByteArray = bytes(
        // ---- mouse
        0x05, 0x01, 0x09, 0x02, 0xA1, 0x01, 0x85, ID_MOUSE,
        0x09, 0x01, 0xA1, 0x00,
        0x05, 0x09, 0x19, 0x01, 0x29, 0x05, 0x15, 0x00, 0x25, 0x01, 0x95, 0x05, 0x75, 0x01, 0x81, 0x02,
        0x95, 0x01, 0x75, 0x03, 0x81, 0x01,
        0x05, 0x01, 0x09, 0x30, 0x09, 0x31, 0x09, 0x38, 0x15, 0x81, 0x25, 0x7F, 0x75, 0x08, 0x95, 0x03, 0x81, 0x06,
        0x05, 0x0C, 0x0A, 0x38, 0x02, 0x15, 0x81, 0x25, 0x7F, 0x75, 0x08, 0x95, 0x01, 0x81, 0x06,
        0xC0, 0xC0,
        // ---- keyboard
        0x05, 0x01, 0x09, 0x06, 0xA1, 0x01, 0x85, ID_KEYBOARD,
        0x05, 0x07, 0x19, 0xE0, 0x29, 0xE7, 0x15, 0x00, 0x25, 0x01, 0x75, 0x01, 0x95, 0x08, 0x81, 0x02,
        0x95, 0x01, 0x75, 0x08, 0x81, 0x01,
        0x95, 0x06, 0x75, 0x08, 0x15, 0x00, 0x25, 0x65, 0x05, 0x07, 0x19, 0x00, 0x29, 0x65, 0x81, 0x00,
        0xC0,
        // ---- consumer control
        0x05, 0x0C, 0x09, 0x01, 0xA1, 0x01, 0x85, ID_CONSUMER,
        0x15, 0x00, 0x26, 0xFF, 0x03, 0x19, 0x00, 0x2A, 0xFF, 0x03, 0x75, 0x10, 0x95, 0x01, 0x81, 0x00,
        0xC0,
        // ---- touch screen, two contacts
        0x05, 0x0D, 0x09, 0x04, 0xA1, 0x01, 0x85, ID_TOUCH,
        *finger(), *finger(),
        0x05, 0x0D, 0x09, 0x54, 0x15, 0x00, 0x25, TOUCH_CONTACTS, 0x75, 0x08, 0x95, 0x01, 0x81, 0x02,   // contact count
        0x09, 0x55, 0x25, TOUCH_CONTACTS, 0x75, 0x08, 0x95, 0x01, 0xB1, 0x02,                     // contact count max (feature)
        0xC0,
    )

    /** One finger's logical collection: tip switch, in range, 6 bits pad, contact id, X, Y. */
    private fun finger(): IntArray = intArrayOf(
        0x05, 0x0D, 0x09, 0x22, 0xA1, 0x02,
        0x09, 0x42, 0x09, 0x32, 0x15, 0x00, 0x25, 0x01, 0x75, 0x01, 0x95, 0x02, 0x81, 0x02,
        0x75, 0x06, 0x95, 0x01, 0x81, 0x03,
        0x09, 0x51, 0x25, 0x7F, 0x75, 0x08, 0x95, 0x01, 0x81, 0x02,
        0x05, 0x01, 0x15, 0x00, 0x26, 0xFF, 0x7F, 0x75, 0x10, 0x95, 0x01,
        0x09, 0x30, 0x81, 0x02, 0x09, 0x31, 0x81, 0x02,
        0xC0,
    )

    /** A finger on the touchscreen. x, y in 0..TOUCH_MAX; `down` false = this finger just lifted. */
    data class Contact(val id: Int, val x: Int, val y: Int, val down: Boolean)

    /**
     * Up to two contacts. The ones listed are valid for this frame (lifted ones once more, with the
     * tip off, so the host sees the finger go up); the count tells the host how many slots to read.
     */
    fun touch(contacts: List<Contact>): ByteArray {
        val b = ByteArray(1 + 6 * TOUCH_CONTACTS)
        val list = contacts.take(TOUCH_CONTACTS)
        list.forEachIndexed { i, c ->
            val o = i * 6
            b[o] = (if (c.down) 0x03 else 0x00).toByte()
            b[o + 1] = (c.id and 0x7F).toByte()
            val x = c.x.coerceIn(0, TOUCH_MAX)
            val y = c.y.coerceIn(0, TOUCH_MAX)
            b[o + 2] = (x and 0xFF).toByte(); b[o + 3] = (x shr 8).toByte()
            b[o + 4] = (y and 0xFF).toByte(); b[o + 5] = (y shr 8).toByte()
        }
        b[6 * TOUCH_CONTACTS] = list.size.toByte()
        return b
    }

    /** Feature reports the host asks for with GET_REPORT(FEATURE). */
    fun feature(id: Int): ByteArray = when (id) {
        ID_TOUCH -> byteArrayOf(TOUCH_CONTACTS.toByte())
        else -> ByteArray(0)
    }

    fun mouse(buttons: Int, dx: Int, dy: Int, wheel: Int = 0, pan: Int = 0): ByteArray = byteArrayOf(
        (buttons and 0x1F).toByte(), clamp8(dx), clamp8(dy), clamp8(wheel), clamp8(pan),
    )

    fun keyboard(mods: Int, vararg usages: Int): ByteArray {
        val b = ByteArray(8)
        b[0] = (mods and 0xFF).toByte()
        usages.take(6).forEachIndexed { i, u -> b[2 + i] = (u and 0xFF).toByte() }
        return b
    }

    fun consumer(usage: Int): ByteArray = byteArrayOf((usage and 0xFF).toByte(), ((usage shr 8) and 0x03).toByte())

    /** An all-zero report of the right length, for GET_REPORT requests from the host. */
    fun idle(id: Int): ByteArray = when (id) {
        ID_MOUSE -> ByteArray(5)
        ID_KEYBOARD -> ByteArray(8)
        ID_CONSUMER -> ByteArray(2)
        ID_TOUCH -> ByteArray(1 + 6 * TOUCH_CONTACTS)
        else -> ByteArray(0)
    }

    fun clamp8(v: Int): Byte = v.coerceIn(-127, 127).toByte()

    private fun bytes(vararg v: Int) = ByteArray(v.size) { v[it].toByte() }

    /** Maps a point inside the on-screen frame of the target phone to touchscreen units. */
    fun touchUnits(x: Float, y: Float, left: Float, top: Float, width: Float, height: Float): Pair<Int, Int> {
        if (width <= 0f || height <= 0f) return 0 to 0
        val nx = ((x - left) / width).coerceIn(0f, 1f)
        val ny = ((y - top) / height).coerceIn(0f, 1f)
        return (nx * TOUCH_MAX).toInt() to (ny * TOUCH_MAX).toInt()
    }
}
