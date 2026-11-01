/* Shared by the ServiceKit pages: the offline data files and the bridge connection panel. */
import { t, getLang } from '../core/i18n.js';
import { h } from '../ui/dom.js';
import { panel } from './shared.js';

const cache = {};

/* commands.js, sugo.js and playbooks.js are copied unchanged from ServiceKitPhone. */
export function loadKit(name, globalName) {
  cache[name] ??= new Promise((resolve, reject) => {
    if (window[globalName]) { resolve(window[globalName]); return; }
    const s = document.createElement('script');
    s.src = `data/${name}.js`;
    s.onload = () => resolve(window[globalName]);
    s.onerror = reject;
    document.head.append(s);
  });
  return cache[name];
}

export const pick = (obj) => obj?.[getLang()] ?? obj?.hu ?? '';

export function fold(text) {
  return String(text ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export const strings = {
  hu: {
    'bridge.title': 'Kapcsolat a PC-vel', 'bridge.host': 'Cím', 'bridge.port': 'Port', 'bridge.token': 'Párosító kód', 'bridge.tokenHint': 'A kód nem mentődik, csak erre a kapcsolatra él.',
    'bridge.connect': 'Kapcsolódás', 'bridge.disconnect': 'Bontás', 'bridge.st.off': 'Nincs kapcsolat', 'bridge.st.connecting': 'Kapcsolódás…', 'bridge.st.auth': 'Párosító kód kell', 'bridge.st.on': 'Kapcsolódva: {pc}',
    'bridge.authfail': 'Hibás párosító kód.', 'bridge.noRun': 'A futtatás ki van kapcsolva. Indítsd a hidat --allow-run kapcsolóval.', 'bridge.runOn': 'A futtatás engedélyezve van a hídon.',
    'bridge.hint': 'USB-n a skphone-connect.cmd, Wi-Fin a skphone-wifi.cmd indítja a hidat a PC-n.',
    'bridge.run': 'Futtatás a PC-n', 'bridge.ran': 'Lefutott: {detail}', 'bridge.failed': 'Nem sikerült: {detail}', 'bridge.confirmTitle': 'Futtatás a PC-n', 'bridge.confirmOk': 'Futtatás',
  },
  en: {
    'bridge.title': 'PC connection', 'bridge.host': 'Address', 'bridge.port': 'Port', 'bridge.token': 'Pairing code', 'bridge.tokenHint': 'The code is not saved; it lasts for this connection only.',
    'bridge.connect': 'Connect', 'bridge.disconnect': 'Disconnect', 'bridge.st.off': 'Not connected', 'bridge.st.connecting': 'Connecting…', 'bridge.st.auth': 'Pairing code needed', 'bridge.st.on': 'Connected: {pc}',
    'bridge.authfail': 'Wrong pairing code.', 'bridge.noRun': 'Running is off. Start the bridge with --allow-run.', 'bridge.runOn': 'Running is allowed on the bridge.',
    'bridge.hint': 'On the PC, skphone-connect.cmd starts the bridge for USB and skphone-wifi.cmd for Wi-Fi.',
    'bridge.run': 'Run on PC', 'bridge.ran': 'Finished: {detail}', 'bridge.failed': 'Failed: {detail}', 'bridge.confirmTitle': 'Run on PC', 'bridge.confirmOk': 'Run',
  },
};

export function bridgePanel(ctx) {
  const { bridge, store } = ctx;
  const s = bridge.state;
  const label = t('bridge.st.' + s.status, { pc: s.pc });
  const host = h('input.input', { type: 'text', value: store.pageSetting('pcstatus', 'host') ?? '127.0.0.1', 'aria-label': t('bridge.host') });
  const port = h('input.input', { type: 'text', inputMode: 'numeric', value: store.pageSetting('pcstatus', 'port') ?? '47814', 'aria-label': t('bridge.port') });
  const pairing = h('input.input', { type: 'password', autocomplete: 'off', 'aria-label': t('bridge.token') });
  const on = s.status === 'on';
  return panel(t('bridge.title'),
    h('p', {}, h('span.chip' + (on ? '.on' : ''), { text: label })),
    s.last === 'authfail' ? h('p.field-note', { text: t('bridge.authfail') }) : null,
    on ? null : h('div.form', {},
      h('label.field', {}, h('span.k', { text: t('bridge.host') }), host),
      h('label.field', {}, h('span.k', { text: t('bridge.port') }), port),
      h('label.field', {}, h('span.k', { text: t('bridge.token') }), pairing),
      h('p.hint', { text: t('bridge.tokenHint') })),
    on ? h('p.hint', { text: t(s.allowRun ? 'bridge.runOn' : 'bridge.noRun') }) : h('p.hint', { text: t('bridge.hint') }),
    h('button.btn.primary', {
      type: 'button', text: t(on ? 'bridge.disconnect' : 'bridge.connect'),
      onclick: () => {
        if (on) { bridge.disconnect(); return; }
        store.setPageSetting('pcstatus', 'host', host.value.trim());
        store.setPageSetting('pcstatus', 'port', port.value.trim());
        bridge.connect({ host: host.value.trim(), port: port.value.trim(), pairing: pairing.value.trim() });
      },
    }));
}
