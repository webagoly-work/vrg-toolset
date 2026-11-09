# M7 research: what an ordinary app can do with the phone's links (Android 9–15)

*Written 2026-11-07 for WP M7 (Hálózat), before the build. "Ordinary app" = installed from an APK or a store,
no system signature, no root, no device-owner role. VRG Mobile is `minSdk 28` (Android 9), `targetSdk 35`
(Android 15). The user's phones: **Redmi Note 13 Pro 5G** (Xiaomi, HyperOS, Android 14), and the test targets
the WP names, **Pixel** (stock Android) and **Sony** (near-stock Xperia UI).*

Every claim below names its source. Where a source says nothing, the text says "not documented" and the
build treats the thing as unknown rather than guessing.

## Summary: kept, dropped, degraded

| Wish (WP M7) | Verdict | What the app does |
|---|---|---|
| Turn the tethering hotspot on/off | **Dropped** — needs `TETHER_PRIVILEGED` (system only) | One tap opens the tethering settings page; the state is shown |
| Turn USB / Bluetooth tethering on/off | **Dropped** — same system permission | Same: state + settings link + the one tap it needs explained |
| Know whether tethering is on, and which kind | **Kept, heuristic** | The sticky `TETHER_STATE_CHANGED` broadcast plus the interface names with an address |
| A WiFi network with no router (phone ↔ PC on a bare site) | **Kept** — `LocalOnlyHotspot` | Started from the screen, SSID + password shown; no internet on it |
| Hotspot usage notification with a threshold | **Kept, approximate** | `TrafficStats` mobile bytes (whole phone, not per client) + the hotspot interface's own bytes on Android 12+ |
| Exact per-client usage | **Dropped** — not available to apps | The screen says so |
| Bluetooth HID status | **Kept** | Légegér publishes its HID phase and host through the kit; the screen shows it with a link |
| The phone as the relay (D-9 = A) | **Kept** | A WebSocket server in a `connectedDevice` foreground service, off by default, paired clients only |

## 1. Hotspot

**Regular (tethering) hotspot.** `TetheringManager.startTethering` and the old `ConnectivityManager.startTethering`
are `@SystemApi` and require `TETHER_PRIVILEGED`, a signature|privileged permission an APK cannot get
([TetheringManager source][tm-src]). `WifiManager.setWifiApEnabled` was removed from apps long ago. So an app
**cannot switch the hotspot**. → dropped; a settings link instead.

**LocalOnlyHotspot (LOHS).** Public since API 26: `WifiManager.startLocalOnlyHotspot(callback, handler)` gives a
WPA2 network the app's peers can join; "the network created by this method will not have Internet access", several
apps share one, and `onStarted(reservation)` hands over the configuration
([Android guide: local-only hotspot][lohs]). Permissions: `NEARBY_WIFI_DEVICES` when targeting Android 13+,
`ACCESS_FINE_LOCATION` below ([same page][lohs]); `CHANGE_WIFI_STATE` too (the API reference). The reservation
lives as long as the app holds it; closing it (or the process dying) ends the network. SSID / passphrase:
`reservation.softApConfiguration` on API 30+, `reservation.wifiConfiguration` (deprecated) before.
Known limits, not stated in the docs and **to verify on the phones**: on most phones the regular hotspot and LOHS
cannot run at once, and on phones without STA+AP concurrency the phone's own WiFi client drops while LOHS is on.
The startup errors (`ERROR_INCOMPATIBLE_MODE`, `ERROR_TETHERING_DISALLOWED`, `ERROR_NO_CHANNEL`, `ERROR_GENERIC`)
are shown in Hungarian. → **kept**: "Helyi WiFi (internet nélkül)" on the Hálózat screen; the phone relay listens on
it like on any interface. On Android 9–12 it asks for precise location, which must also be switched on (the
callback fails otherwise — community-reported, verify on Android 9).

## 2. Tethering state and the settings deep links

**State.** There is no public, non-privileged API for "is tethering on". The options:

