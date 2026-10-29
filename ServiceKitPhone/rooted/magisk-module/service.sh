#!/system/bin/sh
# ServiceKit Phone — Magisk late_start service.
# By default this does NOTHING, because auto-attaching a USB gadget on every boot
# drops adb/MTP and surprises you. Uncomment the line below to auto-build the image
# and bring up the stick + HID keyboard on boot. The scripts are placed by the
# installer at /data/adb/servicekit/.
MODDIR=${0%/*}
SK=/data/adb/servicekit
# [ -f "$SK/skstick.sh" ] && sh "$SK/skstick.sh" build >/dev/null 2>&1
# [ -f "$SK/skstick.sh" ] && sh "$SK/skstick.sh" both on >/dev/null 2>&1
exit 0
