// ==========================================================================
// 08rb-cinema-wire.js — round 2026-10-18 (docs/round-2026-10-18), WP-C7: the cinema wiring list, the CINEMA family
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// The cinema's own pass after C6 has drawn its paths: one row per node with its cables (guide §6.2), the speaker
// section sized once for every channel (§6.1), the signal conduit sized by the guide's own fill (§5.2: one cable 53 %,
// two 31 %, three or more 40 %; an HDMI head needs Ø40, §5.1) and the mains in a SEPARATE conduit (§6.2). The signal
// pipes are family CINEMA, the mains MAINS (they stay Erősáram: the cabinet's AV group, 05x). Written into the paths'
// sec.cont like 05w (src 'cin:<layer id>') plus data.runs stage 'cinema'. §5.5 separation is an info check.
// Lengths: path + 500 mm per end, tájékoztató (as 05w). Prefix: cinW / cinSep.

AFILL_FAMS.CINEMA={n:'Házimozi',cls:'sig',c:'#5b3f8c'};
Object.assign(AFILL_CABLES,{SPK2x40:{n:'Hangszóró 2×4',od:9.5/*r*/},SPK2x60:{n:'Hangszóró 2×6',od:11/*r*/},
  LFE:{n:'LFE koax (RG6 típus)',od:6.9},TRIG2x075:{n:'Vezérlő érpár 2×0,75',od:5.5/*r*/}});
// the speaker cables by section (mm²)
const CINW_SPK=[[1.5,'SPK2x15'],[2.5,'SPK2x25'],[4,'SPK2x40'],[6,'SPK2x60']];
// §5.2 k by the number of cables
function cinWK(n){return n<=1?0.53:n===2?0.31:0.40;}
// the guide's conduit: the smallest corrugated size whose area holds Σ cable area / k, never below the heads' minimum
function cinWSize(cables,minK){const real=cables.filter(c=>AFILL_CABLES[c.c]&&!AFILL_CABLES[c.c].empty);let need=minK?afillCondIx(minK):0;
  cables.forEach(c=>{const C=AFILL_CABLES[c.c];if(C&&C.minW)need=Math.max(need,afillCondIx(C.minW));});
  const n=real.reduce((s,c)=>s+(c.n||1),0),area=real.reduce((s,c)=>s+(c.n||1)*afillArea(AFILL_CABLES[c.c].od),0),k=cinWK(n);
  const lbl=cables.map(c=>((c.n||1)>1?c.n+'×':'')+afillCabName(c.c)).join(' + ');
  for(let i=need;i<AFILL_CONDUITS.length;i++){const C=AFILL_CONDUITS[i],f=area/afillArea(C.id);
    if(f<=k+1e-9)return {size:C.k,fill:+f.toFixed(3),why:lbl+': '+Math.round(f*100)+' % ≤ '+Math.round(k*100)+' %'+(i===need&&need>0?' (min. '+C.k+')':'')+' → '+C.k};}
  const C=AFILL_CONDUITS[AFILL_CONDUITS.length-1];return {size:C.k,fill:+(area/afillArea(C.id)).toFixed(3),why:lbl+': túltelített M63 is',over:true};}
// §6.1: A ≥ 0.712 · l / Z_min, the same section on every channel (the longest run decides)
function cinWSpk(lMax,zMin){const A=0.712*lMax/(zMin||4),hit=CINW_SPK.find(s=>s[0]>=A-1e-9)||CINW_SPK[CINW_SPK.length-1];
  return {A:+A.toFixed(2),mm2:hit[0],cable:hit[1],over:A>CINW_SPK[CINW_SPK.length-1][0]+1e-9};}
