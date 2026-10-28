package hu.vrg.legeger.hid

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothClass
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothHidDevice
import android.bluetooth.BluetoothHidDeviceAppSdpSettings
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import hu.vrg.legeger.core.Chord
import hu.vrg.legeger.core.Hid
import hu.vrg.legeger.core.KeyLayout
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.util.concurrent.Executors

// The phone as a Bluetooth mouse + keyboard + media remote (Android 9+, BluetoothHidDevice).
//
// Flow: getProfileProxy(HID_DEVICE) -> registerApp(SDP record) -> the PC pairs with the phone ->
// the PC (or we) connect -> sendReport(). The app must be REGISTERED before the PC pairs, otherwise
// the PC caches a phone without an HID record and never offers it as an input device; unpair on the
// PC and pair again in that case.
//
// Some phone builds remove the HID Device profile entirely. getProfileProxy then returns false or
// never calls back, and the phase stays UNSUPPORTED: the relay half of the app still works.

@SuppressLint("MissingPermission")   // every entry point is gated by hasPermission()
class HidPeripheral(private val ctx: Context, private val scope: CoroutineScope) {

    enum class Phase { OFF, NO_PERMISSION, UNSUPPORTED, STARTING, READY, CONNECTING, CONNECTED }

    private val _phase = MutableStateFlow(Phase.OFF)
    val phase: StateFlow<Phase> = _phase
    private val _host = MutableStateFlow<BluetoothDevice?>(null)
    val host: StateFlow<BluetoothDevice?> = _host
    /** The connected host says it is a phone (Bluetooth class of device): phone mode can switch on by itself. */
    private val _hostIsPhone = MutableStateFlow(false)
    val hostIsPhone: StateFlow<Boolean> = _hostIsPhone

    /** Called with the MAC of every host that connects, so it can be remembered. */
    var onHostConnected: (String) -> Unit = {}
    /** The MAC to reconnect to as soon as the app is registered. */
    var preferredHost: String = ""

    private val adapter: BluetoothAdapter? = ctx.getSystemService(BluetoothManager::class.java)?.adapter
    private var hid: BluetoothHidDevice? = null
    private val exec = Executors.newSingleThreadExecutor()
    private var buttons = 0

