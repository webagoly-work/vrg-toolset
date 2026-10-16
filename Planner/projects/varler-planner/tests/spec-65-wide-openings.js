// spec-65 — wide doors and windows (round 2026-10-10, WP-G1)
//
// From above an opening was a line: one zero-thickness quad on the wall centreline. 'wide' draws its footprint across
// the host wall — a door from face to face with its swing (the blueprint's own door shapes, lighter pens), a window as
// a pane inset from both faces with a double glass line. 'line' keeps the old look exactly.
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
  const def0=w.__state.openingStyle;
  w.newBlankProject();
  const st=w.__state,D=w.__data;st.style='normal';st.active=lvl;st.wallMode='translucent';
  const WL=w.__getWalls()[lvl];
  const EXT={x0:0,y0:0,x1:6000,y1:300,id:'W1'},PART={x0:2800,y0:300,x1:2900,y1:3300,id:'W2'},THIN={x0:7000,y0:0,x1:9000,y1:30,id:'W3'};
  WL.push(EXT,PART,THIN);
  const dExt={type:'door',level:lvl,x:4600,y:150,ang:0,w:1400,h:2100,dtype:'double',layer:'L0'};
  const dPart={type:'door',level:lvl,x:2850,y:1800,ang:Math.PI/2,w:900,h:2100,layer:'L0'};
  const win={type:'window',level:lvl,x:1400,y:150,ang:0,w:1200,h:1500,sill:900,layer:'L0'};
  const winThin={type:'window',level:lvl,x:8000,y:15,ang:0,w:800,h:1000,sill:900,layer:'L0'};
  const free={type:'door',level:lvl,x:20000,y:20000,ang:0,layer:'L0'};
  D.openings.push(dExt,dPart,win,winThin,free);w.ensureIds(D);
  const across=F=>F.v1-F.v0;

  // 1 — the host
  ok('a door on the 300 mm wall finds it',w.opnHost(dExt)===EXT);
  ok('a door on the 100 mm partition (turned 90°) finds the partition, not the wall it meets',w.opnHost(dPart)===PART);
  ok('a free-standing opening has no host → the old line look',w.opnHost(free)===null&&w.opnFootprint(free)===null);
  ok('the orientation must match (a door turned across a wall is not hosted by it)',w.opnHost(Object.assign({},dExt,{ang:Math.PI/2}))!==EXT);

  // 2 — the footprint across the wall
  ok('door: exactly the wall thickness (300)',across(w.opnFootprint(dExt))===300);
  ok('door on the partition: 100',across(w.opnFootprint(dPart))===100);
  ok('window on 300 mm: inset 36 each side → 228 mm pane',w.opnFootprint(win).inset===36&&across(w.opnFootprint(win))===228);
  ok('window on 100 mm: inset clamps up to 15 → 70 mm pane',w.opnInset(100)===15&&100-2*w.opnInset(100)===70);
  ok('window on a 30 mm wall: the pane keeps ≥ 10 mm',across(w.opnFootprint(winThin))>=10,across(w.opnFootprint(winThin)));
  ok('the footprint is as long as the opening is wide, centred on it',(function(){const F=w.opnFootprint(dExt);return F.u0===3900&&F.u1===5300;})());

  // 3 — 'line' is the old path, byte for byte
  const sceneAt=(style,pitch)=>{st.openingStyle=style;st.pitch=pitch;st.flat=pitch>=88;return w.drawNormalGeom();};
  ok("'line': the scene is exactly what it is with no footprint at all (the old path)",(function(){
    const a=sceneAt('line',90),real=w.opnFootprint;w.opnFootprint=()=>null;const b=sceneAt('wide',90);w.opnFootprint=real;return a===b;})());
  ok("'line' at 30° likewise",(function(){const a=sceneAt('line',30),real=w.opnFootprint;w.opnFootprint=()=>null;const b=sceneAt('wide',30);w.opnFootprint=real;return a===b;})());

  // 4 — 'wide' from above: the footprint polygon at wall-top height
  {const s=sceneAt('wide',90),F=w.opnFootprint(dPart),zt=w.opnTopZ(dPart,F);
   const pts=w.p2b(F.corners.map(p=>[p[0],p[1],zt]));
   ok('top view: a polygon at wall-top z with the partition door\'s four corners',s.indexOf(`points="${pts}"`)>=0);
   ok('… with the dashed swing arc of the modelling pens',/stroke-dasharray/.test(w.opnTopSvg(dPart,F,zt,false)));
   ok('the window pane carries two blue glass lines',(w.opnTopSvg(win,w.opnFootprint(win),zt,false).match(/stroke="#2f6fb0"/g)||[]).length===2);
   ok('the hinge side follows variant bit 0, like the blueprint',w.opnTopSvg(dPart,F,zt,false)!==w.opnTopSvg(Object.assign({},dPart,{variant:1}),F,zt,false));
   ok('the free-standing door still draws its old centreline face',(function(){D.openings.length=0;D.openings.push(free);const a=sceneAt('wide',90),b=sceneAt('line',90);
     D.openings.length=0;D.openings.push(dExt,dPart,win,winThin,free);return a===b;})());}
  ok('30°: a door is two faces at the wall faces plus two jambs',(function(){const f=[];st.openingStyle='wide';st.pitch=30;st.flat=false;w.pushOpening(f,dExt);return f.length===4&&f.every(x=>x.pts&&x.pts.length===4);})());

  // white-out and the build ghost use openingSym
  ok('white-out from above: the same footprint symbol in ink',(function(){st.pitch=90;st.flat=true;st.openingStyle='wide';const s=w.openingSym(dPart);return /<polygon/.test(s)&&!/#2f6fb0/.test(s);})());
  ok('white-out at 30°: four outline faces, no fill',(function(){st.pitch=30;st.flat=false;const s=w.openingSym(dExt);return (s.match(/<polygon/g)||[]).length===4&&!/fill="(?!none)/.test(s);})());

  // selection: the footprint is the opening
  st.pitch=90;st.flat=true;st.zoom=1;
  ok('a click inside the door footprint, off its centre, picks the door',(function(){const F=w.opnFootprint(dExt),p=F.P(F.u0+80,F.v0+30),b=w.planToBase(p[0],p[1],w.dz(lvl,0));
    w.clientToBase=()=>b;const h=w.hitTest({clientX:0,clientY:0});return !!h&&h.t==='openings'&&D.openings[h.i]===dExt;})());
  ok('the selection glow traces the footprint',(function(){const g=w.selAuraShape({t:'openings',i:D.openings.indexOf(dExt)});return !!g&&g.poly&&g.poly.length===4;})());

  // the setting
  ok('the View select and the action switch it, and it saves',(function(){st.openingStyle='wide';w.syncUI();const a=$('openingStyle').value==='wide';
    w.runAction('view.openings');const b=st.openingStyle==='line'&&$('openingStyle').value==='line';w.runAction('view.openings');
    return a&&b&&JSON.parse(JSON.stringify(w.sessionObj())).state.openingStyle==='wide';})());
  ok('an opening default with no saved setting is '+w.eval('OPN_DEFAULT'),(function(){const v=st.openingStyle;delete st.openingStyle;const r=w.opnWide()===(w.eval('OPN_DEFAULT')==='wide');st.openingStyle=v;return r&&!def0;})());
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
