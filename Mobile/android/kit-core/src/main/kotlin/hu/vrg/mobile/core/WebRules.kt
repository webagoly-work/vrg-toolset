package hu.vrg.mobile.core

import org.json.JSONObject
import java.net.URI
import java.net.URLDecoder
import java.net.URLEncoder

// Böngésző (WP M66, T7): the rules of the phone's work browser, ported from the VRG Böngésző (Browser/src/core/url.js) and kept
// to the VRG Asztal's web contract (Dashboard CONTRACT §3 / §4.3, the Data Vault browser-kit's RULES):
//   http / https only; no bridge from a page into the app (no addJavascriptInterface); certificate errors never overridden;
//   permissions denied (a page asks, the answer is no); downloads only after a yes (handed to the phone's browser);
//   other schemes (javascript:, file:, intent: …) never opened.
// The address bar: a URL with the scheme it needs (https, or http for this PC and the LAN), a !bang picks an engine of
// Browser/config/engines.json (bundled in resources/web/engines.json, WebTest keeps it equal), anything else is a search.
// Tracking parameters (utm_*, fbclid, gclid …) are stripped. The shared cases: Browser/test/fixtures/links-contract.json.

data class WebEngine(val id: String, val hu: String, val group: String, val bangs: List<String>, val url: String, val home: String = "", val isDefault: Boolean = false)

sealed class Typed {
    data class Url(val url: String) : Typed()
    data class Search(val url: String, val engine: WebEngine, val query: String, val bang: Boolean) : Typed()
    object Blocked : Typed()
    object Empty : Typed()
}

object WebRules {
    const val MAX_URL = 4096
    /** The contract, as data: the WebView keeps every line (feature-web). */
    val CONTRACT = mapOf(
        "schemes" to "http, https", "bridge" to "none", "certErrors" to "never-override",
        "permissions" to "deny", "downloads" to "ask-first, then the phone's browser", "windows" to "same view",
    )

    fun isWebUrl(u: String?): Boolean {
        if (u == null || u.isEmpty() || u.length > MAX_URL) return false
        return try { val s = URI(u).scheme?.lowercase(); s == "http" || s == "https" } catch (e: Exception) { false }
    }

    /** The origin of a URL, the only part of it that reaches the log. */
    fun forLog(u: String?): String = try { URI(u).let { it.scheme + "://" + it.host } } catch (e: Exception) { "?" }

    // ---- normalising like the browser's URL parser: lower-case scheme and host, the default port dropped, "/" for an empty path,
    // non-ASCII percent-encoded (UTF-8)
    fun normalise(u: String): String? = try {
        val x = URI(u)
        val scheme = x.scheme?.lowercase() ?: return null
        val host = x.host?.lowercase() ?: return null
        val port = if (x.port == -1 || (scheme == "http" && x.port == 80) || (scheme == "https" && x.port == 443)) "" else ":${x.port}"
        val user = x.rawUserInfo?.let { "$it@" } ?: ""
        val path = x.rawPath.let { if (it.isNullOrEmpty()) "/" else it }
        val s = "$scheme://$user$host$port$path" + (x.rawQuery?.let { "?$it" } ?: "") + (x.rawFragment?.let { "#$it" } ?: "")
        URI(s).toASCIIString()
    } catch (e: Exception) { null }

    private val NOT_TLD = setOf("pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "json", "md", "jpg", "jpeg", "png", "gif",
        "svg", "webp", "zip", "rar", "7z", "dwg", "dxf", "exe", "msi", "cmd", "bat", "ps1", "js", "css", "html", "htm", "xml", "mp3", "mp4",
        "kml", "kmz", "stl", "step", "stp", "ino", "cpp", "py", "log", "ini", "yml", "yaml")
    private val BLOCKED = Regex("^(javascript|data|vbscript|file|blob|about|chrome|edge|view-source|intent|filesystem):", RegexOption.IGNORE_CASE)
    private val IPV4 = Regex("^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$")

