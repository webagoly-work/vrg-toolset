package hu.vrg.mobile.sketch.vision

import android.graphics.Bitmap
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * Finds faces on a photo, on the phone (no network), so the Sketcher can propose blur rectangles (Kamera 2, D-56 = B).
 * Like TextReader it is the only place that knows the engine: it returns plain boxes in 0..1 of the bitmap.
 */
interface FaceFinder {
    /** Each face as [left, top, right, bottom] in 0..1 of [bmp] (upright); null when the finder failed. */
    suspend fun find(bmp: Bitmap): List<FloatArray>?

    companion object {
        val default: FaceFinder get() = MlKitFaceFinder
    }
}

/** ML Kit face detection, the bundled model (com.google.mlkit:face-detection): accurate mode, small faces too. */
internal object MlKitFaceFinder : FaceFinder {
    private val options = FaceDetectorOptions.Builder()
        .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
        .setMinFaceSize(0.05f)
        .build()

    override suspend fun find(bmp: Bitmap): List<FloatArray>? {
        val client = FaceDetection.getClient(options)
        val w = bmp.width.toFloat(); val h = bmp.height.toFloat()
        return try {
            suspendCancellableCoroutine { cont ->
                client.process(InputImage.fromBitmap(bmp, 0))
                    .addOnSuccessListener { faces ->
                        if (cont.isActive) cont.resume(faces.map { f ->
                            val r = f.boundingBox
                            floatArrayOf(r.left / w, r.top / h, r.right / w, r.bottom / h)
                        })
                    }
                    .addOnFailureListener { if (cont.isActive) cont.resume(null) }
            }
        } catch (e: Exception) {
            null
        } finally {
            client.close()
        }
    }
}
