package hu.vrg.mobile.sketch.vision

import android.graphics.Bitmap
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * Reads the text on a photo, on the phone (no network). The Sketcher only knows this interface; the parsing of what
 * was read (meter numbers, ratings) is pure Kotlin in sketch-core (TypePlate.kt), so a different recogniser only has
 * to give back plain text, line by line.
 */
interface TextReader {
    /** The text in [bmp] (upright), lines separated by '\n'; null when the reader failed. */
    suspend fun read(bmp: Bitmap): String?

    companion object {
        /** The reader the app uses. */
        val default: TextReader get() = MlKitTextReader
    }
}

/** Google ML Kit text recognition v2, Latin script, the bundled model (com.google.mlkit:text-recognition). */
internal object MlKitTextReader : TextReader {
    override suspend fun read(bmp: Bitmap): String? {
        val client = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        return try {
            suspendCancellableCoroutine { cont ->
                client.process(InputImage.fromBitmap(bmp, 0))
                    .addOnSuccessListener { r -> if (cont.isActive) cont.resume(r.textBlocks.joinToString("\n") { b -> b.lines.joinToString("\n") { it.text } }) }
                    .addOnFailureListener { if (cont.isActive) cont.resume(null) }
            }
        } catch (e: Exception) {
            null
        } finally {
            client.close()
        }
    }
}
