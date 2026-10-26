#!/usr/bin/env node
// world.js — the GitWorld snapshot for VRG Kódváros (live workspace P9, KV-20; CITY-D21 A, D22 A). Zero dependencies.
// Reads the repos named in vendor-manifest.json (the code we took from abroad), asks GitHub's public API about each
// (stars, licence, language, last push), and writes CodeCity/world.json — a committed snapshot of public metadata,
// so the planet renders offline too. Unauthenticated by default (60 requests/h; one pass needs ~40); a token is used
// only when GITHUB_TOKEN is set in the environment, and is never written anywhere. ETags are kept in the gitignored
// .cache/world/ (GitHub answers 304 for free only when authenticated, so without a token a refresh still counts).
// When the API says stop (rate limit, offline), the last snapshot's values are kept for the rest.
//
//   node CodeCity/world.js            (then: node CodeCity/build.js — the page inlines world.json as WORLD)
'use strict';
const fs = require('fs'), path = require('path');
const REPO = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'world.json'), CACHE = path.join(REPO, '.cache', 'world'), ETAGS = path.join(CACHE, 'etags.json');
const TOKEN = process.env.GITHUB_TOKEN || '';
const read = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return d; } };

(async () => {
  const manifest = read(path.join(REPO, 'vendor-manifest.json'), { components: [] });
  const old = new Map((read(OUT, { repos: [] }).repos || []).map(r => [r.repo, r]));
  const etags = read(ETAGS, {});
  const want = new Map();
  for (const c of manifest.components) {
    if (!c.repo || !/^[\w.-]+\/[\w.-]+$/.test(c.repo)) continue;
    const r = want.get(c.repo) || { repo: c.repo, slugs: [], aspects: new Set(), license: c.license || null };
    r.slugs.push(c.slug); if (c.aspect) r.aspects.add(c.aspect);
    want.set(c.repo, r);
  }
  const out = [];
  let fetched = 0, cached = 0, stopped = null;
  for (const w of want.values()) {
    const prev = old.get(w.repo);
    let meta = prev ? { stars: prev.stars, license: prev.license, language: prev.language, pushed: prev.pushed, archived: prev.archived } : null;
    if (!stopped) {
      const headers = { 'User-Agent': 'vrg-kodvaros-world', Accept: 'application/vnd.github+json' };
      if (TOKEN) headers.Authorization = 'Bearer ' + TOKEN;
      if (etags[w.repo] && prev) headers['If-None-Match'] = etags[w.repo];
      try {
        const res = await fetch('https://api.github.com/repos/' + w.repo, { headers });
        if (res.status === 304) cached++;
        else if (res.ok) {
          const j = await res.json();
          meta = { stars: j.stargazers_count, license: j.license && j.license.spdx_id !== 'NOASSERTION' ? j.license.spdx_id : (w.license || null),
            language: j.language || null, pushed: (j.pushed_at || '').slice(0, 10), archived: !!j.archived };
          if (res.headers.get('etag')) etags[w.repo] = res.headers.get('etag');
          fetched++;
        } else if (res.status === 403 || res.status === 429) stopped = 'rate limit (' + res.headers.get('x-ratelimit-remaining') + ' left)';
        else if (res.status === 404) meta = meta || { stars: null, license: w.license, language: null, pushed: null, archived: false, missing: true };
        if (+res.headers.get('x-ratelimit-remaining') === 0) stopped = stopped || 'rate limit reached';
      } catch (e) { stopped = 'offline (' + e.message + ')'; }
    }
    out.push(Object.assign({ repo: w.repo, slugs: w.slugs, aspects: [...w.aspects] }, meta || { stars: null, license: w.license, language: null, pushed: null }));
  }
  out.sort((a, b) => (b.stars || 0) - (a.stars || 0));
  const doc = { kind: 'vrg-world', version: 1, _comment: 'GitWorld snapshot: public GitHub metadata of the repos in vendor-manifest.json. Written by CodeCity/world.js.',
    fetched: new Date().toISOString().slice(0, 10), repos: out };
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 1) + '\n');
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(ETAGS, JSON.stringify(etags, null, 1) + '\n');
  console.log(`world.json: ${out.length} repos — ${fetched} fetched, ${cached} unchanged (304)${stopped ? ', stopped: ' + stopped + ' — the rest kept from the last snapshot' : ''}${TOKEN ? ' (with a token)' : ''}`);
})();
