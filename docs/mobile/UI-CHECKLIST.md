# VRG Mobile - UI findability and clarity checklist (Compose)

Purpose: audit checklist for Compose UI code. Written 2026-11-23.

Source status tags (honest provenance):
- **[V]** = page fetched and read on 2026-11-23 (developer.android.com pages only).
- **[K]** = established convention stated from prior knowledge; the host (m3.material.io, w3.org, nngroup.com) was
  NOT reachable from this session, so the number/claim was not re-read. Re-verify before quoting externally.

Search tip for a code audit: each item has a "Check" line, a grep or a visual test.

---

## 1. Touch targets and spacing

1.1 **Every tappable element is at least 48 x 48 dp.** Threshold: 48 dp each axis. [V]
- Check: `Modifier.size(<48.dp)` / `.height(<48.dp)` / `.width(<48.dp)` on or before a `clickable`, `combinedClickable`,
  `IconButton`, `selectable`, `toggleable`. Compose only expands the hit area outside the drawn box; neighbours' areas can
  then overlap.
- Src: https://developer.android.com/develop/ui/compose/accessibility/api-defaults

1.2 **A control that must look small keeps a 48 dp slot via `minimumInteractiveComponentSize()`.** [V]
- Check: small icon/chip with `clickable` but no `minimumInteractiveComponentSize()`; the modifier must come BEFORE any
  `size(...)` or it cannot reserve space. Material3 components (Checkbox, Switch, IconButton) already do it, but only when
  the click callback is non-null.
- Src: same page as 1.1.

1.3 **Lift click to the row, not the inner Checkbox/Switch.** `onCheckedChange = null` plus `toggleable(role = ...)` or
`selectable` on the parent row gives one big target and one TalkBack entity. [V]
- Check: a `Row { Text; Switch(onCheckedChange = {...}) }` where the label itself is not tappable.

1.4 **Adjacent targets: at least 8 dp gap (Material guidance); WCAG 2.2 AA 2.5.8 floor is 24 x 24 CSS px or 24 px spacing.** [K]
- Check: `Arrangement.spacedBy(<8.dp)` or zero padding between icon buttons in dock bar, tab strip, icon grids.
- Src: https://m3.material.io/foundations/designing/structure ; https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

1.5 **Dense grids (2x4 sheet windows, dock) still pass 1.1; shrink visuals, never the hit area.** [K, derived from 1.1]
- Check: `weight`/`aspectRatio` cells whose measured size on a 360 dp-wide phone is under 48 dp (verify on screen or with
  1.12 accessibility checks).

---

## 2. Text legibility and colour

2.1 **Body text at least 14 sp, secondary labels at least 12 sp; nothing interactive below 12 sp.** [K]
Material 3 type scale: bodyLarge 16, bodyMedium 14, labelMedium 12, labelSmall 11 (smallest in scale).
- Check: `fontSize = <12.sp` / `TextUnit` literals; use `MaterialTheme.typography.*` instead of raw sp.
- Src: https://m3.material.io/styles/typography/type-scale-tokens

2.2 **Text sizes are in `sp`, never `dp`/`px`, so the system font scale applies.** [K]
- Check: `fontSize = X.dp.toSp()` hacks, `Modifier.height(Ndp)` on a Text container that cuts text at 1.5x-2.0x scale
  (use `heightIn(min=)` / wrap content).

2.3 **Contrast: 4.5:1 for body text, 3:1 for large text (>=18 pt, or >=14 pt bold) and for UI components/graphics
(icon, border of a field, focus/selected indicator).** WCAG 2.2 SC 1.4.3 and 1.4.11, level AA. [K]
- Check: dark navy/teal: teal-on-navy accents, `alpha < 0.6` on text/icons, "disabled-looking" hints that are real
  information, placeholder text. Compute ratio of `Color` pairs in the theme file; put the pairs in a test.
- Src: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html ;
  https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html

