/* Calculators. Each is a small table of inputs plus a pure function from core/calc.js. */
import { t } from '../core/i18n.js';
import { formatNumber, formatUnit, parseNumber } from '../core/format.js';
import * as C from '../core/calc.js';
import { h, segmented } from '../ui/dom.js';
import { fieldRow, readField } from '../ui/form.js';
import { pageWrap, panel } from './shared.js';

export const manifest = { id: 'calc', category: 'field', permissions: [], offline: true, name: { hu: 'Kalkulátorok', en: 'Calculators' } };

export const strings = {
  hu: {
    'calc.drop': 'Feszültségesés', 'calc.power': 'kW és A', 'calc.ohm': 'Ohm-törvény', 'calc.lux': 'Megvilágítás', 'calc.phases': 'Fázisterhelés', 'calc.led': 'LED-szalag',
    'calc.result': 'Eredmény', 'calc.missing': 'Add meg a hiányzó értékeket.',
    'calc.i.phases': 'Fázisok', 'calc.i.material': 'Anyag', 'calc.i.cu': 'Réz', 'calc.i.al': 'Alumínium', 'calc.i.length': 'Egyirányú hossz', 'calc.i.current': 'Áram',
    'calc.i.area': 'Keresztmetszet', 'calc.i.voltage': 'Feszültség', 'calc.i.cos': 'cos φ', 'calc.i.maxDrop': 'Megengedett esés', 'calc.i.power': 'Teljesítmény',
    'calc.i.resistance': 'Ellenállás', 'calc.i.lux': 'Célérték', 'calc.i.room': 'Alapterület', 'calc.i.lumen': 'Lámpatest fényárama', 'calc.i.uf': 'Hasznosítási tényező',
    'calc.i.mf': 'Karbantartási tényező', 'calc.i.wm': 'Teljesítmény méterenként', 'calc.i.metres': 'Hossz', 'calc.i.reserve': 'Tartalék',
    'calc.o.drop': 'Esés', 'calc.o.dropPct': 'Esés százalékban', 'calc.o.size': 'Javasolt keresztmetszet', 'calc.o.none': 'Egyik szabványos méret sem elég',
    'calc.o.current': 'Áram', 'calc.o.power': 'Teljesítmény', 'calc.o.fixtures': 'Lámpatestek száma', 'calc.o.mean': 'Átlag', 'calc.o.imbalance': 'Aszimmetria', 'calc.o.heaviest': 'Legterheltebb fázis',
    'calc.o.total': 'Összteljesítmény', 'calc.o.supply': 'Tápegység legalább',
    'calc.note.drop': 'Csak ohmos esést számol, a reaktanciát nem. A terhelhetőséget és a védelmet külön ellenőrizd.',
    'calc.note.power': 'Háromfázisnál a vonali feszültséggel számolj.', 'calc.note.ohm': 'Bármely két érték elég, a többit kiszámolja.',
    'calc.note.lux': 'Lumen-módszer, átlagos becslés. Tervhez fénytechnikai számítás kell.', 'calc.note.phases': 'Az aszimmetria a legnagyobb eltérés az átlagtól.',
    'calc.note.led': 'A vezeték feszültségesését külön nézd meg, főleg 12 V-on.',
  },
  en: {
    'calc.drop': 'Voltage drop', 'calc.power': 'kW and A', 'calc.ohm': 'Ohm\'s law', 'calc.lux': 'Lighting', 'calc.phases': 'Phase balance', 'calc.led': 'LED strip',
    'calc.result': 'Result', 'calc.missing': 'Enter the missing values.',
    'calc.i.phases': 'Phases', 'calc.i.material': 'Material', 'calc.i.cu': 'Copper', 'calc.i.al': 'Aluminium', 'calc.i.length': 'One-way length', 'calc.i.current': 'Current',
    'calc.i.area': 'Cross-section', 'calc.i.voltage': 'Voltage', 'calc.i.cos': 'cos φ', 'calc.i.maxDrop': 'Allowed drop', 'calc.i.power': 'Power',
    'calc.i.resistance': 'Resistance', 'calc.i.lux': 'Target', 'calc.i.room': 'Floor area', 'calc.i.lumen': 'Luminaire output', 'calc.i.uf': 'Utilisation factor',
    'calc.i.mf': 'Maintenance factor', 'calc.i.wm': 'Power per metre', 'calc.i.metres': 'Length', 'calc.i.reserve': 'Reserve',
    'calc.o.drop': 'Drop', 'calc.o.dropPct': 'Drop in percent', 'calc.o.size': 'Suggested cross-section', 'calc.o.none': 'No standard size is enough',
    'calc.o.current': 'Current', 'calc.o.power': 'Power', 'calc.o.fixtures': 'Luminaires', 'calc.o.mean': 'Mean', 'calc.o.imbalance': 'Imbalance', 'calc.o.heaviest': 'Heaviest phase',
    'calc.o.total': 'Total power', 'calc.o.supply': 'Supply at least',
    'calc.note.drop': 'Resistive drop only, reactance is left out. Check current capacity and protection separately.',
    'calc.note.power': 'For three-phase, use the line voltage.', 'calc.note.ohm': 'Any two values are enough; it works out the rest.',
    'calc.note.lux': 'Lumen method, an average estimate. A design needs a lighting calculation.', 'calc.note.phases': 'Imbalance is the largest deviation from the mean.',
    'calc.note.led': 'Check the cable voltage drop separately, especially at 12 V.',
  },
};

const n = (key, labelKey, unit, def) => ({ key, label: t(labelKey), unit, type: 'number', def });
const phases = () => ({ key: 'phases', label: t('calc.i.phases'), type: 'select', options: [{ value: '1', label: '1' }, { value: '3', label: '3' }], def: '1' });

