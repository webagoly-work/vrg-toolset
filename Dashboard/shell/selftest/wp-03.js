// WP-03 probe: window.vrg.app.info() works from the page; an unknown channel is refused as bad-request.
'use strict';
module.exports = async function probe({ win }) {
  const errors = [];
  const js = code => win.webContents.executeJavaScript(code);
  const info = await js('window.vrg.app.info()');
  if (!info || info.ok !== true) errors.push('app.info: ' + JSON.stringify(info));
  else {
    if (typeof info.version !== 'string' || !info.version) errors.push('app.info version missing');
    if (info.user !== 'founder') errors.push('app.info user: ' + info.user);
    if (info.mode !== 'ablak') errors.push('app.info mode: ' + info.mode);
    if (!Array.isArray(info.features) || !info.features.includes('app')) errors.push('app.info features: ' + JSON.stringify(info.features));
  }
  const nope = await js(`window.vrg.call('nope', 'x', {})`);
  if (!nope || nope.ok !== false || nope.err !== 'bad-request') errors.push('unknown channel: ' + JSON.stringify(nope));
  const extra = await js(`window.vrg.call('app', 'info', { extra: 1 })`);
  if (!extra || extra.ok !== false || extra.err !== 'bad-request') errors.push('extra key: ' + JSON.stringify(extra));
  const d1 = await js(`typeof window.vrg.act === 'function' && typeof window.vrg.ports === 'function' && typeof window.vrg.on === 'function'`);
  if (d1 !== true) errors.push('D1 calls or vrg.on missing');
  return { ok: !errors.length, errors };
};
