package hu.vrg.mobile.core

import org.json.JSONException
import org.json.JSONObject
import java.io.InputStream
import java.security.MessageDigest

// Frissítés (WP M9, D-3 = A): what a release says about itself and the decisions on it, here so they
// are tested on the JVM. A release is made by .github/workflows/mobile-release.yml: the tag mobile-v<code>,
// with the signed APK and update.json as its assets.

/** update.json. [apkSha256] and [size] are what the download is checked against before installing. */
data class UpdateInfo(
    val code: Long,
    val name: String,
    val sha: String,
    val notes: String,
    val apkSha256: String,
    val size: Long,
) {
    companion object {
        fun parse(json: String): UpdateInfo? = try {
            val o = JSONObject(json)
            UpdateInfo(
                o.getLong("code"), o.getString("name"), o.optString("sha"), o.optString("notes"),
                o.getString("apk_sha256").lowercase(), o.getLong("size"),
            ).takeIf { it.code > 0 && it.size > 0 && it.apkSha256.length == 64 }
        } catch (e: JSONException) { null }
    }
}

/** The two assets of a release, as API urls (a private repo's asset needs the token and octet-stream). */
data class ReleaseAssets(val updateJsonUrl: String, val apkUrl: String) {
    companion object {
        const val APK = "vrg-mobile.apk"
        const val UPDATE_JSON = "update.json"

        /** From GET /releases/latest; null when the release lacks one of the two. */
        fun parse(json: String): ReleaseAssets? = try {
            val assets = JSONObject(json).getJSONArray("assets")
            val urls = (0 until assets.length()).map { assets.getJSONObject(it) }.associate { it.optString("name") to it.optString("url") }
            val manifest = urls[UPDATE_JSON]?.takeIf { it.isNotEmpty() }
            val apk = urls[APK]?.takeIf { it.isNotEmpty() }
            if (manifest != null && apk != null) ReleaseAssets(manifest, apk) else null
        } catch (e: JSONException) { null }
    }
}

object Updates {
    const val LATEST = "${VrgRepo.PATH}/releases/latest"
    const val CHECK_EVERY_MS = 6L * 60 * 60 * 1000

    fun isNewer(info: UpdateInfo, installedCode: Long) = info.code > installedCode

    /** At most one automatic check in [CHECK_EVERY_MS]; a clock moved backwards does not block it. */
    fun checkDue(lastCheck: Long, now: Long) = now < lastCheck || now - lastCheck >= CHECK_EVERY_MS

    /** Installs nothing that is not byte for byte what update.json announced. */
    fun verified(info: UpdateInfo, size: Long, sha256: String) = size == info.size && sha256.equals(info.apkSha256, ignoreCase = true)

    fun sha256(input: InputStream): String {
        val md = MessageDigest.getInstance("SHA-256")
        val buf = ByteArray(64 * 1024)
        while (true) {
            val n = input.read(buf)
            if (n < 0) break
            md.update(buf, 0, n)
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }
}