2.4 **Do not convey state by colour alone** (selected tab, error, on/off, status dot): add icon, shape, weight,
underline, or text. WCAG 1.4.1 (A). [K]
- Check: state read only from `Color` choice, e.g. `if (selected) Teal else Gray` with nothing else changing.
- Src: https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html

2.5 **Use theme roles (`onSurface`, `onSurfaceVariant`), not hard-coded colours** so contrast is decided in one place. [K]
- Check: `Color(0x...)` literals in composables outside the theme file.

---

## 3. Discoverability of hidden affordances

3.1 **Long-press must never be the only way to reach an action.** NN/g: long press is invisible, users rarely try it;
pair it with a visible control (overflow "more" button, or an edit mode) and use it only as an accelerator. [K]
- Check: `combinedClickable(onLongClick = ...)` / `pointerInput(detectTapGestures(onLongPress...))` where the same action
  is not also in a visible menu/button. Add `onLongClickLabel` so TalkBack announces it. [V for onLongClickLabel]
- Src: https://www.nngroup.com/articles/long-press/ ; https://developer.android.com/develop/ui/compose/accessibility/api-defaults

3.2 **Swipe-only navigation needs a visible alternative** (tabs, arrows, page indicator, or buttons). NN/g: gestures
are not discoverable; screen-reader and switch users cannot swipe. [K]
- Check: `HorizontalPager` / `swipeable` / `draggable` with no tab row, dots, or button that moves the page.
- Src: https://www.nngroup.com/articles/gesture-discoverability/ (check exact title)

3.3 **Pager shows where you are: page dots/tab strip with the current one visibly different (not colour only).** [K]
- Check: `HorizontalPager` without a sibling indicator reading `pagerState.currentPage`; for more than ~7 pages use a
  labelled tab strip, not dots.
- Src: https://m3.material.io/components/tabs/guidelines

3.4 **Icon-only buttons need a label: tooltip, text, or an obvious standard icon.** NN/g: icons alone are ambiguous
except a few universal ones (search, home, close, share). [K]
- Check: `IconButton { Icon(..., contentDescription = ...) }` with no visible text for non-standard icons; add
  `TooltipBox` (long-press hint) or put a label under the icon (dock, grid cards).
- Src: https://www.nngroup.com/articles/icon-usability/

3.5 **Primary actions never live inside a scroll region.** The incident: "+" at the end of a `horizontalScroll` row
capped at 200 dp. Put "+", "search", "close" outside the scrolling container (fixed `Row { scrollingTabs(weight(1f));
AddButton }`). [derived from NN/g "visible = findable"]
- Check: `Row(Modifier...horizontalScroll(...))` / `LazyRow` whose last or first child is an add/new/primary action;
  any `widthIn(max = N.dp)`/`width(N.dp)` hard cap on a scroller. Fix = action as sibling outside the scroller.

3.6 **A scroller must signal there is more: peeking item (last visible item cut off by 20-40 %), edge fade, or scrollbar.**
Material carousel/tab guidance: scrollable tabs show partial next tab. [K]
- Check: `LazyRow`/`horizontalScroll`/`ScrollableTabRow` with `contentPadding` and item widths that make items land
  exactly on the edge (no peek), no fade overlay (`Modifier.drawWithContent` gradient / `fadingEdge`), no scrollbar.
- Src: https://m3.material.io/components/tabs/guidelines ; https://www.nngroup.com/articles/scrolling-and-scrollbars/

3.7 **Auto-scroll the selected/new item into view** (after "+" creates a tab, scroll to it). [derived]
- Check: new item added to a scroller state without `animateScrollToItem` / `ScrollState.animateScrollTo`.

3.8 **Hidden navigation costs usage.** NN/g: hamburger/hidden menus cut discoverability vs visible nav; keep
frequent destinations visible (bottom bar/dock/tabs). [K]
- Check: top-level feature reachable only through a drawer/overflow.
- Src: https://www.nngroup.com/articles/hamburger-menus/

---

## 4. Containers that can clip

