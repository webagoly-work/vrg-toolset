// 46-hm-estate.js — Birtok drawn: 45-hm-estate-plan's estate on the water, in place of the island. Free space is pasture and
// farm fields, small files are shacks and farmhouses, large files are towers, and each kind that matters on a plot gets its
// hall. The walk runs only when a drive is opened and stays in memory; folder names stay blurred until clicked (CITY-D27 A).

const HM_EST_COL = { field: 0x33493c, field2: 0x2c4034, hedge: 0x41594b, unread: 0x262d33, plot: 0x2a3a45, plate: 0x314450, home: 0x74808a, roof: 0x5b6a75 };
const HM_HALL_COL = { image: 0x7d8a96, audio: 0x8a7f72, video: 0x5d6873, doc: 0x6d7a6f, code: 0x56606b, archive: 0x6d6257, program: 0x4c565f };
// the small system partitions (100 MB here) hold nothing of the user's and would be specks
const hmDrives = () => (hm.hw ? hm.hw.disks.flatMap(d => d.vols || []) : []).filter(v => v.size >= 2 ** 30).sort((a, b) => (a.letter < b.letter ? -1 : 1));
const hmSeeded = s => () => (s = (s * 16807) % 2147483647) / 2147483647;

function hmEstateOpen(letter) {
  const ds = hmDrives();
  if (!ds.length) { hm.ePending = true; kvToast('A meghajtók leltára érkezik, utána megnyílik a Birtok'); return; }
  hm.ePending = false;
  hm.eData = hm.eData || {};
  hm.estate = letter || hm.estLast || (ds.find(d => d.letter === 'H:') || ds[0]).letter;
  hm.estLast = hm.estate;
  hm.gPlay = 0;
  hmShow(null);
  if (hm.layer) hmSetLayer(0);
  hmEstateDraw();
  hmEstateVis();
  hmDrivesPaint(); hmPlanPaint();
  hmHome(900);
  hmEstateAsk(false);
}
function hmEstateClose() {
  hm.estate = null; hmShow(null);
  if (hm.eGroup) hm.eGroup.visible = false;
  hmEstateVis(); hmDrivesPaint();
}
function hmEstateVis() {
  const on = !!hm.estate;
  hm.surface.visible = !on; hm.land.visible = !on; hm.shore.visible = !on;
  if (hm.grow) hm.grow.visible = !on && hm.layer === 0 && hm.planK > 0;
  $('hm-rail').hidden = on;
  if (on && hm.scrub != null) hmLiveAgain();
  hmTimePaint();
  requestRender();
}
async function hmEstateAsk(rescan, again) {
  const letter = hm.estate;
  clearTimeout(hm.eRetry);
  if (hm.fixture) { hm.eData[letter] = hmFixtureWalk(letter); hmEstateDraw(); return; }
  if (!window.KV_COMPANION) { hm.eStatus = 'A méréshez a segéd kell'; hmWhen(); return; }
  if (!again) { hm.eStatus = 'Mérés indul…'; hmWhen(); }
  const r = await kvCall('hm-estate', { letter, rescan: !!rescan });
  if (r.status !== 200) { hm.eStatus = (r.json && r.json.error) || 'A mérés nem indult el'; hmWhen(); return; }
  if (r.json.walk) return hmEstateEvent({ letter, walk: r.json.walk });
  // the result also comes as an event, but a page must not depend on catching that one: it asks again until it has it
  if (r.json.walking && hm.estate === letter) hm.eRetry = setTimeout(() => { if (hm.estate === letter && !hm.eData[letter]) hmEstateAsk(false, true); }, 15000);
}
function hmEstateEvent(d) {
  if (d.walk) { hm.eData[d.letter] = d.walk; if (d.letter === hm.estate) { hm.eStatus = ''; hmEstateDraw(); } return; }
  if (d.letter === hm.estate) { hm.eStatus = `Mérés ${Math.round(d.p * 100)} %`; hmWhen(); }
}

