package hu.vrg.mobile.kit

import android.content.Context
import hu.vrg.mobile.core.ShellPrefs
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

// The shell's settings store (WP M1): the look, the start screen and the paired PCs, for every
// feature. Same pattern as Légegér's SettingsStore: one immutable value, a StateFlow, changed only
// through update(). What a stored value means (fallbacks, clamping, the migration) is ShellPrefs in
// kit-core, where it is tested.

object ShellSettings {
    private const val FILE = "shell_settings"

    private lateinit var ctx: Context
    private val _flow = MutableStateFlow(ShellPrefs())
    val flow: StateFlow<ShellPrefs> = _flow
    val value: ShellPrefs get() = _flow.value

    /** From Application.onCreate, before the features' init(). */
    fun init(context: Context) {
        ctx = context.applicationContext
        _flow.value = ShellPrefs.fromMap(ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).all)
    }

    fun update(f: (ShellPrefs) -> ShellPrefs) {
        val n = f(_flow.value)
        if (n == _flow.value) return
        _flow.value = n
        val e = ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit()
        ShellPrefs.toMap(n).forEach { (k, v) ->
            when (v) {
                is String -> e.putString(k, v)
                is Float -> e.putFloat(k, v)
                is Boolean -> e.putBoolean(k, v)
            }
        }
        e.apply()
    }

    /** A feature hands over a look it used to own (Légegér's palette and size); applied once only. */
    fun adoptLook(palette: String?, uiScale: Float?) = update { it.adoptLook(palette, uiScale) }
}
