/* Every event passes here before it is stored or drawn, in the hook and again in the page, which
   also knows the client names from the jobs. */
import { scrubText } from '../core/redact.js';

const FIELDS = ['text', 'output', 'error', 'file'];

export const emptyCounts = () => ({ names: 0, contact: 0, address: 0, secret: 0, path: 0 });

/* The event carries its own count, so the page's total includes what the hook already took out. */
export function scrubEvent(ev, names = [], tally = emptyCounts()) {
  const out = { ...ev };
  const seen = { ...emptyCounts(), ...ev.redacted };
  for (const f of FIELDS) {
    if (typeof out[f] !== 'string') continue;
    const { text, counts } = scrubText(out[f], { names });
    out[f] = text;
    for (const k of Object.keys(counts)) seen[k] += counts[k];
  }
  for (const k of Object.keys(seen)) tally[k] += seen[k];
  out.redacted = seen;
  return out;
}
