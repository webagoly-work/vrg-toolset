// ==========================================================================
// 11c-wf-keys.js — workflow round (docs/workflow): the round's new top-level data collections
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// Here, not in the modules that use them: UKEYS is a const of 11-controls.js, so anything earlier in the build would
// touch it inside its temporal dead zone. A collection must be in BOTH lists or it silently will not undo / save / get ids.
//   stdHeights — WP-R4 overrides of the Standards table, prefix K
if(UKEYS.indexOf('stdHeights')<0)UKEYS.push('stdHeights');
if(!IDPRE.stdHeights)IDPRE.stdHeights='K';
if(!Array.isArray(data.stdHeights))data.stdHeights=[];   // the initial document; every load path defaults a missing key to []
//   eloPresets — R1010 WP-M2 the project's Elosztó circuit list, prefix E (08o-cpr.js)
if(UKEYS.indexOf('eloPresets')<0)UKEYS.push('eloPresets');
if(!IDPRE.eloPresets)IDPRE.eloPresets='E';
if(!Array.isArray(data.eloPresets))data.eloPresets=[];
