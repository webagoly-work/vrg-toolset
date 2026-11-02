package hu.vrg.mobile.kit

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.ApplicationInfo
import android.provider.Settings
import hu.vrg.mobile.core.DeviceGate

// The temporary access switches from Mobile/access.json (baked in as resources by kit's build), applied
// to this phone. The rules are kit-core's RepoName and DeviceGate; the shell asks `locked` before it
// shows anything, and GitHub fiók asks `repoName` before it offers the repo-name entry.

object Access {
    private const val TAG = "access"

    /** This phone's device code for the trusted list, "ABCD-EF01-2345". */
    lateinit var code: String
        private set
    /** GitHub fiók offers "Belépés a repó nevével". */
    var repoName = false
        private set
    /** This build may not open on this phone: the gate is on and the code is not listed. */
    var locked = false
        private set

    @SuppressLint("HardwareIds")   // ANDROID_ID is per app signing key, exactly what the list should pin
    fun init(ctx: Context) {
        val id = Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ANDROID_ID).orEmpty()
        code = DeviceGate.code(id)
        repoName = ctx.resources.getBoolean(R.bool.access_repo_name)
        val on = ctx.resources.getBoolean(R.bool.access_devices_on)
        val debug = ctx.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
        locked = !debug && !DeviceGate.allowed(on, code, DeviceGate.parse(ctx.getString(R.string.access_devices)))
        VrgLog.i(TAG, "Eszközkód: $code" + if (locked) " (nincs a listán, zárva)" else "")
    }
}
