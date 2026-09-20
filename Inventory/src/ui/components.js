// Shared presentational bits.

import { el } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v != null) node.setAttribute(k, String(v));
  }
  return node;
}

/**
 * Price sparkline. Deliberately blunt: a flat line for a single observation,
 * and nothing at all for none, so it can never imply a trend that is not there.
 */
function sparkline(values, opts) {
  const w = (opts && opts.width) || 180;
  const h = (opts && opts.height) || 34;
  const pad = 3;
  if (!values || values.length === 0) return null;

  const root = svg('svg', {
    width: w, height: h, viewBox: `0 0 ${w} ${h}`, class: 'spark',
    role: 'img', 'aria-label': 'Ár alakulása'
  });

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = i => pad + (values.length === 1 ? (w - 2 * pad) / 2 : (i / (values.length - 1)) * (w - 2 * pad));
  const y = v => h - pad - ((v - min) / span) * (h - 2 * pad);

  if (values.length === 1) {
    root.appendChild(svg('line', { x1: pad, y1: h / 2, x2: w - pad, y2: h / 2, class: 'spark-flat' }));
  } else {
    root.appendChild(svg('polyline', {
      points: values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' '),
      class: 'spark-line'
    }));
  }
  values.forEach((v, i) => {
    root.appendChild(svg('circle', {
      cx: x(i).toFixed(1), cy: (values.length === 1 ? h / 2 : y(v)).toFixed(1), r: 2.5,
      class: 'spark-dot'
    }));
  });
  return root;
}

function kv(label, value, cls) {
  return el('div', { class: 'kv' + (cls ? ' ' + cls : '') }, [
    el('dt', { text: label }),
    el('dd', { class: value == null || value === '' || value === '—' ? 'muted' : null, text: value == null || value === '' ? '—' : String(value) })
  ]);
}

function section(title, children, cls) {
  return el('section', { class: 'sect' + (cls ? ' ' + cls : '') }, [
    el('h3', { text: title }),
    ...[].concat(children).filter(Boolean)
  ]);
}

function chip(text, cls) {
  return el('span', { class: 'chip' + (cls ? ' ' + cls : ''), text });
}

export { sparkline, kv, section, chip, svg };
