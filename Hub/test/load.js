// Loads Hub/src/js modules into a fresh vm context, the way the build concatenates them:
// one shared scope. `globals` seeds the context (e.g. a localStorage stub).

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS = path.join(__dirname, '..', 'src', 'js');

function kpLoad(files, globals) {
  const ctx = vm.createContext(Object.assign({ console }, globals || {}));
  const src = files.map(f => fs.readFileSync(path.join(JS, f), 'utf8')).join('\n');
  // top-level const/function become reachable through the returned object
  const names = [...src.matchAll(/^(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
  vm.runInContext(src + '\n;({' + names.join(',') + '})', ctx);
  return vm.runInContext('({' + names.join(',') + '})', ctx);
}

module.exports = { kpLoad };
