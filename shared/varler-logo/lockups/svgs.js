// lockups.json -> standalone SVG files, ink on paper and on dark, with clear space of the globe width / phi^4.
const fs = require('fs'), path = require('path'), { svg } = require('./render');
const PHI = (1 + Math.sqrt(5)) / 2, PAD = 1 / PHI ** 4, dir = path.join(__dirname, 'svg');
fs.mkdirSync(dir, { recursive: true });
for (const o of require('./lockups.json')) for (const t of ['light', 'dark'])
  fs.writeFileSync(path.join(dir, `varler-logo-${o.id}-${t}.svg`), svg(o, t, { pad: PAD, ground: true }) + '\n');