function hmEstateDraw() {
  const ds = hmDrives(), vol = ds.find(v => v.letter === hm.estate);
  if (!vol) return;
  const plan = hmEstatePlan(vol, hm.eData[vol.letter] || null, Math.max(...ds.map(v => v.size)));
  if (hm.eGroup) { hm.group.remove(hm.eGroup); for (const m of hm.eMeshes) m.dispose(); for (const s of hm.eLabels) s.material.dispose(); }
  hm.ePlan = plan;
  const list = { box: [], dome: [], roof: [] };
  const put = (kind, ent, x, z, w, d, h, col, y = 0, tag = 'M') => { list[kind].push({ kind, ent, m: new THREE.Matrix4().makeScale(w, h, d).setPosition(x, y, z), col, tag }); };
  const rnd = hmSeeded(vol.size % 2147483646 + 1), labels = [];
  const sign = (text, x, z, y, weight) => labels.push({ text, x, z, y, weight });
  const fmt = hmGB, room = c => Math.min(c.w, c.h) > plan.side * 0.18;   // a sign only where the land can hold it
  for (const c of plan.cells) {
    const cx = c.x + c.w / 2, cz = c.y + c.h / 2;
    if (c.type === 'free') {
      const e = { est: 'free', name: `Legelő · ${fmt(vol.free)} szabad`, tag: 'M' }, rows = Math.max(2, Math.min(9, Math.round(c.h / 16)));
      for (let i = 0; i < rows; i++) put('box', e, cx, c.y + (i + 0.5) * c.h / rows, c.w, c.h / rows, 0.3, i % 2 ? HM_EST_COL.field2 : HM_EST_COL.field);
      const n = Math.min(26, Math.round(c.w * c.h / 900));
      for (let i = 0; i < n; i++) { const s = 2 + rnd() * 2.4; put('dome', e, c.x + 3 + rnd() * (c.w - 6), c.y + 3 + rnd() * (c.h - 6), s, s, 2.6, HM_EST_COL.hedge, 0.3); }
      if (room(c)) sign('Legelő', cx, cz, 10, 1e15);
    } else if (c.type === 'unread') {
      const e = { est: 'unread', name: plan.measured ? `Nem olvasott · ${fmt(c.v)}` : 'Mérés alatt', tag: 'K' };
      put('box', e, cx, cz, c.w, c.h, 0.4, HM_EST_COL.unread, 0, 'K');
      if (room(c)) sign(plan.measured ? 'Nem olvasott' : 'Mérés alatt', cx, cz, 10, 1e14);
    } else put('box', { est: 'plot', name: `Telek · ${fmt(c.v)}`, tag: 'M', c }, cx, cz, c.w - 0.2, c.h - 0.2, 0.2, HM_EST_COL.plot);
  }
  for (const p of plan.plots) {
    const ep = { est: 'plot', name: `Telek · ${fmt(p.bytes)}`, tag: 'M', p };
    put('box', ep, p.x + p.w / 2, p.y + p.h / 2, p.w, p.h, 0.4, HM_EST_COL.plate, 0.2);
    for (const l of p.leaves) {
      const x = l.x + l.w / 2, z = l.y + l.h / 2, w = Math.max(0.3, l.w * 0.86), d = Math.max(0.3, l.h * 0.86);
      if (l.type === 'tower') {
        const e = { est: 'tower', name: `${{ video: 'Videó', archive: 'Tömörített fájl', image: 'Kép', audio: 'Hang', doc: 'Dokumentum', code: 'Forrás', program: 'Program', other: 'Fájl' }[l.kind]} · ${fmt(l.bytes)}`, tag: 'M', l, p };
        const h = 10 + 13 * Math.log10(1 + l.bytes / 2 ** 30 * 10);
        put('box', e, x, z, w, d, h, HM_HALL_COL[l.kind] || HM_HALL_COL.program, 0.6);
        put('box', e, x, z, w * 0.62, d * 0.62, h * 0.22, HM_COL.top, 0.6 + h);
      } else if (l.type === 'hall') {
        const e = { est: 'hall', name: `${HM_EST_NAME[l.kind]} · ${fmt(l.bytes)}`, tag: 'M', l, p }, h = 4 + 2.4 * Math.log10(1 + l.bytes / 2 ** 20), col = HM_HALL_COL[l.kind];
        put('box', e, x, z, w, d, h, col, 0.6);
        if (l.kind === 'audio') put('dome', e, x, z, w * 0.8, d * 0.8, h * 0.3, HM_COL.top, 0.6 + h);
        else if (l.kind === 'image' || l.kind === 'doc') put('roof', e, x, z, w * 0.72, d * 0.72, h * 0.34, HM_COL.top, 0.6 + h);
        else if (l.kind === 'video') put('box', e, x, z, w * 0.96, d * 0.2, h * 0.3, HM_COL.ice, 0.6 + h);
        else put('box', e, x, z, w * 1.02, d * 1.02, 0.6, HM_COL.top, 0.6 + h);
        sign(HM_EST_NAME[l.kind], x, z, 12 + h, l.bytes);
      } else {
        const e = { est: 'homes', name: `Tanyák · ${fmt(l.bytes)}, ${hu(l.files)} fájl`, tag: 'M', l, p };
        const area = l.w * l.h, s = 1.5, n = Math.min(14, Math.floor(area / (s * s * 3.2)), Math.max(1, Math.round(2 * Math.log2(1 + l.files))));
        if (n < 1) { put('box', e, x, z, w, d, 0.8, HM_EST_COL.home, 0.6); continue; }
        const nx = Math.ceil(Math.sqrt(n * l.w / Math.max(0.1, l.h))), ny = Math.ceil(n / nx), share = l.bands ? (l.bands[1] + l.bands[2]) / Math.max(1, l.bands[0] + l.bands[1] + l.bands[2]) : 0;
        for (let i = 0; i < n; i++) {
          const hx = l.x + (i % nx + 0.5) * l.w / nx, hz = l.y + (Math.floor(i / nx) + 0.5) * l.h / ny, big = i / n < share + 0.15;   // farmhouses for the mid-sized share, shacks for the rest
          put('box', e, hx, hz, big ? s : s * 0.72, big ? s * 0.8 : s * 0.72, big ? 1.5 : 0.9, HM_EST_COL.home, 0.6);
          if (big) put('roof', e, hx, hz, s * 0.86, s * 0.7, 0.9, HM_EST_COL.roof, 2.1);
        }
      }
    }
  }
  hm.eGroup = new THREE.Group();
  const inst = (kind, geo) => {
    const parts = list[kind], im = new THREE.InstancedMesh(geo, hm.mPlain, Math.max(1, parts.length)), c = new THREE.Color();
    im.setColorAt(0, c.setHex(HM_COL.body));   // an estate with no roofs at all still needs the buffer
    parts.forEach((p, i) => { im.setMatrixAt(i, p.m); im.setColorAt(i, c.setHex(p.col)); p.i = i; });
    im.count = parts.length; im.userData.parts = parts; im.frustumCulled = false; im.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 700);
    hm.eGroup.add(im);
    return im;
  };
  hm.eMeshes = [inst('box', unitBox.clone()), inst('dome', hm.meshes[3].geometry), inst('roof', hm.meshes[5].geometry)];
  // signs: the heaviest first, and none near one already placed, so no sign covers another
  hm.eLabels = [];
  const kept = [], gap = Math.max(40, plan.side / 6);
  for (const l of labels.sort((a, b) => b.weight - a.weight)) {
    if (kept.length >= 9 || kept.some(k => Math.hypot(k.x - l.x, k.z - l.z) < gap)) continue;
    kept.push(l);
    const sp = hmLabel(l.text, l.x, l.y, l.z, (22 + l.text.length * 2.1) * (0.45 + 1.15 * plan.side / HM_EST_SIDE)); hm.eLabels.push(sp); hm.eGroup.add(sp);
  }
  const title = hmLabel(`${vol.letter} · ${fmt(vol.size)}`, 0, 8, -plan.side * 0.56, 24 + 90 * plan.side / HM_EST_SIDE); hm.eLabels.push(title); hm.eGroup.add(title);
  hm.group.add(hm.eGroup);
  hmTagsApply();
  hmWhen();
  requestRender();
}

