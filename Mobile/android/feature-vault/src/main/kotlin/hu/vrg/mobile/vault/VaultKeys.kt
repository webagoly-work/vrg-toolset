package hu.vrg.mobile.vault

import android.app.KeyguardManager
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.biometrics.BiometricManager
import android.hardware.biometrics.BiometricPrompt
import android.os.Build
import android.os.CancellationSignal
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import hu.vrg.mobile.core.VaultSealBroken
import hu.vrg.mobile.core.VaultWrap
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

// Széf (WP M24): the two Android Keystore keys. Neither ever leaves the phone's secure hardware.
//
//   vrg-vault-device  no user check; wraps the PIN box, so the vault files copied off the phone (adb backup, a
//                     rooted dump) cannot be brute-forced on a PC: every PIN try has to run on this phone
//   vrg-vault-bio     released only by a strong fingerprint / face check, once per use; it seals the vault key
//                     into the header's bio box. A newly enrolled fingerprint invalidates it (the PIN still works,
//                     and Beállítások turns the fingerprint on again)
//
// The prompt is the framework's BiometricPrompt (API 28+), which needs no FragmentActivity.

object VaultKeys {
    private const val STORE = "AndroidKeyStore"
    private const val DEVICE = "vrg-vault-device"
    private const val BIO = "vrg-vault-bio"
    private const val AES = "AES/GCM/NoPadding"
    private const val IV = 12

    private fun ks() = KeyStore.getInstance(STORE).apply { load(null) }

