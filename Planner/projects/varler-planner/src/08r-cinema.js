// ==========================================================================
// 08r-cinema.js — round 2026-10-18 (docs/round-2026-10-18), WP-C1, C2, C4: the Házimozi layer
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// A special-rules layer (30_MOZI.md). C1: role sys:CINEMA right after Média és hang (C1 A), off by default — added on
// demand, inside the active stack or as a plain layer without one. C2: the setup — pick the room, DRAG the screen line
// in it (C2 B: it snaps parallel to the nearest wall; that wall is the screen wall, the distance is x_scr), confirm
// the cinema zone rectangle (C3 D: starts as the largest rectangle on the screen wall), then "javaslat?" with the
// format / display / eye height / angle (C4: 7.1 always allowed, a warning note when it does not fit).
// C4: the suggestion is a DRAWING-ONLY overlay at 30 % (C5 B) — speakers, subs, projector, rack, the seat, the beam
// keep-out wedge and the track-light band at 12 %; room RCO *Javasolt helyek létrehozása* turns it into ideal spots
// (C5 A on demand). Layer data: L.cinema (mm, plan coordinates). The numbers come from cinCalc (08ra). Prefix: cin.

STK_ROLES.splice(STK_ROLES.findIndex(r=>r.k==='sys:MEDIA')+1,0,
  {k:'sys:CINEMA',n:'Házimozi',ph:2,fam:'MEDIA',off:true,hint:'Hangszórók, projektor, vászon, rack — saját pálya, saját kör (C1–C7).'});
STK_ICONS['sys:CINEMA']='🎬';STK_COL['sys:CINEMA']='#5b3f8c';
// the cinema nodes (C5 catalogue); the signal cables are family CINEMA (C7, 08rb), the 230 V feeds MAINS
[{code:'CLR',n:'Front hangfal (L / C / R)',mount:'wall',h:1150,vars:[{k:'25',n:'Hangszórókábel 2×2,5',cab:[{c:'SPK2x25',w:'M20',fam:'CINEMA'}]}]},
 {code:'CSR',n:'Oldalsó surround (Ls / Rs)',mount:'wall',h:1750,vars:[{k:'25',n:'Hangszórókábel 2×2,5',cab:[{c:'SPK2x25',w:'M20',fam:'CINEMA'}]}]},
 {code:'CBK',n:'Hátsó surround (Lb / Rb)',mount:'wall',h:1750,vars:[{k:'25',n:'Hangszórókábel 2×2,5',cab:[{c:'SPK2x25',w:'M20',fam:'CINEMA'}]}]},
 {code:'CSW',n:'Mélysugárzó',mount:'floor',h:0,vars:[{k:'lfe',n:'LFE + 230 V a padlóban',cab:[{c:'LFE',w:'M25',fam:'CINEMA'},{c:'NYM3x25',w:'M20',fam:'MAINS',from:'board'}]}]},
 {code:'CPJ',n:'Projektor',mount:'ceiling',vars:[{k:'aoc',n:'HDMI AOC + Cat6A + 230 V (Ø40 gerinc)',cab:[{c:'AOC_FIX',w:'M40',fam:'CINEMA'},{c:'CAT6A_U',w:'M20',fam:'CINEMA'},{c:'NYM3x25',w:'M20',fam:'MAINS',from:'board'}]}]},
 {code:'CSC',n:'Motoros vászon',mount:'ceiling',vars:[{k:'mot',n:'230 V + vezérlő érpár',cab:[{c:'NYM3x25',w:'M20',fam:'MAINS',from:'board'},{c:'TRIG2x075',w:'M20',fam:'CINEMA'}]}]},
 {code:'CTV',n:'TV (síkképernyő)',mount:'wall',h:1200,vars:[{k:'aoc',n:'HDMI AOC + Cat6A + 230 V',cab:[{c:'AOC_FIX',w:'M40',fam:'CINEMA'},{c:'CAT6A_U',w:'M20',fam:'CINEMA'},{c:'NYM3x25',w:'M20',fam:'MAINS',from:'board'}]}]},
 {code:'CRK',n:'AV rack / erősítő',mount:'wall',h:300,vars:[{k:'std',n:'Rack: 2 dedikált kör + 2 × Cat6A',cab:[{c:'NYM3x25',w:'M25',fam:'MAINS',from:'board'},{c:'CAT6A_U',n:2,w:'M25',fam:'DATA'}]}]}]
 .forEach(e=>{if(!EP_CAT.some(x=>x.code===e.code))EP_CAT.push(Object.assign({new:true,role:'sys:CINEMA',cat:'device',topo:'star',from:'rbx'},e));});
Object.assign(ICO_BY_CODE,{CLR:'speaker',CSR:'speaker',CBK:'speaker',CSW:'speaker',CPJ:'screen',CSC:'screen',CTV:'screen',CRK:'avp'});   // 05z marks

// ---- C1: the layer -----------------------------------------------------------------------------------------------------
function cinLayers(){return layers.filter(l=>l.role==='sys:CINEMA');}
function cinLayer(){const S=typeof stkActive==='function'?stkActive():null;const A=lyrLayer(state.activeLayer);
  if(A&&A.role==='sys:CINEMA')return A;return (S&&stkLayer(S.id,'sys:CINEMA'))||cinLayers()[0]||null;}
function cinLayerAdd(){lyrPushUndo();const S=typeof stkActive==='function'?stkActive():null;let L;
  if(S){L=stkMakeLayer(S,stkRole('sys:CINEMA'));const md=stkLayer(S.id,'sys:MEDIA');let at=layers.length;
    if(md)at=layers.indexOf(md)+1;else{const after=S.layers.map(lyrLayer).filter(x=>x&&stkRoleIx(x.role)<stkRoleIx('sys:CINEMA')).pop();if(after)at=layers.indexOf(after)+1;}
    layers.splice(at,0,L);stkSync(S);}
  else{L={id:lyrNewId(),name:'Házimozi',visible:true,cats:layerCatsAll(),role:'sys:CINEMA'};layers.push(L);}
  state.activeLayer=L.id;lyrRefresh();return L;}
// the room record of a cinema (rooms are found by id; building-model rooms have Y ids)
function cinRoom(C){if(!C)return null;for(const l of ORD){const e=allRooms(l).find(x=>x.rm&&x.rm.id===C.room);if(e)return e;}return null;}

