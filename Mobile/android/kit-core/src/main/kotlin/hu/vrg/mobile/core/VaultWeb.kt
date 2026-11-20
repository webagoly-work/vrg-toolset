package hu.vrg.mobile.core

// Vault (WP M45, D-48): VRG Mobile opens the Proton Vault's own web app (webagoly-work/data-vault) in a confined
// WebView. The Vault keeps its own crypto, its own device key and its own QR approval (PV-D11 / PV-D12, D-49): VRG
// Mobile decrypts nothing and holds no vault key. These are the rules that WebView follows, as plain data so
// `gradlew :kit-core:test` checks them.
//
// - The address is https only, no user info; the page's origin is what the Vault's data (its device key in
//   localStorage / IndexedDB) is tied to, so changing the address starts a new, empty device.
// - Requests may go to the Vault's own origin and to GitHub (the API, raw files, the sign-in host), nothing else.
// - Logs carry the origin only: a grant link's fragment or query never reaches VrgLog.

object VaultWeb {
    /** Where the Vault's web app is expected (GitHub Pages of the data-vault repo). Not verified from here: settable. */
    const val DEFAULT_URL = "https://webagoly-work.github.io/data-vault/"

    /** Hosts the Vault page may reach besides its own origin. */
    val ALLOWED_HOSTS = setOf("api.github.com", "raw.githubusercontent.com", "github.com")

    /** A cleaned-up address, or null if it is not an https address the Vault may live at. */
    fun normalize(input: String?): String? {
        val s = input?.trim().orEmpty()
        if (!s.startsWith("https://", ignoreCase = true)) return null
        val rest = s.substring(8)
        val authority = rest.substringBefore('/').substringBefore('?').substringBefore('#')
        if (authority.isEmpty() || '@' in authority || ' ' in s) return null
        val host = authority.substringBefore(':').lowercase()
        if (!host.contains('.') || host.startsWith('.') || host.endsWith('.')) return null
        if (!host.all { it.isLetterOrDigit() || it == '-' || it == '.' }) return null
        val port = authority.substringAfter(':', "")
        if (port.isNotEmpty() && port.toIntOrNull()?.let { it in 1..65535 } != true) return null
        val path = rest.substring(authority.length).substringBefore('#').substringBefore('?').ifEmpty { "/" }
        return "https://" + host + (if (port.isNotEmpty() && port != "443") ":$port" else "") + path
    }

    /** "https://host[:port]" of an address, or null. */
    fun origin(url: String?): String? {
        val s = url?.trim().orEmpty()
        if (!s.startsWith("https://", ignoreCase = true)) return null
        val authority = s.substring(8).substringBefore('/').substringBefore('?').substringBefore('#')
        if (authority.isEmpty() || '@' in authority) return null
        val host = authority.substringBefore(':').lowercase()
        val port = authority.substringAfter(':', "").takeIf { it.isNotEmpty() && it != "443" }
        return "https://$host" + (port?.let { ":$it" } ?: "")
    }

    /** True if [url] is on the Vault's own origin (where the page may navigate in place). */
    fun sameOrigin(vault: String, url: String?): Boolean {
        val a = origin(vault) ?: return false
        return origin(url) == a
    }

    /** A request the page makes: its own origin or an allowed GitHub host over https; everything else is refused. */
    fun mayLoad(vault: String, url: String?): Boolean {
        if (sameOrigin(vault, url)) return true
        val o = origin(url) ?: return false
        if (o.substringAfter("https://").contains(':')) return false
        return o.removePrefix("https://") in ALLOWED_HOSTS
    }

    /**
     * True if [url] is inside the Vault's web app: its origin and under its path. github.io hosts every Pages site of
     * the account on one origin, so a page beside the Vault (e.g. /vrg-toolset/) opens in the browser, not in place.
     */
    fun inVault(vault: String, url: String?): Boolean {
        if (!sameOrigin(vault, url)) return false
        val base = path(vault).let { if (it.endsWith('/')) it else it.substringBeforeLast('/') + "/" }
        val p = path(url!!)
        return p.startsWith(base) || p + "/" == base
    }

    private fun path(url: String): String =
        url.trim().substring(8).let { r -> r.substring(r.substringBefore('/').substringBefore('?').substringBefore('#').length) }
            .substringBefore('#').substringBefore('?').ifEmpty { "/" }

    /** A link from outside (pasted) that should open inside the Vault page: inside the Vault only. */
    fun openable(vault: String, link: String?): String? = link?.trim()?.takeIf { inVault(vault, it) }

    /** The first https link in a pasted message (a messenger adds words around it), or null. */
    fun findLink(text: String?): String? {
        val t = text.orEmpty()
        val i = t.indexOf("https://", ignoreCase = true).takeIf { it >= 0 } ?: return null
        return t.substring(i).takeWhile { !it.isWhitespace() && it != '"' && it != '<' && it != '>' }.trimEnd('.', ',', ')', ';')
    }

    /** What may be logged about an address: its origin, never its path, query or fragment. */
    fun forLog(url: String?): String = origin(url) ?: "(nem https)"
}
