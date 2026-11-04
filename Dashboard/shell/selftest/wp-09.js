// WP-09 probe (real Electron, temp home set by main.js): a fake job started in main shows a row in the frame, the page cancels it;
// a question from main opens the "Kérdés" dialog and the answer reaches the job; app.toast shows a toast.
'use strict';
module.exports = async function probe({ win }) {
  const errors = [];
  const { frame, jobs } = win.desk;
  const fjs = code => frame.webContents.executeJavaScript(code);
  const wait = async (f, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { try { if (await f()) return true; } catch (e) {} await new Promise(r => setTimeout(r, 50)); }
    return false;
  };
  if (!(await wait(() => fjs(`document.body && document.body.dataset.ready === '1' && !!window.VRGToasts`)))) return { ok: false, errors: ['frame did not become ready'] };

  // a job that runs until it is cancelled
  let steps = 0;
  const id = jobs.create({ kind: 'selftest', hu: 'Próbafeladat', run: async ctx => {
    while (!ctx.cancelled && steps < 400) { steps++; ctx.progress(1, 3); await new Promise(r => setTimeout(r, 25)); }
  } });
  const row = `[data-role="job"][data-job="${id}"]`;
  if (!(await wait(() => fjs(`!!document.querySelector('${row}')`)))) return { ok: false, errors: [...errors, 'no job row in the frame'] };
  if (!(await wait(() => fjs(`document.querySelector('${row} [data-role="job-state"]').textContent === 'Folyamatban'`)))) errors.push('the row does not say Folyamatban');
  const bar = await fjs(`document.querySelector('${row} [data-role="job-bar"]').value`);
  if (Math.abs(bar - 1 / 3) > 0.01) errors.push('progress bar value ' + bar);

  const r = await fjs(`window.vrg.jobs.list()`);
  if (!r || r.ok !== true || !r.jobs.some(j => j.job === id && j.state === 'running')) errors.push('jobs.list: ' + JSON.stringify(r));
  const bad = await fjs(`window.vrg.call('jobs', 'cancel', { job: '../x y' })`);
  if (!bad || bad.ok !== false) errors.push('a bad job id was not refused');

  await fjs(`document.querySelector('${row} [data-role="job-cancel"]').click()`);
  if (!(await wait(() => jobs.get(id).state === 'cancelled'))) errors.push('the job did not reach cancelled: ' + JSON.stringify(jobs.get(id)));
  if (!(await wait(() => fjs(`document.querySelector('${row} [data-role="job-state"]').textContent === 'Megszakítva'`)))) errors.push('the row does not say Megszakítva');

  // a question
  let answer = '';
  const qid = jobs.create({ kind: 'selftest', hu: 'Kérdéses', run: async ctx => { answer = await ctx.ask({ hu: 'Már létezik', choices: ['skip', 'overwrite', 'rename'] }); } });
  if (!(await wait(() => fjs(`(() => { const a = document.querySelector('[data-role="ask"]'); return !!a && !a.hidden && a.querySelectorAll('[data-choice]').length === 3; })()`)))) return { ok: false, errors: [...errors, 'no Kérdés dialog'] };
  const title = await fjs(`document.querySelector('[data-role="ask-title"]').textContent`);
  if (title !== 'Kérdés') errors.push('dialog title: ' + title);
  await fjs(`document.querySelector('[data-role="ask-all"]').click(); document.querySelector('[data-choice="skip"]').click()`);
  if (!(await wait(() => answer === 'skip'))) errors.push('the answer did not reach the job: ' + JSON.stringify(answer));
  await jobs.whenDone(qid);

  // a toast from main
  await fjs(`window.VRGToasts.toast({ ok: true, hu: 'Teszt', en: 'Test' })`);
  if (!(await wait(() => fjs(`!!document.querySelector('[data-role="toast"]')`)))) errors.push('no toast element');
  return { ok: !errors.length, errors };
};
