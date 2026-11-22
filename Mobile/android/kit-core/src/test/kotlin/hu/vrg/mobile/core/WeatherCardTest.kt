package hu.vrg.mobile.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

// VRG Időjárás's home card line (WP M44): what feature-weather writes, as the shell reads it.
class WeatherCardTest {
    @Test fun freshLineShowsWithItsAge() {
        val at = 1_000_000_000_000L
        assertEquals("Budapest · Ma: 🟢 mehet · 8 °C · 5 perce", HomeLayout.weatherLine("$at\nBudapest · Ma: 🟢 mehet · 8 °C", at + 5 * 60_000))
        assertEquals("x · 3 órája", HomeLayout.weatherLine("$at\nx", at + 3 * 3600_000L + 1))
    }

    @Test fun staleBrokenOrMissingShowsNothing() {
        val at = 1_000_000_000_000L
        assertNull(HomeLayout.weatherLine("$at\nx", at + HomeLayout.WEATHER_MAX_AGE_MS + 1))
        assertNull(HomeLayout.weatherLine("$at\nx", at - 1))
        assertNull(HomeLayout.weatherLine("nem szám\nx", at))
        assertNull(HomeLayout.weatherLine("$at\n  ", at))
        assertNull(HomeLayout.weatherLine(null, at))
    }

    @Test fun weatherIsBuiltAsBeta() {
        assertEquals(Stage.BETA, Catalogue.WEATHER.stage)
        assertEquals("weather", Catalogue.WEATHER.id)
    }
}
