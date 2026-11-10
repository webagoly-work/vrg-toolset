// WP-18 probe (real Electron, a 127.0.0.1 fixture): open a page through the omnibox decision (webOps.go), back / forward, find "teszt" → 1 match,
// bookmark it, the history has it, clear history → empty. The bookmarks file is under the selftest's temp home (VRG_DESK_HOME).
'use strict';
const http = require('http');

const PAGES = {
  '/a': '<!doctype html><meta charset="utf-8"><title>Elso</title><body>kezdo oldal</body>',
  '/b': '<!doctype html><meta charset="utf-8"><title>Masodik</title><body>Ez egy teszt oldal.</body>',
};
const serve = () => new Promise(resolve => {
  const server = http.createServer((req, res) => {
    const p = PAGES[req.url.split('?')[0]];
    if (!p) { res.writeHead(404); res.end('no'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(p);
  });
  server.listen(0, '127.0.0.1', () => resolve({
    url: 'http://127.0.0.1:' + server.address().port,
    close: () => new Promise(r => { server.closeAllConnections && server.closeAllConnections(); server.close(() => r()); }),
  }));
});

module.exports = async function probe({ win }) {
  const errors = [];
  const { web, webOps, webBm } = win.desk;
  const srv = await serve();
  const wait = async (fn, ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); }
    return false;
  };
  const titleIs = (view, want) => async () => { const wc = web.webContents(view); return !!wc && wc.getTitle() === want && !wc.isLoading(); };
  let view = '';
  try {
    webOps.clearHistory();
    const r = webOps.open(srv.url + '/a');
    view = r.view;
    if (!view) { errors.push('open failed: ' + JSON.stringify(r)); return { ok: false, errors }; }
    if (!(await wait(titleIs(view, 'Elso'), 10000))) { errors.push('page a did not load'); return { ok: false, errors }; }

    // omnibox: a full http URL is taken as typed; empty input is refused
    const g = webOps.go(view, srv.url + '/b');
    if (g.ok === false) errors.push('go failed: ' + JSON.stringify(g));
    if (!(await wait(titleIs(view, 'Masodik'), 10000))) errors.push('go did not reach page b');
    if (webOps.go(view, '   ').ok !== false) errors.push('an empty omnibox input was accepted');

    // back / forward
    web.nav(view, 'back');
    if (!(await wait(titleIs(view, 'Elso'), 10000))) errors.push('back did not return to page a');
    web.nav(view, 'fwd');
    if (!(await wait(titleIs(view, 'Masodik'), 10000))) errors.push('forward did not return to page b');

    // find (a user's tab is shown; a view without bounds is not laid out, so give it a rect first;
    // a window that was never shown does not paint, so find has nothing to search: show it off-screen like the screenshot step does)
    win.setPosition(-4000, 0); win.showInactive();
    web.bounds(view, { x: 0, y: 0, w: 800, h: 600 });
    let f = null;                                                // the first paint of a freshly shown view can take a moment: ask again a few times
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 600));
      f = await webOps.find(view, 'teszt');
      if (f && f.matches === 1) break;
    }
    if (!f || f.matches !== 1) errors.push('find "teszt": ' + JSON.stringify(f));
    const f0 = await webOps.find(view, 'nincsilyen');
    if (!f0 || f0.matches !== 0) errors.push('find of a missing word: ' + JSON.stringify(f0));
    await webOps.find(view, '');

    // zoom
    const z = webOps.zoom(view, 'in');
    if (!z || z.zoom !== 1.1) errors.push('zoom in: ' + JSON.stringify(z));
    webOps.zoom(view, 'reset');

    // bookmark
    const b = webOps.bookmark(view);
    if (!b || b.bookmarked !== true) errors.push('bookmark: ' + JSON.stringify(b));
    const list = webOps.bookmarks().bookmarks;
    if (list.length !== 1 || list[0].url !== srv.url + '/b' || list[0].title !== 'Masodik') errors.push('bookmarks list: ' + JSON.stringify(list));

    // history
    const h = webOps.history('').history;
    if (!h.some(x => x.url === srv.url + '/b' && x.title === 'Masodik')) errors.push('history misses page b: ' + JSON.stringify(h));
    if (!h.some(x => x.url === srv.url + '/a')) errors.push('history misses page a');
    webOps.clearHistory();
    const h2 = webOps.history('').history;
    if (h2.length) errors.push('history not empty after clear: ' + JSON.stringify(h2));

    // un-bookmark: leave nothing behind in the temp home
    const b2 = webOps.bookmark(view);
    if (!b2 || b2.bookmarked !== false || webOps.bookmarks().bookmarks.length) errors.push('un-bookmark: ' + JSON.stringify(b2));
  } catch (e) { errors.push('probe error: ' + e.stack); }
  finally {
    try { if (view) web.close(view); } catch (e) {}
    try { webBm.clear(); } catch (e) {}
    await srv.close();
    web.closeAll();
  }
  return { ok: !errors.length, errors };
};
