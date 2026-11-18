// VRG Időjárás — places: the named ones from config/places.json, user-added ones (`places add`) and the job
// sites read from the Map's jobs\_elozmenyek\helyek.json (`sync-jobs`). Job sites are client data: they live in
// the database (outside Git) only, never in config, and never leave this PC.
'use strict';

const fs = require('fs');
const path = require('path');
const { REPO, isDir, isFile, readJson, fold } = require('./common');
const { nowIso } = require('./db');

function seed(db, places) {
  db.tx(() => {
    for (const p of places) db.run(`INSERT INTO place (id, name, lat, lon, elev, kind, area, warn_areas, activities, active, created, updated)
      VALUES (?, ?, ?, ?, ?, 'place', ?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, lat = excluded.lat, lon = excluded.lon,
      elev = excluded.elev, warn_areas = excluded.warn_areas, activities = excluded.activities, updated = excluded.updated`,
      p.id, p.name, p.lat, p.lon, p.elev ?? null, p.area || null, JSON.stringify(p.warn_areas || []), JSON.stringify(p.activities || []), nowIso(), nowIso());
  });
}

const parse = r => r && { ...r, warn_areas: JSON.parse(r.warn_areas || '[]'), activities: JSON.parse(r.activities || '[]') };
const list = (db, { all = false } = {}) => db.all(`SELECT * FROM place ${all ? '' : 'WHERE active = 1'} ORDER BY kind DESC, name`).map(parse);
function find(db, q) {
  if (!q) return null;
  const r = db.get('SELECT * FROM place WHERE id = ? OR job_code = ?', q, q);
  if (r) return parse(r);
  const f = fold(q);
  return list(db, { all: true }).find(p => fold(p.name).includes(f)) || null;
}

const slug = s => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'hely';
function add(db, o) {
  const id = o.id || slug(o.name);
  if (!(Number.isFinite(+o.lat) && Number.isFinite(+o.lon))) throw new Error('lat és lon kell: places add "Név" --lat 47.5 --lon 19.04');
  db.run(`INSERT INTO place (id, name, lat, lon, elev, kind, warn_areas, activities, active, created, updated) VALUES (?, ?, ?, ?, ?, 'place', ?, ?, 1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, lat = excluded.lat, lon = excluded.lon, elev = excluded.elev, warn_areas = excluded.warn_areas,
    activities = excluded.activities, active = 1, updated = excluded.updated`,
    id, o.name, +o.lat, +o.lon, o.elev != null ? +o.elev : null, JSON.stringify(o.areas ? String(o.areas).split(',') : ['Pest']),
    JSON.stringify(o.activities ? String(o.activities).split(',') : ['kulteri', 'magasban', 'kabel']), nowIso(), nowIso());
  return id;
}
const setActive = (db, id, on) => db.run('UPDATE place SET active = ?, updated = ? WHERE id = ?', on ? 1 : 0, nowIso(), id).changes;

// the work root's jobs folder, as Map/serve.js finds it: H:\VRG\Full\jobs next to the repo
function jobsDir() {
  if (process.env.VRG_JOBS_DIR) return path.resolve(process.env.VRG_JOBS_DIR);
  for (let d = REPO; path.dirname(d) !== d; d = path.dirname(d)) {
    const j = path.join(path.dirname(d), 'jobs');
    if (isDir(path.join(j, '_elozmenyek'))) return j;
  }
  return null;
}

// Budapest districts sit in "Budapest", anything else in the Map's area is treated as Pest county
const areasFor = area => (/budapest/i.test(area || '') ? ['Budapest'] : ['Pest', String(area || '').split(/[ ,]/)[0]].filter(Boolean));

function syncJobs(db, settings, file) {
  const cfg = settings.jobs || {};
  const f = file || (jobsDir() && path.join(jobsDir(), '_elozmenyek', 'helyek.json'));
  if (!f || !isFile(f)) return { ok: false, why: 'nincs helyek.json (node Map/tools/build-jobs.js készíti)', added: 0 };
  const j = readJson(f);
  const want = new Set(cfg.statuses || ['folyamatban']);
  let added = 0, off = 0;
  db.tx(() => {
    const seen = new Set();
    for (const job of j.jobs || []) {
      if (!want.has(job.status) || job.lat == null || job.lon == null) continue;
      const id = 'job-' + slug(job.code);
      seen.add(id);
      db.run(`INSERT INTO place (id, name, lat, lon, kind, job_code, area, warn_areas, activities, active, created, updated) VALUES (?, ?, ?, ?, 'job', ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, lat = excluded.lat, lon = excluded.lon, area = excluded.area, warn_areas = excluded.warn_areas, active = 1, updated = excluded.updated`,
        id, `${job.code} · ${job.label || job.area || ''}`.trim(), job.lat, job.lon, job.code, job.area || null, JSON.stringify(areasFor(job.area)),
        JSON.stringify(cfg.defaultActivities || ['kulteri', 'magasban', 'kabel']), nowIso(), nowIso());
      added++;
    }
    // a job that is no longer in progress stops being watched (its history stays)
    for (const r of db.all("SELECT id FROM place WHERE kind = 'job' AND active = 1")) if (!seen.has(r.id)) { setActive(db, r.id, false); off++; }
  });
  return { ok: true, file: f, added, off };
}

module.exports = { seed, list, find, add, setActive, syncJobs, jobsDir, slug };
