// The vendor visibility gate.
//
// Rule, from docs/AI-CONTEXT.md: no vendor-specific value may reach the UI or
// an export unless the user has selected that vendor. This module is the only
// place that can read a `vendors.*` path, and core/schema.js actively throws
// if anyone tries to bypass it. One choke point, so the rule cannot rot.

import { field } from './schema.js';

function createVendorGate(doc) {
  const registry = new Map((doc.vendors || []).map(v => [v.id, v]));
  let selected = null;                       // null = vendor-neutral mode

  function list() {
    return [...registry.values()];
  }

  function select(id) {
    if (id !== null && !registry.has(id)) throw new Error('unknown vendor: ' + id);
    selected = id;
    return selected;
  }

  function selectedId() {
    return selected;
  }

  function selectedVendor() {
    return selected ? registry.get(selected) : null;
  }

  /** True only when a vendor is selected and the item has a block for it. */
  function hasBlock(item) {
    return !!(selected && item && item.vendors && item.vendors[selected]);
  }

  /**
   * Read one vendor field. Returns null in vendor-neutral mode — deliberately
   * indistinguishable from "no data", so a caller cannot infer a hidden value.
   */
  function read(item, key) {
    const f = field(key);
    if (!f.vendor) throw new Error('not a vendor field: ' + key);
    if (!hasBlock(item)) return null;
    const prop = f.path.replace('vendors.*.', '');
    const v = item.vendors[selected][prop];
    return v === undefined ? null : v;
  }

  /** The whole selected block, or null. Used by exporters, never by the table. */
  function block(item) {
    return hasBlock(item) ? item.vendors[selected] : null;
  }

  /** Which vendors carry this item at all — safe to show in neutral mode. */
  function carriedBy(item) {
    return item && item.vendors ? Object.keys(item.vendors) : [];
  }

  return { list, select, selectedId, selectedVendor, hasBlock, read, block, carriedBy };
}

export { createVendorGate };
