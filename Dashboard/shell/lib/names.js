// names.js — isSafeName: a basename the page may send for rename / new folder (CONTRACT §3). Same rule as ipc.js `name`.
'use strict';

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

function isSafeName(s) {
  if (typeof s !== 'string' || !s.length || s.length > 200) return false;
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(s)) return false;
  if (s.includes('..') || /[. ]$/.test(s) || RESERVED.test(s)) return false;
  return true;
}

module.exports = { isSafeName };
