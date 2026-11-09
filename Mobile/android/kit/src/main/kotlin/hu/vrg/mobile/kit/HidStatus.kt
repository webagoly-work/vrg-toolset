package hu.vrg.mobile.kit

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

// Légegér's Bluetooth HID state, for the Hálózat screen (WP M7). Features never talk to each other directly
// (architecture rule 2): Légegér publishes here what its HidPeripheral already knows, Hálózat reads it. There
// is still one HID stack, Légegér's; this is a read-only mirror.

enum class HidPhase(val label: String) {
    UNKNOWN("Légegér még nem indult"),
    OFF("Ki (a Bluetooth ki van kapcsolva, vagy a HID nincs elindítva)"),
    NO_PERMISSION("Nincs Bluetooth engedély"),
    UNSUPPORTED("Ez a telefon nem tud Bluetooth HID eszköz lenni"),
    STARTING("Indul"),
    READY("Kész, PC-re vár"),
    CONNECTING("Csatlakozik"),
    CONNECTED("Csatlakozva"),
}

data class HidInfo(val phase: HidPhase = HidPhase.UNKNOWN, val host: String? = null)

object HidStatus {
    private val _info = MutableStateFlow(HidInfo())
    val info: StateFlow<HidInfo> = _info

    fun publish(i: HidInfo) { _info.value = i }
}
