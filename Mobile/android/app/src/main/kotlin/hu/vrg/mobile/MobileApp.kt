package hu.vrg.mobile

import android.app.Application
import hu.vrg.mobile.kit.Access
import hu.vrg.mobile.kit.Trust
import hu.vrg.mobile.kit.ShellSettings
import hu.vrg.mobile.kit.postit.PostItStore
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.github.GitHub
import hu.vrg.mobile.kit.relay.Relay

class MobileApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Access.init(this)          // the temporary access switches (Mobile/access.json): device code, lock, repo name
        ShellSettings.init(this)   // before the features: they read the shell's settings (and Légegér hands its look over)
        PostItStore.init(this)     // WP M68: the Post-it overlay's switches and notes (docs/notes/POSTIT.md)
        GitHub.init(this)          // the shared GitHub client: token from the Keystore-backed store
        Trust.init(this)           // WP M35: this phone's device identity and the trusted list (may unlock Access)
        Registry.built.forEach { it.init(this) }
        Relay.init(this)           // last: the features have announced their caps and handed over Légegér's address
        VrgLog.i("shell", "Indulás: v${BuildConfig.VERSION_NAME}, ${Registry.built.size} funkció")
    }
}
