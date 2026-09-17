// notes-smoke.js — 10b-notes.js without a DOM.
//
// The first assertion is the important one: a note carrying none of the new
// fields must render EXACTLY the 1.0 markup, or the 70 golden renders move.
const fs=require('fs'),path=require('path');
const SRC=path.join(__dirname,'..','src');

global.window={};
global.NOTEKIND={info:{n:'Megjegyzés',bg:'#fffbe6',bd:'#d9c86a',fg:'#6a5a10',ic:'📝'},
  warn:{n:'Figyelmeztetés',bg:'#fff0e6',bd:'#e8641c',fg:'#a03c06',ic:'⚠'},
  todo:{n:'Teendő',bg:'#e9f2ff',bd:'#2f6fb0',fg:'#1c4f86',ic:'☐'},
  done:{n:'Kész',bg:'#eaf7ec',bd:'#3fae55',fg:'#1f6b33',ic:'✔'},
  dim:{n:'Méret / adat',bg:'#f2f0fa',bd:'#7a5cc0',fg:'#4a3585',ic:'📐'}};
global.noteKind=n=>(n&&n.kind&&NOTEKIND[n.kind])?n.kind:'info';
global.esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
global.state={noteDef:null,levels:{ground:true},activeLayer:'L0'};
global.layers=[{id:'L0',name:'Alap',visible:true,cats:{}},{id:'L1',name:'Villany',visible:true,cats:{}}];
global.layerById=id=>layers.find(l=>l.id===id)||layers[0];
global.layerShows=(it,cat)=>{const L=layerById((it&&it.layer)||'L0');return L.visible&&(L.cats[cat]!==false);};
global.data={notes:[]};
global.pushUndo=()=>{}; global.draw=()=>{}; global.$=()=>null;
global.openModal=()=>{}; global.sendToLayer=()=>{};
global.document={createElement:()=>({style:{},querySelector:()=>({onclick:null}),querySelectorAll:()=>[],appendChild(){}}),
  head:{appendChild(){}},body:{appendChild(){}}};
global.registerActions=list=>{global.__acts=list;};
global.Blob=function(){}; global.URL={createObjectURL:()=>'blob:x',revokeObjectURL(){}};

eval(fs.readFileSync(path.join(SRC,'10b-notes.js'),'utf8'));

const A=[],t=(n,c)=>A.push((c?'PASS  ':'FAIL  ')+n);

// ---- 1. the golden contract -------------------------------------------------
// literal copy of the 1.0 template, kept here on purpose so a change to
// ntSym has to be made in two places before it can move the goldens
const legacy=(n,b)=>`<g><path d="M${b[0]} ${b[1]} l-6 -12 a6 6 0 1 1 12 0 z" fill="#d1493f" stroke="#7a2a24"/><text x="${b[0]+9}" y="${b[1]-9}" font-size="10.5" fill="#333" paint-order="stroke" stroke="#fff" stroke-width="3">${esc(n.text)}</text></g>`;
[{text:'Kapcsoló ide'},{text:'ÁRAM & <víz>'},{text:''},{text:'sor1\nsor2'}].forEach((n,k)=>{
  const b=[120.5,-33];
  t('golden byte-identical #'+(k+1), ntSym(n,0,b)===legacy(n,b));
});
data.notes=[{text:'a'},{text:'b'}];
t('untouched note ignores defaults object', ntSym(data.notes[0],0,[10,20])===legacy(data.notes[0],[10,20]));

// ---- 2. opt-in appearance ---------------------------------------------------
t('icon:num draws a numbered badge', /circle/.test(ntSym({text:'x',icon:'num'},0,[0,0])));
t('icon:kind draws the kind glyph', ntSym({text:'x',icon:'kind',kind:'warn'},0,[0,0]).indexOf('⚠')>=0);
t('icon:none drops the marker', !/path|circle/.test(ntSym({text:'x',icon:'none'},0,[0,0])));
t('font size honoured', /font-size="16.0"/.test(ntSym({text:'x',fs:16},0,[0,0])));
t('opacity honoured', /opacity="0.50"/.test(ntSym({text:'x',op:.5},0,[0,0])));
t('changed note no longer takes the legacy path', ntSym({text:'x',fs:16},0,[0,0])!==legacy({text:'x'},[0,0]));

