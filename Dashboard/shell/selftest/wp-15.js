// WP-15 probe (real Electron, real pty): open a `cmd` term pane, type `echo VRG_PANE` through xterm's input path, find the text in the
// xterm buffer; then narrow the pane and check the pty reports the new column count (`mode con`).
'use strict';
module.exports = async function probe({ win }) {
  const errors = [];
  const { frame } = win.desk;
  const fjs = code => frame.webContents.executeJavaScript(code);
  const wait = async (code, ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (await fjs(code)) return true; await new Promise(r => setTimeout(r, 150)); }
    return false;
  };
  const bufferText = `(() => { const i = window.VRGFrame.pane(window.__wp15); const b = i && i.term && i.term.buffer.active; if (!b) return ''; const o = []; for (let n = 0; n < b.length; n++) o.push(b.getLine(n).translateToString(true)); return o.join('\\n'); })()`;
  let id = '';
  try {
    id = await fjs(`window.__wp15 = window.VRGFrame.open('term', { prof: 'cmd' })`);
    if (!id) { errors.push('the frame did not open a term pane'); return { ok: false, errors }; }
    if (!(await wait(`!!(window.VRGFrame.pane(window.__wp15) || {}).id`, 15000))) { errors.push('pane never got a session (libs not loaded or cmd unavailable)'); }
    else {
      await fjs(`window.VRGFrame.pane(window.__wp15).term.input('echo VRG_PANE\\r', true)`);
      if (!(await wait(`/VRG_PANE/.test(${bufferText}.split('\\n').filter(l => !/echo VRG_PANE/.test(l)).join('\\n'))`, 8000))) errors.push('no output line with VRG_PANE in the xterm buffer');

      const cols = async () => {
        await fjs(`window.VRGFrame.pane(window.__wp15).term.input('mode con\\r', true)`);
        await new Promise(r => setTimeout(r, 1200));
        const txt = await fjs(bufferText);
        const m = [...txt.matchAll(/Columns:\s+(\d+)/g)].pop();
        return m ? +m[1] : 0;
      };
      const before = await cols();
      const termCols = await fjs(`window.VRGFrame.pane(window.__wp15).term.cols`);
      if (!before) errors.push('mode con printed no Columns line');
      else if (before !== termCols) errors.push('pty cols ' + before + ' != xterm cols ' + termCols);
      await fjs(`window.VRGFrame.pane(window.__wp15).host.style.width = '320px'`);
      if (!(await wait(`window.VRGFrame.pane(window.__wp15).term.cols < ${before || 1}`, 5000))) errors.push('xterm did not shrink after the pane resize');
      else {
        await new Promise(r => setTimeout(r, 500));
        const after = await cols();
        const nowCols = await fjs(`window.VRGFrame.pane(window.__wp15).term.cols`);
        if (!after || after >= before) errors.push('pty cols did not shrink: ' + before + ' → ' + after);
        else if (after !== nowCols) errors.push('pty cols ' + after + ' != xterm cols ' + nowCols);
      }
    }
  } catch (e) { errors.push('probe error: ' + e.message); }
  // Leave no term pane behind: the layout is saved to the test home and a pane left in it would start a shell at the next launch
  // (a live pty at quit makes the shell exit non-zero). Closing a pane unmounts it, which kills its pty.
  try {
    await fjs(`(() => { for (const p of window.VRGLayoutLib.panes(window.VRGFrame.tree())) if (p.kind === 'term') window.VRGFrame.close(p.id); window.VRGFrame.save(); return 1; })()`);
    await new Promise(r => setTimeout(r, 1500));
  } catch (e) { errors.push('cleanup error: ' + e.message); }
  return { ok: !errors.length, errors };
};
