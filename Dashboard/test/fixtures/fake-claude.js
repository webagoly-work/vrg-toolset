// fake-claude.js — stands in for Claude Code in tests (VRG_CLAUDE_BIN). Prints its argv and CLAUDE_CONFIG_DIR, exits 0.
'use strict';
console.log('FAKE_CLAUDE ' + process.argv.slice(2).join('|'));
console.log('CLAUDE_CONFIG_DIR=' + (process.env.CLAUDE_CONFIG_DIR || ''));
process.exit(0);
