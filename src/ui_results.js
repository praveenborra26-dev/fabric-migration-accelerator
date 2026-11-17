/* Fabric Migration Assessment Accelerator — results views and SVG charts. */
(function () {
  'use strict';
  const APP = window.FMA_APP; const KB = window.FMA_KB; const E = window.FMA_ENGINE; const H = APP.H; const esc = H.esc; const U = E.util;

  /* ---------- chart helpers ---------- */
  const C = { s1: 'var(--s1)', s2: 'var(--s2)', s3: 'var(--s3)', s4: 'var(--s4)', s5: 'var(--s5)', s6: 'var(--s6)', s7: 'var(--s7)', s8: 'var(--s8)' };
  function barPath(x, y, w, h, r) { if (w <= 0.5) return ''; r = Math.min(r, w, h / 2); return 'M' + x + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h - r) + 'Q' + (x + w) + ',' + (y + h) + ' ' + (x + w - r) + ',' + (y + h) + 'H' + x + 'Z'; }
  function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
  /* horizontal bars: rows [{label, value, tip, color}] */
  function hbars(rows, o) {
    o = Object.assign({ w: 760, labelW: 250, barH: 14, gap: 12, fmt: (v) => H.fnum(v, 0), unit: '', color: C.s1 }, o || {});
    const max = niceMax(Math.max(...rows.map((r) => r.value), 0.0001));
    const plotW = o.w - o.labelW - 70; const top = 8; const rowH = o.barH + o.gap; const hgt = top + rows.length * rowH + 22;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
    let s = '<svg viewBox="0 0 ' + o.w + ' ' + hgt + '" width="' + o.w + '" role="img" aria-label="' + esc(o.aria || 'Bar chart') + '">';
    s += '<g class="grid">' + ticks.map((t) => { const x = o.labelW + plotW * t / max; return '<line x1="' + x + '" x2="' + x + '" y1="' + (top - 4) + '" y2="' + (hgt - 18) + '"/>'; }).join('') + '</g>';
    ticks.forEach((t) => { const x = o.labelW + plotW * t / max; s += '<text x="' + x + '" y="' + (hgt - 4) + '" text-anchor="middle" class="t-muted">' + esc(o.fmt(t)) + '</text>'; });
    rows.forEach((r, i) => {
      const y = top + i * rowH; const w = plotW * r.value / max;
      s += '<text x="' + (o.labelW - 10) + '" y="' + (y + o.barH - 3) + '" text-anchor="end">' + esc(r.label.length > 38 ? r.label.slice(0, 37) + '…' : r.label) + '</text>';
      s += '<g data-tip="' + esc(r.tip || (r.label + ': ' + o.fmt(r.value) + (o.unit ? ' ' + o.unit : ''))) + '"><rect x="' + o.labelW + '" y="' + (y - 4) + '" width="' + (plotW + 60) + '" height="' + (o.barH + 8) + '" fill="transparent"/>' +
        '<path d="' + barPath(o.labelW, y, Math.max(w, 1.5), o.barH, 4) + '" fill="' + (r.color || o.color) + '"/></g>';
      s += '<text x="' + (o.labelW + Math.max(w, 1.5) + 6) + '" y="' + (y + o.barH - 3) + '" class="t-strong">' + esc(o.fmt(r.value)) + '</text>';
    });
    return '<div class="chart">' + s + '</svg></div>';
  }
  APP.hbars = hbars; APP.barPath = barPath;

  function kpi(k, v, d, tip) { return '<div class="kpi"' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '><div class="k">' + esc(k) + '</div><div class="v">' + v + '</div>' + (d ? '<div class="d">' + d + '</div>' : '') + '</div>'; }
  APP.kpi = kpi;
  const stratLabel = { lift: 'Lift & shift first', replatform: 'Replatform & modernize', modernize: 'Full modernization' };
  APP.stratLabel = stratLabel;

  function waveOf(sysId) { const rows = APP.R.plan.rows.filter((r) => r.sys === sysId); if (!rows.length) return '—'; return rows.map((r) => r.k === 'pilot' ? 'Pilot' : r.label.split(' · ')[0]).join(', '); }

  /* ============ Executive summary ============ */
  APP.views.summary = () => {
    const R = APP.R; const S = APP.S; const c = R.comp; const cap = R.cap;
    if (!R.systems.length) return APP.pageHead('Results', 'Executive summary', '', '') + '<div class="callout">Add source systems to generate the assessment.</div><div class="row" style="margin-top:12px"><button class="btn primary" data-go="systems">Add source systems</button></div>';
    let h = APP.pageHead('Results', 'Executive summary', 'Generated from ' + R.items.length + ' answers across ' + R.systems.length + ' ' + H.plural(R.systems.length, 'system') + '. Every figure shows its drivers on the detail pages and can be changed in Rates & assumptions.',
      '<div class="row"><button class="btn" data-act="exportReport">Download report (.html)</button><button class="btn primary" data-go="validate">Validate & sign off</button></div>');
    h += '<div class="kpis">' +
      kpi('Migration complexity', esc(R.overall.tier), R.overall.score + ' / 100 across ' + R.systems.length + ' ' + H.plural(R.systems.length, 'system')) +
      kpi('Strategy', esc(stratLabel[R.strategy.key]), esc(R.strategy.why)) +
      kpi('Fabric capacity', 'F' + cap.sku.cu, (cap.np ? 'F' + cap.np.cu + ' for dev / test · ' : '') + H.fnum(cap.required, 0) + ' CU needed') +
      kpi('Run cost', H.money(cap.cost.monthly), 'per month · ' + H.money(cap.cost.threeYear) + ' over 3 years') +
      kpi('Delivery effort', H.fmt(R.eff.total) + ' d', 'range ' + H.fmt(R.eff.low) + '–' + H.fmt(R.eff.high) + ' · ' + H.money(R.eff.cost)) +
      kpi('Timeline', H.fnum(R.plan.months, 0) + ' months', 'team of about ' + R.plan.fte + ' · pilot: ' + esc(R.plan.pilot || '—')) + '</div>';
    const nr = S.ai && S.ai.narrative;
    h += '<div class="grid2" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);margin-top:16px">' +
      '<div class="card"><h3>Assessment summary</h3><div class="stack" style="gap:10px;margin-top:10px;max-width:72ch">' + R.summary.map((p) => '<p>' + esc(p) + '</p>').join('') + '</div>' +
      (nr ? '<hr class="hr"><h4>AI-written narrative</h4><div class="ai-out" style="margin-top:8px">' + esc(nr.text) + '</div>' : '<p class="small muted" style="margin-top:12px">Want a polished narrative and client questions? <button class="linkbtn" data-go="agent">Generate them with the AI agent</button>.</p>') + '</div>' +
      '<div class="card"><div class="card-h"><div><h3>Assessment completion</h3><p class="sub">' + H.pct(c.agentic) + ' done by the accelerator, ' + H.pct(Math.max(0, c.validated)) + ' validated by people</p></div>' + APP.ring(c.agentic, Math.max(0, c.validated), 64) + '</div>' +
      '<p class="small">A manual assessment of this scope takes about <b>' + H.fnum(c.baseline, 0) + ' person-days</b>. About <b>' + H.fnum(c.remainingDays, 0) + ' person-days</b> of human validation remain.</p>' +
      '<h4 style="margin:12px 0 6px">Next best actions</h4><ol class="clean" style="padding-left:18px">' + R.nba.map((a) => '<li><a class="linkbtn" href="#' + a.view + '" style="font-weight:500;font-size:13px;text-decoration:none" data-go="' + a.view + '"' + (a.sys ? ' data-sel="' + a.sys + '"' : '') + '>' + esc(a.title) + '</a> <span class="small muted">+' + H.fnum(a.gain * 100, 1) + ' pts</span></li>').join('') + '</ol></div></div>';
    h += '<div class="sec-h" style="margin-top:20px"><h2>Systems in scope</h2><button class="btn ghost" data-go="estate">Detail per system</button></div>' +
      '<div class="tblwrap"><table class="tbl"><thead><tr><th>System</th><th>Platform</th><th class="n">Data (TB)</th><th>Complexity</th><th>Migration pattern</th><th>Target</th><th>Plan</th></tr></thead><tbody>' +
      R.systems.map((x) => '<tr><td><b>' + esc(x.name) + '</b>' + (x.sys.disc ? ' <span class="chip src-disc" data-tip="Discovery imported"><i></i>Discovered</span>' : '') + '</td><td>' + esc(x.f.p.short) + '</td><td class="n">' + H.fnum(x.f.tb, 1) + '</td><td><span class="pill ' + H.tierClass(x.cx.tier) + '">' + esc(x.cx.tier) + ' · ' + x.cx.score + '</span></td><td>' + esc(x.pattern.name) + '</td><td class="small">' + esc(x.pattern.target) + '</td><td class="small">' + esc(waveOf(x.sys.id)) + '</td></tr>').join('') + '</tbody></table></div>';
    h += '<div class="grid2" style="margin-top:16px"><div class="card"><div class="card-h"><h3>Top risks</h3><button class="btn ghost sm" data-go="risks">All ' + R.risks.length + ' risks</button></div>' +
      R.risks.slice(0, 5).map((r) => '<div class="vitem" style="grid-template-columns:auto minmax(0,1fr)"><span class="pill ' + H.sevClass(r.sev) + '">' + r.sev + '</span><div><div class="t">' + esc(r.title) + '</div><div class="d">' + esc(r.mitigation) + '</div></div></div>').join('') + '</div>' +
      '<div class="card"><h3>Business case</h3>' + (R.roi ? roiBlock(R.roi) : '<p class="sub" style="margin-top:6px">Add the annual run cost of the legacy estate under Organization & goals to compare it with Fabric.</p><div class="row" style="margin-top:10px"><button class="btn sm" data-go="org">Add legacy run cost</button></div>') +
      '<hr class="hr"><h4>Where the effort goes</h4>' + hbars(R.eff.ws.filter((w) => w.days > 0.5).sort((a, b) => b.days - a.days).slice(0, 6).map((w) => ({ label: w.label, value: w.days * (1 + R.eff.cont) })), { w: 560, labelW: 230, fmt: (v) => H.fmt(v), unit: 'person-days', aria: 'Top workstreams by effort' }) + '</div></div>';
    return h;
  };
  function roiBlock(roi) {
    return '<table class="tbl" style="margin-top:8px"><tbody>' +
      '<tr><td>Legacy run cost</td><td class="n">' + H.money(roi.legacy) + ' / yr</td></tr>' +
      '<tr><td>Fabric run cost (year 1)</td><td class="n">' + H.money(roi.fabricYear) + ' / yr</td></tr>' +
      '<tr><td>Annual saving once migrated</td><td class="n"><b>' + H.money(roi.savings) + '</b></td></tr>' +
      '<tr><td>Payback on delivery cost</td><td class="n">' + (roi.paybackMonths ? H.fnum(roi.paybackMonths, 0) + ' months' : 'no payback at current figures') + '</td></tr>' +
      '<tr><td>3-year net after delivery</td><td class="n">' + H.money(roi.threeYearNet) + '</td></tr></tbody></table><p class="small muted" style="margin-top:6px">Excludes dual running during the parallel run, partner licences and decommissioning credits.</p>';
  }

  /* ============ Estate & complexity ============ */
  APP.views.estate = () => {
    const R = APP.R;
    let h = APP.pageHead('Results', 'Estate & complexity', 'Complexity scores combine eight weighted factors. Patterns follow the platform, role, scope, freshness needs and target preferences.', '');
    if (!R.systems.length) return h + '<div class="callout">No systems yet.</div>';
    R.systems.forEach((x) => {
      const f = x.f; const P = x.pattern;
      const facts = [['Data', H.fnum(f.tb, 1) + ' TB'], ['Largest table', H.fnum(f.largestGb, 0) + ' GB']];
      if (f.fam === 'db' || f.fam === 'hana') facts.push(['Tables', H.fmt(f.tables)], ['Views', H.fmt(f.views)], ['Procedural objects', H.fmt(f.codeObjs)], ['Lines of code', H.fmt(f.loc)]);
      if (f.fam === 'sap_erp') facts.push(['Tables in scope', H.fmt(f.sapTables)], ['Extractors', H.fmt(f.extractors)], ['Custom objects', H.fmt(f.custom)], ['Modules', (f.modules || []).join(', ').toUpperCase()]);
      if (f.fam === 'sap_bw') facts.push(['InfoProviders', H.fmt(f.providers)], ['Queries', H.fmt(f.bwQueries)], ['Process chains', H.fmt(f.chains)], ['Transformations', H.fmt(f.transforms)]);
      facts.push(['Queries / day', H.fmt(f.queries)], ['Users', H.fmt(f.users)]);
      h += '<div class="card" style="margin-bottom:16px"><div class="card-h"><div><div class="eyebrow">' + esc(f.p.label) + ' · ' + esc(APP.displayVal(E.SF.s_role, f.role)) + ' · ' + esc(APP.displayVal(E.SF.s_scope, f.scope)) + '</div><h2>' + esc(x.name) + '</h2></div>' +
        '<div class="row"><span class="pill ' + H.tierClass(x.cx.tier) + '">' + esc(x.cx.tier) + ' complexity · ' + x.cx.score + '</span><button class="btn sm" data-go="systems" data-sel="' + x.sys.id + '">Edit answers</button></div></div>' +
        '<div class="grid4" style="margin-bottom:14px">' + facts.map(([k, v]) => '<div><div class="small muted">' + esc(k) + '</div><div class="num" style="font-weight:600">' + esc(v) + '</div></div>').join('') + '</div>' +
        '<div class="grid2"><div><h4 style="margin-bottom:8px">What drives the score</h4>' +
        hbars(x.cx.parts.map((p) => ({ label: p.label, value: p.pts, tip: p.label + ': ' + H.fnum(p.pts, 1) + ' of ' + H.fnum(p.max, 0) + ' points' })), { w: 520, labelW: 160, barH: 11, gap: 9, fmt: (v) => H.fnum(v, 0), aria: 'Complexity factors for ' + x.name }) + '</div>' +
        '<div><h4 style="margin-bottom:8px">Migration pattern</h4><p><b>' + esc(P.name) + '</b></p><p class="small" style="margin:4px 0 8px">Target: ' + esc(P.target) + '</p>' +
        '<ul class="clean small">' + P.ingest.map((t) => '<li>' + esc(t) + '</li>').join('') + (P.code ? '<li>' + esc(P.code) + '</li>' : '') + P.notes.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul>' +
        (P.prereqs.length ? '<div class="callout warn" style="margin-top:8px">' + P.prereqs.map(esc).join('<br>') + '</div>' : '') +
        '<div class="chips" style="margin-top:8px">' + P.tools.map((t) => '<span class="chip">' + esc(t) + '</span>').join('') + '</div></div></div>' +
        '<h4 style="margin:14px 0 8px">Fabric compatibility · ' + x.gaps.length + ' ' + H.plural(x.gaps.length, 'feature') + ' reviewed</h4>' +
        (x.gaps.length ? '<div class="tblwrap"><table class="tbl"><thead><tr><th>Feature in use</th><th>Gap</th><th>Approach in Fabric</th></tr></thead><tbody>' + x.gaps.map((g) => '<tr><td>' + esc(g.label) + '</td><td><span class="pill ' + H.gapClass(g.gap) + '">' + esc(H.gapLabel(g.gap)) + '</span></td><td class="small">' + esc(g.fabric) + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="sub">No proprietary features recorded.</p>') + '</div>';
    });
    return h;
  };

  /* ============ Target architecture ============ */
  function archSvg(R) {
    const A = R.arch; const sys = R.systems;
    const W = 1180; const srcH = 50; const gapY = 10; const y0 = 34;
    const ingestKeys = []; sys.forEach((x) => x.pattern.items.forEach((i) => { if (ingestKeys.indexOf(i) < 0) ingestKeys.push(i); }));
    if (A.rt) ingestKeys.push('Eventstream (real-time)');
    // columns: x position and width
    const X = { src: 16, ing: 254, lake: 512, serve: 794, cons: 1000 }; const SW = 212; const IW = 232; const LW = 254; const VW = 182; const CW = 164;
    const box = (x, y, w, h, title, sub, strong, accent) => '<g><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="7" fill="' + (strong ? 'var(--accent-soft)' : 'var(--surface)') + '" stroke="' + (accent || 'var(--line-strong)') + '" stroke-width="' + (accent ? 1.6 : 1) + '"/>' +
      '<text x="' + (x + 10) + '" y="' + (y + 20) + '" class="t-strong" style="font-size:12px">' + esc(title) + '</text>' + (sub ? '<text x="' + (x + 10) + '" y="' + (y + 36) + '" style="font-size:10.5px">' + esc(sub.length > 40 ? sub.slice(0, 39) + '…' : sub) + '</text>' : '') + '</g>';
    const head = (x, t) => '<text x="' + x + '" y="20" class="t-muted" style="font-size:11px;letter-spacing:.06em">' + esc(t.toUpperCase()) + '</text>';
    const arrow = (x1, y1, x2, y2) => '<path d="M' + x1 + ',' + y1 + ' C' + ((x1 + x2) / 2) + ',' + y1 + ' ' + ((x1 + x2) / 2) + ',' + y2 + ' ' + x2 + ',' + y2 + '" fill="none" stroke="var(--muted)" stroke-width="1.2" marker-end="url(#ah)"/>';
    const lh = 54; const lgap = 24; const lakeY = y0; const lakeH = 16 + 3 * lh + 2 * lgap + 16; const lw = LW - 30;
    const serves = [['Semantic models', 'Direct Lake, shared measures'], ['SQL analytics endpoint', 'Ad-hoc T-SQL']];
    if (A.rt) serves.push(['Eventhouse', 'Real-time KQL']);
    const cons = [['Power BI apps', 'Reports & dashboards'], ['Paginated reports', 'Operational reporting'], ['Excel', 'Connected to models']];
    if (A.ai) cons.push(['Copilot & data agents', 'Natural-language Q&A']);
    if (A.ds) cons.push(['Notebooks & ML', 'Data science']);
    const bottom = Math.max(y0 + Math.max(sys.length, ingestKeys.length, 1) * (srcH + gapY) - gapY, lakeY + lakeH, y0 + 10 + serves.length * 66 - 10, y0 + cons.length * 60 - 8);
    const gy = bottom + 26; const Hh = gy + 64;
    let s = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" width="' + W + '" role="img" aria-label="Target architecture diagram">' +
      '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--muted)"/></marker></defs>';
    s += head(X.src, 'Sources') + head(X.ing, 'Ingestion') + head(X.lake, 'OneLake · medallion') + head(X.serve, 'Serve') + head(X.cons, 'Consume');
    const srcY = {}; sys.forEach((x, i) => { const y = y0 + i * (srcH + gapY); srcY[x.sys.id] = y + srcH / 2; s += box(X.src, y, SW, srcH, x.name, x.f.p.short + ' · ' + H.fnum(x.f.tb, 1) + ' TB'); });
    const ingY = {}; ingestKeys.forEach((k, i) => { const y = y0 + i * (srcH + gapY); ingY[k] = y + srcH / 2; const users = (A.ingest[k] || []).length; s += box(X.ing, y, IW, srcH, k, users ? users + ' ' + H.plural(users, 'system') : (k.indexOf('Event') === 0 ? 'Streaming sources' : '')); });
    sys.forEach((x) => { const tgt = x.pattern.items.filter((i) => i.indexOf('gateway') < 0)[0] || x.pattern.items[0]; if (tgt && ingY[tgt] != null) s += arrow(X.src + SW, srcY[x.sys.id], X.ing - 4, ingY[tgt]); });
    s += '<rect x="' + X.lake + '" y="' + lakeY + '" width="' + LW + '" height="' + lakeH + '" rx="10" fill="none" stroke="var(--accent)" stroke-dasharray="4 3"/>';
    const layers = [['Bronze · Lakehouse', 'Raw and mirrored data, shortcuts'], ['Silver · Lakehouse', 'Conformed, cleansed Delta tables'], ['Gold · ' + A.gold, A.gold === 'Warehouse' ? 'Dimensional models in T-SQL' : 'Dimensional models in Delta']];
    const lyY = layers.map((l, i) => lakeY + 16 + i * (lh + lgap));
    layers.forEach((l, i) => { s += box(X.lake + 15, lyY[i], lw, lh, l[0], l[1], i === 2); });
    ingestKeys.forEach((k) => { if (k.indexOf('gateway') >= 0) return; s += arrow(X.ing + IW, ingY[k], X.lake + 13, lyY[0] + lh / 2); });
    s += arrow(X.lake + 15 + lw / 2, lyY[0] + lh, X.lake + 15 + lw / 2, lyY[1] - 2) + arrow(X.lake + 15 + lw / 2, lyY[1] + lh, X.lake + 15 + lw / 2, lyY[2] - 2);
    serves.forEach((sv, i) => { const y = y0 + 10 + i * 66; s += box(X.serve, y, VW, 54, sv[0], sv[1]); s += arrow(X.lake + 15 + lw, lyY[2] + lh / 2, X.serve - 4, y + 27); });
    cons.forEach((cv, i) => { const y = y0 + i * 60; s += box(X.cons, y, CW, 52, cv[0], cv[1]); });
    s += arrow(X.serve + VW, y0 + 37, X.cons - 4, y0 + 26);
    s += '<rect x="16" y="' + gy + '" width="' + (W - 32) + '" height="56" rx="8" fill="var(--surface-2)" stroke="var(--line)"/>' +
      '<text x="30" y="' + (gy + 22) + '" class="t-strong" style="font-size:12px">Governance & operations</text>' +
      '<text x="30" y="' + (gy + 40) + '" style="font-size:11px">' + esc([A.purview ? 'Microsoft Purview catalog & lineage' : 'Purview (recommended)', 'OneLake security & RLS', A.domains.length + ' domains · ' + A.workspaces + ' workspaces', 'Git integration & deployment pipelines', 'Capacity Metrics & workspace monitoring', A.network === 'public' ? 'Entra ID conditional access' : 'Private links & outbound access protection'].join('   ·   ')) + '</text>';
    return '<div class="chart">' + s + '</svg></div>';
  }
  APP.archSvg = archSvg;

  APP.views.architecture = () => {
    const R = APP.R; const A = R.arch; const c = R.ctx;
    let h = APP.pageHead('Results', 'Target architecture', 'A medallion design on OneLake, derived from the migration patterns, freshness needs, skills and controls in this assessment.', '');
    if (!R.systems.length) return h + '<div class="callout">No systems yet.</div>';
    h += '<div class="card">' + archSvg(R) + '</div>';
    const why = [];
    why.push('Gold layer in ' + A.gold + (A.gold === 'Warehouse' ? ': most logic is SQL today and the team rates its SQL skills ' + (c.gv('ops_skill_sql') || 'high') + ', so T-SQL keeps conversion and skills risk low.' : ': transformation logic suits Spark and the team has Spark skills.'));
    why.push('Bronze and Silver in Lakehouse: mirrored databases and file landings arrive as Delta tables; shortcuts avoid copies where data already sits in OneLake or ADLS.');
    if (A.gateways) why.push('On-premises data gateways (clustered for high availability) connect the on-premises and appliance sources.');
    if (A.rt) why.push('Real-time freshness needs add Eventstream and Eventhouse alongside the batch medallion.');
    why.push('Semantic models in Direct Lake mode read Gold tables without import refreshes; F' + R.cap.sku.cu + ' allows about ' + H.fnum(R.cap.sku.dlRows / 1000, 1) + ' billion rows per table and ' + R.cap.sku.mem + ' GB per model.');
    if (A.ai) why.push('Copilot and data agents sit on the curated Gold models so answers use governed definitions.');
    const sec = [];
    sec.push('Identity: ' + APP.displayVal(E.GF.sec_identity, c.gv('sec_identity')) + '; Entra ID groups mapped to workspace roles and OneLake security roles.');
    const regs = (c.gv('sec_regs') || []).filter((x) => x !== 'none'); if (regs.length) sec.push('Regulations in scope: ' + APP.displayVal(E.GF.sec_regs, regs) + '.');
    sec.push('Row-level security: ' + APP.displayVal(E.GF.sec_rls, c.gv('sec_rls')) + ' (Warehouse RLS, OneLake security or semantic-model roles).');
    if (c.gv('sec_masking') === 'yes') sec.push('Dynamic data masking on sensitive columns in Warehouse; sensitivity labels through Purview.');
    sec.push('Network: ' + APP.displayVal(E.GF.sec_network, c.gv('sec_network')) + '.');
    if (c.gv('sec_cmk') === 'yes') sec.push('Customer-managed keys for workspace encryption.');
    if (c.gv('sec_residency') === 'yes') sec.push('Capacities pinned to the mandated region; cross-region Warehouse connections are not supported.');
    h += '<div class="grid2" style="margin-top:16px"><div class="card"><h3>Why this design</h3><ul class="clean" style="margin-top:8px">' + why.map((w) => '<li>' + esc(w) + '</li>').join('') + '</ul></div>' +
      '<div class="card"><h3>Security & governance controls</h3><ul class="clean" style="margin-top:8px">' + sec.map((w) => '<li>' + esc(w) + '</li>').join('') + '</ul></div></div>';
    h += '<div class="card" style="margin-top:16px"><div class="card-h"><div><h3>Workspace topology</h3><p class="sub">' + A.domains.length + ' business domains × data and reporting workspaces × ' + A.envNames.length + ' ' + H.plural(A.envNames.length, 'environment') + ', plus shared platform workspaces: about ' + A.workspaces + ' workspaces.</p></div></div>' +
      '<div class="tblwrap"><table class="tbl"><thead><tr><th>Domain</th><th>Workspaces</th><th>Items</th><th>Environments</th></tr></thead><tbody>' +
      '<tr><td><b>Platform (shared)</b></td><td>Ingestion · Shared dimensions</td><td>Mirrored databases, Bronze lakehouse, pipelines, conformed dimensions</td><td>' + A.envNames.join(' → ') + '</td></tr>' +
      A.domains.map((d) => '<tr><td><b>' + esc(d) + '</b></td><td>' + esc(d) + ' data · ' + esc(d) + ' reporting</td><td>Silver/Gold ' + (A.gold === 'Warehouse' ? 'warehouse' : 'lakehouse') + ', semantic models, reports</td><td>' + A.envNames.join(' → ') + '</td></tr>').join('') + '</tbody></table></div>' +
      '<p class="small muted" style="margin-top:8px">Promotion with Git integration and deployment pipelines (' + esc(APP.displayVal(E.GF.ops_devops, c.gv('ops_devops'))) + ' today).</p></div>';
    return h;
  };

  /* ============ Capacity & cost ============ */
  APP.views.capacity = () => {
    const R = APP.R; const cap = R.cap; const cost = cap.cost; const Rt = APP.S.rates;
    let h = APP.pageHead('Results', 'Capacity & cost', 'Capacity is sized from data change rate, pipeline runs, model refreshes, report concurrency and direct SQL workload, with 30% headroom. Treat it as the starting point for a pilot measured in the Fabric Capacity Metrics app.', '<button class="btn" data-go="rates">Change prices & rates</button>');
    h += '<div class="kpis">' + kpi('Capacity needed', H.fnum(cap.required, 0) + ' CU', H.fnum(cap.bgCU, 1) + ' background (24 h smoothed) + ' + H.fnum(cap.interCU, 1) + ' interactive, + 30%') +
      kpi('Production', 'F' + cap.sku.cu, (cap.computeSku.cu !== cap.sku.cu ? 'raised from F' + cap.computeSku.cu + ' for licensing · ' : '') + H.pct(cap.utilization) + ' of capacity used') +
      kpi('Dev / test', cap.np ? 'F' + cap.np.cu : 'None', cap.np ? 'pay-as-you-go, paused out of hours' : 'single environment') +
      kpi('Monthly run cost', H.money(cost.monthly), (cap.reserved ? 'production on 1-year reservation' : 'pay-as-you-go')) + '</div>';
    const skuRow = '<div class="chips" style="margin-top:4px">' + KB.SKUS.map((k) => { const on = k.cu === cap.sku.cu; const np = cap.np && k.cu === cap.np.cu; return '<span class="opt" style="' + (on ? 'background:var(--accent);color:var(--accent-ink);border-color:var(--accent)' : np ? 'border-color:var(--accent);border-style:dashed' : '') + '" data-tip="F' + k.cu + ': ' + k.cu + ' CU · ' + H.money(k.cu * Rt.cuYearReserved / 12) + '/month reserved · ' + H.money(k.cu * Rt.cuHourPayg * Rt.hoursPerMonth) + '/month PAYG · Direct Lake ' + H.fnum(k.dlRows / 1000, 1) + 'B rows/table · ' + k.mem + ' GB/model">F' + k.cu + '</span>'; }).join('') + '</div>';
    h += '<div class="grid2" style="margin-top:16px"><div class="card"><h3>Where the capacity goes</h3><p class="sub" style="margin-bottom:8px">Average CU by workload before headroom</p>' +
      hbars(cap.parts.filter((p) => p.cu > 0.01).map((p, i) => ({ label: p.k, value: p.cu, color: i < 5 ? C.s1 : C.s2 })), { w: 560, labelW: 190, fmt: (v) => H.fnum(v, v < 10 ? 1 : 0), unit: 'CU', aria: 'Capacity by workload' }) +
      '<div class="legend"><span><i style="background:var(--s1)"></i>Background (smoothed over 24 hours)</span><span><i style="background:var(--s2)"></i>Interactive (5-minute peaks)</span></div>' +
      '<hr class="hr"><h4>SKU ladder</h4>' + skuRow + '<p class="small muted" style="margin-top:6px">Solid: production. Dashed: dev / test. Hover a SKU for its price and guardrails.</p></div>' +
      '<div class="card"><h3>Monthly run cost</h3><div class="tblwrap" style="margin-top:8px"><table class="tbl"><thead><tr><th>Item</th><th class="n">Per month</th><th class="n">Per year</th></tr></thead><tbody>' +
      '<tr><td>Production F' + cap.sku.cu + (cap.reserved ? ' (1-year reservation)' : ' (pay-as-you-go)') + '<div class="lbl-sm">PAYG would be ' + H.money(cost.prodPayg) + ' / month</div></td><td class="n">' + H.money(cost.prodMonth) + '</td><td class="n">' + H.money(cost.prodMonth * 12) + '</td></tr>' +
      (cap.np ? '<tr><td>Dev / test F' + cap.np.cu + '<div class="lbl-sm">' + Rt.nonProdHoursMonth + ' hours / month pay-as-you-go</div></td><td class="n">' + H.money(cost.npMonth) + '</td><td class="n">' + H.money(cost.npMonth * 12) + '</td></tr>' : '') +
      '<tr><td>OneLake storage<div class="lbl-sm">' + H.fnum(cost.storTb, 0) + ' TB stored, ' + H.fnum(cost.freeMirrorTb, 0) + ' TB of mirrored data free, ' + H.fnum(cost.billTb, 0) + ' TB billed</div></td><td class="n">' + H.money(cost.storMonth) + '</td><td class="n">' + H.money(cost.storMonth * 12) + '</td></tr>' +
      (cost.lic ? '<tr><td>Power BI Pro licences<div class="lbl-sm">' + esc(cap.licenseNote || 'Authors publish with Pro') + '</div></td><td class="n">' + H.money(cost.lic) + '</td><td class="n">' + H.money(cost.lic * 12) + '</td></tr>' : '') +
      (cost.gwN ? '<tr><td>Data gateway VMs<div class="lbl-sm">' + cost.gwN + ' nodes for high availability (estimate)</div></td><td class="n">' + H.money(cost.gwMonth) + '</td><td class="n">' + H.money(cost.gwMonth * 12) + '</td></tr>' : '') +
      '<tr class="total"><td>Total</td><td class="n">' + H.money(cost.monthly) + '</td><td class="n">' + H.money(cost.monthly * 12) + '</td></tr></tbody></table></div>' +
      '<h4 style="margin:12px 0 6px">Three years</h4><div class="tblwrap"><table class="tbl"><thead><tr><th>Year</th><th class="n">Run cost</th></tr></thead><tbody>' + cost.years.map((y, i) => '<tr><td>Year ' + (i + 1) + '</td><td class="n">' + H.money(y) + '</td></tr>').join('') + '<tr class="total"><td>Total</td><td class="n">' + H.money(cost.threeYear) + '</td></tr></tbody></table></div>' +
      (R.roi ? '<h4 style="margin:12px 0 6px">Against the legacy estate</h4>' + roiBlock(R.roi) : '') + '</div></div>';
    const notes = [];
    if (cap.licenseNote) notes.push(cap.licenseNote);
    notes.push('Largest table: about ' + H.fnum(cap.maxRows / 1e9, 1) + ' billion rows (' + cap.rowsSrc + '). F' + cap.sku.cu + ' allows ' + H.fnum(cap.sku.dlRows / 1000, 1) + ' billion rows per table in Direct Lake' + (cap.maxRows > cap.sku.dlRows * 1e6 ? '. Aggregate or partition that table, use a composite model, or size to F' + cap.dlSku.cu + '.' : '.'));
    notes.push('Background jobs are smoothed over 24 hours, so nightly batch peaks rarely drive the SKU; report and SQL peaks (smoothed over 5 minutes) usually do.');
    notes.push('Third-party licences are not included: SAP Datasphere, open-mirroring partners, CDC tools and code-conversion tools.');
    h += '<div class="card" style="margin-top:16px"><h3>Sizing notes</h3><ul class="clean" style="margin-top:8px">' + notes.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul></div>';
    return h;
  };

  /* ============ Effort & team ============ */
  APP.views.effort = () => {
    const R = APP.R; const e = R.eff; const k = 1 + e.cont;
    let h = APP.pageHead('Results', 'Effort & team', 'Bottom-up estimate by workstream. Every line shows its drivers; unit rates and day rates sit in Rates & assumptions.', '<button class="btn" data-go="rates">Change rates</button>');
    h += '<div class="kpis">' + kpi('Total effort', H.fmt(e.total) + ' d', 'includes ' + H.pct(e.cont) + ' contingency') + kpi('Range', H.fmt(e.low) + '–' + H.fmt(e.high), 'person-days') +
      kpi('Delivery cost', H.money(e.cost), 'blended ' + H.money(APP.S.rates.blendedDayRate) + ' / day with role multipliers') + kpi('Team', 'about ' + R.plan.fte, 'for ' + H.fnum(R.plan.months, 0) + ' months') + '</div>';
    const ws = e.ws.filter((w) => w.days > 0.5);
    h += '<div class="card" style="margin-top:16px"><h3>Effort by workstream</h3><p class="sub" style="margin-bottom:8px">Person-days including contingency</p>' +
      hbars(ws.slice().sort((a, b) => b.days - a.days).map((w) => ({ label: w.label, value: w.days * k })), { w: 820, labelW: 280, fmt: (v) => H.fmt(v), unit: 'person-days', aria: 'Effort by workstream' }) + '</div>';
    h += '<div class="tblwrap" style="margin-top:16px"><table class="tbl"><thead><tr><th>Workstream</th><th>Drivers</th><th class="n">Base</th><th class="n">With contingency</th></tr></thead><tbody>' +
      ws.map((w) => '<tr><td><b>' + esc(w.label) + '</b></td><td class="small">' + w.drivers.slice(0, 6).map(esc).join('<br>') + (w.drivers.length > 6 ? '<br>…' : '') + '</td><td class="n">' + H.fmt(w.days) + '</td><td class="n">' + H.fmt(w.days * k) + '</td></tr>').join('') +
      '<tr class="total"><td>Total</td><td></td><td class="n">' + H.fmt(e.base) + '</td><td class="n">' + H.fmt(e.total) + '</td></tr></tbody></table></div>';
    const months = Math.max(1, R.plan.months);
    h += '<div class="grid2" style="margin-top:16px"><div class="card"><h3>Team mix</h3><div class="tblwrap" style="margin-top:8px"><table class="tbl"><thead><tr><th>Role</th><th class="n">Person-days</th><th class="n">Average FTE</th><th class="n">Cost</th></tr></thead><tbody>' +
      Object.keys(KB.ROLES).filter((r) => e.roles[r] > 0.5).sort((a, b) => e.roles[b] - e.roles[a]).map((r) => '<tr><td>' + esc(KB.ROLES[r].label) + '</td><td class="n">' + H.fmt(e.roles[r]) + '</td><td class="n">' + H.fnum(e.roles[r] / (months * 17), 1) + '</td><td class="n">' + H.money(e.roles[r] * APP.S.rates.blendedDayRate * KB.ROLES[r].mult) + '</td></tr>').join('') + '</tbody></table></div></div>' +
      '<div class="card"><h3>Effort by system</h3><p class="sub" style="margin-bottom:8px">Direct build work (schema, code, data, SAP) before shared workstreams</p>' +
      hbars(R.systems.map((x) => ({ label: x.name, value: U.sum(Object.values(e.perSystem[x.sys.id] || {})) * k })).sort((a, b) => b.value - a.value), { w: 560, labelW: 200, fmt: (v) => H.fmt(v), unit: 'person-days', color: C.s7, aria: 'Direct effort by system' }) + '</div></div>';
    return h;
  };

  /* ============ Roadmap ============ */
  function gantt(P) {
    const rows = P.rows; const W = 1120; const L = 330; const top = 30; const rh = 28;
    const maxW = Math.max(P.weeks, P.deadline ? P.deadline.months * 4.33 : 0, P.target ? P.target * 4.33 : 0) + 2;
    const hgt = top + rows.length * rh + 30; const sx = (w) => L + (W - L - 20) * w / maxW;
    const col = { foundation: C.s1, pilot: C.s2, wave: C.s3, cutover: C.s4, decom: C.s5 };
    let s = '<svg viewBox="0 0 ' + W + ' ' + hgt + '" width="' + W + '" role="img" aria-label="Roadmap Gantt chart">';
    const step = maxW > 80 ? 13 : maxW > 40 ? 8.66 : 4.33;
    s += '<g class="grid">';
    for (let w = 0; w <= maxW; w += step) s += '<line x1="' + sx(w) + '" x2="' + sx(w) + '" y1="' + (top - 6) + '" y2="' + (hgt - 22) + '"/>';
    s += '</g>';
    for (let w = 0; w <= maxW; w += step) s += '<text x="' + sx(w) + '" y="' + (top - 12) + '" text-anchor="middle" class="t-muted">M' + Math.round(w / 4.33) + '</text>';
    rows.forEach((r, i) => {
      const y = top + i * rh;
      s += '<text x="' + (L - 10) + '" y="' + (y + 15) + '" text-anchor="end">' + esc(r.label.length > 46 ? r.label.slice(0, 45) + '…' : r.label) + '</text>';
      s += '<g data-tip="' + esc(r.label + ': weeks ' + Math.round(r.start) + '–' + Math.round(r.start + r.dur) + ' · about ' + H.fmt(r.effort) + ' person-days') + '"><rect x="' + sx(r.start) + '" y="' + (y + 4) + '" width="' + Math.max(3, sx(r.start + r.dur) - sx(r.start) - 2) + '" height="16" rx="4" fill="' + (col[r.kind] || C.s3) + '"/></g>';
    });
    (P.milestones || []).forEach((m) => { const x = sx(m.at); s += '<g data-tip="' + esc(m.label + ' · week ' + Math.round(m.at)) + '"><path d="M' + x + ',' + (hgt - 26) + ' l5,5 l-5,5 l-5,-5 z" fill="var(--ink)"/></g>'; });
    if (P.deadline && P.deadline.months > 0) { const x = sx(P.deadline.months * 4.33); s += '<line x1="' + x + '" x2="' + x + '" y1="' + (top - 6) + '" y2="' + (hgt - 22) + '" stroke="var(--crit)" stroke-width="2" stroke-dasharray="5 4"/><text x="' + (x + 4) + '" y="' + (hgt - 8) + '" style="fill:var(--crit-ink);font-weight:600">Hard deadline ' + esc(P.deadline.label) + '</text>'; }
    if (P.target) { const x = sx(P.target * 4.33); s += '<line x1="' + x + '" x2="' + x + '" y1="' + (top - 6) + '" y2="' + (hgt - 22) + '" stroke="var(--accent)" stroke-width="2" stroke-dasharray="2 3"/>'; }
    return '<div class="chart">' + s + '</svg></div><div class="legend" style="margin-top:6px"><span><i style="background:var(--s1)"></i>Foundation</span><span><i style="background:var(--s2)"></i>Pilot</span><span><i style="background:var(--s3)"></i>Migration waves</span><span><i style="background:var(--s4)"></i>Parallel run & cutover</span><span><i style="background:var(--s5)"></i>Decommission</span><span><i style="background:var(--ink);border-radius:0;transform:rotate(45deg);width:8px;height:8px"></i>Milestone</span></div>';
  }
  APP.gantt = gantt;
  APP.views.roadmap = () => {
    const R = APP.R; const P = R.plan;
    let h = APP.pageHead('Results', 'Roadmap', 'Foundation first, a pilot on the lowest-risk system, then waves ordered by licence renewal dates, dependencies (SAP ERP before BW) and complexity. Large systems split into waves of about four months.', '');
    if (!R.systems.length) return h + '<div class="callout">No systems yet.</div>';
    h += '<div class="kpis">' + kpi('Duration', H.fnum(P.months, 0) + ' months', P.weeks + ' weeks end to end') + kpi('Team', 'about ' + P.fte, P.target ? 'sized to finish in ' + P.target + ' months' : 'recommended size') +
      kpi('Pilot', esc(P.pilot || '—'), 'proves the platform patterns end to end') + kpi('Waves', String(P.rows.filter((r) => r.kind === 'wave').length), 'plus foundation, pilot and cutover') + '</div>';
    if (P.deadline && P.months > P.deadline.months) h += '<div class="callout crit" style="margin-top:12px">The plan ends about ' + H.fnum(P.months - P.deadline.months, 0) + ' months after the hard deadline (' + esc(P.deadline.label) + '). See the risk register for options.</div>';
    h += '<div class="card" style="margin-top:16px">' + gantt(P) + '</div>';
    h += '<div class="tblwrap" style="margin-top:16px"><table class="tbl"><thead><tr><th>Phase</th><th class="n">Start (week)</th><th class="n">Duration (weeks)</th><th class="n">Effort (person-days)</th></tr></thead><tbody>' +
      P.rows.map((r) => '<tr><td>' + esc(r.label) + '</td><td class="n">' + Math.round(r.start) + '</td><td class="n">' + Math.round(r.dur) + '</td><td class="n">' + H.fmt(r.effort) + '</td></tr>').join('') + '</tbody></table></div>';
    return h;
  };

  /* ============ Risks & assumptions ============ */
  APP.views.risks = () => {
    const R = APP.R;
    let h = APP.pageHead('Results', 'Risks & assumptions', 'Risks are generated from the answers, discovery facts and plan. Assumptions list every estimate the numbers rest on.', '');
    const grid = {}; R.risks.forEach((r) => { const k = r.L + ':' + r.I; grid[k] = (grid[k] || 0) + 1; });
    const cell = (L, I) => { const n = grid[L + ':' + I] || 0; const sc = L * I; const col = sc >= 15 ? 'var(--crit)' : sc >= 10 ? 'var(--serious)' : sc >= 5 ? 'var(--warn)' : 'var(--good)'; return '<div class="c" style="background:color-mix(in srgb, ' + col + ' ' + (n ? 34 : 10) + '%, transparent)" data-tip="Likelihood ' + L + ', impact ' + I + ': ' + n + ' ' + H.plural(n, 'risk') + '">' + (n || '') + '</div>'; };
    let heat = '<div class="heat" role="img" aria-label="Risk heat map">';
    for (let L = 5; L >= 1; L--) { heat += '<div class="ax">' + L + '</div>'; for (let I = 1; I <= 5; I++) heat += cell(L, I); }
    heat += '<div></div>' + [1, 2, 3, 4, 5].map((i) => '<div class="ax">' + i + '</div>').join('') + '</div><div class="small muted" style="margin-top:4px;max-width:360px;text-align:center">Impact →   (likelihood ↑)</div>';
    const cnt = (sev) => R.risks.filter((r) => r.sev === sev).length;
    h += '<div class="grid2" style="grid-template-columns:auto minmax(0,1fr)"><div class="card">' + heat + '</div><div class="kpis">' + kpi('Critical', String(cnt('Critical')), 'score 15–25') + kpi('High', String(cnt('High')), 'score 10–14') + kpi('Medium', String(cnt('Medium')), 'score 5–9') + kpi('Low', String(cnt('Low')), 'score 1–4') + '</div></div>';
    h += '<div class="tblwrap" style="margin-top:16px"><table class="tbl"><thead><tr><th>Severity</th><th>Risk</th><th class="n">L</th><th class="n">I</th><th>Mitigation</th><th>Owner</th></tr></thead><tbody>' +
      R.risks.map((r) => '<tr><td><span class="pill ' + H.sevClass(r.sev) + '">' + r.sev + '</span></td><td><b>' + esc(r.title) + '</b><div class="small muted">' + esc(r.detail) + '</div></td><td class="n">' + r.L + '</td><td class="n">' + r.I + '</td><td class="small">' + esc(r.mitigation) + '</td><td class="small">' + esc(r.owner) + '</td></tr>').join('') + '</tbody></table></div>';
    h += '<div class="card" style="margin-top:16px"><h3>Assumptions</h3><ul class="clean" style="margin-top:8px">' + R.assumptions.map((a) => '<li>' + esc(a) + '</li>').join('') + '</ul></div>';
    const est = R.items.filter((it) => it.r.src === 'default' || it.r.src === 'derived' || it.r.src === 'ai');
    h += '<div class="sec-h" style="margin-top:20px"><h2>Estimated inputs (' + est.length + ')</h2><button class="btn ghost" data-go="validate">Validate them</button></div>' +
      '<div class="tblwrap"><table class="tbl"><thead><tr><th>Where</th><th>Question</th><th>Value used</th><th>Source</th><th>Basis</th></tr></thead><tbody>' +
      est.map((it) => '<tr><td class="small">' + esc(it.sys ? R.ctx.sv(it.sys, 's_name') : 'Estate') + '</td><td>' + esc(it.field.label) + '</td><td>' + esc(APP.displayVal(it.field, it.r.v, it.sys ? it.sys.id : 'g')) + '</td><td>' + APP.srcChip(it.r.src) + '</td><td class="small muted">' + esc(it.r.why) + '</td></tr>').join('') + '</tbody></table></div>';
    return h;
  };
})();