// ---- C2: geometry — screen side, zone, the frame the calculator works in -----------------------------------------------
// n = into the room; t = the VIEWER'S LEFT (facing the screen = facing −n; plan y grows down the screen): +y of the guide
const CIN_SIDES={y0:{n:[0,1],t:[-1,0]},y1:{n:[0,-1],t:[1,0]},x0:{n:[1,0],t:[0,1]},x1:{n:[-1,0],t:[0,-1]}};
// the drag line → screen side + x_scr. A line more horizontal than vertical faces a y side, the nearer bbox edge wins.
function cinLineSide(rm,p0,p1){const b=polyBBox(rm.poly),hz=Math.abs(p1[0]-p0[0])>=Math.abs(p1[1]-p0[1]);
  const m=[(p0[0]+p1[0])/2,(p0[1]+p1[1])/2];let side,dist;
  if(hz){const a=m[1]-b.y0,c=b.y1-m[1];side=a<=c?'y0':'y1';dist=Math.min(a,c);}
  else{const a=m[0]-b.x0,c=b.x1-m[0];side=a<=c?'x0':'x1';dist=Math.min(a,c);}
  return {side,xScr:Math.max(0,Math.round(dist/50)*50),mid:m};}
// C3 D (start = A): the largest rectangle that stands on the screen side — the lateral run of the room along that edge
// through the line's middle, then as deep as that whole width stays inside the room. Samples every 50 mm.
function cinZoneA(rm,side,mid){const b=polyBBox(rm.poly),S=CIN_SIDES[side],P=rm.poly,st=50;
  const edge=side==='y0'?b.y0:side==='y1'?b.y1:side==='x0'?b.x0:b.x1,horiz=side[0]==='y';
  const pt=(u,d)=>horiz?[u,edge+S.n[1]*d]:[edge+S.n[0]*d,u];const inP=(u,d)=>pointInPoly(pt(u,d)[0],pt(u,d)[1],P);
  // strips of 50 mm tested at their centre, so a run ends exactly on a wall face (an edge point would be ambiguous)
  const u0=horiz?b.x0:b.y0,u1=horiz?b.x1:b.y1,mu=horiz?mid[0]:mid[1],um=u0+Math.round((Math.max(u0,Math.min(u1,mu))-u0)/st)*st;
  let lo=um,hi=um;while(lo>u0&&inP(lo-st/2,st/2))lo-=st;while(hi<u1&&inP(hi+st/2,st/2))hi+=st;
  if(lo>u0&&lo-u0<st&&inP((lo+u0)/2,st/2))lo=u0;if(hi<u1&&u1-hi<st&&inP((hi+u1)/2,st/2))hi=u1;   // a last strip narrower than 50 mm
  lo=Math.max(lo,u0);hi=Math.min(hi,u1);
  const deep=horiz?b.y1-b.y0:b.x1-b.x0;
  const rowIn=dd=>{for(let u=lo+st/2;u<hi;u+=st)if(!inP(u,dd))return false;return true;};
  let d=0;while(d<deep&&rowIn(d+st/2))d+=st;if(d<deep&&deep-d<st&&rowIn((d+deep)/2))d=deep;d=Math.min(d,deep);
  return {L:Math.round(d),W:Math.round(hi-lo),off:Math.round((lo+hi)/2-(u0+u1)/2),u0:lo,u1:hi};}
// the frame: origin at the middle of the zone's screen-wall edge; x into the room (mm), y along the wall to the left
function cinFrame(C){const R=cinRoom(C);if(!R)return null;const b=polyBBox(R.rm.poly),S=CIN_SIDES[C.side],horiz=C.side[0]==='y';
  const edge=C.side==='y0'?b.y0:C.side==='y1'?b.y1:C.side==='x0'?b.x0:b.x1,uc=(horiz?(b.x0+b.x1):(b.y0+b.y1))/2+(C.zone.off||0);
  const o=horiz?[uc,edge]:[edge,uc];
  return {o,n:S.n,t:S.t,level:R.level,rm:R.rm,P:(x,y)=>[o[0]+S.n[0]*x+S.t[0]*y,o[1]+S.n[1]*x+S.t[1]*y]};}
// ceiling height of the room (m): the álmennyezet if there is one, else the level's inner height
function cinHf(level,rm){const d=typeof dropCeilMm==='function'?dropCeilMm(level,rm):0;return (d>0?d:wallH(level))/1000;}
function cinCompute(L){const C=L&&L.cinema;if(!C||!C.zone)return null;const F=cinFrame(C);if(!F)return null;
  const r=cinCalc({L:C.zone.L/1000,W:C.zone.W/1000,Hf:cinHf(F.level,F.rm),xScr:(C.xScr||0)/1000,fmt:C.fmt,disp:C.disp,
    hEye:(C.hEye||1150)/1000,thetaMax:C.theta||40});
  r.checks=r.checks.concat(cinDoorChecks(C,F,r));return r;}
// §3.10 check 12: a wall speaker within 0.7 m of a door or window on its level (swing / park zone, glass)
function cinDoorChecks(C,F,r){const out=[],ops=(data.openings||[]).filter(o=>o&&o.level===F.level&&(o.type==='door'||o.type==='window'));
  const pts=Object.keys(r.spk).map(k=>({k,s:r.spk[k]}));
  pts.forEach(({k,s})=>{const p=F.P(s.x*1000,s.y*1000);const hit=ops.find(o=>Math.hypot(o.x-p[0],o.y-p[1])<(o.w||900)/2+700);
    if(hit)out.push({n:12,ok:false,sev:'warn',msg:k+': '+(hit.type==='door'?'ajtó':'ablak')+' mellett ('+(hit.ref||hit.id||'')+') — tedd arrébb vagy más rögzítés.'});});
  if(!out.length)out.push({n:12,ok:true,sev:'warn',msg:'Ajtók, ablakok: rendben.'});
  return out;}

// ---- C2: the setup wizard ----------------------------------------------------------------------------------------------
let CIN_PICK=null;   // {step:'room'|'line', L, rm, level, p0, p1}
function cinStart(){let L=cinLayer();if(!L)L=cinLayerAdd();else{state.activeLayer=L.id;lyrRefresh();}
  if(typeof toolsOff==='function')toolsOff();if(state.mode!=='select')setMode('select');
  CIN_PICK={step:'room',L:L.id,level:state.active};$('hud').textContent='Házimozi: kattints a helyiségre, ahová a mozi kerül.';draw();return L;}
