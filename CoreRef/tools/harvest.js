'use strict';
// CoreRef Phase 0 harvester.
//
//   node CoreRef/tools/harvest.js [--limit N] [--concurrency N] [--esphome] [--ha]
//
// Pulls the PERMISSIVELY licensed machine-readable core of ESPHome and Home
// Assistant, pinned to a release tag, into CoreRef/data + CoreRef/db/coreref.sqlite.
//
// Licence routing is a hard rule, not a convention: a source whose class is
// "restricted" (CC-BY-NC-SA documentation prose) is never fetched into the repo
// by this tool. Those live in the personal mirror outside the repo and the client
// side keeps the URL only. See coreref-sources.json.
//
// Console output is ASCII only (accented Hungarian garbles under the console codepage).

const fs = require('node:fs');
const path = require('node:path');
const { getBuffer, getJson, pool, sha256 } = require('./lib/net.js');
const { parseGenerated } = require('./lib/pylit.js');
const store = require('./lib/store.js');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');
const MANIFEST = path.join(ROOT, 'coreref-sources.json');
const DATA = path.join(ROOT, 'data');
const DB_PATH = path.join(ROOT, 'db', 'coreref.sqlite');
const REPORT = path.join(ROOT, 'docs', 'PHASE-0-REPORT.md');

const argv = process.argv.slice(2);
const opt = {
  limit: num('--limit', 0),
  concurrency: num('--concurrency', 12),
  esphome: argv.includes('--esphome') || !argv.includes('--ha'),
  ha: argv.includes('--ha') || !argv.includes('--esphome'),
};
function num(flag, dflt) {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? parseInt(argv[i + 1], 10) : dflt;
}
function log(...a) { console.log(...a); }
function nowIso() { return new Date().toISOString(); }
function writeFileSafe(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
  return p;
}
function rel(p) { return path.relative(REPO, p).split(path.sep).join('/'); }

// ---------------------------------------------------------------- licence routing

function destinationFor(source, manifest) {
  for (const [name, dest] of Object.entries(manifest.destinations)) {
    if (dest.accepts.includes(source.class)) return { name, dest };
  }
  throw new Error('no destination accepts licence class ' + source.class);
}

function assertRepoSafe(source, manifest) {
  const { name } = destinationFor(source, manifest);
  if (name !== 'repo') {
    throw new Error(
      'REFUSED: source "' + source.id + '" is class ' + source.class +
      ' and must go to the "' + name + '" destination, outside the repo. ' +
      'Phase 0 does not fetch it.'
    );
  }
}

// ---------------------------------------------------------------- ESPHome

const DOC_URL_RE = /\((https?:\/\/[^)\s]+)\)/;

// Walk a schema object and emit every config var we find, with a dotted path.
function walkSchema(obj, pathParts, out, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 8) return;
  if (Array.isArray(obj)) return;

  if (obj.extends && Array.isArray(obj.extends)) {
    for (const e of obj.extends) out.extends.push({ node: pathParts.join('.'), extends: e });
  }

  if (obj.config_vars && typeof obj.config_vars === 'object') {
    for (const [name, v] of Object.entries(obj.config_vars)) {
      if (!v || typeof v !== 'object') continue;
      const docs = typeof v.docs === 'string' ? v.docs : null;
      const m = docs ? docs.match(DOC_URL_RE) : null;
      out.vars.push({
        node: pathParts.join('.') || 'root',
        name,
        key: v.key || null,
        type: v.type || null,
        data_type: v.data_type || null,
        default_value: v.default === undefined ? null : String(v.default),
        templatable: v.templatable ? 1 : 0,
        docs,
        doc_url: m ? m[1] : null,
      });
      // nested schemas hang off .schema / .types.<name>.schema
      walkSchema(v.schema, pathParts.concat(name), out, depth + 1);
      if (v.types && typeof v.types === 'object') {
        for (const [t, tv] of Object.entries(v.types)) {
          walkSchema(tv && tv.schema ? tv.schema : tv, pathParts.concat(name, t), out, depth + 1);
        }
      }
    }
  }

  for (const [k, v] of Object.entries(obj)) {
    if (k === 'config_vars' || k === 'extends' || k === 'types') continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      walkSchema(v, pathParts.concat(k), out, depth + 1);
    }
  }
}

