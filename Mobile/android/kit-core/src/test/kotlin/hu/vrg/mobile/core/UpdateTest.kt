package hu.vrg.mobile.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class UpdateTest {
    private val hash = "a".repeat(64)
    private val json = """{"code":312,"name":"0.9.312","sha":"abc1234","notes":"- M9","apk_sha256":"$hash","size":1000}"""
    private val hour = 60L * 60 * 1000

    @Test fun parsesUpdateJson() {
        val u = assertNotNull(UpdateInfo.parse(json))
        assertEquals(312, u.code)
        assertEquals("0.9.312", u.name)
        assertEquals("- M9", u.notes)
        assertEquals(hash, u.apkSha256)
    }

    @Test fun refusesAnUnusableUpdateJson() {
        assertNull(UpdateInfo.parse("not json"))
        assertNull(UpdateInfo.parse("""{"code":312,"name":"x"}"""))
        assertNull(UpdateInfo.parse(json.replace(hash, "abc")))
        assertNull(UpdateInfo.parse(json.replace(""""size":1000""", """"size":0""")))
    }

    @Test fun comparesByCode() {
        val u = UpdateInfo.parse(json)!!
        assertTrue(Updates.isNewer(u, 311))
        assertFalse(Updates.isNewer(u, 312))
        assertFalse(Updates.isNewer(u, 313))
    }

    @Test fun findsBothAssets() {
        val r = """{"tag_name":"mobile-v312","assets":[
            {"name":"update.json","url":"https://api.github.com/a/1"},
            {"name":"vrg-mobile.apk","url":"https://api.github.com/a/2"}]}"""
        assertEquals(ReleaseAssets("https://api.github.com/a/1", "https://api.github.com/a/2"), ReleaseAssets.parse(r))
    }

    @Test fun aReleaseWithoutTheApkIsNotOffered() {
        assertNull(ReleaseAssets.parse("""{"assets":[{"name":"update.json","url":"u"}]}"""))
        assertNull(ReleaseAssets.parse("""{"assets":[]}"""))
        assertNull(ReleaseAssets.parse("""{"message":"Not Found"}"""))
    }

    @Test fun theChecksumOfAKnownInput() {
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", Updates.sha256("abc".byteInputStream()))
    }

    @Test fun onlyTheAnnouncedBytesPass() {
        val u = UpdateInfo.parse(json)!!
        assertTrue(Updates.verified(u, 1000, hash))
        assertTrue(Updates.verified(u, 1000, hash.uppercase()))
        assertFalse(Updates.verified(u, 999, hash))
        assertFalse(Updates.verified(u, 1000, "b".repeat(64)))
    }

    @Test fun checksAtMostEverySixHours() {
        val t = 1000 * hour
        assertTrue(Updates.checkDue(0, t))
        assertFalse(Updates.checkDue(t, t + 5 * hour))
        assertTrue(Updates.checkDue(t, t + 6 * hour))
    }

    @Test fun aClockMovedBackDoesNotBlockTheCheck() {
        assertTrue(Updates.checkDue(1000 * hour, 900 * hour))
    }
}
