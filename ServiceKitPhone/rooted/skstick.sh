#!/system/bin/sh
# ServiceKit Phone — ROOTED gadget mode.
# Turns a ROOTED Android phone into a real USB mass-storage stick (the PC mounts
# it like a plain ServiceKit stick — no bridge needed) and/or a USB HID keyboard
# (openly-operated service macros typed straight into the PC).
#
# Needs: root (su), a kernel with configfs USB gadget + f_mass_storage + f_hid
# (most phones since ~Android 8 have these), and the USB port in peripheral mode.
#
# UNTESTED ON HARDWARE — written without a rooted phone to run it on. configfs
# paths, the UDC name and function availability vary by device; read the echoes.
# Setting up our gadget usually drops adb/MTP until `teardown` restores the stock
# gadget (or you reboot). Run everything as root:  su -c 'sh skstick.sh both on'
#
# Usage:
#   sh skstick.sh build [SRC] [IMG] [SIZEMB]   build a FAT image from the kit
#   sh skstick.sh stick on [IMG]   |  stick off      mass-storage only
#   sh skstick.sh hid   on         |  hid   off      HID keyboard only  (-> /dev/hidg0)
#   sh skstick.sh both  on [IMG]   |  both  off      both at once
#   sh skstick.sh status
#   sh skstick.sh teardown                     unbind + remove our gadget
set -u

G_NAME=servicekit
VID=0x1d6b          # Linux Foundation
PID=0x0104          # Multifunction Composite Gadget
MANUF="ServiceKit"
PRODUCT="ServiceKit Phone"
SERIAL="SKP-0001"
DEF_IMG=/data/local/tmp/servicekit.img
DEF_SRC=""          # resolved below
MOUNT_TMP=/data/local/tmp/sk_mnt

