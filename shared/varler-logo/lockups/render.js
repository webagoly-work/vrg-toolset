// lockups.json -> SVG markup. The glow is the ground colour around the letters: a crisp knockout edge plus one soft,
// blurred layer, so it covers the mark between and around the letters and fades out instead of cutting a hard line.
const THEMES = { light: { bg: '#FFFFFF', ink: '#000000' }, dark: { bg: '#16181A', ink: '#F4FAFC' } };

function svg(o, theme, opt = {}) {
  const T = THEMES[theme], [x, y, w, h] = o.box, pad = opt.pad == null ? 0 : opt.pad * w;
  const r = Math.min(6, Math.max(3, 0.04 * o.specs[0].size)), id = 'g' + o.id.replace(/[^A-Za-z0-9]/g, '') + theme; // halo radius in logo units
  const vb = [x - pad, y - pad, w + 2 * pad, h + 2 * pad].map(v => +v.toFixed(2)).join(' ');
  const halo = `<filter id="${id}" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="${+(0.9 * r).toFixed(2)}"/></filter>` +
    `<path d="${o.text}" fill="${T.bg}" stroke="${T.bg}" stroke-width="${+(4.4 * r).toFixed(2)}" stroke-linejoin="round" opacity="0.85" filter="url(#${id})"/>` +
    `<path d="${o.text}" fill="${T.bg}" stroke="${T.bg}" stroke-width="${+(2 * r).toFixed(2)}" stroke-linejoin="round"/>`;
  const guides = opt.guides ? `<g fill="none" stroke="#E0663A" stroke-width="1.2" stroke-dasharray="6 5"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></g><text x="${x + w}" y="${y - 10}" text-anchor="end" font-family="sans-serif" font-size="16" fill="#E0663A">${o.ratio}  ${o.measured.toFixed(3)}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${opt.attrs || ''}>` +
    (opt.ground ? `<rect x="${x - pad}" y="${y - pad}" width="${w + 2 * pad}" height="${h + 2 * pad}" fill="${T.bg}"/>` : '') +
    `<path d="${o.mark}" fill="${T.ink}" fill-rule="evenodd"/>${halo}<path d="${o.text}" fill="${T.ink}"/>${guides}</svg>`;
}
module.exports = { svg, THEMES };
