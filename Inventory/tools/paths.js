// Shared paths for the Phase 0 extraction pipeline.
//
// RAW      the downloaded vendor documents — never committed, they contain
//          customer addresses and tax numbers
// CACHE    intermediate artefacts of the pipeline (rows.json, emails.json …);
//          regenerable, gitignored
// PDFITEMS extracted PDF rows; kept in tools/ because the PDFs themselves are
//          gitignored, so this is the only committed record of them
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RAW = process.env.VRG_RAW_DIR || 'H:/_inbox/database_emails';
const CACHE = path.join(ROOT, '.cache');
const PDFITEMS = path.join(__dirname, 'pdfitems.json');

fs.mkdirSync(CACHE, { recursive: true });

module.exports = { ROOT, RAW, CACHE, PDFITEMS };