function cinPt(e){const level=state.active,[bx,by]=clientToBase(e),p=baseToPlan(bx,by,dz(level,0));return [p[0],p[1]];}
STK_TOOLS.push({k:'cinPick',active:()=>!!CIN_PICK,
  down(e){if(e.button!==0)return false;const p=cinPt(e);
    if(CIN_PICK.step==='room'){const R=mrkRoomAtPt(state.active,p[0],p[1]);if(!R){$('hud').textContent='Ez nem helyiség — kattints egy helyiségre.';return true;}
      CIN_PICK=Object.assign(CIN_PICK,{step:'line',rm:R.rm,level:R.level});
      $('hud').textContent='Házimozi — '+(R.rm.name||'')+': húzd meg a vászon / TV vonalát a helyiségben (a legközelebbi falhoz igazodik).';draw();return true;}
    if(!pointInPoly(p[0],p[1],CIN_PICK.rm.poly))return true;
    CIN_PICK.p0=p;CIN_PICK.p1=p;try{stage.setPointerCapture(e.pointerId);}catch(_){}return true;},
  move(e){if(!CIN_PICK||!CIN_PICK.p0)return false;CIN_PICK.p1=cinPt(e);
    const s=cinLineSide(CIN_PICK.rm,CIN_PICK.p0,CIN_PICK.p1);$('hud').textContent='Vászon síkja a faltól: '+s.xScr+' mm';draw();return true;},
  up(e){if(!CIN_PICK||!CIN_PICK.p0)return false;CIN_PICK.p1=cinPt(e);const K=CIN_PICK;CIN_PICK=null;
    const s=cinLineSide(K.rm,K.p0,K.p1),z=cinZoneA(K.rm,s.side,s.mid);draw();
    cinSetupDialog(lyrLayer(K.L),{room:K.rm.id,level:K.level,side:s.side,xScr:s.xScr,zone:{L:z.L,W:z.W,off:z.off}});return true;},
  esc(){CIN_PICK=null;draw();},mode(){CIN_PICK=null;}});
// the preview of the line while it is dragged (and the picked room)
STK_OVERLAY.push(()=>{if(!CIN_PICK)return '';let s='';const z=dz(CIN_PICK.level||state.active,0);
  if(CIN_PICK.rm)s+=`<polygon points="${p2b(CIN_PICK.rm.poly.map(p=>[p[0],p[1],z]))}" fill="#5b3f8c" fill-opacity="0.08" stroke="#5b3f8c" stroke-width="${vsP(1.2)}" stroke-dasharray="${vsDash('6 4')}"/>`;
  if(CIN_PICK.p0&&CIN_PICK.p1){const s0=cinLineSide(CIN_PICK.rm,CIN_PICK.p0,CIN_PICK.p1),b=polyBBox(CIN_PICK.rm.poly),hz=s0.side[0]==='y';
    const c=hz?(s0.side==='y0'?b.y0+s0.xScr:b.y1-s0.xScr):(s0.side==='x0'?b.x0+s0.xScr:b.x1-s0.xScr);
    const a=hz?[CIN_PICK.p0[0],c]:[c,CIN_PICK.p0[1]],q=hz?[CIN_PICK.p1[0],c]:[c,CIN_PICK.p1[1]];
    s+=`<polyline points="${p2b([[a[0],a[1],z],[q[0],q[1],z]])}" fill="none" stroke="#5b3f8c" stroke-width="${vsP(3)}"/>`;}
  return `<g class="cin-pick" pointer-events="none">${s}</g>`;});
function cinSetupDialog(L,init){if(!L)return;const C=Object.assign({fmt:'5.1',disp:'pj',hEye:1150,theta:40,suggest:true},L.cinema||{},init||{});
  const R=cinRoom(C),z=C.zone;
  const opt=(id,v,list)=>`<select id="${id}">`+list.map(o=>`<option value="${o[0]}" ${String(v)===String(o[0])?'selected':''}>${esc(o[1])}</option>`).join('')+`</select>`;
  openModal('🎬 Házimozi — '+esc(R?(R.rm.name||R.rm.id):''),
    `<div class="mrow">Vászon / TV fala: <b>${{y0:'felső',y1:'alsó',x0:'bal',x1:'jobb'}[C.side]||C.side}</b> (a rajzon) · vászon síkja a faltól <input id="cinX" type="number" step="50" min="0" value="${C.xScr}" style="width:70px"> mm</div>`
    +`<div class="mrow" style="font-size:12px"><b>Mozi zóna</b> (C3 D — a vászonfalon álló legnagyobb téglalap; igazíthatod):<br>mélység L <input id="cinL" type="number" step="50" value="${z.L}" style="width:70px"> · szélesség W <input id="cinW" type="number" step="50" value="${z.W}" style="width:70px"> · eltolás <input id="cinO" type="number" step="50" value="${z.off||0}" style="width:60px"> mm</div>`
    +`<div class="mrow"><label><input type="checkbox" id="cinSug" ${C.suggest!==false?'checked':''}> Javasoljunk elhelyezést a helyiség méretei alapján?</label></div>`
    +`<div class="mrow">Formátum ${opt('cinFmt',C.fmt,[['5.1','5.1'],['7.1','7.1']])} · Kép ${opt('cinDisp',C.disp,[['pj','projektor + vászon'],['tv','TV']])}`
    +` · Szemmagasság ${opt('cinEye',C.hEye,[[1150,'1150 (kanapé)'],[1200,'1200 (mozi fotel)']])} · Látószög max ${opt('cinTh',C.theta,[[30,'30°'],[36,'36°'],[40,'40°']])}</div>`
    +`<div class="mrow" style="font-size:11px;color:#888">A 7.1 mindig választható; ha a helyiség rövid hozzá, figyelmeztetés marad a rétegen.</div>`,
    ()=>{lyrPushUndo();const zone={L:Math.max(1000,+$('cinL').value||z.L),W:Math.max(1000,+$('cinW').value||z.W),off:+$('cinO').value||0};
      L.cinema={room:C.room,level:C.level,side:C.side,xScr:Math.max(0,+$('cinX').value||0),zone,suggest:$('cinSug').checked,
        fmt:$('cinFmt').value,disp:$('cinDisp').value,hEye:+$('cinEye').value,theta:+$('cinTh').value,spots:null};
      const r=cinCompute(L),R2=cinRoom(L.cinema),bb=R2&&polyBBox(R2.rm.poly),full=bb&&Math.abs((L.cinema.side[0]==='y'?bb.y1-bb.y0:bb.x1-bb.x0)-zone.L)<60&&Math.abs((L.cinema.side[0]==='y'?bb.x1-bb.x0:bb.y1-bb.y0)-zone.W)<60;
      const bad=r?r.checks.filter(c=>!c.ok):[];
      $('hud').textContent='Házimozi: '+(r?('MLP '+Math.round(r.xMLP*1000)+' mm · kép '+Math.round(r.Ws*1000)+' mm'+(bad.length?' · '+bad.length+' figyelmeztetés (jobb klikk a rétegen → Mozi ellenőrzés)':' · minden ellenőrzés rendben')):'')
        +(full?'':' · a mozi zóna kisebb a helyiségnél — a mélyhang számítás közelítő');
      renderLayers();draw();},'Kész');}