function cinWRef(d){const r=d.ref||(typeof epRef==='function'?epRef(d):'');return r?r+' ('+d.id+')':d.id;}
function cinWPathLen(p){let s=0;for(let i=1;i<p.nodes.length;i++){const a=p.nodes[i-1],b=p.nodes[i];s+=Math.hypot(b.x-a.x,b.y-a.y,(b.h||0)-(a.h||0));}return s;}
// which AV circuit feeds what (§7.2 / §7.4): 1 circuit = all on AV-1; 2 = subs on AV-2, projector on AV-1; 3 = projector + screen on AV-3
function cinWCkt(nC,what){if(what==='sub')return nC>=2?'AV-2':'AV-1';if(what==='pj')return nC>=3?'AV-3':'AV-1';return 'AV-1';}
const CINW_SIG={CLR:'spk',CSR:'spk',CBK:'spk'};
// → {rows:[{dev, code, ref, path, len, sig:{cables,size,fill,why}, mains?:{…, ckt}, notes[]}], spk, feed, warns}
function cinWiring(L){const C=L&&L.cinema;if(!C)return null;const pathOf=(kind,id)=>data.paths.find(p=>p&&p.layer===L.id&&p.cin&&p.cin.kind===kind&&p.cin.from===id);
  const devs=data.devices.filter(d=>d&&d.layer===L.id&&/^C(LR|SR|BK|SW|PJ|SC|TV|KP)$/.test(d.code||'')).sort((a,b)=>prtIdCmp(a.id,b.id));
  const nC=data.devices.filter(d=>d&&d.cin&&d.cin.av&&d.cin.of===L.id).length||cinCircuitDefault(L),warns=[];
  const lenOf=p=>p?Math.round(cinWPathLen(p)+2*AFILL_RULE.slackPerEnd):null;
  const spkLens=devs.filter(d=>CINW_SIG[d.code]).map(d=>lenOf(pathOf('node',d.id))).filter(x=>x!=null);
  const spk=cinWSpk(spkLens.length?Math.max(...spkLens)/1000:0,C.zMin||4);
  if(spk.over)warns.push({sev:'warn',msg:'Hangszórókábel: '+spk.A+' mm² kellene — 6 mm²-nél vastagabb; rövidebb út vagy erősítő a hangfal közelében.'});
  const rows=devs.map(d=>{const p=pathOf('node',d.id),len=lenOf(p),notes=[];let sig=[],mains=null,minK=null;
    if(CINW_SIG[d.code]){sig=[{c:spk.cable,n:1}];if(d.code==='CBK'&&C.fmt!=='7.1')notes.push('5.1: előkészítés — a hátsó pár kábelét most húzd be (§6.3).');}
    else if(d.code==='CSW'){sig=[{c:'LFE',n:1}];minK='M25';mains={c:'NYM3x25',ckt:cinWCkt(nC,'sub')};
      if(len!=null&&len>10000)notes.push('10 m felett szimmetrikus (XLR) LFE (§6.2).');}
    else if(d.code==='CPJ'){sig=[{c:'AOC_FIX',n:1},{c:'CAT6A_U',n:1},{c:'SPARE',n:1}];minK='M40';mains={c:'NYM3x25',ckt:cinWCkt(nC,'pj')};}
    else if(d.code==='CSC'){sig=[{c:'TRIG2x075',n:1},{c:'CAT6A_U',n:1}];mains={c:'NYM3x15',ckt:cinWCkt(nC,'pj')};notes.push('Cat6A a vászonhoz: hálózati vezérlés (§6.3).');}
    else if(d.code==='CTV'){sig=[{c:'AOC_FIX',n:1},{c:'CAT6A_U',n:1}];minK='M40';mains={c:'NYM3x25',ckt:'AV-1'};}
    else if(d.code==='CKP')sig=[{c:'CAT6A_U',n:1}];
    const S=Object.assign({cables:sig},cinWSize(sig,minK));
    const M=mains?Object.assign({cables:[{c:mains.c,n:1}],ckt:mains.ckt},cinWSize([{c:mains.c,n:1}],'M20')):null;
    if(!p)notes.push('Nincs útvonal — futtasd az Útvonal + kör lépést.');
    return {dev:d.id,code:d.code,ref:cinWRef(d),path:p?p.id:null,len,sig:S,mains:M,notes};});
  // matched LFE lengths (§6.2)
  const sw=rows.filter(r=>r.code==='CSW'&&r.len!=null);if(sw.length>=2){const a=Math.min(...sw.map(r=>r.len)),b=Math.max(...sw.map(r=>r.len));
    if(b-a>1000)warns.push({sev:'info',msg:'Mélysugárzók: az LFE kábelek hossza '+(a/1000).toFixed(1)+' és '+(b/1000).toFixed(1)+' m — egyezzenek, vagy a processzor kompenzálja (§6.2).'});}
  // the rack: its AV circuits to the Elosztó (mains, its own pipe) and 2 × Cat6A to the network
  const rack=data.devices.find(d=>d&&d.layer===L.id&&d.code==='CRK'),fp=rack?pathOf('feed',rack.id):null;
  const feed=rack?{dev:rack.id,ref:cinWRef(rack),path:fp?fp.id:null,len:lenOf(fp),to:fp?fp.cin.to:null,
    mains:Object.assign({cables:[{c:'NYM3x25',n:nC}],ckt:CIN_AV.slice(0,nC).map(c=>c.k).join(' + ')},cinWSize([{c:'NYM3x25',n:nC}],'M25')),
    data:{cables:[{c:'CAT6A_U',n:2}],note:'a hálózati rackig — az Adat / PoE réteg útján'}}:null;
  if(rack&&!fp)warns.push({sev:'warn',msg:'AV rack: nincs útvonal az Elosztóig.'});
  return {layer:L.id,fmt:C.fmt,zMin:C.zMin||4,nC,spk,rows,feed,warns};}

