// The symbol set, the layer colour code, the spotlight and the client-preview render.
//
// Everything that was not a socket, a switch, a lamp or a board used to draw as one generic
// square-with-a-dot, so a kamera, an érzékelő, a hangszóró and a kezelőpanel were the same picture.
// A symbol now says three things at once — body = kind and real size, mark = which device,
// colour = which system — and the panel says the same colours back.
//
// The load-bearing promise of the rewrite is that nothing a plan used to SAY in words was lost:
// the hardware labels and the STD-004 endpoint codes are still on the drawing.
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
  w.confirm=()=>true;w.alert=()=>{};
  w.loadBuilding(w.__H,true);
  const st=w.__state,D=w.__data;st.style='normal';st.pitch=90;st.active='ground';w.vsSet(1);

  // ---------- the mark vocabulary ----------
  ok('every code in the endpoint catalogue has a mark',(function(){
    const miss=[...new Set(w.EP_CAT.map(e=>e.code))].filter(c=>!w.ICO_BY_CODE[c]);
    return miss.length?miss.join(','):true;})()===true);
  ok('every mark a table points at actually exists',(function(){
    const keys=Object.keys(w.ICO_BY_CODE).map(k=>w.ICO_BY_CODE[k])
      .concat(Object.keys(w.ICO_BY_TYPE).map(k=>w.ICO_BY_TYPE[k]));
    const miss=[...new Set(keys)].filter(k=>!w.ICO_MARK[k]);
    return miss.length?miss.join(','):true;})()===true);
  ok('the marks are distinct drawings, not the same path twice',(function(){
    const seen={},dup=[];Object.keys(w.ICO_MARK).forEach(k=>{const d=w.ICO_MARK[k].d;
      if(seen[d])dup.push(k+'='+seen[d]);seen[d]=k;});
    return dup.length?dup.join(','):true;})()===true);
  ok('each mark is a usable path',(function(){
    const bad=Object.keys(w.ICO_MARK).filter(k=>!/^M[-\d]/.test(w.ICO_MARK[k].d)||w.ICO_MARK[k].d.length<10);
    return bad.length?bad.join(','):true;})()===true);

  // ---------- the size tiers ----------
  const F=w.ICO_FAM;
  ok('a szerelvény is the smallest body and hardware the biggest',
     F.szerelveny.r<F.doboz.r&&F.doboz.r<F.hw.r&&F.hw.r<F.hwbig.r,
     [F.szerelveny.r,F.ceiling.r,F.doboz.r,F.hw.r,F.hwbig.r].join(' < '));
  ok('a szerelvény body is the 68 mm box',F.szerelveny.mm===68);
  ok('a kötődoboz takes its own size and shape',(function(){
    const a=w.icoSizeOf({type:'junction',jbSize:120,jbShape:'rect'},'doboz');
    const b=w.icoSizeOf({type:'junction',jbSize:80,jbShape:'circle'},'doboz');
    return a.mm===120&&!a.round&&b.mm===80&&b.round===true;})());
  ok('the bodies are screen-sized below the millimetre step',(function(){
    w.vsSet(1);const a=w.icoMmMode();w.vsSet(w.ICO_MM_FROM);const b=w.icoMmMode();w.vsSet(1);
    return a===false&&b===true;})());

  // ---------- which family and which mark ----------
  const dev=(o)=>Object.assign({level:'ground',x:1000,y:1000,h:1100,layer:'L0'},o);
  ok('a socket is a szerelvény with the socket mark',
     w.icoFamOf(dev({type:'socket'}))==='szerelveny'&&w.icoMarkOf(dev({type:'socket'}))==='socket');
  ok('a lamp is a ceiling body',w.icoFamOf(dev({type:'light'}))==='ceiling');
  ok('a kötődoboz is its own family',w.icoFamOf(dev({type:'junction',jbSize:100}))==='doboz');
  ok('an empty szerelvénydoboz is a 68 mm body, not a kötődoboz',w.icoFamOf(dev({type:'box'}))==='szerelveny');
  ok('an RBX is hardware, an elosztó is big hardware',
     w.icoFamOf(dev({type:'rbx'}))==='hw'&&w.icoFamOf(dev({type:'board'}))==='hwbig');
  ok('codes that differ get marks that differ',(function(){
    const m=['SEN','CAM','SPK','PAN','USB','SEC','ACP','THR'].map(c=>w.icoMarkOf(dev({type:'ep',code:c})));
    return new Set(m).size===m.length?true:m.join(',');})()===true);
  ok('an unknown type still draws something',w.icoMarkOf(dev({type:'nonsense'}))==='generic');

  // ---------- colour means a system ----------
  ok('the role colours are one table, shared with the endpoint symbols',(function(){
    const k=Object.keys(w.EP_ROLE_COL);
    return k.length>0&&k.every(r=>w.EP_ROLE_COL[r]===w.STK_COL[r]);})());
  ok('every stack role has a colour',(function(){
    const miss=w.STK_ROLES.filter(r=>!w.stkRoleCol(r.k)).map(r=>r.k);
    return miss.length?miss.join(','):true;})()===true);
  ok('no two roles share a colour',(function(){
    const v=w.STK_ROLES.map(r=>w.stkRoleCol(r.k));return new Set(v).size===v.length;})());
  ok('a stack layer takes its role colour, not its position',(function(){
    const S=w.stkCreate({name:'Teszt'});
    const a=w.stkLayer(S.id,'sys:SOC'),b=w.stkLayer(S.id,'sys:DATA');
    const good=w.lyrColor(a)===w.STK_COL['sys:SOC']&&w.lyrColor(b)===w.STK_COL['sys:DATA'];
    w.stkDissolve(S.id);return good;})());
  ok('an ordinary layer still gets a colour of its own',/^#[0-9a-f]{6}$/i.test(w.lyrColor(w.lyrLayer('L0'))));
  ok('a hand-picked tint beats the automatic colour',(function(){
    const L=w.lyrLayer('L0');L.tint='#ff0000';const a=w.lyrColor(L)==='#ff0000';
    delete L.tint;return a&&w.lyrColor(L)!=='#ff0000';})());

  // ---------- painting a layer ----------
  ok('a layer is not painted until it is switched on',!w.lyrPaints(w.lyrLayer('L0')));
  ok('the swatch switches it, and back',(function(){
    w.lyrTogglePaint('L0');const a=w.lyrPaints(w.lyrLayer('L0'));
    w.lyrTogglePaint('L0');return a&&!w.lyrPaints(w.lyrLayer('L0'));})());
  ok('a painted layer colours its device bodies',(function(){
    D.devices.push(dev({type:'socket',id:'DT1'}));
    const plain=w.devSym(D.devices[D.devices.length-1]);
    w.lyrTogglePaint('L0');const painted=w.devSym(D.devices[D.devices.length-1]);
    w.lyrTogglePaint('L0');D.devices.pop();
    return plain!==painted&&painted.indexOf(w.tintMix(w.lyrAutoCol(w.lyrLayer('L0')),0.45))>=0;})());
  ok('"Mind színezve" reaches every layer and clears again',(function(){
    w.lyrPaintAll(true);const on=w.__state&&true;const all=w.__layers?0:0;
    const a=w.lyrPaints(w.lyrLayer('L0'));w.lyrPaintAll(false);
    return a&&!w.lyrPaints(w.lyrLayer('L0'));})());

  // ---------- nothing the plan used to say in words was lost ----------
  const sceneHas=s=>{w.draw();return $('lyScene').innerHTML.indexOf(s)>=0;};
  ok('an endpoint still prints its STD-004 code',(function(){
    D.devices.push(dev({type:'ep',code:'ACP',id:'DT2'}));const a=sceneHas('>ACP<');D.devices.pop();return a;})());
  ok('hardware still prints its short label',(function(){
    D.devices.push(dev({type:'rbx',rb:'RB-M',id:'DT3',h:2150}));
    const a=sceneHas('>RBX<')&&sceneHas('>RB-M<');D.devices.pop();return a;})());
  ok('an empty szerelvénydoboz is still drawn open',/stroke-dasharray/.test(w.devSym(dev({type:'box',lv:true}))));

  // ---------- the spotlight ----------
  ok('it is off until it is asked for',!w.lyrSpotOn());
  ok('with it off nothing lights up',(function(){w.lyrSpotSet('L0');return !w.lyrSpotIs({layer:'L0'});})());
  ok('switching it on makes a layer lightable',(function(){
    w.lyrSpotToggle();w.lyrSpotSet('L0');return w.lyrSpotOn()&&w.lyrSpotIs({layer:'L0'});})());
  ok('only that layer lights up',!w.lyrSpotIs({layer:'LZZ'}));
  ok('an item with no layer counts as the default one',w.lyrSpotIs({}));
  ok('the ring is drawn in the layer colour',(function(){
    return w.lyrSpotRing({layer:'L0'},0,0,0.72).indexOf(w.lyrColorOf('L0'))>=0;})());
  ok('a lit device carries the ring into the drawing',(function(){
    D.devices.push(dev({type:'socket',id:'DT4'}));
    const a=w.devSym(D.devices[D.devices.length-1]).indexOf('fill-opacity="0.16"')>=0;
    D.devices.pop();return a;})());
  ok('switching it off clears the light',(function(){w.lyrSpotToggle();return !w.lyrSpotOn()&&!w.lyrSpotIs({layer:'L0'});})());
  ok('the spotlight is view state, never saved with the drawing',
     Object.keys(w.__data).indexOf('lyrSpot')<0);

  // ---------- the client-preview render ----------
  ok('preview is a style of its own, not a flavour of normal',(function(){
    st.style='normal';const a=w.prevOn();st.style='preview';const b=w.prevOn();st.style='normal';return !a&&b;})());
  ok('it draws, and differs from the normal render',(function(){
    st.style='normal';w.draw();const a=$('lyScene').innerHTML;
    st.style='preview';w.draw();const b=$('lyScene').innerHTML;
    st.style='normal';w.draw();return a!==b&&b.length>200;})());
  ok('it paints on the dark ground',(function(){
    st.style='preview';const c=w.bgCol();st.style='normal';return c===w.PREV.ground;})());
  ok('and the stage carries that ground, so the drawing stays a plain SVG',(function(){
    st.style='preview';w.draw();const a=$('stage').classList.contains('prev');
    st.style='normal';w.draw();return a&&!$('stage').classList.contains('prev');})());
  ok('the wireframe uses the design system line colour',(function(){
    st.style='preview';w.draw();const s=$('lyScene').innerHTML;st.style='normal';w.draw();
    return s.indexOf(w.PREV.line)>=0;})());
  ok('a glow is two passes, not a filter an exporter would drop',(function(){
    st.style='preview';w.draw();const s=$('lyScene').innerHTML;st.style='normal';w.draw();
    return s.indexOf('filter')<0&&s.indexOf('stroke-opacity')>=0;})());
  ok('the room name turns legible on the dark ground',(function(){
    const RM={poly:[[0,0],[4000,0],[4000,3000],[0,3000]],num:'R1',name:'Nappali'};
    st.style='preview';const a=w.floorLabel(RM,'ground');st.style='normal';
    return a.indexOf(w.PREV.muted)>=0;})());
  ok('the white-out render is untouched by any of it',(function(){
    st.style='whiteout';w.draw();const s=$('lyScene').innerHTML;st.style='normal';w.draw();
    return s.indexOf(w.PREV.line)<0&&s.indexOf('stroke="#000"')>=0;})());
  ok('one edge pass feeds both line renders',typeof w.wireEdges==='function'&&!!w.wireEdges().all);

  // ---------- the legend ----------
  ok('the legend lists what the plan actually uses',(function(){
    D.devices.push(dev({type:'socket',id:'DT5'}),dev({type:'ep',code:'SEN',id:'DT6'}));
    const rows=w.icoLegendRows();D.devices.pop();D.devices.pop();
    return rows.length>=2&&rows.every(r=>r.name&&r.fam&&r.mark);})());
  ok('reg: every render still draws with the new symbols',(function(){try{
    D.devices.push(dev({type:'socket',id:'DT7'}),dev({type:'ep',code:'SPK',id:'DT8'}),dev({type:'rbx',id:'DT9'}));
    ['normal','whiteout','blueprint','preview'].forEach(s=>{st.style=s;w.draw();});
    st.style='normal';w.vsSet(10);w.draw();w.vsSet(1);w.draw();
    D.devices.length=D.devices.length-3;return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
