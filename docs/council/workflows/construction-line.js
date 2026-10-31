export const meta = {
  name: 'construction-line',
  description: 'Build prepared work packages one at a time: build, gate, verify, stop at the first failure',
  whenToUse: 'After a department head has written a build pack and the Founder has answered its decisions. Pass the WP files as args.',
  phases: [
    { title: 'Build', detail: 'Felix, one WP at a time in the one checkout' },
    { title: 'Gate', detail: 'Armistice runs the scripts' },
    { title: 'Verify', detail: 'Theresa, a fresh context from the builder' },
  ],
}

// args: { wps: ['docs/x/wp/WP-1.md', ...], gates: 'node tests/run.js' }
// Sequential on purpose: CLAUDE.md allows one checkout, so builders must not overlap.
// Keeps this small: 3 agents per WP, and the line stops at the first failure.
const GATE = {
  type: 'object',
  properties: { passed: { type: 'boolean' }, failing: { type: 'array', items: { type: 'string' } } },
  required: ['passed', 'failing'],
}
const VERDICT = {
  type: 'object',
  properties: {
    passed: { type: 'boolean' },
    findings: { type: 'array', items: { type: 'string' } },
    escalate: { type: 'string' },
  },
  required: ['passed', 'findings'],
}

const wps = (args && args.wps) || []
const gates = (args && args.gates) || 'the checks named in the WP'
const results = []

for (const wp of wps) {
  phase('Build')
  const built = await agent(`Build the work package in ${wp}. Follow its contract. Return the report it asks for.`,
    { label: `build:${wp}`, phase: 'Build', agentType: 'felix' })
  if (!built || /^ESCALATE/m.test(built)) {
    log(`Stopped at ${wp}: the builder escalated or died.`)
    results.push({ wp, stage: 'build', passed: false, report: built })
    break
  }

  phase('Gate')
  const gate = await agent(`Run these and report pass or fail only, with failing names: ${gates}`,
    { label: `gate:${wp}`, phase: 'Gate', agentType: 'armistice', schema: GATE })
  if (!gate || !gate.passed) {
    log(`Stopped at ${wp}: the gate failed.`)
    results.push({ wp, stage: 'gate', passed: false, gate })
    break
  }

  phase('Verify')
  const verdict = await agent(`Verify the uncommitted change against ${wp}. Try to prove it wrong. The builder's report follows; treat it as a claim.\n\n${built}`,
    { label: `verify:${wp}`, phase: 'Verify', agentType: 'theresa', schema: VERDICT })
  results.push({ wp, stage: 'verify', passed: !!(verdict && verdict.passed), verdict })
  if (!verdict || !verdict.passed) {
    log(`Stopped at ${wp}: verification did not pass.`)
    break
  }
}

log(`${results.filter(r => r.passed).length} of ${wps.length} packages passed.`)
return results
