'use strict';
// SQLite writer for the core reference database. Uses node:sqlite (built in on
// Node 22.5+), so CoreRef stays dependency-free like the rest of the toolset.

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const SCHEMA = `
PRAGMA journal_mode = WAL;

-- ---------- provenance ----------
CREATE TABLE IF NOT EXISTS source (
  id            TEXT PRIMARY KEY,
  class         TEXT NOT NULL,          -- permissive | restricted
  licence       TEXT,
  licence_url   TEXT,
  repo          TEXT,
  pin           TEXT,
  resolved_ref  TEXT,                   -- the tag/version actually harvested
  canonical_base TEXT,                  -- online base URL for link-out
  policy        TEXT,                   -- what the client may do with it
  fetched_at    TEXT
);

CREATE TABLE IF NOT EXISTS artifact (
  id         INTEGER PRIMARY KEY,
  source_id  TEXT NOT NULL,
  url        TEXT NOT NULL,
  local_path TEXT,
  status     INTEGER,
  bytes      INTEGER,
  sha256     TEXT,
  fetched_at TEXT
);
CREATE INDEX IF NOT EXISTS artifact_source ON artifact(source_id);

-- ---------- ESPHome ----------
CREATE TABLE IF NOT EXISTS esphome_component (
  name       TEXT PRIMARY KEY,
  has_schema INTEGER NOT NULL DEFAULT 0,
  nodes      TEXT,                      -- comma list of component.platform nodes
  n_vars     INTEGER DEFAULT 0,
  doc_url    TEXT
);

CREATE TABLE IF NOT EXISTS esphome_config_var (
  id         INTEGER PRIMARY KEY,
  component  TEXT NOT NULL,
  node       TEXT NOT NULL,             -- dotted path inside the schema file
  name       TEXT NOT NULL,
  key        TEXT,                      -- Required | Optional | GeneratedID
  type       TEXT,
  data_type  TEXT,
  default_value TEXT,
  templatable INTEGER,
  docs       TEXT,
  doc_url    TEXT
);
CREATE INDEX IF NOT EXISTS ecv_component ON esphome_config_var(component);

CREATE TABLE IF NOT EXISTS esphome_extends (
  component TEXT NOT NULL,
  node      TEXT NOT NULL,
  extends   TEXT NOT NULL
);

-- ---------- Home Assistant ----------
CREATE TABLE IF NOT EXISTS ha_brand (
  slug           TEXT PRIMARY KEY,
  name           TEXT,
  iot_standards  TEXT,
  n_integrations INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ha_integration (
  domain             TEXT PRIMARY KEY,
  brand              TEXT,
  name               TEXT,
  integration_type   TEXT,              -- device | hub | service | virtual | helper | entity
  config_flow        INTEGER,
  iot_class          TEXT,
  local_rank         INTEGER,           -- 1 best (local push) .. 5 worst (cloud polling)
  supported_by       TEXT,              -- virtual brand -> the integration that serves it
  single_config_entry INTEGER,
  quality_scale      TEXT,
  documentation      TEXT,              -- official doc URL (link-out, not bundled text)
  codeowners         TEXT,
  requirements       TEXT,
  dependencies       TEXT,
  has_manifest       INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS hai_rank ON ha_integration(local_rank);
CREATE INDEX IF NOT EXISTS hai_brand ON ha_integration(brand);

CREATE TABLE IF NOT EXISTS ha_discovery (
  id      INTEGER PRIMARY KEY,
  channel TEXT NOT NULL,                -- zeroconf | homekit | bluetooth | dhcp | usb
  domain  TEXT,
  matcher TEXT                          -- the raw match rule as JSON
);
CREATE INDEX IF NOT EXISTS had_channel ON ha_discovery(channel);
CREATE INDEX IF NOT EXISTS had_domain ON ha_discovery(domain);

-- ---------- offline search ----------
CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5(
  kind, ref, title, body, url UNINDEXED
);
`;

const IOT_RANK = {
  local_push: 1,
  local_polling: 2,
  assumed_state: 3,
  calculated: 3,
  cloud_push: 4,
  cloud_polling: 5,
};

function open(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { force: true });
  for (const suffix of ['-wal', '-shm']) {
    if (fs.existsSync(dbPath + suffix)) fs.rmSync(dbPath + suffix, { force: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);
  return db;
}

function prepared(db) {
  return {
    source: db.prepare(
      `INSERT OR REPLACE INTO source
       (id,class,licence,licence_url,repo,pin,resolved_ref,canonical_base,policy,fetched_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ),
    artifact: db.prepare(
      `INSERT INTO artifact (source_id,url,local_path,status,bytes,sha256,fetched_at)
       VALUES (?,?,?,?,?,?,?)`
    ),
    component: db.prepare(
      `INSERT OR REPLACE INTO esphome_component (name,has_schema,nodes,n_vars,doc_url)
       VALUES (?,?,?,?,?)`
    ),
    cvar: db.prepare(
      `INSERT INTO esphome_config_var
       (component,node,name,key,type,data_type,default_value,templatable,docs,doc_url)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ),
    ext: db.prepare(`INSERT INTO esphome_extends (component,node,extends) VALUES (?,?,?)`),
    brand: db.prepare(
      `INSERT OR REPLACE INTO ha_brand (slug,name,iot_standards,n_integrations) VALUES (?,?,?,?)`
    ),
    integration: db.prepare(
      `INSERT OR REPLACE INTO ha_integration
       (domain,brand,name,integration_type,config_flow,iot_class,local_rank,supported_by,
        single_config_entry,quality_scale,documentation,codeowners,requirements,dependencies,has_manifest)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ),
    discovery: db.prepare(`INSERT INTO ha_discovery (channel,domain,matcher) VALUES (?,?,?)`),
    search: db.prepare(`INSERT INTO search (kind,ref,title,body,url) VALUES (?,?,?,?,?)`),
  };
}

module.exports = { open, prepared, IOT_RANK };