4.1 **Anything whose content can grow is scrollable.** Popup lists, dialogs, bottom sheets, side panels, menus. The
incident: non-scrolling popup list clipped its last item. [derived; V for Material defaults below]
- Check: `Column(...)` (not `LazyColumn`) inside `Dialog`, `Popup`, `AlertDialog(text = {...})`,
  `ModalBottomSheet`, `DropdownMenu` content, side panel, without `Modifier.verticalScroll(rememberScrollState())`;
  `Popup` with fixed `height(N.dp)` or a `Box` with `size(...)` around a list. Lists with unbounded N: `LazyColumn` with
  a bounded `heightIn(max = ...)`.
- Src: https://m3.material.io/components/dialogs/guidelines ; https://m3.material.io/components/bottom-sheets/guidelines

4.2 **Dialogs: title + body (scrollable) + actions; actions stay pinned and visible.** Use `AlertDialog` (its text slot
is where you add the scroll). Keep dialogs short; full-screen dialog for long forms. [K]
- Check: buttons placed inside the same scrolling Column as the body (they scroll away).

4.3 **Custom `Popup`/overlay is clamped to the window**: use `PopupPositionProvider` or `DropdownMenu`, which keep
inside screen insets; manual `offset` can go off-screen. [K]
- Check: `Popup(offset = IntOffset(...))` / `Modifier.offset` with an anchor near the screen edge and no clamping.

4.4 **Respect insets**: status/navigation bars, display cutout, IME. [K]
- Check: edge-to-edge app with no `WindowInsets.safeDrawing` / `systemBarsPadding()` / `imePadding()` on panels and the
  dock; text field covered by keyboard.
- Src: https://developer.android.com/develop/ui/compose/layouts/insets

4.5 **Test matrix before sign-off: font scale 1.0, 1.3, 2.0 (Settings > Display > Font size, or `adb shell settings put
system font_scale 2.0`), display size largest, landscape, smallest phone (320-360 dp wide), split-screen.** Every
screen: no clipped text, no unreachable control, all scrolling works. [K]
- Check (Compose): `@Preview(fontScale = 2f)` and `@Preview(widthDp = 640, heightDp = 360)` on each screen;
  `LocalDensity provides Density(density, fontScale = 2f)` in tests.
- Src: https://developer.android.com/develop/ui/compose/designsystem/material3 (previews) ; WCAG 1.4.4 resize text 200 %

4.6 **Fixed-height rows (tab strips, cards, dock) use `heightIn(min=)`/wrap content, and text uses `maxLines` +
`overflow = Ellipsis` deliberately** (ellipsis hides info: a full name must be reachable some other way). [K]
- Check: `height(Ndp)` on a Row/Card containing Text; `Text` without `maxLines` in a fixed box.

---

## 5. Primary actions, back, states, destructive actions

5.1 **One primary action per screen, in a consistent place** (FAB bottom-right, or top app bar action); FAB only for
the single most frequent create action. [K]
- Check: more than one `FloatingActionButton` on a screen; same action in different positions across screens.
- Src: https://m3.material.io/components/floating-action-button/guidelines

5.2 **System Back always works and goes up one logical level; closes overlays first** (menu, sheet, dialog, search,
selection mode), then the screen, then the app. [V]
- Check: overlay state in `remember` without `BackHandler(enabled = overlayOpen)`; `BackHandler` that is always
  enabled (swallows back); business logic in back callbacks. Use `PredictiveBackHandler` only if you animate. Predictive
  back is on by default for new apps; opt-out flag is `android:enableOnBackInvokedCallback="false"`; a custom
  `BackHandler` disables the system back-to-home animation while enabled, so enable it only when state requires it.
- Src: https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture

5.3 **Top app bar: back arrow/close at the start, title, at most 2-3 actions plus overflow.** [K]
- Check: screens with no visible way back besides gesture; more than 3 icon actions in `TopAppBar(actions = ...)`.
- Src: https://m3.material.io/components/top-app-bar/guidelines

