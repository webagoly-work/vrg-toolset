// paths.js — the only module that knows where personal state lives (CONTRACT §5).
// Tests point it at a temp dir with VRG_DESK_HOME. Directories are created on first use.
'use strict';
const fs = require('fs'), path = require('path');

const DEFAULT_HOME = 'H:\\VRG\\Full\\home\\desktop';

const home = () => process.env.VRG_DESK_HOME || DEFAULT_HOME;
const user = () => 'founder';                                       // D17 (team) changes this

const ensure = d => { fs.mkdirSync(d, { recursive: true }); return d; };
const userDir = () => ensure(path.join(home(), user()));
const sub = name => ensure(path.join(userDir(), name));
const logs = () => sub('logs');
const cache = () => sub('cache');
const packs = () => sub('packs');
const machine = () => path.join(home(), 'machine.json');           // optional, never created here

module.exports = { home, user, userDir, logs, cache, packs, machine, DEFAULT_HOME };
