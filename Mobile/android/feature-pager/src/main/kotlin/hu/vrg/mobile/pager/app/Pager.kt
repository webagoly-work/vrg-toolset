package hu.vrg.mobile.pager.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.pager.ChatEntry
import hu.vrg.mobile.pager.Clutter
import hu.vrg.mobile.pager.Crew
import hu.vrg.mobile.pager.MAX_UNIT
import hu.vrg.mobile.pager.Me
import hu.vrg.mobile.pager.PagerEngine
import hu.vrg.mobile.pager.Proximity
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray

// The one Csipogó per app: the engine, its settings and what the screen watches. The service drives the engine
// (radio, tick, effects); the screen calls the engine's actions and redraws on [version].

object Pager {
    private const val PREFS = "pager"

    val engine = PagerEngine(Me(1, "Telefon", Crew(Crew.DEFAULT)))

    /** Bumped whenever the engine's state may have changed; the screen collects it. */
    val version = MutableStateFlow(0L)
    fun changed() { version.value = version.value + 1 }

    enum class Radio(val hu: String) { OFF("kikapcsolva"), STARTING("indul…"), ON("fut"), NO_BT("a Bluetooth ki van kapcsolva"), NO_PERMISSION("engedély kell"), UNSUPPORTED("ez a telefon nem tud BLE hirdetést"), FAILED("hiba") }

    private val _radio = MutableStateFlow(Radio.OFF)
    val radio: StateFlow<Radio> = _radio
    fun setRadio(r: Radio) { _radio.value = r; changed() }
    var radioDetail: String? = null

    /** Link and voice state the screen shows. */
    val talker = MutableStateFlow<Int?>(null)
    val transmitting = MutableStateFlow(false)
    val banner = MutableStateFlow<Pair<Long, String>?>(null)

    /** A crew code opened from a link (vrg://pager?crew=…), waiting for the person to accept it. */
    val pendingCrew = MutableStateFlow<String?>(null)

    /** Which unit the panel's buttons address (0 = everyone). */
    val target = MutableStateFlow(0)

    // ---- settings ---------------------------------------------------------------------------------------------

    data class Settings(
        val name: String, val unit: Int, val crew: String, val clutter: Clutter, val repeater: Boolean,
        val volumeKeys: Boolean, val tx1m: Int,
    )

    private fun p(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun settings(ctx: Context): Settings {
        val sp = p(ctx)
        var unit = sp.getInt("unit", 0)
        if (unit !in 1..MAX_UNIT) { unit = (1..MAX_UNIT).random(); sp.edit().putInt("unit", unit).apply() }
        return Settings(
            sp.getString("name", null) ?: Build.MODEL.take(20),
            unit,
            sp.getString("crew", null) ?: Crew.DEFAULT,
            runCatching { Clutter.valueOf(sp.getString("clutter", "SITE")!!) }.getOrDefault(Clutter.SITE),
            sp.getBoolean("repeater", false),
            sp.getBoolean("volumeKeys", true),
            sp.getInt("tx1m", Proximity.DEFAULT_TX1M),
        )
    }

    fun save(ctx: Context, s: Settings) {
        p(ctx).edit().putString("name", s.name.trim().take(20)).putInt("unit", s.unit.coerceIn(1, MAX_UNIT))
            .putString("crew", Crew.normalise(s.crew)).putString("clutter", s.clutter.name)
            .putBoolean("repeater", s.repeater).putBoolean("volumeKeys", s.volumeKeys).putInt("tx1m", s.tx1m).apply()
        applySettings(ctx)
    }

    /** Settings → engine; the radio picks up name / unit / crew on its next beacon. */
    fun applySettings(ctx: Context) {
        val s = settings(ctx)
        engine.setMe(Me(s.unit, s.name.ifBlank { "Egység ${s.unit}" }, Crew(s.crew), s.tx1m))
        engine.clutter = s.clutter
        engine.repeater = s.repeater
        val cal = p(ctx).getString("calibration", null)
        if (cal != null) runCatching {
            val o = org.json.JSONObject(cal)
            o.keys().forEach { k -> engine.setCalibration(k.toInt(), o.getInt(k)) }
        }
        changed()
    }

    fun saveCalibration(ctx: Context, unit: Int, tx1m: Int?) {
        engine.setCalibration(unit, tx1m)
        val o = org.json.JSONObject()
        engine.calibrations().forEach { (u, v) -> o.put(u.toString(), v) }
        p(ctx).edit().putString("calibration", o.toString()).apply()
        changed()
    }

    fun guardPrefs(ctx: Context) {
        val sp = p(ctx)
        engine.guard.exitDelayS = sp.getInt("exitDelay", 15)
        engine.guard.partnerOnlyDisarm = sp.getBoolean("partnerOnly", false)
        engine.manDown.stillLimitS = sp.getInt("stillLimit", 90)
        engine.manDown.preAlarmS = sp.getInt("preAlarm", 25)
    }

    fun putInt(ctx: Context, key: String, v: Int) { p(ctx).edit().putInt(key, v).apply(); guardPrefs(ctx); changed() }
    fun putBool(ctx: Context, key: String, v: Boolean) { p(ctx).edit().putBoolean(key, v).apply(); guardPrefs(ctx); changed() }

    /** Whether the user switched the pager on (so a restart of the app brings it back from the screen). */
    fun wanted(ctx: Context) = p(ctx).getBoolean("on", false)
    fun setWanted(ctx: Context, on: Boolean) = p(ctx).edit().putBoolean("on", on).apply()

    // ---- chat log -----------------------------------------------------------------------------------------------

    fun loadChats(ctx: Context) {
        val raw = p(ctx).getString("chats", null) ?: return
        runCatching {
            val a = JSONArray(raw)
            engine.loadChats((0 until a.length()).map { ChatEntry.fromJson(a.getJSONObject(it)) })
        }.onFailure { VrgLog.w("pager", "chat log: ${it.message}") }
    }

    fun saveChats(ctx: Context) {
        val a = JSONArray()
        engine.chats().takeLast(PagerEngine.MAX_CHATS).forEach { a.put(it.toJson()) }
        p(ctx).edit().putString("chats", a.toString()).apply()
    }

    // ---- permissions ----------------------------------------------------------------------------------------

    /** What the radio needs before it can start, by Android version. */
    fun radioPermissions(): Array<String> = if (Build.VERSION.SDK_INT >= 31) arrayOf(
        Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.BLUETOOTH_CONNECT,
    ) else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)

    fun has(ctx: Context, perm: String) = ctx.checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED
    fun radioAllowed(ctx: Context) = radioPermissions().all { has(ctx, it) }
}
