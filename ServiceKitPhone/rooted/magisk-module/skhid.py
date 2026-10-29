#!/usr/bin/env python3
# ServiceKit Phone — HID keystroke sender (rooted mode).
# Writes 8-byte USB HID boot-keyboard reports to /dev/hidg0 (created by skstick.sh
# `hid on`), so the phone types straight into the PC. Openly operated by the owner
# on their own / authorised machines — a service tool, not a covert one.
#
#   python3 skhid.py text "E:\\ServiceKit\\START.cmd"
#   python3 skhid.py key GUI+r
#   python3 skhid.py macro launch-kit          # from macros-hid.json
#   python3 skhid.py list
#   (add --dev /path  to target a file instead of /dev/hidg0 — used by the tests)
import sys, os, json, time, argparse

MOD = {'CTRL': 0x01, 'SHIFT': 0x02, 'ALT': 0x04, 'GUI': 0x08,
       'LCTRL': 0x01, 'LSHIFT': 0x02, 'LALT': 0x04, 'LGUI': 0x08,
       'WIN': 0x08, 'CMD': 0x08, 'RCTRL': 0x10, 'RSHIFT': 0x20, 'RALT': 0x40}

# named non-printable keys -> HID usage id
NAMED = {
    'ENTER': 0x28, 'RETURN': 0x28, 'ESC': 0x29, 'ESCAPE': 0x29, 'BACKSPACE': 0x2a,
    'TAB': 0x2b, 'SPACE': 0x2c, 'DELETE': 0x4c, 'DEL': 0x4c, 'INSERT': 0x49,
    'HOME': 0x4a, 'END': 0x4d, 'PAGEUP': 0x4b, 'PAGEDOWN': 0x4e,
    'UP': 0x52, 'DOWN': 0x51, 'LEFT': 0x50, 'RIGHT': 0x4f,
    'F1': 0x3a, 'F2': 0x3b, 'F3': 0x3c, 'F4': 0x3d, 'F5': 0x3e, 'F6': 0x3f,
    'F7': 0x40, 'F8': 0x41, 'F9': 0x42, 'F10': 0x43, 'F11': 0x44, 'F12': 0x45,
    'CAPSLOCK': 0x39, 'PRINTSCREEN': 0x46,
}

# printable char -> (usage id, needs_shift). US layout.
def _base_map():
    m = {}
    for i, c in enumerate('abcdefghijklmnopqrstuvwxyz'):
        m[c] = (0x04 + i, False)
        m[c.upper()] = (0x04 + i, True)
    digits = '1234567890'
    for i, c in enumerate(digits):
        m[c] = (0x1e + i, False)
    shift_digits = '!@#$%^&*()'
    for i, c in enumerate(shift_digits):
        m[c] = (0x1e + i, True)
    singles = {
        ' ': (0x2c, False), '\t': (0x2b, False), '\n': (0x28, False),
        '-': (0x2d, False), '_': (0x2d, True), '=': (0x2e, False), '+': (0x2e, True),
        '[': (0x2f, False), '{': (0x2f, True), ']': (0x30, False), '}': (0x30, True),
        '\\': (0x31, False), '|': (0x31, True), ';': (0x33, False), ':': (0x33, True),
        "'": (0x34, False), '"': (0x34, True), '`': (0x35, False), '~': (0x35, True),
        ',': (0x36, False), '<': (0x36, True), '.': (0x37, False), '>': (0x37, True),
        '/': (0x38, False), '?': (0x38, True),
    }
    m.update(singles)
    return m

CHARMAP = _base_map()
RELEASE = bytes(8)


def _report(mod, key):
    return bytes([mod & 0xff, 0, key & 0xff, 0, 0, 0, 0, 0])


class Sender:
    def __init__(self, dev='/dev/hidg0', cps=0.008):
        self.dev = dev
        self.delay = cps
        self.reports = []  # captured for tests when dev is a normal file

    def _write(self, data):
        with open(self.dev, 'wb', buffering=0) as f:
            f.write(data)
        self.reports.append(data)

    def tap(self, mod, key):
        self._write(_report(mod, key))
        time.sleep(self.delay)
        self._write(RELEASE)
        time.sleep(self.delay)

    def type_text(self, s):
        for ch in s:
            if ch not in CHARMAP:
                # skip unknown chars rather than typing garbage
                continue
            key, shift = CHARMAP[ch]
            self.tap(MOD['SHIFT'] if shift else 0, key)

    def press(self, combo):
        parts = [p.strip().upper() for p in combo.replace(' ', '').split('+') if p.strip()]
        mod = 0
        key = 0
        for p in parts:
            if p in MOD:
                mod |= MOD[p]
            elif p in NAMED:
                key = NAMED[p]
            elif len(p) == 1 and p.lower() in CHARMAP:
                key = CHARMAP[p.lower()][0]
            else:
                raise ValueError('unknown key in combo: ' + p)
        self.tap(mod, key)

    def run_seq(self, steps):
        for st in steps:
            if 'delay' in st:
                time.sleep(st['delay'] / 1000.0)
            elif 'key' in st:
                self.press(st['key'])
            elif 'text' in st:
                self.type_text(st['text'])


def load_macros():
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'macros-hid.json')
    with open(p, encoding='utf-8') as f:
        return json.load(f).get('macros', [])


def main(argv=None):
    ap = argparse.ArgumentParser(prog='skhid.py')
    ap.add_argument('action', choices=['text', 'key', 'macro', 'seq', 'list'])
    ap.add_argument('arg', nargs='?', default='')
    ap.add_argument('--dev', default='/dev/hidg0')
    ap.add_argument('--delay', type=float, default=0.008, help='seconds between press/release')
    a = ap.parse_args(argv)

    if a.action == 'list':
        for m in load_macros():
            print('%-16s %s' % (m['id'], m.get('hu', '')))
        return 0

    s = Sender(a.dev, a.delay)
    if a.action == 'text':
        s.type_text(a.arg)
    elif a.action == 'key':
        s.press(a.arg)
    elif a.action == 'macro':
        macros = {m['id']: m for m in load_macros()}
        if a.arg not in macros:
            print('no such macro: ' + a.arg, file=sys.stderr)
            return 2
        s.run_seq(macros[a.arg]['steps'])
    elif a.action == 'seq':
        with open(a.arg, encoding='utf-8') as f:
            s.run_seq(json.load(f))
    return 0


if __name__ == '__main__':
    sys.exit(main())