5.4 **Empty states say what to do**: icon/illustration, one line of why it is empty, and a button for the first action
("Add first sheet"). [K]
- Check: `if (items.isEmpty())` branch that renders nothing/blank, or text with no action.
- Src: https://m3.material.io/foundations/content-design/overview ; https://www.nngroup.com/articles/empty-state-interface-design/

5.5 **Loading state visible if work exceeds ~1 s** (progress indicator; skeleton for lists). **Error state says what
happened and offers retry.** [K]
- Check: async `LaunchedEffect`/ViewModel state with no Loading/Error branch in the UI `when`; `catch {}` swallowing;
  error shown only via `Log`.
- Src: https://www.nngroup.com/articles/response-times-3-important-limits/

5.6 **Destructive actions: prefer undo (snackbar "Deleted - Undo") over a confirm dialog; use a confirm dialog only
for irreversible or high-cost actions, naming the thing and using a verb button ("Delete sheet", not "OK").** [K]
- Check: `onDelete`/`remove`/`clear` called straight from a tap or long-press with neither undo nor confirmation;
  confirm dialogs for trivial actions (dialog fatigue).
- Src: https://www.nngroup.com/articles/confirmation-dialog/ ; https://m3.material.io/components/snackbar/guidelines

5.7 **Destructive buttons are not adjacent to and not styled like the safe action** and never the default target of a
mis-tap (keep >= 8 dp, use error colour plus label). [K]

---

## 6. Feedback

6.1 **Every tappable has a visible pressed state** (ripple or tint). [V indirectly: `clickable` supplies indication]
- Check: `clickable(indication = null, ...)`, or `Box` with `pointerInput` taps (no ripple, no semantics); custom
  `interactionSource` without a visible effect.

6.2 **Selected vs unselected differ by more than colour** (underline/indicator bar, filled vs outlined icon, check mark,
bold label). [K]
- Check: selected style = only `color`/`alpha` change (see 2.4).
- Src: https://m3.material.io/components/navigation-bar/guidelines

6.3 **Disabled controls look disabled and (if the reason is non-obvious) say why.** [K]

6.4 **Haptics for long-press recognition and drag start/drop**: `LocalHapticFeedback.current.performHapticFeedback(
HapticFeedbackType.LongPress)` (also `TextHandleMove`, `Confirm`/`Reject` on newer versions). Do not buzz on every tap. [K]
- Check: `onLongClick` / drag-start handlers with no haptic call.
- Src: https://developer.android.com/develop/ui/views/haptics/haptic-feedback

6.5 **Snackbars for results of an action (with Undo/Retry action); toasts only for trivial notices.** Snackbar
duration: Short ~4 s, Long ~10 s, Indefinite; one with an action should not be Short, and must not auto-dismiss while
TalkBack focuses it. Never put the only copy of important info in a toast. [K]
- Check: `Toast.makeText` for errors; `SnackbarDuration.Short` with an action; snackbar covering the dock/FAB (use
  `Scaffold(snackbarHost=...)`).
- Src: https://m3.material.io/components/snackbar/guidelines

6.6 **Long operations show progress, completed operations show confirmation** (state change visible, not silent). [K]

---

## 7. Navigation depth and orientation

7.1 **Frequent actions at most 2 taps from the home screen; rare ones at most 3-4.** [K]
- Check: write the tap path for each top-10 feature (home -> card -> action). Anything >2 taps for a daily task is a
  finding. Count a long-press + menu pick as 2.
- Src: https://www.nngroup.com/articles/the-3-click-rule/ (NN/g: depth matters less than clarity of each step; still
  audit it)

7.2 **"You are here" on every level**: selected nav destination highlighted (`NavigationBarItem(selected=)`), screen
title in the top bar, selected tab/window distinct, page indicator (3.3). [K]
- Check: screens with no title; dock item for the current screen not marked selected.
- Src: https://m3.material.io/components/navigation-bar/guidelines

