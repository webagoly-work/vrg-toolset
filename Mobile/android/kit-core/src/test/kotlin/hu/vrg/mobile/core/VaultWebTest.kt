package hu.vrg.mobile.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// WP M45: the Vault WebView's address and request rules.
class VaultWebTest {
    private val v = VaultWeb.DEFAULT_URL

    @Test fun normalizeKeepsHttpsOnly() {
        assertEquals("https://webagoly-work.github.io/data-vault/", VaultWeb.normalize(" https://WEBAGOLY-work.github.io/data-vault/#grant=x "))
        assertEquals("https://vault.example.com/", VaultWeb.normalize("https://vault.example.com"))
        assertEquals("https://vault.example.com:8443/a", VaultWeb.normalize("https://vault.example.com:8443/a?x=1"))
        assertEquals("https://vault.example.com/", VaultWeb.normalize("https://vault.example.com:443/"))
        assertNull(VaultWeb.normalize("http://webagoly-work.github.io/data-vault/"))
        assertNull(VaultWeb.normalize("https://user:pw@evil.example.com/"))
        assertNull(VaultWeb.normalize("https://localhost/"))
        assertNull(VaultWeb.normalize("https://bad host.com/"))
        assertNull(VaultWeb.normalize("https://x.com:99999/"))
        assertNull(VaultWeb.normalize("javascript:alert(1)"))
        assertNull(VaultWeb.normalize(""))
        assertNull(VaultWeb.normalize(null))
    }

    @Test fun originAndSameOrigin() {
        assertEquals("https://webagoly-work.github.io", VaultWeb.origin(v))
        assertTrue(VaultWeb.sameOrigin(v, "https://webagoly-work.github.io/data-vault/index.html#grant=abc"))
        assertTrue(VaultWeb.sameOrigin(v, "https://webagoly-work.github.io:443/other"))
        assertFalse(VaultWeb.sameOrigin(v, "http://webagoly-work.github.io/data-vault/"))
        assertFalse(VaultWeb.sameOrigin(v, "https://evil.github.io/data-vault/"))
        assertFalse(VaultWeb.sameOrigin(v, "https://webagoly-work.github.io.evil.com/"))
        assertFalse(VaultWeb.sameOrigin(v, "https://x@webagoly-work.github.io/"))
    }

    @Test fun requestsGoToTheVaultOrGitHubOnly() {
        assertTrue(VaultWeb.mayLoad(v, "https://webagoly-work.github.io/data-vault/js/device.js"))
        assertTrue(VaultWeb.mayLoad(v, "https://api.github.com/repos/webagoly-work/data-vault/contents/x"))
        assertTrue(VaultWeb.mayLoad(v, "https://raw.githubusercontent.com/webagoly-work/data-vault/main/trust/devices.json"))
        assertTrue(VaultWeb.mayLoad(v, "https://github.com/login/device/code"))
        assertFalse(VaultWeb.mayLoad(v, "http://api.github.com/"))
        assertFalse(VaultWeb.mayLoad(v, "https://api.github.com:8443/"))
        assertFalse(VaultWeb.mayLoad(v, "https://tracker.example.com/pixel.gif"))
        assertFalse(VaultWeb.mayLoad(v, "https://evil.githubusercontent.com/"))
        assertFalse(VaultWeb.mayLoad(v, "data:text/html,hi"))
    }

    @Test fun navigationStaysInsideTheVaultsPath() {
        assertTrue(VaultWeb.inVault(v, "https://webagoly-work.github.io/data-vault/"))
        assertTrue(VaultWeb.inVault(v, "https://webagoly-work.github.io/data-vault"))
        assertTrue(VaultWeb.inVault(v, "https://webagoly-work.github.io/data-vault/item.html?id=1#k"))
        assertFalse(VaultWeb.inVault(v, "https://webagoly-work.github.io/vrg-toolset/"))
        assertFalse(VaultWeb.inVault(v, "https://webagoly-work.github.io/data-vault-evil/"))
        assertFalse(VaultWeb.inVault(v, "https://webagoly-work.github.io/"))
        assertTrue(VaultWeb.inVault("https://vault.example.com/", "https://vault.example.com/x"))
    }

    @Test fun pastedLinksOpenOnlyOnTheVaultsOrigin() {
        assertEquals("https://webagoly-work.github.io/data-vault/#grant=abc", VaultWeb.openable(v, " https://webagoly-work.github.io/data-vault/#grant=abc "))
        assertNull(VaultWeb.openable(v, "https://evil.example.com/#grant=abc"))
        assertNull(VaultWeb.openable(v, "vrg://devices?grant=abc"))
        assertNull(VaultWeb.openable(v, "https://webagoly-work.github.io/vrg-toolset/#grant=abc"))
    }

    @Test fun findsTheLinkInAMessage() {
        assertEquals("https://webagoly-work.github.io/data-vault/#grant=abc", VaultWeb.findLink("Engedély: https://webagoly-work.github.io/data-vault/#grant=abc."))
        assertEquals("https://a.example.com/x", VaultWeb.findLink("https://a.example.com/x\nköszi"))
        assertNull(VaultWeb.findLink("nincs link"))
    }

    @Test fun logsNeverCarryTheFragment() {
        assertEquals("https://webagoly-work.github.io", VaultWeb.forLog("https://webagoly-work.github.io/data-vault/#grant=SECRET"))
        assertFalse(VaultWeb.forLog("https://webagoly-work.github.io/x?grant=SECRET").contains("SECRET"))
        assertEquals("(nem https)", VaultWeb.forLog("vrg://vault?grant=SECRET"))
    }
}
