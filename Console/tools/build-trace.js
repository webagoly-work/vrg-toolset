#!/usr/bin/env node
/* Builds dist/vrg-trace.html: the trace view as one offline file, fonts and CSS inside. No bundler:
   each ES module becomes a function in a small registry, dependencies first. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WWW = path.join(HERE, '..', 'www');
const OUT = path.join(HERE, '..', 'dist', 'vrg-trace.html');
const ENTRY = path.join(WWW, 'js', 'trace', 'standalone.js');
const IMPORT = /^import\s+(?:\*\s+as\s+(\w+)|\{([^}]*)\})\s+from\s+'([^']+)';?\s*$/gm;
const REEXPORT = /^export\s+\{([^}]*)\};?\s*$/gm;
const DECL = /^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([\w$]+)/gm;

const order = [];
const seen = new Set();

function load(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(IMPORT)) load(path.resolve(path.dirname(file), m[3]));
  order.push(file);
}

function wrap(file) {
  let src = fs.readFileSync(file, 'utf8');
  const names = [...src.matchAll(DECL)].map((m) => m[1]);
  for (const m of src.matchAll(REEXPORT)) names.push(...m[1].split(',').map((s) => s.trim()).filter(Boolean));
  src = src.replace(IMPORT, (m, star, list, from) => {
    const id = JSON.stringify(path.resolve(path.dirname(file), from));
    return star ? `const ${star} = __m[${id}];` : `const { ${list.replace(/\bas\b/g, ':')} } = __m[${id}];`;
  });
  src = src.replace(REEXPORT, '').replace(/^export\s+/gm, '');
  if (/^(import|export)\s/m.test(src)) throw new Error('unhandled module syntax in ' + file);
  return `__m[${JSON.stringify(file)}] = (() => {\n${src}\nreturn { ${names.join(', ')} };\n})();\n`;
}

function css(name) {
  return fs.readFileSync(path.join(WWW, 'css', name), 'utf8');
}

function fonts() {
  return css('fonts.css').replace(/url\(["']?\.\.\/fonts\/([^"')]+)["']?\)/g, (m, f) => {
    const data = fs.readFileSync(path.join(WWW, 'fonts', f)).toString('base64');
    return `url(data:font/woff2;base64,${data})`;
  });
}

load(ENTRY);
const js = order.map(wrap).join('\n').replaceAll('</script', '<\\/script');
const html = `<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agent trace</title>
<style>${fonts()}${css('tokens.css')}${css('ring.css')}${css('app.css')}
html, body { overflow: auto; height: auto; }
#app { position: static; display: block; }
.page { position: static; height: auto; overflow: visible; }
.langs { padding: var(--space-3) var(--space-3) 0; }</style>
</head>
<body>
<div id="app"></div>
<div id="toasts"></div>
<script>
const __m = {};
${js}
</script>
</body>
</html>
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`dist/vrg-trace.html: ${(html.length / 1024).toFixed(0)} KB, ${order.length} modules`);
