/* Fabric Migration Assessment Accelerator — intake views: start, global sections, source systems. */
(function () {
  'use strict';
  const APP = window.FMA_APP; const KB = window.FMA_KB; const E = window.FMA_ENGINE; const H = APP.H; const esc = H.esc; const U = E.util;

  const SEC_TEXT = {
    org: ['Organization & goals', 'Who the client is and why they are moving. Organization size anchors every benchmark estimate, so answer it first.'],
    etl: ['Integration & ETL', 'How data moves today. Job counts, tools and freshness drive pipeline effort and capacity sizing.'],
    bi: ['BI & consumption', 'How data is used. Reports, semantic models and users drive BI effort and Power BI licensing.'],
    sec: ['Security & compliance', 'Controls the target must meet. These shape the landing zone, governance effort and risks.'],
    ops: ['Operations & team', 'How the platform will be run and who will build it.'],
    tgt: ['Target preferences', 'Leave these on "Let the accelerator recommend" unless the client has already decided; recommendations are approved in Validate.']
  };

  function pageHead(eyebrow, title, text, right) {
    return '<div class="page-h"><div><div class="eyebrow">' + esc(eyebrow) + '</div><h1>' + esc(title) + '</h1>' + (text ? '<p>' + text + '</p>' : '') + '</div>' + (right || '') + '</div>';
  }
  APP.pageHead = pageHead;

  function confBadge(cf) {
    return '<div style="min-width:200px"><div class="row" style="justify-content:space-between;font-size:12px;color:var(--ink-2)"><span>Answer confidence</span><b class="num">' + H.pct(cf) + '</b></div><div class="bar" style="margin-top:4px"><i style="width:' + Math.round(cf * 100) + '%"></i></div></div>';
  }
  APP.confBadge = confBadge;

  function sectionView(sec) {
    const [title, text] = SEC_TEXT[sec];
    const fields = KB.GLOBAL_FIELDS.filter((f) => f.sec === sec);
    const open = fields.filter((f) => { const a = APP.S.g[f.id]; return !(a && (a.ns || U.has(a.v))); }).length;
    const right = '<div class="stack" style="gap:8px;align-items:flex-end">' + confBadge(APP.sectionConf(sec)) +
      (open ? '<button class="btn sm" data-act="bulkNs" data-sec="' + sec + '">Mark ' + open + ' unanswered as Not sure</button>' : '') + '</div>';
    const next = { org: 'systems', etl: 'bi', bi: 'sec', sec: 'ops', ops: 'tgt', tgt: 'discovery' }[sec];
    const nextLbl = { systems: 'Source systems', bi: 'BI & consumption', sec: 'Security & compliance', ops: 'Operations & team', tgt: 'Target preferences', discovery: 'Discovery scripts' }[next];
    return pageHead('Capture', title, esc(text), right) +
      '<div class="qgrid">' + fields.map((f) => APP.renderField(f, 'g')).join('') + '</div>' +
      '<div class="row" style="margin-top:18px;justify-content:flex-end"><button class="btn primary" data-go="' + next + '">Next: ' + esc(nextLbl) + '</button></div>';
  }
  ['org', 'etl', 'bi', 'sec', 'ops', 'tgt'].forEach((s) => { APP.views[s] = () => sectionView(s); });

  APP.act.bulkNs = (el) => {
    const sec = el.dataset.sec;
    APP.commit((S) => {
      if (sec === 'sys') { const sys = H.sysById(APP.sel); if (!sys) return; E.fieldsForSystem(sys).forEach((f) => { const a = sys.a[f.id]; if (!(a && (a.ns || U.has(a.v)))) sys.a[f.id] = { ns: true, ts: Date.now() }; }); }
      else KB.GLOBAL_FIELDS.filter((f) => f.sec === sec).forEach((f) => { const a = S.g[f.id]; if (!(a && (a.ns || U.has(a.v)))) S.g[f.id] = { ns: true, ts: Date.now() }; });
    });
    APP.toast('Benchmark estimates now fill the unanswered questions. They are listed for review in Validate.');
  };

  /* ---------- Start ---------- */
  APP.views.start = () => {
    const R = APP.R; const c = R.comp;
    const legend = ['user', 'disc', 'ai', 'derived', 'default', 'val'].map((s) => APP.srcChip(s)).join(' ');
    const saved = APP.caps.db && APP.caps.uid;
    return '<div class="page-h"><div><div class="eyebrow">Microsoft Fabric migration</div><h1>Assessment accelerator</h1>' +
      '<p>Assess a move to Microsoft Fabric from any analytics platform: SQL Server, Oracle, Teradata, Db2, SAP, Snowflake, Databricks, Redshift, BigQuery, PostgreSQL, MySQL, Hadoop and more. Answer what you know and mark the rest <i>Not sure</i>. Then run the read-only discovery scripts, and the accelerator completes the assessment. A person reviews the 20–30% that needs judgement and signs it off.</p></div></div>' +
      '<div class="grid2" style="grid-template-columns:minmax(0,1.25fr) minmax(0,1fr)">' +
      '<div class="card"><div class="card-h"><div><h3>' + esc(APP.S.name || 'Untitled assessment') + '</h3><p class="sub">' + APP.S.systems.length + ' source ' + H.plural(APP.S.systems.length, 'system') + ' · updated ' + H.date(APP.S.updated) + '</p></div>' + APP.ring(c.agentic, Math.max(0, c.validated), 76) + '</div>' +
      '<div class="grid3" style="gap:10px">' +
      '<div><div class="small muted">Done by the accelerator</div><div class="num" style="font-family:var(--font-display);font-size:22px;font-weight:750">' + H.pct(c.agentic) + '</div></div>' +
      '<div><div class="small muted">Validated by people</div><div class="num" style="font-family:var(--font-display);font-size:22px;font-weight:750">' + H.pct(Math.max(0, c.validated)) + '</div></div>' +
      '<div><div class="small muted">Human validation left</div><div class="num" style="font-family:var(--font-display);font-size:22px;font-weight:750">' + H.fnum(c.remainingDays, 0) + ' d</div></div></div>' +
      '<p class="sub" style="margin-top:10px">A manual assessment of this scope takes about <b>' + H.fnum(c.baseline, 0) + ' person-days</b>. ' +
      'The accelerator has done ' + H.pct(c.agentic) + ' of that work; about ' + H.fnum(c.remainingDays, 0) + ' person-days of review remain.</p>' +
      '<div class="row" style="margin-top:12px"><button class="btn primary" data-go="summary">Open the executive summary</button><button class="btn" data-go="validate">Review what needs a human</button></div></div>' +
      '<div class="card"><h3>Start or open an assessment</h3><div class="stack" style="gap:8px;margin-top:10px">' +
      '<button class="btn primary" data-act="newAssessment" style="justify-content:flex-start">Start a new assessment</button>' +
      '<button class="btn" data-act="loadDemo" style="justify-content:flex-start">Load the demo (fictional retailer, five platforms)</button>' +
      '<label class="btn" style="justify-content:flex-start;cursor:pointer">Open an assessment file (.json)<input type="file" accept=".json,application/json" data-ch="importJson" hidden></label>' +
      (saved ? '<button class="btn" data-go="export" style="justify-content:flex-start">My saved assessments</button>' : '') +
      '</div><p class="small muted" style="margin-top:10px">' + (saved ? 'Assessments save to your Claude account automatically and stay private to you.' : 'Work is kept in this browser. Export the assessment file to keep or share it.') + '</p></div></div>' +
      '<h2 style="margin:24px 0 10px">How it works</h2><div class="steps">' +
      '<div class="step"><div class="n">1 · CAPTURE</div><h3>Answer, or say Not sure</h3><p>Every question accepts <i>Not sure</i>. Benchmark estimates fill the gaps, and every value shows where it came from.</p><div class="row" style="margin-top:10px"><button class="btn sm" data-go="org">Organization & goals</button><button class="btn sm" data-go="systems">Source systems</button></div></div>' +
      '<div class="step"><div class="n">2 · AUTOMATE</div><h3>Let the scripts and the agent do the counting</h3><p>Read-only discovery scripts measure each platform in minutes. The AI agent reads RFPs, inventories and code samples and proposes answers with evidence.</p><div class="row" style="margin-top:10px"><button class="btn sm" data-go="discovery">Discovery scripts</button><button class="btn sm" data-go="agent">AI agent</button></div></div>' +
      '<div class="step"><div class="n">3 · VALIDATE</div><h3>People confirm what needs judgement</h3><p>The engine drafts complexity, patterns, architecture, F-SKU, cost, effort, roadmap and risks. A checklist shows exactly what a person must confirm before sign-off.</p><div class="row" style="margin-top:10px"><button class="btn sm" data-go="validate">Validation & sign-off</button></div></div></div>' +
      '<div class="card" style="margin-top:16px"><h3>Where each value comes from</h3><p class="sub" style="margin:4px 0 10px">The completion score weights each answer by its source. Discovered and provided answers count fully; estimates count partly until a reviewer confirms them.</p><div class="chips">' + legend + '</div></div>';
  };

  APP.act.newAssessment = async () => {
    const v = await APP.modal('Start a new assessment', '<div class="stack" style="gap:10px"><label class="field"><span class="small">Client or organization</span><input class="inp" data-mf="client" placeholder="e.g. Contoso"></label><label class="field"><span class="small">Assessment name</span><input class="inp" data-mf="name" placeholder="Fabric migration assessment"></label><p class="small muted">The current assessment stays in your exports' + (APP.caps.db && APP.caps.uid ? ' and saved list' : '') + '. Export it first if you need it.</p></div>',
      [{ label: 'Cancel', value: null }, { label: 'Create', primary: true, value: 'form' }]);
    if (!v) return;
    const st = E.newState();
    st.name = (v.name || '').trim() || ((v.client || '').trim() ? v.client.trim() + ' · Fabric migration assessment' : 'Fabric migration assessment');
    if ((v.client || '').trim()) st.g.org_name = { v: v.client.trim(), src: 'user' };
    APP.load(st, 'org');
    APP.toast('New assessment created. Start with the organization, then add source systems.');
  };
  APP.act.loadDemo = async () => {
    if (!APP.S._demo && APP.S.systems.length && !(await APP.confirm('Load the demo?', 'This replaces the assessment open now. Export it first if you need it.', 'Load the demo'))) return;
    const st = window.FMA_DEMO.build(E); st._demo = true; APP.load(st, 'summary');
  };
  APP.act.importJson = (el) => {
    const f = el.files && el.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try { const st = JSON.parse(rd.result); if (!st || !Array.isArray(st.systems)) throw new Error('not an assessment file'); delete st._demo; APP.load(st, 'summary'); APP.toast('Opened ' + f.name); }
      catch (e) { APP.toast('That file is not an assessment file exported by this accelerator.'); }
    };
    rd.readAsText(f);
  };

  /* ---------- Source systems ---------- */
  const PLAT_GROUPS = [
    ['Microsoft', ['mssql', 'azure_sql', 'synapse']], ['Cloud data platforms', ['snowflake', 'databricks', 'redshift', 'bigquery']],
    ['Oracle', ['oracle']], ['Teradata', ['teradata']], ['IBM', ['db2luw', 'db2zos', 'db2i', 'netezza']],
    ['SAP', ['sap_ecc', 'sap_s4', 'sap_bw', 'sap_bw4', 'sap_hana', 'sap_ase', 'sap_iq']],
    ['Open source', ['postgres', 'mysql', 'greenplum', 'clickhouse']], ['Analytic databases', ['vertica', 'exasol']],
    ['Data lakes', ['hive']], ['Anything else', ['other']]
  ];
  const SEC_TITLES = { sys: 'Profile & scope', inventory: 'Inventory & size', code: 'Code & proprietary features', workload: 'Workload', etl: 'Integration', bi: 'Consumption' };

  function sysConf(sys) { const items = APP.R.items.filter((it) => it.scope === sys.id); const W = U.sum(items.map((x) => x.w)); return W ? U.sum(items.map((x) => x.w * x.r.cc)) / W : 0; }
  APP.sysConf = sysConf;

  APP.views.systems = () => {
    const S = APP.S; const R = APP.R;
    if (!APP.sel || !H.sysById(APP.sel)) APP.sel = S.systems[0] ? S.systems[0].id : null;
    const addGrid = '<div class="plat-grid">' + PLAT_GROUPS.map(([g, ps]) => ps.map((p) => '<button class="plat" data-act="addSystem" data-p="' + p + '"><b>' + esc(KB.PLATFORMS[p].label) + '</b><span>' + esc(g) + (KB.PLATFORMS[p].script ? ' · discovery script' : ' · manual intake') + '</span></button>').join('')).join('') + '</div>';
    let h = APP.pageHead('Capture', 'Source systems', 'Add every platform in scope. Each system gets its own questions; the discovery script for its platform answers most of them.', '');
    h += '<div class="card" style="margin-bottom:16px"><div class="card-h"><div><h3>Add a source system</h3><p class="sub">Pick the platform. You can add several of the same kind (for example two Oracle databases).</p></div></div>' + addGrid + '</div>';
    if (!S.systems.length) return h + '<div class="callout">No systems yet. Add the first platform above.</div>';
    h += '<div class="sys-tabs" role="tablist">' + S.systems.map((s) => {
      const x = R.systems.find((y) => y.sys.id === s.id); const cf = sysConf(s);
      return '<button class="sys-tab" role="tab" aria-pressed="' + (s.id === APP.sel) + '" data-act="selSystem" data-id="' + s.id + '"><b>' + esc(x ? x.name : s.platform) + '</b><span>' + esc(E.plat(s).short) + ' · ' + H.fnum(x ? x.f.tb : 0) + ' TB · ' + (s.disc ? 'discovery imported' : 'no discovery yet') + '</span><div class="bar" data-tip="Answer confidence ' + H.pct(cf) + '"><i style="width:' + Math.round(cf * 100) + '%"></i></div></button>';
    }).join('') + '</div>';
    const sys = H.sysById(APP.sel); const x = R.systems.find((y) => y.sys.id === sys.id); const p = E.plat(sys);
    const fields = E.fieldsForSystem(sys).filter((f) => f.id !== 's_name');
    const groups = {}; fields.forEach((f) => { (groups[f.sec] = groups[f.sec] || []).push(f); });
    const open = fields.filter((f) => { const a = sys.a[f.id]; return !(a && (a.ns || U.has(a.v))); }).length;
    h += '<div class="card" style="margin-top:14px"><div class="card-h"><div style="flex:1;min-width:240px"><div class="eyebrow">' + esc(p.label) + '</div>' +
      '<div class="row" style="gap:8px"><input class="inp" style="max-width:360px;font-weight:600" id="sysname-' + sys.id + '" data-ch="renameSystem" data-id="' + sys.id + '" value="' + esc(x.name) + '" aria-label="System name">' +
      '<span class="pill ' + H.tierClass(x.cx.tier) + '">' + esc(x.cx.tier) + ' · ' + x.cx.score + '</span></div></div>' +
      '<div class="row">' + confBadge(sysConf(sys)) + '</div></div>' +
      '<div class="row" style="margin-bottom:14px">' +
      (p.script ? '<button class="btn primary sm" data-go="discovery" data-sel="' + sys.id + '">' + (sys.disc ? 'Re-import discovery' : 'Run the discovery script') + '</button>' : '<span class="small muted">No discovery script for this platform: answer manually or use the AI agent.</span>') +
      ((p.fam === 'db' || p.fam === 'hana') ? '<button class="btn sm" data-go="agent" data-sel="' + sys.id + '">Analyze code with AI</button>' : '') +
      (open ? '<button class="btn sm" data-act="bulkNs" data-sec="sys">Mark ' + open + ' unanswered as Not sure</button>' : '') +
      '<button class="btn sm danger" data-act="removeSystem" data-id="' + sys.id + '" style="margin-left:auto">Remove system</button></div>';
    if (sys.disc) {
      const d = sys.disc;
      h += '<div class="callout" style="margin-bottom:14px"><b>Discovery imported</b> from ' + esc(d.file || 'pasted output') + ' on ' + H.date(d.at) + ' · ' + H.fmt(d.rows || 0) + ' rows' +
        (d.errors && d.errors.length ? ' · ' + d.errors.length + ' statement(s) reported errors (usually version-specific views)' : '') +
        (d.notes && d.notes.length ? '<ul class="clean small" style="margin-top:6px">' + d.notes.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul>' : '') + '</div>';
    }
    ['sys', 'inventory', 'code', 'workload', 'etl', 'bi'].forEach((sec) => {
      if (!groups[sec]) return;
      h += '<div class="sec-h"><h3>' + esc(SEC_TITLES[sec]) + '</h3></div><div class="qgrid">' + groups[sec].map((f) => APP.renderField(f, sys.id)).join('') + '</div>';
    });
    if (sys.disc && sys.disc.tops && sys.disc.tops.length) {
      h += '<div class="sec-h"><h3>Largest tables (from discovery)</h3></div><div class="tblwrap"><table class="tbl"><thead><tr><th>Table</th><th class="n">Size (GB)</th><th class="n">Rows</th></tr></thead><tbody>' +
        sys.disc.tops.slice(0, 12).map((t) => '<tr><td class="mono">' + esc(t.name) + '</td><td class="n">' + H.fnum(t.gb, 1) + '</td><td class="n">' + (t.rows ? H.fmt(t.rows) : '—') + '</td></tr>').join('') + '</tbody></table></div>';
    }
    h += '</div>';
    return h;
  };

  APP.act.addSystem = (el) => {
    const p = el.dataset.p; const n = APP.S.systems.filter((s) => s.platform === p).length;
    const sys = E.newSystem(p, KB.PLATFORMS[p].short + (n ? ' ' + (n + 1) : ''));
    APP.sel = sys.id;
    APP.commit((S) => { S.systems.push(sys); });
    APP.toast(KB.PLATFORMS[p].label + ' added. Answer what you know, or run its discovery script.');
  };
  APP.act.selSystem = (el) => { APP.sel = el.dataset.id; APP.render(); };
  APP.act.removeSystem = async (el) => {
    const sys = H.sysById(el.dataset.id); if (!sys) return;
    const nm = (sys.a.s_name && sys.a.s_name.v) || E.plat(sys).short;
    if (!(await APP.confirm('Remove ' + nm + '?', 'Its answers and imported discovery output will be deleted from this assessment.', 'Remove'))) return;
    APP.commit((S) => { S.systems = S.systems.filter((s) => s.id !== sys.id); Object.keys(S.validations).forEach((k) => { if (k.indexOf(sys.id) >= 0) delete S.validations[k]; }); });
    APP.sel = APP.S.systems[0] ? APP.S.systems[0].id : null; APP.render();
  };
  APP.act.renameSystem = (el) => { const sys = H.sysById(el.dataset.id); const v = el.value.trim(); if (!sys || !v) return; APP.commit(() => { sys.a.s_name = { v, src: 'user', ts: Date.now() }; }); };
})();
