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
  // two rooms either side of a 100 mm partition on x=4000; outlines on the wall centreline
  WA.push({x0:3950,y0:0,x1:4050,y1:3000});          // partition (vertical, perp = +x)
  WA.push({x0:-50,y0:-50,x1:7050,y1:50});            // north outer wall (horizontal, perp = +y)
  D.floors.push({level:lvl,name:'NAPPALI',poly:[[0,0],[4000,0],[4000,3000],[0,3000]]});
  D.floors.push({level:lvl,name:'HÁLÓ',poly:[[4000,0],[7000,0],[7000,3000],[4000,3000]]});
  const add=o=>{D.devices.push(Object.assign({level:lvl,h:300},o));return D.devices.length-1;};
  const sA =add({type:'socket',kind:'2pf',ref:'D9',x:3950,y:1000,side:0});   // partition, NAPPALI face
  const sB =add({type:'socket',kind:'2pf',ref:'D2',x:4050,y:1000,side:1});   // partition, HÁLÓ face
  const sC =add({type:'switch',kind:'106',ref:'K1',x:4000,y:2000,side:1});   // on the centreline: side decides
  const lmp=add({type:'light',ref:'L4',x:2000,y:1500,h:2700});               // free-standing
  const out=add({type:'socket',kind:'2pf',ref:'D5',x:1000,y:-50,side:0});    // north wall, OUTSIDE face
  const inN=add({type:'socket',kind:'utp',ref:'D6',x:1000,y:50,side:1});     // north wall, inside face
  const box=add({type:'junction',jbShape:'circle',jbSize:80,ref:'KD1',x:1500,y:1500,h:2500});
  const far=add({type:'socket',kind:'2pf',ref:'D7',x:20000,y:20000,side:0}); // in no room
  w.ensureIds(D);w.draw();
  const A={rm:D.floors[0],src:'F',i:0,level:lvl},B={rm:D.floors[1],src:'F',i:1,level:lvl};
  const roomName=i=>{const e=w.roomOfDevice(D.devices[i]);return e?e.rm.name:null;};

  // ---------- membership ----------
  ok('a wall socket belongs to the room its face looks into',roomName(sA)==='NAPPALI',roomName(sA));
  ok('the same wall, other face, is the neighbour',roomName(sB)==='HÁLÓ',roomName(sB));
  ok('on the centreline, d.side decides',roomName(sC)==='HÁLÓ',roomName(sC));
  ok('a free-standing lamp goes by its plan point',roomName(lmp)==='NAPPALI',roomName(lmp));
  ok('an outer-wall socket facing outside is in no room',roomName(out)===null,roomName(out));
  ok('the same outer wall facing inside is in the room',roomName(inN)==='NAPPALI',roomName(inN));
  ok('a device far from every room is in none',roomName(far)===null);
  ok('the actual offset beats a stale d.side',(function(){D.devices[sA].side=1;const r=roomName(sA);D.devices[sA].side=0;return r==='NAPPALI';})());
  ok('an outline drawn on the inner wall face still works',(function(){
    const keep=D.floors[1].poly;D.floors[1].poly=[[4050,50],[7000,50],[7000,3000],[4050,3000]];
    const r=roomName(sB);D.floors[1].poly=keep;return r==='HÁLÓ';})());
  ok('roomMembers lists exactly the room',(function(){
    const m=w.roomMembers(A).sort((a,b)=>a-b).join(),exp=[sA,lmp,inN,box].sort((a,b)=>a-b).join();return m===exp;})(),
    w.roomMembers(A).join());
  ok('every device lands in at most one room',D.devices.every((d,i)=>
    (w.roomMembers(A).includes(i)?1:0)+(w.roomMembers(B).includes(i)?1:0)<=1));

  // ---------- breakdown ----------
  const bd=w.roomBreakdown(A);
  ok('breakdown groups by variant with counts',
     bd.some(r=>r.label==='Aljzat 2P+F'&&r.n===1)&&bd.some(r=>r.label==='Aljzat UTP (RJ45)'&&r.n===1)
     &&bd.some(r=>r.label==='Lámpa'&&r.n===1)&&bd.some(r=>r.label==='Kötődoboz ⌀80'&&r.n===1),JSON.stringify(bd));
  ok('breakdown follows the type order (socket before light before box)',
     bd.map(r=>r.type).join()==='socket,socket,light,junction',bd.map(r=>r.type).join());
  ok('refs within a row are in id order, not ref order',(function(){
    const s2=add({type:'socket',kind:'2pf',ref:'D1',x:3950,y:2500,side:0});w.ensureIds(D);
    const row=w.roomBreakdown(A).find(r=>r.label==='Aljzat 2P+F');D.devices.splice(s2,1);
    return row&&row.refs.join()==='D9,D1';})());
  ok('HÁLÓ counts the switch and its socket',(function(){const b=w.roomBreakdown(B);
    return b.length===2&&b[0].type==='switch'&&b[1].type==='socket';})());

  // ---------- inspector ----------
  ok('selecting a room shows the breakdown in the inspector',(function(){
    w.__setSel({t:'floors',i:0,level:lvl});w.renderShell();const t=$('inspector').textContent;
    return /Készülékek a helyiségben/.test(t)&&/4 db/.test(t)&&/Kötődoboz ⌀80/.test(t);})());
  ok('an empty room says so',(function(){D.floors.push({level:lvl,poly:[[0,5000],[1000,5000],[1000,6000],[0,6000]]});
    w.__setSel({t:'floors',i:2,level:lvl});w.renderShell();const r=/Nincs készülék/.test($('inspector').textContent);
    D.floors.pop();w.__setSel(null);w.renderShell();return r;})());
  ok('a device selection shows no room block',(function(){w.__setSel({t:'devices',i:lmp,level:lvl});w.renderShell();
    const r=!$('inspector').querySelector('.insRoom');w.__setSel(null);w.renderShell();return r;})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
