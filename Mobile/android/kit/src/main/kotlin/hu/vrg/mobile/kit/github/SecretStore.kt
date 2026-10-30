package hu.vrg.mobile.kit.github

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

// Secrets at rest (the GitHub token, WP M3): AES-256-GCM with a key that lives in the Android Keystore
// and never leaves it. Only the ciphertext and its IV are in SharedPreferences, and the app has
// allowBackup="false", so neither travels in a backup. A wiped Keystore (factory reset, a new phone)
// just means signing in again.

class SecretStore(ctx: Context) {
    private val sp = ctx.applicationContext.getSharedPreferences("secrets", Context.MODE_PRIVATE)

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance(STORE).apply { load(null) }
        (ks.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        val spec = KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, STORE).apply { init(spec) }.generateKey()
    }

    @Synchronized
    fun put(name: String, value: String) {
        val c = Cipher.getInstance(AES)
        c.init(Cipher.ENCRYPT_MODE, key())
        val data = c.doFinal(value.toByteArray(Charsets.UTF_8))
        sp.edit()
            .putString("$name.iv", Base64.encodeToString(c.iv, Base64.NO_WRAP))
            .putString("$name.data", Base64.encodeToString(data, Base64.NO_WRAP))
            .apply()
    }

    /** Null when nothing is stored, or when it can no longer be decrypted (the key is gone). */
    @Synchronized
    fun get(name: String): String? {
        val iv = sp.getString("$name.iv", null) ?: return null
        val data = sp.getString("$name.data", null) ?: return null
        return try {
            val c = Cipher.getInstance(AES)
            c.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)))
            String(c.doFinal(Base64.decode(data, Base64.NO_WRAP)), Charsets.UTF_8)
        } catch (e: Exception) {
            remove(name)
            null
        }
    }

    @Synchronized
    fun remove(name: String) { sp.edit().remove("$name.iv").remove("$name.data").apply() }

    private companion object {
        const val STORE = "AndroidKeyStore"
        const val ALIAS = "vrg-secrets-aes"
        const val AES = "AES/GCM/NoPadding"
    }
}