- The sticky broadcast `android.net.conn.TETHER_STATE_CHANGED` (`TetheringManager.ACTION_TETHER_STATE_CHANGED`,
  hidden). Its extras list interface names per state: `availableArray`, `tetherArray` (API 26+; `activeArray`
  before), `erroredArray`. The framework marks it deprecated in favour of `TetheringEventCallback`, which is a
  system API ([TetheringManager source][tm-src]; [Stack Overflow thread][so-tether]). Reading a sticky broadcast
  (`registerReceiver(null, filter)`) needs no permission. → **used**, as the first signal.
- `NetworkInterface.getNetworkInterfaces()`: on Android 11+ apps that target API 30+ lose `RTM_GETLINK`, so MAC
  addresses are gone, but interfaces **that carry an address** are still listed (bionic falls back to
  `RTM_GETADDR`) ([bionic change][bionic]; [Go issue 40569][go40569]). Names seen in the wild: `ap0`, `swlan0`,
  `wlan1` (WiFi hotspot / LOHS), `rndis0`, `ncm0`, `usb0` (USB tethering), `bt-pan` (Bluetooth tethering)
  ([Stack Overflow thread][so-tether]). → **used** as the second signal and for the relay's addresses.
- `/proc/sys/net/ipv4/ip_forward`: unreadable from the app sandbox on modern Android. → not used.

The classification of interface names is pure Kotlin (`kit-core` `Net.kt`), tested; an unknown name shows as
"ismeretlen" rather than being guessed.

**Deep links.** No public `Settings` action exists for the tethering page. Known strings:

| Intent | Where it works (per sources) |
|---|---|
| action `android.settings.TETHER_SETTINGS` (hidden `Settings.ACTION_TETHER_SETTINGS`) | AOSP / Pixel; the framework itself moved a QS tile to it "to handle it differently on Settings app side" ([AOSP commit via /e/OS][eos-tether]); used by a cross-device plugin ([open_settings_plus][osp]) |
| component `com.android.settings/.TetherSettings` | older AOSP, many OEMs ([CSDN sample][csdn]) |
| component `com.android.settings/.Settings$TetherSettingsActivity` | AOSP 9+ (the activity alias behind the hidden action) |
| `Settings.ACTION_WIRELESS_SETTINGS` (public) | everywhere; one level above tethering |

Xiaomi / HyperOS: its path is Beállítások → Kapcsolat és megosztás → Személyes hotspot
([Wondershare guide][xiaomi-path]); no source documents a dedicated intent. Sony: near-AOSP, expected to take the
hidden action. → The app tries the chain top to bottom, catching `ActivityNotFoundException` (no `<queries>` needed),
and the screen names the one tap left ("Kapcsold be: USB-megosztás"). Which link lands where on each phone is the
first row of the phone matrix below.

**USB / Bluetooth tethering**: same `TETHER_PRIVILEGED` wall → dropped; state + the same link.

## 3. Usage (TrafficStats)

`TrafficStats.getMobileRxBytes()/getMobileTxBytes()`: bytes "across all mobile network interfaces … since device
boot", reset to zero on reboot ([TrafficStats reference][ts]). They count the **whole phone's** mobile traffic,
own apps included; whether tethered traffic is in them is **not documented** (it crosses the mobile interface,
so it is expected — verify on the phone). `getRxBytes(iface)/getTxBytes(iface)` (API 31+) give one interface's
bytes "since the interface was created" ([same page][ts]): the hotspot interface (`ap0`, `swlan0`…) **is** the
clients' traffic, minus the phone's own. Per-client numbers: no API. `NetworkStatsManager.querySummaryForDevice`
gives history but needs `PACKAGE_USAGE_STATS`, which the user grants by hand in Settings and which Play treats as
sensitive ([NetworkStatsManager reference][nsm]). → **kept, approximate**: the day's mobile bytes from TrafficStats
(the day counter survives reboots by keeping a baseline, `kit-core` `Usage.kt`, tested), the hotspot interface's
bytes on Android 12+ beside it, one warning per day when the user's threshold is crossed. NetworkStatsManager:
not used now (a later option if the user wants history).

## 4. Bluetooth HID status

