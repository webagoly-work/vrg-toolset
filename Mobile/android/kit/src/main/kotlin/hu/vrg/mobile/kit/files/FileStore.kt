package hu.vrg.mobile.kit.files

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
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

// Files between the relay and the phone, shared by Légegér's screenshots (ShotStore) and Átadás
// (WP M12): a download into the app's cache, a copy into the phone's Pictures or Downloads through
// MediaStore, and the FileProvider address for sharing a cached file. The provider and its folders
// (cache/shots, cache/drop) are declared in this module's manifest.

/** A finished download: the file, its size and its SHA-256 (hex). */
data class Fetched(val file: File, val bytes: Long, val sha256: String)

object FileStore {
    private val http = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    fun cacheDir(ctx: Context, name: String): File = File(ctx.cacheDir, name).apply { mkdirs() }

    /**
     * GET [url] with [headers] into [out], hashing as it goes. Null on any failure (HTTP error, cut
     * connection), and then no half file is left. [progress] gets (done, total or -1).
     */
    suspend fun download(url: String, out: File, headers: Map<String, String> = emptyMap(),
                         progress: (Long, Long) -> Unit = { _, _ -> }): Fetched? = withContext(Dispatchers.IO) {
        try {
            val req = Request.Builder().url(url).apply { headers.forEach { (k, v) -> header(k, v) } }.build()
            http.newCall(req).execute().use { r ->
                if (!r.isSuccessful) return@withContext null
                val body = r.body ?: return@withContext null
                val total = body.contentLength()
                val md = MessageDigest.getInstance("SHA-256")
                var done = 0L
                out.parentFile?.mkdirs()
                out.outputStream().use { o ->
                    body.byteStream().use { i ->
                        val buf = ByteArray(64 * 1024)
                        while (true) {
                            val n = i.read(buf)
                            if (n < 0) break
                            o.write(buf, 0, n); md.update(buf, 0, n); done += n
                            progress(done, total)
                        }
                    }
                }
                if (total >= 0 && done != total) { out.delete(); return@withContext null }
                Fetched(out, done, md.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) })
            }
        } catch (e: Exception) {
            out.delete()
            null
        }
    }

    /**
     * Copies [f] into the phone's shared storage under [folder]: Pictures/<folder> for an image,
     * Download/<folder> for anything else. Returns where it went, for the note on screen.
     */
    suspend fun saveShared(ctx: Context, f: File, name: String, mime: String, folder: String): String? = withContext(Dispatchers.IO) {
        val image = mime.startsWith("image/")
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                val dir = (if (image) Environment.DIRECTORY_PICTURES else Environment.DIRECTORY_DOWNLOADS) + "/" + folder
                val values = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, name)
                    put(MediaStore.MediaColumns.MIME_TYPE, mime)
                    put(MediaStore.MediaColumns.RELATIVE_PATH, dir)
                }
                val collection = if (image) MediaStore.Images.Media.EXTERNAL_CONTENT_URI else MediaStore.Downloads.EXTERNAL_CONTENT_URI
                val uri = ctx.contentResolver.insert(collection, values) ?: return@withContext null
                ctx.contentResolver.openOutputStream(uri)?.use { o -> f.inputStream().use { it.copyTo(o) } } ?: return@withContext null
                (if (image) "Képek / " else "Letöltések / ") + "$folder / $name"
            } else {
                // Android 9: no scoped MediaStore; the app's own external folder needs no permission
                val d = File(ctx.getExternalFilesDir(if (image) Environment.DIRECTORY_PICTURES else Environment.DIRECTORY_DOWNLOADS), folder).apply { mkdirs() }
                val dst = File(d, name)
                f.copyTo(dst, overwrite = true)
                dst.absolutePath
            }
        } catch (e: Exception) { null }
    }

    fun uri(ctx: Context, f: File): Uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".files", f)

    fun shareIntent(ctx: Context, f: File, mime: String, title: String): Intent =
        Intent.createChooser(
            Intent(Intent.ACTION_SEND)
                .setType(mime)
                .putExtra(Intent.EXTRA_STREAM, uri(ctx, f))
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),
            title,
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
}
