const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),
           path.join(__dirname,'..','planner.html'),
           path.join(__dirname,'..','varler_planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const HTML=findPlanner();
const dom=new JSDOM(fs.readFileSync(HTML,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;const $=id=>w.document.getElementById(id);
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  const lvl='ground';w.confirm=()=>true;w.alert=()=>{};
  w.newBlankProject();
  const D=w.__data,WA=w.__getWalls()[lvl];
  const cats='{path:true,device:true,cable:true,wall:true,build:true,object:true}';
  w.eval(`layers.push({id:'L5',name:'Új pályák',visible:true,cats:${cats}},{id:'L4',name:'Régi pályák',visible:false,cats:${cats}},{id:'Lold',name:'Régi kiosztás',visible:false,cats:${cats}})`);
  WA.push({x0:0,y0:2950,x1:4000,y1:3050});
  D.floors.push({level:lvl,name:'NAPPALI',num:'1.02',poly:[[0,0],[4000,0],[4000,3000],[0,3000]]});
  const add=o=>{D.devices.push(Object.assign({level:lvl,h:300,layer:'L0'},o));w.ensureIds(D);return D.devices[D.devices.length-1];};
  const s1=add({type:'socket',ref:'D1',x:1000,y:2950,side:0});
  const s2=add({type:'socket',ref:'D2',x:1072,y:2950,side:0});
  const k1=add({type:'switch',ref:'K1',x:2000,y:2950,h:1100,side:0});     // straight above D3
  const s3=add({type:'socket',ref:'D3',x:2000,y:2950,side:0});
  const kd=add({type:'junction',ref:'KD1',x:1500,y:1500,h:2500});
  const lamp=add({type:'light',ref:'L1',x:3000,y:1500,h:2700});
  const s4=add({type:'socket',ref:'D4',x:3500,y:2950,side:0});            // no route reaches it
  const el=add({type:'board',ref:'EL1',x:500,y:500,h:2000});
  const ghost=add({type:'socket',ref:'DX',x:2600,y:2950,side:0,layer:'Lold'});   // a hidden layout
  const N=(x,y,h)=>({level:lvl,x,y,h});
  // the new proposal: one ceiling route with a node over each box it serves
  D.paths.push({ptype:'mbcu',layer:'L5',nodes:[N(500,500,2700),N(1000,2950,2700),N(1072,2950,2700),N(1500,1500,2700),
    N(2000,2950,2700),N(2600,2950,2700),N(3020,1500,2700),N(3800,200,2700)],sections:Array(7).fill(0).map(()=>({build:'sull_gege',circuit:null}))});
  // the old proposal, on a hidden layer, over D1 too
  D.paths.push({ptype:'mbcu',layer:'L4',nodes:[N(1000,2950,2500),N(1000,2000,2500)],sections:[{build:'sull_gege',circuit:null}]});
  w.ensureIds(D);
  const P5=D.paths[0],P4=D.paths[1],nd=k=>P5.nodes[k];
  w.setLink(kd,P5.id,nd(3).id);                                            // a hand-made (glued) link already there
  w.draw();
  const A={rm:D.floors[0],src:'F',i:0,level:lvl};
  const di=d=>D.devices.indexOf(d);
  const pairOf=(plan,d)=>plan.pairs.filter(q=>q.i===di(d));

  // ---------- planning ----------
  ok('route layers are listed with their path counts',(function(){const L=w.routeLayers([lvl]);
    return L.map(x=>x.id+':'+x.paths).join()==='L5:1,L4:1';})(),w.routeLayers([lvl]).map(x=>x.id).join());
  let plan=w.planAutoLink([A]);
  ok('by default only visible route layers are used',plan.layers.join()==='L5');
  ok('a ceiling node over a socket links it, whatever the height',pairOf(plan,s1).length===1&&pairOf(plan,s1)[0].n===nd(1).id&&pairOf(plan,s1)[0].dh===2400);
  ok('each box in a row gets its own node',pairOf(plan,s2).length===1&&pairOf(plan,s2)[0].n===nd(2).id);
  ok('a node 20 mm off the lamp still counts',pairOf(plan,lamp).length===1);
  ok('a node over two stacked boxes is asked about, not guessed',plan.amb.length===1&&plan.amb[0].n===nd(4).id
    &&plan.amb[0].cands.map(o=>o.i).join()===[di(k1),di(s3)].join());
  ok('the glued link counts as already done',plan.already===1&&!pairOf(plan,kd).length);
  ok('the Elosztó is never linked by position',!pairOf(plan,el).length);
  ok('a box on a hidden layout layer is left alone',!pairOf(plan,ghost).length&&plan.unreached.indexOf(di(ghost))<0);
  ok('a box no route reaches is reported',plan.unreached.join()===String(di(s4)),plan.unreached.join());
  ok('a box whose clip row is reached is not reported',(function(){
    const mate=add({type:'socket',ref:'D2b',x:1144,y:2950,side:0,clip:'cX'});s2.clip='cX';
    const p=w.planAutoLink([A]);const r=p.unreached.indexOf(di(mate))<0&&p.unreached.indexOf(di(s4))>=0;
    D.devices.pop();delete s2.clip;return r;})());
  ok('a tighter tolerance drops the lamp',!pairOf(w.planAutoLink([A],{tol:15}),lamp).length);
  ok('a stack under a ceiling node pre-selects the box nearest in height',plan.amb[0].kind==='height'&&plan.amb[0].def===String(di(k1)));
  ok('a node drawn at a box height picks that box, no question',(function(){
    D.paths.push({ptype:'mbcu',layer:'L5',nodes:[N(2000,2950,320),N(2000,2000,320)],sections:[{build:'sull_gege',circuit:null}]});w.ensureIds(D);
    const P=D.paths[D.paths.length-1],p=w.planAutoLink([A]);const q=p.pairs.find(x=>x.p===P.id&&x.n===P.nodes[0].id);
    D.paths.pop();return q&&q.i===di(s3)&&q.byHeight===true&&!p.amb.some(a=>a.p===P.id);})());
  ok('the same box on two layouts is a tie; choosing the device layer clears it',(function(){
    w.eval(`layers.push({id:'Lnew',name:'Új kiosztás',visible:true,cats:${cats}})`);
    const dup=add({type:'socket',ref:'D1b',x:1000,y:2950,side:0,layer:'Lnew'});
    const p=w.planAutoLink([A]),a=p.amb.find(x=>x.n===nd(1).id);
    const p2=w.planAutoLink([A],{devLayers:['L0']});
    const fine=pairOf(p2,s1).length===1&&!p2.amb.some(x=>x.n===nd(1).id)&&!pairOf(p2,dup).length;
    D.devices.pop();w.eval('layers.pop()');
    return a&&a.kind==='tie'&&a.def==='all'&&fine;})());
  ok('the hidden old proposal can be chosen explicitly',(function(){const p=w.planAutoLink([A],{layers:['L4']});
    return pairOf(p,s1).length===1&&pairOf(p,s1)[0].p===P4.id;})());
  ok('planning changes nothing',!w.devLinks(s1).length&&P5.nodes[1].h===2700);

  // ---------- apply ----------
  let n=w.applyAutoLink(plan,{0:'all'});
  ok('apply adds the links',n===5,n);                                      // D1, D2, L1 + K1 and D3 on the shared node
  ok('auto links are plan-only, not glued',(function(){const l=w.devLinks(s1)[0];return l&&l.p===P5.id&&l.n===nd(1).id&&!l.glue;})());
  ok('the stacked pair both hold the node when "mindegyik" is chosen',w.hasLinkTo(k1,P5.id,nd(4).id)&&w.hasLinkTo(s3,P5.id,nd(4).id));
  ok('nothing moved',P5.nodes.map(q=>q.h).every(h=>h===2700)&&s1.x===1000&&s1.h===300&&P5.nodes[1].x===1000);
  ok('the glued link is still one link, still glued',w.devLinks(kd).length===1&&w.devLinks(kd)[0].glue===true);
  ok('the Pályák check counts the unlinked boxes',(function(){w.setStage('paths');w.renderShell();
    return /2 készülék nincs pályához kötve/.test($('inspector').textContent);})(),$('inspector').textContent.match(/\d+ készülék nincs pályához kötve/));

  // ---------- one box, two proposals ----------
  ok('linking the old proposal too keeps the new one',(function(){
    w.applyAutoLink(w.planAutoLink([A],{layers:['L4']}));
    return w.hasLinkTo(s1,P5.id,nd(1).id)&&w.hasLinkTo(s1,P4.id,P4.nodes[0].id)&&w.devLinks(s1).length===2;})());
  ok('re-linking a layer replaces only that layer\'s auto links',(function(){
    const before=w.devLinks(s1).length;const p=w.planAutoLink([A]);w.applyAutoLink(p,{0:'all'});
    return p.dropped===5&&w.devLinks(s1).length===before&&w.devLinks(kd).length===1;})());
  ok('without replace, existing links are just counted',(function(){const p=w.planAutoLink([A],{replace:false});
    return !p.pairs.length&&!p.amb.length&&p.already===6;})());
  ok('a route moved off a box loses that box on re-link',(function(){P5.nodes[2].x+=300;
    const p=w.planAutoLink([A]);w.applyAutoLink(p,{0:'all'});
    const lost=!w.hasLinkTo(s2,P5.id,nd(2).id);P5.nodes[2].x-=300;w.applyAutoLink(w.planAutoLink([A]),{0:'all'});return lost;})());
  ok('picking one box for the shared node links only that one',(function(){
    const p=w.planAutoLink([A]);w.applyAutoLink(p,{0:String(di(s3))});
    return w.hasLinkTo(s3,P5.id,nd(4).id)&&!w.hasLinkTo(k1,P5.id,nd(4).id);})());

  // ---------- behaviour of plan-only links ----------
  ok('moving the box drags a plan-only node in plan, never in height',(function(){s1.x=1030;w.wvPushLinkedNodes([di(s1)]);
    const q=P5.nodes[1];const r=q.x===1030&&q.h===2700;s1.x=1000;w.wvPushLinkedNodes([di(s1)]);return r;})());
  ok('a glued node follows the box in height too',(function(){kd.h=2400;w.wvPushLinkedNodes([di(kd)]);const r=nd(3).h===2400;
    kd.h=2500;w.wvPushLinkedNodes([di(kd)]);return r;})());
  ok('dragging a ceiling node never pulls the socket',(function(){P5.nodes[1].x=1200;w.wvPullLinkedDev(0,1);
    const r=s1.x===1000&&s1.h===300;P5.nodes[1].x=1000;return r;})());
  ok('the connectivity graph sees every link',(function(){const g=w.connectivity();
    return (g.at[P5.id+'/'+nd(1).id]||[]).includes(s1.id)&&(g.at[P4.id+'/'+P4.nodes[0].id]||[]).includes(s1.id);})());
  ok('a span ends at a box by link',(function(){const t=w.terminalAtNode(P5,nd(2));return t&&t.dev===s2&&t.how==='link';})());

  // ---------- undo, save, delete ----------
  ok('one undo takes back one apply',(function(){const before=JSON.stringify(D.devices.map(d=>w.devLinks(d)));
    w.applyAutoLink(w.planAutoLink([A],{layers:['L5'],replace:true}),{0:'none'});
    const mid=JSON.stringify(w.__data.devices.map(d=>w.devLinks(d)));w.doUndo();
    return mid!==before&&JSON.stringify(w.__data.devices.map(d=>w.devLinks(d)))===before;})());
  ok('links survive a save and reload',(function(){const o=JSON.parse(JSON.stringify(w.sessionObj()));w.applyProjectData(o);
    const d=w.__data.devices.find(x=>x.id===s1.id);return w.devLinks(d).length===2&&w.linkTargets(d).length===2;})());
  ok('deleting the old proposal drops only its links',(function(){const d=w.__data;
    d.paths.splice(d.paths.findIndex(p=>p.id===P4.id),1);w.pruneLinks();
    const x=d.devices.find(y=>y.id===s1.id);return w.devLinks(x).length===1&&w.devLinks(x)[0].p===P5.id;})());

  // ---------- surfaces ----------
  const Dv=w.__data;
  ok('the room action sits in Helyiség and needs a room',(function(){const a=w.ACTIONS.find(x=>x.id==='room.autolink');
    w.__setSel(null);return a&&a.group==='Helyiség'&&!w.runAction('room.autolink');})());
  ok('the whole-plan action is offered in the Pályák stage',(function(){w.setStage('paths');w.__setSel(null);w.renderShell();
    return !!$('inspector').querySelector('.insA[data-id="rooms.autolink"]');})());
  ok('the room right-click menu offers Pálya-kötés',w.roomMenuItems({rm:Dv.floors[0],src:'F',i:0,level:lvl}).some(it=>/Pálya-kötés/.test(it.label)));
  ok('a selected device shows its links in the inspector',(function(){w.__setSel({t:'devices',i:Dv.devices.findIndex(x=>x.id===s1.id),level:lvl});
    w.renderShell();const t=$('inspector').textContent;return /Pálya-kötés/.test(t)&&/1 csomópont/.test(t)&&/Új pályák/.test(t);})());
  w.__setSel({t:'floors',i:0,level:lvl});
  ok('the dialog lists route layers (only those with routes), new links and the shared node',(function(){w.runAction('room.autolink');
    return $('alPrev')&&document_has('.alLay',1)&&document_has('.alDev',2)
      &&!w.document.querySelector('.alDev[value="Lold"]').checked&&!!$('alPrev').querySelector('select[data-amb]')&&/D4/.test($('alPrev').textContent);})());
  function document_has(sel,n){return w.document.querySelectorAll(sel).length===n;}
  ok('unticking every layer asks for one',(function(){w.document.querySelectorAll('.alLay').forEach(c=>{c.checked=false;c.onchange();});
    const r=/Válassz legalább egy réteget/.test($('alPrev').textContent);
    const c5=[...w.document.querySelectorAll('.alLay')].find(c=>c.value==='L5');c5.checked=true;c5.onchange();return r;})());
  ok('Kötés applies the choice made in the dialog',(function(){const s=$('alPrev').querySelector('select[data-amb]');
    const k=w.__data.devices.findIndex(x=>x.id===k1.id);s.value=String(k);$('mOk').onclick();
    const K=w.__data.devices[k],S=w.__data.devices.find(x=>x.id===s3.id);
    return w.hasLinkTo(K,P5.id,nd(4).id)&&!w.hasLinkTo(S,P5.id,nd(4).id);})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