// ---- C4: the overlay (30 %) --------------------------------------------------------------------------------------------
const CIN_LBL={L:'L',C:'C',R:'R',Ls:'Ls',Rs:'Rs',Lb:'Lb',Rb:'Rb'};
function cinSvgFor(L){const C=L.cinema;if(!C||!C.zone||C.suggest===false)return '';const r=cinCompute(L),F=cinFrame(C);if(!r||!F)return '';
  const lv=F.level;if(!state.levels[lv])return '';const fz=dz(lv,0),col='#5b3f8c',k=typeof devK==='function'?devK():1,Rk=v=>+(v*k).toFixed(2);
  const W=(x,y,zmm)=>{const p=F.P(x*1000,y*1000);return planToBase(p[0],p[1],dz(lv,zmm||0));};
  const poly=(pts,zmm)=>pts.map(q=>{const b=W(q[0],q[1],zmm);return b[0].toFixed(1)+','+b[1].toFixed(1);}).join(' ');
  const HfMM=r.in.Hf*1000;let s='';
  // the zone and the screen plane
  const Lz=C.zone.L/1000,Wz=C.zone.W/1000;
  s+=`<polygon points="${poly([[0,-Wz/2],[Lz,-Wz/2],[Lz,Wz/2],[0,Wz/2]],0)}" fill="none" stroke="${col}" stroke-width="${vsP(1)}" stroke-dasharray="${vsDash('7 4')}"/>`;
  s+=`<polyline points="${poly([[r.in.xScr,-r.Ws/2],[r.in.xScr,r.Ws/2]],r.zBot*1000)}" fill="none" stroke="${col}" stroke-width="${vsP(4)}"/>`;
  // §3.8 beam keep-out (red 12 %) and the track-light bands (green 12 %), at the ceiling
  if(r.beam)s+=`<polygon points="${poly(r.beam.poly,HfMM)}" fill="#E24B4A" fill-opacity="0.12" stroke="#A32D2D" stroke-width="${vsP(0.8)}" stroke-dasharray="${vsDash('5 4')}"/>`;
  if(r.band&&r.band.ok)[1,-1].forEach(sg=>{s+=`<polygon points="${poly([[r.band.x0,sg*r.band.yIn],[r.band.x1,sg*r.band.yIn],[r.band.x1,sg*r.band.yOut],[r.band.x0,sg*r.band.yOut]],HfMM)}" fill="#639922" fill-opacity="0.12" stroke="#3B6D11" stroke-width="${vsP(0.8)}" stroke-dasharray="${vsDash('5 4')}"/>`;});
  // the markers at 30 %: speakers, subs, projector, rack, the seat
  const mark=(x,y,zmm,lbl,shape)=>{const b=W(x,y,zmm),w=Rk(16);
    return (shape==='o'?`<circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="${w/2}" fill="#fff" stroke="${col}" stroke-width="${Rk(1.4)}"/>`
      :`<rect x="${(b[0]-w/2).toFixed(1)}" y="${(b[1]-w/2).toFixed(1)}" width="${w}" height="${w}" rx="${Rk(3)}" fill="#fff" stroke="${col}" stroke-width="${Rk(1.4)}"/>`)
      +`<text x="${b[0].toFixed(1)}" y="${(b[1]+Rk(2.6)).toFixed(1)}" font-size="${Rk(lbl.length>2?5.5:7)}" text-anchor="middle" font-weight="700" fill="${col}">${esc(lbl)}</text>`;};
  let m='';Object.keys(r.spk).forEach(kk=>{const p=r.spk[kk];m+=mark(p.x,p.y,p.z*1000,CIN_LBL[kk]||kk);});
  r.subs.forEach((p,i)=>{m+=mark(p.x,p.y,0,'SW'+(i+1));});
  if(r.pj)m+=mark(r.pj.x,0,r.pj.z*1000,'PJ');
  m+=mark(Lz-0.05,0,300,'AV');
  {const b=W(r.xMLP,0,r.in.hEye*1000);m+=`<circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="${Rk(5)}" fill="none" stroke="${col}" stroke-width="${Rk(1.6)}"/><circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="${Rk(1.5)}" fill="${col}"/>`
    +`<text x="${b[0].toFixed(1)}" y="${(b[1]+Rk(13)).toFixed(1)}" font-size="${Rk(6)}" text-anchor="middle" font-weight="700" fill="${col}">MLP</text>`;}   // the seat: a ring, label under it
  return `<g class="cin-ovl" pointer-events="none">${s}<g opacity="0.3">${m}</g></g>`;}
STK_OVERLAY.push(()=>cinLayers().filter(L=>L.visible!==false&&L.cinema).map(cinSvgFor).join(''));

// ---- C4 on demand (C5 A): the overlay as ideal spots -------------------------------------------------------------------
function cinSpotList(L){const C=L.cinema,r=cinCompute(L),F=cinFrame(C);if(!r||!F)return [];const out=[];
  const add=(code,x,y,zmm,lbl,mount)=>{const p=F.P(x*1000,y*1000);out.push({key:'cin:'+lbl,kind:'ep',code,role:'sys:CINEMA',x:Math.round(p[0]),y:Math.round(p[1]),
    h:Math.round(zmm),level:F.level,mount,why:'Házimozi '+lbl,room:C.room});};
  ['L','C','R'].forEach(k=>add('CLR',r.spk[k].x,r.spk[k].y,r.spk[k].z*1000,k,'wall'));
  ['Ls','Rs'].forEach(k=>add('CSR',r.spk[k].x,r.spk[k].y,r.spk[k].z*1000,k,'wall'));
  ['Lb','Rb'].forEach(k=>{if(r.spk[k])add('CBK',r.spk[k].x,r.spk[k].y,r.spk[k].z*1000,k,'wall');});
  r.subs.forEach((p,i)=>add('CSW',p.x,p.y,0,'SW'+(i+1),'floor'));
  if(r.pj){add('CPJ',r.pj.x,0,r.pj.z*1000,'PJ','ceiling');add('CSC',r.in.xScr,0,r.in.Hf*1000-100,'Vászon','ceiling');}
  else add('CTV',r.in.xScr,0,(r.zBot+r.Hs/2)*1000,'TV','wall');
  add('CRK',C.zone.L/1000-0.05,0,300,'AV rack','wall');
  return out;}