    fun hasPermission(): Boolean =
        Build.VERSION.SDK_INT < 31 ||
            ctx.checkSelfPermission(android.Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

    val bluetoothOn: Boolean get() = adapter?.isEnabled == true

    fun start() {
        if (hid != null) return
        if (!hasPermission()) { _phase.value = Phase.NO_PERMISSION; return }
        val a = adapter ?: run { _phase.value = Phase.UNSUPPORTED; return }
        if (!a.isEnabled) { _phase.value = Phase.OFF; return }
        _phase.value = Phase.STARTING
        val ok = a.getProfileProxy(ctx, proxyListener, BluetoothProfile.HID_DEVICE)
        if (!ok) _phase.value = Phase.UNSUPPORTED
    }

    fun stop() {
        val h = hid ?: return
        try { h.unregisterApp() } catch (_: Exception) {}
        adapter?.closeProfileProxy(BluetoothProfile.HID_DEVICE, h)
        hid = null
        _host.value = null
        _phase.value = Phase.OFF
    }

    fun bondedDevices(): List<BluetoothDevice> =
        if (!hasPermission()) emptyList() else adapter?.bondedDevices?.sortedBy { it.name ?: it.address } ?: emptyList()

    fun connect(d: BluetoothDevice) {
        val h = hid ?: return
        _phase.value = Phase.CONNECTING
        if (!h.connect(d)) _phase.value = Phase.READY
    }

    fun connect(address: String) {
        val d = bondedDevices().firstOrNull { it.address == address } ?: return
        connect(d)
    }

    fun disconnect() {
        val h = hid ?: return
        _host.value?.let { h.disconnect(it) }
    }

    fun hostLabel(): String? = _host.value?.let { it.name ?: it.address }

    // ---- reports ---------------------------------------------------------------------------------

    private fun send(id: Int, data: ByteArray): Boolean {
        val h = hid ?: return false
        val d = _host.value ?: return false
        exec.execute { try { h.sendReport(d, id, data) } catch (_: Exception) {} }
        return true
    }

    val connected: Boolean get() = _host.value != null

    fun move(dx: Int, dy: Int) { if (dx != 0 || dy != 0) send(Hid.ID_MOUSE, Hid.mouse(buttons, dx, dy)) }

    fun wheel(notches: Int, pan: Int = 0) { send(Hid.ID_MOUSE, Hid.mouse(buttons, 0, 0, notches, pan)) }

    fun button(mask: Int, down: Boolean) {
        buttons = if (down) buttons or mask else buttons and mask.inv()
        send(Hid.ID_MOUSE, Hid.mouse(buttons, 0, 0))
    }

    fun click(mask: Int) { button(mask, true); button(mask, false) }

    fun chordDown(c: Chord) { send(Hid.ID_KEYBOARD, if (c.usage == 0) Hid.keyboard(c.mods) else Hid.keyboard(c.mods, c.usage)) }
    fun modsDown(mods: Int) { send(Hid.ID_KEYBOARD, Hid.keyboard(mods)) }
    fun keysUp() { send(Hid.ID_KEYBOARD, Hid.keyboard(0)) }

    fun tap(c: Chord) { chordDown(c); keysUp() }

    /** One frame of the touchscreen (phone mode). An empty list lifts everything. */
    fun touch(contacts: List<Hid.Contact>) { send(Hid.ID_TOUCH, Hid.touch(contacts)) }

    fun media(usage: Int) {
        send(Hid.ID_CONSUMER, Hid.consumer(usage))
        send(Hid.ID_CONSUMER, Hid.consumer(0))
    }

    /** Types text through the PC's keyboard layout. Characters the layout lacks are skipped and counted. */
    fun type(text: String, layout: KeyLayout, onDone: (skipped: Int) -> Unit = {}) {
        scope.launch {
            var skipped = 0
            for (ch in text) {
                val c = layout.map(ch)
                if (c == null) { skipped++; continue }
                chordDown(c); delay(6); keysUp(); delay(6)
            }
            onDone(skipped)
        }
    }

    // ---- callbacks -------------------------------------------------------------------------------

    private val proxyListener = object : BluetoothProfile.ServiceListener {
        override fun onServiceConnected(profile: Int, proxy: BluetoothProfile) {
            if (profile != BluetoothProfile.HID_DEVICE) return
            hid = proxy as BluetoothHidDevice
            register()
        }

        override fun onServiceDisconnected(profile: Int) {
            if (profile != BluetoothProfile.HID_DEVICE) return
            hid = null
            _host.value = null
            _phase.value = Phase.OFF
        }
    }

    private fun register() {
        val h = hid ?: return
        val sdp = BluetoothHidDeviceAppSdpSettings(
            ctx.getString(hu.vrg.legeger.R.string.hid_name),
            ctx.getString(hu.vrg.legeger.R.string.hid_description),
            "VRG",
            BluetoothHidDevice.SUBCLASS1_COMBO,
            Hid.DESCRIPTOR,
        )
        val ok = h.registerApp(sdp, null, null, exec, callback)
        if (!ok) _phase.value = Phase.UNSUPPORTED
    }

    private val callback = object : BluetoothHidDevice.Callback() {
        override fun onAppStatusChanged(pluggedDevice: BluetoothDevice?, registered: Boolean) {
            if (!registered) { _phase.value = Phase.OFF; _host.value = null; return }
            if (_host.value == null) _phase.value = Phase.READY
            when {
                pluggedDevice != null -> connect(pluggedDevice)
                preferredHost.isNotEmpty() -> connect(preferredHost)
            }
        }

        override fun onConnectionStateChanged(device: BluetoothDevice, state: Int) {
            when (state) {
                BluetoothProfile.STATE_CONNECTED -> {
                    _host.value = device
                    _hostIsPhone.value = device.bluetoothClass?.majorDeviceClass == BluetoothClass.Device.Major.PHONE
                    _phase.value = Phase.CONNECTED
                    onHostConnected(device.address)
                }
                BluetoothProfile.STATE_CONNECTING -> _phase.value = Phase.CONNECTING
                BluetoothProfile.STATE_DISCONNECTED -> {
                    if (_host.value == device || _host.value == null) {
                        _host.value = null
                        _hostIsPhone.value = false
                        buttons = 0
                        if (hid != null) _phase.value = Phase.READY
                    }
                }
            }
        }

        override fun onGetReport(device: BluetoothDevice, type: Byte, id: Byte, bufferSize: Int) {
            val h = hid ?: return
            val data = if (type == BluetoothHidDevice.REPORT_TYPE_FEATURE) Hid.feature(id.toInt()) else Hid.idle(id.toInt())
            if (data.isEmpty()) h.reportError(device, BluetoothHidDevice.ERROR_RSP_INVALID_RPT_ID)
            else h.replyReport(device, type, id, data)
        }

        override fun onSetReport(device: BluetoothDevice, type: Byte, id: Byte, data: ByteArray) {
            hid?.reportError(device, BluetoothHidDevice.ERROR_RSP_SUCCESS)
        }
    }
}