async function harvestEsphome(src, schemaSrc, st, prov) {
  log('\n[esphome] resolving release...');
  const relRes = await getJson('https://api.github.com/repos/' + src.repo + '/releases/latest');
  if (!relRes.ok) throw new Error('cannot resolve esphome release: ' + (relRes.error || relRes.status));
  const tag = relRes.json.tag_name;
  log('[esphome] release ' + tag);

  // which schema version does schema.esphome.io actually serve?
  let schemaVer = null;
  for (const cand of [tag, tag.replace(/\.\d+$/, '.0'), 'dev']) {
    const probe = await getBuffer(schemaSrc.base + '/' + cand + '/esphome.json');
    if (probe.ok) { schemaVer = cand; break; }
  }
  if (!schemaVer) throw new Error('no usable schema version on ' + schemaSrc.base);
  log('[esphome] schema version ' + schemaVer + (schemaVer === tag ? '' : ' (nearest available)'));

  const treeUrl = 'https://api.github.com/repos/' + src.repo + '/git/trees/' + tag + ':esphome/components';
  const tree = await getJson(treeUrl);
  if (!tree.ok) throw new Error('cannot list esphome components: ' + (tree.error || tree.status));
  let components = tree.json.tree.filter((t) => t.type === 'tree').map((t) => t.path).sort();
  if (tree.json.truncated) log('[esphome] WARNING: component tree was truncated by the API');
  if (opt.limit) components = components.slice(0, opt.limit);
  log('[esphome] ' + components.length + ' component directories');

  const schemas = {};
  const missing = [];
  let varCount = 0;

  await pool(components, opt.concurrency, async (name) => {
    const url = schemaSrc.base + '/' + schemaVer + '/' + name + '.json';
    const r = await getBuffer(url, { accept: 'application/json' });
    const fetchedAt = nowIso();
    prov.push({ source_id: schemaSrc.id, url, status: r.status, bytes: r.bytes || 0, sha256: r.sha256 || null, fetched_at: fetchedAt });
    st.artifact.run(schemaSrc.id, url, null, r.status, r.bytes || 0, r.sha256 || null, fetchedAt);

    const docUrl = 'https://esphome.io/components/' + name + '/';
    if (!r.ok) {
      missing.push(name);
      st.component.run(name, 0, null, 0, docUrl);
      return;
    }
    let json;
    try { json = JSON.parse(r.body.toString('utf8')); }
    catch { missing.push(name); st.component.run(name, 0, null, 0, docUrl); return; }

    schemas[name] = json;
    const out = { vars: [], extends: [] };
    for (const [node, nodeVal] of Object.entries(json)) walkSchema(nodeVal, [node], out, 0);

    for (const v of out.vars) {
      st.cvar.run(name, v.node, v.name, v.key, v.type, v.data_type, v.default_value, v.templatable, v.docs, v.doc_url);
      if (v.docs) {
        st.search.run('esphome_var', name + ':' + v.node + '.' + v.name,
          name + ' / ' + v.name, v.docs, v.doc_url || docUrl);
      }
    }
    for (const e of out.extends) st.ext.run(name, e.node, e.extends);
    varCount += out.vars.length;
    st.component.run(name, 1, Object.keys(json).join(','), out.vars.length, docUrl);
    st.search.run('esphome_component', name, name, Object.keys(json).join(' '), docUrl);
  }, (_r, _i, done, total) => {
    if (done % 100 === 0 || done === total) log('[esphome] schemas ' + done + '/' + total);
  });

  const dir = path.join(DATA, 'esphome-schema', schemaVer);
  const bundle = writeFileSafe(path.join(dir, 'schemas.json'), JSON.stringify(schemas));
  writeFileSafe(path.join(dir, 'index.json'), JSON.stringify({
    esphome_release: tag, schema_version: schemaVer, harvested: nowIso(),
    components: components.length, with_schema: Object.keys(schemas).length, missing,
  }, null, 2));

  st.source.run(src.id, src.class, src.licence, src.licence_url, src.repo, src.pin, tag, 'https://esphome.io', 'component list', nowIso());
  st.source.run(schemaSrc.id, schemaSrc.class, schemaSrc.licence, schemaSrc.licence_url, null, schemaSrc.pin, schemaVer, schemaSrc.base, schemaSrc.gives, nowIso());

  return { tag, schemaVer, components: components.length, withSchema: Object.keys(schemas).length, missing: missing.length, vars: varCount, bundleBytes: fs.statSync(bundle).size };
}