7.3 **Navigation placement is identical on every screen** (dock stays, back arrow stays at top-start, "+" always in
same corner). [K]
- Check: different `Scaffold` arrangements per screen for the same role; per-screen bespoke back buttons.
- Src: https://www.nngroup.com/articles/consistency-and-standards/

7.4 **3-5 top-level destinations in a bottom bar/dock; more go to a grid/drawer/search.** Home with many features:
add search and "recent/favourites first" (9.6). [K]
- Src: https://m3.material.io/components/navigation-bar/guidelines

7.5 **State survives rotation and process death for the current location** (`rememberSaveable`, nav back stack). [K]

---

## 8. Accessibility semantics in Compose

8.1 **Every `Icon`/`Image` that carries meaning has a localized `contentDescription`; decorative ones use `null`.** [V]
- Check: grep `contentDescription = null` on an icon that is the only content of a clickable/`IconButton`: this is the
  bug. Hard-coded English strings: use `stringResource`.
- Src: https://developer.android.com/develop/ui/compose/accessibility/api-defaults

8.2 **Use `clickable`/`toggleable`/`selectable` with a `role` (`Role.Button`, `Tab`, `Checkbox`, `Switch`,
`RadioButton`, `DropdownList`)**, not bare `pointerInput` taps, which expose no action to TalkBack. [V]
- Check: `pointerInput(Unit) { detectTapGestures ... }` as the only click handler; custom tabs without `Role.Tab` +
  `selectable`.

8.3 **Merge related content into one focus stop** (`clickable` merges descendants; for non-clickable groups use
`Modifier.semantics(mergeDescendants = true)`), and set `onClickLabel`/`onLongClickLabel` so TalkBack says
"double tap to open this article". [V]
- Check: card with icon + title + subtitle producing 3 TalkBack stops; click labels default "activate".

8.4 **Gesture-only actions get a semantic custom action**: `Modifier.semantics { customActions = listOf(
CustomAccessibilityAction("Delete") { ...; true }) }` for swipe-to-dismiss, long-press menus, drag reorder. [K]
- Check: `SwipeToDismissBox`/`draggable`/`combinedClickable(onLongClick)` rows with no `customActions`.
- Src: https://developer.android.com/develop/ui/compose/accessibility/semantics

8.5 **State is exposed**: `stateDescription`, `selected`, `toggleableState`, `heading()` for section titles,
`liveRegion` for snackbar-like updates. [K]
- Check: custom components built from `Box` + `Text` that show state only visually.

8.6 **Traversal order follows visual order**; use `traversalIndex` only when needed. [K]

8.7 **Automated checks**: Compose >= 1.8.0 `enableAccessibilityChecks()` (`ui-test-junit4-accessibility`) flags missing
labels, low contrast, small touch targets, traversal issues; plus Accessibility Scanner on device; plus a manual
TalkBack pass of every screen (can you reach every control, is every label meaningful?). [V]
- Src: https://developer.android.com/develop/ui/compose/accessibility/testing

---

## 9. Intuitive custom conventions (use when it fits)

For each: when appropriate, and the rule that makes it safe. All [K] unless noted; sources: NN/g articles named, M3
component pages.

