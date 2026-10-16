// Workflow round WP-R3 — the Szabályok palette (src/08i-wf-rules.js).
// What must hold (docs/workflow/WP-R3_rules-palette.md, MATERIAL §7 / §7b; R07 = A + non-electrical areas): the four
// sections incl. the disabled floor row; each preset writes the right Jelölés mark (kind, tag, pol); a face click marks
// ONE face (half wall); a drag marks part of the face; a whole-wall preset takes the wall; a second click takes it off;
// opening presets add / remove their tag on the one opening mark; zones; Vezethető fal hands over to the R2 tool; counts.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;const $=id=>w.document.getElementById(id);
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();const st=w.__state,D=w.__data;st.active='ground';st.penThick={ext:300,int:200};
  const W=w.__getWalls();['ground','upper','basement'].forEach(l=>W[l].length=0);D.floors.length=0;D.marks=[];D.openings.length=0;
  const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  D.floors.push({level:'ground',poly:rect(0,0,3600,3000),name:'A',stage:'floor',clear:true,layer:'L0'});
  D.floors.push({level:'ground',poly:rect(3600,0,7200,3000),name:'B',stage:'floor',clear:true,layer:'L0'});
  w.wfwApply(w.wfwPlan('ground'),'ground');
  const part=W.ground.find(r=>r.x0===3600&&r.x1===3800),top=W.ground.find(r=>r.y0===-300);
  const P=k=>w.rbPreset(k),M=()=>D.marks;
  // panel
  ok('the button exists',!!$('rbBtn'));w.rbPanel(true);const html=$('rbPanel').innerHTML;
  ok('four sections',['Fal','Nyílászáró','Egyéb területek','Padló'].every(s=>html.indexOf('<h5>'+s+'</h5>')>=0));
  ok('the floor row is there and disabled',/<button class="rb" disabled="">Padló szabályok — fejlesztés alatt/.test(html)||/<button class="rb" disabled>Padló szabályok — fejlesztés alatt/.test(html));
  ok('every non-off preset is a button',w.eval('RB_PRESETS').filter(p=>p.kind!=='off').every(p=>html.indexOf('data-rb="'+p.k+'"')>=0));
  // a face
  let m=w.rbWallCommit(P('lforma'),{level:'ground',id:part.id,side:1,u:1500});
  ok('L-forma: one face, plus',m&&m.kind==='side'&&m.side===1&&m.pol==='plus'&&m.tags[0]==='lforma');
  ok('the other face is still free',!M().some(x=>x.kind==='side'&&x.side===-1));
  m=w.rbWallCommit(P('lforma'),{level:'ground',id:part.id,side:1,u:500});ok('the same face again → removed',m===null&&M().length===0);
  m=w.rbWallCommit(P('tilos'),{level:'ground',id:top.id,side:-1,u:0},{u0:1020,u1:2480});
  ok('a drag → part of the face (vstrip 1000–2500, snapped 50)',m&&m.kind==='vstrip'&&m.u0===1000&&m.u1===2500&&m.pol==='ban'&&m.tags[0]==='tilos',JSON.stringify(m));
  // whole wall
  m=w.rbWallCommit(P('gepeszet'),{level:'ground',id:part.id,side:1,u:0});ok('Gépészet: the whole wall, ban',m&&m.kind==='wall'&&m.pol==='ban');
  m=w.rbWallCommit(P('gepeszet'),{level:'ground',id:part.id,side:-1,u:0});ok('clicked again (other face) → removed',m===null);
  // non-electrical + reused tags
  ok('Fűtőtest reuses the radiator tag',w.rbWallCommit(P('futotest'),{level:'ground',id:top.id,side:1,u:0}).tags[0]==='radiator');
  ok('Munkalap reuses the pult tag',w.rbWallCommit(P('munkalap'),{level:'ground',id:top.id,side:-1,u:0}).tags[0]==='pult');
  ok('Vizes fal: ban',w.rbWallCommit(P('vizes'),{level:'ground',id:part.id,side:-1,u:0}).pol==='ban');
  ok('new tags are registered',w.eval("MRK_TAGS.side.some(t=>t.k==='gaz')&&MRK_TAGS.side.some(t=>t.k==='kerulendo')&&MRK_TAGS.plane.some(t=>t.k==='sziget')"));
  // zones
  m=w.rbZoneCommit(P('agy'),'ground',[500,500],[2510,2190]);ok('Ágy zóna: a floor rect, snapped',m&&m.kind==='zone'&&m.plane==='floor'&&m.x1===2500&&m.y1===2200&&m.tags[0]==='agy',JSON.stringify(m));
  ok('Sziget: new floor tag',w.rbZoneCommit(P('sziget'),'ground',[4000,1000],[5000,1600]).tags[0]==='sziget');
  ok('a 20 mm drag makes no zone',w.rbZoneCommit(P('strang'),'ground',[0,0],[20,20])===undefined);
  // openings
  D.openings.push({type:'window',level:'ground',x:1800,y:-150,ang:0,w:1200,h:1500,sill:900,layer:'L0'});
  D.openings.push({type:'door',level:'ground',x:3700,y:1500,ang:Math.PI/2,w:900,h:2100,variant:0,layer:'L0'});w.ensureIds(D);
  const win=D.openings[0],door=D.openings[1];
  m=w.rbOpeningCommit(P('redony'),win);ok('Redőny on a window',m&&m.kind==='opening'&&m.op===win.id&&w.mrkOpeningTags(win.id).indexOf('redony')>=0);
  ok('… and the W1 slot appears (O2)',!!w.ptWinSlot(win));
  ok('Redőny on a door is refused',w.rbOpeningCommit(P('redony'),door)===undefined);
  ok('Portál on the door',!!w.rbOpeningCommit(P('portal'),door)&&w.mrkOpeningTags(door.id)[0]==='portal');
  ok('Redőny again → taken off',w.rbOpeningCommit(P('redony'),win)===null&&w.mrkOpeningTags(win.id).length===0);
  // counts + the route hand-over
  w.rbPanelDraw();ok('the panel counts (Ágy zóna 1)',/data-rb="agy">.*?<span class="n">1<\/span>/.test($('rbPanel').innerHTML));
  w.rbPick('vezetheto');ok('Vezethető fal hands over to the marker pen (R5)',w.MKP.on&&w.MKP.ink==='vezetheto'&&!w.eval('RB.on'));
  w.rbPick('tilos');ok('a face preset is a pen ink too (R5)',w.MKP.on&&w.MKP.ink==='tilos'&&!w.eval('RB.on'));
  w.rbPick('agy');ok('a zone preset keeps the rules tool on',!w.MKP.on&&w.eval('RB.on')&&w.eval('RB.preset')==='agy');
  w.setMode('wall');ok('another tool turns it off',!w.eval('RB.on'));
  w.rbPanel(false);ok('the panel closes',$('rbPanel').style.display==='none');
  st.pitch=90;st.style='normal';w.draw();ok('the marks draw without errors',$('vp').firstChild.innerHTML.length>0);
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