function cinMakeSpots(L){if(!L||!L.cinema)return 0;lyrPushUndo();L.cinema.spots=cinSpotList(L);L.ideal=true;state.activeLayer=L.id;renderLayers();draw();
  $('hud').textContent='Házimozi: '+L.cinema.spots.length+' javasolt hely — jobb klikk egy ✦ helyen, és készülék lesz belőle.';return L.cinema.spots.length;}
// the room menu: set up a cinema here / make the suggested spots / the checks
function cinRoomMenu(rh,items){const L=cinLayers().find(x=>x.cinema&&x.cinema.room===rh.rm.id);
  if(!L){items.push({label:'🎬 Házimozi ebben a helyiségben…',act:()=>{const N=cinStart();CIN_PICK=Object.assign(CIN_PICK,{step:'line',rm:rh.rm,level:rh.level,L:N.id});
    $('hud').textContent='Házimozi — '+(rh.rm.name||'')+': húzd meg a vászon / TV vonalát a helyiségben.';}});return;}
  items.push({label:'🎬 Javasolt helyek létrehozása (ideális helyek)',act:()=>cinMakeSpots(L)});
  items.push({label:'🎬 Mozi beállítások…',act:()=>cinSetupDialog(L)});
  items.push({label:'🎬 Mozi ellenőrzés…',act:()=>cinChecksDialog(L)});}
function cinChecksDialog(L){const r=cinCompute(L);if(!r)return;
  openModal('🎬 Házimozi — ellenőrzés (§3.10)',
    `<div class="mrow" style="font-size:12px">MLP ${Math.round(r.xMLP*1000)} mm a vászonfaltól · látótáv ${Math.round(r.D*1000)} · kép ${Math.round(r.Ws*1000)} × ${Math.round(r.Hs*1000)} mm (${r.bind==='angle'?'a látószög köti':'a belmagasság köti'}) · kép alja ${Math.round(r.zBot*1000)}</div>`
    +`<div class="mrow" style="font-size:12px">Front φ ${r.phi.toFixed(1)}° · oldalsó α ${r.alpha}°${r.rear?' · hátsó β '+r.rear.beta+'°':''} · surround magasság ${Math.round(r.spk.Ls.z*1000)} mm · módusok ${r.modes.fL.toFixed(1)} / ${r.modes.fW.toFixed(1)} / ${r.modes.fH.toFixed(1)} Hz</div>`
    +`<table style="font-size:12px">`+r.checks.map(c=>`<tr style="color:${c.ok?'#2e9e5b':'#d08a1e'}"><td>${c.ok?'✓':'⚠'}</td><td>${esc(String(c.n))}</td><td>${c.ok?'rendben':esc(c.msg)}</td></tr>`).join('')+`</table>`,()=>{},'Bezár');}
if(typeof STK_LAYERMENU!=='undefined')STK_LAYERMENU.push((L,items)=>{if(L.role==='sys:CINEMA'&&L.cinema){items.push({label:'🎬 Mozi beállítások…',act:()=>cinSetupDialog(L)},{label:'🎬 Mozi ellenőrzés…',act:()=>cinChecksDialog(L)},{label:'🎬 Javasolt helyek létrehozása',act:()=>cinMakeSpots(L)});}});
registerActions([{id:'cinema.layer',label:'Házimozi réteg',icon:'🎬',group:'Réteg',alias:'hazimozi mozi home cinema layer',
  hint:'Házimozi: válassz helyiséget, húzd meg a vászon vonalát, és a méretekből javaslatot kapsz a hangfalak, mélysugárzók, projektor helyére.',
  when:()=>true,run:()=>cinStart()}]);
window.cinCompute=cinCompute;window.cinSpotList=cinSpotList;

// ---- C5: the node checklist → the device tool → Kész ----------------------------------------------------------------------
// the keypads at the door and at the seat (§8.7: CAT6A to both)
if(!EP_CAT.some(x=>x.code==='CKP'))EP_CAT.push({code:'CKP',new:true,role:'sys:CINEMA',n:'Mozi kezelő (ajtó / ülés)',cat:'device',mount:'wall',h:1100,topo:'star',from:'rbx',
  vars:[{k:'cat',n:'Cat6A',cab:[{c:'CAT6A_U',w:'M20',fam:'CINEMA'}]}]});
ICO_BY_CODE.CKP='keypad';
// the rows of the list: what the layout needs (C5 catalogue in 30_MOZI.md); 5.1 still lists the rear pair as "előkészítés" (§6.3)
function cinNodes(L){const C=L&&L.cinema,r=C?cinCompute(L):null;if(!r)return [];const pj=r.in.disp!=='tv';
  return [{code:'CLR',n:'Front L / C / R',need:3},{code:'CSR',n:'Oldalsó surround Ls / Rs',need:2},
    {code:'CBK',n:'Hátsó surround Lb / Rb'+(C.fmt==='7.1'?'':' (5.1: előkészítés)'),need:2,opt:C.fmt!=='7.1'},
    {code:'CSW',n:'Mélysugárzó',need:r.subs.length},
    pj?{code:'CPJ',n:'Projektor',need:1}:{code:'CTV',n:'TV',need:1},pj?{code:'CSC',n:'Motoros vászon',need:1}:null,
    {code:'CRK',n:'AV rack',need:1},{code:'CKP',n:'Mozi kezelő (ajtó + ülés)',need:2}].filter(Boolean)
    .map(x=>Object.assign(x,{have:data.devices.filter(d=>d&&d.layer===L.id&&d.code===x.code).length}));}
