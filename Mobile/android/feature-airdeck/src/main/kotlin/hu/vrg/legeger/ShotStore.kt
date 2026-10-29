package hu.vrg.legeger

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.concurrent.TimeUnit

// Screenshots of the PC, on the phone. The relay keeps a capture for ten minutes only, so it is
// downloaded at once into the app's cache (cache/shots, newest 30 kept). From there it can be saved
// to the gallery (Pictures/VRG Legeger) or shared to any app — both from the 📸 sheet.

object ShotStore {
    private const val KEEP = 30

    private val http = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    private fun dir(ctx: Context) = File(ctx.cacheDir, "shots").apply { mkdirs() }

    fun list(ctx: Context): List<File> =
        dir(ctx).listFiles { f -> f.name.endsWith(".png") }?.sortedByDescending { it.lastModified() } ?: emptyList()

    suspend fun download(ctx: Context, url: String, name: String): File? = withContext(Dispatchers.IO) {
        val safe = name.replace(Regex("[^A-Za-z0-9._-]"), "_")
        val out = File(dir(ctx), safe)
        try {
            http.newCall(Request.Builder().url(url).build()).execute().use { r ->
                if (!r.isSuccessful) return@withContext null
                val body = r.body ?: return@withContext null
                out.outputStream().use { body.byteStream().copyTo(it) }
            }
            list(ctx).drop(KEEP).forEach { it.delete() }
            out
        } catch (e: Exception) {
            out.delete()
            null
        }
    }

    /** Copies into the gallery. Returns where it went, for the note under the picture. */
    suspend fun saveToGallery(ctx: Context, f: File): String? = withContext(Dispatchers.IO) {
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                val values = ContentValues().apply {
                    put(MediaStore.Images.Media.DISPLAY_NAME, f.name)
                    put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                    put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/VRG Legeger")
                }
                val uri = ctx.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: return@withContext null
                ctx.contentResolver.openOutputStream(uri)?.use { o -> f.inputStream().use { it.copyTo(o) } } ?: return@withContext null
                "Képek / VRG Legeger / ${f.name}"
            } else {
                // Android 9: no scoped gallery API; the app's own Pictures folder needs no permission
                val d = File(ctx.getExternalFilesDir(Environment.DIRECTORY_PICTURES), "VRG Legeger").apply { mkdirs() }
                val dst = File(d, f.name)
                f.copyTo(dst, overwrite = true)
                dst.absolutePath
            }
        } catch (e: Exception) { null }
    }

    fun uri(ctx: Context, f: File): Uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".files", f)

    fun shareIntent(ctx: Context, f: File): Intent =
        Intent.createChooser(
            Intent(Intent.ACTION_SEND)
                .setType("image/png")
                .putExtra(Intent.EXTRA_STREAM, uri(ctx, f))
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),
            "Képernyőkép megosztása",
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
}