    private fun aesSpec(alias: String) = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)

    private fun deviceKey(create: Boolean): SecretKey? {
        (ks().getKey(DEVICE, null) as? SecretKey)?.let { return it }
        if (!create) return null
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, STORE).apply { init(aesSpec(DEVICE).build()) }.generateKey()
    }

    /** The outer layer of the PIN box. A missing key on unwrap means the phone was reset: [VaultSealBroken]. */
    val device = object : VaultWrap {
        override fun wrap(b: ByteArray): ByteArray {
            val c = Cipher.getInstance(AES)
            c.init(Cipher.ENCRYPT_MODE, deviceKey(create = true))
            return c.iv + c.doFinal(b)
        }

        override fun unwrap(b: ByteArray): ByteArray {
            val k = deviceKey(create = false) ?: throw VaultSealBroken("nincs eszközkulcs")
            if (b.size <= IV) throw VaultSealBroken("rövid")
            return try {
                val c = Cipher.getInstance(AES)
                c.init(Cipher.DECRYPT_MODE, k, GCMParameterSpec(128, b, 0, IV))
                c.doFinal(b, IV, b.size - IV)
            } catch (e: Exception) { throw VaultSealBroken("az eszközkulcs nem nyitja") }
        }
    }

    // ---- fingerprint / face ------------------------------------------------------------------------------------------

    /** Null when it can be used; otherwise why not (Hungarian, for the screen). */
    fun bioProblem(ctx: Context): String? {
        val km = ctx.getSystemService(KeyguardManager::class.java)
        if (km?.isDeviceSecure != true) return "A telefonon nincs képernyőzár, így ujjlenyomat sincs."
        if (Build.VERSION.SDK_INT >= 30) {
            val bm = ctx.getSystemService(BiometricManager::class.java) ?: return "Nincs ujjlenyomat-olvasó."
            return when (bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
                BiometricManager.BIOMETRIC_SUCCESS -> null
                BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> "Nincs rögzített ujjlenyomat (Android beállítások → Biztonság)."
                else -> "Ezen a telefonon nincs erős biometrikus azonosítás."
            }
        }
        if (Build.VERSION.SDK_INT == 29) {
            val bm = ctx.getSystemService(BiometricManager::class.java) ?: return "Nincs ujjlenyomat-olvasó."
            @Suppress("DEPRECATION")
            return when (bm.canAuthenticate()) {
                BiometricManager.BIOMETRIC_SUCCESS -> null
                BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> "Nincs rögzített ujjlenyomat (Android beállítások → Biztonság)."
                else -> "Nincs ujjlenyomat-olvasó."
            }
        }
        // Android 9: the key generation below fails when no fingerprint is enrolled; that is the check
        return if (ctx.packageManager.hasSystemFeature(PackageManager.FEATURE_FINGERPRINT)) null else "Nincs ujjlenyomat-olvasó."
    }

    private fun bioKey(create: Boolean): SecretKey? {
        if (!create) return ks().getKey(BIO, null) as? SecretKey
        dropBio()
        val spec = aesSpec(BIO).setUserAuthenticationRequired(true).setInvalidatedByBiometricEnrollment(true)
        if (Build.VERSION.SDK_INT >= 30) spec.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
        else @Suppress("DEPRECATION") spec.setUserAuthenticationValidityDurationSeconds(-1)
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, STORE).apply { init(spec.build()) }.generateKey()
    }

    fun dropBio() { runCatching { ks().deleteEntry(BIO) } }

    /** Every key gone: the vault was deleted or wiped. */
    fun dropAll() { dropBio(); runCatching { ks().deleteEntry(DEVICE) } }

    sealed interface BioResult {
        class Ok(val bytes: ByteArray) : BioResult
        /** The user chose the PIN, or cancelled. */
        data object Cancelled : BioResult
        /** A new fingerprint was enrolled since: the bio box is dead, the PIN still works. */
        data object Invalidated : BioResult
        class Failed(val why: String) : BioResult
    }

    /** Seal [vk] into a new bio box (a new key, so an old box can never be reused). */
    fun enroll(ctx: Context, vk: ByteArray, done: (BioResult) -> Unit) {
        val c = try {
            Cipher.getInstance(AES).apply { init(Cipher.ENCRYPT_MODE, bioKey(create = true)) }
        } catch (e: Exception) { done(BioResult.Failed("Az ujjlenyomat kulcs nem jött létre: ${e.message ?: e.javaClass.simpleName}")); return }
        prompt(ctx, c, "Ujjlenyomat a Széfhez", "Erősítsd meg, és ezután ezzel is nyílik.") { r ->
            done(if (r is BioResult.Ok) {
                try { BioResult.Ok(c.iv + c.doFinal(vk)) } catch (e: Exception) { BioResult.Failed("Nem sikerült: ${e.message}") }
            } else r)
        }
    }

    /** Open the bio box: the vault key on success. */
    fun open(ctx: Context, box: ByteArray, done: (BioResult) -> Unit) {
        val c = try {
            val k = bioKey(create = false) ?: run { done(BioResult.Invalidated); return }
            Cipher.getInstance(AES).apply { init(Cipher.DECRYPT_MODE, k, GCMParameterSpec(128, box, 0, IV)) }
        } catch (e: KeyPermanentlyInvalidatedException) { dropBio(); done(BioResult.Invalidated); return }
        catch (e: Exception) { done(BioResult.Failed(e.message ?: "?")); return }
        prompt(ctx, c, "Széf feloldása", "Ujjlenyomat vagy arc") { r ->
            done(if (r is BioResult.Ok) {
                try { BioResult.Ok(c.doFinal(box, IV, box.size - IV)) } catch (e: Exception) { BioResult.Failed("Nem nyílt: ${e.message}") }
            } else r)
        }
    }

    /** A check with no key behind it: "újra azonosítás" on a guarded item, once the vault is already open. */
    fun confirm(ctx: Context, done: (BioResult) -> Unit) = prompt(ctx, null, "Védett elem", "Azonosítás a megnyitáshoz", done)

    private fun prompt(ctx: Context, cipher: Cipher?, title: String, subtitle: String, done: (BioResult) -> Unit) {
        val exec = ctx.mainExecutor
        val b = BiometricPrompt.Builder(ctx).setTitle(title).setSubtitle(subtitle)
            .setNegativeButton("PIN-kód", exec) { _, _ -> done(BioResult.Cancelled) }
        if (Build.VERSION.SDK_INT >= 30) b.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
        val cb = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) = done(BioResult.Ok(ByteArray(0)))
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                done(when (errorCode) {
                    BiometricPrompt.BIOMETRIC_ERROR_USER_CANCELED, BiometricPrompt.BIOMETRIC_ERROR_CANCELED -> BioResult.Cancelled
                    else -> BioResult.Failed(errString.toString())
                })
            }
        }
        try {
            if (cipher != null) b.build().authenticate(BiometricPrompt.CryptoObject(cipher), CancellationSignal(), exec, cb)
            else b.build().authenticate(CancellationSignal(), exec, cb)
        } catch (e: Exception) { done(BioResult.Failed(e.message ?: "?")) }
    }
}