function hmDrivesPaint() {
  const el = $('hm-drives');
  if (!el) return;
  const ds = hmDrives();
  el.hidden = !hm.estate;
  el.innerHTML = hm.estate ? ds.map(d => `<button class="btn${d.letter === hm.estate ? ' on' : ''}" data-drive="${esc(d.letter)}" title="${esc(hmGB(d.size))}, ${esc(hmGB(d.free))} szabad">${esc(d.letter)}</button>`).join('') + '<button class="btn" data-rescan title="A mérés elölről">Újramérés</button>' : '';
}

function hmEstatePick() {
  const hits = ray.intersectObjects(hm.eMeshes, false);
  for (const h of hits) { const p = h.object.userData.parts[h.instanceId]; if (p && p.ent) return p.ent; }
  return null;
}
function hmEstatePanel(t) {
  const plan = hm.ePlan, pct = b => (100 * b / plan.size).toFixed(b / plan.size < 0.01 ? 2 : 1) + ' %';
  const wrap = h => `<span class="${hm.reveal ? '' : 'blur'}">${esc(h)}</span>`, area = '<p class="dim">A terület a bájtokkal arányos, a meghajtók között is. A fájlok neve nem kerül a városba.</p>';
  const src = 'Win32_LogicalDisk; estate-walk, csak a memóriában';
  if (t.est === 'free') return openPanel('Legelő · szabad hely', [['Meghajtó', esc(plan.letter)], ['Kapacitás', hmGB(plan.size)], ['Szabad', hmGB(plan.free)], ['Arány', pct(plan.free)]], area + hmFooter('M', src));
  if (t.est === 'unread') return openPanel('Nem olvasott terület', [['Méret', hmGB(plan.unread)], ['Arány', pct(plan.unread)]], `<p class="dim">Foglalt, de a mérés nem jutott el hozzá: rendszerfájl, tiltott mappa, fallal körülvett zóna${plan.partial ? ', vagy lejárt az időkeret' : ''}.</p>` + hmFooter('K', 'kapacitás − szabad − olvasott'));
  const p = t.p || t.c;
  if (!p || !t.p) return openPanel(t.name, [['Mappa', wrap(t.c ? t.c.d.name : '')]], area + hmFooter('M', src));
  const rows = [['Mappa', wrap(p.name + (p.sub ? ' \\ ' + p.sub : ''))], ['Méret', hmGB(p.bytes)], ['Arány', pct(p.bytes)], ['Fájl', hu(p.files)]];
  if (t.l && t.est !== 'homes') rows.splice(1, 0, ['Ez az épület', hmGB(t.l.bytes)]);
  const kinds = Object.entries(p.kinds).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => [HM_EST_NAME[k], hmGB(v)]);
  openPanel(t.est === 'plot' ? 'Telek' : t.name, [...rows, ...kinds], (p.partial ? '<p class="warn">Részleges: lejárt az időkeret.</p>' : '') + `<button class="btn" data-hmreveal>${hm.reveal ? 'Elrejtés' : 'Nevek mutatása'}</button> ${hm.fixture ? '' : '<button class="btn" data-hmopen>Mappa megnyitása</button>'}` + area + hmFooter('M', src));
  const box = $('panel');
  box.querySelectorAll('[data-hmreveal]').forEach(b => { b.onclick = () => { hm.reveal = !hm.reveal; hmEstatePanel(t); }; });
  box.querySelectorAll('[data-hmopen]').forEach(b => { b.onclick = async () => { const r = await kvCall('hm-open', { letter: plan.letter, top: p.top, kid: p.kid }); if (r.status !== 200) kvToast((r.json && r.json.error) || 'Nem sikerült'); }; });
}