// while placing a cinema code, the ghost snaps to the nearest suggestion of that code within 700 mm (Alt: free)
function cinSnap(g,code){if(!g||!/^C(LR|SR|BK|SW|PJ|SC|TV|RK|KP)$/.test(code))return null;const L=cinLayer();if(!L||!L.cinema)return null;
  let best=null,bd=700;cinSpotList(L).forEach(s=>{if(s.code!==code||s.level!==g.level)return;const d=Math.hypot(s.x-g.x,s.y-g.y);if(d<bd){bd=d;best=s;}});
  if(!best)return null;return Object.assign({},g,{x:best.x,y:best.y,h:best.h,why:best.why,snapped:true});}
function cinPlaceStart(L,code){state.activeLayer=L.id;lyrRefresh();epToolStart(code,'sys:CINEMA');}
// the floating list (bottom left of the stage) while the active layer is a cinema with a layout
function cinPanelSync(){let el=$('cinPanel');const L=lyrLayer(state.activeLayer),C=L&&L.role==='sys:CINEMA'&&L.cinema;
  if(!C||C.step==='done'){if(el)el.style.display='none';return;}
  if(!el){const host=(typeof stage!=='undefined'&&stage&&stage.parentElement)||document.body;el=document.createElement('div');el.id='cinPanel';
    el.style.cssText='position:absolute;right:10px;bottom:34px;z-index:20;background:rgba(255,255,255,.96);border:1px solid #c9bfe0;border-radius:6px;padding:5px 7px;font-size:11.5px;line-height:1.35;box-shadow:0 2px 8px rgba(0,0,0,.12);width:250px';   // bottom right: the plan is usually centred left of it
    host.appendChild(el);}
  el.style.display='block';let h;
  if(C.step!=='walls'){const N=cinNodes(L);
    h=`<b style="color:#5b3f8c">🎬 Mozi elemek</b><div style="color:#888;font-size:11px">Kattints egy sorra: az eszköz a javasolt helyre ugrik (Alt: szabadon).</div>`
      +N.map(x=>`<div class="cinRow" data-c="${x.code}" style="cursor:pointer;padding:2px 0;color:${x.have>=x.need?'#2e9e5b':x.opt?'#888':'#333'}">${x.have>=x.need?'☑':'☐'} ${esc(x.n)} <span style="float:right">${x.have} / ${x.need}</span></div>`).join('')
      +`<div style="margin-top:5px;text-align:right"><button id="cinDone">Kész → falak</button></div>`;}
  else h=`<b style="color:#5b3f8c">🎬 Mozi falak</b><div style="font-size:11px;color:#555;margin:2px 0 5px">Jelöld a falfelületeket, amelyeken a mozi kábelei futhatnak — a helyiség belső és KÜLSŐ oldala is, egészen az Elosztóig. Mennyezet / padló: a Mennyezeti út / Padló út szabályai.</div>`
      +`<button id="cinPen">🖊 Mozi fal toll</button> <button id="cinRoute">Útvonal + kör</button> <button id="cinBack">◂ elemek</button>`;
  if(el.__h!==h){el.innerHTML=h;el.__h=h;
    el.querySelectorAll('.cinRow').forEach(r=>r.onclick=()=>cinPlaceStart(L,r.dataset.c));
    if($('cinDone'))$('cinDone').onclick=()=>{if(typeof epToolOff==='function')epToolOff();C.step='walls';mkpStart('mozi');draw();};
    if($('cinPen'))$('cinPen').onclick=()=>mkpStart('mozi');
    if($('cinBack'))$('cinBack').onclick=()=>{C.step='place';if(typeof mkpOff==='function')mkpOff();draw();};
    if($('cinRoute'))$('cinRoute').onclick=()=>{if(typeof mkpOff==='function')mkpOff();cinRouteDialog(L);};}}
STK_OVERLAY.push(()=>{try{cinPanelSync();}catch(_){}return '';});

// ---- C6: the cinema walls (Mozi fal ink of the marker pen, 08ia: per face — the inner AND the outer side) ---------------
const CIN_INK={k:'mozi',n:'Mozi fal (felület)',net:'f',tag:'mozi',pol:'plus',col:'#5b3f8c'};
MRK_STYLE.mozi={c:'#5b3f8c',noText:true};   // the cinema purple; no label on every piece (the panel names it)
function cinFaceMarks(level){return mrkList().filter(m=>m.level===level&&(m.tags||[]).indexOf('mozi')>=0&&(m.kind==='vstrip'||m.kind==='side'));}
// the allowed face ranges [{wall, side, u0, u1}]: the Mozi fal marks; with useGeneral also both faces of every Vezethető fal
function cinAllowed(level,useGeneral){const out=[];
  cinFaceMarks(level).forEach(m=>{const r=mrkWallById(level,m.wall);if(!r)return;const L=mrkWallLen(r);
    out.push({wall:m.wall,side:m.side,u0:m.kind==='side'?0:Math.min(m.u0,m.u1),u1:m.kind==='side'?L:Math.max(m.u0,m.u1)});});
  if(useGeneral&&typeof rwlAllowed==='function')rwlAllowed(level).forEach(a=>{[1,-1].forEach(side=>out.push({wall:a.wall,side,u0:a.u0,u1:a.u1}));});
  return out;}
