#!/system/bin/sh
# Copy the toolkit next to a stable path so service.sh can find it after boot.
ui_print "- Installing ServiceKit Phone gadget scripts to /data/adb/servicekit"
mkdir -p /data/adb/servicekit
for f in skstick.sh skhid.py macros-hid.json hid-bridge.js; do
  [ -f "$MODPATH/$f" ] && cp -f "$MODPATH/$f" /data/adb/servicekit/ 2>/dev/null
done
set_perm_recursive /data/adb/servicekit 0 0 0755 0644
ui_print "- Done. Kernel must provide configfs USB gadget + f_mass_storage + f_hid."
