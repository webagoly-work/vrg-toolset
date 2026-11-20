/* VRG event spine (VIS-Q4, 2026-11-20): Claude Code transcript lines folded into sessions, calls, subagents,
   parallel fan-outs, commands and images. The one transcript reader for the VRG visuals: the Munkavászon
   (SessionCanvas/vrg-munkavaszon.html carries an inline copy between model:begin / model:end, written by
   tools/events-sync.js) and the Stack's Érintésnyom (Stack/erintesnyom.html loads this file).
   Edit this file, then: node tools/events-sync.js   (--check fails when the copy has drifted).
   Tests: SessionCanvas/test/model.test.js. */
/* The session model: Claude Code transcript lines (one JSON object per line) folded into what the canvas draws.
   Pure data, no DOM: SessionCanvas/test/model.test.js runs this block in Node. Every question it answers takes
   a time T, so live view, replay and scrubbing are the same code. */
var SCModel = (function () {
  'use strict';
  var CATS = ['read', 'search', 'edit', 'shell', 'web', 'agent', 'mcp', 'plan', 'other'];
  var CAT_OF = {
    Read: 'read', NotebookRead: 'read', LS: 'read',
    Grep: 'search', Glob: 'search', ToolSearch: 'search',
    Edit: 'edit', Write: 'edit', MultiEdit: 'edit', NotebookEdit: 'edit',
    Bash: 'shell', PowerShell: 'shell', BashOutput: 'shell', KillShell: 'shell', KillBash: 'shell', Monitor: 'shell', TaskStop: 'shell', TaskOutput: 'shell',
    WebSearch: 'web', WebFetch: 'web',
    Agent: 'agent', Task: 'agent', Workflow: 'agent', SendMessage: 'agent', ListAgents: 'agent',
    TodoWrite: 'plan', TaskCreate: 'plan', TaskUpdate: 'plan', TaskList: 'plan', TaskGet: 'plan',
    EnterPlanMode: 'plan', ExitPlanMode: 'plan', AskUserQuestion: 'plan',
  };
  function catOf(name) { return /^mcp__/.test(name) ? 'mcp' : CAT_OF[name] || 'other'; }
  var base = function (p) { var a = String(p || '').split(/[\\/]/).filter(Boolean); return a[a.length - 1] || ''; };
  var one = function (s, n) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); n = n || 80;
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  };
  var clip = function (s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + '\n…' : s; };
  var nl = function (s) { return s ? String(s).split('\n').length : 0; };
  var norm = function (s) { return String(s || '').replace(/\s+/g, ' ').trim(); };

  function label(name, inp) {
    inp = inp || {};
    switch (name) {
      case 'Read': case 'Write': case 'Edit': case 'MultiEdit': case 'NotebookEdit': case 'NotebookRead':
        return base(inp.file_path || inp.notebook_path);
      case 'Bash': case 'PowerShell': return one(inp.description || inp.command, 60);
      case 'Grep': case 'Glob': return one(inp.pattern, 44);
      case 'WebSearch': return one(inp.query, 50);
      case 'WebFetch': try { return new URL(inp.url).host; } catch (e) { return one(inp.url, 40); }
      case 'Agent': case 'Task': return one(inp.description || inp.subagent_type || 'agent', 50);
      case 'Skill': return one(inp.skill, 40);
      case 'TaskCreate': return one(inp.subject, 50);
      case 'TaskUpdate': return '#' + inp.taskId + (inp.status ? ' → ' + inp.status : '');
      case 'TodoWrite': return (inp.todos || []).length + ' todo';
      case 'ToolSearch': return one(inp.query, 40);
      case 'Monitor': return one(inp.description || inp.command, 50);
      case 'AskUserQuestion': return one(inp.questions && inp.questions[0] && inp.questions[0].question, 50);
    }
    var m = /^mcp__(.+?)__(.+)$/.exec(name);
    if (m) return m[1].replace(/^plugin_[^_]+_/, '') + ' · ' + m[2];
    if (inp.description) return one(inp.description, 50);
    return '';
  }
  function textOf(c) {
    if (c == null) return '';
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) return c.map(function (b) { return b.type === 'text' ? b.text : b.type === 'image' ? '[image]' : ''; }).join('\n');
    try { return JSON.stringify(c); } catch (e) { return ''; }
  }
  var tag = function (s, k) { var m = new RegExp('<' + k + '>([\\s\\S]*?)</' + k + '>').exec(s); return m ? m[1].trim() : ''; };
  var stamp = function (e) { var t = Date.parse(e.timestamp); return isNaN(t) ? null : t; };
  var IMG_EXT = /\.(png|jpe?g|gif|webp|bmp)$/i;
  /* what a slash command, skill or codephrase is, for its colour and icon; first match wins */
  var CMD_KINDS = [
    ['go', /^GO\s+[A-Z]/],
    ['research', /research|kutat|akecheta|piacmero|search|scout/i],
    ['batch', /batch|workflow|loop|ultracode|fan-?out|parallel|fleet/i],
    ['plan', /plan|terv/i],
    ['review', /review|simplify|security|audit|critique|check|verify/i],
    ['context', /compact|clear|context|memory|resume|rewind|export/i],
    ['config', /config|permission|model|fast|mcp|agents|hooks|settings|login|status|doctor|keybind|statusline|init|install|plugin/i],
    ['build', /run|build|deploy|test|debug|fix|ship|commit|release/i],
  ];
  function cmdKind(name, fallback) {
    var full = String(name || '').trim(), n = full.replace(/^\//, '').replace(/^[\w-]+:/, '');
    for (var i = 0; i < CMD_KINDS.length; i++) if (CMD_KINDS[i][1].test(i ? n : full)) return CMD_KINDS[i][0];
    return fallback || 'command';
  }
  /* a Workflow script's meta: its name and phase titles, read from the source text (never run) */
  function workflowMeta(script) {
    script = String(script || '');
    var i = script.indexOf('meta'), head = i < 0 ? '' : script.slice(i, i + 4000), out = { name: '', phases: [], labels: [] };
    var nm = /name\s*:\s*(['"`])(.*?)\1/.exec(head); if (nm) out.name = nm[2];
    var ph = /phases\s*:\s*\[([\s\S]*?)\]/.exec(head), re = /title\s*:\s*(['"`])(.*?)\1/g, m;
    if (ph) while ((m = re.exec(ph[1]))) out.phases.push(m[2]);
    var lr = /label\s*:\s*(['"`])(.*?)\1/g;
    while ((m = lr.exec(script)) && out.labels.length < 40) out.labels.push(m[2].replace(/\$\{[^}]*\}/g, '*'));
    return out;
  }
  var median = function (a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }); return s[s.length >> 1]; };

  function create() {
    var S = {
      t0: null, tEnd: null, title: '', sid: '', cwd: '', branch: '', model: '', version: '',
      items: [], calls: new Map(), bgIndex: new Map(), agentCalls: [],
      tasks: new Map(), taskOrder: [], msgs: new Map(), tokens: [], marks: [],
      cmds: [], images: [], fans: [], fanByMsg: new Map(), plan: null,
      agents: new Map(), agentOrder: [], totals: { out: 0, think: 0, add: 0, rem: 0 }, ctxMax: 0,
      turns: 0, lines: 0, bad: 0, rev: 0,
    };
    var durCache = { rev: -1, name: null, cat: null };
    var push = function (it) { it.seq = S.items.length; S.items.push(it); return it; };

    /* commands: slash commands, skills, GO codephrases, plan mode, workflows. scope says what ends them:
       'turn' the turn's end or the next prompt, 'plan' leaving plan mode, 'call' the call's (background) end */
    function openCmd(name, kind, t, src, scope, extra) {
      var c = { name: name, kind: kind, t: t, tEnd: null, src: src, scope: scope, n: S.cmds.length, skills: [] };
      for (var k in extra || {}) c[k] = extra[k];
      S.cmds.push(c);
      push({ kind: 'cmd', t: t, agent: 'root', cmd: c, text: name + (c.args ? ' ' + c.args : '') });
      return c;
    }
    function closeCmds(t, scope) { S.cmds.forEach(function (c) { if (c.tEnd == null && c.scope === scope && c.t <= t) c.tEnd = t; }); }
    function openTurnCmd() { for (var i = S.cmds.length - 1; i >= 0; i--) if (S.cmds[i].scope === 'turn' && S.cmds[i].tEnd == null) return S.cmds[i]; return null; }
    function currentCmd(t) {
      for (var i = S.cmds.length - 1; i >= 0; i--) { var c = S.cmds[i]; if (c.kind !== 'plan' && c.t <= t && (c.tEnd == null || c.tEnd >= t)) return c; }
      return S.plan && S.plan.tEnd == null ? S.plan : null;
    }
    function planMode(on, t) {
      if (on && (!S.plan || S.plan.tEnd != null)) S.plan = openCmd('plan mode', 'plan', t, 'plan', 'plan');
      if (!on) closeCmds(t, 'plan');
    }
    function addImage(o) { o.kind = 'image'; o.n = S.images.length; S.images.push(o); return push(o); }
    function imagesOf(content, t, key, ref, from) {
      if (!Array.isArray(content)) return;
      content.forEach(function (x) {
        if (x && x.type === 'image' && x.source && x.source.data) addImage({ t: t, agent: key, ref: ref, from: from, mime: x.source.media_type || 'image/png', data: x.source.data });
      });
    }

    function agentOf(key, t) {
      var a = S.agents.get(key);
      if (!a) { a = { key: key, label: key.replace(/^a:/, '').slice(0, 10), t0: t, tEnd: t, n: 0, parent: null, prompt: '' }; S.agents.set(key, a); S.agentOrder.push(key); }
      if (t != null) { if (a.t0 == null || t < a.t0) a.t0 = t; if (a.tEnd == null || t > a.tEnd) a.tEnd = t; }
      return a;
    }
    function link(call, a) { call.sub = a.key; a.parent = call.id; a.label = call.label || a.label; a.type = call.input.subagent_type || ''; }
    function tryLink() {
      S.agentCalls.forEach(function (c) {
        if (c.sub) return;
        if (c.agentId && S.agents.has('a:' + c.agentId)) return link(c, S.agents.get('a:' + c.agentId));
        var p = norm(c.input.prompt);
        if (!p) return;
        for (var i = 0; i < S.agentOrder.length; i++) {
          var a = S.agents.get(S.agentOrder[i]);
          if (!a.parent && a.prompt && norm(a.prompt) === p) return link(c, a);
        }
      });
    }

    function task(id, t) {
      id = String(id);
      var k = S.tasks.get(id);
      if (!k) { k = { id: id, subject: '#' + id, active: '', tCreated: t, hist: [{ t: t, status: 'pending' }] }; S.tasks.set(id, k); S.taskOrder.push(id); }
      return k;
    }
    function setStatus(k, t, st) { if (st && k.hist[k.hist.length - 1].status !== st) k.hist.push({ t: t, status: st }); }
    function todos(list, t) {
      var seen = {};
      (list || []).forEach(function (td) {
        var id = 'todo:' + (td.id || td.content); seen[id] = 1;
        var k = task(id, t); k.subject = td.content || k.subject; k.active = td.activeForm || k.active;
        setStatus(k, t, td.status);
      });
      S.taskOrder.forEach(function (id) { if (id.indexOf('todo:') === 0 && !seen[id]) setStatus(S.tasks.get(id), t, 'deleted'); });
    }

    function notify(text, t) {
      var useId = tag(text, 'tool-use-id'), taskId = tag(text, 'task-id');
      var c = S.calls.get(useId) || S.bgIndex.get(taskId);
      if (!c || c.bgEnd != null) return;
      c.bg = true; c.bgEnd = t; c.bgStatus = tag(text, 'status') || 'done';
      if (c.wf) c.wf.tEnd = t;
      if (/fail|error|kill/i.test(c.bgStatus)) c.bgError = true;
      push({ kind: 'note', note: 'bg', t: t, agent: 'root', ref: c.id, text: tag(text, 'summary') || (c.label + ' · ' + c.bgStatus) });
    }

    function addCall(b, t, key, msg) {
      var inp = b.input || {};
      var c = { kind: 'call', id: b.id, name: b.name, cat: catOf(b.name), label: label(b.name, inp), input: inp,
        t: t, tEnd: null, agent: key, msg: msg, error: false, bg: false, bgEnd: null, out: '' };
      if (b.name === 'Edit') { c.add = nl(inp.new_string); c.rem = nl(inp.old_string); }
      else if (b.name === 'Write') c.add = nl(inp.content);
      else if (b.name === 'MultiEdit') { c.add = 0; c.rem = 0; (inp.edits || []).forEach(function (x) { c.add += nl(x.new_string); c.rem += nl(x.old_string); }); }
      if (c.add) S.totals.add += c.add; if (c.rem) S.totals.rem += c.rem;
      S.calls.set(b.id, c); push(c);
      if (key !== 'root') S.agents.get(key).n++;
      if ((b.name === 'Agent' || b.name === 'Task') && key === 'root') {
        var fan = S.fanByMsg.get(msg);   // the Agent calls of one message run in parallel: one fan-out
        if (!fan) { fan = { id: msg, t: t, calls: [], cmd: currentCmd(t), n: S.fans.length }; S.fans.push(fan); S.fanByMsg.set(msg, fan); }
        fan.calls.push(c); c.fan = fan;
      }
      if (b.name === 'Agent' || b.name === 'Task') { S.agentCalls.push(c); tryLink(); }
      if (key === 'root' && b.name === 'Skill' && inp.skill) {
        var open = openTurnCmd();
        if (open) open.skills.push(String(inp.skill));
        else openCmd(String(inp.skill), cmdKind(inp.skill, 'skill'), t, 'skill', 'turn', { args: one(inp.args, 90), call: c });
      }
      if (key === 'root' && b.name === 'EnterPlanMode') planMode(true, t);
      if (key === 'root' && b.name === 'ExitPlanMode' && S.plan) S.plan.plan = inp.plan || S.plan.plan;
      if (key === 'root' && b.name === 'Workflow') {
        var wm = workflowMeta(inp.script);
        c.wf = openCmd(wm.name || inp.name || 'workflow', 'batch', t, 'workflow', 'call', { phases: wm.phases, labels: wm.labels, call: c });
      }
      [].concat(inp.files || [], b.name === 'Read' ? [] : [inp.path, inp.file_path, inp.screenshot_path, inp.output_path])
        .forEach(function (p) { if (typeof p === 'string' && IMG_EXT.test(p)) addImage({ t: t, agent: key, ref: b.id, from: 'path', path: p }); });
      if (b.name === 'TodoWrite') todos(inp.todos, t);
      if (b.name === 'TaskUpdate' && inp.taskId != null) {
        var k = task(inp.taskId, t);
        if (inp.subject) k.subject = inp.subject;
        if (inp.activeForm) k.active = inp.activeForm;
        setStatus(k, t, inp.status);
      }
    }

    function result(b, e, t, key) {
      var c = S.calls.get(b.tool_use_id);
      if (!c) return;
      c.tEnd = t; c.error = !!b.is_error; c.out = clip(textOf(b.content), 6000);
      imagesOf(b.content, t, key, c.id, 'result');
      if (c.name === 'ExitPlanMode' && !c.error && key === 'root') planMode(false, t);
      var r = e.toolUseResult;
      if (r && typeof r === 'object') {
        if (r.backgroundTaskId) { c.bg = true; c.bgId = r.backgroundTaskId; S.bgIndex.set(r.backgroundTaskId, c); }
        if (r.agentId) { c.agentId = r.agentId; if (/async|launch|background|running/i.test(String(r.status || ''))) { c.bg = true; c.bgId = r.agentId; S.bgIndex.set(r.agentId, c); } tryLink(); }
        if (r.interrupted) c.interrupted = true;
        if (c.name === 'TaskCreate' && r.task && r.task.id != null) {
          var k = task(r.task.id, t); k.subject = r.task.subject || c.input.subject || k.subject; k.active = c.input.activeForm || '';
        }
      }
      if (!c.bg && /^(Bash|PowerShell|Agent|Task|Workflow)$/.test(c.name) && /^\s*(Command running in background|Async agent launched|Running in the background|Workflow (started|launched|running))/i.test(c.out)) {
        c.bg = true; var m = /ID:\s*([\w-]+)/.exec(c.out); if (m) { c.bgId = m[1]; S.bgIndex.set(m[1], c); }
      }
      if (c.name === 'TaskCreate' && !(r && r.task)) {
        var mm = /Task #(\w+)/.exec(c.out);
        if (mm) { var kk = task(mm[1], t); kk.subject = c.input.subject || kk.subject; kk.active = c.input.activeForm || ''; }
      }
      if (c.wf && !c.bg) c.wf.tEnd = t;
      if (key === 'root') S.marks.push({ t: t, k: 'result' });
    }

    function userLine(e, t, key) {
      var c = e.message && e.message.content;
      if (Array.isArray(c) && c.some(function (b) { return b.type === 'tool_result'; })) {
        c.forEach(function (b) { if (b.type === 'tool_result') result(b, e, t, key); });
        return;
      }
      var text = textOf(c);
      if (/<task-notification>/.test(text)) return notify(text, t);
      if (e.isMeta || e.isCompactSummary || !text.trim()) {
        if (e.isCompactSummary && key === 'root') push({ kind: 'note', note: 'compact', t: t, agent: key, text: 'compact' });
        return;
      }
      if (key !== 'root') { var a = S.agents.get(key); if (!a.prompt) { a.prompt = text; tryLink(); } return; }
      if (/^\s*\[Request interrupted/.test(text)) { push({ kind: 'note', note: 'interrupt', t: t, agent: key, text: text.trim() }); return; }
      if (/^\s*<(local-command-stdout|local-command-caveat|system-reminder|bash-stdout|bash-stderr)/.test(text)) return;
      var cmd = tag(text, 'command-name'), args = tag(text, 'command-args');
      if (cmd) text = cmd + (args ? ' ' + args : '');
      // a new prompt ends anything the previous turn left open
      S.calls.forEach(function (x) { if (x.agent === 'root' && x.tEnd == null && x.t <= t) { x.tEnd = t; x.interrupted = true; } });
      closeCmds(t, 'turn');
      var it = push({ kind: 'prompt', t: t, agent: key, text: text, n: ++S.turns, human: !e.origin || e.origin.kind === 'human' });
      var go = /^\s*(GO\s+[A-Z][A-Z0-9]*)\b/.exec(text), slash = !cmd && /^\s*(\/[A-Za-z][\w:.-]*)(?:\s+([\s\S]*))?$/.exec(text);
      if (cmd) it.cmd = openCmd(cmd, cmdKind(cmd), t, 'slash', 'turn', { args: one(args, 90) });
      else if (slash) it.cmd = openCmd(slash[1], cmdKind(slash[1]), t, 'slash', 'turn', { args: one(slash[2], 90) });
      else if (go) it.cmd = openCmd(go[1], 'go', t, 'go', 'turn');
      imagesOf(c, t, key, null, 'prompt');
      if (!S.title) S.title = one(text, 110);
      S.marks.push({ t: t, k: 'prompt' });
      return it;
    }

    function asstLine(e, t, key) {
      var m = e.message || {}, id = m.id || e.uuid, u = m.usage;
      if (u) {
        var rec = S.msgs.get(id);
        var out = u.output_tokens || 0;
        var ctx = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
        var th = (u.output_tokens_details && u.output_tokens_details.thinking_tokens) || 0;
        if (!rec) { rec = { t: t, out: 0, th: 0, ctx: 0, agent: key }; S.msgs.set(id, rec); S.tokens.push(rec); }
        if (out > rec.out) { S.totals.out += out - rec.out; rec.out = out; }
        if (th > rec.th) { S.totals.think += th - rec.th; rec.th = th; }
        if (ctx > rec.ctx) rec.ctx = ctx;
        if (key === 'root' && rec.ctx > S.ctxMax) S.ctxMax = rec.ctx;
      }
      if (m.model && key === 'root' && m.model !== '<synthetic>') S.model = m.model;
      (Array.isArray(m.content) ? m.content : []).forEach(function (b) {
        if (b.type === 'thinking' || b.type === 'redacted_thinking') push({ kind: 'think', t: t, agent: key, msg: id, text: b.thinking || '', ms: e.thinkingDurationMs || null });
        else if (b.type === 'text' && b.text && b.text.trim()) push({ kind: 'say', t: t, agent: key, msg: id, text: b.text, api: !!e.isApiErrorMessage });
        else if (b.type === 'tool_use') addCall(b, t, key, id);
      });
      if (key === 'root') {
        var ended = /^(end_turn|stop_sequence|max_tokens|refusal)$/.test(m.stop_reason || '');
        S.marks.push({ t: t, k: ended ? 'end' : 'asst' });
        if (ended) closeCmds(t, 'turn');
      }
    }

    /* line: a parsed object or a raw string; agent: 'root' or the subagent file's name (agent-<id>) */
    function add(line, agent) {
      var e = line;
      if (typeof line === 'string') { if (!line.trim()) return; try { e = JSON.parse(line); } catch (x) { S.bad++; return; } }
      if (!e || typeof e !== 'object') return;
      S.lines++;
      var key = agent && agent !== 'root' ? 'a:' + String(agent).replace(/^agent-/, '') : 'root';
      if (key === 'root' && e.isSidechain && e.agentId) key = 'a:' + e.agentId;
      var t = stamp(e);
      if (t != null) { if (S.t0 == null || t < S.t0) S.t0 = t; if (S.tEnd == null || t > S.tEnd) S.tEnd = t; }
      if (key === 'root') {
        if (e.sessionId) S.sid = e.sessionId; if (e.cwd) S.cwd = e.cwd;
        if (e.gitBranch) S.branch = e.gitBranch; if (e.version) S.version = e.version;
      } else agentOf(key, t);
      if (t == null) { S.rev++; return; }
      switch (e.type) {
        case 'queue-operation':
          if (e.operation === 'enqueue' && /<task-notification>/.test(e.content || '')) notify(e.content, t);
          break;
        case 'user':
          var isPrompt = !(Array.isArray(e.message && e.message.content) && e.message.content.some(function (b) { return b.type === 'tool_result'; }));
          if (key === 'root' && e.permissionMode && isPrompt && !e.isMeta) planMode(e.permissionMode === 'plan', t);
          userLine(e, t, key); break;
        case 'assistant': asstLine(e, t, key); break;
        case 'system':
          if (/compact/i.test(e.subtype || '')) push({ kind: 'note', note: 'compact', t: t, agent: key, text: 'compact' });
          else if (e.level === 'error' || /error/i.test(e.subtype || '')) push({ kind: 'note', note: 'error', t: t, agent: key, text: one(e.content || e.subtype, 200) });
          break;
      }
      S.rev++;
    }

    function durations() {
      if (durCache.rev === S.rev) return durCache;
      var byName = {}, byCat = {};
      S.calls.forEach(function (c) {
        if (c.tEnd == null || c.interrupted) return;
        var d = c.tEnd - c.t;
        (byName[c.name] = byName[c.name] || []).push(d);
        (byCat[c.cat] = byCat[c.cat] || []).push(d);
      });
      durCache = { rev: S.rev, name: byName, cat: byCat };
      return durCache;
    }
    /* the expected run time of a call: the median of its tool's finished calls, else its kind's */
    function expected(c) {
      var d = durations();
      if (d.name[c.name] && d.name[c.name].length >= 2) return median(d.name[c.name]);
      if (d.cat[c.cat] && d.cat[c.cat].length >= 3) return median(d.cat[c.cat]);
      return null;
    }

    function statusAt(k, T) {
      if (k.tCreated > T) return null;
      var st = null;
      for (var i = 0; i < k.hist.length && k.hist[i].t <= T; i++) st = k.hist[i].status;
      return st;
    }
    /* the task list at T: counts, and an ETA from the mean time a finished task took */
    function progressAt(T) {
      var list = [], durs = [], lastDone = null;
      S.taskOrder.forEach(function (id) {
        var k = S.tasks.get(id), st = statusAt(k, T);
        if (!st || st === 'deleted') return;
        var start = null, end = null;
        k.hist.forEach(function (h) { if (h.t > T) return; if (h.status === 'in_progress' && start == null) start = h.t; if (h.status === 'completed') end = h.t; });
        list.push({ id: k.id, subject: k.subject, active: k.active, status: st, start: start, end: st === 'completed' ? end : null });
      });
      var doneList = list.filter(function (x) { return x.status === 'completed'; }).sort(function (a, b) { return a.end - b.end; });
      doneList.forEach(function (x) {
        var s = x.start != null ? x.start : lastDone != null ? lastDone : S.tasks.get(x.id).tCreated;
        durs.push(Math.max(1000, x.end - s)); lastDone = x.end;
      });
      var avg = durs.length ? durs.reduce(function (a, b) { return a + b; }, 0) / durs.length : null;
      var pending = 0, part = 0, eta = null, inprog = [];
      list.forEach(function (x) {
        if (x.status === 'pending') pending++;
        if (x.status === 'in_progress') inprog.push(x);
      });
      if (avg != null) {
        eta = pending * avg;
        inprog.forEach(function (x) {
          var el = T - (x.start != null ? x.start : T);
          eta += Math.max(avg * 0.1, avg - el);
          part += Math.min(0.9, el / avg);
        });
      } else inprog.forEach(function () { part += 0.3; });
      return { list: list, total: list.length, done: doneList.length, inprog: inprog, pending: pending, part: part, avg: avg, eta: list.length ? eta : null };
    }

    function stateAt(T) {
      var last = null;
      for (var i = S.marks.length - 1; i >= 0; i--) if (S.marks[i].t <= T) { last = S.marks[i]; break; }
      var fg = [], bg = [];
      S.calls.forEach(function (c) {
        if (c.t > T) return;
        if (c.tEnd == null || c.tEnd > T) fg.push(c);
        else if (c.bg && (c.bgEnd == null || c.bgEnd > T)) bg.push(c);
      });
      var rootFg = fg.filter(function (c) { return c.agent === 'root'; });
      var st = !last ? 'empty'
        : rootFg.some(function (c) { return c.name === 'AskUserQuestion' || c.name === 'ExitPlanMode'; }) ? 'ask'
        : rootFg.length ? 'tool'
        : last.k === 'end' ? (bg.length ? 'bg' : 'idle') : 'model';
      return { state: st, fg: fg, bg: bg, last: last };
    }

    var callEnd = function (c) { return c.bg ? c.bgEnd : c.tEnd; };
    function agentMedian() {
      var d = [];
      S.agentCalls.forEach(function (c) { var e = callEnd(c); if (e != null && !c.interrupted) d.push(e - c.t); });
      return median(d);
    }
    function fanName(f) {
      var d = f.calls.map(function (c) { return c.input.description || ''; }).join(' ');
      if (f.calls.length === 1 && /report|jelent|writ|írás|összegz|summar|synth/i.test(d)) return 'write';
      if (f.cmd && f.cmd.kind === 'research') return f.calls.length > 1 ? 'research' : 'single';
      return f.calls.length > 1 ? 'parallel' : 'single';
    }
    /* parallel groups at T: each Agent fan-out, and each Workflow with the subagents that ran inside it */
    function groups(T) {
      var out = [];
      S.fans.forEach(function (f) {
        if (f.t > T) return;
        out.push({ id: 'fan:' + f.id, t: f.t, cmd: f.cmd, calls: f.calls, name: fanName(f),
          agents: f.calls.map(function (c) { return c.sub ? S.agents.get(c.sub) : null; }) });
      });
      S.cmds.forEach(function (c) {
        if (c.src !== 'workflow' || c.t > T) return;
        var ag = [];
        S.agentOrder.forEach(function (k) { var a = S.agents.get(k); if (!a.parent && a.t0 >= c.t && (c.tEnd == null || a.t0 <= c.tEnd)) ag.push(a); });
        out.push({ id: 'wf:' + c.n, t: c.t, cmd: c, calls: [c.call], name: 'workflow', wf: true, agents: ag });
      });
      return out.sort(function (a, b) { return a.t - b.t; });
    }
    /* a group at T: who is done, the expected run time (median of the finished siblings, else of every
       finished agent in the session) and the ETA of the slowest one still running */
    function groupStats(g, T) {
      var mem = g.wf
        ? g.agents.map(function (a) { var fin = g.cmd.tEnd != null && g.cmd.tEnd <= T; return { agent: a, start: a.t0, end: fin ? a.tEnd : null }; })
        : g.calls.map(function (c, i) { var e = callEnd(c); return { call: c, agent: g.agents[i], start: c.t, end: e != null && e <= T ? e : null, err: c.error || c.bgError }; });
      var durs = [], done = 0;
      mem.forEach(function (m) { if (m.end != null) { done++; durs.push(m.end - m.start); } });
      var exp = median(durs) || agentMedian(), eta = null, over = false;
      // one past the expected time still needs a while: a quarter of its elapsed time, at least 5 s
      if (done < mem.length && exp) {
        eta = 0;
        mem.forEach(function (m) {
          if (m.end != null) return;
          var el = T - m.start; if (el > exp) over = true;
          eta = Math.max(eta, el < exp ? exp - el : Math.max(5000, el * 0.25));
        });
      }
      var end = mem.length && done === mem.length ? Math.max.apply(null, mem.map(function (m) { return m.end; })) : null;
      if (g.wf && g.cmd.tEnd != null && g.cmd.tEnd <= T) end = g.cmd.tEnd;
      return { n: mem.length, done: done, mem: mem, exp: exp, eta: eta, end: end, over: over };
    }
    function cmdStats(cm, T) {
      var end = cm.tEnd == null || cm.tEnd > T ? T : cm.tEnd, calls = 0, ag = 0, agDone = 0, eta = null;
      S.calls.forEach(function (c) { if (c.agent === 'root' && c.t >= cm.t && c.t <= end) calls++; });
      groups(T).forEach(function (g) {
        if (g.cmd !== cm) return;
        var st = groupStats(g, T); ag += st.n; agDone += st.done;
        if (st.eta != null) eta = Math.max(eta || 0, st.eta);
      });
      return { calls: calls, agents: ag, agentsDone: agDone, eta: eta, running: end === T && (cm.tEnd == null || cm.tEnd > T) };
    }
    /* what a subagent has done by T, by kind */
    function agentWork(a, T) {
      var w = { search: 0, fetch: 0, read: 0, write: 0, other: 0, err: 0, last: null, n: 0 };
      S.calls.forEach(function (c) {
        if (c.agent !== a.key || c.t > T) return;
        w.n++; if (c.error) w.err++;
        if (c.name === 'WebSearch' || c.cat === 'search') w.search++;
        else if (c.name === 'WebFetch' || /fetch|scrape|browse/i.test(c.name)) w.fetch++;
        else if (c.cat === 'read') w.read++;
        else if (c.cat === 'edit') w.write++;
        else w.other++;
      });
      S.items.forEach(function (it) { if (it.agent === a.key && it.kind === 'say' && it.t <= T) w.last = it; });
      return w;
    }

    return { S: S, add: add, expected: expected, progressAt: progressAt, stateAt: stateAt, statusAt: statusAt,
      groups: groups, groupStats: groupStats, cmdStats: cmdStats, agentWork: agentWork };
  }

  /* A made-up session in the transcript format, ending at `now`: the Demo button and the tests use it.
     Plan mode, a CSV feature with a failing test, background build and agent, a UI screenshot, then a
     /deep-research run (four parallel researchers, a report writer) and a commit. */
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function b64(s) { // ASCII only: enough for the demo's SVGs, and runs where btoa does not
    var o = '', i = 0;
    for (; i < s.length; i += 3) {
      var a = s.charCodeAt(i), b = s.charCodeAt(i + 1), c = s.charCodeAt(i + 2), n = (a << 16) | ((b || 0) << 8) | (c || 0);
      o += B64[n >> 18 & 63] + B64[n >> 12 & 63] + (isNaN(b) ? '=' : B64[n >> 6 & 63]) + (isNaN(c) ? '=' : B64[n & 63]);
    }
    return o;
  }
  function demoShot(kind) {
    var w = 320, h = 200, x = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 320 200"><rect width="320" height="200" fill="#0f1a22"/>';
    if (kind === 'ui') {
      x += '<rect x="0" y="0" width="320" height="22" fill="#17232c"/><text x="10" y="15" font-family="monospace" font-size="10" fill="#93d3e6">KESZLET</text>' +
        '<rect x="262" y="4" width="48" height="14" fill="#e8a873"/><text x="274" y="15" font-family="monospace" font-size="10" fill="#0a141c">CSV</text>';
      for (var r = 0; r < 8; r++) x += '<rect x="10" y="' + (32 + r * 20) + '" width="300" height="14" fill="' + (r % 2 ? '#14212a' : '#182833') + '"/>' +
        '<rect x="16" y="' + (36 + r * 20) + '" width="' + (60 + (r * 37 % 90)) + '" height="6" fill="#a6afb7"/><rect x="240" y="' + (36 + r * 20) + '" width="40" height="6" fill="#8bcca1"/>';
    } else {
      x += '<text x="10" y="18" font-family="monospace" font-size="11" fill="#e8f0f6">CSV parse MB/s</text>';
      [180, 120, 260, 90, 210].forEach(function (v, i) { x += '<rect x="' + (24 + i * 58) + '" y="' + (180 - v * 0.55) + '" width="36" height="' + v * 0.55 + '" fill="' + ['#93d3e6', '#e8a873', '#8bcca1', '#b39cf0', '#e3be7b'][i] + '"/>'; });
      x += '<rect x="10" y="180" width="300" height="1" fill="#646d74"/>';
    }
    return b64(x + '</svg>');
  }
  function demo(now) {
    now = now || Date.now();
    var out = [], t = now - 27 * 60000, n = 0, ctx = 28000, pm = 'plan';
    var sid = 'demo0000-5e55-4c4a-9a00-000000000000';
    var iso = function () { return new Date(t).toISOString(); };
    var adv = function (s) { t += Math.round(s * 1000); };
    var id = function (p) { return p + 'demo' + (++n); };
    var L = function (o, agent) {
      var base = { timestamp: iso(), sessionId: sid, cwd: 'H:\\VRG\\Full\\Planner_VRG_U100', gitBranch: 'main', version: 'demo' };
      if (o.type === 'user' && !agent) base.permissionMode = pm;
      if (agent) { base.isSidechain = true; base.agentId = agent.replace('agent-', ''); }
      for (var k in o) base[k] = o[k];
      out.push({ agent: agent || 'root', line: JSON.stringify(base) });
    };
    var user = function (text) { L({ type: 'user', origin: { kind: 'human' }, message: { role: 'user', content: text }, uuid: id('u') }); };
    var msg = function (blocks, stop, think, agent) {
      var mid = id('msg_'); ctx += 1200 + (n * 997 % 2600);
      blocks.forEach(function (b) {
        L({ type: 'assistant', thinkingDurationMs: think ? think * 9 : undefined,
          message: { id: mid, role: 'assistant', model: 'claude-demo', content: [b], stop_reason: stop || 'tool_use',
            usage: { input_tokens: 4, cache_read_input_tokens: agent ? 9000 + n * 40 : ctx, cache_creation_input_tokens: 700,
              output_tokens: 160 + (think || 0) + (b.text ? b.text.length >> 2 : 60), output_tokens_details: { thinking_tokens: think || 0 } } } }, agent);
      });
    };
    var think = function () { return { type: 'thinking', thinking: '', signature: 'demo' }; };
    var say = function (text) { return { type: 'text', text: text }; };
    var use = function (name, input) { return { type: 'tool_use', id: id('toolu_'), name: name, input: input }; };
    var res = function (c, content, extra, agent, err) {
      var o = { type: 'user', uuid: id('u'), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: c.id, content: content, is_error: !!err }] } };
      for (var k in extra || {}) o[k] = extra[k];
      L(o, agent);
    };
    var img = function (kind) { return [{ type: 'image', source: { type: 'base64', media_type: 'image/svg+xml', data: demoShot(kind) } }]; };
    var tc = 0;
    var mkTask = function (subject, active) {
      var c = use('TaskCreate', { subject: subject, description: subject, activeForm: active });
      msg([c]); adv(0.8); tc++; res(c, 'Task #' + tc + ' created successfully: ' + subject, { toolUseResult: { task: { id: String(tc), subject: subject } } }); adv(0.4);
      return tc;
    };
    var upd = function (k, st) { var c = use('TaskUpdate', { taskId: String(k), status: st }); msg([c]); adv(0.5); res(c, 'Updated task #' + k + ' status'); adv(0.3); };

    // 1. plan mode: read, then the plan is approved
    user('Adj a Készlethez CSV-exportot (a szűrt lista oszlopaival), tesztekkel, és nézd meg, mit ír a szabvány az elválasztóról.');
    adv(6); msg([think(), say('Tervezés módban vagyok: előbb körülnézek, aztán tervet adok.')], 'tool_use', 380);
    var r1 = use('Read', { file_path: 'Inventory/src/ui/list.js' }), r2 = use('Read', { file_path: 'Inventory/src/ui/filters.js' }), g1 = use('Grep', { pattern: 'renderRows|columns' });
    msg([r1, r2, g1]); adv(0.6); res(g1, 'Inventory/src/ui/list.js:41\nInventory/src/ui/list.js:88'); adv(0.5); res(r1, '... 240 lines ...'); adv(0.4); res(r2, '... 120 lines ...');
    adv(9); var xp = use('ExitPlanMode', { plan: '1. CSV-író modul (RFC 4180)\n2. Tesztek\n3. Export gomb a listanézetben\n4. Build, check-start, commit' });
    msg([think(), xp], 'tool_use', 900); adv(14); pm = 'auto'; res(xp, 'User has approved your plan.');
    adv(2); msg([say('Jóváhagyva. A szűrt sorokat a list.js `visibleRows()` adja; arra építem az exportot.')], 'tool_use', 0);
    mkTask('CSV-író modul tesztekkel', 'Írom a CSV-író modult');
    mkTask('Export gomb a listanézetbe', 'Bekötöm az export gombot');
    mkTask('Build, check-start, commit', 'Buildelek és commitolok');
    upd(1, 'in_progress');
    var ag = use('Agent', { description: 'CSV elválasztó és idézés a szabványban', subagent_type: 'akecheta', prompt: 'Nézd meg az RFC 4180-at: elválasztó, idézés, sorvég. Írj rövid jegyzetet.', run_in_background: true });
    msg([ag]); adv(1.2);
    res(ag, 'Async agent launched successfully. agentId: a1demo (running in background)', { toolUseResult: { status: 'async_launched', agentId: 'a1demo' } });
    var A = 'agent-a1demo';
    adv(0.5); L({ type: 'user', message: { role: 'user', content: 'Nézd meg az RFC 4180-at: elválasztó, idézés, sorvég. Írj rövid jegyzetet.' }, uuid: id('u') }, A);
    adv(4); var ws = use('WebSearch', { query: 'RFC 4180 CSV quoting line breaks' }); msg([think(), ws], 'tool_use', 200, A);
    adv(2.5); var e1 = use('Write', { file_path: 'Inventory/src/export/csv.js', content: new Array(58).join('x\n') }); msg([e1]); adv(0.9); res(e1, 'File created');
    adv(3.5); res(ws, 'rfc-editor.org/rfc/rfc4180 ...', {}, A);
    adv(1); var wf = use('WebFetch', { url: 'https://www.rfc-editor.org/rfc/rfc4180' }); msg([wf], 'tool_use', 0, A);
    adv(1.5); var e2 = use('Write', { file_path: 'Inventory/test/csv.test.js', content: new Array(41).join('y\n') }); msg([e2]); adv(0.7); res(e2, 'File created');
    adv(2); var b1 = use('Bash', { command: 'npm test -- csv', description: 'CSV tesztek futtatása' }); msg([b1]);
    adv(5); res(wf, 'RFC 4180 text ...', {}, A);
    adv(4); res(b1, 'FAIL test/csv.test.js\n  ✕ quotes a field with a comma (4 ms)\n  Expected: "\\"a,b\\"" Received: "a,b"', {}, null, true);
    adv(8); msg([think(), say('Egy teszt elbukik: a vesszőt tartalmazó mezőt nem teszem idézőjelbe. Javítom.')], 'tool_use', 640);
    msg([think(), say('Elválasztó: vessző; idéző: kettős idézőjel, a benne lévő idézőjel duplázva; sorvég CRLF. Jegyzet kész.')], 'end_turn', 300, A);
    adv(3); var e3 = use('Edit', { file_path: 'Inventory/src/export/csv.js', old_string: 'return v;', new_string: 'if (/[",\\r\\n]/.test(v))\n  return \'"\' + v.replace(/"/g, \'""\') + \'"\';\nreturn v;' }); msg([e3]); adv(0.6); res(e3, 'The file has been updated.');
    adv(1); L({ type: 'queue-operation', operation: 'enqueue', content: '<task-notification>\n<task-id>a1demo</task-id>\n<tool-use-id>' + ag.id + '</tool-use-id>\n<status>completed</status>\n<summary>Agent "CSV elválasztó és idézés a szabványban" completed</summary>\n</task-notification>' });
    adv(2); var b2 = use('Bash', { command: 'npm test -- csv', description: 'CSV tesztek újra' }); msg([b2]); adv(6.5); res(b2, 'PASS test/csv.test.js (6 tests)');
    upd(1, 'completed'); upd(2, 'in_progress');
    adv(5); var mc = use('mcp__vrg-stack__stack_search', { query: 'Készlet listanézet export gomb' }); msg([think(), mc], 'tool_use', 260); adv(1.4); res(mc, '3 nodes');
    adv(6); var e4 = use('Edit', { file_path: 'Inventory/src/ui/toolbar.js', old_string: '</div>', new_string: '<button data-act="csv">CSV</button>\n</div>' }); msg([e4]); adv(0.5); res(e4, 'The file has been updated.');
    adv(2); var bb = use('Bash', { command: 'npm run build', description: 'Inventory build a háttérben', run_in_background: true }); msg([bb]); adv(0.8);
    res(bb, 'Command running in background with ID: bdemo1. Output is being written to: tasks/bdemo1.output', { toolUseResult: { backgroundTaskId: 'bdemo1' } });
    adv(4); var e5 = use('Edit', { file_path: 'Inventory/src/ui/list.js', old_string: 'export {', new_string: 'export { visibleRows,\n' }); msg([e5]); adv(0.4); res(e5, 'The file has been updated.');
    adv(30); L({ type: 'queue-operation', operation: 'enqueue', content: '<task-notification>\n<task-id>bdemo1</task-id>\n<tool-use-id>' + bb.id + '</tool-use-id>\n<status>completed</status>\n<summary>Background command "Inventory build a háttérben" completed (exit code 0)</summary>\n</task-notification>' });
    adv(3); var sh = use('Bash', { command: 'node shot.js http://localhost:8123 export.png', description: 'Képernyőkép az export gombról' }); msg([sh]); adv(4.5); res(sh, 'saved export.png');
    adv(1); var rd = use('Read', { file_path: 'export.png' }); msg([rd]); adv(0.7); res(rd, img('ui'));
    adv(3); msg([say('A képen ott az új CSV gomb a lista fejlécében.')], 'tool_use'); upd(2, 'completed'); upd(3, 'in_progress');
    adv(2); var ck = use('Bash', { command: 'node tools/check-start.js', description: 'START registry ellenőrzés' }); msg([ck]); adv(2.2); res(ck, 'ok: 214 paths, 0 problems');
    upd(3, 'completed');
    adv(4); msg([say('Kész az export: a szűrt lista oszlopai mennek ki, RFC 4180 szerint idézve.')], 'end_turn');

    // 2. /deep-research: four researchers in parallel, then the report writer
    adv(4 * 60);
    L({ type: 'user', origin: { kind: 'human' }, uuid: id('u'), message: { role: 'user', content: '<command-message>deep-research</command-message>\n<command-name>/deep-research</command-name>\n<command-args>Melyik CSV-könyvtár illik a böngészős Készlethez?</command-args>' } });
    L({ type: 'user', isMeta: true, uuid: id('u'), message: { role: 'user', content: [{ type: 'text', text: 'Base directory for this skill: ... (skill instructions)' }] } });
    adv(5); msg([think(), say('Négy szempontra bontom: sebesség és méret, szabványkövetés, licenc és karbantartás, böngészős API. Párhuzamosan kutatom őket, aztán jelentés készül.')], 'tool_use', 700);
    var k1 = mkTask('Kutatás', 'Kutatok'), k2 = mkTask('Jelentés megírása', 'Írom a jelentést'), k3 = mkTask('Jelentés átadása', 'Átadom a jelentést');
    upd(k1, 'in_progress');
    var mk = use('Bash', { command: 'mkdir -p "research_notes/CSV konyvtarak" reports', description: 'Kutatási mappák' }); msg([mk]); adv(0.4); res(mk, '');
    adv(2);
    var topics = [
      ['r1', 'Sebesség és méret', 62, [['WebSearch', 'csv parser benchmark browser 2026'], ['WebFetch', 'https://github.com/leeoniya/uDSV'], ['Read', 'bench.png'], ['WebFetch', 'https://bundlephobia.com/package/papaparse'], ['Write', 'speed.md']]],
      ['r2', 'Szabványkövetés', 96, [['WebSearch', 'RFC 4180 compliance csv libraries'], ['WebFetch', 'https://www.rfc-editor.org/rfc/rfc4180'], ['WebSearch', 'csv parser quoted newline bugs'], ['WebFetch', 'https://github.com/mholt/PapaParse/issues'], ['WebFetch', 'https://csv.js.org/parse/'], ['Write', 'standards.md']]],
      ['r3', 'Licenc és karbantartás', 44, [['WebSearch', 'papaparse license maintenance'], ['WebFetch', 'https://www.npmjs.com/package/papaparse'], ['Write', 'license.md']]],
      ['r4', 'Böngészős API és streaming', 128, [['WebSearch', 'browser streaming csv parse web worker'], ['WebFetch', 'https://developer.mozilla.org/docs/Web/API/Streams_API'], ['WebSearch', 'papaparse worker chunk'], ['WebFetch', 'https://www.papaparse.com/docs'], ['WebSearch', 'csv export blob download large'], ['Write', 'browser.md']]],
    ];
    var fanT = t, calls = topics.map(function (tp) {
      return use('Agent', { description: tp[1], subagent_type: 'general-purpose', prompt: 'Research ' + tp[1] + ' for a browser CSV library. Save your output notes to research_notes/CSV konyvtarak/' + tp[3][tp[3].length - 1][1] });
    });
    msg(calls);
    topics.forEach(function (tp, i) { // each researcher's own transcript, on its own clock
      var a = 'agent-' + tp[0], T0 = fanT + 900 + i * 400, steps = tp[3], span = tp[2] * 1000;
      t = T0; L({ type: 'user', message: { role: 'user', content: calls[i].input.prompt }, uuid: id('u') }, a);
      steps.forEach(function (st, j) {
        t = T0 + Math.round(span * (j + 0.3) / steps.length);
        var inp = st[0] === 'WebSearch' ? { query: st[1] } : st[0] === 'WebFetch' ? { url: st[1] } : st[0] === 'Read' ? { file_path: st[1] } : { file_path: 'research_notes/CSV konyvtarak/' + st[1], content: new Array(30 + j * 7).join('n\n') };
        var c = use(st[0], inp); msg(j ? [c] : [think(), c], 'tool_use', j ? 0 : 240, a);
        t += Math.round(span * 0.45 / steps.length);
        res(c, st[0] === 'Read' ? img('chart') : st[0] === 'Write' ? 'File created' : '... ' + (st[0] === 'WebSearch' ? '10 results' : 'page text'), {}, a);
      });
      t = T0 + span; msg([say(tp[1] + ': jegyzet kész, ' + steps.length + ' lépés, forrásokkal.')], 'end_turn', 0, a);
    });
    var order = topics.map(function (tp, i) { return [fanT + 900 + i * 400 + tp[2] * 1000 + 600, i]; }).sort(function (x, y) { return x[0] - y[0]; });
    order.forEach(function (o) { t = o[0]; res(calls[o[1]], topics[o[1]][1] + ': kész, a jegyzet a research_notes mappában.', { toolUseResult: { agentId: topics[o[1]][0], status: 'completed' } }); });
    adv(3); upd(k1, 'completed'); upd(k2, 'in_progress');
    var wr = use('Agent', { description: 'Write final report', subagent_type: 'general-purpose', prompt: 'Read the notes in research_notes/CSV konyvtarak/ and synthesize into a research report.' });
    msg([think(), wr], 'tool_use', 300);
    var W1 = 'agent-w1', w0 = t + 800; t = w0;
    L({ type: 'user', message: { role: 'user', content: wr.input.prompt }, uuid: id('u') }, W1);
    ['speed.md', 'standards.md', 'license.md', 'browser.md'].forEach(function (f, j) { t = w0 + 3000 + j * 2500; var c = use('Read', { file_path: 'research_notes/CSV konyvtarak/' + f }); msg([c], 'tool_use', 0, W1); t += 900; res(c, '... notes ...', {}, W1); });
    t = w0 + 22000; var rw = use('Write', { file_path: 'reports/CSV konyvtarak.md', content: new Array(140).join('r\n') }); msg([think(), rw], 'tool_use', 1800, W1); t = w0 + 58000; res(rw, 'File created', {}, W1);
    t = w0 + 61000; msg([say('A jelentés kész: a PapaParse ajánlott (worker, streaming, MIT), az uDSV a leggyorsabb.')], 'end_turn', 0, W1);
    t = w0 + 62500; res(wr, 'Report saved to reports/CSV konyvtarak.md', { toolUseResult: { agentId: 'w1', status: 'completed' } });
    adv(2); upd(k2, 'completed'); upd(k3, 'in_progress');
    var su = use('SendUserFile', { files: ['reports/CSV konyvtarak.md'], status: 'normal' }); msg([su]); adv(1); res(su, '1 file delivered to user.');
    upd(k3, 'completed');
    adv(2); msg([say('Elküldtem a jelentést. Röviden: a PapaParse illik a Készlethez (worker + streaming, MIT); ha a sebesség a fő szempont, az uDSV.')], 'end_turn');

    // 3. commit
    adv(3 * 60);
    user('Igen, commitold és told fel.');
    adv(4); var gc = use('Bash', { command: 'git add -A && git commit -m "Inventory: CSV export" && git push', description: 'Commit és push' }); msg([think(), gc], 'tool_use', 120);
    adv(5.5); res(gc, '[main 3f2a9c1] Inventory: CSV export\n 4 files changed, 104 insertions(+)');
    adv(2); msg([say('Feltöltve: main 3f2a9c1.')], 'end_turn');
    return out;
  }

  return { create: create, demo: demo, CATS: CATS, catOf: catOf, label: label, cmdKind: cmdKind, workflowMeta: workflowMeta };
})();
if (typeof module !== 'undefined') module.exports = SCModel;