// ---------------------------------------------------------------- Home Assistant

function flattenBrands(index) {
  // integrations.json: { integration: {slug: entry}, helper: {...}, translated_name: [...] }
  const brands = [];
  const integrations = [];
  for (const group of ['integration', 'helper']) {
    const bucket = index[group];
    if (!bucket || typeof bucket !== 'object') continue;
    for (const [slug, entry] of Object.entries(bucket)) {
      const children = entry.integrations && typeof entry.integrations === 'object'
        ? Object.entries(entry.integrations)
        : [[slug, entry]];
      brands.push({
        slug,
        name: entry.name || slug,
        iot_standards: Array.isArray(entry.iot_standards) ? entry.iot_standards.join(',') : null,
        n: children.length,
      });
      for (const [domain, e] of children) {
        integrations.push({
          domain,
          brand: slug,
          name: e.name || entry.name || domain,
          integration_type: e.integration_type || (group === 'helper' ? 'helper' : null),
          config_flow: e.config_flow === undefined ? null : (e.config_flow ? 1 : 0),
          iot_class: e.iot_class || null,
          supported_by: e.supported_by || null,
          single_config_entry: e.single_config_entry ? 1 : 0,
        });
      }
    }
  }
  return { brands, integrations };
}

async function harvestHa(src, st, prov) {
  log('\n[ha] resolving release...');
  const relRes = await getJson('https://api.github.com/repos/' + src.repo + '/releases/latest');
  if (!relRes.ok) throw new Error('cannot resolve ha release: ' + (relRes.error || relRes.status));
  const tag = relRes.json.tag_name;
  const raw = 'https://raw.githubusercontent.com/' + src.repo + '/' + tag + '/';
  log('[ha] release ' + tag);

  const dir = path.join(DATA, 'ha-core', tag);
  const summary = { tag, brands: 0, integrations: 0, manifests: 0, discovery: {}, bytes: {} };

  // 1. the brand/integration index + the generated discovery tables
  for (const file of src.files) {
    const url = raw + file;
    const r = await getBuffer(url);
    const fetchedAt = nowIso();
    prov.push({ source_id: src.id, url, status: r.status, bytes: r.bytes || 0, sha256: r.sha256 || null, fetched_at: fetchedAt });
    if (!r.ok) { log('[ha] MISS ' + file + ' (' + r.status + ')'); st.artifact.run(src.id, url, null, r.status, 0, null, fetchedAt); continue; }
    const local = writeFileSafe(path.join(dir, file.replace(/^homeassistant\//, '')), r.body);
    st.artifact.run(src.id, url, rel(local), r.status, r.bytes, r.sha256, fetchedAt);
    summary.bytes[path.basename(file)] = r.bytes;

    if (file.endsWith('integrations.json')) {
      const { brands, integrations } = flattenBrands(JSON.parse(r.body.toString('utf8')));
      for (const b of brands) st.brand.run(b.slug, b.name, b.iot_standards, b.n);
      summary.brands = brands.length;
      summary.integrations = integrations.length;
      summary._integrations = integrations;
    } else if (file.endsWith('.py')) {
      const parsed = parseGenerated(r.body.toString('utf8'));
      writeFileSafe(path.join(dir, 'generated-json', path.basename(file, '.py') + '.json'), JSON.stringify(parsed));
      for (const [name, value] of Object.entries(parsed)) {
        const channel = name.toLowerCase();
        let n = 0;
        if (Array.isArray(value)) {
          for (const m of value) { st.discovery.run(channel, m.domain || null, JSON.stringify(m)); n++; }
        } else {
          for (const [k, v] of Object.entries(value)) {
            const list = Array.isArray(v) ? v : [v];
            for (const m of list) {
              st.discovery.run(channel, (m && m.domain) || null, JSON.stringify({ match: k, ...m }));
              n++;
            }
          }
        }
        summary.discovery[channel] = n;
      }
    }
  }

  // 2. every integration manifest
  const tree = await getJson('https://api.github.com/repos/' + src.repo + '/git/trees/' + tag + ':homeassistant/components');
  if (!tree.ok) throw new Error('cannot list ha components: ' + (tree.error || tree.status));
  if (tree.json.truncated) log('[ha] WARNING: component tree was truncated by the API');
  let domains = tree.json.tree.filter((t) => t.type === 'tree').map((t) => t.path).sort();
  if (opt.limit) domains = domains.slice(0, opt.limit);
  log('[ha] ' + domains.length + ' component directories');

  const manifests = {};
  await pool(domains, opt.concurrency, async (domain) => {
    const url = raw + 'homeassistant/components/' + domain + '/' + src.per_component_file;
    const r = await getBuffer(url, { accept: 'application/json' });
    const fetchedAt = nowIso();
    prov.push({ source_id: src.id, url, status: r.status, bytes: r.bytes || 0, sha256: r.sha256 || null, fetched_at: fetchedAt });
    st.artifact.run(src.id, url, null, r.status, r.bytes || 0, r.sha256 || null, fetchedAt);
    if (!r.ok) return;
    try { manifests[domain] = JSON.parse(r.body.toString('utf8')); } catch { /* ignore */ }
  }, (_r, _i, done, total) => {
    if (done % 200 === 0 || done === total) log('[ha] manifests ' + done + '/' + total);
  });
  summary.manifests = Object.keys(manifests).length;
  const mBundle = writeFileSafe(path.join(dir, 'manifests.json'), JSON.stringify(manifests));
  summary.bytes['manifests.json'] = fs.statSync(mBundle).size;

  // 3. merge index + manifests into one integration row each
  const byDomain = new Map();
  for (const i of summary._integrations || []) byDomain.set(i.domain, i);
  for (const [domain, m] of Object.entries(manifests)) {
    const base = byDomain.get(domain) || { domain, brand: null, name: m.name || domain, integration_type: null, config_flow: null, iot_class: null, supported_by: null, single_config_entry: 0 };
    base._m = m;
    byDomain.set(domain, base);
  }
  for (const i of byDomain.values()) {
    const m = i._m || {};
    const iotClass = i.iot_class || m.iot_class || null;
    st.integration.run(
      i.domain, i.brand, i.name || m.name || i.domain,
      i.integration_type || m.integration_type || null,
      i.config_flow === null || i.config_flow === undefined ? (m.config_flow ? 1 : 0) : i.config_flow,
      iotClass,
      store.IOT_RANK[iotClass] || 9,
      i.supported_by || null,
      i.single_config_entry ? 1 : 0,
      m.quality_scale || null,
      m.documentation || null,
      Array.isArray(m.codeowners) ? m.codeowners.join(',') : null,
      Array.isArray(m.requirements) ? m.requirements.join(',') : null,
      Array.isArray(m.dependencies) ? m.dependencies.join(',') : null,
      i._m ? 1 : 0
    );
    st.search.run('ha_integration', i.domain, i.name || i.domain,
      [i.integration_type, iotClass, i.brand, m.quality_scale].filter(Boolean).join(' '),
      m.documentation || ('https://www.home-assistant.io/integrations/' + i.domain + '/'));
  }
  summary.integrations = byDomain.size;
  delete summary._integrations;

  st.source.run(src.id, src.class, src.licence, src.licence_url, src.repo, src.pin, tag,
    'https://www.home-assistant.io', src.gives, nowIso());
  return summary;
}

// ---------------------------------------------------------------- report

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

function dirSize(p) {
  let total = 0;
  if (!fs.existsSync(p)) return 0;
  for (const e of fs.readdirSync(p, { withFileTypes: true, recursive: true })) {
    if (e.isFile()) total += fs.statSync(path.join(e.parentPath || e.path, e.name)).size;
  }
  return total;
}

function writeReport(manifest, esp, ha, db, prov) {
  const q = (sql) => db.prepare(sql).all();
  const counts = {};
  for (const t of ['esphome_component', 'esphome_config_var', 'esphome_extends',
    'ha_brand', 'ha_integration', 'ha_discovery', 'artifact', 'source']) {
    counts[t] = q('SELECT COUNT(*) AS n FROM ' + t)[0].n;
  }
  const rank = q(`SELECT iot_class, COUNT(*) AS n FROM ha_integration
                  WHERE iot_class IS NOT NULL GROUP BY iot_class ORDER BY n DESC`);
  const chan = q(`SELECT channel, COUNT(*) AS n FROM ha_discovery GROUP BY channel ORDER BY n DESC`);
  const quality = q(`SELECT COALESCE(quality_scale,'(none)') AS qs, COUNT(*) AS n
                     FROM ha_integration GROUP BY qs ORDER BY n DESC`);
  const failed = prov.filter((p) => p.status !== 200).length;
  const dataBytes = dirSize(DATA);
  const dbBytes = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;

  const L = [];
  L.push('# CoreRef Phase 0 — harvest report');
  L.push('');
  L.push('Generated ' + nowIso() + ' by `CoreRef/tools/harvest.js`.');
  L.push('');
  L.push('## Pinned upstream versions');
  L.push('');
  L.push('| source | pin | resolved | licence |');
  L.push('|---|---|---|---|');
  for (const s of q('SELECT id,pin,resolved_ref,licence FROM source ORDER BY id')) {
    L.push('| `' + s.id + '` | ' + (s.pin || '-') + ' | **' + (s.resolved_ref || '-') + '** | ' + (s.licence || '-') + ' |');
  }
  L.push('');
  L.push('## Footprint');
  L.push('');
  L.push('| artefact | size |');
  L.push('|---|---|');
  L.push('| `CoreRef/data/` (raw, regenerable) | ' + fmtBytes(dataBytes) + ' |');
  L.push('| `CoreRef/db/coreref.sqlite` | ' + fmtBytes(dbBytes) + ' |');
  if (esp) L.push('| - esphome schemas bundle | ' + fmtBytes(esp.bundleBytes) + ' |');
  if (ha) for (const [k, v] of Object.entries(ha.bytes)) L.push('| - ha ' + k + ' | ' + fmtBytes(v) + ' |');
  L.push('');
  L.push('**This is the whole permissive layer.** It is what may ship on a BRIDGE install.');
  L.push('');
  L.push('## Row counts');
  L.push('');
  L.push('| table | rows |');
  L.push('|---|---|');
  for (const [t, n] of Object.entries(counts)) L.push('| `' + t + '` | ' + n.toLocaleString('en-US') + ' |');
  L.push('');
  if (esp) {
    L.push('## ESPHome');
    L.push('');
    L.push('- release **' + esp.tag + '**, schema version **' + esp.schemaVer + '**');
    L.push('- ' + esp.components + ' component directories; ' + esp.withSchema + ' have a published schema, ' + esp.missing + ' do not');
    L.push('- ' + esp.vars.toLocaleString('en-US') + ' config variables captured, with inline docs text and doc URLs');
    L.push('');
  }
  if (ha) {
    L.push('## Home Assistant');
    L.push('');
    L.push('- release **' + ha.tag + '**');
    L.push('- ' + counts.ha_brand + ' brands, ' + counts.ha_integration + ' integrations, ' + ha.manifests + ' manifests');
    L.push('');
    L.push('### Integration preference (the BRIDGE "prefers local" axis)');
    L.push('');
    L.push('| iot_class | rank | count |');
    L.push('|---|---|---|');
    for (const r of rank) L.push('| ' + r.iot_class + ' | ' + (store.IOT_RANK[r.iot_class] || 9) + ' | ' + r.n + ' |');
    const local = rank.filter((r) => r.iot_class.startsWith('local')).reduce((a, b) => a + b.n, 0);
    const cloud = rank.filter((r) => r.iot_class.startsWith('cloud')).reduce((a, b) => a + b.n, 0);
    L.push('');
    L.push('**' + local + ' local** vs **' + cloud + ' cloud** integrations.');
    L.push('');
    L.push('### Discovery fingerprints (device identification)');
    L.push('');
    L.push('| channel | rules |');
    L.push('|---|---|');
    for (const c of chan) L.push('| ' + c.channel + ' | ' + c.n + ' |');
    L.push('');
    L.push('### Quality scale');
    L.push('');
    L.push('| scale | count |');
    L.push('|---|---|');
    for (const r of quality) L.push('| ' + r.qs + ' | ' + r.n + ' |');
    L.push('');
  }
  L.push('## Licence routing (enforced by the harvester)');
  L.push('');
  L.push('| source | class | licence | what happens to it |');
  L.push('|---|---|---|---|');
  for (const s of manifest.sources) {
    const dest = s.class === 'permissive' ? 'harvested into `CoreRef/data` + sqlite; may ship'
      : 'NOT fetched here. Personal reading mirror outside the repo; client stores the URL only';
    L.push('| `' + s.id + '` | ' + s.class + ' | ' + s.licence + ' | ' + dest + ' |');
  }
  L.push('');
  L.push('## Fetch health');
  L.push('');
  L.push('- ' + prov.length.toLocaleString('en-US') + ' requests, ' + failed + ' non-200 (missing schema files are expected: not every ESPHome component publishes one)');
  L.push('');
  L.push('Every request is recorded in the `artifact` table with its URL, HTTP status, byte count and sha256,');
  L.push('so the next harvest can diff against this one and report what upstream changed.');
  L.push('');
  writeFileSafe(REPORT, L.join('\n'));
  return { counts, dataBytes, dbBytes, failed };
}

// ---------------------------------------------------------------- main

async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const byId = Object.fromEntries(manifest.sources.map((s) => [s.id, s]));

  log('CoreRef Phase 0 harvester');
  log('repo   : ' + REPO);
  log('data   : ' + rel(DATA));
  log('db     : ' + rel(DB_PATH));
  log('');
  log('licence routing:');
  for (const s of manifest.sources) {
    const { name } = destinationFor(s, manifest);
    log('  ' + s.id.padEnd(16) + ' ' + s.class.padEnd(11) + ' -> ' + name +
      (name === 'repo' ? '' : '  (NOT fetched in phase 0)'));
  }

  const db = store.open(DB_PATH);
  const st = store.prepared(db);
  const prov = [];
  let esp = null;
  let ha = null;

  try {
    if (opt.esphome) {
      assertRepoSafe(byId['esphome-core'], manifest);
      assertRepoSafe(byId['esphome-schema'], manifest);
      esp = await harvestEsphome(byId['esphome-core'], byId['esphome-schema'], st, prov);
    }
    if (opt.ha) {
      assertRepoSafe(byId['ha-core'], manifest);
      ha = await harvestHa(byId['ha-core'], st, prov);
    }
    // restricted sources: record provenance + policy only, fetch nothing
    for (const s of manifest.sources) {
      if (s.class !== 'restricted') continue;
      st.source.run(s.id, s.class, s.licence, s.licence_url, s.repo, 'links-only', null,
        s.canonical_base, s.policy, nowIso());
    }

    writeFileSafe(path.join(DATA, 'provenance.json'), JSON.stringify(prov));
    const r = writeReport(manifest, esp, ha, db, prov);
    log('');
    log('report : ' + rel(REPORT));
    log('data   : ' + fmtBytes(r.dataBytes) + '   db: ' + fmtBytes(r.dbBytes));
    log('rows   : ' + Object.entries(r.counts).map(([k, v]) => k + '=' + v).join(' '));
    log('');
    log('done.');
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error('\nFAILED: ' + (err && err.stack || err));
  process.exit(1);
});
