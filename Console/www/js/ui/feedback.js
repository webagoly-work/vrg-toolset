/* Toasts and the approval dialog. A toast confirms in the past tense; destructive steps ask
   first on a charcoal plate, and in glove mode the confirm button must be held. */
import { t } from '../core/i18n.js';
import { h } from './dom.js';

export const HOLD_MS = 1500;

/* A modal dialog makes the rest of the page inert, so toasts live inside the top open dialog. */
export function toast(message, { action, ms = 2600, error = false } = {}) {
  const box = document.getElementById('toasts');
  (document.querySelector('#confirm[open]') ?? document.querySelector('#sheet[open]') ?? document.body).append(box);
  let timer;
  const close = () => { clearTimeout(timer); node.remove(); };
  const node = h(error ? 'div.toast.err.chrome' : 'div.toast.chrome', {},
    h('span', { text: message }),
    action && h('button.btn', { type: 'button', text: action.label, onclick: () => { close(); action.run(); } }));
  box.append(node);
  if (action) node.querySelector('button').focus();
  timer = setTimeout(close, ms);
  return close;
}

function holdButton(label, onDone) {
  let timer = null;
  const start = () => {
    if (timer) return;
    btn.classList.add('holding');
    timer = setTimeout(() => { timer = null; onDone(); }, HOLD_MS);
  };
  const stop = () => {
    clearTimeout(timer);
    timer = null;
    btn.classList.remove('holding');
  };
  const isKey = (e) => e.key === 'Enter' || e.key === ' ';
  const btn = h('button.btn.danger.primary.hold', {
    type: 'button',
    text: t('confirm.hold', { label }),
    onpointerdown: start, onpointerup: stop, onpointerleave: stop, onpointercancel: stop,
    onkeydown: (e) => { if (isKey(e)) { e.preventDefault(); start(); } },
    onkeyup: (e) => { if (isKey(e)) stop(); },
  });
  return btn;
}

export function confirmDialog({ title, body, ok, glove }) {
  const dlg = document.getElementById('confirm');
  return new Promise((resolve) => {
    /* Resolve here, not on the close event: Chrome ties that to animation frames, so a
       background page would never answer. */
    const finish = (value) => {
      dlg.oncancel = null;
      dlg.close();
      resolve(value);
    };
    dlg.oncancel = (e) => { e.preventDefault(); finish(false); };
    const cancel = h('button.btn.cancel', { type: 'button', text: t('common.cancel'), onclick: () => finish(false) });
    const confirm = glove
      ? holdButton(ok, () => finish(true))
      : h('button.btn.danger.primary', { type: 'button', text: ok, onclick: () => finish(true) });
    dlg.replaceChildren(h('div.confirm-body', {},
      h('h2', { text: title }),
      h('p', { text: body }),
      h('div.confirm-actions', {}, cancel, confirm)));
    dlg.showModal();
    cancel.focus();
  });
}
