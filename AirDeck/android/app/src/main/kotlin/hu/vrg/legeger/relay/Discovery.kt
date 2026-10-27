package hu.vrg.legeger.relay

import android.content.Context
import android.net.ConnectivityManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.Inet4Address
import java.util.concurrent.TimeUnit

// "Keresés": find the relay without typing an IP. Asks every address of this phone's /24 for the
// relay's GET /whoami on the first ports of its range. The answer carries `ws` — the address of the
// PC as seen from THIS phone's subnet (phone-relay-server.js bestAddressFor), so a dual-homed PC
// hands back the address that actually works.

object Discovery {
    private val PORTS = listOf(47291, 47292, 47293)

    private val http = OkHttpClient.Builder()
        .connectTimeout(350, TimeUnit.MILLISECONDS)
        .readTimeout(600, TimeUnit.MILLISECONDS)
        .build()

    /** This phone's IPv4 on the active (WiFi) network, or null. */
    fun ownAddress(ctx: Context): String? {
        val cm = ctx.getSystemService(ConnectivityManager::class.java) ?: return null
        val lp = cm.getLinkProperties(cm.activeNetwork) ?: return null
        return lp.linkAddresses.map { it.address }.filterIsInstance<Inet4Address>()
            .firstOrNull { !it.isLoopbackAddress }?.hostAddress
    }

    suspend fun find(ctx: Context, onProgress: (Int) -> Unit = {}): String? = withContext(Dispatchers.IO) {
        val me = ownAddress(ctx) ?: return@withContext null
        val prefix = me.substringBeforeLast('.')
        val gate = Semaphore(48)
        var done = 0
        coroutineScope {
            val jobs = (1..254).map { n ->
                async {
                    gate.withPermit {
                        val r = probe("$prefix.$n")
                        synchronized(this@Discovery) { done++; if (done % 16 == 0) onProgress(done * 100 / 254) }
                        r
                    }
                }
            }
            jobs.awaitAll().firstOrNull { it != null }
        }
    }

    private fun probe(ip: String): String? {
        for (port in PORTS) {
            try {
                http.newCall(Request.Builder().url("http://$ip:$port/whoami").build()).execute().use { r ->
                    if (!r.isSuccessful) return@use
                    val j = JSONObject(r.body?.string() ?: return@use)
                    if (j.optString("app") == "varler-phone-relay") {
                        return j.optString("ws").ifEmpty { "ws://$ip:$port" }
                    }
                }
            } catch (_: java.net.ConnectException) {
                continue         // the host is there but this port is closed: the relay may have stepped up
            } catch (_: Exception) {
                return null      // timeout / no route: no host here, do not wait on its other ports
            }
        }
        return null
    }
}