say() { echo "[skstick] $*"; }
die() { echo "[skstick] ERROR: $*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

# ---- locate configfs ------------------------------------------------------
find_cfg() {
  for p in /config/usb_gadget /sys/kernel/config/usb_gadget; do
    [ -d "$p" ] && { echo "$p"; return 0; }
  done
  # try to mount configfs
  mkdir -p /config 2>/dev/null
  mount -t configfs none /config 2>/dev/null
  [ -d /config/usb_gadget ] && { echo /config/usb_gadget; return 0; }
  mount -t configfs none /sys/kernel/config 2>/dev/null
  [ -d /sys/kernel/config/usb_gadget ] && { echo /sys/kernel/config/usb_gadget; return 0; }
  return 1
}

udc_name() { ls /sys/class/udc 2>/dev/null | head -n1; }

# standard 8-byte boot-keyboard report descriptor (63 bytes)
hid_report_desc() {
  printf '\x05\x01\x09\x06\xa1\x01\x05\x07\x19\xe0\x29\xe7\x15\x00\x25\x01\x75\x01\x95\x08\x81\x02\x95\x01\x75\x08\x81\x03\x95\x05\x75\x01\x05\x08\x19\x01\x29\x05\x91\x02\x95\x01\x75\x03\x91\x03\x95\x06\x75\x08\x15\x00\x25\x65\x05\x07\x19\x00\x29\x65\x81\x00\xc0'
}

# ---- gadget skeleton (idempotent) ----------------------------------------
ensure_gadget() {
  CFG="$(find_cfg)" || die "configfs usb_gadget not found — kernel may lack CONFIG_USB_CONFIGFS"
  G="$CFG/$G_NAME"
  if [ ! -d "$G" ]; then
    mkdir "$G" || die "cannot create gadget (need root)"
    echo "$VID" > "$G/idVendor"; echo "$PID" > "$G/idProduct"
    echo 0x0200 > "$G/bcdUSB"   2>/dev/null
    echo 0x0100 > "$G/bcdDevice" 2>/dev/null
    mkdir -p "$G/strings/0x409"
    echo "$SERIAL"  > "$G/strings/0x409/serialnumber"
    echo "$MANUF"   > "$G/strings/0x409/manufacturer"
    echo "$PRODUCT" > "$G/strings/0x409/product"
    mkdir -p "$G/configs/c.1/strings/0x409"
    echo "ServiceKit" > "$G/configs/c.1/strings/0x409/configuration"
    echo 250 > "$G/configs/c.1/MaxPower" 2>/dev/null
    say "gadget created at $G"
  fi
}

bound() { [ -n "$(cat "$G/UDC" 2>/dev/null)" ]; }
unbind() { bound && { echo "" > "$G/UDC" 2>/dev/null; say "unbound"; }; }
bind()   { U="$(udc_name)"; [ -n "$U" ] || die "no UDC in /sys/class/udc (USB not in peripheral mode?)"; echo "$U" > "$G/UDC" || die "bind failed"; say "bound to UDC $U"; }

add_mass_storage() {
  IMG="${1:-$DEF_IMG}"; [ -f "$IMG" ] || die "image not found: $IMG  (run: sh skstick.sh build)"
  mkdir -p "$G/functions/mass_storage.0" 2>/dev/null
  echo 1     > "$G/functions/mass_storage.0/stall" 2>/dev/null
  echo 1     > "$G/functions/mass_storage.0/lun.0/removable"
  echo 0     > "$G/functions/mass_storage.0/lun.0/ro"
  echo 0     > "$G/functions/mass_storage.0/lun.0/cdrom" 2>/dev/null
  echo "$IMG" > "$G/functions/mass_storage.0/lun.0/file" || die "could not attach image to LUN"
  [ -e "$G/configs/c.1/mass_storage.0" ] || ln -s "$G/functions/mass_storage.0" "$G/configs/c.1/"
  say "mass storage -> $IMG"
}
del_mass_storage() {
  rm -f "$G/configs/c.1/mass_storage.0" 2>/dev/null
  rmdir "$G/functions/mass_storage.0" 2>/dev/null
  say "mass storage removed"
}

add_hid() {
  mkdir -p "$G/functions/hid.0" 2>/dev/null
  echo 1 > "$G/functions/hid.0/protocol"       # 1 = keyboard
  echo 1 > "$G/functions/hid.0/subclass"       # 1 = boot interface
  echo 8 > "$G/functions/hid.0/report_length"
  hid_report_desc > "$G/functions/hid.0/report_desc" || die "could not write HID report descriptor"
  [ -e "$G/configs/c.1/hid.0" ] || ln -s "$G/functions/hid.0" "$G/configs/c.1/"
  say "HID keyboard added (device appears as /dev/hidg0 once bound)"
}
del_hid() {
  rm -f "$G/configs/c.1/hid.0" 2>/dev/null
  rmdir "$G/functions/hid.0" 2>/dev/null
  say "HID removed"
}

# ---- build the FAT image from the kit ------------------------------------
resolve_src() {
  [ -n "$DEF_SRC" ] && { echo "$DEF_SRC"; return; }
  d="$(cd "$(dirname "$0")" && pwd)"
  for c in "$d/../www/kit/ServiceKit" "$d/../www/kit/ServiceKit.zip" "$d/ServiceKit" "$d/ServiceKit.zip"; do
    [ -e "$c" ] && { echo "$c"; return; }
  done
  echo ""
}

build() {
  SRC="${1:-$(resolve_src)}"; IMG="${2:-$DEF_IMG}"; SIZE="${3:-}"
  [ -n "$SRC" ] && [ -e "$SRC" ] || die "source kit not found — pass it: sh skstick.sh build /path/to/ServiceKit(.zip)"
  have mkfs.vfat || die "mkfs.vfat missing — install dosfstools (Termux: pkg install dosfstools)"
  # size: source size + 40% slack, min 64 MB
  if [ -z "$SIZE" ]; then
    kb=$(du -sk "$SRC" 2>/dev/null | awk '{print $1}'); [ -n "$kb" ] || kb=32768
    SIZE=$(( kb / 1024 * 14 / 10 + 8 )); [ "$SIZE" -lt 64 ] && SIZE=64
  fi
  say "building $IMG (${SIZE} MB, FAT) from $SRC"
  rm -f "$IMG"
  if have truncate; then truncate -s "${SIZE}M" "$IMG"; else dd if=/dev/zero of="$IMG" bs=1M count="$SIZE" 2>/dev/null; fi
  mkfs.vfat -n SERVICEKIT "$IMG" >/dev/null || die "mkfs.vfat failed"
  # stage the files (unzip if needed) then copy in
  STAGE="$SRC"; CLEAN=""
  case "$SRC" in
    *.zip) STAGE=/data/local/tmp/sk_stage; rm -rf "$STAGE"; mkdir -p "$STAGE";
           have unzip || die "unzip missing (Termux: pkg install unzip)"; unzip -oq "$SRC" -d "$STAGE"; CLEAN="$STAGE" ;;
  esac
  if have mcopy; then
    ( cd "$STAGE" && mcopy -s -i "$IMG" ./* :: ) || die "mcopy failed"
  else
    # loop-mount fallback (root)
    mkdir -p "$MOUNT_TMP"
    mount -o loop "$IMG" "$MOUNT_TMP" 2>/dev/null || die "no mcopy and loop-mount failed — install mtools (pkg install mtools)"
    cp -a "$STAGE"/. "$MOUNT_TMP"/ && sync
    umount "$MOUNT_TMP"
  fi
  [ -n "$CLEAN" ] && rm -rf "$CLEAN"
  say "image ready: $IMG"
}

status() {
  CFG="$(find_cfg 2>/dev/null)"; G="$CFG/$G_NAME"
  echo "configfs : ${CFG:-<not found>}"
  echo "UDC avail: $(udc_name || echo none)"
  if [ -d "$G" ]; then
    echo "gadget   : present"
    echo "bound to : $(cat "$G/UDC" 2>/dev/null || echo '<unbound>')"
    echo "functions: $(ls "$G/configs/c.1" 2>/dev/null | grep -E 'mass_storage|hid' | tr '\n' ' ')"
    [ -e "$G/functions/mass_storage.0/lun.0/file" ] && echo "image    : $(cat "$G/functions/mass_storage.0/lun.0/file")"
    [ -e /dev/hidg0 ] && echo "hid dev  : /dev/hidg0 present"
  else
    echo "gadget   : not set up"
  fi
}

teardown() {
  CFG="$(find_cfg 2>/dev/null)" || { say "nothing to tear down"; return; }
  G="$CFG/$G_NAME"; [ -d "$G" ] || { say "nothing to tear down"; return; }
  unbind
  del_hid; del_mass_storage
  rmdir "$G/configs/c.1/strings/0x409" 2>/dev/null
  rmdir "$G/configs/c.1" 2>/dev/null
  rmdir "$G/strings/0x409" 2>/dev/null
  rmdir "$G" 2>/dev/null
  say "gadget removed. If adb/MTP didn't return, replug the cable or reboot."
}

cmd="${1:-}"; sub="${2:-}"
case "$cmd" in
  build)  build "${2:-}" "${3:-}" "${4:-}" ;;
  stick)  ensure_gadget; case "$sub" in on) unbind; add_mass_storage "${3:-$DEF_IMG}"; bind ;; off) unbind; del_mass_storage ;; *) die "stick on|off" ;; esac ;;
  hid)    ensure_gadget; case "$sub" in on) unbind; add_hid; bind ;; off) unbind; del_hid ;; *) die "hid on|off" ;; esac ;;
  both)   ensure_gadget; case "$sub" in on) unbind; add_mass_storage "${3:-$DEF_IMG}"; add_hid; bind ;; off) unbind; del_hid; del_mass_storage ;; *) die "both on|off" ;; esac ;;
  status) status ;;
  teardown) teardown ;;
  *) echo "Usage: sh skstick.sh {build|stick on|stick off|hid on|hid off|both on|both off|status|teardown}"; exit 1 ;;
esac
