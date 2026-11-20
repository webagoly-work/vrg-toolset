package hu.vrg.mobile.kit.ui

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.core.GuideSection
import hu.vrg.mobile.core.IphoneGuide
import hu.vrg.mobile.kit.theme.Melyviz

// The iPhone guide on the Android side (Eszközök → iPhone csatlakoztatása). The text is Mobile/web/guide/iphone.json,
// bundled as the asset "iphone.json" (kit's build.gradle.kts), the very file the iPhone web app shows.

object IphoneGuides {
    @Volatile private var cached: IphoneGuide? = null

    fun load(ctx: Context): IphoneGuide? = cached ?: runCatching {
        ctx.assets.open("iphone.json").bufferedReader().use { IphoneGuide.parse(it.readText()) }
    }.getOrNull()?.also { cached = it }
}

/** The whole guide, each section folding open on a tap; [openOwner] opens the owner's own steps from the start. */
@Composable
fun IphoneGuideView(modifier: Modifier = Modifier, openOwner: Boolean = true) {
    val ctx = LocalContext.current
    val g = remember { IphoneGuides.load(ctx) }
    if (g == null) { Text("Az útmutató nem olvasható.", style = Melyviz.small.copy(color = Melyviz.coral)); return }
    Column(modifier.fillMaxWidth()) {
        Text(g.intro, style = Melyviz.small, modifier = Modifier.padding(bottom = 6.dp))
        g.sections.forEach { s -> Section(s, startOpen = openOwner && s.who == GuideSection.Who.OWNER) }
    }
}

@Composable
private fun Section(s: GuideSection, startOpen: Boolean) {
    var open by remember { mutableStateOf(startOpen) }
    val shape = RoundedCornerShape(Melyviz.radiusSmall)
    Column(Modifier.fillMaxWidth().padding(vertical = 3.dp).clip(shape).background(Melyviz.surface)) {
        Row(Modifier.fillMaxWidth().clickable { open = !open }.padding(horizontal = 12.dp, vertical = 11.dp)) {
            Text((if (open) "▾ " else "▸ ") + s.title, style = Melyviz.label.copy(fontWeight = FontWeight.SemiBold), modifier = Modifier.weight(1f))
            if (s.who != GuideSection.Who.BOTH) Text(s.who.hu, style = Melyviz.small.copy(fontSize = 10.sp,
                color = if (s.who == GuideSection.Who.OWNER) Melyviz.sand else Melyviz.current))
        }
        if (open) Column(Modifier.padding(start = 12.dp, end = 12.dp, bottom = 10.dp)) {
            s.steps.forEachIndexed { i, step ->
                Row(Modifier.padding(vertical = 3.dp)) {
                    Text("${i + 1}.", style = Melyviz.label.copy(color = Melyviz.glow), modifier = Modifier.width(22.dp))
                    Text(step, style = Melyviz.small.copy(color = Melyviz.ink))
                }
            }
            s.faq.forEach { f ->
                Text(f.q, style = Melyviz.label, modifier = Modifier.padding(top = 8.dp))
                Text(f.a, style = Melyviz.small)
            }
        }
    }
}
