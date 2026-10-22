// ==========================================================================
// vrg-planner.js — Open MCT spike plugin: a Varler Planner plan as an Open MCT dictionary
//
// 2026-10-20 · docs/research/2026-10-20_openmct-planner-bridge.md §6 (the spike).
//
// WHAT THIS DOES
//   · reads one .vplan.json (the Planner's save format, read-only) and exposes it as a tree:
//       Projekt → Szint → (Alaprajz — élő · Helyiség → Eszköz → jelpont)
//   · every BRIDGE node (RBX / BASE) and every endpoint that measures something becomes a
//     telemetry object whose points are named after the STD-004 §3.4 register map;
//   · telemetry is SIMULATED — a deterministic function of time, so history and live agree
//     and a reload shows the same curve. Swap `SIM` for an MQTT / HA / Modbus adapter later;
//     nothing else changes, because Open MCT only ever sees the provider interface;
//   · one generated Display Layout per level: the room plan as the background image, each
//     node's / sensor's main value placed at its plan position;
//   · limits (placeholders, marked as such) and a fault list derived from limit crossings;
//   · a Plan (Gantt) object: per stack layer × room, a workload estimate from device counts.
//
// WHAT THIS DOES NOT DO
//   · write anything back. The Planner owns the plan; this is a read-only consumer.
//   · command anything. Open MCT has no commanding API; see the note §5.4.
//
// Single global: VrgPlannerPlugin.
// ==========================================================================
(function () {
  'use strict';

  const NS = 'vrg';
  const LEVEL_HU = { basement: 'Pince', ground: 'Földszint', upper: 'Emelet' };

  // ---- signal catalogue: register → point. Limits are PLACEHOLDERS until BRIDGE sets them. ----
  // base/amp/per drive the simulation only.
  const SIG = {
    node: [
      { k: 'airT', n: 'Doboz levegő', reg: 'IR 5', unit: '°C', base: 33, amp: 5, per: 47 * 60e3, lim: { w: 40, c: 45 } },
      { k: 'psuT', n: 'Tápegység', reg: 'IR 4', unit: '°C', base: 44, amp: 7, per: 61 * 60e3, lim: { w: 55, c: 62 } },
      { k: 'rh', n: 'Páratartalom (doboz)', reg: 'IR 6', unit: '%', base: 42, amp: 6, per: 90 * 60e3 },
      { k: 'br1', n: 'SELV ág 1 árama', reg: 'IR 8', unit: 'mA', base: 650, amp: 420, per: 13 * 60e3, lim: { w: 1500, c: 1800 } },
      { k: 'link', n: 'Kapcsolat / autonómia', reg: 'IR 3 b0·b1', enumv: [{ value: 0, string: 'AUTONÓM' }, { value: 1, string: 'LINK OK' }] }
    ],
    SEN: [
      { k: 't', n: 'Hőmérséklet', reg: 'IR 16', unit: '°C', base: 22, amp: 1.6, per: 120 * 60e3, lim: { w: 26, c: 28 } },
      { k: 'rh', n: 'Relatív páratartalom', reg: 'IR 17', unit: '%', base: 48, amp: 8, per: 75 * 60e3, lim: { w: 65, c: 75 } },
      { k: 'co2', n: 'CO₂', reg: 'IR 18', unit: 'ppm', base: 820, amp: 380, per: 55 * 60e3, lim: { w: 1000, c: 1400 } },
      { k: 'lux', n: 'Megvilágítás', reg: 'IR 20', unit: 'lx', base: 220, amp: 200, per: 30 * 60e3 },
      { k: 'pres', n: 'Jelenlét-pontszám', reg: 'IR 21', unit: '', base: 0, amp: 4, per: 9 * 60e3 }
    ],
    THR: [{ k: 't', n: 'Mért hőmérséklet', reg: 'IR 16', unit: '°C', base: 21.5, amp: 1.2, per: 140 * 60e3, lim: { w: 26, c: 28 } }],
    LMP: [{ k: 'dim', n: 'Dimmer tényleges szint', reg: 'IR 32+', unit: '%', base: 45, amp: 45, per: 25 * 60e3 }],
    SHU: [{ k: 'pos', n: 'Redőny állás', reg: 'IR (gen.)', unit: '%', base: 50, amp: 50, per: 180 * 60e3 }],
    POR: [{ k: 'cross', n: 'Átlépések / 5 perc', reg: 'IR 88–127 (ring)', unit: 'db', base: 2, amp: 2, per: 17 * 60e3 }]
  };
  const DEV_NAME = { rbx: 'RoomBox', base: 'BASE', SEN: 'Érzékelő', THR: 'Termosztát', LMP: 'Lámpa', SHU: 'Redőny', POR: 'Portál' };
  const MAIN = { node: 'airT', SEN: 't', THR: 't', POR: 'cross' };   // shown on the layout

  // ---- helpers ----
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
  function pip(x, y, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
  const id = key => ({ namespace: NS, key });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function sigClass(dv) { if (dv.type === 'rbx' || dv.type === 'base') return 'node'; const c = dv.code || ''; return SIG[c] ? c : (dv.type === 'light' && SIG.LMP ? 'LMP' : null); }

  // ---- the simulation: value = f(point, t); the same t always gives the same value ----
  const SIM = {
    value(pt, t) {
      const s = pt.sig, ph = hash(pt.key) * Math.PI * 2;
      if (s.enumv) {                                  // a node drops to autonomy ~3 min in every 70
        const per = 70 * 60e3, off = hash(pt.key + 'a') * per; return ((t + off) % per) < 3 * 60e3 ? 0 : 1; }
      const slow = Math.sin(2 * Math.PI * t / s.per + ph), fast = Math.sin(2 * Math.PI * t / (s.per / 7.3) + ph * 1.7);
      const jitter = (hash(pt.key + Math.floor(t / 10e3)) - 0.5) * 0.15;
      let v = s.base + s.amp * (0.82 * slow + 0.18 * fast + jitter);
      if (s.k === 'pres' || s.k === 'cross') v = Math.max(0, Math.round(v));
      if (s.unit === '%') v = Math.min(100, Math.max(0, v));
      return Math.round(v * 10) / 10;
    },
    STEP: 10e3
  };

  // ---- build the object tree from the plan ----
  function buildModel(file) {
    const P = file.project || file, d = P.data || {}, Bld = P.building || {};
    const objs = {}, points = [];
    const put = o => { objs[o.identifier.key] = o; return o.identifier; };
    const rooms = (d.floors || []).filter(f => f && f.poly && f.poly.length > 2);
    const levels = [...new Set([].concat(rooms.map(r => r.level), (d.devices || []).map(x => x.level)))]
      .filter(Boolean).sort((a, b) => ['basement', 'ground', 'upper'].indexOf(a) - ['basement', 'ground', 'upper'].indexOf(b));
    const projName = file.name || (Bld.name) || 'Planner terv';
    const code = (String(projName).match(/^[A-Z]+[0-9]+/) || ['PRJ'])[0];   // STD-004 reference prefix: P33

    const levelIds = levels.map(L => {
      const lvRooms = rooms.filter(r => r.level === L);
      const devs = (d.devices || []).filter(x => x.level === L && sigClass(x));
      // A RoomBox / BASE sits IN a wall, so it is inside no room polygon: take the first room it
      // serves instead (dv.serves holds floor ids). The real dictionary must do the same.
      const roomOf = dv => lvRooms.find(r => pip(dv.x, dv.y, r.poly))
        || (Array.isArray(dv.serves) && lvRooms.find(r => r.id === dv.serves[0])) || null;
      const byRoom = new Map(); lvRooms.forEach(r => byRoom.set(r.id, []));
      const loose = [];
      const devIds = new Map();
      devs.forEach(dv => {
        const cls = sigClass(dv), sigs = SIG[cls], r = roomOf(dv);
        // STD-004 reference: refs like SEN1 repeat per room, so the room number is part of the name
        const short = (r && r.num ? r.num + '.' : '') + (dv.ref || dv.id), canon = code + '.' + short;
        const ptIds = sigs.map(s => {
          const key = 'pt.' + dv.id + '.' + s.k;
          const pt = { key, sig: s, dev: dv, cls, canon };
          points.push(pt);
          const values = [{ key: 'utc', source: 'timestamp', name: 'Időpont', format: 'utc', hints: { domain: 1 } }];
          values.push(s.enumv
            ? { key: 'value', name: s.n, format: 'enum', enumerations: s.enumv, hints: { range: 1 } }
            : { key: 'value', name: s.n, unit: s.unit, format: 'float', hints: { range: 1 } });
          return put({ identifier: id(key), name: short + ' · ' + s.n, type: 'vrg.point',
            notes: 'Regiszter: ' + s.reg + (s.lim ? ' · határ (helyőrző): ' + s.lim.w + ' / ' + s.lim.c + ' ' + s.unit : ''),
            telemetry: { values }, vrg: { dev: dv.id, sig: s.k, cls } });
        });
        const label = short + ' — ' + (DEV_NAME[dv.type] || DEV_NAME[cls] || cls) + (dv.rb ? ' ' + dv.rb : '');
        const devId = put({ identifier: id('dev.' + dv.id), name: label, type: 'folder', composition: ptIds,
          vrg: { id: dv.id, ref: canon, x: dv.x, y: dv.y, h: dv.h, cls, note: dv.note || '' } });
        devIds.set(dv.id, devId);
        (r ? byRoom.get(r.id) : loose).push(devId);
      });
      const roomIds = lvRooms.map(r => put({ identifier: id('room.' + r.id), name: (r.num ? r.num + ' ' : '') + (r.name || ''),
        type: 'folder', composition: byRoom.get(r.id) || [], vrg: { id: r.id } }));
      if (loose.length) roomIds.push(put({ identifier: id('room.none.' + L), name: 'Helyiségen kívül', type: 'folder', composition: loose }));
      const layoutId = put(makeLayout(L, lvRooms, devs, Bld, points, projName));
      return put({ identifier: id('lvl.' + L), name: LEVEL_HU[L] || L, type: 'folder', composition: [layoutId].concat(roomIds) });
    });

    const planId = put(makePlan(P, rooms));
    put({ identifier: id('root'), name: projName + ' (Planner)', type: 'folder', location: 'ROOT',
      composition: levelIds.concat([planId]) });
    return { objs, points };
  }

  // ---- the plan as an SVG background, and the layout items on top of it ----
  const GRID = 10, PXMM = 0.09;   // 10 px grid; 1 m = 90 px
  function makeLayout(L, lvRooms, devs, Bld, points, projName) {
    const walls = (Bld.walls && Bld.walls[L]) || [];
    const xs = [], ys = [];
    lvRooms.forEach(r => r.poly.forEach(([x, y]) => { xs.push(x); ys.push(y); }));
    walls.forEach(w => { xs.push(w.x0, w.x1); ys.push(w.y0, w.y1); });
    if (!xs.length) { xs.push(0, 10000); ys.push(0, 10000); }
    const pad = 600, x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, x1 = Math.max(...xs) + pad, y1 = Math.max(...ys) + pad;
    const W = Math.round((x1 - x0) * PXMM), H = Math.round((y1 - y0) * PXMM);
    const X = x => (x - x0) * PXMM, Y = y => (y - y0) * PXMM;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
      `<rect width="${W}" height="${H}" fill="#1b1d21"/>`;
    lvRooms.forEach(r => {
      svg += `<polygon points="${r.poly.map(([x, y]) => X(x).toFixed(1) + ',' + Y(y).toFixed(1)).join(' ')}" fill="#2a2e35" stroke="#3d434d" stroke-width="1"/>`;
      // the room name in its bottom-left corner, so the live values (placed at the devices) do not cover it
      const lx = Math.min(...r.poly.map(p => p[0])), ly = Math.max(...r.poly.map(p => p[1]));
      svg += `<text x="${(X(lx) + 6).toFixed(1)}" y="${(Y(ly) - 6).toFixed(1)}" fill="#8b93a1" font-family="Segoe UI,Arial" font-size="12">${esc((r.num || '') + ' ' + (r.name || ''))}</text>`;
    });
    walls.forEach(w => { svg += `<rect x="${X(Math.min(w.x0, w.x1)).toFixed(1)}" y="${Y(Math.min(w.y0, w.y1)).toFixed(1)}" width="${(Math.abs(w.x1 - w.x0) * PXMM).toFixed(1)}" height="${(Math.abs(w.y1 - w.y0) * PXMM).toFixed(1)}" fill="#6b7280"/>`; });
    const shown = devs.filter(dv => MAIN[sigClass(dv)]);
    shown.forEach(dv => { const node = sigClass(dv) === 'node';
      svg += `<circle cx="${X(dv.x).toFixed(1)}" cy="${Y(dv.y).toFixed(1)}" r="${node ? 6 : 4}" fill="${node ? '#e0a526' : '#3fb6c9'}"/>`; });
    svg += `<text x="12" y="${H - 12}" fill="#8b93a1" font-family="Segoe UI,Arial" font-size="12">${esc(projName)} · ${esc(LEVEL_HU[L] || L)} · Planner-ből generálva</text></svg>`;
    // base64, not percent-encoding: ImageView runs encodeURI() over the url, which would turn every %XX into %25XX
    const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));

    const items = [{ type: 'image-view', id: 'img-' + L, x: 0, y: 0, width: Math.ceil(W / GRID), height: Math.ceil(H / GRID), url, stroke: 'transparent', hasFrame: false }];
    const comp = [];
    const taken = [];
    shown.forEach(dv => {
      const k = 'pt.' + dv.id + '.' + MAIN[sigClass(dv)];
      let gx = Math.round(X(dv.x) / GRID) + 1, gy = Math.round(Y(dv.y) / GRID) - 1;
      while (taken.some(([a, b]) => Math.abs(a - gx) < 21 && Math.abs(b - gy) < 3)) gy += 3;   // no overlapping boxes
      taken.push([gx, gy]);
      comp.push(id(k));
      items.push({ type: 'telemetry-view', id: 'tv-' + dv.id, identifier: id(k), x: gx, y: gy, width: 21, height: 3,
        displayMode: 'all', value: 'value', stroke: '', fill: '#00000099', color: '', fontSize: 'default', font: 'default' });
    });
    return { identifier: id('layout.' + L), name: 'Alaprajz — élő (' + (LEVEL_HU[L] || L) + ')', type: 'layout', composition: comp,
      configuration: { items, layoutGrid: [GRID, GRID], objectStyles: {} } };
  }

  // ---- a Gantt: one swimlane per stack layer, one bar per room with work on that layer ----
  function makePlan(P, rooms) {
    const d = P.data || {}, layers = (P.layers || []).filter(l => l.role && l.role !== 'construct');
    const day0 = new Date(Math.floor(Date.now() / 900e3) * 900e3 - 1800e3);   // demo: the job started half an hour ago, so the live window shows it
    const MIN_PER_DEV = 25, body = {};
    const COL = ['#5b8def', '#e0a526', '#3fb6c9', '#d85a30', '#1d9e75', '#9b6cd8', '#c94f7c', '#7a8a2b'];
    let laneStart = day0.getTime();
    layers.forEach((Ly, i) => {
      const lane = Ly.name.replace(/^B1 · /, ''), acts = [];
      let t = laneStart;
      rooms.forEach(r => {
        const n = (d.devices || []).filter(x => x.layer === Ly.id && x.level === r.level && pip(x.x, x.y, r.poly)).length;
        if (!n) return;
        const dur = n * MIN_PER_DEV * 60e3;
        acts.push({ name: (r.num || '') + ' · ' + n + ' db', start: t, end: t + dur, type: lane, color: COL[i % COL.length], textColor: 'white' });
        t += dur;
      });
      if (acts.length) { body[lane] = acts; laneStart += 60 * 60e3; }
    });
    return { identifier: id('plan.build'), name: 'Kivitelezési ütemterv (becslés, ' + MIN_PER_DEV + ' perc / eszköz)', type: 'plan',
      selectFile: { body, name: 'planner-derived.json' },
      // filled in up front: the plan view writes any missing lane into the object, and ours is read-only
      configuration: { clipActivityNames: false, swimlaneVisibility: Object.fromEntries(Object.keys(body).map(k => [k, true])) } };
  }

  // ---- limits ----
  function limitsFor(s) {
    if (!s.lim) return null;
    return {
      evaluate(datum) {
        const v = datum.value;
        if (v >= s.lim.c) return { cssClass: 'is-limit--upr is-limit--red', name: 'Kritikus (helyőrző)' };
        if (v >= s.lim.w) return { cssClass: 'is-limit--upr is-limit--yellow', name: 'Figyelem (helyőrző)' };
        return undefined;
      }
    };
  }

  window.VrgPlannerPlugin = function VrgPlannerPlugin(opts) {
    return function install(openmct) {
      const ready = fetch(opts.planUrl).then(r => { if (!r.ok) throw new Error('A terv nem tölthető be: ' + opts.planUrl); return r.json(); })
        .then(buildModel);
      const byKey = ready.then(m => { const map = new Map(); m.points.forEach(p => map.set(p.key, p)); return map; });

      openmct.types.addType('vrg.point', { name: 'Jelpont', cssClass: 'icon-telemetry', creatable: false });

      openmct.objects.addRoot(id('root'), openmct.priority.HIGH);
      openmct.objects.addProvider(NS, {
        get: identifier => ready.then(m => {
          const o = m.objs[identifier.key];
          return o ? JSON.parse(JSON.stringify(o)) : Promise.reject(new Error('nincs: ' + identifier.key));
        })
      });

      const isPoint = o => o.identifier.namespace === NS && o.type === 'vrg.point';
      openmct.telemetry.addProvider({
        supportsRequest: isPoint,
        supportsSubscribe: isPoint,
        request(o, options) {
          return byKey.then(map => {
            const pt = map.get(o.identifier.key); if (!pt) return [];
            const end = Math.min(options.end || Date.now(), Date.now()), start = options.start || end - 3600e3;
            if (options.strategy === 'latest') return [{ timestamp: end, value: SIM.value(pt, end) }];
            const step = Math.max(SIM.STEP, Math.ceil((end - start) / 2000 / SIM.STEP) * SIM.STEP), out = [];
            for (let t = Math.ceil(start / step) * step; t <= end; t += step) out.push({ timestamp: t, value: SIM.value(pt, t) });
            return out;
          });
        },
        subscribe(o, cb) {
          let alive = true;
          const timer = setInterval(() => byKey.then(map => { const pt = map.get(o.identifier.key);
            if (alive && pt) { const t = Date.now(); cb({ timestamp: t, value: SIM.value(pt, t) }); } }), 2000);
          return () => { alive = false; clearInterval(timer); };
        },
        supportsLimits: o => isPoint(o) && !!(o.vrg && SIG[o.vrg.cls] && (SIG[o.vrg.cls].find(s => s.k === o.vrg.sig) || {}).lim),
        getLimitEvaluator: o => limitsFor(SIG[o.vrg.cls].find(s => s.k === o.vrg.sig))
      });

      // ---- faults: every limited point that crossed its limit in the last hour (STD-006 would own the real list) ----
      const acked = new Set(), shelved = new Map();
      function faults() {
        return ready.then(m => {
          const now = Date.now(), out = [];
          m.points.forEach(pt => {
            const s = pt.sig; if (!s.lim && !s.enumv) return;
            let first = null, worst = null, val = null;
            for (let t = now - 3600e3; t <= now; t += 30e3) {
              const v = SIM.value(pt, t);
              const sev = s.enumv ? (v === 0 ? 'WARNING' : null) : v >= s.lim.c ? 'CRITICAL' : v >= s.lim.w ? 'WARNING' : null;
              if (sev) { if (first == null) first = t; if (worst !== 'CRITICAL') worst = sev; val = v; }
            }
            if (first == null) return;
            const fid = pt.key, sh = shelved.get(fid);
            const info = { value: val, rangeCondition: worst, monitoringResult: worst };
            out.push({ type: 'alarms', fault: { id: fid, name: pt.canon + ' · ' + s.n,
              namespace: pt.canon, severity: worst, acknowledged: acked.has(fid),
              shelved: !!(sh && sh > now), seqNum: 0, shortDescription: s.enumv ? 'Autonómiába lépett (STD-004 9-es esemény)' : 'Határérték felett (helyőrző határ)',
              // the list prints triggerTime as-is; sv-SE gives a sortable "2026-10-20 14:05:00"
              triggerTime: new Date(first).toLocaleString('sv-SE'), triggerValueInfo: info, currentValueInfo: { value: SIM.value(pt, now), rangeCondition: worst, monitoringResult: worst } } });
          });
          return out;
        });
      }
      openmct.faults.addProvider({
        supportsRequest: o => o.type === 'faultManagement',
        supportsSubscribe: o => o.type === 'faultManagement',
        request: () => faults(),
        subscribe(o, cb) { cb({ type: 'global-alarm-status' }); const t = setInterval(() => cb({ type: 'global-alarm-status' }), 15000); return () => clearInterval(t); },
        acknowledgeFault(f) { acked.add(f.id); return Promise.resolve({ success: true }); },
        shelveFault(f, o) { shelved.set(f.id, Date.now() + ((o && o.shelveDuration) || 15 * 60e3)); return Promise.resolve({ success: true }); },
        getShelveDurations: () => [{ name: '5 perc', value: 300000 }, { name: '15 perc', value: 900000 }, { name: 'Korlátlan', value: null }]
      });

      ready.catch(e => openmct.notifications.error(String(e.message || e)));
    };
  };
})();
