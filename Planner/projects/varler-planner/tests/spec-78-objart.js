// Views V8a — the object line-art store (05zb-objart.js) and the first five objects.
//
// What must hold (docs/views/WORKPLAN.md § V8a, tests 1–8):
//   * OBJART holds exactly the 8 first-five names, each an OBJLIB item, every art[] view + R renders;
//   * viewBox = the true size in the view's frame (origin bottom-centre-front), and every drawn point lies inside;
//   * classes only (oa-out / oa-det / oa-hid / oa-fill), no colours, oa-hid where the spec says;
//   * the parametric counts change with w/d/h, the WC stretches with fixed details, R = L mirrored.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};
  const libBefore=JSON.stringify(w.eval('OBJLIB'));
  const A=(n,v,s,o)=>w.objArt(n,v,s,o);
  const NAMES=['Kanapé 3ü','Ágy 200×160','WC csésze','Konyhapult 60','Konyhapult 120','Konyhapult','Felsőszekrény','Hűtő 60'];
  const RESIZED={'Kanapé 3ü':{w:2800,d:950,h:850},'Ágy 200×160':{w:900,d:2000,h:550},'WC csésze':{w:500,d:650,h:800},
    'Konyhapult 60':{w:1800,d:600,h:900},'Konyhapult 120':{w:1800,d:600,h:900},'Konyhapult':{w:1800,d:600,h:900},
    'Felsőszekrény':{w:1000,d:350,h:900},'Hűtő 60':{w:600,d:600,h:850}};
  const OBJART=w.eval('OBJART');

  // ---------- 1. the store ----------
  ok('OBJART has exactly the 8 first-five names',JSON.stringify(Object.keys(OBJART).sort())===JSON.stringify(NAMES.slice().sort()),Object.keys(OBJART).join('|'));
  ok('each is an OBJLIB item with art[]',NAMES.every(n=>{const it=w.objArtItem(n);return it&&Array.isArray(it.art)&&it.art.length;}));
  ok('every entry has fam + front / left / right / top',NAMES.every(n=>{const e=OBJART[n];return e.fam&&['front','left','right','top'].every(k=>typeof e[k]==='function');}));
  const views=n=>Array.from(new Set(w.objArtItem(n).art.concat('R')));
  ok('every art[] view + R renders at both sizes',NAMES.every(n=>views(n).every(v=>A(n,v)&&A(n,v,RESIZED[n]))));

  // ---------- 2. viewBox ----------
  const vb=(n,v,s)=>A(n,v,s).vb.join(' ');
  ok('Kanapé 3ü F -1100 -850 2200 850',vb('Kanapé 3ü','F')==='-1100 -850 2200 850',vb('Kanapé 3ü','F'));
  ok('Kanapé 3ü L -900 -850 900 850',vb('Kanapé 3ü','L')==='-900 -850 900 850',vb('Kanapé 3ü','L'));
  ok('Kanapé 3ü R 0 -850 900 850',vb('Kanapé 3ü','R')==='0 -850 900 850',vb('Kanapé 3ü','R'));
  ok('Kanapé 3ü T -1100 -900 2200 900',vb('Kanapé 3ü','T')==='-1100 -900 2200 900',vb('Kanapé 3ü','T'));
  ok('resized 2800×950×850: F -1400 -850 2800 850',vb('Kanapé 3ü','F',RESIZED['Kanapé 3ü'])==='-1400 -850 2800 850');
  ok('resized 2800×950×850: T -1400 -950 2800 950',vb('Kanapé 3ü','T',RESIZED['Kanapé 3ü'])==='-1400 -950 2800 950');
  ok('Hűtő 60 F -300 -1850 600 1850',vb('Hűtő 60','F')==='-300 -1850 600 1850',vb('Hűtő 60','F'));
  ok('the svg carries the same viewBox',A('Ágy 200×160','T').svg.includes('viewBox="-800 -2000 1600 2000"'));

  // ---------- 3. inside the true size ----------
  ok('every drawn point lies inside its viewBox (8 names × views × 2 sizes)',(function(){
    for(const n of NAMES)for(const v of views(n))for(const s of [null,RESIZED[n]]){const r=A(n,v,s),[x,y,W,H]=r.vb;
      for(const p of r.prims)for(const q of p.pts)if(q[0]<x-.01||q[0]>x+W+.01||q[1]<y-.01||q[1]>y+H+.01)return n+' '+v+' '+p.kind+' '+q.join(',');}
    return true;})()===true);

  // ---------- 4. classes ----------
  const CLS=/^oa-(out|det|hid)( oa-fill)?$/;
  ok('every element: oa-out / oa-det / oa-hid (+ oa-fill), nothing else',(function(){
    for(const n of NAMES)for(const v of views(n)){const b=A(n,v).body,els=b.match(/<[a-z]+ [^>]*>/g)||[];
      for(const e of els){const m=e.match(/class="([^"]*)"/);if(!m||!CLS.test(m[1]))return n+' '+v+' '+e.slice(0,60);}}
    return true;})()===true);
  ok('no fill= / stroke= attributes in the art',NAMES.every(n=>views(n).every(v=>!/ (fill|stroke)=/.test(A(n,v).body))));
  ok('every view has an oa-out',NAMES.every(n=>views(n).every(v=>A(n,v).body.includes('class="oa-out'))));
  const hasHid=(n,v)=>A(n,v).body.includes('class="oa-hid"');
  ok('oa-hid in Kanapé L, Konyhapult L + T, Felső F + L, Hűtő F + L, WC L',
    hasHid('Kanapé 3ü','L')&&hasHid('Konyhapult','L')&&hasHid('Konyhapult','T')&&hasHid('Felsőszekrény','F')&&hasHid('Felsőszekrény','L')&&
    hasHid('Hűtő 60','F')&&hasHid('Hűtő 60','L')&&hasHid('WC csésze','L'));

  // ---------- 5. parametric counts ----------
  const pc=(n,v,s,k)=>A(n,v,s).parts[k]||0;
  ok('Kanapé F seat 3 → 4 at w 2800',pc('Kanapé 3ü','F',null,'seat')===3&&pc('Kanapé 3ü','F',RESIZED['Kanapé 3ü'],'seat')===4);
  ok('Kanapé F back 3 → 4, T seat + back the same',pc('Kanapé 3ü','F',null,'back')===3&&pc('Kanapé 3ü','F',RESIZED['Kanapé 3ü'],'back')===4&&
    pc('Kanapé 3ü','T',null,'seat')===3&&pc('Kanapé 3ü','T',null,'back')===3&&pc('Kanapé 3ü','T',RESIZED['Kanapé 3ü'],'seat')===4&&pc('Kanapé 3ü','T',RESIZED['Kanapé 3ü'],'back')===4);
  ok('Ágy T pillow 2 → 1 at w 900 (F the same)',pc('Ágy 200×160','T',null,'pillow')===2&&pc('Ágy 200×160','T',RESIZED['Ágy 200×160'],'pillow')===1&&
    pc('Ágy 200×160','F',null,'pillow')===2&&pc('Ágy 200×160','F',RESIZED['Ágy 200×160'],'pillow')===1);
  ok('Konyhapult door / drawer 1 @ 600, 2 @ 1100, 2 @ 1200, 3 @ 1800',[[600,1],[1100,2],[1200,2],[1800,3]].every(([x,n])=>{const s={w:x,d:600,h:900};
    return pc('Konyhapult','F',s,'door')===n&&pc('Konyhapult','F',s,'drawer')===n;}),
    [600,1100,1200,1800].map(x=>pc('Konyhapult','F',{w:x,d:600,h:900},'door')).join(' '));
  ok('the catalogue sizes: Konyhapult 60 → 1, 120 → 2, Konyhapult (1100) → 2',pc('Konyhapult 60','F',null,'door')===1&&pc('Konyhapult 120','F',null,'door')===2&&pc('Konyhapult','F',null,'door')===2);
  ok('Felső F door 1 @ 600 → 2 @ 1000',pc('Felsőszekrény','F',null,'door')===1&&pc('Felsőszekrény','F',{w:1000,d:350,h:700},'door')===2);
  ok('Felső L shelf 1 @ h 700 → 2 @ h 900',pc('Felsőszekrény','L',null,'shelf')===1&&pc('Felsőszekrény','L',{w:600,d:350,h:900},'shelf')===2);
  ok('Hűtő F door 2 @ h 1850 → 1 @ h 850',pc('Hűtő 60','F',null,'door')===2&&pc('Hűtő 60','F',{w:600,d:600,h:850},'door')===1);

  // ---------- 6. the WC stretches, its details stay ----------
  const bowlHalf=s=>{const p=A('WC csésze','T',s).prims.find(q=>q.part==='bowl');return Math.max(...p.pts.map(q=>Math.abs(q[0])));};
  ok('WC T bowl half-width 180 @ w 400 → 225 @ w 500',bowlHalf(null)===180&&bowlHalf({w:500,d:700,h:800})===225,bowlHalf(null)+' '+bowlHalf({w:500,d:700,h:800}));
  ok('WC flush button r 30 at both sizes',/<circle [^>]*r="30"/.test(A('WC csésze','T').body)&&/<circle [^>]*r="30"/.test(A('WC csésze','T',RESIZED['WC csésze']).body));

  // ---------- 7. R = L mirrored ----------
  ok('R = L mirrored: same parts and prims, every x negated, y the same',NAMES.every(n=>{const L=A(n,'L'),Rr=A(n,'R');
    if(JSON.stringify(L.parts)!==JSON.stringify(Rr.parts)||L.prims.length!==Rr.prims.length)return false;
    return L.prims.every((p,i)=>{const q=Rr.prims[i];const a=p.pts.map(v=>(-v[0]||0)+','+v[1]).sort().join(' '),b=q.pts.map(v=>v[0]+','+v[1]).sort().join(' ');return a===b;});}));

  // ---------- 8. the API edges ----------
  ok('unknown name / view → null',A('nincs','F')===null&&A('Kanapé 3ü','X')===null);
  ok('default size = the OBJLIB size',JSON.stringify(A('Hűtő 60','F').size)==='{"w":600,"d":650,"h":1850}');
  ok('opt.k 25 → width 88mm height 34mm (Kanapé F)',A('Kanapé 3ü','F',null,{k:25}).svg.includes('width="88mm" height="34mm"'));
  ok('objArtCss(25): .oa-out{stroke-width:8.75',w.objArtCss(25).includes('.oa-out{stroke-width:8.75'));
  ok('opt.css false leaves the <style> out',!A('Kanapé 3ü','F',null,{css:false}).svg.includes('<style>')&&A('Kanapé 3ü','F').svg.includes('<style>'));
  ok('deterministic',A('Konyhapult','L').svg===A('Konyhapult','L').svg&&A('WC csésze','T',RESIZED['WC csésze']).svg===A('WC csésze','T',RESIZED['WC csésze']).svg);
  ok('OBJLIB untouched',JSON.stringify(w.eval('OBJLIB'))===libBefore);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
