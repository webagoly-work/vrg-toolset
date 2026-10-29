package hu.vrg.mobile

import android.app.Application

class MobileApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Registry.built.forEach { it.init(this) }
    }
}