    private fun isIPv4(h: String) = IPV4.matchEntire(h)?.groupValues?.drop(1)?.all { it.toInt() <= 255 } == true
    fun isPrivateHost(host: String): Boolean {
        val h = host.lowercase().removePrefix("[").removeSuffix("]")
        if (h == "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h == "::1") return true
        if (!isIPv4(h)) return false
        val (a, b) = h.split('.').map { it.toInt() }
        return a == 10 || a == 127 || (a == 172 && b in 16..31) || (a == 192 && b == 168) || (a == 169 && b == 254)
    }

    /** "index.hu", "tme.eu/hu/…", "localhost:8808", "192.168.1.1/admin" → a URL with the scheme it needs, or null. */
    fun asUrl(t: String): String? {
        if (t.any { it.isWhitespace() }) return null
        if (Regex("^https?://", RegexOption.IGNORE_CASE).containsMatchIn(t)) return normalise(t)
        val m = Regex("^([^/?#:]+)(:\\d{1,5})?([/?#].*)?$").matchEntire(t) ?: return null
        val host = m.groupValues[1].lowercase()
        if (host == "localhost" || isIPv4(host) || host.endsWith(".localhost")) return normalise("http://$t")
        val labels = host.split('.')
        if (labels.size < 2 || labels.any { it.isEmpty() || it.length > 63 || !Regex("^[a-z0-9\\u00a1-\\uffff-]+$").matches(it) || it.startsWith("-") || it.endsWith("-") }) return null
        val tld = labels.last()
        if (!Regex("^([a-z\\u00a1-\\uffff]{2,24}|xn--[a-z0-9-]{2,59})$").matches(tld) || tld in NOT_TLD) return null
        return normalise((if (isPrivateHost(host)) "http://" else "https://") + t)
    }

    /** encodeURIComponent: everything but A–Z a–z 0–9 - _ . ! ~ * ' ( ) is percent-encoded (UTF-8). */
    fun encodeComponent(s: String): String = URLEncoder.encode(s, "UTF-8").replace("+", "%20")
        .replace("%21", "!").replace("%27", "'").replace("%28", "(").replace("%29", ")").replace("%7E", "~")

    fun searchUrl(e: WebEngine, q: String): String {
        val s = q.trim()
        if (s.isEmpty() && e.home.isNotEmpty()) return e.home
        return e.url.replace("{q}", encodeComponent(s))
    }

    private val BANG_FRONT = Regex("^!([a-z0-9]{1,12})(?:\\s+(.*))?$", RegexOption.IGNORE_CASE)
    private val BANG_BACK = Regex("^(.*?)\\s+!([a-z0-9]{1,12})$", RegexOption.IGNORE_CASE)

    /** What a typed line means: a URL, a search (with its engine), blocked, or nothing. */
    fun classify(text: String?, engines: List<WebEngine>, engineId: String?): Typed {
        val t = (text ?: "").replace(Regex("[\\u0000-\\u001f\\u007f]"), " ").trim().take(2000)
        if (t.isEmpty()) return Typed.Empty
        if (BLOCKED.containsMatchIn(t)) return Typed.Blocked
        val pick = engines.firstOrNull { it.id == engineId } ?: engines.firstOrNull { it.isDefault } ?: engines.firstOrNull()
        val front = BANG_FRONT.matchEntire(t)
        val back = if (front == null) BANG_BACK.matchEntire(t) else null
        val bang = front?.let { it.groupValues[1] to it.groupValues[2] } ?: back?.let { it.groupValues[2] to it.groupValues[1] }
        if (bang != null) {
            val e = engines.firstOrNull { bang.first.lowercase() in it.bangs }
            if (e != null) return Typed.Search(searchUrl(e, bang.second), e, bang.second.trim(), true)
        }
        asUrl(t)?.let { return Typed.Url(it) }
        pick ?: return Typed.Blocked
        return Typed.Search(searchUrl(pick, t), pick, t, false)
    }

    // ---- Tiszta link
    private val TRACK = listOf(Regex("^utm_", RegexOption.IGNORE_CASE), Regex("^(fbclid|gclid|gclsrc|dclid|gbraid|wbraid|msclkid|yclid|twclid|ttclid|li_fat_id|igshid|igsh|mc_cid|mc_eid|_hsenc|_hsmi|__hstc|__hssc|__hsfp|hsctatracking|mkt_tok|oly_anon_id|oly_enc_id|vero_id|_openstat|ref_src|ref_url|spm|scm|__s)$", RegexOption.IGNORE_CASE))

    /** The URL without its tracking parameters (the rest kept as written), and Google's /url?q= wrapper opened. */
    fun strip(url: String): String {
        if (!isWebUrl(url)) return url
        val x = try { URI(url) } catch (e: Exception) { return url }
        val raw = x.rawQuery ?: return url
        val pairs = raw.split('&').filter { it.isNotEmpty() }
        val key = { p: String -> try { URLDecoder.decode(p.substringBefore('='), "UTF-8") } catch (e: Exception) { p.substringBefore('=') } }
        val keep = pairs.filterNot { p -> TRACK.any { it.containsMatchIn(key(p)) } }
        val host = x.host?.lowercase() ?: ""
        if (Regex("(^|\\.)google\\.[a-z.]+$").containsMatchIn(host) && x.rawPath == "/url") {
            val target = keep.firstOrNull { key(it) == "q" || key(it) == "url" }?.substringAfter('=')?.let { URLDecoder.decode(it, "UTF-8") }
            if (target != null && Regex("^https?://").containsMatchIn(target)) return strip(target)
        }
        if (keep.size == pairs.size) return url
        val base = url.substringBefore('?')
        val frag = x.rawFragment?.let { "#$it" } ?: ""
        return base + (if (keep.isEmpty()) "" else "?" + keep.joinToString("&")) + frag
    }

    // ---- the engines, bundled from Browser/config/engines.json
    val engines: List<WebEngine> by lazy {
        val text = WebRules::class.java.getResourceAsStream("/web/engines.json")?.bufferedReader(Charsets.UTF_8)?.readText() ?: return@lazy emptyList()
        parseEngines(text)
    }

    fun parseEngines(text: String): List<WebEngine> {
        val a = JSONObject(text).optJSONArray("engines") ?: return emptyList()
        return (0 until a.length()).mapNotNull { i ->
            val o = a.optJSONObject(i) ?: return@mapNotNull null
            val url = o.optString("url")
            if (!url.startsWith("https://") || !url.contains("{q}")) return@mapNotNull null
            val bangs = o.optJSONArray("bangs")?.let { b -> (0 until b.length()).map { b.optString(it).lowercase() } } ?: emptyList()
            WebEngine(o.optString("id"), o.optString("hu"), o.optString("group"), bangs, url, o.optString("home", ""), o.optBoolean("default", false))
        }
    }
}
