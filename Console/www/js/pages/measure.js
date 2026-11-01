/* Measurement log: readings per circuit, checked against the user's own limit table, which starts
   empty. Status describes a reading against that table; the rating stays the user's act (L6). */
import { t } from '../core/i18n.js';
import { formatDate, formatNumber } from '../core/format.js';
import { checkReading } from '../core/limits.js';
import { h } from '../ui/dom.js';
import { recordSheet } from '../ui/form.js';
import { activeJob, addButton, deleteWithUndo, downloadCsv, guide, jobBar, listRow, liveRender, pageWrap, panel, statusChip } from './shared.js';

export const manifest = { id: 'measure', category: 'field', permissions: [], offline: true, name: { hu: 'Mérési napló', en: 'Measurement log' } };

export const strings = {
  hu: {
    'measure.readings': 'Mérések', 'measure.add': 'Új mérés', 'measure.edit': 'Mérés szerkesztése',
    'measure.none': 'Még nincs mérés. Add meg az első áramkört.',
    'measure.kpi': '{n} áramkör, {bad} határon kívül',
    'measure.limits': 'Saját határértéktábla', 'measure.limitAdd': 'Új sor', 'measure.limitEdit': 'Határérték szerkesztése',
    'measure.limitsNone': 'A tábla üres. Add meg a saját határértékeidet, és a mérések ellenőrzése azonnal működik.',
    'measure.legal': 'Az ellenőrzés csak a saját táblád szerint hasonlít. A minősítés és az aláírás mindig a te döntésed.',
    'measure.instrument': 'Műszer', 'measure.instrumentEdit': 'Műszer adatai', 'measure.instrumentNone': 'Nincs megadva műszer.',
    'measure.calWhen': 'kalibrálva: {date}',
    'measure.f.circuit': 'Áramkör', 'measure.f.limit': 'Határérték', 'measure.f.noLimit': 'Nincs',
    'measure.f.ir': 'Szigetelési ellenállás', 'measure.f.r1r2': 'R1+R2', 'measure.f.zs': 'Hurokimpedancia, Zs',
    'measure.f.pfc': 'Zárlati áram', 'measure.f.rcdMs': 'ÁVK kioldási idő', 'measure.f.rcdMa': 'ÁVK kioldóáram',
    'measure.f.polarity': 'Polaritás', 'measure.f.earth': 'Földelési ellenállás', 'measure.f.note': 'Megjegyzés',
    'measure.pol.none': 'Nem mért', 'measure.pol.ok': 'Helyes', 'measure.pol.bad': 'Hibás',
    'measure.l.name': 'Megnevezés, például B16 ÁVK-val', 'measure.l.zsMax': 'Zs legfeljebb', 'measure.l.irMin': 'Szigetelés legalább',
    'measure.l.rcdMax': 'ÁVK idő legfeljebb', 'measure.l.margin': 'Figyelmeztetési sáv', 'measure.l.ref': 'Szabványhivatkozás',
    'measure.i.serial': 'Műszer sorozatszáma', 'measure.i.cal': 'Kalibrálás dátuma',
  },
  en: {
    'measure.readings': 'Readings', 'measure.add': 'New reading', 'measure.edit': 'Edit reading',
    'measure.none': 'No readings yet. Enter the first circuit.',
    'measure.kpi': '{n} circuits, {bad} out of limit',
    'measure.limits': 'My limit table', 'measure.limitAdd': 'New row', 'measure.limitEdit': 'Edit limit',
    'measure.limitsNone': 'The table is empty. Enter your own limits and reading checks start working at once.',
    'measure.legal': 'The check only compares against your own table. The rating and signature are always your decision.',
    'measure.instrument': 'Instrument', 'measure.instrumentEdit': 'Instrument details', 'measure.instrumentNone': 'No instrument entered.',
    'measure.calWhen': 'calibrated: {date}',
    'measure.f.circuit': 'Circuit', 'measure.f.limit': 'Limit', 'measure.f.noLimit': 'None',
    'measure.f.ir': 'Insulation resistance', 'measure.f.r1r2': 'R1+R2', 'measure.f.zs': 'Loop impedance, Zs',
    'measure.f.pfc': 'Fault current', 'measure.f.rcdMs': 'RCD trip time', 'measure.f.rcdMa': 'RCD trip current',
    'measure.f.polarity': 'Polarity', 'measure.f.earth': 'Earth resistance', 'measure.f.note': 'Note',
    'measure.pol.none': 'Not measured', 'measure.pol.ok': 'Correct', 'measure.pol.bad': 'Wrong',
    'measure.l.name': 'Name, for example B16 with RCD', 'measure.l.zsMax': 'Zs at most', 'measure.l.irMin': 'Insulation at least',
    'measure.l.rcdMax': 'RCD time at most', 'measure.l.margin': 'Warning band', 'measure.l.ref': 'Standard reference',
    'measure.i.serial': 'Instrument serial', 'measure.i.cal': 'Calibration date',
  },
};

const readingFields = (limits, ways) => [
  { key: 'circuit', label: t('measure.f.circuit'), suggest: ways },
  { key: 'limitId', label: t('measure.f.limit'), type: 'select', options: [{ value: '', label: t('measure.f.noLimit') }, ...limits.map((l) => ({ value: l.id, label: l.name }))] },
  { key: 'zs', label: t('measure.f.zs'), type: 'number', unit: 'Ω' },
  { key: 'ir', label: t('measure.f.ir'), type: 'number', unit: 'MΩ' },
  { key: 'r1r2', label: t('measure.f.r1r2'), type: 'number', unit: 'Ω' },
  { key: 'pfc', label: t('measure.f.pfc'), type: 'number', unit: 'kA' },
  { key: 'rcdMs', label: t('measure.f.rcdMs'), type: 'number', unit: 'ms' },
  { key: 'rcdMa', label: t('measure.f.rcdMa'), type: 'number', unit: 'mA' },
  { key: 'earth', label: t('measure.f.earth'), type: 'number', unit: 'Ω' },
  { key: 'polarity', label: t('measure.f.polarity'), type: 'select', options: ['none', 'ok', 'bad'].map((v) => ({ value: v, label: t('measure.pol.' + v) })) },
  { key: 'note', label: t('measure.f.note'), type: 'textarea' },
];

