// fsops.js — file operations as jobs (WP-12): copy, move, rename, mkdir, trash. Everything goes through handles and roots.
//   const ops = createFsOps({ fs, shell, jobs, handles, roots, view, cloud, sameVolume });
//   ops.copy(srcHandles, dstDirHandle, policy) → { job } | { ok:false, err, hu }      ops.move(...) likewise
//   ops.rename(h, name) / ops.mkdir(dirHandle, name) → { item } | { ok:false, err:'exists' | ... }
//   ops.trash(handles) → { job }       (Recycle Bin only: this module never removes a file by itself, CONTRACT §4.5)
// policy: 'ask' | 'skip' | 'overwrite' | 'rename'. On a conflict with 'ask' the job asks ctx.ask(['skip','overwrite','rename','cancel']).
// Electron's shell and the other modules are passed in, so node --test can load this file. sameVolume(a, b) can be injected.
'use strict';
const path = require('path');
const { isSafeName } = require('./names.js');

const LONG = 240;                                                    // paths this long or longer get the \\?\ prefix
const POLICIES = ['ask', 'skip', 'overwrite', 'rename'];
const ASK_CONFLICT = ['skip', 'overwrite', 'rename', 'cancel'];
const ASK_CLOUD = ['yes', 'skip', 'cancel'];

const fail = (err, hu) => ({ ok: false, err, hu });
const sepKey = p => String(p).replace(/[\\/]+$/, '').toLowerCase() + '\\';

// long-path form for every fs call
function lp(p) {
  if (typeof p !== 'string' || p.length < LONG || p.startsWith('\\\\?\\')) return p;
  const abs = path.win32.resolve(p);
  return abs.startsWith('\\\\') ? '\\\\?\\UNC\\' + abs.slice(2) : '\\\\?\\' + abs;
}

// "name.ext" → "name (2).ext"
function numbered(name, n, isDir) {
  const ext = isDir ? '' : path.extname(name);
  return name.slice(0, name.length - ext.length) + ' (' + n + ')' + ext;
}