// the graph: the allowed pieces of the face net, split wherever a parallel piece within 700 mm starts or ends; the two
// faces of a wall are joined straight through it (cost thickness + 300). A wall may be a STACK of parallel wall records
// (P33: 105 + 95 + 100 mm layers), so the crossing goes face to face across the union — the low face (outward −) to the
// next high face (outward +) at the same position, ≤ 700 mm apart, solid wall all the way. Corners join by coinciding ends.
const CIN_THRU=700;
function cinGraph(level,useGeneral){const al=cinAllowed(level,useGeneral),net=wlnNet(level).f,pcs=[],walls=WALLS[level]||[];
  net.forEach(e=>{if(!e.wall||!e.side)return;const r=mrkWallById(level,e.wall);if(!r)return;
    const ua=mrkU(r,e.a[0],e.a[1]),ub=mrkU(r,e.b[0],e.b[1]),lo=Math.min(ua,ub),hi=Math.max(ua,ub);
    al.filter(a=>a.wall===e.wall&&a.side===e.side).forEach(a=>{const u0=Math.max(lo,a.u0),u1=Math.min(hi,a.u1);if(u1-u0<1)return;
      const A=mrkFacePt(r,e.side,u0,0),B=mrkFacePt(r,e.side,u1,0),hz=Math.abs(A[1]-B[1])<0.5,c=hz?(r.y0+r.y1)/2:(r.x0+r.x1)/2,across=hz?A[1]:A[0];
      pcs.push({hz,across,n:Math.sign(across-c)||1,a0:Math.min(hz?A[0]:A[1],hz?B[0]:B[1]),a1:Math.max(hz?A[0]:A[1],hz?B[0]:B[1])});});});
  const P=(p,t)=>p.hz?[t,p.across]:[p.across,t];
  const adj={},pt={},edges=[],link=(a,b,w,face)=>{(adj[a]=adj[a]||[]).push({to:b,w});(adj[b]=adj[b]||[]).push({to:a,w});if(face)edges.push({a,b});};
  const node=q=>{const k=wlnKey(q);pt[k]=q;return k;},byPos={};
  pcs.forEach(p=>{const cuts=new Set([p.a0,p.a1]);
    pcs.forEach(q=>{if(q.hz!==p.hz||Math.abs(q.across-p.across)>CIN_THRU)return;[q.a0,q.a1].forEach(t=>{if(t>p.a0+0.5&&t<p.a1-0.5)cuts.add(t);});});
    const ts=[...cuts].sort((a,b)=>a-b);
    for(let i=0;i+1<ts.length;i++){const a=node(P(p,ts[i])),b=node(P(p,ts[i+1]));link(a,b,ts[i+1]-ts[i],true);}
    ts.forEach(t=>{const g=(p.hz?'h':'v')+Math.round(t);(byPos[g]=byPos[g]||[]).push({across:p.across,n:p.n,k:wlnKey(P(p,t)),p,t});});});
  // a wall's END CAP (a face piece with no side, ≤ 700 mm) joins the faces around the end of a wall: free to turn on, never a foot
  net.forEach(e=>{if(!e.wall||e.side||e.len>CIN_THRU)return;const ka=wlnKey(e.a),kb=wlnKey(e.b);if(pt[ka]||pt[kb]){pt[ka]=pt[ka]||e.a;pt[kb]=pt[kb]||e.b;link(ka,kb,e.len);}});
  const solid=(x,y)=>walls.some(r=>x>=r.x0-0.5&&x<=r.x1+0.5&&y>=r.y0-0.5&&y<=r.y1+0.5);
  Object.values(byPos).forEach(L=>{L.sort((a,b)=>a.across-b.across);
    L.forEach(lo=>{if(lo.n!==-1)return;const hi=L.find(h=>h.n===1&&h.across>lo.across&&h.across-lo.across<=CIN_THRU);if(!hi)return;
      let ok=true;for(let c=lo.across+10;c<hi.across;c+=20){const q=P(lo.p,lo.t);if(!(lo.p.hz?solid(q[0],c):solid(c,q[1]))){ok=false;break;}}
      if(ok)link(lo.k,hi.k,hi.across-lo.across+300);});});
  return {adj,pt,pcs,edges};}
// the nearest point ON a face piece: {a, b (node keys), pt, d, wa, wb (walking distances to the two ends)}
function cinNearest(G,p){let best=null;G.edges.forEach(e=>{const A=G.pt[e.a],B=G.pt[e.b],r=wlnProj({a:A,b:B},p);
    if(!best||r.d<best.d)best={a:e.a,b:e.b,pt:r.pt,d:r.d,wa:Math.hypot(r.pt[0]-A[0],r.pt[1]-A[1]),wb:Math.hypot(r.pt[0]-B[0],r.pt[1]-B[1])};});return best;}
// maxA / maxB: how far a device may sit from the nearest allowed face point — a wall device or the board must be ON a
// marked face (600 mm), a ceiling / floor node joins the nearest one at its own height (Mennyezeti / Padló út: no limit)
function cinRoute(level,a,b,useGeneral,o){o=o||{};const G=cinGraph(level,useGeneral),s=cinNearest(G,a),t=cinNearest(G,b);if(!s||!t)return null;
  if(s.d>(o.maxA!=null?o.maxA:600)||t.d>(o.maxB!=null?o.maxB:600))return null;
  // two virtual nodes on the pieces: S (the start's foot) and T (the end's foot)
  const adj=Object.assign({},G.adj),pt=Object.assign({},G.pt,{S:s.pt,T:t.pt}),add=(a,b,w)=>{adj[a]=(adj[a]||[]).concat([{to:b,w}]);adj[b]=(adj[b]||[]).concat([{to:a,w}]);};
  add('S',s.a,s.wa);add('S',s.b,s.wb);add('T',t.a,t.wa);add('T',t.b,t.wb);
  if(s.a===t.a&&s.b===t.b)add('S','T',Math.hypot(s.pt[0]-t.pt[0],s.pt[1]-t.pt[1]));
  const dist={S:0},prev={},done={};
  for(;;){let u=null;for(const k in dist)if(!done[k]&&(u===null||dist[k]<dist[u]))u=k;if(u===null||u==='T')break;done[u]=true;
    (adj[u]||[]).forEach(n=>{const d=dist[u]+n.w;if(dist[n.to]===undefined||d<dist[n.to]){dist[n.to]=d;prev[n.to]=u;}});}
  if(dist.T===undefined)return null;const out=[];let k='T';while(k!==undefined){out.unshift(pt[k]);k=prev[k];}
  // drop collinear middle points
  const pts=[a].concat(out,[b]),clean=[pts[0]];for(let i=1;i<pts.length-1;i++){const p=clean[clean.length-1],q=pts[i],r=pts[i+1];
    if(Math.abs((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]))>1)clean.push(q);}clean.push(pts[pts.length-1]);
  return {pts:clean,len:dist.T+s.d+t.d};}
// a route → a Planner path on the cinema layer: up from the device to the run height, along, down to the other end
function cinPath(L,level,pts,hA,hB,hRun,tag){const nodes=[];const push=(p,h)=>nodes.push({level,x:Math.round(p[0]),y:Math.round(p[1]),h:Math.round(h)});
  push(pts[0],hA);if(Math.abs(hA-hRun)>1)push(pts[0],hRun);for(let i=1;i<pts.length-1;i++)push(pts[i],hRun);
  push(pts[pts.length-1],hRun);if(Math.abs(hB-hRun)>1)push(pts[pts.length-1],hB);
  return {ptype:'gege',level,layer:L.id,nodes,sections:nodes.slice(1).map(()=>({build:'sull_gege'})),cin:tag};}
