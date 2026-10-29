package hu.vrg.legeger

import android.app.Application

class LegegerApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Deck.init(this)
    }
}
