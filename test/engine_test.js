require('../src/kb.js'); require('../src/engine.js'); require('../src/demo.js');
const fs = require('fs'); const path = require('path');
const E = globalThis.FMA_ENGINE; const KB = globalThis.FMA_KB;
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL:', m); } };

// 1. discovery parsing
for (const f of ['teradata_sample.csv', 'sqlserver_sample.csv', 'oracle_sample.csv', 'sap_sample.csv']) {
  const txt = fs.readFileSync(path.join(__dirname, 'samples', f), 'utf8');
  const p = E.parseDiscovery(txt); const plat = E.discoveryPlatform(p);
  const m = E.mapDiscovery(p, plat);
  console.log('\n==', f, '→', plat, 'rows', p.rows, 'ignored', p.ignored, 'errors', p.errors.length);
  console.log(' fields', JSON.stringify(m.fields));
  console.log(' global', JSON.stringify(m.global), 'notes', m.notes.length);
  ok(plat, 'platform detected for ' + f);
  ok(m.fields.s_data_tb > 0, 'data volume for ' + f);
}

// 2. demo compute
const st = globalThis.FMA_DEMO.build(E);
const t0 = Date.now(); const r = E.compute(st); const ms = Date.now() - t0;
console.log('\n== DEMO compute in', ms, 'ms');
r.systems.forEach((x) => console.log(' ', x.name.padEnd(28), 'TB', x.f.tb, 'obj', Math.round(x.f.objects), 'loc', Math.round(x.f.loc), '| cx', x.cx.score, x.cx.tier, '|', x.pattern.id, '|', x.pattern.target, '| gaps', x.gaps.length));
console.log(' overall', r.overall, 'strategy', r.strategy);
console.log(' capacity required CU', r.cap.required, 'bg', r.cap.bgCU, 'inter', r.cap.interCU, '→ F' + r.cap.sku.cu, 'np F' + (r.cap.np && r.cap.np.cu), 'util', r.cap.utilization.toFixed(2), r.cap.licenseNote);
console.log(' cost monthly', Math.round(r.cap.cost.monthly), 'prod', Math.round(r.cap.cost.prodMonth), 'storage', Math.round(r.cap.cost.storMonth), 'TB', r.cap.cost.storTb, 'lic', r.cap.cost.lic, '3y', Math.round(r.cap.cost.threeYear));
console.log(' DL maxRows', Math.round(r.cap.maxRows), r.cap.rowsSrc, 'dlSku F' + r.cap.dlSku.cu);
console.log(' effort base', Math.round(r.eff.base), 'cont', r.eff.cont.toFixed(2), 'total', Math.round(r.eff.total), 'cost', Math.round(r.eff.cost));
r.eff.ws.forEach((w) => console.log('   ', w.label.padEnd(46), Math.round(w.days)));
console.log(' plan months', r.plan.months, 'fte', r.plan.fte, 'pilot', r.plan.pilot, 'deadline', JSON.stringify(r.plan.deadline));
r.plan.rows.forEach((w) => console.log('   ', w.label.padEnd(60), 'start', w.start, 'dur', w.dur));
console.log(' risks', r.risks.length, r.risks.slice(0, 6).map((x) => x.sev + ':' + x.title).join(' | '));
console.log(' completion agentic', (r.comp.agentic * 100).toFixed(1), 'complete', (r.comp.complete * 100).toFixed(1), 'remaining days', r.comp.remainingDays.toFixed(1), 'baseline', r.comp.baseline.toFixed(1), 'inputConf', r.comp.inputConf.toFixed(2));
r.comp.acts.forEach((a) => console.log('   ', a.id, a.label.padEnd(42), 'base', a.base, 'agentic', (a.agentic * 100).toFixed(0) + '%', 'items', a.items, 'done', a.done));
console.log(' NBA', r.nba.map((x) => x.title + ' (+' + (x.gain * 100).toFixed(1) + ')').join(' | '));
console.log(' summary:\n  ' + r.summary.join('\n  '));
ok(r.systems.length === 5, '5 systems');
ok(r.cap.sku.cu >= 64, 'sku at least F64 for demo');
ok(r.eff.total > 500, 'effort sizeable');
ok(r.comp.agentic > 0.4 && r.comp.agentic < 0.95, 'agentic in range');

// 3. empty state + all-not-sure single system
const e0 = E.compute(E.newState());
ok(e0.systems.length === 0 && Array.isArray(e0.summary), 'empty state computes');
console.log('\n== EMPTY agentic', (e0.comp.agentic * 100).toFixed(1), 'sku F' + e0.cap.sku.cu, 'effort', Math.round(e0.eff.total));
for (const p of KB.PLATFORM_ORDER) {
  const s1 = E.newState(); s1.systems.push(E.newSystem(p, KB.PLATFORMS[p].short));
  const r1 = E.compute(s1);
  const x = r1.systems[0];
  console.log(' ', p.padEnd(9), 'TB', x.f.tb, 'cx', x.cx.score, x.cx.tier.padEnd(9), x.pattern.id.padEnd(15), 'F' + r1.cap.sku.cu, 'eff', Math.round(r1.eff.total), 'months', r1.plan.months, 'agentic', (r1.comp.agentic * 100).toFixed(0) + '%', 'risks', r1.risks.length);
  ok(isFinite(r1.eff.total) && r1.eff.total > 0, 'effort finite for ' + p);
  ok(isFinite(r1.cap.cost.monthly), 'cost finite for ' + p);
}
// 4. all fields marked not-sure explicitly
const s2 = globalThis.FMA_DEMO.build(E);
Object.keys(s2.g).forEach((k) => { s2.g[k].ns = true; });
const r2 = E.compute(s2);
console.log('\n== NOT-SURE everywhere agentic', (r2.comp.agentic * 100).toFixed(1));
// 5. validate everything → complete 100%
const s3 = globalThis.FMA_DEMO.build(E); const r3a = E.compute(s3);
r3a.decisions.forEach((d) => { s3.validations[d.key] = { status: 'confirmed' }; });
r3a.items.filter((it) => it.r.conf < 0.6 && it.w >= 2).forEach((it) => { if (!E.util.has(it.r.v)) { s3.validations['i:' + it.key] = { status: 'confirmed' }; return; } const tgt = it.scope === 'g' ? s3.g : s3.systems.find((s) => s.id === it.scope).a; tgt[it.field.id] = { v: it.r.v, src: 'val' }; });
const r3 = E.compute(s3);
console.log('== ALL VALIDATED complete', (r3.comp.complete * 100).toFixed(1), 'agentic', (r3.comp.agentic * 100).toFixed(1));
ok(r3.comp.complete > 0.99, 'validating every item completes the assessment');
ok(r3.comp.complete > 0.97, 'validated reaches ~100%');
console.log(fails ? '\n' + fails + ' FAILURES' : '\nALL CHECKS PASSED');

// debug: activities not fully validated
r3.comp.acts.filter((a) => a.complete < 0.999).forEach((a) => console.log('  not complete', a.id, a.items, a.done, a.vFrac.toFixed(2), a.agentic.toFixed(2)));
// per-platform breakdown for SAP
for (const p of ['sap_bw', 'sap_ecc', 'mssql']) {
  const s1 = E.newState(); s1.systems.push(E.newSystem(p, KB.PLATFORMS[p].short)); const r1 = E.compute(s1);
  console.log(' breakdown', p, r1.eff.ws.filter((w) => w.days > 1).map((w) => w.k + ' ' + Math.round(w.days)).join(', '));
}