function cinRunH(level){const g=guideByKey('gerinc');return g?resolveMm(g,level):Math.max(0,wallH(level)-250);}
// §7.2 — 5.1 modest: 2 circuits; 7.1 or two subs: 3. AV-1 rack B16 · AV-2 amplifier + subs C16 · AV-3 projector + screen B16
function cinCircuitDefault(L){const C=L.cinema,r=cinCompute(L);return (C.fmt==='7.1'||(r&&r.subs.length>=2))?3:2;}
const CIN_AV=[{k:'AV-1',n:'AV-1 rack (B16)',curve:'B',at:'CRK'},{k:'AV-2',n:'AV-2 erősítő + mélysugárzók (C16)',curve:'C',at:'CRK'},{k:'AV-3',n:'AV-3 projektor + vászon (B16)',curve:'B',at:'CPJ'}];
function cinRouteDialog(L){const C=L.cinema,def=cinCircuitDefault(L);
  openModal('🎬 Útvonal és dedikált kör',
    `<div class="mrow">Dedikált körök száma <select id="cinNC">${[1,2,3].map(n=>`<option ${n===def?'selected':''}>${n}</option>`).join('')}</select> <span style="font-size:11px;color:#888">(javaslat: ${def} — §7.2)</span></div>`
    +`<div class="mrow" style="font-size:11px;color:#666">Mind ugyanarról a fázisról és gyűjtősínről, saját A típusú 30 mA ÁVK-val (a szekrény AV csoportja). A mozi világítás nem kerül AV körre.</div>`,
    ()=>{const res=cinRouteAll(L,{circuits:+$('cinNC').value});
      $('hud').textContent=res.err?res.err:('Házimozi: '+res.paths+' pálya ('+Math.round(res.len/100)/10+' m), '+res.ded+' dedikált kör'+(res.miss.length?' · útvonal nélkül: '+res.miss.join(', '):''));},'Létrehozás');}
// everything at once, one undo step: the AV circuits at the rack / projector, the rack → Elosztó feed, every node → rack
function cinRouteAll(L,opt){opt=opt||{};const C=L.cinema,F=cinFrame(C);if(!F)return {err:'Nincs mozi beállítva.'};const lv=F.level;
  const devs=data.devices.filter(d=>d&&d.layer===L.id&&d.level===lv&&/^C(LR|SR|BK|SW|PJ|SC|TV|KP)$/.test(d.code||''));
  const rack=data.devices.find(d=>d&&d.layer===L.id&&d.code==='CRK');if(!rack)return {err:'Előbb helyezd el az AV rack-et (CRK).'};
  const board=data.devices.find(d=>d&&d.type==='board'&&d.level===lv&&!d.sub)||data.devices.find(d=>d&&d.type==='board'&&d.level===lv);
  let useG=!!C.useGeneral;
  const tryRoute=(a,b,o)=>cinRoute(lv,a,b,useG,o);
  // C7 A on prompt: when the cinema walls alone do not reach the Elosztó, ask once before the general walls are used
  if(board&&!tryRoute([rack.x,rack.y],[board.x,board.y])&&!useG){
    const n=typeof rwlAllowed==='function'?rwlAllowed(lv).length:0;
    if(n&&(opt.useGeneral!=null?opt.useGeneral:window.confirm('A mozi falak nem érik el az Elosztót. Használhatja a mozi útvonala az általános Vezethető falakat is? ('+n+' fal)'))){useG=true;C.useGeneral=true;}}
  pushUndo();
  // a re-run replaces this cinema's paths and AV circuits (in place: other code holds the arrays)
  for(let i=data.paths.length-1;i>=0;i--)if(data.paths[i]&&data.paths[i].cin&&data.paths[i].layer===L.id)data.paths.splice(i,1);
  for(let i=data.devices.length-1;i>=0;i--){const d=data.devices[i];if(d&&d.cin&&d.cin.av&&d.cin.of===L.id)data.devices.splice(i,1);}
  const hRun=cinRunH(lv),miss=[];let len=0,np=0,nd=0;
  // the AV circuits
  const nC=Math.max(1,Math.min(3,opt.circuits||cinCircuitDefault(L))),pj=devs.find(d=>d.code==='CPJ');
  CIN_AV.slice(0,nC).forEach((c,i)=>{const host=c.at==='CPJ'&&pj?pj:rack;
    const off=host===rack?(i-0.5)*300:0;   // along the rear wall (the frame tangent), 300 mm apart
    const g={level:lv,x:Math.round(host.x+F.t[0]*off),y:Math.round(host.y+F.t[1]*off),h:host===rack?300:host.h,mount:'wall',side:host.side,wall:host.wall};
    const d=epMake(g,'DED','sys:DED','g16');d.cin={av:c.k,of:L.id,phaseGroup:'AV',rcd:'AV',curve:c.curve};d.name=c.n;data.devices.push(d);nd++;});
  ensureIds(data);
  // rack → Elosztó (the dedicated circuits run with it)
  if(board){const r=tryRoute([rack.x,rack.y],[board.x,board.y]);
    if(r){data.paths.push(cinPath(L,lv,r.pts,rack.h||300,board.h||1600,hRun,{kind:'feed',from:rack.id,to:board.id}));np++;len+=r.len;}else miss.push('Elosztó');}
  else miss.push('Elosztó (nincs ezen a szinten)');
  // every node → rack: wall nodes along the cinema walls; ceiling / floor nodes join the nearest wall point at their height
  devs.forEach(d=>{const free=/^C(SW|PJ|SC)$/.test(d.code),r=tryRoute([d.x,d.y],[rack.x,rack.y],{maxA:free?1e9:600});if(!r){miss.push(d.code+' '+(d.ref||d.id));return;}
    const hn=d.code==='CSW'?0:(d.code==='CPJ'||d.code==='CSC')?(d.h||hRun):(d.h||1100),run=d.code==='CSW'?0:hRun;
    data.paths.push(cinPath(L,lv,r.pts,hn,rack.h||300,run,{kind:'node',from:d.id,to:rack.id}));np++;len+=r.len;});
  ensureIds(data);if(typeof cinWApply==='function')cinWApply(L);   // C7: the pipes and cables of the new paths, same undo step
  C.step='done';draw();renderLayers();
  return {paths:np,ded:nd,len,miss};}
// the room carries a cinema → the Dedikált körök layer asks for a DED there (05t derived tick)
function cinRoomIds(){return cinLayers().filter(L=>L.cinema).map(L=>L.cinema.room);}
window.cinRoute=cinRoute;window.cinRouteAll=cinRouteAll;window.cinNodes=cinNodes;