const row = (label, text) => ({ label: t(label), text });

const CALCS = {
  drop: {
    inputs: () => [phases(),
      { key: 'material', label: t('calc.i.material'), type: 'select', options: [{ value: 'cu', label: t('calc.i.cu') }, { value: 'al', label: t('calc.i.al') }], def: 'cu' },
      n('length', 'calc.i.length', 'm'), n('current', 'calc.i.current', 'A'), n('area', 'calc.i.area', 'mm²'),
      n('voltage', 'calc.i.voltage', 'V', 230), n('cosPhi', 'calc.i.cos', '', 1), n('maxPercent', 'calc.i.maxDrop', '%', 3)],
    need: ['length', 'current', 'voltage', 'cosPhi'],
    run: (v) => {
      const load = { phases: +v.phases, material: v.material, length: v.length, current: v.current, voltage: v.voltage, cosPhi: v.cosPhi };
      const out = [];
      if (v.area) {
        const d = C.voltageDrop({ ...load, area: v.area });
        out.push(row('calc.o.drop', formatUnit(d.volts, 'V', 2)), row('calc.o.dropPct', formatUnit(d.percent, '%', 2)));
      }
      if (v.maxPercent) {
        const size = C.sizeForDrop({ ...load, maxPercent: v.maxPercent });
        out.push(row('calc.o.size', size ? formatUnit(size, 'mm²') : t('calc.o.none')));
      }
      return out;
    },
  },
  power: {
    inputs: () => [phases(), n('kw', 'calc.i.power', 'kW'), n('amps', 'calc.i.current', 'A'), n('voltage', 'calc.i.voltage', 'V', 230), n('cosPhi', 'calc.i.cos', '', 1)],
    need: ['voltage', 'cosPhi'],
    run: (v) => {
      const base = { phases: +v.phases, voltage: v.voltage, cosPhi: v.cosPhi };
      const out = [];
      if (v.kw != null) out.push(row('calc.o.current', formatUnit(C.ampsFromKw({ ...base, kw: v.kw }), 'A', 2)));
      if (v.amps != null) out.push(row('calc.o.power', formatUnit(C.kwFromAmps({ ...base, amps: v.amps }), 'kW', 2)));
      return out;
    },
  },
  ohm: {
    inputs: () => [n('u', 'calc.i.voltage', 'V'), n('i', 'calc.i.current', 'A'), n('r', 'calc.i.resistance', 'Ω'), n('p', 'calc.i.power', 'W')],
    need: [],
    run: (v) => {
      const r = C.ohm(v);
      return r ? [row('calc.i.voltage', formatUnit(r.u, 'V', 2)), row('calc.i.current', formatUnit(r.i, 'A', 3)), row('calc.i.resistance', formatUnit(r.r, 'Ω', 2)), row('calc.i.power', formatUnit(r.p, 'W', 1))] : [];
    },
  },
  lux: {
    inputs: () => [n('lux', 'calc.i.lux', 'lx', 300), n('area', 'calc.i.room', 'm²'), n('lumens', 'calc.i.lumen', 'lm'), n('utilisation', 'calc.i.uf', '', 0.6), n('maintenance', 'calc.i.mf', '', 0.8)],
    need: ['lux', 'area', 'lumens', 'utilisation', 'maintenance'],
    run: (v) => [row('calc.o.fixtures', formatNumber(C.luminaires(v).count))],
  },
  phases: {
    inputs: () => [n('l1', 'L1', 'A'), n('l2', 'L2', 'A'), n('l3', 'L3', 'A')],
    need: ['l1', 'l2', 'l3'],
    run: (v) => {
      const r = C.phaseBalance(v);
      return [row('calc.o.mean', formatUnit(r.mean, 'A', 1)), row('calc.o.imbalance', formatUnit(r.imbalance, '%', 1)), row('calc.o.heaviest', 'L' + r.heaviest)];
    },
  },
  led: {
    inputs: () => [n('wattsPerMetre', 'calc.i.wm', 'W/m'), n('metres', 'calc.i.metres', 'm'), n('voltage', 'calc.i.voltage', 'V', 24), n('reservePct', 'calc.i.reserve', '%', 20)],
    need: ['wattsPerMetre', 'metres', 'voltage', 'reservePct'],
    run: (v) => {
      const r = C.ledSizing(v);
      return [row('calc.o.total', formatUnit(r.watts, 'W', 1)), row('calc.o.current', formatUnit(r.amps, 'A', 2)), row('calc.o.supply', formatUnit(r.supplyWatts, 'W', 1))];
    },
  },
};

export function mount(root) {
  let which = 'drop';
  const body = h('div');
  const draw = () => {
    const calc = CALCS[which];
    const inputs = calc.inputs();
    const form = h('div.form');
    const output = h('div.results');
    const update = () => {
      const v = Object.fromEntries(inputs.map((f) => [f.key, readField(f, form)]));
      const ready = calc.need.every((k) => v[k] != null);
      const rows = ready ? calc.run(v) : [];
      output.replaceChildren(...(rows.length
        ? rows.map((r) => h('div.result', {}, h('span.k', { text: r.label }), h('b', { text: r.text })))
        : [h('p.hint', { text: t('calc.missing') })]));
    };
    form.append(...inputs.map((f) => fieldRow(f, f.def, update)));
    body.replaceChildren(pageWrap(
      panel(t('calc.' + which), form),
      panel(t('calc.result'), output, h('p.hint', { text: t('calc.note.' + which) }))));
    update();
  };
  root.append(
    h('div.wrap', {}, segmented(Object.keys(CALCS).map((k) => ({ value: k, label: t('calc.' + k) })), which, (v) => { which = v; draw(); })),
    body);
  draw();
}
