package hu.vrg.mobile.kit.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.kit.theme.Melyviz

// RCO on the phone (2026-11-19): the toolset's right-click menu (Kódváros, the Kapu) as a long press. One look and
// one gesture for every list in the app: a tap still does what it always did, a long press buzzes once and opens a
// small menu anchored to the item. Use it where an item has more than one thing to do, never instead of the tap.
//
//   var menu by remember { mutableStateOf(false) }
//   Box {
//       Row(Modifier.rco(onClick = { open() }, onLong = { menu = true })) { … }
//       RcoMenu(menu, { menu = false }, "Átadás", listOf(RcoItem("✕", "Bezárás") { close() }))
//   }

/** One line of an RCO menu. [danger] draws it in coral (removing, deleting). */
data class RcoItem(
    val glyph: String,
    val label: String,
    val danger: Boolean = false,
    val enabled: Boolean = true,
    val onClick: () -> Unit,
)

/**
 * Tap = [onClick]; long press = [onLong] with one haptic tick. TalkBack offers the long press as "[longLabel]".
 * [onClickLabel] names the tap for TalkBack when the item's text alone does not say it.
 */
@OptIn(ExperimentalFoundationApi::class)
fun Modifier.rco(
    onClick: () -> Unit,
    onLong: () -> Unit,
    longLabel: String = "további műveletek",
    onClickLabel: String? = null,
): Modifier = composed {
    val haptic = LocalHapticFeedback.current
    combinedClickable(
        onClickLabel = onClickLabel,
        onLongClickLabel = longLabel,
        onLongClick = { haptic.performHapticFeedback(HapticFeedbackType.LongPress); onLong() },
        onClick = onClick,
    )
}

/** The menu, anchored to the Box that holds the item. Picking a line closes it first, then runs the line. */
@Composable
fun RcoMenu(expanded: Boolean, onDismiss: () -> Unit, title: String?, items: List<RcoItem>) {
    DropdownMenu(
        expanded = expanded,
        onDismissRequest = onDismiss,
        shape = RoundedCornerShape(Melyviz.radiusSmall),
        containerColor = Melyviz.deep,
        border = BorderStroke(1.dp, Melyviz.glowDim),
    ) {
        if (title != null) Text(
            title.uppercase(), style = Melyviz.small.copy(fontSize = 10.sp, letterSpacing = 1.4.sp, color = Melyviz.glowDim),
            maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
        )
        items.forEach { item ->
            val colour = when {
                !item.enabled -> Melyviz.faint
                item.danger -> Melyviz.coral
                else -> Melyviz.ink
            }
            DropdownMenuItem(
                text = { Text(item.label, style = Melyviz.label.copy(color = colour)) },
                leadingIcon = { Text(item.glyph, style = Melyviz.readout.copy(fontSize = 13.sp, color = if (item.danger) Melyviz.coral else Melyviz.glow)) },
                enabled = item.enabled,
                onClick = { onDismiss(); item.onClick() },
            )
        }
    }
}
