// ==========================================================================
// 08oh-wf-via.js — wireway rebuild (docs/workflow/WIREWAY_AUDIT_2026-10-18.md §4.4, K3), WP-T6: drawn routes on links
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// "Master / Leader → Elosztó link with wall-snapped intermediate nodes (the more defined way)": a node's up may name one
// of the user's own drawn paths (ARM pen / channel, not the engine's gen:'bl' output) as up.via. The engine prefers it
// for that link (×0,25 along it, never through a ban) and the report says how much of it was followed (< 90 % warns).
// Setting it: the device menu "↝ Rajzolt pálya ehhez a betáphoz" → click a path. Removing it: the same menu.
const VIA={on:false,node:null};
function viaSet(nodeId,pathId){const d=byId('devices',nodeId);if(!d||!d.up)return {err:'Előbb a betáp: a végpontnak nincs betápja (⚙ Betáp-fa javaslat / ⛓ Betáp-lánc).'};
  const p=pathId&&data.paths.find(x=>x&&x.id===pathId);if(!p)return {err:'Nincs ilyen pálya.'};if(p.gen==='bl')return {err:'Ez a számított pálya — rajzolt pályát (ARM / csatorna) válassz.'};
  pushUndo(['devices']);d.up.via=p.id;d.up.fix=true;draw();return {ok:true};}
function viaClear(nodeId){const d=byId('devices',nodeId);if(!d||!d.up||!d.up.via)return false;pushUndo(['devices']);delete d.up.via;draw();return true;}
function viaStart(nodeId){toolsOff();if(state.mode!=='select')setMode('select');VIA.on=true;VIA.node=nodeId;const d=byId('devices',nodeId);
  const mh=$('modeHint');if(mh)mh.textContent='Rajzolt pálya '+((d&&(d.ref||d.id))||'')+' betápjához — kattints egy rajzolt pályára (ARM / csatorna) · Esc: mégse';draw();}
function viaOff(){VIA.on=false;VIA.node=null;const mh=$('modeHint');if(mh)mh.textContent=HINTS[state.mode]||'';}
STK_TOOLS.push({k:'viaTool',active:()=>{if(!VIA.on)return false;if(state.mode!=='select'||(typeof WV!=='undefined'&&WV)){viaOff();return false;}return true;},
  down(e){if(e.button!==0)return false;const h=typeof pathSectionHit==='function'?pathSectionHit(e):null,p=h?data.paths[h.pi]:null;
    if(!p){$('hud').textContent='Kattints egy rajzolt pályára.';return true;}
    const r=viaSet(VIA.node,p.id);$('hud').textContent=r.err||('Betáp-útvonal: '+(p.id)+' — a számítás ezt követi, ahol lehet (rögzített)');if(!r.err)viaOff();return true;},
  esc(){viaOff();draw();},mode(){viaOff();}});
STK_DEVMENU.push((di,items)=>{const d=data.devices[di];if(!d||!d.up||typeof upIsNode!=='function'||!upIsNode(d))return;
  items.push({label:'↝ Rajzolt pálya ehhez a betáphoz'+(d.up.via?' (most: '+d.up.via+')':''),act:()=>viaStart(d.id)});
  if(d.up.via)items.push({label:'↝ Rajzolt pálya levétele ('+d.up.via+')',act:()=>viaClear(d.id)});});
window.viaSet=viaSet;window.viaClear=viaClear;window.VIA=VIA;
