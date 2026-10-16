// WP-S1 (round 2026-10-10): the stack layer right-click menu + Info.
//
// Fixture: the committed P33 v2 plan (a BRIDGE Stack with 17 role layers).
// What must hold:
//   * a role layer's menu (panel row and rail stage button) carries Info and Tartalom törlése with the
//     right count; a plain layer gets none of the stack items;
//   * clearing a layer removes every item on it (walls included), keeps the layer, prunes circuit
//     members, and one undo brings everything back exactly; a locked layer refuses;
//   * the Info lists the role's catalogue codes live and its purpose text; every role has a text.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const PLAN=path.join(__dirname,'..','..','..','..','Calculator','P33-teszt_v2.vplan.json');
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};
  const doc=JSON.parse(fs.readFileSync(PLAN,'utf8'));
  w.hardResetWorkspace();w.applyProjectData(doc.project);w.draw();
  const layers=()=>w.eval('layers'),L=k=>layers().find(l=>l.role===k);
  let menu=null;const real=w.ctxMenu;w.ctxMenu=(e,items)=>{menu=items;};
  const ev={clientX:10,clientY:10,preventDefault(){},stopPropagation(){}};

  // ---------- the menu ----------
  const sen=L('sys:SENSOR');
  w.lyrLayerMenu(ev,sen.id);
  const labels=(menu||[]).map(i=>i.label);
  ok('a role layer menu has Info',labels.some(t=>/^ℹ Info — Érzékelők/.test(t)),labels.join(' | '));
  ok('… and Tartalom törlése with the item count',labels.some(t=>t==='🗑 Tartalom törlése… ('+w.rliCount(sen.id)+' elem)'));
  ok('… and Helyiség-igények for a sys role',labels.includes('Helyiség-igények…'));
  ok('the hardware layer has no Helyiség-igények',(w.lyrLayerMenu(ev,L('hw').id),!menu.some(i=>i.label==='Helyiség-igények…')));
  ok('a plain layer gets no stack items',(function(){const id=w.eval('lyrNewId')();layers().push({id,name:'Sima',visible:true,cats:{}});
    w.lyrLayerMenu(ev,id);const r=!menu.some(i=>/Info|Tartalom törlése/.test(i.label));
    w.eval('layers=layers.filter(l=>l.id!=="'+id+'")');return r;})());
  // (the stage rail's role buttons opened this menu too; the rail is gone since T2, 2026-10-15 — the layer row is the one place)

  // ---------- Info ----------
  const html=w.rliInfoHtml('sys:SENSOR',sen.stack),codes=[...new Set(w.eval('EP_CAT').filter(e=>e.role==='sys:SENSOR').map(e=>e.code))];
  ok('Info lists every sys:SENSOR catalogue code',codes.every(c=>html.indexOf('<b>'+c+'</b>')>=0),codes.join(','));
  ok('Info carries the purpose text',html.indexOf(w.RLI_TEXT['sys:SENSOR'].cel.slice(0,30))>=0);
  ok('Info shows this project\'s per-room counts',/Ebben a tervben: /.test(html));
  ok('every stack role has an Info text',w.STK_ROLES.every(r=>w.RLI_TEXT[r.k]&&w.RLI_TEXT[r.k].cel&&w.RLI_TEXT[r.k].hol),
    w.STK_ROLES.filter(r=>!w.RLI_TEXT[r.k]).map(r=>r.k).join(','));
  ok('Info opens as a dialog',(function(){w.rliDialog('base',sen.stack);const m=w.document.querySelector('.modal, #modal');
    return !!m&&/NET/.test(m.innerHTML);})());

  // ---------- solo / select ----------
  ok('solo hides the other layers of the stack, Mind látszik restores them',(function(){
    const before=JSON.stringify(layers().map(l=>l.visible!==false));w.rliSolo(sen.id);
    const only=layers().filter(l=>l.stack===sen.stack&&l.visible!==false).map(l=>l.id);
    w.rliSoloOff();return only.length===1&&only[0]===sen.id&&JSON.stringify(layers().map(l=>l.visible!==false))===before;})());
  ok('Elemek kijelölése selects the layer\'s items into the Move tool',(function(){const n=w.rliSelect(sen.id);
    return n>0&&w.__selCount()===n&&w.__state.mode==='grab';})());
  w.__clearMulti();w.setMode('select');

  // ---------- clear ----------
  const D=()=>JSON.stringify(w.__data),n0=w.rliCount(sen.id),snap=D();
  const senIds=new Set(w.__data.devices.filter(d=>d.layer===sen.id).map(d=>d.id));
  ok('the sensor layer has items to clear',n0>0,n0);
  ok('clear removes them all and keeps the layer',(w.rliClear(sen.id,{yes:true})===n0&&w.rliCount(sen.id)===0&&!!L('sys:SENSOR')));
  ok('no circuit still lists a deleted device',w.__data.circuits.every(c=>(c.members||[]).every(id=>!senIds.has(id))));
  ok('one undo brings everything back exactly',(w.doUndo(),D()===snap));
  const con=L('construct'),walls0=w.__getWalls().ground.length;
  ok('clearing the construct layer takes its walls too, undo returns them',(function(){
    const n=w.rliClear(con.id,{yes:true}),gone=w.__getWalls().ground.filter(r=>(r.layer||'L0')===con.id).length===0;
    w.doUndo();return n>0&&gone&&w.__getWalls().ground.length===walls0;})());
  ok('a locked layer refuses',(function(){sen.lock=true;const n=w.rliClear(sen.id,{yes:true});const c=w.rliCount(sen.id);sen.lock=false;
    return n===0&&c===n0;})());
  ok('declining the confirm deletes nothing',(function(){w.confirm=()=>false;const n=w.rliClear(sen.id);w.confirm=()=>true;return n===0&&w.rliCount(sen.id)===n0;})());

  // ---------- registry ----------
  ok('layer.info and layer.clear are registered',(function(){const ids=w.eval('ACTIONS').map(a=>a.id);return ids.includes('layer.info')&&ids.includes('layer.clear');})());
  w.ctxMenu=real;
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
