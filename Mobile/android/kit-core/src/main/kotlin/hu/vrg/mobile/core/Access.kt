package hu.vrg.mobile.core

import java.security.MessageDigest

// Temporary access while only a few known phones use the app (2026-11-02). Both switches live in
// Mobile/access.json, are baked into the APK at build time and end with the next release that turns
// them off. The rules are here so they are tested on the JVM; kit's Access applies them.
//
// - Repo name (SecAcc): instead of the GitHub sign-in, the user types the toolset repo's name. The
//   app then reads GitHub without a token, which works only while the repo is public: making it
//   private again ends this mode by itself. Reads only; writes (Gyorsjegyzet) still need a sign-in.
// - Trusted devices: only a phone whose device code is listed can open the app. The code is a hash
//   of Android's ANDROID_ID, which is per signing key, so the release build and a debug build of the
//   same phone have different codes. The list holds codes, never raw ids.

object RepoName {
    /** True when [input] names the toolset repo: "owner/name", "name", or its github.com URL. */
    fun matches(input: String): Boolean {
        val s = input.trim().lowercase()
            .removePrefix("https://").removePrefix("http://").removePrefix("www.").removePrefix("github.com/")
            .removeSuffix("/").removeSuffix(".git")
        return s == VrgRepo.FULL.lowercase() || s == VrgRepo.NAME.lowercase()
    }
}

object DeviceGate {
    private const val SALT = "vrg-mobile-device:"

    /** The phone's device code, "ABCD-EF01-2345": 48 bits of SHA-256 over the salted ANDROID_ID. */
    fun code(androidId: String): String {
        val hex = MessageDigest.getInstance("SHA-256").digest((SALT + androidId.trim().lowercase()).toByteArray())
            .joinToString("") { "%02X".format(it) }
        return hex.take(12).chunked(4).joinToString("-")
    }

    /** A code as typed or listed, compared without dashes, spaces or case. */
    fun normal(code: String): String = code.filter { it.isLetterOrDigit() }.uppercase()

    /** The baked list ("code,code,…") as normal codes. */
    fun parse(list: String): Set<String> = list.split(',', ';', '\n').map { normal(it) }.filter { it.isNotEmpty() }.toSet()

    /** Whether the app may open: always when the gate is off, else only for a listed code. */
    fun allowed(on: Boolean, code: String, list: Set<String>): Boolean = !on || normal(code) in list
}
