/* Building blocks for page modules. A module exports { manifest, strings, mount(root, ctx) }. */
import { t } from '../core/i18n.js';
import { h } from '../ui/dom.js';
import { toast } from '../ui/feedback.js';

/* Everything that belongs to a job. Deleting a job deletes these with it (L1). */
export const JOB_COLLECTIONS = ['measure', 'panel', 'check', 'photo', 'time', 'material'];

export const panel = (title, ...children) => h('section.panel', {},
  title ? h('div.ph', {}, h('h2', { text: title })) : null,
  h('div.pb', {}, ...children));

export const pageWrap = (...children) => h('div.wrap', {}, ...children);

export const guide = (text, button) => h('div.guide', {}, h('p', { text }), button ?? null);

export const addButton = (label, onclick) => h('button.btn', { type: 'button', text: label, onclick });

const MARKS = { ok: '✓', warn: '▲', fail: '✕', none: '–' };
export const statusChip = (status) =>
  h(`span.chip.st-${status}`, {}, h('span', { 'aria-hidden': 'true', text: MARKS[status] }), t('status.' + status));

export const listRow = ({ title, sub, chip, onclick, extra }) => h('div.lrow', {},
  h('button.lmain', { type: 'button', onclick },
    h('b', { text: title }),
    sub ? h('small', { text: sub }) : null),
  chip ?? null,
  extra ?? null);

/* Every page mount is async; this stops a slow load painting into a page already gone. */
export function liveRender(root, ctx, render) {
  let alive = true;
  const run = async () => {
    try {
      const node = await render();
      if (alive) root.replaceChildren(node);
    } catch (err) {
      console.error(err);
      if (alive) root.replaceChildren(guide(t('common.loadFailed')));
    }
  };
  run();
  return { refresh: run, stop: () => { alive = false; } };
}

export async function activeJob(ctx) {
  const id = ctx.store.state.settings.activeJob;
  return id ? ctx.db.get('job', id) : null;
}

export function jobBar(job, ctx) {
  if (!job) return guide(t('jobbar.none'), addButton(t('jobbar.open'), () => ctx.goto('job')));
  return h('div.jobbar', {}, h('span.k', { text: t('jobbar.label') }), h('b', { text: job.name }));
}

export async function deleteWithUndo(ctx, coll, rec, name, after) {
  await ctx.db.del(coll, rec.id);
  await after();
  toast(t('common.deleted', { name }), {
    ms: 10000,
    action: { label: t('common.undo'), run: async () => { await ctx.db.restore(coll, rec); await after(); } },
  });
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[";\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
export const toCsv = (header, rows) => [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');

export function download(name, content, type) {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* UTF-8 BOM so Excel reads Hungarian accents correctly */
export const downloadCsv = (name, header, rows) => download(name, '﻿' + toCsv(header, rows), 'text/csv');
