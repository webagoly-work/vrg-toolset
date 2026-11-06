package hu.vrg.mobile.kit

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

// The PC's mouse pointer, for features other than Légegér (WP M13: Képernyő's steering strip).
// A feature never talks to another feature directly (architecture rule 2), so Légegér registers its
// existing sender here (its Bluetooth HID mouse and the gyro clutch) and Képernyő uses it through the
// kit. This adds no new way of controlling the PC: without Légegér's Bluetooth link nothing moves.

interface PointerSink {
    /** The PC is connected and will take mouse input now. */
    val ready: StateFlow<Boolean>

    /** Hold to move: while on, the phone's gyro moves the cursor (Légegér's clutch). */
    fun hold(on: Boolean)

    /** A finger drag on the strip, in screen pixels. */
    fun drag(dx: Float, dy: Float)

    fun click(right: Boolean)
}

object Pointer {
    private val none = MutableStateFlow(false)

    @Volatile var sink: PointerSink? = null

    /** False until a sink is registered and its PC is connected. */
    val ready: StateFlow<Boolean> get() = sink?.ready ?: none
}