`BluetoothHidDevice` (API 28) is public: `getProfileProxy(HID_DEVICE)` → `registerApp(sdp…)`, the status comes from
`Callback.onAppStatusChanged` ([BluetoothHidDevice reference][hid]; [.NET binding docs, API 28, BLUETOOTH_CONNECT][hid-ms]).
Some builds remove the profile (getProfileProxy fails or never calls back) — Légegér already shows that as
UNSUPPORTED. → **kept**: Légegér publishes its phase and host name to `kit/HidStatus`; Hálózat shows it and opens
Légegér. No second HID stack.

## 5. A server socket in a foreground service

A plain `java.net.ServerSocket` needs only `INTERNET`. Keeping it alive with the screen off needs a foreground
service. Android 14 requires a type per service ([FGS types][fgs]):

- **`connectedDevice`** — "interactions with external devices that require a Bluetooth, NFC, IR, USB, or network
  connection"; manifest `FOREGROUND_SERVICE_CONNECTED_DEVICE` plus **one of** `CHANGE_NETWORK_STATE`,
  `CHANGE_WIFI_STATE`, … declared ([FGS types][fgs]). Both are normal permissions. No time limit is documented.
  → **chosen** for the relay and the usage watch (the PC and the hotspot clients are the connected devices).
- `dataSync` — capped at 6 h per 24 h for apps targeting 15 ([Android 15 changes][a15]). Not suitable.
- `specialUse` — needs a Play-reviewed justification ([FGS types][fgs]). Not needed.

Background starts are restricted since Android 12, so the service is only started from the screen (a user tap);
no boot receiver. The notification carries Leállítás.

## Phone matrix (the "Telefonon ellenőrizni" list)

| Feature | Redmi Note 13 Pro 5G (HyperOS) | Pixel | Sony |
|---|---|---|---|
| Hotspot settings link lands on the tethering page | ☐ | ☐ | ☐ |
| WiFi hotspot detected on / off | ☐ | ☐ | ☐ |
| USB tethering detected on / off | ☐ | ☐ | ☐ |
| BT tethering detected on / off | ☐ | ☐ | ☐ |
| Helyi WiFi (LOHS) starts, SSID + password shown, PC joins | ☐ | ☐ | ☐ |
| Daily mobile usage moves while a PC downloads over the hotspot | ☐ | ☐ | ☐ |
| Hotspot interface bytes shown (Android 12+) | ☐ | ☐ | ☐ |
| Threshold notification once, not again the same day | ☐ | ☐ | ☐ |
| BT HID status matches Légegér | ☐ | ☐ | ☐ |
| Phone relay: start, code, Kódváros + Planner pair and steer | ☐ | ☐ | ☐ |
| Phone relay keeps running with the screen off (10 min) | ☐ | ☐ | ☐ |

[tm-src]: https://git.aicp-rom.com/packages_modules_Connectivity.git/plain/Tethering/common/TetheringLib/src/android/net/TetheringManager.java
[lohs]: https://developer.android.com/develop/connectivity/wifi/localonlyhotspot
[so-tether]: https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/43478586/checking-tethering-usb-bluetooth-is-active
[bionic]: https://gerrit.omnirom.org/plugins/gitiles/android_bionic/+/53211a98dc902a1cc7a24477169dd65a06779473%5E%21
[go40569]: https://golang.org/issue/40569
[eos-tether]: https://gitlab.e.foundation/e/os/android_frameworks_base/-/commit/052e9b12f5fc7a1e3ecdd126ca8c07298941f291
[osp]: https://pub.dev/documentation/open_settings_plus/latest/core_open_settings_plus/OpenSettingsPlusAndroid/tether.html
[csdn]: https://blog.csdn.net/xiyangyang8110/article/details/53307990
[xiaomi-path]: https://drfone.wondershare.com/android-xiaomi/how-to-use-xiaomi-phone-as-wi-fi-hotspot-and-manage-connected-devices.html
[ts]: https://developer.android.com/reference/android/net/TrafficStats
[nsm]: https://developer.android.com/reference/android/app/usage/NetworkStatsManager
[hid]: https://developer.android.com/reference/android/bluetooth/BluetoothHidDevice
[hid-ms]: https://learn.microsoft.com/en-us/dotnet/api/android.bluetooth.bluetoothhiddevice.registerapp?view=net-android-36.0
[fgs]: https://developer.android.com/develop/background-work/services/fgs/service-types
[a15]: https://developer.android.com/about/versions/15/behavior-changes-15
