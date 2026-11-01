/* Compares readings with the user's own limit table. Nothing here decides compliance: the status
   describes a reading against that table, and the rating on a report stays the user's act (L6). */
export const STATUS = { OK: 'ok', WARN: 'warn', FAIL: 'fail', NONE: 'none' };
const RANK = { none: 0, ok: 1, warn: 2, fail: 3 };

const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));

/* upper limit: reading must stay at or under it; margin % starts amber below the limit */
function checkMax(value, max, marginPct) {
  if (value == null || max == null) return STATUS.NONE;
  if (value > max) return STATUS.FAIL;
  if (marginPct != null && value > max * (1 - marginPct / 100)) return STATUS.WARN;
  return STATUS.OK;
}

function checkMin(value, min, marginPct) {
  if (value == null || min == null) return STATUS.NONE;
  if (value < min) return STATUS.FAIL;
  if (marginPct != null && value < min * (1 + marginPct / 100)) return STATUS.WARN;
  return STATUS.OK;
}

/* reading { zs, ir, rcdMs }, limit { zsMax, irMin, rcdMaxMs, marginPct } */
export function checkReading(reading, limit) {
  if (!limit) return { zs: STATUS.NONE, ir: STATUS.NONE, rcd: STATUS.NONE, overall: STATUS.NONE };
  const margin = num(limit.marginPct);
  const parts = {
    zs: checkMax(num(reading.zs), num(limit.zsMax), margin),
    ir: checkMin(num(reading.ir), num(limit.irMin), margin),
    rcd: checkMax(num(reading.rcdMs), num(limit.rcdMaxMs), margin),
  };
  const overall = Object.values(parts).reduce((a, b) => (RANK[b] > RANK[a] ? b : a), STATUS.NONE);
  return { ...parts, overall };
}
