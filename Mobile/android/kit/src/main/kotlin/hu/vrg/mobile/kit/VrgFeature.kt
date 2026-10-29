package hu.vrg.mobile.kit

import android.app.Application
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.compose.runtime.Composable
import hu.vrg.mobile.core.FeatureInfo
import hu.vrg.mobile.core.Route

// The contract between the VRG Mobile shell and a feature. A feature is a Gradle module
// (feature-<id>) with one object implementing this; the shell lists it in its registry and does the
// rest: the home tile, links, the back button, key events and the foreground state.
//
// A feature owns its screen below the shell's frame. It must not take over the Activity: anything
// window-wide (system bars, keep-screen-on) goes through the host and is undone when the feature
// leaves, so the next feature starts clean.

interface VrgFeature {
    val info: FeatureInfo

    /** Called once from Application.onCreate. Keep it cheap: no Bluetooth, no network, no permissions. */
    fun init(app: Application) {}

    /** The feature's whole screen. */
    @Composable
    fun Screen(host: FeatureHost)

    /** A link routed here (see hu.vrg.mobile.core.Links). Return false to let the shell show a note. */
    fun open(route: Route): Boolean = false

    /** Hardware keys while this feature is on screen (Légegér turns the volume keys into mouse buttons). */
    fun onKey(event: KeyEvent): Boolean = false

    /** The app went to or came back from the background while this feature was on screen. */
    fun onForeground(on: Boolean) {}
}

/** What the shell offers a feature. */
interface FeatureHost {
    val activity: ComponentActivity

    /** Keep the screen on while this feature is visible; cleared automatically when it leaves. */
    fun keepScreenOn(on: Boolean)

    /** Back to the home screen. */
    fun home()

    /** Open another feature, e.g. Légegér's ⚙ jumping to QR párosítás. */
    fun open(featureId: String)

    /** A short message at the bottom of the shell. */
    fun note(text: String)
}