9.1 **Pull-to-refresh** (`PullToRefreshBox`): only for a list of remote/refreshable data at scroll top; also provide a
refresh button if refresh is important; never on a canvas/workspace. Src: https://m3.material.io/components/progress-indicators/guidelines
9.2 **Swipe-to-dismiss with Undo** (`SwipeToDismissBox` + snackbar): for list rows that are cheap to remove (notes,
notifications); not for important or irreversible items; show a coloured/iconed background so the action is visible;
add the 8.4 custom action.
9.3 **Long-press context menu**: accelerator for secondary row/card actions, same items also in an overflow/selection
mode (3.1); keep <= 7 items; haptic on trigger (6.4); do not use on tiny targets users hit by accident.
9.4 **Double-tap to zoom/maximise**: only for zoomable content (canvas, image, window in the sheets grid); never put it
on controls; provide a visible maximise button too.
9.5 **Drag handle (grip icon, 6 dots)** marks a reorderable/resizable item; drag starts on the handle (or long-press +
haptic) so scrolling still works; offer move up/down actions for accessibility. Src: M3 lists/sheets guidelines
(drag handle on bottom sheets: https://m3.material.io/components/bottom-sheets/guidelines)
9.6 **Recent / favourites first** on a home with many features: sort by last used, allow pin; keeps frequent tasks
within 2 taps (7.1).
9.7 **Search-as-you-type** (`SearchBar`): for lists beyond ~15 items; show results with debounce, keep a clear (x)
button, empty-result message with suggestion; recent searches on focus. Src: https://m3.material.io/components/search/guidelines
9.8 **Selection mode** (long-press selects, top bar becomes contextual with count, back exits): for multi-item bulk
actions; contextual bar must show a close (x) and the count.
9.9 **Tabs with "+"**: "+" outside the scroller (3.5), new tab becomes selected and scrolled into view (3.7), close
control per tab >= 48 dp or via long-press/menu plus visible alternative.
9.10 **Bottom sheet over dialog** for choices launched from the bottom of the screen; sheet needs a drag handle,
scrim tap and Back to dismiss, scrollable content (4.1). Src: https://m3.material.io/components/bottom-sheets/guidelines

---

## Audit quick-grep list (code)

```
size\(\s*[0-3]?\d\.dp          # tiny targets (1.1)
horizontalScroll|LazyRow|ScrollableTabRow   # then check for primary action inside, width caps (3.5, 3.6)
combinedClickable|onLongClick|onLongPress   # long-press-only? onLongClickLabel? haptic? (3.1, 6.4, 8.4)
HorizontalPager|VerticalPager               # indicator + visible alternative (3.2, 3.3)
Popup\(|Dialog\(|AlertDialog|ModalBottomSheet|DropdownMenu   # verticalScroll present? (4.1)
fontSize\s*=\s*\d+\.sp|\.dp\.toSp           # (2.1, 2.2)
Color\(0x                                    # hard-coded colours outside theme (2.5)
contentDescription\s*=\s*null                # only OK when decorative (8.1)
pointerInput.*detectTapGestures              # semantics lost (8.2)
clickable\(.*indication\s*=\s*null           # no pressed feedback (6.1)
Toast\.makeText                              # errors in toasts (6.5)
BackHandler                                   # enabled bound to state? (5.2)
```

---

## Sources

Read on 2026-11-23 [V]:
- Compose accessibility API defaults (touch target 48 dp, minimumInteractiveComponentSize, contentDescription, merging,
  click labels): https://developer.android.com/develop/ui/compose/accessibility/api-defaults
- Predictive back (BackHandler, PredictiveBackHandler, default-on, opt-out):
  https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture
- Compose accessibility testing (enableAccessibilityChecks, Compose 1.8.0+):
  https://developer.android.com/develop/ui/compose/accessibility/testing

Cited from prior knowledge, host not reachable this session [K] (re-verify):
- Material 3: https://m3.material.io/foundations/designing/structure, /styles/typography/type-scale-tokens,
  /components/{tabs,dialogs,bottom-sheets,snackbar,top-app-bar,navigation-bar,floating-action-button,search}/guidelines
- WCAG 2.2: https://www.w3.org/WAI/WCAG22/Understanding/ (target-size-minimum, contrast-minimum, non-text-contrast,
  use-of-color)
- NN/g: https://www.nngroup.com/articles/long-press/ , /gesture-discoverability/ , /icon-usability/ ,
  /hamburger-menus/ , /scrolling-and-scrollbars/ , /confirmation-dialog/ , /empty-state-interface-design/ ,
  /the-3-click-rule/ , /consistency-and-standards/ , /response-times-3-important-limits/ (article slugs from memory;
  some may differ)
- Android: https://developer.android.com/develop/ui/compose/layouts/insets ,
  https://developer.android.com/develop/ui/compose/accessibility/semantics ,
  https://developer.android.com/develop/ui/views/haptics/haptic-feedback
