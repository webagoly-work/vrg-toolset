/* One modal sheet at a time. Opening a page's settings from the library stacks on top of it:
   closing goes back to where it was opened from. Esc closes; focus returns to the opener. */
import { t } from '../core/i18n.js';
import { h, iconButton } from './dom.js';

const stack = [];
const dialog = () => document.getElementById('sheet');

function show(entry) {
  const dlg = dialog();
  dlg.replaceChildren(
    h('div.sheet-head', {},
      h('h2', { id: 'sheetTitle', text: entry.title }),
      iconButton('close', t('common.close'), closeSheet)),
    entry.body);
  dlg.setAttribute('aria-labelledby', 'sheetTitle');
  if (!dlg.open) dlg.showModal();
}

export function openSheet(title, body, { stacked = false } = {}) {
  if (!stacked) stack.length = 0;
  stack.push({ title, body, opener: document.activeElement });
  show(stack[stack.length - 1]);
}

export function closeSheet() {
  const closing = stack.pop();
  if (stack.length) show(stack[stack.length - 1]);
  else if (dialog().open) {
    document.body.append(document.getElementById('toasts'));
    dialog().close();
  }
  if (closing?.opener?.isConnected) closing.opener.focus();
}

export function initSheet() {
  const dlg = dialog();
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeSheet(); });
}

export const sheetOpen = () => dialog().open;
