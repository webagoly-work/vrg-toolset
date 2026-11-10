// fsview.js — look at a file and hand it to a program (WP-13): read, open, reveal, edit, copyPath. Handles in, display strings out.
//   const view = createFileView({ fs, shell, clipboard, handles, roots, cloud, execFile, codePath });
//   view.read(h, { max = 2 MB, fetch })  → { kind:'text'|'image'|'binary', text?, dataUrl?, mime?, encoding?, truncated, size }
//                                          | { ok:false, err:'cloud'|..., hu }
//   view.open(h) / view.reveal(h) / view.edit(h) / view.copyPath(h)
// text: UTF-8 when valid, else Windows-1250 (encoding says which). Images up to `max` come as a data URL; SVG comes as text (the
// page sanitizes it). Anything else with a NUL in the first 4 KB is binary: the first 512 bytes as hex lines.
// Electron's shell / clipboard and child_process.execFile are passed in, so node --test can load this file.
'use strict';
const path = require('path');

const MAX = 2 * 1024 * 1024;
const SNIFF = 4096;
const HEX_BYTES = 512;
const IMAGES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
const FORCE_BINARY = new Set(['.bin', '.exe', '.dll', '.zip', '.7z', '.pdf', '.docx', '.xlsx', '.pptx', '.iso', '.dat']);
// "open with the default program" must not start a program: these are shown or revealed, never run from here (CONTRACT §2)
const RUNNABLE = new Set(['.exe', '.com', '.bat', '.cmd', '.ps1', '.psm1', '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.hta',
  '.msi', '.msp', '.scr', '.lnk', '.url', '.jar', '.reg', '.cpl', '.pif', '.gadget', '.appref-ms', '.application', '.msc']);

const fail = (err, hu) => ({ ok: false, err, hu });

const decodeUtf8 = buf => { try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(buf); } catch (e) { return null; } };

// text bytes → { text, encoding }. A cut in the middle of a UTF-8 character (truncated reads) is not an error.
function decodeText(buf, truncated) {
  let t = decodeUtf8(buf);
  for (let cut = 1; t === null && truncated && cut <= 3 && cut < buf.length; cut++) t = decodeUtf8(buf.subarray(0, buf.length - cut));
  if (t !== null) return { text: t.replace(/^﻿/, ''), encoding: 'utf-8' };
  return { text: new TextDecoder('windows-1250').decode(buf), encoding: 'windows-1250' };
}

function hexLines(buf) {
  const lines = [];
  for (let i = 0; i < buf.length && i < HEX_BYTES; i += 16) {
    const row = buf.subarray(i, Math.min(i + 16, buf.length, HEX_BYTES));
    const hex = Array.from(row, b => b.toString(16).padStart(2, '0')).join(' ').padEnd(47, ' ');
    const asc = Array.from(row, b => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('');
    lines.push(i.toString(16).padStart(8, '0') + '  ' + hex + '  ' + asc);
  }
  return lines.join('\n');
}

function createFileView({ fs, shell, clipboard, handles, roots, cloud = null, execFile, codePath }) {
  async function target(h, hu) {
    const d = handles.resolve(h);
    if (!d) return { err: fail('not-found', hu || 'Nincs ilyen elem.') };
    let st; try { st = await fs.promises.stat(d.abs); } catch (e) { return { err: fail('not-found', hu || 'Nincs ilyen elem.') }; }
    return { d, st };
  }

  async function cloudMark(d) {
    const rt = roots.get(d.root);
    if (!rt || rt.kind === 'local' || !cloud) return undefined;
    try { return (await cloud.marks(path.dirname(d.abs))).get(path.basename(d.abs)); } catch (e) { return undefined; }
  }

  async function read(h, { max = MAX, fetch = false } = {}) {
    if (!Number.isInteger(max) || max < 1 || max > MAX) max = MAX;
    const t = await target(h);
    if (t.err) return t.err;
    if (!t.st.isFile()) return fail('bad-request', 'Ez nem fájl.');
    const { d, st } = t;
    if (!fetch && await cloudMark(d) === 'online') return fail('cloud', 'Csak a felhőben van.');

    const ext = path.extname(d.abs).toLowerCase();
    let buf, fd;
    try {
      fd = await fs.promises.open(d.abs, 'r');                      // reading a cloud-only file with fetch:true makes OneDrive download it
      const want = Math.min(st.size, max);
      buf = Buffer.alloc(want);
      const { bytesRead } = await fd.read(buf, 0, want, 0);
      buf = buf.subarray(0, bytesRead);
    } catch (e) { return fail('io', 'A fájl nem olvasható.'); }
    finally { if (fd) { try { await fd.close(); } catch (e) {} } }
    const truncated = st.size > max;
    const out = { kind: 'text', truncated, size: st.size };

    if (IMAGES[ext]) {
      if (truncated) return fail('too-big', 'A kép túl nagy a megjelenítéshez.');
      return { ...out, kind: 'image', mime: IMAGES[ext], dataUrl: 'data:' + IMAGES[ext] + ';base64,' + buf.toString('base64') };
    }
    const binary = FORCE_BINARY.has(ext) || buf.subarray(0, SNIFF).includes(0);
    if (binary) return { ...out, kind: 'binary', text: hexLines(buf), truncated: st.size > HEX_BYTES };
    const dec = decodeText(buf, truncated);
    if (ext === '.svg') return { ...out, kind: 'image', mime: 'image/svg+xml', svg: true, text: dec.text, encoding: dec.encoding };
    return { ...out, text: dec.text, encoding: dec.encoding };
  }

  async function open(h) {
    const t = await target(h);
    if (t.err) return t.err;
    if (t.st.isFile() && RUNNABLE.has(path.extname(t.d.abs).toLowerCase())) return fail('forbidden', 'Futtatható fájl innen nem nyitható meg.');
    const err = await shell.openPath(t.d.abs);                      // '' = ok
    return err ? fail('io', 'Nem nyitható meg.') : {};
  }

  async function reveal(h) {
    const t = await target(h);
    if (t.err) return t.err;
    shell.showItemInFolder(t.d.abs);
    return {};
  }

  async function edit(h) {
    const t = await target(h);
    if (t.err) return t.err;
    if (!t.st.isFile()) return fail('bad-request', 'Ez nem fájl.');
    const code = typeof codePath === 'function' ? codePath() : codePath;
    let there = false;
    try { there = !!code && fs.existsSync(code); } catch (e) {}
    if (!there) return fail('missing', 'A VS Code nincs telepítve');
    return new Promise(resolve => {
      try {
        const child = execFile(code, [t.d.abs], { windowsHide: true }, () => {});   // one argument, no shell: spaces and & stay in the name
        if (child && typeof child.unref === 'function') child.unref();
        resolve({});
      } catch (e) { resolve(fail('io', 'A VS Code nem indítható.')); }
    });
  }

  async function copyPath(h) {
    const t = await target(h);
    if (t.err) return t.err;
    clipboard.writeText(t.d.abs);
    return { display: t.d.abs };
  }

  return { read, open, reveal, edit, copyPath };
}

module.exports = { createFileView, decodeText, hexLines, MAX, RUNNABLE };
