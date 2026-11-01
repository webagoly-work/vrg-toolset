/* The retention setting, shared by the relay and the hook: the hook has to obey it with the relay closed. */
import fs from 'node:fs';
import path from 'node:path';

export function keepDays(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')).keepDays ?? 14; } catch { return 14; }
}

export function prune(dir, days) {
  const cutoff = Date.now() - days * 864e5;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.jsonl')) continue;
    const file = path.join(dir, f);
    if (fs.statSync(file).mtimeMs < cutoff) fs.unlinkSync(file);
  }
}
