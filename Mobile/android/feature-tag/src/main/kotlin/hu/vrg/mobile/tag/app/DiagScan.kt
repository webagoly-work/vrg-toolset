package hu.vrg.mobile.tag.app

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.tag.Diag
import hu.vrg.mobile.tag.DiagChar
import hu.vrg.mobile.tag.DiagDevice
import hu.vrg.mobile.tag.DiagService
import kotlinx.coroutines.flow.MutableStateFlow

// Diagnosztika (WP M61, D-162): connect to a device over BLE, list every service and characteristic with its
// properties, read only the standard ones (Diag.READ_SAFE: names, Device Information, battery), hang up, and build
// the report (tag-core Diag.report, kind "vrg.device-diag" v 1). Nothing is ever written to the device. The report goes
// to the Napló and, by Megosztás, through Android's share sheet (to the Data Vault's Eszközeim, a file, a message).

@SuppressLint("MissingPermission")    // run only after Tags.allowed()
object DiagScan {
    sealed class State {
        data object Idle : State()
        data class Running(val address: String, val step: String) : State()
        data class Done(val address: String, val summary: String, val json: String) : State()
        data class Failed(val address: String, val why: String) : State()
    }

    val state = MutableStateFlow<State>(State.Idle)

    private val main = Handler(Looper.getMainLooper())
    private var gatt: BluetoothGatt? = null
    private var device: DiagDevice? = null
    private val services = ArrayList<DiagService>()
    private val toRead = ArrayDeque<BluetoothGattCharacteristic>()
    private val values = HashMap<String, ByteArray>()
    private var appCtx: Context? = null

    fun run(ctx: Context, dev: DiagDevice) {
        if (state.value is State.Running) return
        val adapter = ctx.getSystemService(BluetoothManager::class.java)?.adapter
        val remote = runCatching { adapter?.getRemoteDevice(dev.address) }.getOrNull()
        if (remote == null) { state.value = State.Failed(dev.address, "Ismeretlen cím."); return }
        appCtx = ctx.applicationContext
        device = dev; services.clear(); toRead.clear(); values.clear()
        state.value = State.Running(dev.address, "Csatlakozás…")
        VrgLog.i("tag", "diag ${dev.address} (${dev.name})")
        gatt = runCatching { remote.connectGatt(ctx.applicationContext, false, callback, BluetoothDevice.TRANSPORT_LE) }.getOrNull()
        if (gatt == null) { fail("Nem sikerült csatlakozni."); return }
        main.postDelayed(timeout, 20_000)
    }

    fun reset() { if (state.value !is State.Running) state.value = State.Idle }

    /** Android's share sheet with the report as text (the Data Vault's Eszközeim takes it pasted). */
    fun share(ctx: Context, json: String, name: String?) {
        val send = Intent(Intent.ACTION_SEND).setType("text/plain")
            .putExtra(Intent.EXTRA_SUBJECT, "Eszköz-diagnosztika: ${name ?: "Bluetooth eszköz"}")
            .putExtra(Intent.EXTRA_TEXT, json)
        runCatching { ctx.startActivity(Intent.createChooser(send, "Diagnosztika megosztása").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    }

    private val timeout = Runnable { fail(if (services.isEmpty()) "Nem válaszolt 20 mp alatt." else "Félbemaradt: ami megvan, az a jelentés.") }

    private val callback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
            main.post {
                if (g !== gatt) return@post
                if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
                    step("Szolgáltatások…")
                    if (!g.discoverServices()) fail("A szolgáltatások lekérése nem indult el.")
                } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                    if (state.value is State.Running) { if (services.isEmpty()) fail("A kapcsolat megszakadt (status $status).") else finish() }
                }
            }
        }

        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
            main.post {
                if (g !== gatt) return@post
                for (s in g.services) for (c in s.characteristics) {
                    if (Diag.safeToRead(c.uuid.toString()) && (c.properties and BluetoothGattCharacteristic.PROPERTY_READ) != 0) toRead.addLast(c)
                }
                services.clear()
                services += g.services.map { s -> DiagService(s.uuid.toString(), s.characteristics.map { DiagChar(it.uuid.toString(), it.properties) }) }
                step("Adatlap olvasása (${toRead.size})…")
                next(g)
            }
        }

        @Deprecated("API < 33")
        @Suppress("DEPRECATION")
        override fun onCharacteristicRead(g: BluetoothGatt, c: BluetoothGattCharacteristic, status: Int) {
            val v = c.value
            main.post { read(g, c, v, status) }
        }

        override fun onCharacteristicRead(g: BluetoothGatt, c: BluetoothGattCharacteristic, value: ByteArray, status: Int) {
            main.post { read(g, c, value, status) }
        }
    }

    private fun read(g: BluetoothGatt, c: BluetoothGattCharacteristic, value: ByteArray?, status: Int) {
        if (g !== gatt) return
        if (status == BluetoothGatt.GATT_SUCCESS && value != null) values[c.service.uuid.toString() + "/" + c.uuid] = value
        next(g)
    }

    @Suppress("DEPRECATION")
    private fun next(g: BluetoothGatt) {
        while (toRead.isNotEmpty()) {
            val c = toRead.removeFirst()
            if (runCatching { g.readCharacteristic(c) }.getOrDefault(false)) return
        }
        finish()
    }

    private fun finish() {
        val dev = device ?: return
        main.removeCallbacks(timeout)
        val filled = services.map { s ->
            s.copy(chars = s.chars.map { c -> c.copy(value = values[s.uuid + "/" + c.uuid]) })
        }
        val ctx = appCtx
        val app = "VRG Mobile " + (ctx?.let { runCatching { it.packageManager.getPackageInfo(it.packageName, 0).versionName }.getOrNull() } ?: "?")
        val json = Diag.report(dev, filled, java.time.Instant.now().toString(), app)
        val summary = Diag.summary(filled)
        VrgLog.i("tag", "diag done: $summary")
        filled.forEach { s -> VrgLog.i("tag", "  ${s.uuid} ${Diag.serviceName(s.uuid) ?: ""}: ${s.chars.joinToString { c -> c.uuid.substring(4, 8) + "[" + Diag.props(c.props).joinToString("/") + "]" }}") }
        hangUp()
        state.value = State.Done(dev.address, summary, json)
    }

    private fun fail(why: String) {
        val dev = device
        main.removeCallbacks(timeout)
        if (services.isNotEmpty() && dev != null) { finish(); return }
        VrgLog.w("tag", "diag failed: $why")
        hangUp()
        state.value = State.Failed(dev?.address ?: "", why)
    }

    private fun step(s: String) { device?.let { state.value = State.Running(it.address, s) } }

    private fun hangUp() {
        val g = gatt ?: return
        gatt = null
        runCatching { g.disconnect() }; runCatching { g.close() }
    }
}
