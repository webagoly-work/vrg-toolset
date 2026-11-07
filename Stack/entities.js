// VRG Stack — entity pillars, by hand.
//
// An ENTITY is one real thing of the work (an app, a program, a method) that shows up on many
// layers under different names: "Planner" is a feature on F, a line on L, a folder on C, a brief
// on A, a pile of commits on R. A pillar is the vertical dashed line through the stack that ties
// those appearances together.
//
// A node joins a pillar when
//   · one of its own paths lies under one of the pillar's paths, or
//   · its title contains one of the pillar's words as a whole word (accents ignored), or
//   · it is listed explicitly in `ids` (use this when a title does not say it).
// Keep words specific: "hub" would catch GitHub, "stack" would catch the Planner BRIDGE Stack.
//
//   [id, name, words, paths, ids]
// Paths inside the repo are relative; outside it they start with H:/ .
'use strict';

module.exports = [
  ['planner', 'Planner', ['planner', 'varler planner'], ['Planner'], ['L:pcore', 'L:views', 'L:pwf']],
  ['mindmap', 'MindMap', ['mindmap'], ['MindMap'], []],
  ['inventory', 'Inventory · Készlet', ['inventory', 'keszlet'], ['Inventory'], []],
  ['buildtree', 'BuildTree · Modulshop', ['buildtree', 'modulshop', 'modder'], ['Modder'], []],
  ['calculator', 'Calculators', ['calculator', 'kalkulator'], ['Calculator'], []],
  ['toolbox', 'Toolbox', ['toolbox'], ['Toolbox', 'toolbox.html'], []],
  ['start', 'START.cmd launcher', ['start.cmd', 'launcher', 'vrg-menu'], ['launcher'], []],
  ['kapu', 'VRG Kapu', ['kapu'], ['Hub', 'docs/hub/00_CONTRACT.md'], []],
  ['city', 'Kódváros', ['kodvaros', 'codecity', 'gepország', 'geporszag'], ['CodeCity', 'docs/city'], []],
  ['console', 'Varler Console', ['varler console'], ['Console'], []],
  ['mobile', 'VRG Mobile', ['vrg mobile', 'mobile'], ['Mobile', 'docs/mobile'], []],
  ['globe', 'Data Globe · Solomon · Gömb', ['solomon', 'gomb', 'data globe', 'adatgomb'], ['Solomon', 'docs/solomon'], []],
  ['divergence', 'Divergence board', ['divergence'], ['Divergence'], []],
  ['bridge', 'BRIDGE smart home', ['bridge'], ['BRIDGE', 'H:/VRG/Full/BRIDGE'], []],
  ['cyd', 'Planner CYD dashboard', ['cyd'], ['Firmware/planner-cyd'], []],
  ['boardconsole', 'Board Console', ['board console'], ['Firmware/board-console'], []],
  ['knobpad', 'Knob Pad', ['knob pad', 'knobpad'], ['Firmware/knobpad'], []],
  ['coreref', 'CoreRef', ['coreref'], ['CoreRef'], []],
  ['servicekit', 'ServiceKit', ['servicekit', 'service kit'], ['ServiceKit', 'ServiceKitCYD', 'ServiceKitPhone'], []],
  ['council', 'VRG Council + agents', ['council', 'tanacs', 'bernard'], ['docs/council', '.claude/agents'], []],
  ['kit', 'Varler Workflow Kit', ['workflow kit'], ['H:/VRG/Full/Varler_Workflow_Kit'], []],
  ['devlog', 'DevLog', ['devlog'], ['H:/VRG/Full/notes/devlog'], ['A:gen.devlog']],
  ['devrep', 'DevRep', ['devrep'], ['H:/VRG/Full/notes/devrep'], ['A:gen.devrep']],
  ['features', 'Features map', ['features map', 'vrg features'], ['H:/VRG/Full/notes/features'], ['A:gen.features']],
  ['ideas', 'Idea timeline', ['idea timeline'], ['H:/VRG/Full/notes/idea-timeline'], ['A:gen.ideas']],
  ['dashboard', 'Desktop Dashboard', ['dashboard', 'iranyitopult'], ['H:/VRG/Full/notes/dashboard'], ['A:gen.dashboard']],
  ['stack', 'VRG Stack (this)', ['vrg stack', 'retegverem', 'multilayer'], ['H:/VRG/Full/notes/stack'], ['A:gen.stack']],
  ['melyviz', 'Mélyvíz style', ['melyviz'], ['shared/melyviz.css', 'shared/melyviz-sync.js'], []],
  ['logo', 'Varler logo', ['varler logo'], ['shared/varler-logo'], []],
  ['vendor', 'Vendor shelf', ['vendor shelf', 'vrg vendor'], ['Vendor', 'vrg-vendor.html', 'vendor-manifest.json'], []],
  ['ctx', 'Context search (vrg-ctx)', ['vrg-ctx'], ['tools/vrg-ctx.js'], []],
];
