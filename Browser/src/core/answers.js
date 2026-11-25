// answers.js — Gyorsválasz: answers that appear in the omnibox before any page loads. A safe arithmetic parser (no eval),
// the electrician's everyday formulas (P = U·I·cosφ, the three-phase forms, Ohm's law, voltage drop), AWG ↔ mm² and a few
// unit conversions. Pure: no DOM. Every answer is indicative: the design follows the standards and the datasheets.
//   VB.answers.answer('230V 16A') → { kind, title, value, lines: [..], copy } | null
//   VB.answers.calc('2*(3+4)')    → number (throws on a bad expression)      VB.answers.fmt(3680.5) → '3 680,5'
(function (root) {
  'use strict';
  const VB = root.VB = root.VB || {};
  if (VB.answers) return;

  const SQRT3 = Math.sqrt(3);
  const GAMMA = { cu: 56, al: 35 };                         // conductivity, m / (Ω·mm²), ~20 °C
  const NBSP = ' ';

  function fmt(n, digits) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    const a = Math.abs(n);
    if (a !== 0 && (a >= 1e9 || a < 1e-4)) return n.toExponential(3).replace('.', ',');
    const d = digits != null ? digits : a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 3 : 4;
    const s0 = (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
    const t = s0.includes('.') ? s0.replace(/\.?0+$/, '') : s0;
    const [i, f] = t.split('.');
    const neg = i.startsWith('-');
    const g = (neg ? i.slice(1) : i).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
    return (neg ? '−' : '') + g + (f ? ',' + f : '');
  }

  // ------------------------------------------------------------ the calculator
  const FUNCS = {
    sqrt: Math.sqrt, gyok: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10, lg: Math.log10, exp: Math.exp,
    round: Math.round, kerekit: Math.round, floor: Math.floor, ceil: Math.ceil,
    sin: d => Math.sin(d * Math.PI / 180), cos: d => Math.cos(d * Math.PI / 180), tan: d => Math.tan(d * Math.PI / 180),
    asin: x => Math.asin(x) * 180 / Math.PI, acos: x => Math.acos(x) * 180 / Math.PI, atan: x => Math.atan(x) * 180 / Math.PI,
  };
  const CONSTS = { pi: Math.PI, 'π': Math.PI, e: Math.E, gyok3: SQRT3 };
  function lex(s) {
    const out = [];
    let i = 0;
    s = String(s).replace(/[×·∙]/g, '*').replace(/[÷:]/g, '/').replace(/[−–]/g, '-').replace(/\*\*/g, '^');
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      const num = /^(\d+(?:[.,]\d+)?|[.,]\d+)/.exec(s.slice(i));
      if (num) { out.push({ t: 'n', v: parseFloat(num[1].replace(',', '.')) }); i += num[1].length; continue; }
      const id = /^([a-zπ][a-z0-9]*)/i.exec(s.slice(i));
      if (id) { out.push({ t: 'id', v: id[1].toLowerCase() }); i += id[1].length; continue; }
      if ('+-*/^%()√'.includes(c)) { out.push({ t: c }); i++; continue; }
      throw new Error('bad char ' + c);
    }
    return out;
  }
  function calc(src) {
    const tk = lex(src);
    if (tk.length > 200) throw new Error('too long');
    let p = 0;
    const peek = () => tk[p] && tk[p].t, eat = t => { if (peek() !== t) throw new Error('expected ' + t); p++; };
    function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const o = tk[p++].t; const r = term(); v = o === '+' ? v + r : v - r; } return v; }
    function term() { let v = power(); while (peek() === '*' || peek() === '/') { const o = tk[p++].t; const r = power(); v = o === '*' ? v * r : v / r; } return v; }
    function power() { const b = unary(); if (peek() === '^') { p++; return Math.pow(b, power()); } return b; }
    function unary() { if (peek() === '-') { p++; return -unary(); } if (peek() === '+') { p++; return unary(); } return postfix(); }
    function postfix() { let v = primary(); while (peek() === '%') { p++; v = v / 100; } return v; }
    function primary() {
      const k = tk[p];
      if (!k) throw new Error('unexpected end');
      if (k.t === 'n') { p++; return k.v; }
      if (k.t === '(') { p++; const v = expr(); eat(')'); return v; }
      if (k.t === '√') { p++; return Math.sqrt(primary()); }
      if (k.t === 'id') {
        p++;
        if (FUNCS[k.v]) { eat('('); const v = expr(); eat(')'); return FUNCS[k.v](v); }
        if (k.v in CONSTS) return CONSTS[k.v];
        throw new Error('unknown ' + k.v);
      }
      throw new Error('unexpected ' + k.t);
    }
    const v = expr();
    if (p !== tk.length) throw new Error('trailing input');
    return v;
  }
  // does the line look like arithmetic (and not like a phone number or a bare number)?
  function looksLikeMath(s) {
    if (!/^[\d\s.,+\-*/^%()×·÷√π−–a-z]*$/i.test(s)) return false;
    if (/[a-z]/i.test(s.replace(/\b(sqrt|gyok|abs|ln|log|lg|exp|round|kerekit|floor|ceil|sin|cos|tan|asin|acos|atan|pi|e|gyok3)\b/gi, ''))) return false;
    return /\d/.test(s) && /[+\-*/^%×·÷√(]/.test(s.replace(/^[-−]/, '')) && !/^\+?\d[\d\s-]{7,}$/.test(s.trim());
  }

  // ------------------------------------------------------------ quantities in a line ("3x400V 10kW cos 0,9 2,5mm2 30m")
  const NUM = '(\\d+(?:[.,]\\d+)?)';
  const num = s => parseFloat(String(s).replace(',', '.'));
  function quantities(line) {
    let s = ' ' + String(line).toLowerCase().replace(/[²]/g, '2').replace(/Ω|ω/g, 'ohm').replace(/φ/g, 'fi')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ') + ' ';            // accents off: \b is ASCII-only
    const q = {};
    const take = (re, f) => { s = s.replace(re, (...m) => { f(m); return ' '; }); };
    take(/cos\s*(?:fi|phi)?\s*=?\s*(0?[.,]\d+|1(?:[.,]0+)?)/, m => { q.cos = num(m[1].replace(/^[.,]/, '0.')); });
    take(new RegExp(NUM + '\\s*mm\\s*\\^?2'), m => { q.A = num(m[1]); });
    take(/\b(1|3)\s*(?:f|fazis|fazisu|ph\b|~)/, m => { q.phases = +m[1]; });
    take(/\bharom\s*fazis\w*/, () => { q.phases = 3; });
    take(/\begy\s*fazis\w*/, () => { q.phases = 1; });
    take(/\b(al|alu|aluminium)\b/, () => { q.mat = 'al'; });
    take(/\b(cu|rez)\b/, () => { q.mat = 'cu'; });
    take(new RegExp('\\b3\\s*x\\s*' + NUM + '\\s*(k)?v\\b'), m => { q.U = num(m[1]) * (m[2] ? 1000 : 1); q.phases = q.phases || 3; });
    take(new RegExp(NUM + '\\s*(k|m)?ohm'), m => { q.R = num(m[1]) * (m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e-3 : 1); });
    take(new RegExp(NUM + '\\s*(k)?va\\b'), m => { q.S = num(m[1]) * (m[2] ? 1000 : 1); });
    take(new RegExp(NUM + '\\s*(k|m)?w\\b'), m => { q.P = num(m[1]) * (m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : 1); });
    take(new RegExp(NUM + '\\s*(k)?v\\b'), m => { q.U = num(m[1]) * (m[2] ? 1000 : 1); });
    take(new RegExp(NUM + '\\s*(m)?a\\b'), m => { q.I = num(m[1]) * (m[2] ? 1e-3 : 1); });
    take(new RegExp(NUM + '\\s*(k)?m\\b'), m => { q.L = num(m[1]) * (m[2] ? 1000 : 1); });
    q.rest = s.replace(/\b(feszultsegeses|eses|du|teljesitmeny|aram|aramerosseg|kabel|vezetek|mennyi|es|meg|with)\b/g, ' ').trim();
    return q;
  }

  function electrical(line) {
    const q = quantities(line);
    if (q.rest && /[a-z]{3,}/.test(q.rest)) return null;          // words we do not know: this is a search, not a formula
    const cos = q.cos != null ? q.cos : 1;
    const three = q.phases === 3 || (q.phases !== 1 && q.U >= 380);
    const k = three ? SQRT3 : 1;
    const phase = three ? '3 fázis' : '1 fázis';
    const cosTxt = q.cos != null ? ', cos φ = ' + fmt(cos, 2) : '';
    const W = p => (Math.abs(p) >= 1000 ? fmt(p / 1000) + ' kW' : fmt(p) + ' W');
    const note = 'Tájékoztató számítás; a méretezést a vonatkozó szabvány és az adatlap dönti el.';

    if (q.A && q.L && (q.I || q.P)) {
      const U = q.U || (three ? 400 : 230);
      const I = q.I || q.P / (k * U * cos);
      const g = GAMMA[q.mat || 'cu'];
      const dU = (three ? SQRT3 : 2) * q.L * I * cos / (g * q.A);
      const pct = dU / U * 100;
      return {
        kind: 'drop', title: 'Feszültségesés', value: fmt(dU, 2) + ' V · ' + fmt(pct, 2) + ' %',
        lines: [phase + ', ' + fmt(U, 0) + ' V, ' + fmt(I, 2) + ' A' + cosTxt + ', ' + fmt(q.L, 1) + ' m, ' + fmt(q.A, 2) + ' mm² ' + (q.mat === 'al' ? 'Al' : 'Cu') + ' (γ = ' + g + ')',
          'ΔU = ' + (three ? '√3' : '2') + ' · L · I · cos φ / (γ · A)',
          'Irányérték: világítás 3 %, egyéb fogyasztó 5 % (MSZ HD 60364-5-52, G.52.1).', note],
        warn: pct > 5 ? 'Az esés 5 % fölött van.' : pct > 3 ? 'Világításnál a 3 % fölött van.' : '',
        copy: fmt(dU, 2) + ' V (' + fmt(pct, 2) + ' %)',
      };
    }
    if (q.U && q.I && !q.P && !q.R) {
      const P = k * q.U * q.I * cos;
      return { kind: 'power', title: 'Teljesítmény', value: W(P),
        lines: [phase + ': P = ' + (three ? '√3 · ' : '') + 'U · I' + (q.cos != null ? ' · cos φ' : '') + ' = ' + (three ? '√3 · ' : '') + fmt(q.U, 0) + ' V · ' + fmt(q.I, 2) + ' A' + (q.cos != null ? ' · ' + fmt(cos, 2) : ''),
          'Látszólagos: ' + fmt(k * q.U * q.I / 1000, 3) + ' kVA', note], copy: W(P) };
    }
    if ((q.P || q.S) && q.U && !q.I && !q.R) {
      const I = q.S ? q.S / (k * q.U) : q.P / (k * q.U * cos);
      return { kind: 'current', title: 'Áramerősség', value: fmt(I, 2) + ' A',
        lines: [phase + ': I = ' + (q.S ? 'S / (' + (three ? '√3 · ' : '') + 'U)' : 'P / (' + (three ? '√3 · ' : '') + 'U' + (q.cos != null ? ' · cos φ' : '') + ')') + ' = ' + (q.S ? fmt(q.S, 0) + ' VA' : W(q.P)) + ' / ' + fmt(q.U, 0) + ' V' + cosTxt,
          q.cos == null && !q.S ? 'cos φ = 1-gyel számolva; motornál add meg (pl. cos 0,85).' : '', note].filter(Boolean), copy: fmt(I, 2) + ' A' };
    }
    if (q.U && q.R && !q.I && !q.P) {
      const I = q.U / q.R;
      return { kind: 'ohm', title: 'Ohm-törvény', value: fmt(I, 3) + ' A', lines: ['I = U / R = ' + fmt(q.U) + ' V / ' + fmt(q.R) + ' Ω', 'P = U² / R = ' + W(q.U * q.U / q.R)], copy: fmt(I, 3) + ' A' };
    }
    if (q.I && q.R && !q.U && !q.P) {
      const U = q.I * q.R;
      return { kind: 'ohm', title: 'Ohm-törvény', value: fmt(U, 3) + ' V', lines: ['U = I · R = ' + fmt(q.I) + ' A · ' + fmt(q.R) + ' Ω', 'P = I² · R = ' + W(q.I * q.I * q.R)], copy: fmt(U, 3) + ' V' };
    }
    if (q.P && q.I && !q.U && !q.R) {
      const U = q.P / (k * q.I * cos);
      return { kind: 'ohm', title: 'Feszültség', value: fmt(U, 1) + ' V', lines: [phase + ': U = P / (' + (three ? '√3 · ' : '') + 'I' + (q.cos != null ? ' · cos φ' : '') + ')'], copy: fmt(U, 1) + ' V' };
    }
    return null;
  }

  // ------------------------------------------------------------ AWG and unit conversion
  const awgToMm2 = n => { const d = 0.127 * Math.pow(92, (36 - n) / 39); return Math.PI / 4 * d * d; };
  function mm2ToAwg(a) {
    let best = null;
    for (let n = -3; n <= 40; n++) { const d = Math.abs(awgToMm2(n) - a); if (!best || d < best.d) best = { n, d }; }
    return best.n;
  }
  const awgName = n => (n <= 0 ? (1 - n) + '/0' : String(n));
  const UNITS = {
    mm: ['len', 0.001], cm: ['len', 0.01], m: ['len', 1], km: ['len', 1000], in: ['len', 0.0254], inch: ['len', 0.0254], col: ['len', 0.0254],
    huvelyk: ['len', 0.0254], 'hüvelyk': ['len', 0.0254], ft: ['len', 0.3048], lab: ['len', 0.3048], 'láb': ['len', 0.3048],
    w: ['pow', 1], kw: ['pow', 1000], le: ['pow', 735.49875], hp: ['pow', 745.69987],
    mm2: ['area', 1e-6], cm2: ['area', 1e-4], m2: ['area', 1],
    wh: ['en', 1], kwh: ['en', 1000], mj: ['en', 1e6 / 3600],
    c: ['tmp'], '°c': ['tmp'], f: ['tmp'], '°f': ['tmp'], k: ['tmp'],
  };
  const LABEL = { mm: 'mm', cm: 'cm', m: 'm', km: 'km', in: 'in', inch: 'in', col: 'col', huvelyk: 'hüvelyk', 'hüvelyk': 'hüvelyk', ft: 'ft', lab: 'láb', 'láb': 'láb',
    w: 'W', kw: 'kW', le: 'LE', hp: 'hp', mm2: 'mm²', cm2: 'cm²', m2: 'm²', wh: 'Wh', kwh: 'kWh', mj: 'MJ', c: '°C', '°c': '°C', f: '°F', '°f': '°F', k: 'K' };
  function convert(line) {
    const s = String(line).toLowerCase().replace(/²/g, '2').trim();
    const awg = /^(\d{1,2}|[1-4]\/0)\s*awg$/.exec(s);
    if (awg) {
      const n = awg[1].includes('/') ? 1 - parseInt(awg[1], 10) : parseInt(awg[1], 10);
      const a = awgToMm2(n);
      return { kind: 'awg', title: 'AWG → mm²', value: fmt(a, 3) + ' mm²', lines: ['AWG ' + awgName(n) + ': átmérő ' + fmt(0.127 * Math.pow(92, (36 - n) / 39), 3) + ' mm', 'A legközelebbi szabványos metrikus keresztmetszetet válaszd felfelé.'], copy: fmt(a, 3) + ' mm²' };
    }
    const toAwg = new RegExp('^' + NUM + '\\s*mm2\\s*(?:->|=>|to|in|=|ba|be|ban|ben)?\\s*awg$').exec(s);
    if (toAwg) {
      const a = num(toAwg[1]), n = mm2ToAwg(a);
      return { kind: 'awg', title: 'mm² → AWG', value: 'AWG ' + awgName(n), lines: ['AWG ' + awgName(n) + ' = ' + fmt(awgToMm2(n), 3) + ' mm² (a legközelebbi)'], copy: 'AWG ' + awgName(n) };
    }
    const m = new RegExp('^' + NUM + '\\s*(°?[a-zéáöőüűó0-9]+)\\s*(?:->|=>|to|in|=|ba|be|ban|ben|-?ra|-?re)?\\s+(°?[a-zéáöőüűó0-9]+)$').exec(s) ||
              new RegExp('^' + NUM + '\\s*(°?[a-zéáöőüűó0-9]+)\\s*(?:->|=>|=)\\s*(°?[a-zéáöőüűó0-9]+)$').exec(s);
    if (!m) return null;
    const v = num(m[1]), a = UNITS[m[2]], b = UNITS[m[3]];
    if (!a || !b || a[0] !== b[0] || m[2] === m[3]) return null;
    let r;
    if (a[0] === 'tmp') {
      const n = x => x.replace('°', '');
      const toC = { c: x => x, f: x => (x - 32) * 5 / 9, k: x => x - 273.15 }, fromC = { c: x => x, f: x => x * 9 / 5 + 32, k: x => x + 273.15 };
      r = fromC[n(m[3])](toC[n(m[2])](v));
    } else r = v * a[1] / b[1];
    return { kind: 'convert', title: 'Átváltás', value: fmt(r) + ' ' + LABEL[m[3]], lines: [fmt(v) + ' ' + LABEL[m[2]] + ' = ' + fmt(r) + ' ' + LABEL[m[3]]], copy: fmt(r) };
  }

  function answer(line) {
    const s = String(line || '').trim();
    if (!s || s.length > 200) return null;
    const bare = s.replace(/^=\s*/, '');
    const forced = s.startsWith('=');
    if (forced || looksLikeMath(bare)) {
      try {
        const v = calc(bare);
        if (isFinite(v)) return { kind: 'calc', title: 'Számológép', value: fmt(v, Math.abs(v) < 1 ? 6 : 4), lines: [bare.replace(/\*/g, '·') + ' ='], copy: String(Math.round(v * 1e8) / 1e8).replace('.', ',') };
      } catch (e) { if (forced) return { kind: 'error', title: 'Számológép', value: 'Nem értelmezhető kifejezés', lines: ['Példa: = 2,5 * (3 + 4) · sqrt(2) · 3^2 · cos(30)'] }; }
    }
    return convert(bare) || electrical(bare);
  }

  const api = { answer, calc, fmt, quantities, electrical, convert, looksLikeMath, awgToMm2, mm2ToAwg };
  VB.answers = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
