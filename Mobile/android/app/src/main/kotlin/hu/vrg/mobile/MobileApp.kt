package hu.vrg.mobile

import android.app.Application
import hu.vrg.mobile.kit.ShellSettings
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.relay.Relay

class MobileApp : Application() {
    override fun onCreate() {
        super.onCreate()
        ShellSettings.init(this)   // first: features read the shell's settings (and Légegér hands its look over)
        Registry.built.forEach { it.init(this) }
        Relay.init(this)           // last: the features have announced their caps and handed over Légegér's address
        VrgLog.i("shell", "Indulás: v${BuildConfig.VERSION_NAME}, ${Registry.built.size} funkció")
    }
}
