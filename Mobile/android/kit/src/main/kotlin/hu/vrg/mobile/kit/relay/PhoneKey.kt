package hu.vrg.mobile.kit.relay

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import hu.vrg.mobile.core.RelayAuth
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.spec.ECGenParameterSpec

// The phone's relay key (WP M2): an EC P-256 key made in the Android Keystore. The private half never
// leaves the Keystore (not even into a backup); the relay keeps the public half and checks a signature
// of its challenge on every connect. One key for the whole app and every PC it pairs with.

object PhoneKey {
    private const val ALIAS = "vrg-relay-p256"
    private const val STORE = "AndroidKeyStore"

    private fun store(): KeyStore = KeyStore.getInstance(STORE).apply { load(null) }

    @Synchronized
    private fun ensure() {
        if (store().containsAlias(ALIAS)) return
        val spec = KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
            .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_SHA256)
            .build()
        KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, STORE).apply { initialize(spec) }.generateKeyPair()
    }

    /** X.509 SubjectPublicKeyInfo, base64: what the pair message carries. */
    fun publicKeyB64(): String {
        ensure()
        return RelayAuth.encodePublic(store().getCertificate(ALIAS).publicKey)
    }

    fun sign(challenge: String, id: String): String {
        ensure()
        return RelayAuth.sign(store().getKey(ALIAS, null) as PrivateKey, challenge, id)
    }
}
