// Round 2026-10-18 — the cinema calculator's Sets B–E (guide §3.2–3.5, src/08ra-cinema-calc.js), the setup dialog's
// Kiindulás select (08r). Room = the guide's worked example: L 6.0, W 6.0, H_f 2.60, x_scr 0.50, h_eye 1.15, AR 1.78.
// Hand-worked vectors: tan 20° = 0.36397, tan 15° = 0.26795.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);const near=(a,b,t)=>Math.abs(a-b)<=(t||0.005);
 try{
  const room={L:6,W:6,Hf:2.6,xScr:0.5,fmt:'5.1'},calc=o=>w.cinCalc(Object.assign({},room,o));
  const chk=(r,n)=>r.checks.find(c=>c.n===n);
  const a=calc({});
  ok('Set A is the default and unchanged (x_MLP 3.600, W_s 2.257, no set line)',a.set==='A'&&near(a.xMLP,3.6)&&near(a.Ws,2.257)&&!chk(a,'B')&&!chk(a,'E'));
  // B — the screen is fixed
  const b=calc({set:'B',Ws:2.1});
  ok('B: W_s 2.10 → the seat band 3.385 – 4.419 (θ 40° … 30°)',near(b.seatBand.lo,3.385)&&near(b.seatBand.hi,4.419),JSON.stringify(b.seatBand));
  ok('…the preferred seat 3.60 lies inside → x_MLP 3.600, W_s stays 2.10',near(b.xMLP,3.6)&&near(b.Ws,2.1)&&b.bind==='fixed');
  ok('…the band is a note on the checks (ok)',chk(b,'B').ok&&chk(b,'B').note&&/3,385/.test(chk(b,'B').msg),chk(b,'B').msg);
  const b2=calc({set:'B',Ws:4.0});
  ok('B: a 4.00 m screen does not fit → warning with the largest image 3.130 m (0.870 smaller), seat at L − 1.20',!chk(b2,'B').ok&&near(b2.xMLP,4.8)&&/3,13/.test(chk(b2,'B').msg)&&/0,87/.test(chk(b2,'B').msg),chk(b2,'B').msg);
  const b3=calc({set:'B',Ws:2.6});
  ok('B: a band reaching into the null zone (2.6 m: 4.072 …) never seats at 0.5 L ± 0.05 L',Math.abs(b3.xMLP-3)>0.3&&b3.xMLP>=b3.seatBand.lo-1e-9);
  // C — the seat is fixed
  const c=calc({set:'C',xMLP:3.3});
  ok('C: x_MLP 3.30 → D 2.80, W_s 2.038 (angle), the 30°–40° range 1.501 – 2.038',near(c.D,2.8)&&near(c.Ws,2.038)&&near(c.wsRange[0],1.501)&&near(c.wsRange[1],2.038)&&c.bind==='angle');
  // E — the ceiling binds
  const e=calc({set:'E'});
  ok('E: W_s = AR · 1.5 · (H_f − c_lens − h_eye) = 3.017, D 4.145 … 5.630',near(e.Ws,3.017)&&near(e.seatBand.lo,4.645)&&near(e.seatBand.hi,6.130)&&e.bind==='height');
  ok('…the seat is pushed back into the band (4.645 ≤ x ≤ L − 1.20)',near(e.xMLP,4.645)&&e.xMLP<=4.8+1e-9);
  const e2=w.cinCalc({L:4,W:4,Hf:2.6,xScr:0.3,set:'E'});
  ok('E in a short room (L 4): the band (≥ 4.44) misses → back to A: seat 2.40, a warning',!chk(e2,'E').ok&&near(e2.xMLP,2.4)&&e2.Ws<3.017-0.01,JSON.stringify([e2.xMLP,e2.Ws]));
  // D — the projector is owned
  const d=calc({set:'D',trMin:1.3,trMax:2.0});
  ok('D, free mount: TR 1.3–2.0 → the A image 2.257 is reachable; the projector as far back as the zoom allows (TR 2.0 → x 5.014)',near(d.Ws,2.257)&&near(d.pj.x,5.014)&&chk(d,'D').ok&&d.bind==='projector');
  const d2=calc({set:'D',trMin:3.0,trMax:4.0});
  ok('D, long throw 3.0–4.0: the largest image within L − 0.30 is 1.733 → W_s 1.733, projector at 5.70',near(d2.Ws,1.733)&&near(d2.pj.x,5.7));
  const d3=calc({set:'D',trMin:4.0,trMax:5.0});
  ok('D, too long a throw (≥ 4.0): the 30° image (1.661) is out of reach → warning',!chk(d3,'D').ok&&/túl hosszú/.test(chk(d3,'D').msg));
  const d4=calc({set:'D',trMin:1.0,trMax:1.2,xPJ:3.0});
  ok('D, fixed mount at 3.00 (TR 1.0–1.2 → 2.083 – 2.500): W_s 2.257, the projector stays at 3.00',near(d4.Ws,2.257)&&near(d4.pj.x,3.0)&&chk(d4,'D').ok);
  const d5=calc({set:'D',trMin:1.0,trMax:1.1,xPJ:4.5});
  ok('D, fixed mount too far for that zoom (≥ 3.636 m image) → "előrébb kell"',!chk(d5,'D').ok&&/előrébb/.test(chk(d5,'D').msg));
  ok('D: the lens shift check (≈ 82 % needed): 60 % fails, 90 % passes',!chk(calc({set:'D',shiftMax:60}),'D-shift').ok&&chk(calc({set:'D',shiftMax:90}),'D-shift').ok);
  ok('D with a TV falls back to A',calc({set:'D',disp:'tv'}).set==='A');
  // the layer: mm in, the set read, the dialog keeps the later steps
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();const st=w.__state,D=w.__data;st.active='ground';
  D.floors.length=0;D.floors.push({level:'ground',poly:[[0,0],[6000,0],[6000,5000],[0,5000]],name:'Mozi',kind:'nappali',layer:'L0'});w.ensureIds(D);
  const L=w.cinLayerAdd();L.cinema={room:D.floors[0].id,level:'ground',side:'y0',xScr:500,zone:{L:5000,W:6000,off:0},suggest:true,fmt:'5.1',disp:'pj',hEye:1150,theta:40,
    set:'B',Ws:2100,step:'done',useGeneral:true,zMin:8};
  const rc=w.cinCompute(L);
  ok('cinCompute passes the set (B, W_s 2100 mm → 2.10 m)',rc.set==='B'&&near(rc.Ws,2.1));
  w.cinSetupDialog(L);const doc=w.document;
  ok('the setup dialog has the Kiindulás select with A–E, B\x27s field shown, C / D hidden',doc.getElementById('cinSet').options.length===5&&doc.getElementById('cinSetB').style.display===''&&doc.getElementById('cinSetD').style.display==='none');
  doc.getElementById('cinSet').value='E';doc.getElementById('cinSet').onchange();
  ok('…switching to E hides B',doc.getElementById('cinSetB').style.display==='none');
  doc.getElementById('mOk').click();
  ok('Kész stores the set and keeps step / useGeneral / zMin',L.cinema.set==='E'&&L.cinema.step==='done'&&L.cinema.useGeneral===true&&L.cinema.zMin===8,JSON.stringify({set:L.cinema.set,step:L.cinema.step}));
  w.cinChecksDialog(L);
  ok('the checks dialog names the set and shows the E band line',/Kiindulás E/.test(doc.body.innerHTML)&&/Ülősáv a belmagassághoz/.test(doc.body.innerHTML));
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