// ---- 3. ordering and numbering ---------------------------------------------
data.notes=[{text:'egy'},{text:'ketto'},{text:'harom'},{text:'negy'}];
t('numbers follow array order initially', ntOrdered().map(r=>r.n.text).join()==='egy,ketto,harom,negy');
t('ntNumber is 1-based', ntNumber(data.notes[2])===3);
ntReorder(3,0);
t('reorder moves last to first', ntOrdered().map(r=>r.n.text).join()==='negy,egy,ketto,harom');
t('reorder renumbers', ntNumber(data.notes[3])===1);
ntReorder(0,2);
t('reorder mid-list', ntOrdered().map(r=>r.n.text).join()==='egy,ketto,negy,harom');
t('out-of-range reorder refused', ntReorder(0,99)===false && ntReorder(-1,0)===false);
t('no-op reorder refused', ntReorder(1,1)===false);
ntRenumber();
t('renumber gives dense 0..N-1', data.notes.map(n=>n.ord).sort((a,b)=>a-b).join()==='0,1,2,3');

// ---- 4. visibility and the note sub-layer ----------------------------------
data.notes=[{text:'a',layer:'L0'},{text:'b',layer:'L1'},{text:'c',layer:'L0',hidden:true}];
t('plain note visible', ntVisible(data.notes[0])===true);
t('hidden note not visible', ntVisible(data.notes[2])===false);
t('note sub-layer defaults to on', ntVisible(data.notes[1])===true);
ntLayerToggle('L1');
t('layer note-toggle hides only that layer', ntVisible(data.notes[1])===false && ntVisible(data.notes[0])===true);
ntLayerToggle('L1');
t('toggle is reversible', ntVisible(data.notes[1])===true);
layerById('L0').visible=false;
t('hiding the whole layer still hides notes', ntVisible(data.notes[0])===false);
layerById('L0').visible=true;

// ---- 5. the exported document ----------------------------------------------
data.notes=[{text:'Első',level:'ground',x:1000,y:2000,layer:'L0'},
            {text:'Második',level:'ground',x:3000,y:4000,kind:'warn',layer:'L1',hidden:true}];
const md=ntDoc('md'), csv=ntDoc('csv'), txt=ntDoc('txt');
t('markdown numbers the notes', /\*\*1\.\*\*/.test(md) && /\*\*2\.\*\*/.test(md));
t('markdown marks hidden notes', /rejtett/.test(md));
t('markdown groups by level', /## ground/.test(md));
t('csv has the BOM Excel needs', csv.charCodeAt(0)===0xFEFF);
t('csv escapes quotes', ntDoc('csv').indexOf('"Első"')>0);
t('csv row count matches', csv.trim().split('\r\n').length===3);
t('txt is a plain numbered list', txt==='1. Első\n2. Második');

// ---- 6. menu items ----------------------------------------------------------
data.notes=[{text:'a'}];
let items=[];
ntMenuItems(0,items);
t('menu is no longer just delete', items.length>=8);
t('menu offers text edit', items.some(x=>/Szöveg szerkesztése/.test(x.label)));
t('menu offers the four icon modes minus current', items.filter(x=>/^Ikon:/.test(x.label)).length===3);
t('menu offers kind changes', items.filter(x=>/ → /.test(x.label)).length===4);
t('menu offers hide', items.some(x=>/Elrejtés/.test(x.label)));
t('menu offers reorder', items.some(x=>/Előre a listában/.test(x.label)));
t('menu on a missing note returns untouched', ntMenuItems(99,[]).length===0);

// ---- 7. actions -------------------------------------------------------------
t('six note actions registered', (global.__acts||[]).length===6);
t('actions are namespaced note.*', (global.__acts||[]).every(a=>a.id.indexOf('note.')===0));

console.log(A.join('\n'));
const p=A.filter(x=>x[0]==='P').length;
console.log('\n'+p+'/'+A.length+' passed');
process.exit(p===A.length?0:1);
