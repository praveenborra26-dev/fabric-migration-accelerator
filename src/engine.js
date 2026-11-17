/* Fabric Migration Assessment Accelerator — assessment engine (pure functions, no DOM). */
(function (root) {
  'use strict';
  const KB = root.FMA_KB;
  const E = {};

  /* ---------- small utilities ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round = (v, d) => { const f = Math.pow(10, d || 0); return Math.round(v * f) / f; };
  const sum = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : (v === '' || v == null || isNaN(Number(v)) ? null : Number(v)));
  const has = (v) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0) && !(typeof v === 'number' && !isFinite(v));
  const nice = (v) => { if (!isFinite(v)) return 0; if (v < 10) return Math.round(v); const p = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.round(v / p) * p; };
  const fmtInt = (v) => (v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString('en-US'));
  const fmtNum = (v, d) => (v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: d == null ? 1 : d }));
  const uid = () => Math.random().toString(36).slice(2, 10);
  E.util = { clamp, round, sum, num, has, nice, fmtInt, fmtNum, uid };

  const PLAT = (s) => KB.PLATFORMS[s.platform] || KB.PLATFORMS.other;
  E.plat = PLAT;
  const GF = {}; KB.GLOBAL_FIELDS.forEach((f) => { GF[f.id] = f; });
  const SF = {}; KB.SYSTEM_FIELDS.forEach((f) => { SF[f.id] = f; });
  E.GF = GF; E.SF = SF;
  E.fieldsForSystem = (s) => KB.SYSTEM_FIELDS.filter((f) => f.fam.indexOf(PLAT(s).fam) >= 0 && (!f.plats || f.plats.indexOf(s.platform) >= 0));
  E.featureOptions = (s) => (KB.PLAT_FEATURES[s.platform] || KB.PLAT_FEATURES.other).map((k) => ({ k, l: KB.FEAT[k].label }));
  E.optLabel = (f, k) => { const o = (f.opts || []).find((x) => x.k === k); return o ? o.l : (KB.FEAT[k] ? KB.FEAT[k].label : k); };

  /* ---------- state ---------- */
  E.newState = () => ({ v: 1, id: 'a_' + uid(), name: '', created: new Date().toISOString(), updated: new Date().toISOString(), g: {}, systems: [], validations: {}, ai: {}, rates: Object.assign({}, KB.DEFAULT_RATES), reviewer: '' });
  E.newSystem = (platform, name) => {
    const p = KB.PLATFORMS[platform] || KB.PLATFORMS.other;
    return { id: 's_' + uid(), platform, a: { s_name: { v: name || p.short, src: 'user' } }, disc: null, ai: {} };
  };
  E.migrate = (st) => { // tolerate older/partial files
    const s = Object.assign(E.newState(), st || {});
    s.g = s.g || {}; s.systems = (s.systems || []).map((x) => Object.assign({ a: {}, disc: null, ai: {} }, x));
    s.validations = s.validations || {}; s.ai = s.ai || {}; s.rates = Object.assign({}, KB.DEFAULT_RATES, s.rates || {});
    return s;
  };

  /* ---------- answer resolution with inference ---------- */
  const D = (v, why) => ({ v, src: 'default', why });
  const R = (v, why, deps) => ({ v, src: deps && deps.length && deps.every((d) => d && d.conf >= 0.8) ? 'derived' : 'default', why });

  function knownRaw(ans) { return ans && !ans.ns && has(ans.v); }

  function makeCtx(state) {
    const ctx = { state, cache: {}, stack: {} };
    ctx.g = (id) => resolve(ctx, null, id);
    ctx.s = (sys, id) => resolve(ctx, sys, id);
    ctx.gv = (id) => ctx.g(id).v;
    ctx.sv = (sys, id) => ctx.s(sys, id).v;
    ctx.systems = state.systems;
    ctx.size = () => ctx.gv('org_size') || 'm';
    ctx.rawSys = (id) => state.systems.map((s) => s.a[id]).filter(knownRaw).map((a) => a.v);
    return ctx;
  }

  function resolve(ctx, sys, id) {
    const key = sys ? sys.id + ':' + id : 'g:' + id;
    if (ctx.cache[key]) return ctx.cache[key];
    const ans = sys ? sys.a[id] : ctx.state.g[id];
    let r;
    if (knownRaw(ans)) {
      const src = ans.src || 'user';
      const why = src === 'disc' ? 'From the discovery script' : src === 'ai' ? ('Extracted by the AI agent' + (ans.ev ? ': "' + String(ans.ev).slice(0, 140) + '"' : '')) : src === 'val' ? 'Confirmed by a reviewer' : 'Provided';
      r = { v: ans.v, src, conf: KB.CONF[src] != null ? KB.CONF[src] : 0.95, why };
    } else {
      if (ctx.stack[key]) return { v: null, src: 'missing', conf: 0, why: 'circular' };
      ctx.stack[key] = true;
      const fn = sys ? INFER_S[id] : INFER_G[id];
      let inf = null;
      try { inf = fn ? fn(ctx, sys) : null; } catch (e) { inf = null; }
      delete ctx.stack[key];
      if (!inf || !has(inf.v)) r = { v: null, src: 'missing', conf: 0, why: 'Not answered' };
      else r = { v: inf.v, src: inf.src, conf: KB.CONF[inf.src], why: inf.why };
      r.notSure = !!(ans && ans.ns);
    }
    // Completion credit: a benchmark default counts only once someone has looked at the
    // question (answered "Not sure"); an untouched question has had no assessment work yet.
    r.cc = r.src === 'default' && !r.notSure ? 0 : r.conf;
    ctx.cache[key] = r;
    return r;
  }

  const platformsPresent = (ctx) => ctx.systems.map((s) => s.platform);
  const anyPlat = (ctx, list) => platformsPresent(ctx).some((p) => list.indexOf(p) >= 0);

  const INFER_G = {
    org_industry: () => D('other', 'Not provided: generic assumptions'),
    org_size: (c) => {
      const tbs = c.systems.map((s) => c.s(s, 's_data_tb')).filter((r) => r.conf >= 0.8);
      if (tbs.length) {
        const tb = sum(tbs.map((r) => r.v));
        const band = tb < 3 ? 'xs' : tb < 15 ? 's' : tb < 60 ? 'm' : tb < 200 ? 'l' : 'xl';
        return R(band, 'Inferred from ' + fmtNum(tb) + ' TB of known data', tbs);
      }
      return D('m', 'Benchmark default: mid-size enterprise');
    },
    org_region: () => D('na', 'Benchmark default'),
    org_drivers: (c) => {
      const d = ['cost', 'ai'];
      if (anyPlat(c, ['sap_ecc', 'sap_bw'])) d.push('eol', 'sap');
      else if (anyPlat(c, ['teradata', 'netezza', 'db2zos', 'hive', 'greenplum', 'sap_iq', 'sap_ase'])) d.push('eol');
      if (c.systems.length > 2) d.push('consol');
      return D(d, 'Typical drivers for this estate');
    },
    org_deadline: () => D('none', 'No hard deadline assumed'),
    org_ms: () => D(['e3', 'entra', 'azure'], 'Typical Microsoft footprint'),
    etl_tools: (c) => {
      const t = [];
      if (anyPlat(c, ['mssql', 'azure_sql'])) t.push('ssis');
      if (anyPlat(c, ['snowflake', 'bigquery', 'redshift', 'databricks'])) t.push('dbt');
      if (anyPlat(c, ['hive'])) t.push('oozie');
      if (anyPlat(c, ['teradata'])) t.push('bteq');
      if (anyPlat(c, ['oracle', 'db2luw', 'db2zos', 'netezza']) && ['m', 'l', 'xl'].indexOf(c.size()) >= 0) t.push('infa');
      if (anyPlat(c, ['sap_ecc', 'sap_s4']) && !anyPlat(c, ['sap_bw', 'sap_bw4'])) t.push('bods');
      if ((c.gv('org_ms') || []).indexOf('adf') >= 0) t.push('adf');
      t.push('sproc');
      return D(Array.from(new Set(t)), 'Typical tooling for the platforms in scope');
    },
    etl_jobs: (c) => {
      const raw = c.rawSys('s_etl_jobs');
      if (raw.length) return R(nice(sum(raw)), 'Sum of jobs recorded per system', [{ conf: 0.95 }]);
      let n = 0; const deps = [];
      c.systems.forEach((s) => {
        const fam = PLAT(s).fam; const role = c.sv(s, 's_role');
        if (fam === 'db' || fam === 'hana') { const t = c.s(s, 's_tables'); deps.push(t); n += (t.v || 0) * (role === 'oltp' || role === 'replica' ? 0.05 : 0.35); }
        else if (fam === 'sap_erp') { const t = c.s(s, 's_sap_tables'); deps.push(t); n += (t.v || 0) * 0.5; }
        else if (fam === 'sap_bw') { const t = c.s(s, 's_bw_chains'); deps.push(t); n += (t.v || 0) * 4; }
      });
      if (n > 0) return R(nice(Math.max(20, n)), 'About one job per three warehouse tables', deps);
      return D(KB.SIZE_BASE.etlJobs[c.size()], 'Benchmark for organization size');
    },
    etl_mix: (c) => {
      const t = c.gv('etl_tools') || [];
      const cx = ['custom', 'bteq', 'abinitio', 'sproc'].filter((x) => t.indexOf(x) >= 0).length;
      return D(cx >= 2 ? 'complex' : 'balanced', 'Benchmark from tooling');
    },
    etl_scheduler: (c) => {
      if (c.systems.length && c.systems.every((s) => s.platform === 'mssql')) return D('agent', 'SQL Server estate');
      return D(['l', 'xl'].indexOf(c.size()) >= 0 ? 'controlm' : 'native', 'Benchmark for organization size');
    },
    etl_feeds: (c) => D(KB.SIZE_BASE.feeds[c.size()] + c.systems.length, 'Benchmark for organization size'),
    etl_daily_gb: (c) => {
      const tb = c.systems.map((s) => c.s(s, 's_data_tb'));
      const total = sum(tb.map((r) => r.v));
      if (total > 0) return R(Math.max(1, nice(total * 1024 * 0.01)), 'About 1% of the data changes per day', tb);
      return D(50, 'Benchmark default');
    },
    etl_latency: (c) => D((c.gv('org_drivers') || []).indexOf('rt') >= 0 ? 'near_rt' : 'daily', 'Benchmark from business drivers'),
    etl_cdc: (c) => {
      const t = [];
      c.systems.forEach((s) => { const x = (s.a.s_sap_extract && s.a.s_sap_extract.v) || []; if (x.indexOf('slt') >= 0) t.push('slt'); });
      return D(t.length ? t : ['none'], 'Nothing recorded');
    },
    etl_window: () => D(6, 'Benchmark default'),
    bi_tools: (c) => {
      const t = ['pbi', 'excel'];
      if (anyPlat(c, ['mssql'])) t.push('ssrs');
      if (anyPlat(c, ['sap_bw', 'sap_bw4'])) t.push('bex');
      if (anyPlat(c, ['oracle']) && ['l', 'xl'].indexOf(c.size()) >= 0) t.push('obiee');
      return D(t, 'Typical tools for the platforms in scope');
    },
    bi_reports: (c) => {
      const raw = c.rawSys('s_reports');
      if (raw.length) return R(nice(sum(raw)), 'Sum of reports recorded per system', [{ conf: 0.95 }]);
      const f = clamp(0.6 + 0.2 * c.systems.length, 0.6, 1.6);
      return D(nice(KB.SIZE_BASE.reports[c.size()] * f), 'Benchmark for organization size');
    },
    bi_models: (c) => { const r = c.g('bi_reports'); return R(Math.max(3, nice((r.v || 0) * 0.07)), 'About 7 models per 100 reports', [r]); },
    bi_viewers: (c) => D(KB.SIZE_BASE.viewers[c.size()], 'Benchmark for organization size'),
    bi_authors: (c) => { const r = c.g('bi_viewers'); return R(Math.max(5, nice((r.v || 0) * 0.07)), 'About 7% of consumers author content', [r]); },
    bi_concurrency: (c) => { const r = c.g('bi_viewers'); return R(Math.max(5, nice((r.v || 0) * 0.08)), 'About 8% of consumers active at peak', [r]); },
    bi_unused: () => D(35, 'Industry benchmark: a third of reports go unused'),
    bi_paginated: (c) => { const t = c.gv('bi_tools') || []; return D(['ssrs', 'cognos', 'bo', 'mstr', 'obiee'].some((x) => t.indexOf(x) >= 0) ? 30 : 15, 'Benchmark from BI tools'); },
    bi_ds: () => D(['none'], 'Nothing recorded'),
    bi_ai: (c) => D((c.gv('org_drivers') || []).indexOf('ai') >= 0 ? 'copilot' : 'none', 'From business drivers'),
    bi_embed: () => D('no', 'Benchmark default'),
    sec_regs: (c) => {
      const ind = c.gv('org_industry'); const reg = c.gv('org_region'); const r = [];
      if (ind === 'fs') r.push('sox', 'pci'); if (ind === 'fs' && reg === 'na') r.push('glba');
      if (ind === 'ins') r.push('sox'); if (ind === 'hls' && reg === 'na') r.push('hipaa');
      if (ind === 'retail') r.push('pci'); if (ind === 'public') r.push(reg === 'na' ? 'fedramp' : 'residency');
      if (reg === 'eu' || reg === 'uk') r.push('gdpr'); if (reg === 'eu' && (ind === 'fs' || ind === 'ins')) r.push('dora');
      if (reg === 'na' && ['retail', 'tech', 'telco'].indexOf(ind) >= 0) r.push('ccpa');
      return D(r.length ? Array.from(new Set(r)) : ['none'], 'Typical for industry and region');
    },
    sec_pii: (c) => D(['fs', 'ins', 'hls', 'public', 'telco'].indexOf(c.gv('org_industry')) >= 0 ? 'extensive' : 'some', 'Typical for industry'),
    sec_rls: (c) => D(['fs', 'ins', 'hls', 'public'].indexOf(c.gv('org_industry')) >= 0 ? 'complex' : 'basic', 'Typical for industry'),
    sec_masking: (c) => D(c.gv('sec_pii') === 'extensive' ? 'yes' : 'no', 'From personal-data answer'),
    sec_identity: (c) => { const m = c.gv('org_ms') || []; return D(m.some((x) => ['entra', 'e3', 'e5'].indexOf(x) >= 0) ? 'hybrid' : 'other_idp', 'From Microsoft footprint'); },
    sec_catalog: (c) => D((c.gv('org_ms') || []).indexOf('purview') >= 0 ? ['purview'] : ['none'], 'From Microsoft footprint'),
    sec_network: (c) => D(['fs', 'ins', 'hls', 'public'].indexOf(c.gv('org_industry')) >= 0 ? 'private' : 'public', 'Typical for industry'),
    sec_cmk: (c) => D(['fs', 'public'].indexOf(c.gv('org_industry')) >= 0 ? 'yes' : 'no', 'Typical for industry'),
    sec_residency: (c) => { const reg = c.gv('org_region'); const regs = c.gv('sec_regs') || []; return D(['eu', 'uk', 'mea'].indexOf(reg) >= 0 || c.gv('org_industry') === 'public' || regs.indexOf('residency') >= 0 ? 'yes' : 'no', 'Typical for region and industry'); },
    ops_envs: () => D('3', 'Benchmark default'),
    ops_dr: (c) => D(['fs', 'ins', 'hls'].indexOf(c.gv('org_industry')) >= 0 ? 'warm' : 'backup', 'Typical for industry'),
    ops_devops: () => D('partial', 'Benchmark default'),
    ops_skill_sql: () => D('high', 'Legacy warehouse teams are usually SQL-strong'),
    ops_skill_spark: (c) => { const ds = c.gv('bi_ds') || []; return D(ds.indexOf('notebooks') >= 0 || ds.indexOf('dbx') >= 0 ? 'medium' : 'low', 'From data science tools'); },
    ops_skill_pbi: (c) => D((c.gv('bi_tools') || []).indexOf('pbi') >= 0 ? 'medium' : 'low', 'From BI tools'),
    ops_team_fte: (c) => D(KB.SIZE_BASE.teamFte[c.size()], 'Benchmark for organization size'),
    ops_delivery: () => D('hybrid', 'Benchmark default'),
    tgt_strategy: (c) => R('recommend', 'The accelerator recommends; approve it in Validate', [{ conf: c.systems.length ? 1 : 0 }]),
    tgt_compute: (c) => R('recommend', 'The accelerator recommends per system; approve it in Validate', [{ conf: c.systems.length ? 1 : 0 }]),
    tgt_cutover: (c) => R('recommend', 'The accelerator recommends; approve it in Validate', [{ conf: c.systems.length ? 1 : 0 }]),
    tgt_parallel_weeks: (c) => D(['fs', 'ins', 'hls', 'public'].indexOf(c.gv('org_industry')) >= 0 ? 8 : 6, 'Benchmark for industry'),
    tgt_purchase: () => R('recommend', 'Reserved for production, pay-as-you-go for dev/test', [{ conf: 1 }]),
    tgt_rationalize: () => D('yes', 'Recommended practice'),
    tgt_ai_assist: () => D('yes', 'Recommended practice')
  };

  const roleF = { edw: 1, mart: 0.3, ods: 0.4, oltp: 0.25, replica: 0.3, erp: 0.2 };
  const INFER_S = {
    s_role: (c, s) => D(PLAT(s).defRole, 'Typical role for ' + PLAT(s).short),
    s_deploy: (c, s) => D(PLAT(s).defDeploy, 'Typical deployment for ' + PLAT(s).short),
    s_scope: (c, s) => { const r = c.sv(s, 's_role'); return D(r === 'replica' ? 'replicate' : (r === 'oltp' || r === 'erp') ? 'offload' : 'full', 'From the system role'); },
    s_data_tb: (c, s) => {
      const p = PLAT(s); const fam = p.fam;
      if (fam === 'db' || fam === 'hana') {
        const t = c.s(s, 's_tables');
        if (t.conf >= 0.8 && t.v > 0) return R(round(Math.pow(t.v / p.k, 1 / 0.65), 1), 'From ' + fmtInt(t.v) + ' tables (platform density)', [t]);
      }
      const role = c.sv(s, 's_role');
      const typ = p.typical[role] || p.typical[Object.keys(p.typical)[0]];
      return D(round(typ * KB.SIZE_MULT[c.size()], 1), 'Typical ' + p.short + ' ' + (role || '') + ' for organization size');
    },
    s_growth: () => D(20, 'Benchmark default'),
    s_db_count: (c, s) => { const t = c.s(s, 's_tables'); return R(Math.max(1, Math.round((t.v || 0) / 400)), 'About 400 tables per database/schema', [t]); },
    s_tables: (c, s) => { const p = PLAT(s); const tb = c.s(s, 's_data_tb'); return R(nice(p.k * Math.pow(Math.max(tb.v || 0.05, 0.05), 0.65)), 'From ' + fmtNum(tb.v) + ' TB (platform density)', [tb]); },
    s_views: (c, s) => { const t = c.s(s, 's_tables'); return R(nice((t.v || 0) * PLAT(s).viewR), 'Platform ratio of views to tables', [t]); },
    s_procs: (c, s) => { const t = c.s(s, 's_tables'); const f = c.sv(s, 's_role') === 'oltp' ? 0.6 : 1; return R(nice((t.v || 0) * PLAT(s).procR * f), 'Platform ratio of procedures to tables', [t]); },
    s_funcs: (c, s) => { const t = c.s(s, 's_tables'); return R(nice((t.v || 0) * PLAT(s).funcR), 'Platform ratio of functions to tables', [t]); },
    s_triggers: (c, s) => { const t = c.s(s, 's_tables'); const f = c.sv(s, 's_role') === 'oltp' ? 3 : 1; return R(nice((t.v || 0) * PLAT(s).trigR * f), 'Platform ratio of triggers to tables', [t]); },
    s_loc: (c, s) => {
      const p = PLAT(s); const pr = c.s(s, 's_procs'); const fu = c.s(s, 's_funcs'); const tr = c.s(s, 's_triggers');
      let v = (pr.v || 0) * p.locPer + (fu.v || 0) * 40 + (tr.v || 0) * 60;
      if (PLAT(s).fam === 'hana') v += (c.sv(s, 's_hana_calcviews') || 0) * 80;
      return R(nice(v), 'About ' + p.locPer + ' lines per procedural object', [pr]);
    },
    s_code_mix: (c, s) => {
      const p = PLAT(s); const loc = c.s(s, 's_loc'); const pr = c.s(s, 's_procs');
      if (loc.conf >= 0.8 && pr.conf >= 0.8 && pr.v > 0) {
        const r = (loc.v / Math.max(1, pr.v + (c.sv(s, 's_funcs') || 0))) / p.locPer;
        return R(r < 0.6 ? 'simple' : r < 1.6 ? 'balanced' : 'complex', 'From lines per object versus the platform norm', [loc, pr]);
      }
      return D('balanced', 'Benchmark default');
    },
    s_types: (c, s) => { const t = c.s(s, 's_tables'); const fr = { mssql: 0.2, oracle: 0.1, teradata: 0.04, db2luw: 0.06, db2zos: 0.08, db2i: 0.08 }[s.platform] || 0.05; return R(nice((t.v || 0) * 25 * fr), 'Typical share of columns needing type mapping', [t]); },
    s_largest_gb: (c, s) => { const tb = c.s(s, 's_data_tb'); const f = ['oltp', 'erp'].indexOf(c.sv(s, 's_role')) >= 0 ? 0.12 : 0.08; return R(nice((tb.v || 0) * 1024 * f), 'Largest table is typically ' + Math.round(f * 100) + '% of the data', [tb]); },
    s_features: (c, s) => D((KB.TYPICAL_FEATURES[s.platform] || KB.TYPICAL_FEATURES.other).slice(), 'Typical features for ' + PLAT(s).short),
    s_cdc: (c, s) => D(PLAT(s).cdc, 'Typical for ' + PLAT(s).short),
    s_latency: (c) => { const g = c.g('etl_latency'); return { v: g.v, src: g.src === 'user' || g.src === 'val' || g.src === 'disc' || g.src === 'ai' ? 'derived' : 'default', why: 'Uses the estate-wide freshness answer' }; },
    s_users: (c, s) => {
      const fam = PLAT(s).fam; const size = c.size();
      if (fam === 'sap_erp') return D({ xs: 200, s: 800, m: 3000, l: 10000, xl: 30000 }[size], 'Typical SAP dialog users for organization size');
      return D(nice(KB.SIZE_BASE.dbUsers[size] * (roleF[c.sv(s, 's_role')] || 0.5)), 'Benchmark for organization size and role');
    },
    s_queries: (c, s) => D(nice(KB.SIZE_BASE.queries[c.size()] * (roleF[c.sv(s, 's_role')] || 0.5) * (PLAT(s).fam === 'sap_bw' ? 0.3 : 1)), 'Benchmark for organization size and role'),
    s_concurrency: (c, s) => { const u = c.s(s, 's_users'); return R(Math.max(5, nice((u.v || 0) * 0.08)), 'About 8% of users at peak', [u]); },
    s_etl_jobs: (c, s) => {
      const fam = PLAT(s).fam; const role = c.sv(s, 's_role');
      if (fam === 'sap_erp') { const t = c.s(s, 's_sap_tables'); return R(nice((t.v || 0) * 0.5), 'About one job per two SAP tables in scope', [t]); }
      if (fam === 'sap_bw') { const t = c.s(s, 's_bw_chains'); return R(nice((t.v || 0) * 4), 'About four loads per process chain', [t]); }
      const t = c.s(s, 's_tables'); return R(nice((t.v || 0) * (role === 'oltp' || role === 'replica' ? 0.05 : 0.35)), 'About one job per three tables', [t]);
    },
    s_reports: (c, s) => {
      const g = c.g('bi_reports');
      const shareOf = (x) => { const r = c.sv(x, 's_role'); return (r === 'edw' || r === 'mart' || r === 'ods' ? 1 : 0.3) * Math.max(0.1, c.sv(x, 's_data_tb') || 0.1); };
      const tot = sum(c.systems.map(shareOf));
      return R(nice((g.v || 0) * shareOf(s) / Math.max(tot, 0.0001)), 'Share of all reports by role and volume', [g]);
    },
    s_renewal: () => D('none', 'No renewal date recorded'),
    s_sap_db: (c, s) => D(['sap_s4', 'sap_bw4'].indexOf(s.platform) >= 0 ? 'hana' : 'hana', 'Typical (S/4HANA and BW/4HANA require HANA)'),
    s_modules: () => D(['fi', 'co', 'sd', 'mm'], 'Typical analytics scope'),
    s_sap_tables: (c, s) => { const m = c.s(s, 's_modules'); return R(nice(sum((m.v || []).map((k) => KB.SAP_MODULE_TABLES[k] || 40))), 'Typical tables per module in scope', [m]); },
    s_sap_extractors: (c, s) => {
      if (PLAT(s).fam === 'sap_bw') { const p = c.s(s, 's_bw_providers'); return R(nice((p.v || 0) * 0.8), 'About 0.8 DataSources per provider', [p]); }
      const m = c.s(s, 's_modules'); return R(nice((m.v || []).length * 25), 'About 25 extractors per module', [m]);
    },
    s_sap_custom: (c, s) => { const t = c.s(s, 's_sap_tables'); return D(nice((t.v || 0) * 0.6), 'Typical custom objects relative to tables in scope'); },
    s_sap_extract: (c) => D(anyPlat(c, ['sap_bw', 'sap_bw4']) ? ['bw_odp'] : ['none'], 'From the systems in scope'),
    s_datasphere: () => D('no', 'Not recorded'),
    s_bdc: () => D('no', 'Not recorded'),
    s_s4: () => D('planned', 'Typical: ECC mainstream maintenance ends in 2027'),
    s_bw_providers: (c) => D({ xs: 30, s: 80, m: 200, l: 450, xl: 900 }[c.size()], 'Benchmark for organization size'),
    s_bw_queries: (c, s) => { const p = c.s(s, 's_bw_providers'); return R(nice((p.v || 0) * 3), 'About three queries per provider', [p]); },
    s_bw_chains: (c, s) => { const p = c.s(s, 's_bw_providers'); return R(nice((p.v || 0) * 0.4), 'About one chain per 2–3 providers', [p]); },
    s_bw_transforms: (c, s) => { const p = c.s(s, 's_bw_providers'); return R(nice((p.v || 0) * 2), 'About two transformations per provider', [p]); },
    s_bw_abap: () => D('medium', 'Benchmark default'),
    s_bw_frontend: () => D(['afo', 'bex'], 'Typical BW front ends'),
    s_hana_calcviews: (c, s) => { const t = c.s(s, 's_tables'); return R(Math.max(20, nice((t.v || 0) * 0.15)), 'Typical ratio to tables', [t]); },
    s_hana_license: () => D('unknown', 'Not recorded'),
    s_version: () => null,
    s_name: (c, s) => D(PLAT(s).short, 'Platform name')
  };

  /* ---------- discovery import ---------- */
  const SECTIONS_RE = /^\s*"?(platform|size|inventory|code|types|workload|etl|bi|cdc|security|client_app|table_top|sap|bw|error)"?\s*[,;\t|]\s*(.*)$/i;
  E.parseDiscovery = (text) => {
    const out = { platform: null, metrics: {}, apps: [], tops: [], errors: [], rows: 0, ignored: 0 };
    String(text || '').split(/\r?\n/).forEach((line0) => {
      const line = line0.replace(/^﻿/, '').trim();
      if (!line) return;
      const m = line.match(SECTIONS_RE);
      if (!m) { out.ignored++; return; }
      const section = m[1].toLowerCase();
      const sep = (line.match(/^\s*"?[a-z_]+"?\s*([,;\t|])/i) || [])[1] || ',';
      const parts = splitCsv(m[2], sep);
      const metric = (parts[0] || '').trim();
      const value = parts.slice(1).join(sep === ',' ? ',' : ' ').trim().replace(/^"|"$/g, '');
      if (!metric) { out.ignored++; return; }
      out.rows++;
      if (section === 'error') { out.errors.push(metric + ': ' + value); return; }
      if (section === 'client_app') { out.apps.push({ name: metric, n: num(value) || 0 }); return; }
      if (section === 'table_top') { const [gb, rows] = value.split('|'); out.tops.push({ name: metric, gb: num(gb) || 0, rows: num(rows) }); return; }
      if (section === 'platform' && metric.toLowerCase() === 'platform') { out.platform = value.toLowerCase(); }
      const key = section + '.' + metric.toLowerCase();
      if (value === '' && out.metrics[key] != null) return;
      out.metrics[key] = value;
    });
    return out;
  };
  function splitCsv(s, sep) {
    const res = []; let cur = ''; let q = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '"') { if (q && s[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === sep && !q) { res.push(cur); cur = ''; }
      else cur += ch;
    }
    res.push(cur);
    return res;
  }

  const PLATFORM_ALIASES = { synapse: 'synapse', netezza: 'netezza', snowflake: 'snowflake', databricks: 'databricks', redshift: 'redshift', bigquery: 'bigquery', postgres: 'postgres', postgresql: 'postgres', greenplum: 'greenplum', mysql: 'mysql', mariadb: 'mysql', vertica: 'vertica', exasol: 'exasol', clickhouse: 'clickhouse', hive: 'hive', hadoop: 'hive', other: 'other', azure_sql: 'azure_sql', mssql: 'mssql', sqlserver: 'mssql', oracle: 'oracle', teradata: 'teradata', db2luw: 'db2luw', db2zos: 'db2zos', db2i: 'db2i', sap_erp: 'sap_ecc', sap_bw: 'sap_bw', sap_hana: 'sap_hana', hana: 'sap_hana' };
  E.discoveryPlatform = (parsed) => PLATFORM_ALIASES[parsed.platform] || null;

  E.mapDiscovery = (parsed, platform) => {
    const M = parsed.metrics;
    const n = (k) => num(M[k]);
    const s = (...ks) => { let t = 0; let any = false; ks.forEach((k) => { const v = n(k); if (v != null) { t += v; any = true; } }); return any ? t : null; };
    const fields = {}; const feats = new Set(); const glob = {}; const notes = [];
    const set = (id, v) => { if (v != null && isFinite(v)) fields[id] = v; };
    const gb = n('size.used_size_gb') != null && n('size.used_size_gb') > 0 ? n('size.used_size_gb') : (n('size.total_size_gb') != null ? n('size.total_size_gb') : n('size.allocated_size_gb'));
    let gbAll = gb;
    if (gbAll != null && n('size.partition_size_gb') != null) { gbAll += n('size.partition_size_gb'); notes.push('Size includes partition statistics; tables without statistics count as 0 GB.'); }
    if (gbAll != null) set('s_data_tb', round(gbAll / 1024, 2));
    if (n('size.largest_table_gb') != null) set('s_largest_gb', round(n('size.largest_table_gb'), 1));
    const ver = M['platform.version'] || M['platform.release'] || M['platform.hana_version'];
    if (ver) fields.s_version = prettyVersion(platform, ver, M);
    const fam = (KB.PLATFORMS[platform] || KB.PLATFORMS.other).fam;
    const has0 = (k) => (n(k) || 0) > 0;

    if (fam === 'db' || fam === 'hana') {
      set('s_tables', s('inventory.table_count', 'inventory.nopi_table_count', 'inventory.dds_physical_file_count'));
      set('s_views', s('inventory.view_count', 'inventory.logical_file_count'));
      set('s_procs', s('inventory.proc_count', 'inventory.package_count', 'inventory.macro_count', 'inventory.external_proc_count'));
      if (platform === 'db2zos' || platform === 'db2i') set('s_procs', s('inventory.proc_count'));
      set('s_funcs', s('inventory.function_count', 'inventory.table_function_count', 'inventory.aggregate_function_count'));
      set('s_triggers', n('inventory.trigger_count'));
      set('s_db_count', n('inventory.database_count') != null ? n('inventory.database_count') : n('inventory.schema_count'));
      let loc = n('code.code_lines');
      if (loc == null && n('code.proc_macro_chars') != null) { loc = Math.round(n('code.proc_macro_chars') / 40); notes.push('Lines of code estimated from object text length (Teradata stores up to 12,500 characters per object).'); }
      if (loc == null && n('code.code_chars') != null) { loc = Math.round(n('code.code_chars') / 45); notes.push('Lines of code estimated from object text length.'); }
      set('s_loc', loc);
      const typeKeys = Object.keys(M).filter((k) => k.indexOf('types.') === 0 && !/other_columns|columns_total|unsupported_type_columns|ebcdic_tables|decimal_columns|format_|lowcardinality/.test(k));
      const typeTotal = n('types.unsupported_type_columns') != null ? n('types.unsupported_type_columns') : (typeKeys.length ? sum(typeKeys.map((k) => n(k))) : null);
      set('s_types', typeTotal);
      if (platform === 'sap_hana') { set('s_hana_calcviews', n('inventory.calc_view_count')); }
    }
    set('s_users', n('workload.login_count') != null ? n('workload.login_count') : n('workload.user_count') != null ? n('workload.user_count') : n('sap.dialog_users'));
    let q = null;
    if (n('workload.daily_batches') != null) q = n('workload.daily_batches');
    else if (n('workload.queries_30d') != null) q = n('workload.queries_30d') / Math.max(1, n('workload.dbql_days') || 30);
    else if (n('workload.daily_user_calls') != null) { q = n('workload.daily_user_calls') / 4; notes.push('Queries per day estimated as Oracle user calls ÷ 4.'); }
    else if (n('workload.daily_activities') != null) q = n('workload.daily_activities');
    else if (n('workload.daily_queries') != null) q = n('workload.daily_queries');
    if (q != null) set('s_queries', nice(q));
    if (n('workload.sessions_max') != null) set('s_concurrency', n('workload.sessions_max'));
    else if (n('workload.peak_connections') != null) set('s_concurrency', n('workload.peak_connections'));
    else if (n('workload.peak_hour_queries') != null) { set('s_concurrency', Math.max(1, Math.round(n('workload.peak_hour_queries') / 120))); notes.push('Peak concurrency estimated from the busiest hour (30-second average query).'); }
    else if (n('workload.user_sessions_now') != null) set('s_concurrency', n('workload.user_sessions_now'));

    // ETL and BI signals
    const etlJobs = s('etl.agent_jobs', 'etl.ssisdb_packages', 'etl.msdb_ssis_packages', 'etl.scheduler_jobs', 'etl.legacy_jobs', 'etl.pipeline_count');
    if (etlJobs != null && etlJobs > 0) set('s_etl_jobs', etlJobs);
    if (n('bi.ssrs_reports') != null) set('s_reports', n('bi.ssrs_reports'));
    const etlTools = new Set(); const biTools = new Set(); const dsTools = new Set();
    if (has0('etl.ssisdb_packages') || has0('etl.msdb_ssis_packages') || has0('etl.agent_job_steps_ssis')) etlTools.add('ssis');
    if (has0('bi.ssrs_reports')) biTools.add('ssrs');
    (parsed.apps || []).forEach((a) => {
      KB.APP_SIGNATURES.forEach(([re, kind, key]) => { if (re.test(a.name)) (kind === 'etl' ? etlTools : kind === 'bi' ? biTools : dsTools).add(key); });
    });
    if (etlTools.has('bteq')) feats.add('bteq');
    if ((parsed.apps || []).some((a) => /tpt|fastload|multload|fastexp|tpump/i.test(a.name))) feats.add('tpt');
    if (etlTools.size) glob.etl_tools = Array.from(etlTools);
    if (biTools.size) glob.bi_tools = Array.from(biTools);
    if (dsTools.size) glob.bi_ds = Array.from(dsTools);
    if (n('bi.ssrs_reports') && n('bi.ssrs_reports_used_recent') != null) {
      glob.bi_unused = clamp(Math.round(100 * (1 - n('bi.ssrs_reports_used_recent') / n('bi.ssrs_reports'))), 0, 100);
      notes.push('Unused reports measured from the SSRS execution log (recent retention window).');
    }

    // CDC readiness
    if (platform === 'mssql') fields.s_cdc = has0('cdc.cdc_enabled_dbs') ? 'enabled' : 'possible';
    if (platform === 'oracle') { const al = String(M['cdc.archivelog_mode'] || '').toUpperCase(); fields.s_cdc = al === 'ARCHIVELOG' ? (String(M['cdc.supplemental_logging'] || '').toUpperCase() === 'YES' ? 'enabled' : 'possible') : (al ? 'none' : undefined); if (al && al !== 'ARCHIVELOG') notes.push('Database runs in NOARCHIVELOG mode: Oracle mirroring needs ARCHIVELOG and LogMiner.'); }
    if (platform === 'db2luw') { const lm = String(M['cdc.log_archive_method'] || '').toUpperCase(); fields.s_cdc = has0('cdc.data_capture_tables') ? 'enabled' : (lm && lm !== 'OFF' ? 'possible' : (lm ? 'none' : undefined)); }
    if (platform === 'db2zos') fields.s_cdc = has0('cdc.data_capture_tables') ? 'enabled' : 'possible';
    if (platform === 'db2i') fields.s_cdc = has0('cdc.journaled_files') ? 'enabled' : 'possible';
    if (platform === 'teradata') fields.s_cdc = 'none';
    if (['snowflake', 'bigquery', 'databricks'].indexOf(platform) >= 0) fields.s_cdc = 'possible';
    if (['redshift', 'greenplum', 'vertica', 'exasol', 'clickhouse', 'hive', 'netezza', 'synapse'].indexOf(platform) >= 0) fields.s_cdc = 'none';
    if (platform === 'postgres' && M['cdc.wal_level']) { fields.s_cdc = String(M['cdc.wal_level']).toLowerCase() === 'logical' ? 'enabled' : 'possible'; if (fields.s_cdc === 'possible') notes.push('wal_level is not logical: CDC-based replication needs wal_level = logical (a restart).'); }
    if (platform === 'mysql' && M['cdc.binlog_format']) { const on = /^(1|on)$/i.test(String(M['cdc.log_bin'] || '')); fields.s_cdc = on && String(M['cdc.binlog_format']).toUpperCase() === 'ROW' ? 'enabled' : 'possible'; }
    if (n('workload.credits_30d') != null) notes.push('Snowflake used ' + fmtNum(n('workload.credits_30d')) + ' credits in 30 days: multiply by your credit price for the current run cost.');
    if (n('workload.dbu_30d') != null) notes.push('Databricks used ' + fmtNum(n('workload.dbu_30d')) + ' DBUs in 30 days: multiply by your DBU price for the current run cost.');
    if (n('workload.billed_tb_30d') != null) notes.push('BigQuery billed ' + fmtNum(n('workload.billed_tb_30d')) + ' TB scanned in 30 days' + (n('workload.avg_slots') != null ? ' (about ' + fmtNum(n('workload.avg_slots')) + ' slots on average)' : '') + '.');
    if (fields.s_cdc === undefined) delete fields.s_cdc;

    // security signals
    if (has0('security.rls_policy_count') || has0('security.vpd_policies') || has0('security.rcac_controls')) { glob.sec_rls = (s('security.rls_policy_count', 'security.vpd_policies', 'security.rcac_controls') > 20) ? 'complex' : 'basic'; }
    if (has0('security.masked_column_count') || has0('security.redaction_policies')) glob.sec_masking = 'yes';

    // feature detection
    const F = (k, cond) => { if (cond) feats.add(k); };
    if (platform === 'mssql') {
      F('cursors', has0('code.cursor_objects')); F('triggers', has0('inventory.trigger_count')); F('sequences', has0('inventory.sequence_count'));
      F('synonyms', has0('inventory.synonym_count')); F('linked_servers', has0('inventory.linked_server_count') || has0('code.remote_query_objects') || has0('code.remote_server_objects'));
      F('clr', has0('inventory.clr_assembly_count')); F('service_broker', has0('inventory.service_queue_count'));
      F('xml', has0('code.xml_objects') || has0('types.col_xml')); F('spatial', has0('types.col_geography') || has0('types.col_geometry'));
      F('temporal', has0('inventory.temporal_table_count')); F('mviews', has0('inventory.indexed_view_count')); F('cross_db', has0('code.cross_db_objects'));
      F('dynamic_sql', has0('code.dynamic_sql_objects')); F('agent_jobs', has0('etl.agent_jobs')); F('ssis', etlTools.has('ssis')); F('ssrs', biTools.has('ssrs'));
      F('cdc', has0('cdc.cdc_enabled_dbs')); F('always_encrypted', has0('security.encrypted_column_count')); F('rls', has0('security.rls_policy_count'));
      F('ddm', has0('security.masked_column_count')); F('fulltext', has0('inventory.fulltext_index_count')); F('inmemory', has0('inventory.memory_optimized_table_count'));
      F('unicode', has0('types.col_nvarchar') || has0('types.col_nchar') || has0('types.col_ntext'));
      F('legacy_types', has0('types.col_datetime') || has0('types.col_smalldatetime') || has0('types.col_money') || has0('types.col_tinyint') || has0('types.col_datetimeoffset'));
      F('hierarchyid', has0('types.col_hierarchyid') || has0('types.col_sql_variant'));
    } else if (platform === 'oracle') {
      F('plsql_packages', has0('inventory.package_count')); F('triggers', has0('inventory.trigger_count')); F('sequences', has0('inventory.sequence_count'));
      F('synonyms', has0('inventory.synonym_count')); F('dblinks', has0('inventory.dblink_count')); F('mviews', has0('inventory.mview_count'));
      F('connect_by', has0('code.connect_by_objects') || has0('code.connect_by_views')); F('autonomous_tx', has0('code.autonomous_tx_objects'));
      F('bulk', has0('code.bulk_objects')); F('utl', has0('code.utl_objects')); F('object_types', has0('inventory.type_count') || has0('types.udt_columns'));
      F('number_noprec', has0('types.number_noprecision_columns')); F('lobs', has0('types.lob_columns')); F('xml', has0('types.xml_columns'));
      F('spatial', has0('types.spatial_columns')); F('partitioning', has0('inventory.partitioned_table_count')); F('vpd', has0('security.vpd_policies'));
      F('redaction', has0('security.redaction_policies')); F('scheduler', has0('etl.scheduler_jobs')); F('gtt', has0('inventory.gtt_count'));
      F('wrapped', has0('code.wrapped_objects')); F('java', has0('inventory.java_class_count')); F('cursors', has0('code.cursor_objects') || has0('code.refcursor_objects'));
    } else if (platform === 'teradata') {
      F('macros', has0('inventory.macro_count')); F('spl', has0('inventory.proc_count')); F('qualify', has0('code.qualify_objects'));
      F('recursive', has0('code.recursive_objects')); F('volatile', has0('code.volatile_table_objects')); F('join_indexes', has0('inventory.join_index_count') || has0('inventory.hash_index_count'));
      F('ppi', has0('inventory.ppi_table_count')); F('period', has0('types.period_columns')); F('json_xml', has0('types.json_columns') || has0('types.xml_columns'));
      F('spatial', has0('types.spatial_columns')); F('not_casespecific', has0('types.not_casespecific_columns')); F('udfs', has0('inventory.function_count'));
      F('triggers', has0('inventory.trigger_count')); F('cursors', has0('code.cursor_objects')); F('set_tables', has0('code.set_table_explicit'));
      F('tpt', feats.has('tpt'));
    } else if (platform === 'db2luw' || platform === 'db2zos' || platform === 'db2i') {
      F('sqlpl', has0('inventory.proc_count') || has0('inventory.native_sql_proc_count')); F('triggers', has0('inventory.trigger_count')); F('sequences', has0('inventory.sequence_count'));
      F('mviews', has0('inventory.mqt_count')); F('graphic', has0('types.graphic_columns')); F('decfloat', has0('types.decfloat_columns')); F('ts12', has0('types.ts_precision_columns'));
      F('xml', has0('types.xml_columns')); F('federation', has0('inventory.nickname_count') || has0('inventory.federated_server_count'));
      F('rcac', has0('security.rcac_controls') || has0('security.lbac_policies')); F('dpf', (n('platform.db_partitions') || 0) > 1); F('blu', has0('inventory.column_organized_table_count'));
      F('external_routines', has0('inventory.external_routine_count')); F('cursors', has0('code.cursor_objects'));
      if (platform === 'db2zos') { F('ebcdic', has0('types.ebcdic_tables')); F('cobol', has0('inventory.package_count')); feats.add('jcl'); }
      if (platform === 'db2i') { F('dds', has0('inventory.dds_physical_file_count') || has0('inventory.logical_file_count')); F('rpg', has0('inventory.program_count')); F('journaling', has0('cdc.journaled_files')); F('packed', has0('types.packed_decimal_columns') || has0('types.zoned_decimal_columns')); F('ebcdic', has0('types.ebcdic_char_columns')); }
    } else if (platform === 'sap_hana') {
      F('calc_views', has0('inventory.calc_view_count')); F('sqlscript', has0('inventory.proc_count'));
    } else if (platform === 'snowflake') {
      const lang = (pre, ls) => ls.some((l) => has0('code.' + pre + l));
      F('sf_variant', has0('types.semi_structured_columns')); F('sf_flatten', has0('code.flatten_views')); F('sf_streams_tasks', has0('code.stream_objects') || has0('etl.scheduler_jobs'));
      F('sf_snowpipe', has0('inventory.pipe_count')); F('sf_scripting', has0('code.proc_language_sql')); F('sf_js_proc', lang('proc_language_', ['javascript', 'python', 'java', 'scala']) || lang('function_language_', ['javascript', 'python', 'java', 'scala']));
      F('sf_dynamic', has0('inventory.dynamic_table_count')); F('mviews', has0('inventory.mview_count')); F('sf_secure_views', has0('inventory.secure_view_count'));
      F('sf_sharing', has0('inventory.shared_database_count')); F('sf_iceberg', has0('inventory.iceberg_table_count')); F('ext_tables', has0('inventory.external_table_count') || has0('inventory.external_stage_count'));
      F('sf_tz', has0('types.tz_columns')); F('sf_snowpark', has0('code.cortex_objects') || has0('code.proc_language_python')); F('sequences', has0('inventory.sequence_count'));
      F('rls', has0('security.rls_policy_count')); F('ddm', has0('security.masked_column_count')); F('spatial', has0('types.spatial_columns'));
      if (has0('inventory.iceberg_table_count')) notes.push('Iceberg tables can be read in place through OneLake shortcuts instead of being copied.');
    } else if (platform === 'databricks') {
      F('dbx_delta', has0('inventory.table_count')); feats.add('dbx_notebooks'); F('dbx_jobs', has0('etl.scheduler_jobs')); F('dbx_dlt', has0('etl.pipeline_count') || has0('inventory.streaming_table_count'));
      F('dbx_streaming', has0('inventory.streaming_table_count')); F('dbx_uc', has0('security.rls_policy_count') || has0('security.masked_column_count')); F('dbx_mlflow', has0('code.ml_model_count'));
      F('dbx_hms', has0('inventory.hive_metastore_tables')); F('dbx_non_delta', has0('inventory.non_delta_table_count')); F('mviews', has0('inventory.mview_count'));
      F('udfs', has0('code.python_function_count')); F('ext_tables', has0('inventory.external_table_count')); F('bq_nested', has0('types.nested_columns'));
      if (n('size.tables_sized') != null && n('inventory.table_count') != null && n('size.tables_sized') < n('inventory.table_count')) notes.push('Size measured for ' + fmtInt(n('size.tables_sized')) + ' of ' + fmtInt(n('inventory.table_count')) + ' tables (Delta tables only, up to the script limit).');
    } else if (platform === 'redshift') {
      F('rs_plpgsql', has0('inventory.proc_count')); F('rs_super', has0('types.super_columns')); F('rs_spectrum', has0('inventory.external_schema_count') || has0('inventory.external_table_count'));
      F('rs_datashare', has0('inventory.datashare_count')); F('rs_pyudf', has0('code.python_udf_count') || has0('code.lambda_udf_count')); F('rs_dist', has0('inventory.distkey_table_count'));
      F('rs_federated', has0('inventory.federated_schema_count')); F('wlm', (n('workload.wlm_queue_count') || 0) > 1); F('mviews', has0('inventory.mview_count'));
      F('spatial', has0('types.spatial_columns')); F('sf_tz', has0('types.tz_columns')); F('rls', has0('security.rls_policy_count')); F('ddm', has0('security.masked_column_count'));
      notes.push('Redshift keeps about 7 days of query history: queries per day are averaged over that window.');
    } else if (platform === 'bigquery') {
      F('bq_nested', has0('types.nested_columns')); F('bq_json', has0('types.json_columns')); F('bq_scripting', has0('inventory.proc_count')); F('bq_js_udf', has0('code.js_function_count') || has0('code.remote_function_count'));
      F('bq_scheduled', has0('etl.scheduler_jobs')); F('bq_ml', has0('code.ml_model_queries')); F('bq_partition', has0('inventory.partitioned_table_count'));
      F('bq_policy', has0('security.rls_policy_count') || has0('security.masked_column_count')); F('bq_streaming', has0('workload.streaming_tables')); F('mviews', has0('inventory.mview_count'));
      F('ext_tables', has0('inventory.external_table_count')); F('spatial', has0('types.spatial_columns'));
    } else if (platform === 'postgres' || platform === 'greenplum') {
      const ext = Object.keys(M).filter((k) => k.indexOf('inventory.extension_') === 0);
      F('pg_plpgsql', has0('code.language_plpgsql')); F('triggers', has0('inventory.trigger_count')); F('sequences', has0('inventory.sequence_count')); F('mviews', has0('inventory.mview_count'));
      F('pg_extensions', ext.length > 0); F('spatial', ext.some((k) => /postgis/.test(k)) || has0('types.spatial_columns')); F('pg_arrays', has0('types.json_columns') || has0('types.array_columns') || has0('types.user_defined_columns'));
      F('pg_inherit', (n('inventory.inherited_table_count') || 0) > (n('inventory.partitioned_table_count') || 0)); F('pg_fdw', has0('inventory.fdw_server_count') || has0('inventory.foreign_table_count'));
      F('partitioning', has0('inventory.partitioned_table_count')); F('recursive', has0('code.recursive_views')); F('dynamic_sql', has0('code.dynamic_sql_objects')); F('rls', has0('security.rls_policy_count')); F('sf_tz', has0('types.tz_columns'));
      if (platform === 'greenplum') { feats.add('gp_dist'); F('ext_tables', has0('inventory.external_table_count')); }
      if (ext.length) notes.push('Extensions in use: ' + ext.map((k) => k.replace('inventory.extension_', '')).join(', ') + '.');
      notes.push('PostgreSQL catalogs are per database: run the script in each database in scope and import each file into the same system.');
    } else if (platform === 'mysql') {
      F('my_procs', has0('inventory.proc_count')); F('triggers', has0('inventory.trigger_count')); F('my_events', has0('etl.scheduler_jobs')); F('cursors', has0('code.cursor_objects'));
      F('bq_json', has0('types.json_columns')); F('my_enum', has0('types.enum_set_columns')); F('my_unsigned', has0('types.unsigned_columns')); F('spatial', has0('types.spatial_columns'));
      F('fulltext', has0('inventory.fulltext_index_count')); F('partitioning', has0('inventory.partitioned_table_count')); F('my_myisam', has0('inventory.non_innodb_table_count'));
    } else if (platform === 'vertica') {
      feats.add('vt_projections'); F('vt_flex', has0('inventory.flex_table_count')); F('udfs', has0('code.udx_count')); F('db_ml', has0('code.ml_model_count')); F('sequences', has0('inventory.sequence_count'));
      F('ext_tables', has0('inventory.external_table_count')); F('spatial', has0('types.spatial_columns')); F('sf_tz', has0('types.tz_columns')); F('rls', has0('security.rls_policy_count')); F('ddm', has0('security.masked_column_count'));
    } else if (platform === 'exasol') {
      F('ex_scripts', has0('code.udf_script_count')); F('generic_procs', has0('inventory.proc_count')); F('ex_virtual', has0('inventory.virtual_schema_count') || has0('inventory.connection_count'));
      F('spatial', has0('types.geometry_columns')); F('udfs', has0('inventory.function_count'));
    } else if (platform === 'clickhouse') {
      F('ch_engines', has0('inventory.special_engine_tables')); F('ch_mviews', has0('inventory.mview_count')); F('ch_dicts', has0('inventory.dictionary_count'));
      F('ch_complex', has0('types.complex_columns') || has0('types.lowcardinality_columns')); F('kafka_engine', has0('inventory.kafka_table_count')); F('udfs', has0('inventory.function_count'));
    } else if (platform === 'hive') {
      feats.add('hv_hql'); F('hv_formats', has0('types.format_orc') || has0('types.format_avro') || has0('types.format_text') || has0('types.format_sequence'));
      F('hv_udfs', has0('inventory.function_count')); F('hv_hbase', has0('inventory.hbase_kudu_table_count')); F('hv_acid', has0('inventory.acid_table_count'));
      F('ext_tables', has0('inventory.external_table_count')); F('bq_nested', has0('types.complex_columns'));
      const fmts = Object.keys(M).filter((k) => k.indexOf('types.format_') === 0 && has0(k)).map((k) => k.replace('types.format_', '') + ' ' + fmtInt(n(k)));
      if (fmts.length) notes.push('Table formats: ' + fmts.join(', ') + '.');
    } else if (platform === 'synapse') {
      F('mviews', has0('inventory.mview_count')); F('dynamic_sql', has0('code.dynamic_sql_objects')); F('rls', has0('security.rls_policy_count')); F('ddm', has0('security.masked_column_count'));
      F('unicode', has0('types.col_nvarchar')); F('legacy_types', has0('types.col_datetime')); F('sy_polybase', has0('inventory.external_table_count')); F('sy_ctas', has0('code.ctas_objects'));
      F('wlm', has0('workload.workload_group_count'));
    } else if (platform === 'netezza') {
      F('nzplsql', has0('inventory.proc_count')); F('mviews', has0('inventory.mview_count')); F('udx', has0('code.udx_count')); F('sequences', has0('inventory.sequence_count'));
      F('synonyms', has0('inventory.synonym_count')); F('nzload', has0('inventory.external_table_count')); feats.add('distkeys'); feats.add('zonemaps');
    } else if (platform === 'other') {
      F('generic_procs', has0('inventory.proc_count')); F('udfs', has0('inventory.function_count')); F('pg_arrays', has0('types.complex_columns') || has0('types.json_xml_columns'));
      notes.push('The generic script does not measure size or workload: enter them by hand.');
    }

    // SAP
    if (fam === 'sap_erp') {
      const custom = s('sap.custom_tabl', 'sap.custom_view', 'sap.custom_ddls');
      const customProg = s('sap.custom_prog', 'sap.custom_fugr', 'sap.custom_clas');
      if (custom != null || customProg != null) { set('s_sap_custom', Math.round((custom || 0) * 0.25 + (customProg || 0) * 0.02)); notes.push('Custom objects in analytics scope estimated as 25% of custom tables/views/CDS plus 2% of custom programs.'); }
      if (n('sap.tables_in_scope') != null) set('s_sap_tables', n('sap.tables_in_scope'));
      if (n('sap.active_datasources') != null) { set('s_sap_extractors', Math.round(n('sap.active_datasources') * 0.1)); notes.push('Extractors in scope estimated as 10% of active DataSources; adjust to the real analytics scope.'); }
      F('custom_z', has0('sap.custom_tabl')); F('cds', has0('sap.custom_ddls'));
      if (String(M['sap.slt_in_use'] || '').toLowerCase().indexOf('y') === 0) feats.add('slt');
      if (has0('sap.odp_third_party_subscribers')) notes.push('ODQMON shows non-SAP ODP subscribers: review against SAP Note 3255746.');
      const mods = new Set();
      String(M['sap.modules'] || '').toLowerCase().split(/[;, ]+/).forEach((x) => { if (KB.SAP_MODULE_TABLES[x]) mods.add(x); });
      (parsed.tops || []).forEach((t) => { const nm = String(t.name).toUpperCase().split('.').pop(); KB.SAP_TABLE_HINTS.forEach(([re, ms]) => { if (re.test(nm)) ms.forEach((m) => mods.add(m)); }); });
      if (mods.size) { fields.s_modules = Array.from(mods); if (!M['sap.modules']) notes.push('Modules inferred from the largest SAP tables.'); }
      if (M['platform.db']) fields.s_sap_db = String(M['platform.db']).toLowerCase();
    }
    if (fam === 'sap_bw') {
      const prov = s('bw.infocubes', 'bw.adsos', 'bw.classic_dsos', 'bw.composite_providers', 'bw.infoproviders');
      set('s_bw_providers', prov); set('s_bw_queries', n('bw.queries')); set('s_bw_chains', n('bw.process_chains'));
      set('s_bw_transforms', n('bw.transformations')); if (n('bw.datasources') != null) set('s_sap_extractors', n('bw.datasources'));
      F('composite', has0('bw.composite_providers')); F('openhub', has0('bw.open_hub_destinations'));
      if (M['platform.db']) fields.s_sap_db = String(M['platform.db']).toLowerCase();
    }
    if (feats.size) fields.s_features = Array.from(feats);
    return { fields, global: glob, notes, tops: parsed.tops || [], apps: parsed.apps || [], errors: parsed.errors || [] };
  };

  function prettyVersion(platform, v, M) {
    v = String(v).trim();
    if (platform === 'mssql') {
      const major = parseInt(v.split('.')[0], 10);
      const yr = { 11: '2012', 12: '2014', 13: '2016', 14: '2017', 15: '2019', 16: '2022', 17: '2025' }[major];
      const ed = M['platform.edition'] ? ' ' + String(M['platform.edition']).replace(/\(64-bit\)/i, '').trim() : '';
      return (yr ? 'SQL Server ' + yr : 'SQL Server ' + v) + ed + ' (' + v + ')';
    }
    if (platform === 'oracle') { const major = v.split('.')[0]; return 'Oracle ' + (parseInt(major, 10) >= 12 ? major + 'c' : major + 'g') + ' (' + v + ')'; }
    if (platform === 'teradata') return 'Teradata ' + v;
    return v;
  }
  E.sqlServerMajor = (txt) => { const m = String(txt || '').match(/(20\d\d)/); if (m) return parseInt(m[1], 10); const n2 = String(txt || '').match(/\((\d+)\./); return n2 ? ({ 11: 2012, 12: 2014, 13: 2016, 14: 2017, 15: 2019, 16: 2022, 17: 2025 }[n2[1]] || null) : null; };

  /* Apply a mapped discovery result to a system (and estate-wide suggestions) */
  E.applyDiscovery = (state, sys, mapped, meta, opts) => {
    const pick = opts && opts.pick; // optional set of field ids to apply
    Object.keys(mapped.fields).forEach((id) => {
      if (pick && !pick[id]) return;
      const cur = sys.a[id];
      if (cur && (cur.src === 'user' || cur.src === 'val') && !(opts && opts.overwrite)) return;
      sys.a[id] = { v: mapped.fields[id], src: 'disc', ts: Date.now() };
    });
    Object.keys(mapped.global).forEach((id) => {
      if (pick && !pick['g:' + id]) return;
      const cur = state.g[id]; const v = mapped.global[id];
      if (cur && (cur.src === 'user' || cur.src === 'val')) {
        if (Array.isArray(cur.v) && Array.isArray(v)) { const u = Array.from(new Set(cur.v.concat(v))); if (u.length !== cur.v.length) state.g[id] = { v: u, src: cur.src, ts: Date.now() }; }
        return;
      }
      if (cur && cur.src === 'disc' && Array.isArray(cur.v) && Array.isArray(v)) state.g[id] = { v: Array.from(new Set(cur.v.concat(v))), src: 'disc', ts: Date.now() };
      else state.g[id] = { v, src: 'disc', ts: Date.now() };
    });
    sys.disc = Object.assign({}, sys.disc || {}, meta || {}, { tops: (mapped.tops || []).slice(0, 25), apps: (mapped.apps || []).slice(0, 30), notes: mapped.notes, errors: (mapped.errors || []).slice(0, 30), at: new Date().toISOString() });
  };

  /* ---------- analysis ---------- */
  const GAPW = { none: 0, low: 1, medium: 3, high: 6 };
  const TIER = (sc) => (sc < 30 ? 'Low' : sc < 50 ? 'Medium' : sc < 70 ? 'High' : 'Very high');

  function systemFacts(c, s) {
    const p = PLAT(s); const fam = p.fam; const v = (id) => c.sv(s, id);
    const f = { fam, p, tb: v('s_data_tb') || 0, role: v('s_role'), scope: v('s_scope'), latency: v('s_latency') || 'daily', deploy: v('s_deploy'), queries: v('s_queries') || 0, users: v('s_users') || 0, conc: v('s_concurrency') || 0, largestGb: v('s_largest_gb') || 0, features: (v('s_features') || []).filter((k) => KB.FEAT[k]), growth: v('s_growth') || 0 };
    if (fam === 'db' || fam === 'hana') {
      f.tables = v('s_tables') || 0; f.views = v('s_views') || 0; f.procs = v('s_procs') || 0; f.funcs = v('s_funcs') || 0; f.triggers = v('s_triggers') || 0;
      f.calc = fam === 'hana' ? (v('s_hana_calcviews') || 0) : 0; f.loc = v('s_loc') || 0; f.types = v('s_types') || 0; f.codeMix = v('s_code_mix') || 'balanced';
      f.objects = f.tables + f.views + f.procs + f.funcs + f.triggers + f.calc; f.codeObjs = f.procs + f.funcs + f.triggers + f.calc;
    } else if (fam === 'sap_erp') {
      f.sapTables = v('s_sap_tables') || 0; f.extractors = v('s_sap_extractors') || 0; f.custom = v('s_sap_custom') || 0; f.modules = v('s_modules') || [];
      f.objects = f.sapTables + f.extractors + f.custom; f.loc = f.custom * 40; f.codeObjs = Math.round(f.custom * 0.3); f.tables = f.sapTables; f.views = 0; f.procs = 0; f.triggers = 0; f.types = 0;
      f.extract = v('s_sap_extract') || []; f.datasphere = v('s_datasphere'); f.bdc = v('s_bdc'); f.s4 = s.platform === 'sap_ecc' ? v('s_s4') : 'done';
    } else if (fam === 'sap_bw') {
      f.providers = v('s_bw_providers') || 0; f.bwQueries = v('s_bw_queries') || 0; f.chains = v('s_bw_chains') || 0; f.transforms = v('s_bw_transforms') || 0; f.extractors = v('s_sap_extractors') || 0; f.abap = v('s_bw_abap') || 'medium';
      f.objects = f.providers + f.bwQueries + f.chains + f.transforms + f.extractors; f.loc = f.transforms * ({ low: 20, medium: 60, high: 150 }[f.abap] || 60); f.codeObjs = f.transforms + f.bwQueries;
      f.tables = f.providers; f.views = 0; f.procs = 0; f.triggers = 0; f.types = 0;
      f.extract = v('s_sap_extract') || []; f.datasphere = v('s_datasphere'); f.bdc = v('s_bdc');
    }
    return f;
  }

  function complexity(f) {
    const featScore = sum(f.features.map((k) => GAPW[KB.FEAT[k].gap] || 0));
    const fx = {
      volume: clamp(Math.log10(f.tb + 1) / Math.log10(301), 0, 1),
      objects: clamp((Math.log10(f.objects + 1) - 2) / 3, 0, 1),
      code: clamp((Math.log10(f.loc + 1) - 3) / 3.5, 0, 1),
      features: clamp(featScore / 30, 0, 1),
      platform: f.p.base,
      types: (f.fam === 'db' || f.fam === 'hana') ? clamp((f.types / Math.max(1, f.tables * 25)) * 4, 0, 1) : 0.3,
      latency: { daily: 0.1, hourly: 0.4, near_rt: 0.7, rt: 1 }[f.latency] || 0.1,
      workload: clamp((Math.log10(f.queries + 1) - 3) / 3.3, 0, 1)
    };
    const W = { volume: 0.15, objects: 0.12, code: 0.2, features: 0.15, platform: 0.15, types: 0.05, latency: 0.08, workload: 0.1 };
    const LBL = { volume: 'Data volume', objects: 'Object count', code: 'Procedural code', features: 'Proprietary features', platform: 'Platform difficulty', types: 'Data type mapping', latency: 'Freshness needs', workload: 'Query workload' };
    const parts = Object.keys(W).map((k) => ({ k, label: LBL[k], f: fx[k], pts: 100 * W[k] * fx[k], max: 100 * W[k] }));
    const score = Math.round(sum(parts.map((x) => x.pts)));
    return { score, tier: TIER(score), parts, drivers: parts.slice().sort((a, b) => b.pts - a.pts).slice(0, 3).map((x) => x.label) };
  }

  function overallStrategy(c, prelim) {
    const chosen = c.gv('tgt_strategy');
    if (chosen && chosen !== 'recommend') return { key: chosen, why: 'Chosen in target preferences' };
    const drivers = c.gv('org_drivers') || [];
    const dl = c.gv('org_deadline');
    if (dl && dl !== 'none' && prelim && prelim.monthsToDeadline != null && prelim.monthsToDeadline < prelim.months * 1.1) return { key: 'lift', why: 'The hard deadline leaves little room for redesign' };
    if (drivers.indexOf('ai') >= 0 && ['medium', 'high'].indexOf(c.gv('ops_skill_spark')) >= 0) return { key: 'modernize', why: 'AI ambition with Spark skills in the team' };
    return { key: 'replatform', why: 'Balances speed with modernization where it pays back' };
  }

  function computePref(c, f) {
    const chosen = c.gv('tgt_compute');
    if (chosen && chosen !== 'recommend') return chosen;
    const sqlHeavy = (f.loc || 0) > 20000 || (f.procs || 0) > 100;
    const ds = (c.gv('bi_ds') || []).filter((x) => x !== 'none').length > 0 || ['agents', 'ml'].indexOf(c.gv('bi_ai')) >= 0;
    if (f.fam === 'sap_erp' || f.fam === 'sap_bw') return 'both';
    if (sqlHeavy && c.gv('ops_skill_sql') !== 'low') return ds ? 'both' : 'warehouse';
    return ds || c.gv('ops_skill_spark') === 'high' ? 'lakehouse' : 'both';
  }

  const ON_PREM = ['onprem', 'appliance', 'mainframe'];

  function pattern(c, s, f, strat) {
    const plat = s.platform; const offload = f.scope === 'offload' || f.scope === 'replicate';
    const cp = computePref(c, f);
    const tgt = cp === 'warehouse' ? 'Fabric Warehouse' : cp === 'lakehouse' ? 'Fabric Lakehouse' : 'Lakehouse (Bronze/Silver) + Warehouse (Gold)';
    const gw = ON_PREM.indexOf(f.deploy) >= 0 ? 'On-premises data gateway' : (f.deploy === 'iaas' ? 'On-premises or virtual network data gateway' : null);
    const P = { id: '', name: '', ingest: [], target: tgt, code: '', tools: [], prereqs: [], notes: [], items: [], quickWin: false, mirror: false };
    if (gw) P.items.push(gw);
    const ver = String(c.sv(s, 's_version') || '');
    if (plat === 'mssql') {
      const y = E.sqlServerMajor(ver);
      if (offload || f.role === 'oltp' || f.role === 'replica') {
        Object.assign(P, { id: 'mirror', name: 'Mirror into OneLake, then build the medallion', quickWin: true, mirror: true });
        P.ingest.push('Mirroring for SQL Server (generally available for SQL Server 2016–2022 and 2025) keeps tables in sync in near real time.');
        P.prereqs.push(y && y < 2016 ? 'Version ' + y + ' is below 2016: upgrade, or use Copy job incremental loads instead of mirroring.' : 'SQL Server 2016–2022 mirroring relies on CDC: enable it on the source databases.');
      } else {
        Object.assign(P, { id: 'migrate_wh', name: 'Re-platform to Fabric Warehouse with the Migration Assistant' });
        P.ingest.push('Fabric Migration Assistant for Data Warehouse translates schema and T-SQL objects; AI-assisted fixes need Copilot enabled.', 'Copy job for the historical load; mirroring can keep data in sync during the parallel run.');
        P.code = 'T-SQL stays T-SQL: fix the Fabric Warehouse surface-area gaps (no triggers, cursors, sequences or materialized views; nvarchar/datetime/money mapped).';
      }
      P.tools.push('Fabric Migration Assistant', 'Mirroring for SQL Server', 'Copy job');
      if ((c.gv('etl_tools') || []).indexOf('ssis') >= 0) P.notes.push('SSIS: run packages with the Invoke SSIS Package activity (preview) as a bridge, then re-platform to pipelines and Dataflow Gen2.');
      if ((c.gv('bi_tools') || []).indexOf('ssrs') >= 0) P.notes.push('SSRS reports move to Power BI paginated reports.');
      if ((c.gv('bi_tools') || []).some((x) => x === 'ssas_tab' || x === 'ssas_md')) P.notes.push('SSAS models move to Power BI semantic models (Direct Lake where possible).');
    } else if (plat === 'synapse') {
      Object.assign(P, { id: 'migrate_wh', name: 'Upgrade to Fabric Warehouse with the Migration Assistant', quickWin: true });
      P.ingest.push('Migration Assistant (Azure Synapse dedicated SQL pool tile) or a DACPAC for metadata; Copy job for data.');
      P.code = 'T-SQL stays T-SQL; review CTAS patterns, workload management and materialized views.';
      P.tools.push('Fabric Migration Assistant', 'Copy job', 'Fabric Data Factory');
    } else if (plat === 'oracle') {
      if (offload) {
        Object.assign(P, { id: 'mirror', name: 'Mirror Oracle into OneLake, then build the medallion', mirror: true, quickWin: true });
        P.ingest.push('Mirroring for Oracle (Oracle 11 and later, through the on-premises data gateway) or Copy job CDC.');
        P.prereqs.push('Enable ARCHIVELOG mode and LogMiner; give unconstrained NUMBER columns an explicit precision.');
      } else {
        Object.assign(P, { id: 'migrate', name: 'Migrate to Fabric and convert PL/SQL' });
        P.ingest.push('Historical load with Copy job or pipelines (parallel extraction per partition through the gateway).', 'Mirroring for Oracle keeps data in sync during the parallel run.');
        P.code = cp === 'lakehouse' ? 'PL/SQL to PySpark / Spark SQL notebooks; redesign package state and exceptions.' : 'PL/SQL to T-SQL procedures: use SSMA for Oracle as a starting point, then AI-assisted conversion and fixes for the Fabric Warehouse surface area.';
      }
      P.tools.push('Mirroring for Oracle', 'Copy job', 'SSMA for Oracle (conversion aid)', 'Oracle GoldenGate 23ai (open mirroring, optional)');
    } else if (plat === 'teradata') {
      Object.assign(P, { id: 'migrate', name: 'Migrate Teradata to Fabric (bulk export + convert SQL and BTEQ)' });
      P.ingest.push('Largest tables: export with TPT to Parquet/CSV files, land in OneLake (or ADLS Gen2 with a shortcut) and load with COPY INTO.', 'Remaining tables and increments: Copy job or pipelines with the Teradata connector through the gateway.', 'Continuous sync during the parallel run: partner CDC through open mirroring (for example Qlik Replicate) if needed.');
      P.code = 'Teradata SQL to T-SQL (QUALIFY is supported natively); BTEQ scripts to pipelines calling procedures or notebooks; macros to procedures; SET-table and case-insensitive semantics handled explicitly.';
      P.tools.push('Copy job', 'Fabric pipelines', 'COPY INTO', 'AI-assisted code conversion');
    } else if (plat === 'db2luw') {
      if (offload) { Object.assign(P, { id: 'cdc_offload', name: 'Replicate Db2 into OneLake for analytics', mirror: true }); P.ingest.push('Open mirroring partners with Db2 CDC (for example Qlik Replicate or QMigrator), or scheduled Copy job full loads through the gateway.'); }
      else { Object.assign(P, { id: 'migrate', name: 'Migrate Db2 to Fabric and convert SQL PL' }); P.ingest.push('Copy job / pipelines with the IBM Db2 connector through the gateway for the historical load.'); P.code = 'SQL PL to T-SQL; SSMA for Db2 can produce a T-SQL starting point.'; }
      P.tools.push('IBM Db2 connector', 'Copy job', 'SSMA for Db2 (conversion aid)');
    } else if (plat === 'db2zos') {
      Object.assign(P, { id: 'cdc_offload', name: 'Offload mainframe data to OneLake with CDC', mirror: true });
      P.ingest.push('Partner CDC with open mirroring (for example Qlik Replicate supports Db2 for z/OS), or batch extracts with the Db2 connector outside the online window.', 'VSAM/sequential files need copybook-aware conversion before landing.');
      P.code = 'Applications stay on the mainframe; only analytics logic is rebuilt in Fabric.';
      P.prereqs.push('Enable DATA CAPTURE CHANGES on source tables for log-based CDC; plan MIPS impact with the mainframe team.');
      P.tools.push('Open mirroring partner (Db2 z/OS CDC)', 'IBM Db2 connector');
    } else if (plat === 'db2i') {
      Object.assign(P, { id: 'cdc_offload', name: 'Offload IBM i data to OneLake with CDC', mirror: true });
      P.ingest.push('Partner CDC with open mirroring from journals (for example Stelo supports Db2 for i), or Copy job full loads with the Db2 connector.');
      P.code = 'RPG/COBOL logic stays on IBM i; analytics logic is rebuilt in Fabric.';
      P.tools.push('Open mirroring partner (Db2 for i)', 'IBM Db2 connector');
    } else if (plat === 'netezza') {
      Object.assign(P, { id: 'migrate', name: 'Migrate Netezza to Fabric' });
      P.ingest.push('Export tables to files (external tables / nzsql) and load with COPY INTO, or use a partner migration tool.');
      P.code = 'NZPLSQL to T-SQL procedures; distribution keys and zone maps are not needed.';
      P.tools.push('COPY INTO', 'Fabric pipelines');
    } else if (plat === 'sap_ecc' || plat === 'sap_s4') {
      if (f.bdc === 'adopted') { Object.assign(P, { id: 'sap_bdc', name: 'Share SAP data products with SAP BDC Connect for Microsoft Fabric' }); P.ingest.push('SAP Business Data Cloud Connect for Microsoft Fabric shares SAP data products with OneLake without copying (general availability was planned for Q3 2026: confirm availability).'); }
      else if (f.datasphere === 'licensed' || f.datasphere === 'planned') { Object.assign(P, { id: 'sap_datasphere', name: 'Mirroring for SAP through SAP Datasphere', mirror: true }); P.ingest.push('Mirroring for SAP: SAP Datasphere replication flows write to ADLS Gen2 and Fabric mirrors them into OneLake (Datasphere Premium Outbound Integration pricing applies).'); }
      else { Object.assign(P, { id: 'sap_partner', name: 'Replicate SAP with an SAP-certified partner (open mirroring)', mirror: true }); P.ingest.push('SAP-certified partners integrated with open mirroring: Theobald Xtract Universal, dab Nexus, Simplement Roundhouse, AecorSoft, ASAPIO, CData Sync, Qlik.', 'Alternative: adopt SAP Datasphere and use Mirroring for SAP.'); }
      P.code = 'Rebuild SAP business semantics in Silver/Gold: currency and unit conversion, hierarchies, texts and organizational security.';
      P.prereqs.push('Do not build new extraction on ODP-RFC (SAP Note 3255746): use Datasphere, BDC, ODP-OData or a certified partner that does not rely on ODP-RFC.');
      if (plat === 'sap_ecc' && f.s4 === 'inflight') P.notes.push('S/4HANA program in flight: design extraction on S/4HANA CDS views and schedule this wave after the S/4HANA cutover.');
      P.tools.push('Mirroring for SAP (Datasphere)', 'Copy job (Datasphere outbound)', 'Open mirroring partners');
    } else if (plat === 'sap_bw' || plat === 'sap_bw4') {
      const coexist = strat.key === 'lift' || (c.systems.some((x) => x.platform === 'sap_ecc' && c.sv(x, 's_s4') === 'inflight'));
      if (coexist) {
        Object.assign(P, { id: 'bw_coexist', name: 'Coexist first: report from BW, then retire it' });
        P.ingest.push('Phase 1: Power BI and Dataflow Gen2 read BW queries through the SAP BW connector (or through Datasphere).', 'Phase 2: replicate source ERP data into Fabric and rebuild BW logic before BW support ends.');
      } else {
        Object.assign(P, { id: 'bw_rebuild', name: 'Rebuild BW logic in Fabric from replicated SAP sources' });
        P.ingest.push('Replicate source ERP tables/extractors (Datasphere mirroring or certified partner), rebuild ADSO/transformation logic as Silver/Gold.');
      }
      P.code = 'Transformations and ABAP routines to Spark SQL / T-SQL; BEx queries (RKF/CKF, variables) to DAX measures in semantic models; process chains to pipelines.';
      if (plat === 'sap_bw') P.notes.push('SAP BW 7.5 mainstream maintenance ends 31 December 2027 (extended maintenance to 2030).');
      P.tools.push('SAP BW connector (Dataflow Gen2)', 'Mirroring for SAP (Datasphere)', 'Fabric pipelines', 'Power BI semantic models');
    } else if (plat === 'sap_hana') {
      Object.assign(P, { id: 'migrate', name: 'Migrate HANA native models to Fabric' });
      P.ingest.push('SAP HANA connector (Dataflow Gen2 / pipelines through the gateway) or partner CDC for continuous sync.');
      P.code = 'Calculation views to Warehouse views or semantic models; SQLScript to T-SQL or PySpark.';
      P.prereqs.push('Confirm the HANA licence allows direct extraction (runtime licences restrict it).');
      P.tools.push('SAP HANA connector', 'Copy job / pipelines');
    } else if (plat === 'azure_sql') {
      if (offload || f.role === 'oltp' || f.role === 'replica') {
        Object.assign(P, { id: 'mirror', name: 'Mirror Azure SQL into OneLake, then build the medallion', quickWin: true, mirror: true });
        P.ingest.push('Mirroring for Azure SQL Database / Managed Instance keeps tables in sync in near real time, with no pipelines.');
      } else {
        Object.assign(P, { id: 'migrate_wh', name: 'Re-platform to Fabric Warehouse with the Migration Assistant' });
        P.ingest.push('Fabric Migration Assistant for Data Warehouse (DACPAC) translates schema and T-SQL objects.', 'Mirroring keeps data in sync during the parallel run.');
        P.code = 'T-SQL stays T-SQL: fix the Fabric Warehouse surface-area gaps (no triggers, cursors, sequences or materialized views).';
      }
      P.tools.push('Mirroring for Azure SQL', 'Fabric Migration Assistant', 'Copy job');
    } else if (plat === 'snowflake') {
      if (offload) {
        Object.assign(P, { id: 'mirror', name: 'Mirror Snowflake into OneLake, then build on it', quickWin: true, mirror: true });
        P.ingest.push('Mirroring for Snowflake replicates managed tables into OneLake continuously; Iceberg tables can be read in place through metadata mirroring or OneLake shortcuts.');
      } else {
        Object.assign(P, { id: 'migrate', name: 'Migrate Snowflake to Fabric (mirror the data, convert the SQL)', mirror: true });
        P.ingest.push('Mirroring for Snowflake for the historical load and to keep data in sync during the parallel run, without extraction pipelines.', 'Iceberg tables: keep them in place and read them through OneLake and Snowflake interoperability (shortcuts) until cutover.');
        P.code = 'Snowflake SQL to T-SQL (Warehouse) or Spark SQL: VARIANT and FLATTEN to JSON functions or Spark structs, QUALIFY works natively, Snowflake Scripting to T-SQL procedures, tasks and streams to pipelines. dbt projects can switch to the dbt-fabric adapter.';
      }
      P.prereqs.push('Mirroring reads from Snowflake with a warehouse you choose: Snowflake bills those credits until cutover.');
      P.tools.push('Mirroring for Snowflake', 'OneLake shortcuts (Iceberg)', 'Copy job', 'dbt-fabric adapter', 'AI-assisted code conversion');
    } else if (plat === 'databricks') {
      if (offload) Object.assign(P, { id: 'mirror', name: 'Use Databricks Delta tables in Fabric without copying', quickWin: true, mirror: true });
      else Object.assign(P, { id: 'migrate', name: 'Move Databricks workloads to Fabric Spark and OneLake', mirror: true });
      P.ingest.push('Azure Databricks: the mirrored Azure Databricks catalog item exposes Unity Catalog tables in Fabric through metadata mirroring, without copying data.', 'Databricks on AWS or Google Cloud: OneLake shortcuts to the Delta tables in Amazon S3 or Google Cloud Storage.');
      if (!offload) { P.ingest.push('When the Databricks storage is retired, rewrite tables as OneLake-managed Delta (Spark or Copy job).'); P.code = 'Notebooks move to Fabric notebooks with small changes (dbutils to notebookutils, cluster settings to environments); jobs to pipelines; DLT to materialized lake views; MLflow models re-registered in Fabric Data Science.'; }
      P.tools.push('Mirrored Azure Databricks catalog', 'OneLake shortcuts (S3 / GCS / ADLS)', 'Fabric notebooks', 'Fabric pipelines');
    } else if (plat === 'redshift') {
      Object.assign(P, { id: offload ? 'offload' : 'migrate', name: offload ? 'Offload Redshift data to OneLake' : 'Migrate Redshift to Fabric (UNLOAD to S3, shortcuts, convert SQL)' });
      P.ingest.push('Bulk: UNLOAD tables to Amazon S3 as Parquet, create OneLake shortcuts to the bucket and load into Warehouse or Lakehouse (COPY INTO or Spark).', 'Increments and smaller tables: Copy job or pipelines with the Amazon Redshift connector.', 'Continuous sync during the parallel run, if needed: partner CDC through open mirroring.');
      if (!offload) P.code = 'Redshift SQL (PostgreSQL dialect) to T-SQL or Spark SQL; PL/pgSQL to T-SQL procedures; SUPER to JSON functions; distribution and sort keys dropped.';
      P.prereqs.push('AWS data egress charges apply to the bulk transfer; shortcut caching reduces repeated reads.');
      P.tools.push('OneLake shortcuts (Amazon S3)', 'COPY INTO', 'Copy job', 'AI-assisted code conversion');
    } else if (plat === 'bigquery') {
      if (offload) Object.assign(P, { id: 'mirror', name: 'Mirror BigQuery into OneLake, then build on it', quickWin: true, mirror: true });
      else { Object.assign(P, { id: 'migrate', name: 'Migrate BigQuery to Fabric (mirror the data, convert GoogleSQL)', mirror: true }); P.code = 'GoogleSQL to T-SQL or Spark SQL: STRUCT / ARRAY to child tables, JSON or Spark structs; scripting to T-SQL procedures; scheduled queries to pipelines; BigQuery ML to Fabric Data Science.'; }
      P.ingest.push('Mirroring for Google BigQuery replicates tables into OneLake continuously, without pipelines.', 'External / BigLake tables on Google Cloud Storage: OneLake shortcuts.');
      P.prereqs.push('Check Google Cloud query and egress costs for the initial load.');
      P.tools.push('Mirroring for Google BigQuery', 'OneLake shortcuts (GCS)', 'Copy job', 'AI-assisted code conversion');
    } else if (plat === 'postgres' || plat === 'mysql') {
      const nm = plat === 'postgres' ? 'PostgreSQL' : 'MySQL';
      if (offload || f.role === 'oltp' || f.role === 'replica') Object.assign(P, { id: 'mirror', name: 'Replicate ' + nm + ' into OneLake, then build the medallion', quickWin: true, mirror: true });
      else { Object.assign(P, { id: 'migrate', name: 'Migrate ' + nm + ' to Fabric and convert the procedures', mirror: true }); P.code = plat === 'postgres' ? 'PL/pgSQL to T-SQL procedures or PySpark; arrays and JSONB to JSON functions or child tables.' : 'MySQL procedures to T-SQL; ENUM, unsigned and zero-date columns mapped during the load.'; }
      if (plat === 'postgres') P.ingest.push('Azure Database for PostgreSQL (flexible server): Mirroring for Azure Database for PostgreSQL.', 'Other PostgreSQL (on-premises, RDS, Aurora, Cloud SQL, AlloyDB): Copy job incremental loads through the gateway, or open mirroring partners that read logical replication.');
      else P.ingest.push('Azure Database for MySQL: mirroring (preview at the time of writing).', 'Other MySQL / MariaDB: Copy job incremental loads through the gateway, or open mirroring partners that read the binary log.');
      P.prereqs.push(plat === 'postgres' ? 'Log-based replication needs wal_level = logical.' : 'Log-based replication needs row-based binary logging (binlog_format = ROW).');
      P.tools.push('Mirroring (Azure-hosted)', 'Copy job', 'Open mirroring partners');
    } else if (plat === 'greenplum' || plat === 'vertica' || plat === 'exasol' || plat === 'clickhouse' || plat === 'sap_iq') {
      const nm = KB.PLATFORMS[plat].short;
      Object.assign(P, { id: 'migrate', name: 'Migrate ' + nm + ' to Fabric (bulk export, convert SQL)' });
      P.ingest.push({ greenplum: 'Bulk: parallel unload with writable external tables (gpfdist / PXF) to Parquet or CSV in cloud storage, then COPY INTO or Spark.', vertica: 'Bulk: EXPORT TO PARQUET into cloud storage, then OneLake shortcuts and COPY INTO or Spark.', exasol: 'Bulk: EXPORT tables to files in cloud storage, then COPY INTO or Spark.', clickhouse: 'Bulk: write tables to Parquet in object storage (s3 table function), then OneLake shortcuts and COPY INTO or Spark.', sap_iq: 'Bulk: unload tables to files (temporary extract options), land in OneLake and load with COPY INTO.' }[plat], 'Increments and smaller tables: Copy job or pipelines with the ODBC connector through the gateway.');
      P.code = { greenplum: 'PL/pgSQL to T-SQL procedures; distribution keys and append-optimized options dropped.', vertica: 'Vertica SQL to T-SQL or Spark SQL; projections dropped; UDx and in-database ML rebuilt in Spark.', exasol: 'Exasol SQL to T-SQL; Lua / Python UDF scripts to notebooks or user data functions.', clickhouse: 'ClickHouse SQL to Spark SQL or T-SQL; engine semantics (Replacing / Summing / Aggregating) implemented explicitly; real-time ingestion through Eventstream.', sap_iq: 'Sybase T-SQL procedures to T-SQL (SSMA for SAP ASE as a starting point).' }[plat];
      if (plat === 'clickhouse') P.notes.push('Sub-second, high-concurrency dashboards are often a better fit for Eventhouse (KQL) than Warehouse: decide per workload.');
      P.tools.push('COPY INTO', 'OneLake shortcuts', 'Copy job', 'AI-assisted code conversion');
    } else if (plat === 'hive') {
      Object.assign(P, { id: 'migrate', name: 'Move the Hadoop data lake to OneLake and Fabric Spark', target: 'Fabric Lakehouse (Spark) + Warehouse for curated Gold' });
      P.ingest.push('Copy HDFS data to ADLS Gen2 or OneLake (DistCp / AzCopy, or Azure Data Box for very large volumes), then convert tables to Delta in Bronze.', 'Data already in cloud storage (S3, GCS, ADLS): create OneLake shortcuts and convert in place.');
      P.code = 'HiveQL / Impala SQL to Spark SQL notebooks; Oozie workflows to pipelines or Apache Airflow jobs; Spark jobs to Spark job definitions; MapReduce rewritten; Ranger policies to OneLake security.';
      P.notes.push('Hadoop distributions (CDH, HDP) are out of vendor support: plan the move around licence and hardware renewal.');
      P.tools.push('DistCp / AzCopy', 'OneLake shortcuts', 'Fabric notebooks', 'Apache Airflow job');
    } else if (plat === 'sap_ase') {
      Object.assign(P, { id: 'migrate_wh', name: 'Migrate SAP ASE to Fabric Warehouse' });
      P.ingest.push('Historical load with Copy job or pipelines (ODBC connector) through the gateway.', 'Continuous sync during the parallel run: partner CDC through open mirroring.');
      P.code = 'Sybase T-SQL is close to SQL Server T-SQL: SSMA for SAP ASE gives a starting point, then fix the Fabric Warehouse gaps.';
      P.tools.push('SSMA for SAP ASE (conversion aid)', 'Copy job', 'Open mirroring partners');
    } else {
      Object.assign(P, { id: 'migrate', name: 'Migrate to Fabric with Copy job and code conversion' });
      P.ingest.push('Copy job or pipelines with the matching connector (ODBC if needed) through the gateway.');
      P.code = 'Convert procedural code to T-SQL or Spark.'; P.tools.push('Copy job', 'Fabric pipelines');
    }
    P.items.push(P.mirror ? 'Mirrored database' : (P.id === 'bw_coexist' ? 'Dataflow Gen2 (SAP BW connector)' : 'Copy job / pipelines'));
    if (f.latency === 'near_rt' || f.latency === 'rt') P.notes.push(P.mirror ? 'Mirroring keeps data fresh within minutes for this system.' : 'Near-real-time need: add CDC (mirroring or partner) or Eventstream for this system.');
    return P;
  }

  function gaps(c, s, f) {
    const list = f.features.map((k) => Object.assign({ k }, KB.FEAT[k]));
    if ((f.fam === 'db') && f.types > 0 && s.platform !== 'mssql') {
      if (!list.some((x) => x.k === 'number_noprec' || x.k === 'graphic')) list.push({ k: 'types', label: 'Columns needing type mapping (' + fmtInt(f.types) + ')', gap: 'low', fabric: 'Map to Fabric-supported types (varchar UTF-8, datetime2(6), decimal, varbinary).', days: 1 });
    }
    const order = { high: 0, medium: 1, low: 2, none: 3 };
    return list.sort((a, b) => order[a.gap] - order[b.gap]);
  }

  /* ---------- capacity & cost ---------- */
  function capacity(c, systems, R) {
    const daily = c.gv('etl_daily_gb') || 0;
    const mix = { simple: 2, balanced: 3, complex: 4.5 }[c.gv('etl_mix')] || 3;
    const totTb = sum(systems.map((x) => x.f.tb)) || 1;
    const mirrorShare = sum(systems.filter((x) => x.pattern.mirror).map((x) => x.f.tb)) / totTb;
    const etlCUs = daily * mix * 200 * (1 - 0.4 * mirrorShare);
    const lat = c.gv('etl_latency');
    const jobs = c.gv('etl_jobs') || 0;
    const runs = jobs * (lat === 'daily' ? 1 : lat === 'hourly' ? 1 + 0.25 * 23 : 1 + 0.25 * 95);
    const orchCUs = runs * 20;
    const models = c.gv('bi_models') || 0;
    const refreshCUs = models * (lat === 'daily' ? 2 : 6) * 900 * 0.4;
    const dsOn = (c.gv('bi_ds') || []).filter((x) => x !== 'none').length > 0 || ['agents', 'ml'].indexOf(c.gv('bi_ai')) >= 0;
    const dsCUs = dsOn ? 0.15 * etlCUs + 40000 : 0;
    const rtCUs = lat === 'rt' ? 4 * 86400 : lat === 'near_rt' ? 2 * 86400 : 0;
    const background = etlCUs + orchCUs + refreshCUs + dsCUs + rtCUs;
    const bgCU = background / 86400;
    const conc = c.gv('bi_concurrency') || 0;
    const biCU = conc * 3 * 8 / 300;
    const dwLog = ['teradata', 'netezza', 'synapse', 'sap_bw', 'sap_bw4', 'sap_hana', 'snowflake', 'redshift', 'bigquery', 'databricks', 'greenplum', 'vertica', 'exasol', 'clickhouse', 'hive', 'sap_iq'];
    const sqlQ = sum(systems.map((x) => (['edw', 'mart', 'ods'].indexOf(x.f.role) >= 0 || x.f.fam === 'sap_bw' ? x.f.queries * (dwLog.indexOf(x.sys.platform) >= 0 ? 0.25 : 0.1) : 0)));
    const sqlCU = sqlQ * 10 / (10 * 3600) * 2.5;
    const interCU = biCU + sqlCU;
    const required = (bgCU + interCU) * 1.3;
    const skus = KB.SKUS;
    let idx = skus.findIndex((k) => k.cu >= required); if (idx < 0) idx = skus.length - 1;
    let sku = skus[idx]; const computeSku = sku;
    const ms = c.gv('org_ms') || [];
    const e5 = ms.indexOf('e5') >= 0;
    const viewers = c.gv('bi_viewers') || 0; const authors = c.gv('bi_authors') || 0;
    const resMonth = (cu) => cu * R.cuYearReserved / 12;
    const paygMonth = (cu) => cu * R.cuHourPayg * R.hoursPerMonth;
    const licCost = (cu) => e5 ? 0 : (cu >= 64 ? authors : authors + viewers) * R.proUserMonth;
    let licenseNote = '';
    if (sku.cu < 64) {
      const a = resMonth(sku.cu) + licCost(sku.cu); const b = resMonth(64) + licCost(64);
      if (b <= a) { licenseNote = 'F64 is cheaper than F' + sku.cu + ' plus Power BI Pro for ' + fmtInt(viewers) + ' report consumers (F64 and above lets free users view content).'; sku = skus.find((k) => k.cu === 64); }
      else if (!e5) licenseNote = 'Below F64, every report consumer needs a Power BI Pro licence (included in the licence cost).';
    }
    if (e5) licenseNote = licenseNote || 'Microsoft 365 E5 includes Power BI Pro, so viewer licences add no cost.';
    // Direct Lake guardrail check (largest table rows)
    let maxRows = 0; let rowsSrc = 'estimated';
    systems.forEach((x) => {
      const tops = (x.sys.disc && x.sys.disc.tops) || [];
      const r = Math.max(0, ...tops.map((t) => t.rows || 0));
      if (r > 0) { if (r > maxRows) { maxRows = r; rowsSrc = 'discovered'; } }
      else { const est = (x.f.largestGb || 0) * 1073741824 / 120; if (est > maxRows) maxRows = est; }
    });
    const dlSku = skus.find((k) => k.dlRows * 1e6 >= maxRows) || skus[skus.length - 1];
    const envs = parseInt(c.gv('ops_envs') || '3', 10);
    const npIdx = envs <= 1 ? -1 : clamp(skus.findIndex((k) => k.cu >= sku.cu / 8), 2, 5);
    const np = npIdx >= 0 ? skus[npIdx] : null;
    const purchase = c.gv('tgt_purchase');
    const reserved = purchase !== 'payg';
    const prodMonth = reserved ? resMonth(sku.cu) : paygMonth(sku.cu);
    const npMonth = np ? np.cu * R.cuHourPayg * R.nonProdHoursMonth : 0;
    // storage
    let storTb = 0; let mirroredTb = 0;
    systems.forEach((x) => {
      const comp = ['teradata', 'netezza', 'sap_hana', 'sap_s4', 'sap_bw4', 'snowflake', 'redshift', 'bigquery', 'databricks', 'vertica', 'exasol', 'clickhouse', 'greenplum', 'sap_iq', 'hive'].indexOf(x.sys.platform) >= 0 ? 0.9 : 0.6;
      const lake = x.f.tb * comp;
      if (x.pattern.mirror) { mirroredTb += lake; storTb += lake * 1.2; } else storTb += lake * 2.0;
    });
    const freeMirrorTb = Math.min(mirroredTb, sku.cu);
    const billTb = Math.max(0, storTb + mirroredTb - freeMirrorTb);
    const storMonth = billTb * 1024 * R.storageGbMonth;
    const gwN = systems.some((x) => ON_PREM.indexOf(x.f.deploy) >= 0 || x.f.deploy === 'iaas') ? 2 : 0;
    const gwMonth = gwN * R.gatewayVmMonth;
    const lic = licCost(sku.cu);
    const monthly = prodMonth + npMonth + storMonth + gwMonth + lic;
    const growth = sum(systems.map((x) => x.f.growth * x.f.tb)) / totTb / 100;
    const years = [0, 1, 2].map((y) => {
      const st = storMonth * Math.pow(1 + growth, y);
      return 12 * (prodMonth + npMonth + st + gwMonth + lic);
    });
    const utilization = required / sku.cu;
    return {
      required: round(required, 1), bgCU: round(bgCU, 1), interCU: round(interCU, 1), parts: [
        { k: 'ETL & transformation', cu: etlCUs / 86400 }, { k: 'Pipeline orchestration', cu: orchCUs / 86400 }, { k: 'Semantic model refresh', cu: refreshCUs / 86400 },
        { k: 'Data science & AI', cu: dsCUs / 86400 }, { k: 'Real-time streaming', cu: rtCUs / 86400 }, { k: 'Report interactions', cu: biCU }, { k: 'SQL queries', cu: sqlCU }],
      sku, computeSku, np, licenseNote, maxRows, rowsSrc, dlSku, utilization, reserved,
      cost: { prodMonth, prodPayg: paygMonth(sku.cu), prodReserved: resMonth(sku.cu), npMonth, storMonth, storTb: round(storTb + mirroredTb, 1), billTb: round(billTb, 1), freeMirrorTb: round(freeMirrorTb, 1), gwN, gwMonth, lic, monthly, years, threeYear: sum(years) }
    };
  }

  /* ---------- effort ---------- */
  const WS = [
    ['mobilize', 'Mobilization & assessment sign-off', { pm: 0.4, arch: 0.4, de: 0.2 }],
    ['foundation', 'Platform foundation & landing zone', { plat: 0.6, arch: 0.25, sec: 0.15 }],
    ['security', 'Security & governance', { sec: 0.7, arch: 0.15, plat: 0.15 }],
    ['schema', 'Schema conversion & deployment', { de: 0.5, sqle: 0.5 }],
    ['code', 'Code conversion & remediation', { sqle: 0.8, de: 0.2 }],
    ['data', 'Historical load & data sync', { de: 0.8, plat: 0.2 }],
    ['etl', 'ETL / pipeline migration', { de: 0.9, arch: 0.1 }],
    ['bi', 'Reports & semantic models', { bi: 0.85, de: 0.1, arch: 0.05 }],
    ['sap', 'SAP data & semantics', { sap: 0.6, de: 0.4 }],
    ['validation', 'Data validation & reconciliation', { qa: 0.6, de: 0.4 }],
    ['perf', 'Performance tuning & capacity optimization', { de: 0.5, arch: 0.3, sqle: 0.2 }],
    ['testing', 'System & user acceptance testing', { qa: 0.8, bi: 0.2 }],
    ['cutover', 'Cutover, parallel run & hypercare', { de: 0.4, pm: 0.3, plat: 0.3 }],
    ['decom', 'Legacy decommissioning', { plat: 0.6, pm: 0.4 }],
    ['training', 'Training & change management', { chg: 0.7, bi: 0.3 }],
    ['arch', 'Architecture & design authority', { arch: 1 }],
    ['pm', 'Program management', { pm: 1 }]
  ];
  E.WORKSTREAMS = WS;

  function effort(c, systems, strat, inputConf, R) {
    const X = KB.EFFORT; const w = {}; const drv = {}; const per = {};
    WS.forEach(([k]) => { w[k] = 0; drv[k] = []; });
    const add = (k, d, note, sid) => { if (!d || !isFinite(d)) return; w[k] += d; if (note) drv[k].push(note + ': ' + fmtNum(d, 0) + ' d'); if (sid) { per[sid] = per[sid] || {}; per[sid][k] = (per[sid][k] || 0) + d; } };
    const n = systems.length;
    add('mobilize', X.mobilize.base + X.mobilize.perSystem * n, n + ' system(s)');
    const F = X.foundation;
    add('foundation', F.base, 'Capacities, workspaces, domains, Git, monitoring');
    add('foundation', F.network[c.gv('sec_network')] || 0, 'Network posture');
    if (c.gv('sec_cmk') === 'yes') add('foundation', F.cmk, 'Customer-managed keys');
    const gwSys = systems.filter((x) => ON_PREM.indexOf(x.f.deploy) >= 0 || x.f.deploy === 'iaas').length;
    if (gwSys) add('foundation', F.gateway * Math.min(gwSys, 3), 'Data gateway clusters');
    add('foundation', F.dr[c.gv('ops_dr')] || 0, 'Disaster recovery');
    add('foundation', F.envs[c.gv('ops_envs')] || 0, 'Environments');
    add('foundation', F.devops[c.gv('ops_devops')] || 0, 'CI/CD & deployment pipelines');
    if (c.gv('sec_residency') === 'yes') add('foundation', F.residency, 'Data residency controls');
    const S = X.security; const regs = (c.gv('sec_regs') || []).filter((x) => x !== 'none');
    add('security', S.base, 'Entra groups, workspace roles, OneLake security baseline');
    add('security', S.rls[c.gv('sec_rls')] || 0, 'Row-level security');
    if (c.gv('sec_masking') === 'yes') add('security', S.masking, 'Masking');
    add('security', S.perReg * regs.length, regs.length + ' regulation(s)');
    if ((c.gv('sec_catalog') || []).some((x) => x !== 'none')) add('security', S.catalog, 'Catalog / Purview integration');
    if (c.gv('sec_pii') === 'extensive') add('security', S.piiExtensive, 'Sensitive data classification');

    const aiF = c.gv('tgt_ai_assist') === 'yes' ? R.aiConversionFactor : 1;
    const stratF = strat.key === 'modernize' ? 1.3 : strat.key === 'lift' ? 0.8 : 1;
    const sizeF = (f) => (f.objects < 500 ? 0.6 : f.objects < 3000 ? 1 : f.objects < 15000 ? 1.6 : 2.4);
    systems.forEach((x) => {
      const f = x.f; const p = f.p; const id = x.sys.id; const nm = x.name; const off = f.scope !== 'full';
      if (f.fam === 'db' || f.fam === 'hana') {
        const sch = (f.tables * X.schema.perTable + f.views * X.schema.perView) * (p.schemaF || 1) * stratF * (x.pattern.mirror ? 0.3 : 1) * ((aiF + 1) / 2);
        add('schema', sch, nm, id);
        if (!off) {
          let code = (f.loc / (p.locDay || 300)) * aiF + (f.codeObjs) * X.code.perObject + f.triggers * X.code.perTrigger;
          code *= { simple: 0.8, balanced: 1, complex: 1.35 }[f.codeMix] || 1;
          const aiCode = x.sys.ai && x.sys.ai.code && x.sys.ai.code.avgHours;
          if (aiCode && f.codeObjs > 0) code = 0.5 * code + 0.5 * (f.codeObjs * aiCode / 8) * aiF;
          if (f.calc) code += f.calc * X.sap.calcView;
          add('code', code, nm + ' code', id);
        }
        const fx = sum(f.features.map((k) => KB.FEAT[k].days || 0)) * sizeF(f) * (off ? 0.3 : 1);
        add('code', fx, nm + ' feature remediation', id);
      }
      if (x.pattern.mirror) add('data', X.data.mirrorPerSystem + X.data.mirrorPerTB * f.tb, nm + ' mirroring', id);
      else add('data', X.data.perSystem + X.data.perTB * f.tb + (f.largestGb > 1000 ? X.data.bigTable : 0) + (f.deploy === 'mainframe' ? X.data.mainframe : 0), nm + ' load', id);
      if (f.fam === 'sap_erp') {
        const T = X.sap;
        let d = T.semanticBase + f.sapTables * T.perTable + f.extractors * T.perExtractor + f.custom * T.perCustom;
        d += x.pattern.id === 'sap_datasphere' ? T.datasphereSetup : x.pattern.id === 'sap_partner' ? T.partnerSetup : 5;
        d += sum(f.features.map((k) => KB.FEAT[k].days || 0)) * 0.8;
        add('sap', d, nm, id);
      }
      if (f.fam === 'sap_bw') {
        const T = X.sap; const ab = { low: 0.7, medium: 1, high: 1.5 }[f.abap] || 1;
        let d = x.pattern.id === 'bw_coexist' ? (f.bwQueries * 0.5 + f.providers * 0.3 + 10) : (f.providers * T.perProvider + f.bwQueries * T.perQuery + f.chains * T.perChain + f.transforms * T.perTransform * ab);
        d += sum(f.features.map((k) => KB.FEAT[k].days || 0)) * 0.6;
        add('sap', d, nm + (x.pattern.id === 'bw_coexist' ? ' (phase 1 coexistence)' : ' rebuild'), id);
      }
    });
    // ETL
    const jobs = (c.gv('etl_jobs') || 0) * (c.gv('tgt_rationalize') === 'yes' ? 0.9 : 1);
    const mixD = { simple: [0.6, 0.3, 0.1], balanced: [0.4, 0.4, 0.2], complex: [0.2, 0.4, 0.4] }[c.gv('etl_mix')] || [0.4, 0.4, 0.2];
    const unit = mixD[0] * X.etl.simple + mixD[1] * X.etl.medium + mixD[2] * X.etl.complex;
    const tools = (c.gv('etl_tools') || []).filter((t) => X.etl.tool[t] != null);
    const toolF = tools.length ? sum(tools.map((t) => X.etl.tool[t])) / tools.length : 1;
    add('etl', jobs * unit * toolF * (c.gv('tgt_ai_assist') === 'yes' ? X.etl.aiFactor : 1), fmtInt(jobs) + ' jobs × ' + fmtNum(unit * toolF, 2) + ' d');
    if (['controlm', 'autosys', 'tws'].indexOf(c.gv('etl_scheduler')) >= 0) add('etl', X.etl.scheduler, 'Enterprise scheduler integration');
    // BI
    const B = X.bi; const rep = (c.gv('bi_reports') || 0) * (c.gv('tgt_rationalize') === 'yes' ? (1 - (c.gv('bi_unused') || 0) / 100) : 1);
    const repEq = Math.min(rep, B.bulkAfter) + Math.max(0, rep - B.bulkAfter) * B.bulkFactor;
    const bt = c.gv('bi_tools') || [];
    const perTool = (t) => t === 'pbi' ? B.repoint : t === 'ssrs' ? B.paginated : t === 'bex' ? B.bexAfo : t === 'excel' ? B.excel : B.rebuild;
    const repUnit = bt.length ? sum(bt.map(perTool)) / bt.length : B.rebuild;
    add('bi', repEq * repUnit, fmtInt(rep) + ' reports in scope (templating beyond ' + B.bulkAfter + ') × ' + fmtNum(repUnit, 2) + ' d');
    const models = c.gv('bi_models') || 0;
    const tModels = Math.min(models, Math.round(20 + models * 0.3));
    const mUnit = bt.indexOf('ssas_md') >= 0 ? B.modelMd : bt.indexOf('ssas_tab') >= 0 ? B.modelTabular : (bt.length === 1 && bt[0] === 'pbi') ? 1.5 : B.model;
    add('bi', tModels * mUnit * 0.8, fmtInt(models) + ' source models consolidated to about ' + fmtInt(tModels));
    const build = w.schema + w.code + w.data + w.etl + w.sap;
    add('validation', X.validationPct * build + X.reconFramework, 'Reconciliation framework + 15% of build');
    add('perf', X.perfPct * build + X.perfVeryHigh * systems.filter((x) => x.cx.tier === 'Very high').length, '6% of build');
    add('testing', X.testPct * (build + w.bi), '15% of build and BI');
    const pw = c.gv('tgt_parallel_weeks') || 0;
    add('cutover', X.cutover.perSystem * n + X.cutover.perParallelWeek * pw + X.cutover.hypercare, n + ' cutovers, ' + pw + '-week parallel run');
    add('decom', X.decom * systems.filter((x) => x.f.scope === 'full').length, 'Systems decommissioned');
    const T = X.training; let tr = T.base + (c.gv('bi_authors') || 0) / T.perAuthors;
    if (c.gv('ops_skill_spark') === 'low' && systems.some((x) => /Lakehouse/.test(x.pattern.target))) tr += T.sparkGap;
    if (c.gv('ops_skill_pbi') === 'low') tr += 8;
    add('training', tr, 'Role-based enablement');
    const sub = sum(WS.filter(([k]) => k !== 'arch' && k !== 'pm').map(([k]) => w[k]));
    add('arch', X.archPct * sub, '8% of delivery');
    add('pm', X.pmPct * sub, '12% of delivery');
    const base = sum(WS.map(([k]) => w[k]));
    const tierAdd = { Low: 0, Medium: 5, High: 10, 'Very high': 15 };
    const avgTier = systems.length ? sum(systems.map((x) => tierAdd[x.cx.tier])) / systems.length : 5;
    let cont = R.contingencyOverride != null && R.contingencyOverride !== '' ? Number(R.contingencyOverride) / 100 : (10 + avgTier + (1 - inputConf) * 20) / 100;
    cont = clamp(cont, 0, 0.6);
    const total = base * (1 + cont);
    const roles = {}; Object.keys(KB.ROLES).forEach((r) => { roles[r] = 0; });
    WS.forEach(([k, , split]) => { Object.keys(split).forEach((r) => { roles[r] += w[k] * split[r] * (1 + cont); }); });
    const cost = sum(Object.keys(roles).map((r) => roles[r] * R.blendedDayRate * KB.ROLES[r].mult));
    return {
      ws: WS.map(([k, label]) => ({ k, label, days: w[k], drivers: drv[k] })), base, cont, total, low: base * 0.9, high: total * 1.2,
      roles, cost, perSystem: per
    };
  }

  /* ---------- plan ---------- */
  function plan(c, systems, eff, strat) {
    const R = c.state.rates; const target = c.gv('org_target_months');
    const W = {}; eff.ws.forEach((x) => { W[x.k] = x.days * (1 + eff.cont); });
    const buildKeys = ['schema', 'code', 'data', 'sap'];
    const direct = {}; let directTot = 0;
    systems.forEach((x) => { const p = eff.perSystem[x.sys.id] || {}; direct[x.sys.id] = sum(buildKeys.map((k) => (p[k] || 0) * (1 + eff.cont))); directTot += direct[x.sys.id]; });
    const shared = W.etl + W.bi + W.validation + W.perf + W.testing + W.training * 0.6 + W.arch * 0.8 + W.pm * 0.8;
    const sysEff = {}; systems.forEach((x) => { sysEff[x.sys.id] = direct[x.sys.id] + shared * (directTot ? direct[x.sys.id] / directTot : 1 / systems.length); });
    const w0Eff = W.mobilize + W.foundation + W.security * 0.6 + (W.arch + W.pm) * 0.04;
        const fteFor = (months) => clamp(Math.ceil(eff.total / Math.max(1, months * 17)), 3, 80);
    const now0 = new Date();
    const monthsTo = (ym) => { if (!ym || ym === 'none' || !/^\d{4}-\d{2}$/.test(ym)) return null; const [y, m] = ym.split('-').map(Number); return (y - now0.getFullYear()) * 12 + (m - 1 - now0.getMonth()); };
    const renewal = {}; systems.forEach((x) => { const mt = monthsTo(c.sv(x.sys, 's_renewal')); if (mt != null) renewal[x.sys.id] = mt; });
    let fte = R.teamFteOverride ? Number(R.teamFteOverride) : (target ? fteFor(target) : clamp(Math.round(Math.sqrt(eff.total) * 0.26), 3, 40));
    const build = (fteN) => {
      const wk = 4.25; const rows = [];
      const w0 = Math.max(4, Math.ceil(w0Eff / (Math.min(fteN, 6) * wk)));
      rows.push({ k: 'w0', label: 'Wave 0 · Mobilize & platform foundation', kind: 'foundation', start: 0, dur: w0, effort: w0Eff });
      const order = systems.slice().sort((a, b) => {
        const dep = (x) => (x.f.fam === 'sap_bw' ? 2 : x.f.fam === 'sap_erp' ? 1 : 0);
        const ra = renewal[a.sys.id]; const rb = renewal[b.sys.id];
        if (ra != null || rb != null) { if (ra == null) return 1; if (rb == null) return -1; if (ra !== rb) return ra - rb; }
        if (dep(a) !== dep(b)) return dep(a) - dep(b);
        const qa = (a.pattern.quickWin ? -40 : 0) + a.cx.score; const qb = (b.pattern.quickWin ? -40 : 0) + b.cx.score;
        return qa - qb;
      });
      const pscore = (x) => (x.pattern.quickWin ? -40 : 0) + x.cx.score + x.f.tb * 0.2 + (x.f.fam === 'sap_erp' || x.f.fam === 'sap_bw' ? 15 : 0) + (x.sys.disc ? -5 : 0);
      const pilotSys = order.slice().sort((a, b) => pscore(a) - pscore(b))[0];
      let t = Math.round(w0 * 0.6); const waves = [];
      if (pilotSys) {
        const se = sysEff[pilotSys.sys.id]; const pe = se <= 150 ? se : Math.max(40, se * 0.25);
        const d = Math.max(6, Math.ceil(pe / (Math.max(2, fteN * 0.5) * wk)));
        rows.push({ k: 'pilot', label: 'Pilot · ' + pilotSys.name + (pe < se ? ' (first subject area)' : ''), kind: 'pilot', start: t, dur: d, effort: pe, sys: pilotSys.sys.id });
        sysEff['__rem_' + pilotSys.sys.id] = se - pe; t += Math.round(d * 0.7);
      }
      const maxWave = Math.max(60, fteN * wk * 16);
      order.forEach((x) => {
        const rem = sysEff['__rem_' + x.sys.id] != null ? sysEff['__rem_' + x.sys.id] : sysEff[x.sys.id];
        if (rem <= 1) return;
        const k = clamp(Math.ceil(rem / maxWave), 1, 4);
        for (let i = 0; i < k; i++) {
          const e = rem / k; const d = Math.max(4, Math.ceil(e / (fteN * 0.8 * wk)) + 2);
          waves.push({ label: x.name + (k > 1 ? ' · part ' + (i + 1) + ' of ' + k : ''), kind: 'wave', start: t, dur: d, effort: e, sys: x.sys.id });
          t += Math.round(d * 0.6);
        }
      });
      waves.forEach((wv, i) => { wv.k = 'wave' + (i + 1); wv.label = 'Wave ' + (i + 1) + ' · ' + wv.label; rows.push(wv); });
      const lastEnd = Math.max(...rows.map((r) => r.start + r.dur));
      const pw = c.gv('tgt_parallel_weeks') || 0;
      rows.push({ k: 'cutover', label: 'Parallel run, cutover & hypercare', kind: 'cutover', start: Math.max(0, lastEnd - 2), dur: pw + 4, effort: W.cutover });
      const decomStart = Math.max(0, lastEnd - 2) + pw + 2;
      if (systems.some((x) => x.f.scope === 'full')) rows.push({ k: 'decom', label: 'Decommission legacy platforms', kind: 'decom', start: decomStart, dur: 6, effort: W.decom });
      const end = Math.max(...rows.map((r) => r.start + r.dur));
      const sysEnd = {}; rows.forEach((r) => { if (r.sys) sysEnd[r.sys] = Math.max(sysEnd[r.sys] || 0, r.start + r.dur); });
      return { rows, weeks: end, months: round(end / 4.33, 1), fte: fteN, pilot: pilotSys ? pilotSys.name : null, sysEnd, renewal };
    };
    let p = build(fte);
    if (target && !R.teamFteOverride) { let guard = 0; while (p.months > target && fte < 80 && guard < 40) { fte += 1; p = build(fte); guard++; } }
    const dl = c.gv('org_deadline');
    let deadline = null;
    if (dl && dl !== 'none' && /^\d{4}-\d{2}$/.test(dl)) {
      const now = new Date(); const [y, m] = dl.split('-').map(Number);
      deadline = { label: dl, months: round((y - now.getFullYear()) * 12 + (m - 1 - now.getMonth()), 1) };
    }
    p.deadline = deadline; p.target = target || null;
    p.milestones = [];
    const w0 = p.rows.find((r) => r.k === 'w0'); if (w0) p.milestones.push({ at: w0.start + w0.dur, label: 'Platform ready' });
    const pl = p.rows.find((r) => r.k === 'pilot'); if (pl) p.milestones.push({ at: pl.start + pl.dur, label: 'Pilot live' });
    const dc = p.rows.find((r) => r.k === 'decom'); if (dc) p.milestones.push({ at: dc.start + dc.dur, label: 'Legacy retired' });
    return p;
  }

  /* ---------- risks ---------- */
  function risks(c, systems, cap, eff, pl, inputConf) {
    const out = [];
    const add = (id, title, detail, L, I, mitigation, owner, cat, sys) => out.push({ id, title, detail, L, I, score: L * I, sev: L * I >= 15 ? 'Critical' : L * I >= 10 ? 'High' : L * I >= 5 ? 'Medium' : 'Low', mitigation, owner, cat, sys: sys || null });
    const sapSys = systems.filter((x) => x.f.fam === 'sap_erp' || x.f.fam === 'sap_bw');
    sapSys.forEach((x) => {
      const ex = x.f.extract || [];
      if (ex.indexOf('adf_cdc') >= 0 || ex.indexOf('custom_rfc') >= 0) add('R-SAP-ODP-' + x.sys.id, 'ODP-RFC extraction is no longer permitted for non-SAP targets', 'SAP Note 3255746 (version 11, April 2026) prohibits ODP-RFC for SAP-to-non-SAP replication; SAP is enforcing it through security patches. ' + x.name + ' uses an ODP-RFC based route.', 4, 5, 'Move to SAP Datasphere replication flows (Mirroring for SAP), SAP BDC Connect, ODP-OData or an SAP-certified partner that does not use ODP-RFC; confirm the route with your SAP account team.', 'SAP lead', 'SAP', x.sys.id);
      else if (ex.indexOf('thirdparty') >= 0) add('R-SAP-ODP3-' + x.sys.id, 'Third-party SAP extraction may rely on ODP-RFC', 'Check how the current tool reads ' + x.name + ' against SAP Note 3255746.', 3, 4, 'Get written confirmation from the vendor; prefer certified open-mirroring partners or Datasphere.', 'SAP lead', 'SAP', x.sys.id);
      if (x.f.datasphere === 'no' && x.f.bdc !== 'adopted') add('R-SAP-LIC-' + x.sys.id, 'SAP extraction route needs a licensing decision', 'Neither SAP Datasphere nor BDC is in place for ' + x.name + '; Datasphere Premium Outbound Integration or partner licences are not in the cost model.', 3, 3, 'Run a commercial comparison (Datasphere vs certified partners) during mobilization.', 'Client sponsor', 'Commercial', x.sys.id);
    });
    if (systems.some((x) => x.sys.platform === 'sap_ecc' || x.sys.platform === 'sap_bw')) add('R-SAP-EOM', 'SAP ECC 6.0 / BW 7.5 mainstream maintenance ends 31 Dec 2027', 'Extended maintenance runs to 2030 at a premium; analytics design must survive the move to S/4HANA.', 4, 3, 'Align waves with the S/4HANA roadmap; extract through Datasphere/CDS views to limit rework.', 'Client sponsor', 'SAP');
    systems.filter((x) => x.sys.platform === 'sap_ecc' && x.f.s4 === 'inflight').forEach((x) => add('R-S4-' + x.sys.id, 'S/4HANA program in flight will change the source', 'Extraction built on ECC tables for ' + x.name + ' would be reworked after the S/4HANA cutover.', 4, 3, 'Sequence the SAP wave after the S/4HANA cutover or build on S/4HANA CDS views.', 'SAP lead', 'SAP', x.sys.id));
    systems.filter((x) => x.sys.platform === 'sap_hana' && c.sv(x.sys, 's_hana_license') !== 'full').forEach((x) => add('R-HANA-LIC-' + x.sys.id, 'HANA licence may restrict direct extraction', 'Runtime licences limit direct access by non-SAP tools.', 3, 3, 'Confirm licence type with SAP before choosing the extraction route.', 'SAP lead', 'Commercial', x.sys.id));
    const bigCode = systems.filter((x) => ['oracle', 'teradata', 'db2luw', 'db2zos', 'netezza', 'other', 'sap_hana', 'snowflake', 'redshift', 'bigquery', 'greenplum', 'vertica', 'exasol', 'postgres', 'sap_ase', 'sap_iq'].indexOf(x.sys.platform) >= 0 && x.f.scope === 'full' && x.f.loc > 300000);
    bigCode.forEach((x) => add('R-CODE-' + x.sys.id, 'Large procedural code base to convert', x.name + ' holds about ' + fmtInt(x.f.loc) + ' lines of procedural code.', 4, 4, 'AI-assisted conversion with an automated regression harness; retire unused objects first using query-log usage.', 'Data engineering lead', 'Technical', x.sys.id));
    systems.forEach((x) => {
      const F = x.f.features;
      if (F.indexOf('wrapped') >= 0) add('R-WRAP-' + x.sys.id, 'Wrapped PL/SQL cannot be converted from the database', 'Readable source is needed for ' + x.name + '.', 4, 4, 'Obtain source from vendors or version control before the wave starts.', 'Data engineering lead', 'Technical', x.sys.id);
      if (x.f.scope === 'full' && (F.indexOf('triggers') >= 0 || (x.f.triggers || 0) > 0)) add('R-TRG-' + x.sys.id, 'Triggers have no equivalent in Fabric Warehouse', x.name + ': trigger logic must move to pipelines, procedures or the application.', 3, 3, 'Inventory trigger behaviour early; redesign as explicit pipeline steps.', 'Solution architect', 'Technical', x.sys.id);
      if (F.indexOf('recursive') >= 0 || F.indexOf('connect_by') >= 0) add('R-REC-' + x.sys.id, 'Recursive / hierarchical queries need redesign', 'Fabric Warehouse does not support recursive queries (' + x.name + ').', 3, 3, 'Flatten hierarchies in Spark or iterative SQL; add regression tests on hierarchy outputs.', 'Data engineering lead', 'Technical', x.sys.id);
      if (F.indexOf('set_tables') >= 0 || F.indexOf('not_casespecific') >= 0) add('R-SEM-' + x.sys.id, 'Teradata semantics can change results after conversion', 'SET-table de-duplication and case-insensitive comparisons behave differently in Fabric (' + x.name + ').', 3, 3, 'Choose the warehouse collation deliberately; reconcile row counts and aggregates per table.', 'Test lead', 'Data quality', x.sys.id);
      if (F.indexOf('number_noprec') >= 0) add('R-NUM-' + x.sys.id, 'Unconstrained NUMBER columns can break mirroring', x.name + ': mirroring may fail with "Invalid Decimal Precision or Scale".', 3, 2, 'Profile values and define decimal(p,s) before mirroring.', 'Data engineering lead', 'Technical', x.sys.id);
      if (x.f.deploy === 'mainframe') add('R-MF-' + x.sys.id, 'Mainframe extraction cost and complexity', 'EBCDIC conversion, packed decimals, MIPS consumption and batch windows on ' + x.name + '.', 4, 4, 'Log-based CDC through an open-mirroring partner, off-peak scheduling, copybook-aware tooling for files.', 'Mainframe lead', 'Technical', x.sys.id);
    });
    const ssisOn = (c.gv('etl_tools') || []).indexOf('ssis') >= 0;
    if (ssisOn) add('R-SSIS', 'SSIS bridge activity is in preview', 'The Invoke SSIS Package activity is preview; on-premises connectivity and custom components may need the Azure-SSIS integration runtime meanwhile.', 2, 3, 'Use the bridge only for packages that fit it; re-platform high-value packages to pipelines.', 'Data engineering lead', 'Technical');
    if (['near_rt', 'rt'].indexOf(c.gv('etl_latency')) >= 0 && systems.some((x) => !x.pattern.mirror && x.f.scope === 'full')) add('R-RT', 'Near-real-time needs on batch-oriented sources', 'Some systems lack a mirroring path; freshness targets need CDC or streaming design.', 3, 4, 'Use mirroring where supported, partner CDC through open mirroring, or Eventstream for event sources.', 'Solution architect', 'Technical');
    if (pl.deadline && pl.months > pl.deadline.months) add('R-DL', 'Plan ends after the hard deadline', 'Recommended plan takes ' + pl.months + ' months; the deadline is in ' + pl.deadline.months + ' months.', 5, 5, 'Negotiate a bridge extension, add capacity to the team, or lift and shift first and modernize after cutover.', 'Client sponsor', 'Schedule');
    systems.forEach((x) => { const rn = pl.renewal && pl.renewal[x.sys.id]; const endW = pl.sysEnd && pl.sysEnd[x.sys.id]; if (rn != null && endW != null && endW / 4.33 > rn) add('R-REN-' + x.sys.id, x.name + ' finishes after its licence / support renewal', 'Planned completion in about ' + round(endW / 4.33, 1) + ' months; renewal is in ' + rn + ' months.', 4, 4, 'Negotiate a short bridge renewal, or move this system into an earlier wave with a larger team.', 'Client sponsor', 'Commercial', x.sys.id); });
    if (pl.target && pl.fte > 40) add('R-FTE', 'Target timeline needs a very large team', pl.fte + ' FTE are needed to finish in ' + pl.target + ' months.', 4, 4, 'Extend the timeline or reduce scope by retiring unused objects and reports.', 'Program manager', 'Schedule');
    if (c.gv('ops_skill_spark') === 'low' && systems.some((x) => /Lakehouse/.test(x.pattern.target))) add('R-SKILL', 'Spark / Python skills gap', 'The target uses Lakehouse and notebooks but the team rates Spark skills low.', 4, 3, 'Role-based training, pair with partner engineers, prefer Warehouse T-SQL for Gold.', 'Program manager', 'People');
    if (['private', 'isolated'].indexOf(c.gv('sec_network')) >= 0) add('R-NET', 'Private networking adds setup and test effort', 'Private endpoints, gateways and outbound access protection must be designed and tested end to end.', 3, 3, 'Prove the network pattern in Wave 0 with one source and one report.', 'Platform lead', 'Technical');
    const regs = c.gv('sec_regs') || [];
    if (regs.some((x) => ['hipaa', 'pci', 'fedramp', 'dora'].indexOf(x) >= 0)) add('R-COMP', 'Regulatory validation of the target platform', 'Regulations in scope: ' + regs.filter((x) => x !== 'none').join(', ').toUpperCase() + '.', 3, 4, 'Map controls to Fabric and Purview capabilities early; involve compliance in Wave 0 sign-off.', 'Security lead', 'Compliance');
    if (regs.indexOf('fedramp') >= 0) add('R-GOV', 'Government cloud availability', 'Confirm Fabric availability and compliance offerings in the required cloud and region.', 3, 5, 'Validate with Microsoft before committing the roadmap.', 'Client sponsor', 'Compliance');
    if (c.gv('sec_residency') === 'yes') add('R-RES', 'Data residency constrains region choice', 'Fabric capacity and OneLake must sit in the mandated region; Warehouse connections across regions are not supported.', 2, 4, 'Pin capacities to the region; review gateway and partner tool locations.', 'Security lead', 'Compliance');
    if (cap.utilization > 0.9 || cap.interCU > cap.bgCU * 4) add('R-CAP', 'Interactive peaks may throttle the capacity', 'Required ' + cap.required + ' CU on F' + cap.sku.cu + '; report and SQL peaks dominate.', 3, 3, 'Enable surge protection, separate ETL and BI capacities, monitor with the Capacity Metrics app during the pilot.', 'Platform lead', 'Technical');
    if (cap.maxRows > cap.sku.dlRows * 1e6) add('R-DL-ROWS', 'Largest fact table exceeds the Direct Lake row guardrail', 'About ' + fmtNum(cap.maxRows / 1e9, 1) + ' billion rows versus ' + fmtNum(cap.sku.dlRows / 1000, 1) + ' billion on F' + cap.sku.cu + '.', 4, 3, 'Aggregate or partition the fact for Direct Lake, use composite models, or size the capacity to F' + cap.dlSku.cu + '.', 'BI lead', 'Technical');
    if ((c.gv('bi_reports') || 0) > 1000 && (c.gv('bi_unused') || 0) >= 25) add('R-SPRAWL', 'Report sprawl', fmtInt(c.gv('bi_reports')) + ' reports with about ' + c.gv('bi_unused') + '% unused.', 3, 2, 'Retire unused reports with usage data before migration.', 'BI lead', 'Scope');
    if ((c.gv('bi_tools') || []).filter((x) => x !== 'excel' && x !== 'pbi').length >= 3) add('R-ADOPT', 'Consolidating several BI tools affects users', 'Users of ' + (c.gv('bi_tools') || []).length + ' BI tools move to Power BI.', 3, 3, 'Champions network, report parity tests and phased tool retirement.', 'Change lead', 'People');
    const totTb = sum(systems.map((x) => x.f.tb));
    if (totTb > 50) add('R-LOAD', 'Large historical load through gateways', fmtInt(totTb) + ' TB to move.', 3, 3, 'Bulk export to files with parallel copy, staged loads by subject area, gateway clusters sized for throughput.', 'Data engineering lead', 'Technical');
    if (inputConf < 0.6) add('R-INPUT', 'Estimates rely on benchmark defaults', 'Input confidence is ' + Math.round(inputConf * 100) + '%; run the discovery scripts to replace defaults with measured facts.', 4, 3, 'Run discovery scripts and the AI agent on existing documents, then re-validate.', 'Assessment lead', 'Assessment');
    if ((c.gv('tgt_parallel_weeks') || 0) >= 8) add('R-DUAL', 'Dual running cost during the parallel run', (c.gv('tgt_parallel_weeks')) + ' weeks of legacy and Fabric running together.', 3, 2, 'Shorten with automated reconciliation; reserve capacity only after the pilot.', 'Program manager', 'Commercial');
    if (systems.some((x) => ['mssql', 'synapse', 'azure_sql'].indexOf(x.sys.platform) >= 0 && x.pattern.id === 'migrate_wh')) add('R-COPILOT', 'Migration Assistant AI fixes need Copilot', 'The AI-assisted fix step requires Copilot to be enabled in the tenant.', 2, 2, 'Enable Copilot in the tenant settings for the migration workspace.', 'Platform lead', 'Technical');
    if (c.gv('sec_pii') === 'extensive' && c.gv('bi_embed') === 'yes') add('R-PII', 'Sensitive data in externally shared analytics', 'Personal data plus external sharing increases exposure.', 3, 4, 'Sensitivity labels, DLP policies and RLS tested before external release.', 'Security lead', 'Compliance');
    return out.sort((a, b) => b.score - a.score);
  }

  /* ---------- validation items & completion ---------- */
  const FIELD_ACT = { org: 'A2', etl: 'A4', bi: 'A5', sec: 'A6', ops: 'A11', tgt: 'A8', inventory: 'A1', code: 'A3', workload: 'A9', sys: 'A8' };

  function inputItems(c) {
    const items = [];
    KB.GLOBAL_FIELDS.forEach((f) => {
      if (f.w < 1) return;
      const r = c.g(f.id);
      items.push({ key: 'g:' + f.id, scope: 'g', field: f, r, w: f.w, act: FIELD_ACT[f.sec] });
    });
    c.systems.forEach((s) => {
      E.fieldsForSystem(s).forEach((f) => {
        if (f.w < 1) return;
        const r = c.s(s, f.id);
        items.push({ key: s.id + ':' + f.id, scope: s.id, sys: s, field: f, r, w: f.w, act: FIELD_ACT[f.sec] || 'A8' });
      });
    });
    return items;
  }

  function decisionItems(c, systems, sumText) {
    const D2 = (key, act, title, detail) => ({ key: 'd:' + key, act, title, detail, kind: 'decision' });
    const list = [
      D2('inventory', 'A1', 'Confirm the system inventory is complete', 'No database, instance or SAP system in scope is missing.'),
      D2('drivers', 'A2', 'Confirm business drivers and success criteria with the sponsor', 'Drivers, deadline and budget expectations.'),
      D2('etl', 'A4', 'Validate the ETL inventory with the integration lead', 'Job counts, tools, scheduler and freshness needs.'),
      D2('bi', 'A5', 'Validate the BI inventory and retirement list with BI owners', 'Reports, models, consumers and unused content.'),
      D2('compliance', 'A6', 'Confirm security and compliance requirements with the CISO / DPO', 'Regulations, RLS, masking, network, keys and residency.'),
      D2('arch', 'A8', 'Approve the target architecture', 'Medallion layers, compute choices, workspace topology and governance.'),
      D2('sku', 'A9', 'Approve the capacity recommendation', 'F-SKU, non-production capacity and purchase model.'),
      D2('cost', 'A9', 'Approve the run-cost model and pricing assumptions', 'Regional prices, storage, licences and gateways.'),
      D2('effort', 'A10', 'Approve the effort estimate and contingency', 'Workstream estimates, team mix and day rates.'),
      D2('roadmap', 'A11', 'Approve the roadmap and wave sequence', 'Pilot choice, wave order, parallel run and decommissioning.'),
      D2('risks', 'A12', 'Review the risk register and assign owners', 'Likelihood, impact and mitigations.'),
      D2('summary', 'A13', 'Review the executive summary and sign off the assessment', 'Final read-out for the sponsor.')
    ];
    systems.forEach((x) => {
      list.push(D2('code:' + x.sys.id, 'A3', 'Review code complexity for ' + x.name, 'Score ' + x.cx.score + ' (' + x.cx.tier + '); drivers: ' + x.cx.drivers.join(', ') + '.'));
      list.push(D2('gaps:' + x.sys.id, 'A7', 'Review the Fabric gap analysis for ' + x.name, x.gaps.length + ' feature gap(s) identified.'));
      list.push(D2('pattern:' + x.sys.id, 'A8', 'Approve the migration pattern for ' + x.name, x.pattern.name + '.'));
      if (x.sys.disc) list.push(D2('disc:' + x.sys.id, 'A1', 'Spot-check discovery output for ' + x.name, 'Compare five objects and the total size with the source.'));
    });
    return list;
  }

  function completion(c, systems, items, decisions) {
    const V = c.state.validations || {};
    const actInputs = {};
    KB.ACTIVITIES.forEach((a) => { actInputs[a.id] = []; });
    items.forEach((it) => {
      const sec = it.field.sec;
      KB.ACTIVITIES.forEach((a) => {
        if (a.secs.indexOf('*') >= 0 || a.secs.indexOf(sec) >= 0 || (a.id === 'A1' && it.scope !== 'g' && sec === 'inventory')) actInputs[a.id].push(it);
      });
    });
    const confOf = (arr) => { const W = sum(arr.map((x) => x.w)); return W ? sum(arr.map((x) => x.w * x.r.cc)) / W : 0; };
    const nSys = systems.length || 1;
    const jobs = c.gv('etl_jobs') || 0; const reps = c.gv('bi_reports') || 0;
    const allInputs = items;
    const inputConf = confOf(allInputs);
    const acts = KB.ACTIVITIES.map((a) => {
      const base = a.base + (a.perSystem || 0) * nSys + (a.perJobs ? jobs / a.perJobs : 0) + (a.perReports ? reps / a.perReports : 0);
      const conf = a.secs.indexOf('*') >= 0 ? inputConf : confOf(actInputs[a.id]);
      let agentic = a.ceil * conf;
      if (a.id === 'A3' && systems.some((x) => x.sys.ai && x.sys.ai.code)) agentic = Math.min(a.ceil, agentic + 0.05);
      const dec = decisions.filter((d) => d.act === a.id);
      const lowInputs = actInputs[a.id].filter((x) => x.r.conf < 0.6 && x.w >= 2);
      const vItems = dec.length + lowInputs.length;
      const done = dec.filter((d) => V[d.key] && V[d.key].status && V[d.key].status !== 'pending').length + lowInputs.filter((x) => x.r.src === 'val' || (V['i:' + x.key] && V['i:' + x.key].status === 'confirmed')).length;
      const vFrac = vItems ? done / vItems : 0;
      const complete = agentic + (1 - agentic) * vFrac;
      return { id: a.id, label: a.label, base: round(base, 1), conf, agentic, vFrac, complete, remaining: base * (1 - complete), items: vItems, done };
    });
    const B = sum(acts.map((a) => a.base));
    const agentic = sum(acts.map((a) => a.base * a.agentic)) / B;
    const complete = sum(acts.map((a) => a.base * a.complete)) / B;
    return { acts, baseline: B, agentic, complete, validated: complete - agentic, remainingDays: sum(acts.map((a) => a.remaining)), inputConf };
  }

  /* ---------- main entry ---------- */
  E.compute = (state) => {
    const c = makeCtx(state);
    const R = state.rates || KB.DEFAULT_RATES;
    const pre = c.systems.map((s) => { const f = systemFacts(c, s); return { sys: s, f, name: c.sv(s, 's_name') || PLAT(s).short, cx: complexity(f) }; });
    const items = inputItems(c);
    const inputConf0 = (() => { const W = sum(items.map((x) => x.w)); return W ? sum(items.map((x) => x.w * x.r.conf)) / W : 0.35; })();
    // preliminary strategy (no deadline info yet) -> patterns -> effort -> plan; then re-check deadline
    let strat = overallStrategy(c, null);
    const run = (st) => {
      const systems = pre.map((x) => { const pt = pattern(c, x.sys, x.f, st); return Object.assign({}, x, { pattern: pt, gaps: gaps(c, x.sys, x.f) }); });
      const eff = effort(c, systems, st, inputConf0, R);
      const pl = plan(c, systems, eff, st);
      return { systems, eff, pl };
    };
    let res = run(strat);
    if ((c.gv('tgt_strategy') || 'recommend') === 'recommend' && res.pl.deadline && res.pl.deadline.months < res.pl.months * 1.1 && strat.key !== 'lift') {
      strat = { key: 'lift', why: 'The hard deadline leaves little room for redesign' };
      res = run(strat);
    }
    const { systems, eff, pl } = res;
    const cap = capacity(c, systems, R);
    const rk = risks(c, systems, cap, eff, pl, inputConf0);
    const decisions = decisionItems(c, systems);
    const comp = completion(c, systems, items, decisions);
    const totals = {
      tb: sum(systems.map((x) => x.f.tb)), tables: sum(systems.map((x) => x.f.tables || 0)), views: sum(systems.map((x) => x.f.views || 0)),
      procs: sum(systems.map((x) => x.f.codeObjs || 0)), loc: sum(systems.map((x) => x.f.loc || 0)), objects: sum(systems.map((x) => x.f.objects || 0))
    };
    const overall = systems.length ? Math.round(sum(systems.map((x) => x.cx.score * Math.max(1, Math.log10(x.f.objects + 10)))) / sum(systems.map((x) => Math.max(1, Math.log10(x.f.objects + 10))))) : 0;
    const arch = architecture(c, systems, cap);
    const nba = nextActions(c, systems, items, decisions, comp);
    const legacy = c.gv('org_legacy_cost');
    const fabricYear = cap.cost.years[0];
    const roi = legacy ? { legacy, fabricYear, savings: legacy - fabricYear, paybackMonths: (legacy - fabricYear) > 0 ? eff.cost / ((legacy - fabricYear) / 12) : null, threeYearNet: 3 * legacy - cap.cost.threeYear - eff.cost } : null;
    const result = { ctx: c, systems, eff, plan: pl, cap, risks: rk, decisions, items, comp, totals, overall: { score: overall, tier: TIER(overall) }, strategy: strat, arch, nba, roi };
    result.summary = summaryText(result);
    result.assumptions = assumptions(result);
    return result;
  };

  function architecture(c, systems, cap) {
    const ingest = {}; systems.forEach((x) => { x.pattern.items.forEach((i) => { ingest[i] = (ingest[i] || []).concat([x.name]); }); });
    const cps = systems.map((x) => computePref(c, x.f));
    const gold = cps.some((k) => k === 'warehouse' || k === 'both') ? 'Warehouse' : 'Lakehouse';
    const rt = ['near_rt', 'rt'].indexOf(c.gv('etl_latency')) >= 0;
    const ai = c.gv('bi_ai'); const ds = (c.gv('bi_ds') || []).filter((x) => x !== 'none');
    const envs = parseInt(c.gv('ops_envs') || '3', 10);
    const mods = []; systems.forEach((x) => { (x.f.modules || []).forEach((m) => mods.push(m)); });
    const domainSet = new Set();
    if (mods.some((m) => ['fi', 'co'].indexOf(m) >= 0)) domainSet.add('Finance');
    if (mods.some((m) => ['sd', 'crm'].indexOf(m) >= 0)) domainSet.add('Sales & customer');
    if (mods.some((m) => ['mm', 'pp', 'wm', 'ewm', 'tm', 'pm', 'qm'].indexOf(m) >= 0)) domainSet.add('Supply chain & operations');
    if (mods.indexOf('hcm') >= 0) domainSet.add('People');
    ['Finance', 'Sales & customer', 'Operations'].forEach((d) => { if (domainSet.size < 3) domainSet.add(d); });
    const domains = Array.from(domainSet).slice(0, 6);
    const workspaces = (domains.length * 2 + 2) * Math.max(1, envs);
    return {
      gold, rt, ai: ai && ai !== 'none', ds: ds.length > 0, ingest, domains, envNames: envs === 1 ? ['Prod'] : envs === 2 ? ['Dev', 'Prod'] : envs === 3 ? ['Dev', 'Test', 'Prod'] : ['Dev', 'Test', 'UAT', 'Prod'],
      workspaces, purview: (c.gv('sec_catalog') || []).indexOf('purview') >= 0 || (c.gv('org_ms') || []).indexOf('purview') >= 0,
      network: c.gv('sec_network'), gateways: systems.some((x) => ON_PREM.indexOf(x.f.deploy) >= 0 || x.f.deploy === 'iaas'), devops: c.gv('ops_devops'), sku: cap.sku
    };
  }

  function nextActions(c, systems, items, decisions, comp) {
    const out = [];
    const gainFor = (pred, newConf) => {
      const W = sum(items.map((x) => x.w)); if (!W) return 0;
      const after = sum(items.map((x) => x.w * (pred(x) ? Math.max(x.r.cc, newConf) : x.r.cc))) / W;
      return Math.max(0, (after - comp.inputConf) * 0.83);
    };
    systems.forEach((x) => {
      if (!x.sys.disc && x.f.p.script) {
        const g = gainFor((it) => it.sys === x.sys && ['inventory', 'code', 'workload'].indexOf(it.field.sec) >= 0, 0.95);
        out.push({ kind: 'discovery', sys: x.sys.id, title: 'Run the ' + (KB.SCRIPTS[x.f.p.script] || {}).label + ' discovery script for ' + x.name, gain: g, view: 'discovery' });
      }
      if ((x.f.fam === 'db' || x.f.fam === 'hana') && !(x.sys.ai && x.sys.ai.code) && x.f.scope === 'full' && c.s(x.sys, 's_code_mix').conf < 0.8) {
        out.push({ kind: 'code', sys: x.sys.id, title: 'Let the AI agent analyze code samples from ' + x.name, gain: gainFor((it) => it.sys === x.sys && it.field.id === 's_code_mix', 0.8) + 0.004, view: 'agent' });
      }
    });
    const globalsLow = items.filter((it) => it.scope === 'g' && it.r.conf < 0.6);
    if (globalsLow.length >= 4) out.push({ kind: 'ai', title: 'Paste existing documents (RFP, architecture notes, inventories) into the AI agent', gain: gainFor((it) => it.scope === 'g' && it.r.conf < 0.6, 0.6), view: 'agent' });
    const top = items.filter((it) => it.r.conf < 0.6).sort((a, b) => b.w * (0.95 - b.r.conf) - a.w * (0.95 - a.r.conf)).slice(0, 8);
    if (top.length) out.push({ kind: 'answers', title: 'Answer the ' + top.length + ' highest-impact open questions', detail: top.map((t) => t.field.label + (t.sys ? ' (' + (c.sv(t.sys, 's_name') || '') + ')' : '')).join(' · '), gain: gainFor((it) => top.indexOf(it) >= 0, 0.95), keys: top.map((t) => t.key), view: 'validate' });
    const pend = decisions.filter((d) => !(c.state.validations[d.key] && c.state.validations[d.key].status && c.state.validations[d.key].status !== 'pending'));
    if (pend.length) out.push({ kind: 'validate', title: 'Review ' + pend.length + ' decision(s) waiting for human validation', gain: (1 - comp.complete) * 0.5, view: 'validate' });
    return out.sort((a, b) => b.gain - a.gain).slice(0, 6);
  }

  function summaryText(r) {
    const c = r.ctx; const t = r.totals; const name = c.gv('org_name') || 'The organization';
    const sysList = r.systems.map((x) => x.name + ' (' + fmtNum(x.f.tb) + ' TB)').join(', ');
    const pats = r.systems.map((x) => x.name + ': ' + (/^[A-Z][a-z]/.test(x.pattern.name) ? x.pattern.name.charAt(0).toLowerCase() + x.pattern.name.slice(1) : x.pattern.name)).join('; ');
    const lc = (t) => (/^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);
    const top = r.risks.slice(0, 3).map((x) => lc(x.title)).join('; ');
    const cost = r.cap.cost; const R = c.state.rates;
    const money = (v) => E.money(v, R.currency);
    const stratLabel = { lift: 'lift and shift first', replatform: 'replatform, modernizing where it pays back', modernize: 'full modernization on a medallion architecture' }[r.strategy.key];
    const paras = [];
    if (!r.systems.length) return ['Add the source systems in scope to generate the assessment.'];
    paras.push(name + ' has ' + r.systems.length + ' analytics platform' + (r.systems.length > 1 ? 's' : '') + ' in scope (' + sysList + '), about ' + fmtNum(t.tb) + ' TB in total, with roughly ' + fmtInt(t.tables) + ' tables, ' + fmtInt(t.procs) + ' procedural objects and ' + fmtInt(t.loc) + ' lines of code, feeding about ' + fmtInt(c.gv('bi_reports')) + ' reports for ' + fmtInt(c.gv('bi_viewers')) + ' consumers.');
    paras.push('Overall migration complexity is ' + r.overall.tier.toLowerCase() + ' (' + r.overall.score + '/100). The recommended strategy is ' + stratLabel + ' (' + r.strategy.why.toLowerCase() + '). Per system: ' + pats + '.');
    paras.push('Target platform: Microsoft Fabric with ' + (r.arch.gold === 'Warehouse' ? 'Lakehouse Bronze/Silver layers and a Warehouse Gold layer' : 'a Lakehouse medallion') + ', on F' + r.cap.sku.cu + ' for production' + (r.cap.np ? ' and F' + r.cap.np.cu + ' for development and test' : '') + '. Estimated run cost is ' + money(cost.monthly) + ' per month (' + (r.cap.reserved ? '1-year reservation for production' : 'pay-as-you-go') + '), including OneLake storage' + (cost.lic ? ', Power BI licences' : '') + (cost.gwN ? ' and data gateways' : '') + '.');
    paras.push('Delivery is estimated at ' + fmtInt(r.eff.total) + ' person-days including ' + Math.round(r.eff.cont * 100) + '% contingency (range ' + fmtInt(r.eff.low) + '–' + fmtInt(r.eff.high) + '), about ' + r.plan.months + ' months with a team of about ' + r.plan.fte + ', starting with a pilot on ' + (r.plan.pilot || 'the simplest system') + '. One-time delivery cost is about ' + money(r.eff.cost) + ' at the configured rates.');
    if (top) paras.push('Top risks: ' + top + '.');
    paras.push('The accelerator completed ' + Math.round(r.comp.agentic * 100) + '% of the assessment work automatically; ' + Math.round(r.comp.validated * 100) + '% has been validated by people, and about ' + fmtNum(r.comp.remainingDays, 0) + ' person-days of human validation remain.');
    return paras;
  }

  function assumptions(r) {
    const R = r.ctx.state.rates; const out = [];
    const money = (v) => E.money(v, R.currency, 2);
    out.push('Fabric capacity priced at ' + money(R.cuHourPayg) + ' per CU-hour pay-as-you-go and ' + E.money(R.cuYearReserved, R.currency) + ' per CU per year reserved (US East list prices, November 2026); check your region and agreement.');
    out.push('OneLake storage at ' + money(R.storageGbMonth) + ' per GB-month; Delta storage assumed at 60% of source size (90% for already-compressed platforms), Bronze + Silver + Gold ≈ 2× logical size; mirrored data gets 1 TB free per purchased CU.');
    out.push('Power BI Pro at ' + E.money(R.proUserMonth, R.currency) + ' per user-month; F64 and above lets free users view content.');
    out.push('Capacity heuristic: about 200 CU-seconds per GB processed, 20 CU-seconds per pipeline run, 8 CU-seconds per report interaction, 10 CU-seconds per direct SQL query (10–25% of the current query count moves to SQL; the rest becomes report interactions), 30% headroom. Validate with the Microsoft Fabric SKU Estimator and a pilot measured in the Capacity Metrics app.');
    out.push('Delivery effort at ' + E.money(R.blendedDayRate, R.currency) + ' blended per person-day (role multipliers applied); 17 productive days per person-month.');
    if (r.ctx.gv('tgt_ai_assist') === 'yes') out.push('AI-assisted code conversion reduces manual conversion effort to ' + Math.round(R.aiConversionFactor * 100) + '% and ETL effort to 85%.');
    if (r.ctx.gv('tgt_rationalize') === 'yes') out.push('Unused reports (' + (r.ctx.gv('bi_unused') || 0) + '%) and about 10% of ETL jobs are retired rather than migrated.');
    out.push('Contingency of ' + Math.round(r.eff.cont * 100) + '% reflects complexity and input confidence (' + Math.round(r.comp.inputConf * 100) + '%).');
    out.push('Third-party licences (SAP Datasphere, open-mirroring partners, CDC tools, code-conversion tools) and legacy decommissioning costs are not included.');
    const inferred = r.items.filter((it) => (it.r.src === 'default' || it.r.src === 'derived') && it.w >= 2);
    if (inferred.length) out.push(inferred.length + ' key inputs are estimates (benchmark defaults or derived values); they are listed in Validate.');
    return out;
  }

  E.money = (v, cur, d) => {
    if (v == null || !isFinite(v)) return '—';
    const sym = { USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', INR: '₹', JPY: '¥' }[cur] || '';
    const abs = Math.abs(v);
    if (d == null && abs >= 1e6) return sym + (v / 1e6).toFixed(abs >= 1e7 ? 1 : 2) + 'M' + (sym ? '' : ' ' + cur);
    return sym + Number(v).toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d == null ? 0 : Math.min(d, 2) }) + (sym ? '' : ' ' + cur);
  };

  E.makeCtx = makeCtx;
  root.FMA_ENGINE = E;
})(typeof window !== 'undefined' ? window : globalThis);
