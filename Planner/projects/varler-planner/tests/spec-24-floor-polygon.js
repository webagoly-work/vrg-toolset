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
  const D=w.__data,st=w.__state,WA=w.__getWalls()[lvl];
  st.active=lvl;st.style='normal';st.pitch=90;st.flat=true;
  // a closed 4×3 m room (walls 100 thick on the centrelines) with a second room next door
  const T=100,wall=(x0,y0,x1,y1)=>WA.push({x0,y0,x1,y1});
  wall(-T/2,-T/2,4000+T/2,T/2); wall(-T/2,3000-T/2,4000+T/2,3000+T/2);
  wall(-T/2,-T/2,T/2,3000+T/2); wall(4000-T/2,-T/2,4000+T/2,3000+T/2);
  wall(7000-T/2,-T/2,7000+T/2,3000+T/2);      // a lone wall, enclosing nothing
  w.draw();

  // ---------- area / perimeter ----------
  const sq=[[0,0],[4000,0],[4000,3000],[0,3000]];
  ok('area of a 4×3 m outline is 12 m²',w.polyAreaMM(sq)/1e6===12);
  ok('perimeter closes the loop',w.polyPerimMM(sq,true)/1000===14);
  ok('an open chain is not closed',w.polyPerimMM(sq,false)/1000===11);
  ok('an L-shape measures right',(function(){const L=[[0,0],[4000,0],[4000,1000],[2000,1000],[2000,3000],[0,3000]];
    return w.polyAreaMM(L)/1e6===8;})());

  // ---------- drawing point after point ----------
  ok('a floor needs at least 3 points',(function(){w.__setFloorDraft([[0,0],[1000,0]]);
    const made=w.finishFloorDraft();w.__setFloorDraft(null);return made===false&&!D.floors.length;})());
  ok('a misclick-sized outline is refused',(function(){w.__setFloorDraft([[0,0],[100,0],[100,100]]);
    const made=w.finishFloorDraft();w.__setFloorDraft(null);return made===false&&!D.floors.length;})());
  ok('closing an outline makes the floor',(function(){w.__setFloorDraft(sq.map(p=>p.slice()));
    const made=w.finishFloorDraft();
    return made===true&&D.floors.length===1&&D.floors[0].poly.length===4&&D.floors[0].level===lvl;})());
  ok('the new floor is selected, ready to be named',(function(){const s=w.__getSel();
    return s&&s.t==='floors'&&s.i===0;})());
  ok('the draft is cleared afterwards',w.__floorDraft()===null);
  ok('one undo removes it',(function(){w.doUndo();return w.__data.floors.length===0;})());
  ok('the first point closes the outline, a far point does not',(function(){
    w.__setFloorDraft([[0,0],[4000,0],[4000,3000]]);st.zoom=1;
    const near=w.floorNearFirst([40,40]),far=w.floorNearFirst([2000,1500]);
    w.__setFloorDraft(null);return near&&!far;})());
  ok('the readout counts points, area and perimeter',(function(){w.__setFloorDraft(sq.map(p=>p.slice()));
    const h=w.floorDraftHud(null);w.__setFloorDraft(null);
    return /4 pont/.test(h)&&/12\.00 m²/.test(h)&&/14\.00 m/.test(h);})(),w.floorDraftHud(null));
  ok('with fewer than 3 points it shows the perimeter only',(function(){w.__setFloorDraft([[0,0],[4000,0]]);
    const h=w.floorDraftHud(null);w.__setFloorDraft(null);return /2 pont/.test(h)&&!/terület/.test(h);})());
  ok('the outline being drawn is rendered with its numbers',(function(){st.mode='floor';
    w.__setFloorDraft([[0,0],[4000,0],[4000,3000]]);w.__setCursor({x:0,y:3000,level:lvl,h:0});w.draw();
    const s=$('lyOverlay').innerHTML+$('lyScene').innerHTML;
    w.__setFloorDraft(null);w.__setCursor(null);st.mode='select';w.draw();
    return /Terület/.test(s)&&/Kerület/.test(s);})());

  // ---------- one-click fill of an enclosed space ----------
  ok('a click inside the closed room gives its inner outline',(function(){
    const poly=w.enclosedOutlineAt(2000,1500,lvl);
    if(!poly||poly.length!==4)return false;
    const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);
    return Math.min(...xs)===T/2&&Math.max(...xs)===4000-T/2&&Math.min(...ys)===T/2&&Math.max(...ys)===3000-T/2;})(),
    JSON.stringify(w.enclosedOutlineAt(2000,1500,lvl)));
  ok('the area is the room inside the walls, not the centrelines',(function(){
    const a=w.polyAreaMM(w.enclosedOutlineAt(2000,1500,lvl))/1e6;return Math.abs(a-3.9*2.9)<0.01;})());
  ok('open space gives nothing rather than a floor over the drawing',w.enclosedOutlineAt(9000,1500,lvl)===null);
  ok('a click inside a wall gives nothing',w.enclosedOutlineAt(2000,0,lvl)===null);
  ok('filling adds a floor and reports it',(function(){const made=w.floorFromWalls(2000,1500,lvl);
    return made===true&&D.floors.length===1&&/Padló a falak közé/.test($('hud').textContent);})());
  ok('the filled floor measures 11.31 m²',(function(){const a=w.polyAreaMM(D.floors[0].poly)/1e6;
    return Math.abs(a-11.31)<0.01;})());
  ok('filling open space refuses and says why',(function(){const n=D.floors.length;
    const made=w.floorFromWalls(9000,1500,lvl);
    return made===false&&D.floors.length===n&&/nincs falakkal zárt tér/.test($('hud').textContent);})());
  ok('one undo removes the filled floor',(function(){w.doUndo();return w.__data.floors.length===0;})());
  ok('a partition that stops short does not divide the room — the outline wraps around it',(function(){
    const WB=w.__getWalls()[lvl];
    WB.push({x0:1950,y0:-T/2,x1:2050,y1:1500});      // reaches only halfway across
    const poly=w.enclosedOutlineAt(3000,500,lvl);
    const area=poly?w.polyAreaMM(poly)/1e6:0;
    WB.pop();
    return !!poly&&poly.length===8&&Math.abs(area-(11.31-0.1*1.45))<0.02;})());
  ok('a partition all the way across makes two rooms',(function(){
    const WB=w.__getWalls()[lvl];
    WB.push({x0:1950,y0:-T/2,x1:2050,y1:3000+T/2});
    const right=w.enclosedOutlineAt(3000,1500,lvl),left=w.enclosedOutlineAt(1000,1500,lvl);
    const ra=right?w.polyAreaMM(right)/1e6:0,la=left?w.polyAreaMM(left)/1e6:0;
    WB.pop();
    return Math.abs(ra-1.9*2.9)<0.02&&Math.abs(la-1.9*2.9)<0.02;})());
  ok('the fill is a registered action',!!w.actionById('floor.fromwalls'));
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
