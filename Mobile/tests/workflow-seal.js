// WP M42: tools/workflow-seal.js end to end on throwaway folders, and the fixture kit-core WorkflowTest opens.
//   node Mobile/tests/workflow-seal.js            run the checks (temp folders only, no git, no real job)
//   node Mobile/tests/workflow-seal.js --fixture  also (re)write Mobile/tests/fixtures/workflow-sealed.json
// Every job, address and key here is made up.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { webcrypto: C } = require('crypto');
const W = require('../../tools/workflow-seal.js');

const SEAL = path.join(__dirname, '..', '..', 'tools', 'workflow-seal.js');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-wk-'));
const w = (rel, text) => { const f = path.join(tmp, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };

(async () => {
  // ---- two fake jobs, one folder that is not a job
  w('jobs/TST1_proba_lakas/job/funnel/decisions.json', JSON.stringify({ address: '9999 Próbafalva, Teszt utca 1.' }));
  w('jobs/TST1_proba_lakas/job/offer.json', JSON.stringify({ A: { labour: { total: 850000 }, material: { total: 420000 }, dur: { emberora: 96, x: 4, y: 6 } }, A_M2: 62,
    B: { labour: { total: 990000 }, material: { total: 515000 }, dur: { emberora: 110, x: 5, y: 7 } }, meta: { note: 'x' } }));
  w('jobs/TST1_proba_lakas/job/price.json', '{}');
  w('jobs/TST1_proba_lakas/job/MENNYISEGEK.md', '# Mennyiségek\n- NYM-J 3×1,5: 120 m\n');
  w('jobs/TST1_proba_lakas/ARAJANLAT.md', '# Árajánlat (próba)\nÖsszesen: 1 270 000 Ft\n');
  w('jobs/TST1_proba_lakas/Arajanlat_proba.pdf', '%PDF-1.4 not a real pdf');
  w('jobs/TST1_proba_lakas/job/big.md', 'x'.repeat(70 * 1024));
  w('jobs/TS2_csak_kerdessor/job/answers_r1.json', JSON.stringify({ answers: { address: 'Teszt tér 2.' } }));
  w('jobs/_elozmenyek/REGISZTER.md', '# not a job\n');

  const jobs = W.readJobs(path.join(tmp, 'jobs'));
  ok(jobs.length === 2 && jobs[0].code === 'TS2' && jobs[1].code === 'TST1', 'two job folders read, _elozmenyek skipped');
  const j = jobs[1];
  ok(j.title === 'proba lakas' && j.address === '9999 Próbafalva, Teszt utca 1.', 'title from the folder, address from decisions.json');
  ok(j.steps.funnel && j.steps.takeoff && j.steps.price && j.steps.offer && j.steps.doc, 'all five steps found');
  ok(jobs[0].steps.funnel && !jobs[0].steps.offer, 'a funnel-only job');
  ok(j.variants.length === 2 && j.variants[0].key === 'A' && j.variants[0].total === 1270000 && j.variants[0].m2 === 62 && j.variants[0].hours === 96,
    'offer.json variants A and B, meta skipped');
  ok(j.docs[0].name === 'ARAJANLAT.md' && !j.docs.some(d => d.name.endsWith('big.md')), 'docs: the offer first, a 70 KB .md left out');
  ok(!JSON.stringify(j).includes('%PDF'), 'no PDF content in the pack');
  ok(j.files.some(f => f.name === 'Arajanlat_proba.pdf'), 'the PDF is listed by name');

  // ---- a phone key (WebCrypto, as Workflow.keyFile makes it), on the list, published
  const kp = await C.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  const jwk = await C.subtle.exportKey('jwk', kp.publicKey);
  const id = 'TESTPHONE0001', pub = { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y }, code = W.codeOf(id, pub);
  w(`keys/${id}.json`, JSON.stringify({ t: 'vrg-wk-key', v: 1, id, name: 'Teszt telefon', pub, code, at: '2026-11-20T10:00:00Z' }));
  w('devices.json', JSON.stringify({ gated: true, devices: [{ id: 'TEST-PHON-E0001', name: 'Teszt telefon' }] }));
  const common = [`--jobs=${path.join(tmp, 'jobs')}`, `--keys=${path.join(tmp, 'keys')}`, `--devices=${path.join(tmp, 'devices.json')}`,
    `--trust-file=${path.join(tmp, 'trust.json')}`, `--out=${path.join(tmp, 'out')}`];
  const run = (...a) => { try { return { code: 0, out: execFileSync('node', [SEAL, ...a, ...common], { stdio: ['pipe', 'pipe', 'pipe'] }).toString() }; }
    catch (e) { return { code: e.status, out: String(e.stdout) + String(e.stderr) }; } };

  let r = run('seal');
  ok(r.code === 0 && /nothing to write/.test(r.out) && !fs.existsSync(path.join(tmp, 'out')), 'nothing sealed before trust');
  r = run('trust', id, 'ZZZZZZ');
  ok(r.code === 1 && !fs.existsSync(path.join(tmp, 'trust.json')), 'a wrong code is refused');
  r = run('trust', id, code.toLowerCase());
  ok(r.code === 0 && fs.existsSync(path.join(tmp, 'trust.json')), 'the right code is trusted');
  r = run('status');
  ok(r.code === 0 && /TESTPHONE0001.*trusted/.test(r.out) && !/Pr.bafalva/.test(r.out), 'status: trusted, no address on the console');
  r = run('seal');
  const sf = path.join(tmp, 'out', 'sealed', id + '.json');
  ok(r.code === 0 && fs.existsSync(sf), 'sealed to the trusted phone');
  const sealedText = fs.readFileSync(sf, 'utf8');
  ok(!/Pr.bafalva|1270000|proba/i.test(sealedText), 'the sealed file holds nothing in clear');
  const sealed = JSON.parse(sealedText);
  ok(sealed.t === 'vrg-wk-sealed' && sealed.to === id && sealed.jobs === 2 && sealed.z === 'gzip', 'the envelope');
  const priv = Buffer.from(await C.subtle.exportKey('pkcs8', kp.privateKey)).toString('base64url');
  const plain = JSON.parse(await W.open(sealed, id, priv));
  ok(plain.t === 'vrg-wk-pack' && plain.jobs.length === 2 && plain.jobs[1].variants[0].total === 1270000, 'opens with the phone key');
  let refused = false; try { await W.open(sealed, 'OTHERPHONE01', priv); } catch { refused = true; }
  ok(refused, 'another id (the AAD) does not open it');
  r = run('seal');
  ok(/unchanged since the last seal/.test(r.out), 'an unchanged pack is not sealed again');

  // a changed key on the branch is not sealed to until trusted again
  const kp2 = await C.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  const j2 = await C.subtle.exportKey('jwk', kp2.publicKey);
  w(`keys/${id}.json`, JSON.stringify({ t: 'vrg-wk-key', v: 1, id, name: 'Teszt telefon', pub: { kty: 'EC', crv: 'P-256', x: j2.x, y: j2.y }, code: 'X', at: '' }));
  r = run('seal', '--force');
  ok(/KEY CHANGED/.test(r.out), 'a swapped key is refused until trusted again');

  if (process.argv.includes('--fixture')) {
    const out = { about: 'Written by Mobile/tests/workflow-seal.js (WebCrypto). Test key and made-up jobs only.',
      id, privatePkcs8: priv, pub, code, sealed, expect: { jobs: 2, code: 'TST1', title: 'proba lakas', totalA: 1270000, labourB: 990000, docs: plain.jobs[1].docs.length } };
    const f = path.join(__dirname, 'fixtures', 'workflow-sealed.json');
    fs.writeFileSync(f, JSON.stringify(out, null, 2) + '\n');
    console.log('wrote ' + path.relative(process.cwd(), f));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fails ? `${fails} failed` : 'workflow-seal: all ok');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
