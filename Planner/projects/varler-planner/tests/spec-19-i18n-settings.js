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
 const rail=()=>$('stageRail').textContent.replace(/\s+/g,' ');
 const bar=()=>$('statusBar').textContent.replace(/\s+/g,' ');
 try{
  const lvl='ground';w.confirm=()=>true;w.alert=()=>{};
  w.newBlankProject();
  const WA=w.__getWalls()[lvl];WA.push({x0:0,y0:0,x1:4000,y1:300});
  w.__data.floors.push({level:lvl,poly:[[0,0],[4000,0],[4000,3000],[0,3000]],name:'Nappali'});
  w.ensureIds(w.__data);w.draw();

  // ---------- the seam ----------
  ok('translation helpers exist',typeof w.t==='function'&&typeof w.setLang==='function'&&!!w.LANGS.hu&&!!w.LANGS.en);
  ok('Hungarian is the default',w.lang()==='hu');
  ok('an unknown key falls back to the Hungarian passed in',w.t('no.such.key','eredeti szöveg')==='eredeti szöveg');
  ok('a known key translates',(function(){w.setLang('en');const v=w.t('stage.rooms','Helyiségek');
    w.setLang('hu');return v==='Rooms';})());
  ok('in Hungarian a key returns its fallback, not the English',w.t('stage.rooms','Helyiségek')==='Helyiségek');
  ok('the fallback is never a bare key',(function(){w.setLang('en');
    const v=w.t('totally.missing','magyar szöveg');w.setLang('hu');return v==='magyar szöveg';})());
  ok('setLang rejects an unknown language',(function(){w.setLang('de');return w.lang()==='hu';})());

  // ---------- what the seam already covers ----------
  ok('the stage rail follows the language',(function(){
    const hu=rail();w.setLang('en');w.draw();const en=rail();w.setLang('hu');w.draw();
    return /Épület/.test(hu)&&/Structure/.test(en)&&/Documentation/.test(en);})());
  ok('the status bar follows the language',(function(){
    const hu=bar();w.setLang('en');w.draw();const en=bar();w.setLang('hu');w.draw();
    return /szint:/.test(hu)&&/level:/.test(en)&&/snapped to walls|free drawing/.test(en);})());
  ok('the inspector follows the language',(function(){w.__setSel(null);
    w.setLang('en');w.renderShell();const en=$('inspector').textContent;
    w.setLang('hu');w.renderShell();const hu=$('inspector').textContent;
    return /Nothing selected/.test(en)&&/Nincs kijelölés/.test(hu);})());
  ok('inspector field labels translate',(function(){w.__setSel({t:'wall',ref:WA[0],level:lvl});
    w.setLang('en');const en=w.inspectorFields(w.__getSel()).map(f=>f.label).join(',');
    w.setLang('hu');const hu=w.inspectorFields(w.__getSel()).map(f=>f.label).join(',');
    return /Thickness/.test(en)&&/Vastagság/.test(hu);})());
  ok('the palette chrome translates',(function(){w.setLang('en');w.paletteOpen();
    const ph=$('palQ').placeholder;w.paletteClose();w.setLang('hu');
    return /Search commands/.test(ph);})());
  ok('the language survives a save',(function(){w.setLang('en');
    const so=JSON.parse(JSON.stringify(w.sessionObj()));w.setLang('hu');
    return so.state.lang==='en';})());
  ok('coverage is reportable',(function(){const c=w.i18nCoverage();return c.keys>30&&c.lang==='hu';})(),
     w.i18nCoverage().keys+' keys');
  ok('switching language is an action',(function(){w.setLang('hu');
    const ids=w.actionsFor().map(a=>a.id);return ids.includes('app.lang.en')&&!ids.includes('app.lang.hu');})(),
     'only the other language is offered');

  // ---------- the standards panel ----------
  ok('the settings action exists with a shortcut',(function(){const a=w.actionById('app.settings');
    return a&&a.keys&&a.keys.indexOf('mod+,')>=0;})());
  w.settingsPanel();
  ok('chase settings are editable',!!$('stF')&&!!$('stPad')&&!!$('stBox'));
  ok('the board height and the plenum are editable',!!$('stBoard')&&!!$('stPlen'));
  ok('the language selector is there',!!$('stLang'));
  ok('it shows the derived chase widths',(function(){const t2=$('modal').textContent;
    return t2.indexOf('⌀20 → '+w.chaseWidthOf(20))>0;})());
  ok('it lists the standard heights',/1100|belmagasság/.test($('modal').textContent));
  ok('it lists the IP table',(function(){const t2=$('modal').textContent;
    return /IP20/.test(t2)&&/IP44/.test(t2)&&/IP65/.test(t2);})());
  ok('it lists the wall presets',/Pengefal/.test($('modal').textContent));
  ok('saving applies the values',(function(){
    $('stF').value='2';$('stPad').value='6';$('stBox').value='60';$('stPlen').value='300';
    $('mOk').onclick();
    return w.__state.chaseFactor===2&&w.__state.chasePad===6&&w.__state.boxDepth===60&&w.__state.plenum===300;})());
  ok('the chase width follows the new factor',w.chaseWidthOf(20)===40,''+w.chaseWidthOf(20));
  ok('the plenum default follows the setting',(function(){w.DROPC.ground=0;
    return w.dropCeilOrDefault('ground',null)===w.wallH('ground')-300;})());
  ok('the settings persist with the project',(function(){const so=JSON.parse(JSON.stringify(w.sessionObj()));
    return so.state.chaseFactor===2&&so.state.plenum===300;})());
  // back to the defaults
  w.settingsPanel();$('stF').value='1.6';$('stPad').value='4';$('stBox').value='45';$('stPlen').value='250';$('mOk').onclick();
  ok('defaults restore cleanly',w.chaseWidthOf(20)===32);

  // ---------- 1.0 ----------
  ok('the version is 1.0',/^1\.0\.\d+$/.test(w.VERSION),w.VERSION);

  // ---------- regressions ----------
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: shell, palette, status bar',!!$('stageRail')&&typeof w.paletteOpen==='function'&&!!$('statusBar'));
  ok('reg: editors',(function(){try{w.openWallView(WA[0],lvl);w.wvCloseEditor(true);
    w.openPlaneView(w.__data.floors[0],lvl,'ceiling');w.wvCloseEditor(true);return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: schema + surface layer',typeof w.linkTarget==='function'&&typeof w.edBindSurface==='function');
  ok('reg: layered render',!!$('lyScene')&&!!$('lyOverlay'));
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
