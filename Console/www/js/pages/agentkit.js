/* Agent kit brief: a context bundle for one job. Redacted by default, shown exactly as it would
   leave, section by section. Client data and prices stay out unless switched on (L1, L7). */
import { t } from '../core/i18n.js';
import { formatNumber } from '../core/format.js';
import { checkReading } from '../core/limits.js';
import { redactText } from '../core/redact.js';
import { h } from '../ui/dom.js';
import { toast } from '../ui/feedback.js';
import { activeJob, jobBar, liveRender, pageWrap, panel } from './shared.js';

export const manifest = { id: 'agentkit', category: 'dev', permissions: ['clipboard'], offline: true, name: { hu: 'Ügynök-kit összefoglaló', en: 'Agent kit brief' } };

const SOURCES = ['job', 'measure', 'panel', 'checklist'];

export const strings = {
  hu: {
    'agent.sources': 'Mit láthat az ügynök', 'agent.goal': 'A munkamenet célja', 'agent.preview': 'Pontosan ez kerül ki', 'agent.copy': 'Másolás',
    'agent.redacted': 'Kitakarva: ügyfélnév, pontos cím, telefon és e-mail', 'agent.unredact': 'Valódi ügyféladatok a szövegben', 'agent.unredactHint': 'Csak akkor kapcsold be, ha van rá jogalapod és adatfeldolgozói szerződésed.',
    'agent.s.job': 'Munkalap', 'agent.s.measure': 'Mérések', 'agent.s.panel': 'Áramkörök', 'agent.s.checklist': 'Ellenőrzőlisták',
    'agent.b.title': 'Munkamenet-összefoglaló', 'agent.b.goal': 'Cél', 'agent.b.rules': 'Szabályok', 'agent.b.rule1': 'Csak a fenti adatokból dolgozz, feltevés előtt kérdezz.',
    'agent.b.rule2': 'Az eredmény vázlat. A minősítést és az aláírást a villanyszerelő adja.', 'agent.b.rule3': 'Szabványt csak szakaszszámmal hivatkozz, szöveget ne idézz.',
    'agent.b.noGoal': '(add meg a célt)', 'agent.b.open': '{tpl}: {done} kész',
  },
  en: {
    'agent.sources': 'What the agent may see', 'agent.goal': 'Session goal', 'agent.preview': 'Exactly this leaves the device', 'agent.copy': 'Copy',
    'agent.redacted': 'Hidden: client name, exact address, phone and email', 'agent.unredact': 'Real client details in the text', 'agent.unredactHint': 'Switch on only with a lawful basis and a processor agreement.',
    'agent.s.job': 'Field job', 'agent.s.measure': 'Readings', 'agent.s.panel': 'Circuits', 'agent.s.checklist': 'Checklists',
    'agent.b.title': 'Session brief', 'agent.b.goal': 'Goal', 'agent.b.rules': 'Rules', 'agent.b.rule1': 'Work only from the data above; ask before assuming.',
    'agent.b.rule2': 'The result is a draft. The rating and signature come from the electrician.', 'agent.b.rule3': 'Cite standards by clause number only; never quote their text.',
    'agent.b.noGoal': '(set a goal)', 'agent.b.open': '{tpl}: {done} done',
  },
};

async function sections(job, ctx) {
  const limits = await ctx.db.list('limit');
  const readings = await ctx.db.list('measure', (r) => r.jobId === job.id);
  const ways = await ctx.db.list('panel', (r) => r.jobId === job.id);
  const checks = await ctx.db.list('check', (r) => r.jobId === job.id);
  return {
    job: [`${job.name}`, job.client, job.site, job.scope, job.contact, job.earthing, job.access].filter(Boolean),
    measure: readings.map((r) => {
      const status = checkReading(r, limits.find((l) => l.id === r.limitId)).overall;
      return `${r.circuit ?? '—'}: Zs ${r.zs ?? '—'} Ω, IR ${r.ir ?? '—'} MΩ, ${r.rcdMs ?? '—'} ms, ${t('status.' + status)}`;
    }),
    panel: ways.map((w) => [w.board, w.way, w.label, w.device, w.rcd, w.cable].filter(Boolean).join(' · ')),
    checklist: checks.map((c) => t('agent.b.open', { tpl: c.tpl, done: formatNumber(Object.values(c.done).filter(Boolean).length) })),
  };
}

export function mount(root, ctx) {
  const on = { job: true, measure: true, panel: true, checklist: true };
  let goal = '';
  let raw = false;
  const view = liveRender(root, ctx, async () => {
    const job = await activeJob(ctx);
    if (!job) return pageWrap(jobBar(null, ctx));
    const data = await sections(job, ctx);
    const well = h('pre.well', { tabIndex: 0 });
    const draw = () => {
      const lines = ['# ' + t('agent.b.title'), '', '## ' + t('agent.b.goal'), goal || t('agent.b.noGoal')];
      for (const s of SOURCES) {
        if (on[s] && data[s].length) lines.push('', '## ' + t('agent.s.' + s), ...data[s].map((l) => '- ' + l));
      }
      lines.push('', '## ' + t('agent.b.rules'), '- ' + t('agent.b.rule1'), '- ' + t('agent.b.rule2'), '- ' + t('agent.b.rule3'));
      const text = lines.join('\n');
      well.textContent = raw ? text : redactText(text, { names: [job.client, job.contact], address: job.site });
    };
    draw();
    return pageWrap(jobBar(job, ctx),
      panel(t('agent.sources'),
        SOURCES.map((s) => h('label.tpl', {},
          h('input', { type: 'checkbox', checked: on[s], onchange: (e) => { on[s] = e.target.checked; draw(); } }),
          h('span.tname', { text: t('agent.s.' + s) }))),
        h('label.tpl', {},
          h('input', { type: 'checkbox', checked: raw, onchange: (e) => { raw = e.target.checked; view.refresh(); } }),
          h('span.tname', { text: t('agent.unredact') })),
        h('p.hint', { text: t(raw ? 'agent.unredactHint' : 'agent.redacted') })),
      panel(t('agent.goal'), h('input.input', { type: 'text', value: goal, 'aria-label': t('agent.goal'), oninput: (e) => { goal = e.target.value; draw(); } })),
      panel(t('agent.preview'), well, h('button.btn.primary', {
        type: 'button', text: t('agent.copy'),
        onclick: async () => { await navigator.clipboard.writeText(well.textContent); toast(t('common.copied')); },
      })));
  });
  return view.stop;
}