function createFsOps({ fs, shell, jobs, handles, roots, view = null, cloud = null, sameVolume = null }) {
  const P = fs.promises;
  const F = {
    lstat: p => P.lstat(lp(p)), stat: p => P.stat(lp(p)), readdir: p => P.readdir(lp(p)), mkdir: p => P.mkdir(lp(p)),
    copyFile: (a, b, flags) => P.copyFile(lp(a), lp(b), flags), rename: (a, b) => P.rename(lp(a), lp(b)),
    utimes: (p, at, mt) => P.utimes(lp(p), at, mt), readlink: p => P.readlink(lp(p)), symlink: (t, p, type) => P.symlink(t, lp(p), type),
    real: p => P.realpath(p),
  };
  const EXCL = fs.constants ? fs.constants.COPYFILE_EXCL : 1;

  const lstatOrNull = async p => { try { return await F.lstat(p); } catch (e) { if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return null; throw e; } };
  const realOrSelf = async p => { try { return await F.real(p); } catch (e) { return path.resolve(p); } };

  const volume = async (a, b) => {
    if (sameVolume) return !!(await sameVolume(a, b));
    const [ra, rb] = [await realOrSelf(a), await realOrSelf(b)];
    return path.parse(ra).root.toLowerCase() === path.parse(rb).root.toLowerCase();
  };

  const isRootDir = async abs => {
    const real = (await realOrSelf(abs)).replace(/[\\/]+$/, '').toLowerCase();
    return roots.list().some(r => String(r.real).replace(/[\\/]+$/, '').toLowerCase() === real);
  };

  // ------------------------------------------------------------ shared: handles → checked sources and destination
  async function prepare(srcHandles, dstHandle) {
    if (!Array.isArray(srcHandles) || !srcHandles.length || srcHandles.length > 500) return fail('bad-request', 'Nincs kijelölt elem.');
    const dst = handles.resolve(dstHandle);
    if (!dst) return fail('not-found', 'Nincs ilyen célmappa.');
    let dst0; try { dst0 = await F.stat(dst.abs); } catch (e) { return fail('not-found', 'A célmappa nem olvasható.'); }
    if (!dst0.isDirectory()) return fail('bad-request', 'A cél nem mappa.');
    const dstReal = await realOrSelf(dst.abs);
    const src = [];
    for (const h of srcHandles) {
      const s = handles.resolve(h);                                    // resolve() also proves the root
      if (!s) return fail('not-found', 'Nincs ilyen elem.');
      const st = await lstatOrNull(s.abs);
      if (!st) return fail('not-found', 'Nincs ilyen elem.');
      if (await isRootDir(s.abs)) return fail('forbidden', 'A gyökérmappa nem módosítható.');
      if (!st.isSymbolicLink() && st.isDirectory()) {
        if (sepKey(dstReal).startsWith(sepKey(await realOrSelf(s.abs)))) return fail('inside', 'A mappa nem másolható saját magába.');
      }
      src.push({ abs: s.abs, root: s.root, name: path.basename(s.abs), st });
    }
    return { src, dst };
  }

  async function sizeOf(abs, st) {
    if (st.isSymbolicLink() || !st.isDirectory()) return st.size;
    let n = 0;
    let names = []; try { names = await F.readdir(abs); } catch (e) {}
    for (const nm of names) {
      const p = path.join(abs, nm);
      const s = await lstatOrNull(p);
      if (s) n += await sizeOf(p, s);
    }
    return n;
  }

  // The job body shared by copy and move. Honours ctx.cancelled before every file.
  function body(mode, plan, policy) {
    return async ctx => {
      const total = (await Promise.all(plan.src.map(s => sizeOf(s.abs, s.st)))).reduce((a, b) => a + b, 0);
      let done = 0, links = 0, skipped = 0, cloudAnswer = null;
      ctx.progress(0, total);

      const bump = n => { done += n; ctx.progress(done, total); };
      const ask = (question, choices) => ctx.ask({ hu: question, choices });

      // → 'skip' | 'overwrite' | 'cancel' | { rename: path }
      async function conflict(name, srcSt, dstSt, dirOf) {
        let choice = policy;
        if (policy === 'ask') choice = await ask('Már létezik: ' + name, ASK_CONFLICT);
        if (ctx.cancelled || choice === 'cancel') return 'cancel';
        if (choice === 'overwrite' && (srcSt.isDirectory() !== dstSt.isDirectory() || dstSt.isSymbolicLink())) choice = 'rename';   // never replace a folder by a file
        if (choice === 'overwrite') return 'overwrite';
        if (choice === 'rename') {
          for (let n = 2; n < 10000; n++) {
            const t = path.join(dirOf, numbered(name, n, srcSt.isDirectory() && !srcSt.isSymbolicLink()));
            if (!(await lstatOrNull(t))) return { rename: t };
          }
          throw new Error('no free name for ' + name);
        }
        return 'skip';
      }

      async function cloudOk(dirAbs, rootId, name) {
        const rt = roots.get(rootId);
        if (!cloud || !rt || rt.kind === 'local') return true;
        let m; try { m = (await cloud.marks(dirAbs)).get(name); } catch (e) { m = undefined; }
        if (m !== 'online') return true;
        if (cloudAnswer === null) {
          const a = await ask('Letöltsem a felhőből?', ASK_CLOUD);
          cloudAnswer = ctx.cancelled || a === 'cancel' ? 'cancel' : (a === 'yes' ? 'yes' : 'no');
        }
        return cloudAnswer === 'yes';
      }

      // copy one entry into dstDir under `name`; false = the whole job must stop
      async function entry(abs, rootId, st, dstDir, name) {
        if (ctx.cancelled) return false;
        let target = path.join(dstDir, name);
        const here = await lstatOrNull(target);
        const isLink = st.isSymbolicLink(), isDir = !isLink && st.isDirectory();
        let overwrite = false, merge = false;
        if (here) {
          const same = (await realOrSelf(target)).toLowerCase() === (await realOrSelf(abs)).toLowerCase();
          if (isDir && !here.isSymbolicLink() && here.isDirectory() && !same) merge = true;      // folders merge, no question
          else {
            const c = same && policy !== 'ask' && policy !== 'rename' ? 'skip' : await conflict(name, st, here, dstDir);
            if (c === 'cancel') return false;
            if (c === 'skip') { skipped++; bump(await sizeOf(abs, st)); return true; }
            if (c === 'overwrite') { if (same) { skipped++; return true; } overwrite = true; }
            else target = c.rename;
          }
        }
        if (isLink) {
          let to; try { to = await F.readlink(abs); } catch (e) { skipped++; return true; }
          let kind = 'file'; try { if ((await F.stat(abs)).isDirectory()) kind = 'junction'; } catch (e) {}
          try { await F.symlink(to, target, kind); links++; } catch (e) { skipped++; }
          return true;
        }
        if (isDir) {
          if (!merge) await F.mkdir(target);
          let names = []; try { names = await F.readdir(abs); } catch (e) { skipped++; }
          for (const nm of names) {
            const p = path.join(abs, nm);
            const s = await lstatOrNull(p);
            if (!s) continue;
            if (!(await entry(p, rootId, s, target, nm))) return false;
          }
          try { await F.utimes(target, st.atime, st.mtime); } catch (e) {}
          return true;
        }
        if (!(await cloudOk(path.dirname(abs), rootId, path.basename(abs)))) {
          if (cloudAnswer === 'cancel') return false;
          skipped++; bump(st.size); return true;
        }
        await F.copyFile(abs, target, overwrite ? 0 : EXCL);
        const out = await F.lstat(target);
        if (out.size !== st.size) throw new Error('size mismatch: ' + name);                   // verified before any source is trashed
        try { await F.utimes(target, st.atime, st.mtime); } catch (e) {}
        bump(st.size);
        return true;
      }

      // same-volume move: fs.rename (folder over an existing folder would need a merge: skipped, reported)
      async function renameOne(s) {
        let target = path.join(plan.dst.abs, s.name);
        const here = await lstatOrNull(target);
        if (here) {
          if ((await realOrSelf(target)).toLowerCase() === (await realOrSelf(s.abs)).toLowerCase() && policy !== 'rename') { skipped++; return true; }
          const c = await conflict(s.name, s.st, here, plan.dst.abs);
          if (c === 'cancel') return false;
          if (c === 'skip') { skipped++; return true; }
          if (c === 'overwrite') { if (here.isDirectory()) { skipped++; return true; } }
          else target = c.rename;
        }
        await F.rename(s.abs, target);
        bump(s.st.isDirectory() ? 0 : s.st.size);
        return true;
      }

      for (const s of plan.src) {
        if (ctx.cancelled) return;
        if (mode === 'move' && await volume(s.abs, plan.dst.abs)) {
          if (!(await renameOne(s))) return;
          continue;
        }
        const before = skipped;
        if (!(await entry(s.abs, s.root, s.st, plan.dst.abs, s.name))) return;
        if (mode === 'move' && skipped === before && !ctx.cancelled) await shell.trashItem(s.abs);   // fully copied and verified: never unlink
      }
      const extra = (links ? ', ' + links + ' hivatkozás másolva' : '') + (skipped ? ', ' + skipped + ' kihagyva' : '');
      ctx.progress(done, total, (mode === 'move' ? 'Áthelyezve: ' : 'Másolva: ') + plan.src.length + ' elem' + extra);
    };
  }

  async function start(mode, srcHandles, dstHandle, policy) {
    if (policy === undefined) policy = 'ask';
    if (!POLICIES.includes(policy)) return fail('bad-request', 'Érvénytelen házirend.');
    const plan = await prepare(srcHandles, dstHandle);
    if (plan.ok === false) return plan;
    const job = jobs.create({ kind: mode, hu: (mode === 'move' ? 'Áthelyezés: ' : 'Másolás: ') + plan.src.length + ' elem', run: body(mode, plan, policy) });
    return { job };
  }

  // ------------------------------------------------------------ rename, mkdir
  async function itemOf(abs) {
    const h = handles.issue(abs);
    if (view && h) { const r = await view.stat(h); if (r && r.item) return { item: r.item }; }
    return { item: { handle: h, name: path.basename(abs) } };
  }

  async function rename(h, name) {
    if (!isSafeName(name)) return fail('bad-request', 'Érvénytelen név.');
    const s = handles.resolve(h);
    if (!s) return fail('not-found', 'Nincs ilyen elem.');
    if (!(await lstatOrNull(s.abs))) return fail('not-found', 'Nincs ilyen elem.');
    if (await isRootDir(s.abs)) return fail('forbidden', 'A gyökérmappa nem nevezhető át.');
    const target = path.join(path.dirname(s.abs), name);
    const caseOnly = target.toLowerCase() === s.abs.toLowerCase();
    if (!caseOnly && await lstatOrNull(target)) return fail('exists', 'Már létezik: ' + name);
    await F.rename(s.abs, target);
    return itemOf(target);
  }

  async function mkdir(dirHandle, name) {
    if (!isSafeName(name)) return fail('bad-request', 'Érvénytelen név.');
    const d = handles.resolve(dirHandle);
    if (!d) return fail('not-found', 'Nincs ilyen mappa.');
    const st = await lstatOrNull(d.abs);
    if (!st || !st.isDirectory()) return fail('not-found', 'Nincs ilyen mappa.');
    const target = path.join(d.abs, name);
    if (await lstatOrNull(target)) return fail('exists', 'Már létezik: ' + name);
    await F.mkdir(target);
    return itemOf(target);
  }

  async function trash(hs) {
    if (!Array.isArray(hs) || !hs.length || hs.length > 500) return fail('bad-request', 'Nincs kijelölt elem.');
    const list = [];
    for (const h of hs) {
      const s = handles.resolve(h);
      if (!s || !(await lstatOrNull(s.abs))) return fail('not-found', 'Nincs ilyen elem.');
      if (await isRootDir(s.abs)) return fail('forbidden', 'A gyökérmappa nem törölhető.');
      list.push(s.abs);
    }
    const job = jobs.create({
      kind: 'trash', hu: 'Lomtár: ' + list.length + ' elem', steps: list.length,
      run: async ctx => {
        let n = 0;
        for (const abs of list) {
          if (ctx.cancelled) return;
          await shell.trashItem(abs);
          n++;
          ctx.progress(n, list.length, 'Lomtárba helyezve: ' + n + ' elem');
        }
      },
    });
    return { job };
  }

  return {
    copy: (src, dst, policy) => start('copy', src, dst, policy),
    move: (src, dst, policy) => start('move', src, dst, policy),
    rename, mkdir, trash,
  };
}

module.exports = { createFsOps, lp, numbered, LONG };
