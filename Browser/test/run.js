#!/usr/bin/env node
// Browser/test/run.js — every VRG Böngésző test: core (engine, omnibox rules, Gyorsválasz, store, sync, host), links (vrg.web-links
// v1, the Data Vault kit's contract cases), server (netguard,
// reader, documents, suggestions, Host / Origin rules), build (dist and kit drift, the registries) and page (headless
// Chromium; skipped without Playwright). No network. Exit 1 on a failure.
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const files = ['core', 'links', 'server', 'jobs', 'knowledge', 'build', 'page'].map(n => path.join(__dirname, n + '.test.js'));
const r = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ...files], { stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