// ---- apply: the pipes into the paths (05w's sec.cont, src 'cin:<layer>') and the runs (stage 'cinema') ----------------------
function cinWApply(L,W){W=W||cinWiring(L);if(!W)return 0;const src='cin:'+L.id;afillDropSrc(src);
  data.runs=afillRuns().filter(r=>!(r.stage==='cinema'&&r.layer===L.id));let n=0;
  const put=(pid,key,fam,P,from,to,len)=>{const p=pathById(pid);if(!p)return;
    afillPutPipe({key,fam,size:P.size,fill:P.fill,cables:P.cables,segs:afillSegsOf(p)},src,'');
    P.cables.forEach(c=>{if(AFILL_CABLES[c.c]&&AFILL_CABLES[c.c].empty)return;
      afillRuns().push({stage:'cinema',layer:L.id,fam,from,to,via:afillSegsOf(p).map(s=>({p:s.p,a:s.a,b:s.b})),cable:{c:c.c,n:c.n||1},len,pipe:key});n++;});};
  W.rows.forEach(r=>{if(!r.path)return;const rack=(pathById(r.path).cin||{}).to;
    put(r.path,'CIN|'+r.dev,'CINEMA',r.sig,r.dev,rack,r.len);if(r.mains)put(r.path,'MAINS|'+r.dev+'|'+r.mains.ckt,'MAINS',r.mains,r.dev,rack,r.len);});
  if(W.feed&&W.feed.path)put(W.feed.path,'MAINS|'+W.feed.dev+'|AV','MAINS',W.feed.mains,W.feed.dev,W.feed.to,W.feed.len);
  return n;}

// ---- §5.5 separation: a cinema signal run parallel to an Erősáram path closer than 300 mm (screened only: 150 mm) ------------
const CINW_SCREENED=new Set(['LFE','AOC_FIX','AOC_DET','CAT6A_S']);
function cinSepLimit(cables){return cables.some(c=>!CINW_SCREENED.has(c.c)&&!(AFILL_CABLES[c.c]||{}).empty)?300:150;}
function cinSepMainsPath(p){if(!p||p.cin||!p.nodes||p.nodes.length<2)return false;const l=typeof lyrLayer==='function'?lyrLayer(p.layer):null;
  return !l||!l.role||mnsIs(l.role);}
function cinSepSegs(p){const out=[];for(let i=1;i<p.nodes.length;i++){const a=p.nodes[i-1],b=p.nodes[i];
  if(a.level!==b.level||Math.hypot(b.x-a.x,b.y-a.y)<200)continue;out.push({a,b,level:a.level,h:((a.h||0)+(b.h||0))/2});}return out;}
// parallel (≤ 10°), plan + height offset under the limit, overlapping ≥ 500 mm → the overlap length
function cinSepPair(s,m,lim){if(s.level!==m.level)return 0;const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,l=Math.hypot(dx,dy),ux=dx/l,uy=dy/l;
  const mx=m.b.x-m.a.x,my=m.b.y-m.a.y,ml=Math.hypot(mx,my);if(Math.abs(ux*my-uy*mx)/ml>Math.sin(10*Math.PI/180))return 0;
  const off=Math.abs(-uy*(((m.a.x+m.b.x)/2)-s.a.x)+ux*(((m.a.y+m.b.y)/2)-s.a.y)),d=Math.hypot(off,m.h-s.h);if(d>=lim)return 0;
  const t1=ux*(m.a.x-s.a.x)+uy*(m.a.y-s.a.y),t2=ux*(m.b.x-s.a.x)+uy*(m.b.y-s.a.y);
  const ov=Math.min(l,Math.max(t1,t2))-Math.max(0,Math.min(t1,t2));return ov>=500?ov:0;}
function cinSepChecks(L,W){W=W||cinWiring(L);if(!W)return [];const out=[];
  const mains=data.paths.filter(cinSepMainsPath).map(p=>({p,segs:cinSepSegs(p)}));
  W.rows.forEach(r=>{const p=r.path&&pathById(r.path);if(!p)return;const lim=cinSepLimit(r.sig.cables),ss=cinSepSegs(p);
    mains.forEach(M=>{let ov=0;ss.forEach(s=>M.segs.forEach(m=>{ov+=cinSepPair(s,m,lim);}));
      if(ov)out.push({sev:'info',code:'cin.sep',ref:r.dev,msg:'Házimozi '+r.ref+': a jelvezeték '+(ov/1000).toFixed(1).replace('.',',')+' m hosszan '+lim+' mm-nél közelebb fut az erősáramú '+M.p.id+' pályához — §5.5: '+(lim===300?'árnyékolatlan jel 300 mm':'árnyékolt jel 150 mm')+', keresztezés 90°-ban.'});});});
  return out;}
