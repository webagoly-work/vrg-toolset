// The START.cmd tool registry, baked in by tools/build-hub.js from Planner/START.cmd:
// [{ n, key, name, path, dir }]. path and dir are repo-relative with forward slashes.

const KP_REPO = { owner: 'webagoly-work', name: 'vrg-toolset' };

// the page sits in Hub/dist, so a plain link reaches a tool two levels up (works from file://)
const kpToolHref = t => '../../' + t.path.split('/').map(encodeURIComponent).join('/');

if (typeof module !== 'undefined') module.exports = { kpToolHref, KP_REPO };
