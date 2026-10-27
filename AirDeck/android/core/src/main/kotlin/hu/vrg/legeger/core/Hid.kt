package hu.vrg.legeger.core

// The Bluetooth HID personality: one combined device with three report ids, so the PC sees a
// mouse, a keyboard and a media remote without any software on its side.
//
//   id 1  mouse     buttons(5 bits) · x · y · wheel · AC pan        5 bytes
//   id 2  keyboard  modifiers · reserved · 6 key usages              8 bytes
//   id 3  consumer  one 16-bit usage (volume, play/pause, ...)       2 bytes
//
// BluetoothHidDevice.sendReport(device, id, data) takes the id separately: the arrays built here
// never include it.

object Hid {
    const val ID_MOUSE = 1
    const val ID_KEYBOARD = 2
    const val ID_CONSUMER = 3

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
    )

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
        else -> ByteArray(0)
    }

    fun clamp8(v: Int): Byte = v.coerceIn(-127, 127).toByte()

    private fun bytes(vararg v: Int) = ByteArray(v.size) { v[it].toByte() }
}
