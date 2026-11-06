package hu.vrg.legeger

import android.content.Context
import android.content.Intent
import android.net.Uri
import hu.vrg.mobile.kit.files.FileStore
import java.io.File

// Screenshots of the PC, on the phone. The relay keeps a capture for ten minutes only, so it is
// downloaded at once into the app's cache (cache/shots, newest 30 kept). From there it can be saved
// to the gallery (Pictures/VRG Legeger) or shared to any app — both from the 📸 sheet. The download,
// the gallery copy and the provider are the kit's FileStore since WP M12, which Átadás shares.

object ShotStore {
    private const val KEEP = 30

    private fun dir(ctx: Context) = FileStore.cacheDir(ctx, "shots")

    fun list(ctx: Context): List<File> =
        dir(ctx).listFiles { f -> f.name.endsWith(".png") }?.sortedByDescending { it.lastModified() } ?: emptyList()

    suspend fun download(ctx: Context, url: String, name: String): File? {
        val safe = name.replace(Regex("[^A-Za-z0-9._-]"), "_")
        val f = FileStore.download(url, File(dir(ctx), safe))?.file ?: return null
        list(ctx).drop(KEEP).forEach { it.delete() }
        return f
    }

    /** Copies into the gallery. Returns where it went, for the note under the picture. */
    suspend fun saveToGallery(ctx: Context, f: File): String? =
        FileStore.saveShared(ctx, f, f.name, "image/png", "VRG Legeger")

    fun uri(ctx: Context, f: File): Uri = FileStore.uri(ctx, f)

    fun shareIntent(ctx: Context, f: File): Intent = FileStore.shareIntent(ctx, f, "image/png", "Képernyőkép megosztása")
}
