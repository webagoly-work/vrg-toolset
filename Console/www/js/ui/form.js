/* The record editor every list page shares: a sheet built from a field list. Numbers accept a
   decimal comma and are stored as numbers. */
import { t, getLang } from '../core/i18n.js';
import { parseNumber } from '../core/format.js';
import { h } from './dom.js';
import { closeSheet, openSheet } from './sheet.js';

const shown = (f, v) => {
  if (v == null) return '';
  return f.type === 'number' && getLang() === 'hu' ? String(v).replace('.', ',') : String(v);
};

function control(f, value, onInput) {
  const id = 'f-' + f.key;
  if (f.type === 'select') {
    return h('select.input', { id, onchange: onInput },
      f.options.map((o) => h('option', { value: o.value, text: o.label, selected: o.value === value })));
  }
  if (f.type === 'textarea') return h('textarea.input', { id, rows: 3, value: value ?? '', oninput: onInput });
  const attrs = { id, value: shown(f, value), oninput: onInput };
  if (f.type === 'number') return h('input.input', { ...attrs, type: 'text', inputMode: 'decimal' });
  if (f.suggest?.length) {
    const listId = id + '-list';
    return h('span', {},
      h('input.input', { ...attrs, type: 'text', list: listId }),
      h('datalist', { id: listId }, f.suggest.map((s) => h('option', { value: s }))));
  }
  return h('input.input', { ...attrs, type: f.type ?? 'text' });
}

export function fieldRow(f, value, onInput) {
  return h('label.field', { for: 'f-' + f.key },
    h('span.k', {}, f.unit ? `${f.label} (${f.unit})` : f.label),
    control(f, value, onInput));
}

export const readField = (f, root) => {
  const raw = root.querySelector('#f-' + f.key)?.value ?? '';
  if (f.type === 'number') return parseNumber(raw);
  return typeof raw === 'string' ? raw.trim() : raw;
};

/* live(values) returns a node shown above the buttons and redrawn on every keystroke. */
export function recordSheet({ title, fields, value = {}, onSave, onDelete, live }) {
  const body = h('div.sheet-body');
  const values = () => ({ ...value, ...Object.fromEntries(fields.map((f) => [f.key, readField(f, body)])) });
  const preview = h('div');
  const redraw = () => { if (live) preview.replaceChildren(live(values())); };
  const save = async () => {
    await onSave(values());
    closeSheet();
  };
  body.append(
    h('div.form', {}, fields.map((f) => fieldRow(f, value[f.key], redraw))),
    preview,
    h('div.form-actions', {},
      h('button.btn.primary', { type: 'button', text: t('common.save'), onclick: save }),
      onDelete && h('button.btn.danger', {
        type: 'button', text: t('common.delete'),
        onclick: async () => { closeSheet(); await onDelete(); },
      })));
  openSheet(title, body);
  redraw();
}
