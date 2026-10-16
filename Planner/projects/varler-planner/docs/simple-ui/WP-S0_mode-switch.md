# WP-S0 — Mode switch + clear screen

**Goal (user):** "a toggle lets users change between the Normal … and the Simplified UI. This simplified version would
clear the whole screen, leaving only an empty canvas."

**Read:**
- contract §1–§4;
- design §1;
- `src/12-boot.js:320` `setMobile`: the precedent, a body class plus a localStorage flag;
- `src/05d-shell.js` `pnlWide`: Tab wide mode. Simple mode must not disturb what it restores;
- `tests/spec-18-shell.js`: the style of a shell spec.

## Build (in `src/11s-sm-mode.js`)

1. **The module object:**
   ```js
   const SM={on:false,open:false,stack:[],q:null,focus:0};
   ```
   S2 and later add fields to it, never new top-level lets.
2. **`smOn()`** returns `SM.on`.
3. **`smSet(on,opt)`:**
   - `on=!!on`; if unchanged, return.
   - Toggle `body.ui-simple`.
   - Unless `opt.save===false`, write `localStorage['villanyterv_ui']='simple'|'normal'` inside try/catch.
   - When turning **on**: close the palette if it's open (`paletteClose()`), and close the context menu (`#ctx`
     display none).
   - When turning **off**: `smClose()` if it exists (S2 adds it).
   - Then `requestAnimationFrame(()=>{setTransform();draw();})`, plus an immediate `draw()` for jsdom.
   - Then `$('hud').textContent` = `'Egyszerű felület — F2: vissza'` or `'Normál felület'`.
4. **CSS**, injected once into `<style id="smCss">` and appended to `<head>`:
   ```css
   body.ui-simple header, body.ui-simple .side, body.ui-simple .resizer, body.ui-simple #toolbarRow,
   body.ui-simple .stage-wrap > :not(#stage):not(#smRoot),
   body.ui-simple #rbPanel, body.ui-simple #stdPanel, body.ui-simple #lpDock, body.ui-simple #lpQr,
   body.ui-simple #expMenu, body.ui-simple #palette, body.ui-simple [data-chrome]{display:none!important}
   #smRoot{display:none} body.ui-simple #smRoot{display:block}
   ```
   `#modalBg`, `#ctx`, `#gpCursor` and `#gpWheel` are **not** hidden: dialogs, right-click menus and the controller
   cursor must keep working.
5. **`#smRoot`:** create an empty `<div id="smRoot">` and append it to `.stage-wrap`. S1 fills it.
6. **Boot:** at module load, `?ui=simple` or `?ui=normal` in `location.search` wins (`save:false`, so a demo link
   doesn't change the stored preference). Otherwise use the localStorage value. Apply with `smSet(true,{save:false})`.
7. **Actions** (group `Nézet`):
   ```js
   {id:'ui.simple',label:'Egyszerű felület',icon:'◔',group:'Nézet',keys:['f2']   /* S06 = B */,
    alias:'simple minimal zen egyszeru csak rajz',hint:'Csak a rajz és a sarokmenü. Ugyanez a billentyű visszavált.',
    when:c=>!c.inEditor,run:()=>smSet(!smOn())}
   {id:'ui.normal',label:'Normál felület',icon:'▣',group:'Nézet',when:()=>smOn(),run:()=>smSet(false)}
   ```
8. **Header button:** inject `<button id="smBtn" title="Egyszerű felület: csak a rajz és a sarokmenü (F2)">◔ Egyszerű</button>`
   after `#bPanels`, or at the end of `header` if that's missing. `onclick=()=>smSet(true)`.
9. **Test hooks:** `window.smOn`, `window.smSet`, `window.__SM=SM`.

## Tests — `tests/spec-s0-sm-mode.js`

Use jsdom as in spec-94; `localStorage` works with `url:'http://localhost/'`.

1. Fresh load: `smOn()===false`, and `body` has no `ui-simple` class.
2. `smSet(true)`:
   - the class is set and `localStorage.villanyterv_ui==='simple'`;
   - `getComputedStyle(header).display==='none'`, and the same for `.side`, `#stageRail` and `#inspector`;
   - `#stage` is not `none`; `#smRoot` is `block`.
3. Scene identity: `vp.innerHTML` captured in normal mode (after `draw()`) `===` `vp.innerHTML` in simple mode after
   `draw()`, on the HOUSE fixture (`loadBuilding(HOUSE,false)`).
4. `runAction('ui.simple')` toggles back off; `runAction('ui.normal')` is disabled while off (`actionEnabled` false).
5. `JSON.stringify(sessionObj())` contains neither `uiSimple` nor `"SM"`.
6. Boot from the preference: a second JSDOM whose localStorage has `villanyterv_ui='simple'` (seed it in `beforeParse`)
   boots with `smOn()===true`.
7. URL wins: a JSDOM at `http://localhost/?ui=normal`, with the stored value `simple`, boots off, and localStorage still
   says `simple`.
8. Wide mode survives: `pnlWide()` (on), then `smSet(true)`, `smSet(false)`, `pnlWide()` (off) → the left sidebar has
   no `hide` class (exactly as before).
9. Esc while in simple mode with the menu closed does not leave the mode.

## Verifier focus

- No `state.*` field written.
- No edit outside the owned files.
- The header button sits in the header, so it hides itself.

## Out of scope

The dial (S1) and the look (S6).
