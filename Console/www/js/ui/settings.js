/* The settings sheet: language, density, glove mode, sunlight theme, presets, export and erase. */
import { t, LANGS } from '../core/i18n.js';
import { DENSITIES, MAX_PRESETS, NAME_MAX, UNDO_MS, validName } from '../core/store.js';
import { formatNumber } from '../core/format.js';
import { h, iconButton, segmented, switchRow } from './dom.js';
import { openSheet } from './sheet.js';
import { confirmDialog, toast } from './feedback.js';
import { stripExif } from '../pages/inbox.js';

function downloadJson(data, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openSettings(ctx, { focus } = {}) {
  const { store } = ctx;
  const body = h('div.sheet-body');

  function presetsSection() {
    const { presets, active } = store.state;
    const max = formatNumber(MAX_PRESETS);
    const note = h('p.field-note', { role: 'alert' });

    const rows = presets.map((p) => {
      const isActive = p.id === active;
      const name = p.name;
      return h('div.preset-row', {},
        h('input.input', {
          type: 'text', value: name, maxLength: NAME_MAX, 'aria-label': t('settings.presetRename', { name }),
          onchange: (e) => {
            if (store.renamePreset(p.id, e.target.value)) {
              note.textContent = '';
              ctx.presetsChanged();
              toast(t('toast.saved'));
            } else {
              e.target.value = name;
              note.textContent = t('error.presetName', { max: formatNumber(NAME_MAX) });
            }
          },
        }),
        h('button.btn', {
          type: 'button', disabled: isActive, 'aria-pressed': String(isActive),
          text: t(isActive ? 'settings.presetInUse' : 'settings.presetUse'),
          onclick: () => { ctx.switchPreset(p.id); render(); },
        }),
        iconButton('trash', t('settings.presetDelete', { name }), () => deletePreset(p), { disabled: presets.length === 1 }));
    });

    const input = h('input.input', {
      type: 'text', maxLength: NAME_MAX, id: 'presetNew', 'aria-label': t('settings.presetNew'), placeholder: t('settings.presetNew'),
    });
    const add = () => {
      if (!validName(input.value)) {
        note.textContent = t('error.presetName', { max: formatNumber(NAME_MAX) });
        input.focus();
        return;
      }
      store.addPreset(input.value);
      ctx.presetsChanged();
      ctx.pagesChanged();
      render();
      toast(t('toast.saved'));
    };
    const full = presets.length >= MAX_PRESETS;

    return h('section.sect', {},
      h('h3', { text: t('settings.presets') }),
      h('p.hint', { text: t('settings.presetsHint', { max }) }),
      rows,
      full
        ? h('p.hint', { text: t('settings.presetFull', { max }) })
        : h('div.preset-row', {}, input, h('button.btn', { type: 'button', text: t('settings.presetAdd'), onclick: add })),
      presets.length === 1 ? h('p.hint', { text: t('settings.presetLast') }) : null,
      note);
  }

  async function deletePreset(p) {
    const yes = await confirmDialog({
      title: t('confirm.preset.title'), body: t('confirm.preset.body', { name: p.name }),
      ok: t('confirm.preset.ok'), glove: store.state.settings.glove,
    });
    if (!yes) return;
    const snap = store.snapshot();
    store.deletePreset(p.id);
    ctx.presetsChanged();
    ctx.pagesChanged();
    render();
    toast(t('toast.presetDeleted', { name: p.name }), {
      ms: UNDO_MS,
      action: { label: t('common.undo'), run: () => { store.restore(snap); ctx.presetsChanged(); ctx.pagesChanged(); render(); toast(t('toast.restored')); } },
    });
  }

  async function exportData() {
    try {
      const data = { ...store.exportData(), records: await ctx.db.exportAll(stripExif) };
      const name = `varler-console-${data.exportedAt.slice(0, 10)}.json`;
      downloadJson(data, name);
      toast(t('toast.exported', { file: name }));
    } catch {
      toast(t('error.export'), { error: true, ms: 6000 });
    }
  }

  async function erase() {
    const yes = await confirmDialog({
      title: t('confirm.erase.title'),
      body: t('confirm.erase.body', { seconds: formatNumber(UNDO_MS / 1000) }),
      ok: t('confirm.erase.ok'), glove: store.state.settings.glove,
    });
    if (!yes) return;
    const dump = store.eraseAll();
    const records = await ctx.db.dump();
    await ctx.db.clear();
    ctx.reset();
    render();
    toast(t('toast.erased'), {
      ms: UNDO_MS,
      action: { label: t('common.undo'), run: async () => { store.restoreErased(dump); await ctx.db.load(records); ctx.reset(); render(); toast(t('toast.restored')); } },
    });
  }

  function render() {
    const s = store.state.settings;
    const top = body.scrollTop;
    body.replaceChildren(
      h('section.sect', {},
        h('h3', { text: t('settings.language') }),
        segmented(LANGS.map((l) => ({ value: l, label: t('settings.lang.' + l) })), s.lang, (lang) => {
          store.setSetting('lang', lang);
          ctx.languageChanged();
          document.getElementById('sheetTitle').textContent = t('settings.title');
          render();
        }),
        h('p.hint', { text: t('settings.languageHint') })),
      h('section.sect', {},
        h('h3', { text: t('settings.density') }),
        segmented(DENSITIES.map((d) => ({ value: d, label: t('density.' + d) })), s.density, (density) => {
          store.setSetting('density', density);
          ctx.refreshPage();
        }),
        h('p.hint', { text: t('settings.densityHint') })),
      h('section.sect', {},
        h('h3', { text: t('settings.display') }),
        switchRow(t('settings.glove'), t('settings.gloveHint'), s.glove, (on) => { store.setSetting('glove', on); ctx.displayChanged(); }),
        switchRow(t('settings.sunlight'), t('settings.sunlightHint'), s.sunlight, (on) => { store.setSetting('sunlight', on); ctx.displayChanged(); })),
      presetsSection(),
      h('section.sect', {},
        h('h3', { text: t('settings.data') }),
        h('p.hint', { text: t('settings.dataHint') }),
        h('button.btn', { type: 'button', text: t('settings.export'), onclick: exportData }),
        h('p.hint', { text: t('settings.exportHint') }),
        h('button.btn.danger', { type: 'button', text: t('settings.erase'), onclick: erase }),
        h('p.hint', { text: t('settings.eraseHint') })));
    body.scrollTop = top;
  }

  render();
  openSheet(t('settings.title'), body);
  if (focus) body.querySelector(focus)?.focus();
}
