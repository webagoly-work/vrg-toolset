/* Small DOM helpers. h('div.a.b', { attrs }, children...) */
const SVG_NS = 'http://www.w3.org/2000/svg';

export function h(spec, attrs = {}, ...children) {
  const [tag, ...classes] = spec.split('.');
  const node = document.createElement(tag);
  if (classes.length) node.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'text') node.textContent = v;
    else if (k in node && k !== 'list') node[k] = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.flat().filter((c) => c != null));
  return node;
}

/* Line icons, 1.5px strokes, from ring and sector geometry. Decorative: the button has the label. */
const PATHS = {
  home: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/>',
  prev: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  up: '<path d="M5 15l7-7 7 7"/>',
  down: '<path d="M5 9l7 7 7-7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  library: '<path d="M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z"/>',
  settings: '<circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  tune: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  handle: '<path d="M5 8h14M5 12h14M5 16h14"/>',
  trash: '<path d="M5 7h14M9 7V4.5h6V7M7 7l1 13h8l1-13"/>',
  off: '<circle cx="12" cy="12" r="8"/><path d="M8 12h8"/>',
};

export function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = PATHS[name];
  return svg;
}

export const iconButton = (name, label, onclick, attrs = {}) =>
  h('button.ico', { type: 'button', 'aria-label': label, title: label, onclick, ...attrs }, icon(name));

/* A row of mutually exclusive buttons; each one is a plain 48px target. */
export function segmented(options, value, onPick) {
  const wrap = h('div.seg');
  const paint = (v) => [...wrap.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === v)));
  for (const o of options) {
    wrap.append(h('button', { type: 'button', text: o.label, 'data-value': o.value, onclick: () => { paint(o.value); onPick(o.value); } }));
  }
  paint(value);
  return wrap;
}

export function switchRow(label, hint, checked, onChange) {
  return h('label.switch', {},
    h('span', { text: label }, h('small', { text: hint })),
    h('input', { type: 'checkbox', checked, role: 'switch', onchange: (e) => onChange(e.target.checked) }));
}
