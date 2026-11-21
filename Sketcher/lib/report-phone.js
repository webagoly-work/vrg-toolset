// Sketcher/lib/report-phone.js — the Felmérési jegyzőkönyv on the phone (WP M54, F9, the Founder's D-81 B).
//
// The phone has no copy of the document in Kotlin: it runs this file with report.js and fieldkit.js (the same files the
// Desktop page inlines, bundled into the APK by feature-sketch/build.gradle.kts) in a hidden WebView. The phone hands
// over one input (sketch-core Jegyzokonyv.input: the survey after the export rules, the takeoff, the catalog and the
// active variant, the photos as data: URLs, the drawing and the site as SVG) and gets back one self-contained HTML
// document, which it prints (PrintManager → PDF) or shares (Átadás → <név>.jegyzokonyv.html).
//
//   VRGReportPhone.render(input)  → the HTML (Node: render(input, require('./fieldkit.js'), require('./report.js')))
//   VRGReportPhone.run()          → in the WebView: reads VRGIn.input(), answers VRGIn.done(html) or VRGIn.fail(msg)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.VRGReportPhone = factory(root);
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  function render(inp, FK, R) {
    FK = FK || root.VRGFieldKit; R = R || root.VRGReport;
    inp = inp || {};
    // the kit as the Desktop page has it: the catalog with the survey's variant on top (app.js kit())
    const kit = FK.withVariant(FK.parseKit(inp.catalog), inp.variant || null);
    const S = inp.survey || {}, rooms = inp.rooms || [], photos = inp.photos || {};
    const roomName = id => {
      if (!id) return '';
      const n = rooms.find(r => r.id === id);
      return n && n.name || ((S.rooms || []).find(r => r.id === id) || {}).name || id;
    };
    return R.html(R.model(kit, S, inp.takeoff || null, { now: inp.now || Date.now(), roomName, photoUrl: c => photos[c.id] || null,
      planSvg: inp.planSvg || '', siteSvg: inp.siteSvg || '', siteLines: inp.siteLines || [] }));
  }
  function run() {
    const io = root.VRGIn;
    try { io.done(render(JSON.parse(io.input()))); } catch (e) { try { io.fail(String(e && e.stack || e)); } catch (x) { /* no bridge */ } }
  }
  return { render, run };
});