const limitFields = () => [
  { key: 'name', label: t('measure.l.name') },
  { key: 'zsMax', label: t('measure.l.zsMax'), type: 'number', unit: 'Ω' },
  { key: 'irMin', label: t('measure.l.irMin'), type: 'number', unit: 'MΩ' },
  { key: 'rcdMaxMs', label: t('measure.l.rcdMax'), type: 'number', unit: 'ms' },
  { key: 'marginPct', label: t('measure.l.margin'), type: 'number', unit: '%' },
  { key: 'ref', label: t('measure.l.ref') },
];

const summary = (r) => [
  r.zs != null ? `Zs ${formatNumber(r.zs)} Ω` : null,
  r.ir != null ? `IR ${formatNumber(r.ir)} MΩ` : null,
  r.rcdMs != null ? `${formatNumber(r.rcdMs)} ms` : null,
].filter(Boolean).join(' · ');

export function mount(root, ctx) {
  const view = liveRender(root, ctx, async () => {
    const job = await activeJob(ctx);
    const limits = await ctx.db.list('limit');
    const limitOf = (r) => limits.find((l) => l.id === r.limitId);
    const readings = job ? await ctx.db.list('measure', (r) => r.jobId === job.id) : [];
    const ways = job ? (await ctx.db.list('panel', (r) => r.jobId === job.id)).map((w) => w.label).filter(Boolean) : [];
    const checks = new Map(readings.map((r) => [r.id, checkReading(r, limitOf(r)).overall]));
    const bad = [...checks.values()].filter((s) => s === 'fail').length;

    const editReading = (r) => recordSheet({
      title: t(r ? 'measure.edit' : 'measure.add'),
      fields: readingFields(limits, ways),
      value: r ?? { polarity: 'none' },
      live: (v) => statusChip(checkReading(v, limits.find((l) => l.id === v.limitId)).overall),
      onSave: async (v) => { await ctx.db.put('measure', { ...v, jobId: job.id }); await view.refresh(); },
      onDelete: r ? () => deleteWithUndo(ctx, 'measure', r, r.circuit || t('measure.f.circuit'), view.refresh) : null,
    });
    const editLimit = (l) => recordSheet({
      title: t('measure.limitEdit'), fields: limitFields(), value: l ?? {},
      onSave: async (v) => { await ctx.db.put('limit', v); await view.refresh(); },
      onDelete: l ? () => deleteWithUndo(ctx, 'limit', l, l.name || t('measure.limitEdit'), view.refresh) : null,
    });
    const editInstrument = () => recordSheet({
      title: t('measure.instrumentEdit'),
      fields: [{ key: 'serial', label: t('measure.i.serial') }, { key: 'calDate', label: t('measure.i.cal'), type: 'date' }],
      value: job.instrument ?? {},
      onSave: async (v) => { await ctx.db.put('job', { ...job, instrument: { serial: v.serial, calDate: v.calDate } }); await view.refresh(); },
    });
    const exportCsv = () => downloadCsv(`meresek-${job.id}.csv`,
      ['circuit', 'Zs (Ω)', 'IR (MΩ)', 'R1+R2 (Ω)', 'PFC (kA)', 'RCD (ms)', 'RCD (mA)', 'earth (Ω)', 'polarity', 'note'],
      readings.map((r) => [r.circuit, r.zs, r.ir, r.r1r2, r.pfc, r.rcdMs, r.rcdMa, r.earth, r.polarity, r.note]));

    const inst = job?.instrument;
    return pageWrap(
      jobBar(job, ctx),
      job && panel(t('measure.readings'),
        readings.length ? h('div.kpi', {}, h('b', { text: t('measure.kpi', { n: formatNumber(readings.length), bad: formatNumber(bad) }) })) : guide(t('measure.none')),
        readings.map((r) => listRow({ title: r.circuit || '—', sub: summary(r), chip: statusChip(checks.get(r.id)), onclick: () => editReading(r) })),
        h('div.btn-row', {},
          addButton(t('measure.add'), () => editReading(null)),
          readings.length ? addButton(t('common.exportCsv'), exportCsv) : null),
        h('p.hint', { text: t('measure.legal') })),
      job && panel(t('measure.instrument'),
        h('p', { text: inst?.serial ? [inst.serial, inst.calDate ? t('measure.calWhen', { date: formatDate(new Date(inst.calDate)) }) : null].filter(Boolean).join(' · ') : t('measure.instrumentNone') }),
        addButton(t('common.edit'), editInstrument)),
      panel(t('measure.limits'),
        limits.length ? limits.map((l) => listRow({
          title: l.name || '—',
          sub: [l.zsMax != null ? `Zs ≤ ${formatNumber(l.zsMax)} Ω` : null, l.irMin != null ? `IR ≥ ${formatNumber(l.irMin)} MΩ` : null, l.rcdMaxMs != null ? `≤ ${formatNumber(l.rcdMaxMs)} ms` : null, l.ref].filter(Boolean).join(' · '),
          onclick: () => editLimit(l),
        })) : guide(t('measure.limitsNone')),
        addButton(t('measure.limitAdd'), () => editLimit(null))));
  });
  return view.stop;
}
