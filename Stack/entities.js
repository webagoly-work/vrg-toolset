// VRG Stack — entity pillars, by hand. The list itself is DATA in entities.json (one pillar per
// line), so a tool can edit it safely (the write gateway, STRINGS-PLAN §4); this file only reads it.
//
// An ENTITY is one real thing of the work (an app, a program, a method) that shows up on many
// layers under different names: "Planner" is a feature on F, a line on L, a folder on C, a brief
// on A, a pile of commits on R. A pillar is the vertical dashed line through the stack that ties
// those appearances together.
//
// A node joins a pillar when
//   · one of its own paths lies under one of the pillar's paths, or
//   · its title contains one of the pillar's words as a whole word (accents ignored), or
//   · it is listed explicitly in `ids` (use this when a title does not say it), or
//   · it is a DevLog line of the pillar's `thread` (read at build time from the Thread Board's data,
//     notes/devlog/threads.js, which stays outside the repo because its lines name job codes).
// Keep words specific: "hub" would catch GitHub, "stack" would catch the Planner BRIDGE Stack.
//
// Each pillar: { id, name, area, thread, [status], words, paths, ids }
//   area    one of `areas` (the Thread Board's groups)
//   thread  the Thread Board thread it is (STK-Q19 = A: threads are pillars), or '' for none
//   status  optional, op · high · mid · low · out · idea, ONLY on a pillar with no F (Featured) member:
//           where an F row exists its tier is the hand fact and the build warns about a second one
// Paths inside the repo are relative; outside it they start with H:/ . No job code goes in here
// (tools/anonymise.map.json): a job's pillar gets its members through its thread's lines.
// STK-Q20 = narrow A (revised 2026-11-10): status is computed from the F tier + the string; the hand
// status above only fills in for jobs and housekeeping, which have no F row. A drift card (S3) flags
// a hand value two or more steps away from the evidence.
'use strict';

const J = require('./entities.json');

module.exports = J.pillars;
module.exports.areas = J.areas;