(STK_CHECKS['sys:CINEMA']=STK_CHECKS['sys:CINEMA']||[]).push(()=>{const out=[];cinLayers().forEach(L=>{if(!L.cinema)return;const W=cinWiring(L);
  W.warns.forEach(w=>out.push(w));cinSepChecks(L,W).forEach(w=>out.push(w));});return out;});

// ---- UI: the wiring list ------------------------------------------------------------------------------------------------------
function cinWireDialog(L){const W=cinWiring(L);if(!W)return;const m=x=>x==null?'—':(x/1000).toFixed(1).replace('.',',')+' m';
  const cab=cs=>cs.map(c=>((c.n||1)>1?c.n+' × ':'')+esc(afillCabName(c.c))).join(' + ');
  const sep=cinSepChecks(L,W);
  openModal('🎬 Házimozi — kábellista (§6)',
    `<div class="mrow" style="font-size:12px">Hangszórókábel minden csatornán: <b>${String(W.spk.mm2).replace('.',',')} mm²</b> (A ≥ 0,712 · l / Z = ${String(W.spk.A).replace('.',',')} mm²) · Z<sub>min</sub> <select id="cinZ"><option ${W.zMin===4?'selected':''} value="4">4 Ω</option><option ${W.zMin===8?'selected':''} value="8">8 Ω</option></select> · ${W.nC} AV kör</div>`
    +`<div style="max-height:360px;overflow:auto"><table style="font-size:11.5px;width:100%"><tr><th align="left">Végpont</th><th align="left">Jel (CINEMA)</th><th>Cső</th><th align="left">230 V (külön cső)</th><th>Hossz</th></tr>`
    +W.rows.map(r=>`<tr><td>${esc(r.ref)}</td><td>${cab(r.sig.cables)}</td><td align="center" title="${esc(r.sig.why)}">${r.sig.size}</td>`
      +`<td>${r.mains?cab(r.mains.cables)+' · '+r.mains.ckt+' · '+r.mains.size:''}</td><td align="center">${m(r.len)}</td></tr>`
      +(r.notes.length?`<tr><td></td><td colspan="4" style="color:var(--pc-mute,#888)">${r.notes.map(esc).join(' ')}</td></tr>`:'')).join('')
    +(W.feed?`<tr><td><b>${esc(W.feed.ref)}</b> → Elosztó</td><td>2 × Cat6A U/FTP <span style="color:var(--pc-mute,#888)">(${esc(W.feed.data.note)})</span></td><td></td><td>${cab(W.feed.mains.cables)} · ${esc(W.feed.mains.ckt)} · ${W.feed.mains.size}</td><td align="center">${m(W.feed.len)}</td></tr>`:'')
    +`</table></div>`
    +W.warns.concat(sep).map(x=>`<div style="color:${x.sev==='info'?'var(--pc-dim,#666)':'var(--pc-warn,#b05a00)'};font-size:11.5px">${x.sev==='info'?'ℹ':'⚠'} ${esc(x.msg)}</div>`).join('')
    +`<div class="mrow" style="font-size:11px;color:var(--pc-mute,#888)">Cső: §5.2 (1 kábel 53 %, 2 kábel 31 %, 3+ 40 %), HDMI fej → Ø40 (§5.1). Minden csőben behúzószál. Hossz: pálya + 2 × ${AFILL_RULE.slackPerEnd} mm, tájékoztató.</div>`,
    ()=>{pushUndo(['paths','runs']);const n=cinWApply(L,cinWiring(L));draw();$('hud').textContent='Házimozi: '+n+' kábel a mozi csöveiben.';},'Csövekbe írás');
  $('cinZ').onchange=()=>{L.cinema.zMin=+$('cinZ').value;closeModal();cinWireDialog(L);};}
if(typeof STK_LAYERMENU!=='undefined')STK_LAYERMENU.push((L,items)=>{if(L.role==='sys:CINEMA'&&L.cinema)items.push({label:'🎬 Kábellista…',act:()=>cinWireDialog(L)});});
registerActions([{id:'cinema.wiring',label:'Házimozi kábellista',icon:'🎬',group:'Feltöltés',alias:'hazimozi kabellista cinema wiring cable list',
  hint:'A mozi végpontjainak kábelei (§6.2), a közös hangszórókábel-keresztmetszet (§6.1), a csőméretek (§5.2) és az erősáram-távolság (§5.5).',
  need:'Előbb egy Házimozi réteg kell.',when:()=>cinLayers().some(L=>L.cinema),run:()=>{const L=lyrLayer(state.activeLayer);cinWireDialog(L&&L.role==='sys:CINEMA'&&L.cinema?L:cinLayers().find(x=>x.cinema));}}]);

window.cinWiring=cinWiring;window.cinWApply=cinWApply;window.cinWSize=cinWSize;window.cinWSpk=cinWSpk;window.cinSepChecks=cinSepChecks;window.cinSepPair=cinSepPair;window.cinWPathLen=cinWPathLen;
