// 01-data.js — the city data as scan.js wrote it, plus the folder tree the layout walks.
// city.files[i]: { p, lang, loc, maxLoc, born, last, n, own, ag, gone?, goneAt? }
// city.commits[i]: [time, author, agent(-1|idx), subject, hash7, [fileIdx, add, del, ...]]

const LANG_COLOR = {
  JavaScript: 0xf2c94c, TypeScript: 0x4f8fe6, HTML: 0xe8734a, CSS: 0x9b6fe0, JSON: 0x7c8aa5,
  Markdown: 0x5fc4a8, Text: 0xa7b0c4, Python: 0x3f7cc0, Go: 0x5ad0e6, Rust: 0xd08a5a, 'C++': 0xd0567a,
  C: 0xa0607a, 'C#': 0x6aa84f, PHP: 0x8892be, Batch: 0xc9d36a, Shell: 0x9fd36a, PowerShell: 0x4aa0d0,
  YAML: 0xcf8fb0, XML: 0xb0906a, SVG: 0xffa65a, CAD: 0x8fa0b8, Data: 0x6f8f7a, Config: 0x90a080,
  Other: 0x707a90,
};
const langColor = l => LANG_COLOR[l] ?? LANG_COLOR.Other;

function cityModel(city) {
  const root = { name: city.repo.name, path: '', dirs: new Map(), files: [], depth: 0, parent: null };
  city.files.forEach((f, i) => {
    const parts = f.p.split('/');
    let d = root;
    for (let k = 0; k < parts.length - 1; k++) {
      let c = d.dirs.get(parts[k]);
      if (!c) {
        c = { name: parts[k], path: d.path ? d.path + '/' + parts[k] : parts[k], dirs: new Map(), files: [], depth: d.depth + 1, parent: d };
        d.dirs.set(parts[k], c);
      }
      d = c;
    }
    f.i = i; f.name = parts[parts.length - 1]; f.dir = d; d.files.push(f);
  });
  return { city, root };
}

// totals for a folder, live files only
function dirStats(d) {
  let files = 0, loc = 0;
  const walk = x => { for (const f of x.files) if (!f.gone) { files++; loc += f.loc; } x.dirs.forEach(walk); };
  walk(d);
  return { files, loc };
}
