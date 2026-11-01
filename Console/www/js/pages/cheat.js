/* Cheat sheets: own words with clause references only, no standard text or tables (L5). */
import { t } from '../core/i18n.js';
import { h } from '../ui/dom.js';
import { pageWrap, panel } from './shared.js';

export const manifest = { id: 'cheat', category: 'field', permissions: [], offline: true, name: { hu: 'Szakmai puskák', en: 'Cheat sheets' } };

const SHEETS = { colours: 5, curves: 3, rcd: 4, power: 3, ip: 5 };

export const strings = {
  hu: {
    'cheat.note': 'Saját szavakkal írt emlékeztető, nem szabványszöveg. Tervezéshez az MSZ HD 60364 érvényes kiadását és a gyártói adatokat nézd.',
    'cheat.colours': 'Érszínek', 'cheat.colours.1': 'L1: barna', 'cheat.colours.2': 'L2: fekete', 'cheat.colours.3': 'L3: szürke', 'cheat.colours.4': 'N: kék', 'cheat.colours.5': 'PE: zöld-sárga',
    'cheat.curves': 'Kismegszakító-karakterisztikák', 'cheat.curves.1': 'B: 3–5 × In, ohmos terhelés, hosszú vezeték', 'cheat.curves.2': 'C: 5–10 × In, motorok, lámpacsoportok', 'cheat.curves.3': 'D: 10–20 × In, nagy bekapcsolási áram',
    'cheat.rcd': 'ÁVK-típusok', 'cheat.rcd.1': 'AC: csak szinuszos váltakozó hibaáram', 'cheat.rcd.2': 'A: váltakozó és lüktető egyenáramú hibaáram', 'cheat.rcd.3': 'F: mint az A, plusz vegyes frekvencia, egyfázisú hajtásokhoz', 'cheat.rcd.4': 'B: mint az F, plusz sima egyenáram, töltőkhöz, napelemhez, háromfázisú hajtásokhoz',
    'cheat.power': 'Teljesítmény', 'cheat.power.1': '1 fázis: P = U · I · cos φ', 'cheat.power.2': '3 fázis: P = √3 · U · I · cos φ', 'cheat.power.3': 'Ohm: U = I · R',
    'cheat.ip': 'Gyakori IP-védettségek', 'cheat.ip.1': 'IP20: ujj ellen véd, száraz beltérbe', 'cheat.ip.2': 'IP44: fröccsenő víz ellen, fürdőszoba külső zónáihoz', 'cheat.ip.3': 'IP55: por és vízsugár ellen, kültéri kötődobozhoz', 'cheat.ip.4': 'IP65: porzáró, vízsugár ellen', 'cheat.ip.5': 'IP67: porzáró, rövid ideig víz alatt is',
  },
  en: {
    'cheat.note': 'A reminder in our own words, not standard text. For design, use the current edition of MSZ HD 60364 and the manufacturer\'s data.',
    'cheat.colours': 'Conductor colours', 'cheat.colours.1': 'L1: brown', 'cheat.colours.2': 'L2: black', 'cheat.colours.3': 'L3: grey', 'cheat.colours.4': 'N: blue', 'cheat.colours.5': 'PE: green-yellow',
    'cheat.curves': 'MCB trip curves', 'cheat.curves.1': 'B: 3–5 × In, resistive loads, long runs', 'cheat.curves.2': 'C: 5–10 × In, motors, lighting groups', 'cheat.curves.3': 'D: 10–20 × In, high inrush',
    'cheat.rcd': 'RCD types', 'cheat.rcd.1': 'AC: sinusoidal AC fault current only', 'cheat.rcd.2': 'A: AC and pulsating DC', 'cheat.rcd.3': 'F: as A, plus mixed frequency, for single-phase drives', 'cheat.rcd.4': 'B: as F, plus smooth DC, for chargers, PV and three-phase drives',
    'cheat.power': 'Power', 'cheat.power.1': '1-phase: P = U · I · cos φ', 'cheat.power.2': '3-phase: P = √3 · U · I · cos φ', 'cheat.power.3': 'Ohm: U = I · R',
    'cheat.ip': 'Common IP ratings', 'cheat.ip.1': 'IP20: finger-safe, dry indoors', 'cheat.ip.2': 'IP44: splash-proof, outer bathroom zones', 'cheat.ip.3': 'IP55: dust and water jets, outdoor junction boxes', 'cheat.ip.4': 'IP65: dust-tight, water jets', 'cheat.ip.5': 'IP67: dust-tight, brief immersion',
  },
};

export function mount(root) {
  root.append(pageWrap(
    ...Object.entries(SHEETS).map(([id, count]) => panel(t('cheat.' + id),
      h('ul.plain', {}, Array.from({ length: count }, (_, i) => h('li', { text: t(`cheat.${id}.${i + 1}`) }))))),
    h('p.hint', { text: t('cheat.note') })));
}