// #hmtest=1: an invented estate of the walk's own shape
function hmFixtureWalk(letter) {
  const GB = 2 ** 30, kid = (name, gb, kinds, top = []) => ({ name, size: gb * GB, files: Math.round(gb * 900), kinds: Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, v * gb * GB])), bands: [800, 90, 4], top: top.map(([s, k]) => [s * GB, k]) });
  const dir = (name, kids) => ({ name, size: kids.reduce((a, k) => a + k.size, 0), files: kids.reduce((a, k) => a + k.files, 0), kinds: {}, bands: [0, 0, 0], top: [], kids });
  return { root: letter + '\\', at: Date.now(), ms: 10, partial: false, walled: [], fixture: true, dirs: [
    dir('Próba fotók', [kid('Nyaralás', 40, { image: 0.9, other: 0.1 }), kid('Család', 25, { image: 0.7, video: 0.3 }, [[3, 'video']])]),
    dir('Próba zene', [kid('Lemezek', 30, { audio: 0.95, other: 0.05 })]),
    dir('Próba filmek', [kid('Sorozat', 60, { video: 1 }, [[12, 'video'], [9, 'video'], [6, 'video']])]),
    dir('Próba munka', [kid('Forrás', 8, { code: 0.8, doc: 0.2 }), kid('Iratok', 12, { doc: 0.8, archive: 0.2 }), kid('Telepítők', 20, { archive: 0.6, program: 0.4 }, [[4, 'archive']])]),
  ] };
}
