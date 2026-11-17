/* Fabric Migration Assessment Accelerator — validation, export, saved assessments, rates. */
(function () {
  'use strict';
  const APP = window.FMA_APP; const KB = window.FMA_KB; const E = window.FMA_ENGINE; const H = APP.H; const esc = H.esc; const U = E.util;

  /* ============ Validation & sign-off ============ */
  const STATUS_LBL = { confirmed: 'Confirmed', adjusted: 'Adjusted', rejected: 'Rejected', pending: 'Open' };
  function vStat(key) { const v = APP.S.validations[key]; return v && v.status ? v.status : 'pending'; }

  APP.views.validate = () => {
    const R = APP.R; const S = APP.S; const c = R.comp; const V = S.validations;
    const filt = APP.ui.vfilter || 'open';
    const lowInputs = R.items.filter((it) => it.r.conf < 0.6 && it.w >= 2);
    const inpDone = (it) => it.r.src === 'val' || (V['i:' + it.key] && V['i:' + it.key].status === 'confirmed');
    const openN = R.decisions.filter((d) => vStat(d.key) === 'pending').length + lowInputs.filter((it) => !inpDone(it)).length;
    let h = APP.pageHead('Validate', 'Validation & sign-off', 'The accelerator drafts the whole assessment. People confirm what needs judgement: estimated inputs and the key decisions. Completion rises as each item closes.', '');
    h += '<div class="kpis">' + APP.kpi('Complete', H.pct(c.complete), 'of the assessment work') + APP.kpi('Done by the accelerator', H.pct(c.agentic), 'confidence-weighted') +
      APP.kpi('Validated by people', H.pct(Math.max(0, c.validated)), R.decisions.filter((d) => vStat(d.key) !== 'pending').length + ' decisions closed') +
      APP.kpi('Validation left', H.fnum(c.remainingDays, 0) + ' d', openN + ' open ' + H.plural(openN, 'item') + ' · manual baseline ' + H.fnum(c.baseline, 0) + ' d') + '</div>';
    // activity breakdown
    const W = 760; const L = 290; const bh = 14; const gap = 12; const top = 6; const hh = top + c.acts.length * (bh + gap) + 6;
    let svg = '<svg viewBox="0 0 ' + W + ' ' + hh + '" width="' + W + '" role="img" aria-label="Agentic and human share by activity">';
    c.acts.forEach((a, i) => {
      const y = top + i * (bh + gap); const pw = W - L - 70;
      const aw = pw * a.agentic; const vw = pw * (a.complete - a.agentic);
      svg += '<text x="' + (L - 10) + '" y="' + (y + bh - 3) + '" text-anchor="end">' + esc(a.label) + '</text>' +
        '<g data-tip="' + esc(a.label + ': ' + H.pct(a.agentic) + ' agentic, ' + H.pct(a.complete - a.agentic) + ' validated, ' + H.fnum(a.remaining, 1) + ' d left of ' + H.fnum(a.base, 1) + ' d manual') + '">' +
        '<rect x="' + L + '" y="' + (y - 5) + '" width="' + (pw + 60) + '" height="' + (bh + 10) + '" fill="transparent"/>' +
        '<path d="' + APP.barPath(L, y, pw, bh, 4) + '" fill="var(--track)"/>' +
        (vw > 1 ? '<path d="' + APP.barPath(L, y, Math.max(0, aw - 1), bh, 0) + '" fill="var(--accent)"/><path d="' + APP.barPath(L + aw + 1, y, Math.max(0, vw - 1), bh, 4) + '" fill="var(--good)"/>'
          : '<path d="' + APP.barPath(L, y, Math.max(0, aw), bh, 4) + '" fill="var(--accent)"/>') + '</g>' +
        '<text x="' + (L + pw + 8) + '" y="' + (y + bh - 3) + '" class="t-strong">' + H.pct(a.complete) + '</text>';
    });
    svg += '</svg>';
    h += '<div class="card" style="margin-top:16px"><div class="card-h"><div><h3>Agentic and human share by assessment activity</h3><p class="sub">Each activity is weighted by the effort it takes in a manual assessment. The agentic share is capped by how much judgement the activity needs.</p></div></div>' +
      '<div class="chart">' + svg + '</div><div class="legend" style="margin-top:6px"><span><i style="background:var(--accent)"></i>Done by the accelerator</span><span><i style="background:var(--good)"></i>Validated by people</span><span><i style="background:var(--track)"></i>Left to validate</span></div></div>';
    // reviewer + filter
    h += '<div class="card" style="margin-top:16px"><div class="card-h"><div class="row" style="gap:10px"><label for="reviewer" class="small muted">Reviewer</label><input id="reviewer" class="inp" style="width:280px" data-ch="reviewer" placeholder="Name and role, e.g. Priya N., lead architect" value="' + esc(S.reviewer || '') + '"></div>' +
      '<div class="seg" role="group" aria-label="Filter">' + [['open', 'Open (' + openN + ')'], ['all', 'All'], ['done', 'Done']].map(([k, l]) => '<button aria-pressed="' + (filt === k) + '" data-act="vfilter" data-f="' + k + '">' + esc(l) + '</button>').join('') + '</div></div>';
    let any = false;
    c.acts.forEach((a) => {
      const decs = R.decisions.filter((d) => d.act === a.id);
      const insU = lowInputs.filter((it) => it.act === a.id);
      const show = (done) => filt === 'all' || (filt === 'open' ? !done : done);
      const dHtml = decs.filter((d) => show(vStat(d.key) !== 'pending')).map(decisionRow).join('');
      const iHtml = insU.filter((it) => show(inpDone(it))).map(inputRow).join('');
      if (!dHtml && !iHtml) return;
      any = true;
      h += '<div class="sec-h" style="margin-top:14px"><h3>' + esc(a.label) + '</h3><span class="small muted">' + H.pct(a.complete) + ' complete · ' + H.fnum(a.remaining, 1) + ' d left</span></div>' + dHtml + iHtml;
    });
    if (!any) h += '<p class="sub" style="padding:8px 0">' + (filt === 'open' ? 'Nothing open. Every decision and estimated key input has been reviewed.' : 'Nothing to show.') + '</p>';
    h += '</div>';
    // sign-off
    const so = V['d:summary'];
    h += '<div class="card" style="margin-top:16px"><h3>Sign-off</h3>' + (so && so.status === 'confirmed' ? '<p style="margin-top:6px">Signed off by <b>' + esc(so.by || 'reviewer') + '</b> on ' + H.date(so.at) + '.' + (so.note ? ' Note: ' + esc(so.note) : '') + '</p>' :
      '<p class="sub" style="margin-top:6px">Confirm "Review the executive summary and sign off the assessment" when the read-out is accepted. Open items stay listed in the report.</p>') + '</div>';
    return h;
  };
  function decisionRow(d) {
    const st = vStat(d.key); const v = APP.S.validations[d.key] || {};
    return '<div class="vitem"><div><div class="t">' + esc(d.title) + '</div><div class="d">' + esc(d.detail) + '</div>' + (st !== 'pending' ? '<div class="small" style="margin-top:3px"><span class="status ' + st + '">' + STATUS_LBL[st] + '</span>' + (v.by ? ' by ' + esc(v.by) : '') + (v.at ? ' · ' + H.date(v.at) : '') + '</div>' : '') + '</div>' +
      '<div class="row" style="gap:6px;align-self:start">' + ['confirmed', 'adjusted', 'rejected'].map((s) => '<button class="btn sm' + (st === s ? ' primary' : '') + '" data-act="vset" data-key="' + esc(d.key) + '" data-s="' + s + '" aria-pressed="' + (st === s) + '">' + ({ confirmed: 'Confirm', adjusted: 'Adjusted', rejected: 'Reject' }[s]) + '</button>').join('') + (st !== 'pending' ? '<button class="btn sm ghost" data-act="vset" data-key="' + esc(d.key) + '" data-s="pending">Reopen</button>' : '') + '</div>' +
      '<div class="note"><input data-ch="vnote" data-key="' + esc(d.key) + '" value="' + esc(v.note || '') + '" placeholder="Note or evidence (optional)" aria-label="Note for ' + esc(d.title) + '"></div></div>';
  }
  function inputRow(it) {
    const R = APP.R; const V = APP.S.validations; const done = it.r.src === 'val' || (V['i:' + it.key] && V['i:' + it.key].status === 'confirmed');
    const where = it.sys ? R.ctx.sv(it.sys, 's_name') : 'Estate';
    return '<div class="vitem"><div><div class="t">' + esc(it.field.label) + ' <span class="small muted">· ' + esc(where) + '</span></div><div class="d">Using <b>' + esc(APP.displayVal(it.field, it.r.v, it.sys ? it.sys.id : 'g')) + '</b> ' + APP.srcChip(it.r.src) + ' ' + esc(it.r.why) + '</div></div>' +
      '<div class="row" style="gap:6px;align-self:start">' + (done ? '<span class="status confirmed">Confirmed</span>' : (U.has(it.r.v) ? '<button class="btn sm" data-act="vinput" data-k="' + esc(it.key) + '">Confirm value</button>' : '<button class="btn sm" data-act="vinput" data-k="' + esc(it.key) + '">Accept as unknown</button>')) +
      '<button class="btn sm ghost" data-act="vedit" data-k="' + esc(it.key) + '">Edit answer</button></div></div>';
  }
  APP.act.vfilter = (el) => { APP.ui.vfilter = el.dataset.f; APP.render(); };
  APP.act.reviewer = (el) => { APP.commit((S) => { S.reviewer = el.value.trim(); }, { render: false }); };
  APP.act.vset = (el) => {
    const key = el.dataset.key; const st = el.dataset.s;
    APP.commit((S) => { const cur = S.validations[key] || {}; if (st === 'pending') S.validations[key] = { status: 'pending', note: cur.note || '' }; else S.validations[key] = { status: st, note: cur.note || '', by: S.reviewer || '', at: new Date().toISOString() }; });
    if (st === 'confirmed' && key === 'd:summary') APP.toast('Assessment signed off.');
  };
  APP.act.vnote = (el) => { const key = el.dataset.key; APP.commit((S) => { const cur = S.validations[key] || { status: 'pending' }; cur.note = el.value.trim(); S.validations[key] = cur; }, { render: false }); };
  APP.act.vinput = (el) => {
    const k = el.dataset.k; const [scope, id] = APP.splitKey(k); const r = APP.resOf(scope, id);
    APP.commit((S) => { if (U.has(r.v)) APP.setAnswer(k, r.v, 'val', { by: S.reviewer || '' }); else S.validations['i:' + k] = { status: 'confirmed', by: S.reviewer || '', at: new Date().toISOString() }; });
  };
  APP.act.vedit = (el) => {
    const k = el.dataset.k; const [scope, id] = APP.splitKey(k);
    let view;
    if (scope === 'g') view = E.GF[id].sec; else { APP.sel = scope; view = 'systems'; }
    APP.go(view);
    setTimeout(() => { const fe = document.getElementById('f-' + k.replace(/[^a-zA-Z0-9_-]/g, '_')); if (fe) { fe.scrollIntoView({ block: 'center' }); try { fe.focus({ preventScroll: true }); } catch (e) { fe.focus(); } } }, 30);
  };

  /* ============ Files: zip, save, copy, csv ============ */
  let CRC = null;
  function crc32(u8) { if (!CRC) { CRC = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } } let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  APP.zip = (files) => {
    const enc = new TextEncoder(); const parts = []; const central = []; let offset = 0;
    const d = new Date(); const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1); const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    files.forEach((f) => {
      const name = enc.encode(f.name); const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data; const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    });
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    const all = parts.concat(central, [new Uint8Array(end.buffer)]);
    const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0)); let p = 0; all.forEach((b) => { out.set(b, p); p += b.length; });
    return out;
  };
  APP.saveFile = async (filename, data) => {
    const dl = APP.caps.downloads;
    if (!dl) { APP.toast(APP.caps.ready ? 'Downloads are not available in this view. Use the Copy buttons instead.' : 'Still connecting… try again in a moment.'); return false; }
    try { await dl.save({ filename, data }); return true; }
    catch (e) {
      const c = e && e.code; if (c === 'declined') return false;
      if (c === 'rejected_extension' || c === 'extension_not_enabled') APP.toast('This file type cannot be downloaded here.');
      else if (c === 'rate_limited') APP.toast('A download prompt is already open.');
      else if (c === 'too_large') APP.toast('The file is too large for this destination.');
      else if (c === 'bad_request' || c === 'transform_error') APP.toast('The file could not be prepared.');
      else { APP.caps.downloads = null; APP.toast('Downloads are not available in this view. Use the Copy buttons instead.'); APP.render(); }
      return false;
    }
  };
  APP.copyText = async (text, okMsg) => {
    try { await navigator.clipboard.writeText(text); APP.toast(okMsg || 'Copied'); }
    catch (e) { APP.modal('Copy manually', '<p class="small muted" style="margin-bottom:8px">The clipboard is not available here. Select the text and copy it.</p><textarea class="mono" style="min-height:260px;width:100%" readonly>' + esc(text) + '</textarea>', [{ label: 'Close', primary: true, value: true }]); }
  };
  const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const slug = () => (APP.S.name || 'fabric-assessment').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'fabric-assessment';

  /* ---------- tabular extracts (shared by CSV, XLSX and report) ---------- */
  function T() {
    const R = APP.R; const S = APP.S; const c = R.ctx; const k = 1 + R.eff.cont; const V = S.validations;
    const inputs = [['Scope', 'Section', 'Question', 'Value used', 'Source', 'Basis']];
    KB.GLOBAL_FIELDS.forEach((f) => { const r = c.g(f.id); inputs.push(['Estate', f.sec, f.label, APP.displayVal(f, r.v, 'g'), KB.SOURCE_LABEL[r.src], r.why]); });
    c.systems.forEach((s) => E.fieldsForSystem(s).forEach((f) => { const r = c.s(s, f.id); inputs.push([c.sv(s, 's_name'), f.sec, f.label, APP.displayVal(f, r.v, s.id), KB.SOURCE_LABEL[r.src], r.why]); }));
    return {
      summary: [['Item', 'Value'], ['Assessment', S.name], ['Client', c.gv('org_name') || ''], ['Generated', new Date().toISOString().slice(0, 10)], ['Overall complexity', R.overall.tier + ' (' + R.overall.score + '/100)'], ['Strategy', (APP.stratLabel[R.strategy.key] || R.strategy.key) + ': ' + R.strategy.why],
        ['Production capacity', 'F' + R.cap.sku.cu], ['Dev/test capacity', R.cap.np ? 'F' + R.cap.np.cu : 'none'], ['Capacity needed (CU)', R.cap.required], ['Monthly run cost', Math.round(R.cap.cost.monthly)], ['3-year run cost', Math.round(R.cap.cost.threeYear)],
        ['Effort (person-days, incl. contingency)', Math.round(R.eff.total)], ['Contingency', Math.round(R.eff.cont * 100) + '%'], ['Effort range', Math.round(R.eff.low) + '–' + Math.round(R.eff.high)], ['Delivery cost', Math.round(R.eff.cost)], ['Duration (months)', R.plan.months], ['Team (FTE)', R.plan.fte],
        ['Agentic completion', Math.round(R.comp.agentic * 100) + '%'], ['Validated', Math.round(R.comp.validated * 100) + '%'], ['Complete', Math.round(R.comp.complete * 100) + '%'], ['Validation left (person-days)', Math.round(R.comp.remainingDays)], ['Currency', S.rates.currency]].concat(R.summary.map((p, i) => ['Summary ' + (i + 1), p])),
      systems: [['System', 'Platform', 'Role', 'Scope', 'Data (TB)', 'Tables', 'Views', 'Procedural objects', 'Lines of code', 'Queries/day', 'Complexity', 'Score', 'Pattern', 'Target', 'Discovery']].concat(R.systems.map((x) => [x.name, x.f.p.label, x.f.role, x.f.scope, U.round(x.f.tb, 2), Math.round(x.f.tables || 0), Math.round(x.f.views || 0), Math.round(x.f.codeObjs || 0), Math.round(x.f.loc || 0), Math.round(x.f.queries || 0), x.cx.tier, x.cx.score, x.pattern.name, x.pattern.target, x.sys.disc ? 'imported ' + (x.sys.disc.at || '').slice(0, 10) : 'not run'])),
      inputs,
      gaps: [['System', 'Feature', 'Gap', 'Approach in Fabric']].concat([].concat(...R.systems.map((x) => x.gaps.map((g) => [x.name, g.label, g.gap, g.fabric])))),
      effort: [['Workstream', 'Base (person-days)', 'With contingency', 'Drivers']].concat(R.eff.ws.filter((w) => w.days > 0.5).map((w) => [w.label, Math.round(w.days), Math.round(w.days * k), w.drivers.join('; ')])).concat([['Total', Math.round(R.eff.base), Math.round(R.eff.total), '']]),
      roles: [['Role', 'Person-days', 'Cost']].concat(Object.keys(KB.ROLES).filter((r) => R.eff.roles[r] > 0.5).map((r) => [KB.ROLES[r].label, Math.round(R.eff.roles[r]), Math.round(R.eff.roles[r] * S.rates.blendedDayRate * KB.ROLES[r].mult)])),
      roadmap: [['Phase', 'Start week', 'Duration (weeks)', 'Effort (person-days)']].concat(R.plan.rows.map((r) => [r.label, Math.round(r.start), Math.round(r.dur), Math.round(r.effort)])),
      risks: [['ID', 'Severity', 'Risk', 'Detail', 'Likelihood', 'Impact', 'Score', 'Mitigation', 'Owner', 'Category']].concat(R.risks.map((r) => [r.id, r.sev, r.title, r.detail, r.L, r.I, r.score, r.mitigation, r.owner, r.cat])),
      validation: [['Activity', 'Item', 'Status', 'By', 'Date', 'Note']].concat(R.decisions.map((d) => { const v = V[d.key] || {}; return [d.act + ' ' + (KB.ACTIVITIES.find((a) => a.id === d.act) || {}).label, d.title, STATUS_LBL[v.status || 'pending'], v.by || '', (v.at || '').slice(0, 10), v.note || '']; })),
      activities: [['Activity', 'Manual baseline (days)', 'Agentic %', 'Validated %', 'Complete %', 'Remaining (days)']].concat(R.comp.acts.map((a) => [a.label, a.base, Math.round(a.agentic * 100), Math.round((a.complete - a.agentic) * 100), Math.round(a.complete * 100), U.round(a.remaining, 1)])),
      assumptions: [['Assumption']].concat(R.assumptions.map((a) => [a])),
      cost: [['Item', 'Per month', 'Per year']].concat([['Production F' + R.cap.sku.cu, R.cap.cost.prodMonth, R.cap.cost.prodMonth * 12], ['Dev/test', R.cap.cost.npMonth, R.cap.cost.npMonth * 12], ['OneLake storage', R.cap.cost.storMonth, R.cap.cost.storMonth * 12], ['Power BI licences', R.cap.cost.lic, R.cap.cost.lic * 12], ['Gateways', R.cap.cost.gwMonth, R.cap.cost.gwMonth * 12], ['Total', R.cap.cost.monthly, R.cap.cost.monthly * 12]].map((r) => [r[0], Math.round(r[1]), Math.round(r[2])]))
    };
  }
  APP.tables = T;

  APP.act.exportJson = () => APP.saveFile(slug() + '.json', JSON.stringify(Object.assign({}, APP.S, { _exported: new Date().toISOString(), _kb: KB.VERSION }), null, 1));
  APP.act.copyJson = () => APP.copyText(JSON.stringify(APP.S), 'Assessment file copied');
  APP.act.exportCsv = (el) => { const t = T()[el.dataset.t]; APP.saveFile(slug() + '-' + el.dataset.t + '.csv', '﻿' + toCsv(t)); };
  APP.act.copySummary = () => APP.copyText(APP.R.summary.join('\n\n'), 'Executive summary copied');
  APP.act.exportScripts = () => APP.act.dlAllScripts();

  /* minimal OOXML workbook writer (no external library): inline strings, bold frozen header, number formats */
  function xlsx(sheets) {
    const x = (v) => String(v).slice(0, 32000).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const col = (i) => { let s = ''; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
    const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'; const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'; const PNS = 'http://schemas.openxmlformats.org/package/2006/relationships';
    const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    const sheetXml = (sh) => {
      const rows = sh.rows.map((r, ri) => '<row r="' + (ri + 1) + '">' + r.map((v, ci) => {
        const ref = col(ci) + (ri + 1);
        if (v == null || v === '') return '';
        if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '" s="' + (ri === 0 ? 1 : Number.isInteger(v) ? 2 : 3) + '"><v>' + v + '</v></c>';
        return '<c r="' + ref + '" t="inlineStr"' + (ri === 0 ? ' s="1"' : '') + '><is><t xml:space="preserve">' + x(v) + '</t></is></c>';
      }).join('') + '</row>').join('');
      const widths = sh.widths || sh.rows[0].map(() => 18);
      return head + '<worksheet xmlns="' + NS + '"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
        '<cols>' + widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols><sheetData>' + rows + '</sheetData></worksheet>';
    };
    const files = [
      { name: '[Content_Types].xml', data: head + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets.map((sh, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>' },
      { name: '_rels/.rels', data: head + '<Relationships xmlns="' + PNS + '"><Relationship Id="rId1" Type="' + RNS + '/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: head + '<workbook xmlns="' + NS + '" xmlns:r="' + RNS + '"><sheets>' + sheets.map((sh, i) => '<sheet name="' + x(sh.name.replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: head + '<Relationships xmlns="' + PNS + '">' + sheets.map((sh, i) => '<Relationship Id="rId' + (i + 1) + '" Type="' + RNS + '/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="' + RNS + '/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: head + '<styleSheet xmlns="' + NS + '"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
        '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' }
    ].concat(sheets.map((sh, i) => ({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(sh) })));
    return APP.zip(files);
  }
  APP.xlsx = xlsx;
  APP.act.exportXlsx = () => {
    const t = T();
    const sheets = [['Summary', t.summary, [40, 110]], ['Systems', t.systems], ['Inputs', t.inputs, [22, 10, 46, 30, 18, 70]], ['Fabric gaps', t.gaps, [24, 40, 10, 90]],
      ['Effort', t.effort, [44, 16, 16, 90]], ['Team', t.roles, [36, 14, 14]], ['Cost', t.cost, [30, 14, 14]], ['Roadmap', t.roadmap, [60, 12, 16, 18]],
      ['Risks', t.risks, [16, 10, 50, 70, 10, 10, 8, 70, 22, 14]], ['Validation', t.validation, [44, 60, 12, 24, 12, 50]], ['Completion', t.activities, [44, 20, 12, 12, 12, 16]], ['Assumptions', t.assumptions, [150]]]
      .map(([name, rows, widths]) => ({ name, rows, widths }));
    return APP.saveFile(slug() + '.xlsx', xlsx(sheets));
  };

  /* ---------- printable report ---------- */
  function tableHtml(rows, numCols) {
    numCols = numCols || [];
    return '<table class="tbl"><thead><tr>' + rows[0].map((hh, i) => '<th' + (numCols.indexOf(i) >= 0 ? ' class="n"' : '') + '>' + esc(hh) + '</th>').join('') + '</tr></thead><tbody>' +
      rows.slice(1).map((r) => '<tr' + (r[0] === 'Total' ? ' class="total"' : '') + '>' + r.map((v, i) => '<td' + (numCols.indexOf(i) >= 0 ? ' class="n"' : '') + '>' + esc(typeof v === 'number' ? H.fnum(v, 1) : v) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  }
  APP.buildReport = () => {
    const R = APP.R; const S = APP.S; const c = R.ctx; const t = T(); const css = (document.getElementById('app-css') || {}).textContent || '';
    const nr = S.ai && S.ai.narrative; const so = S.validations['d:summary'];
    const sec = (id, title, body) => '<section id="' + id + '"><h2>' + esc(title) + '</h2>' + body + '</section>';
    let b = '<header class="cover"><div class="eyebrow">Microsoft Fabric migration assessment</div><h1>' + esc(S.name || 'Fabric migration assessment') + '</h1>' +
      '<p class="sub">' + esc(c.gv('org_name') || '') + ' · ' + H.date(new Date().toISOString()) + (S.reviewer ? ' · reviewed by ' + esc(S.reviewer) : '') + '</p>' +
      '<div class="kpis" style="margin-top:16px">' + APP.kpi('Complete', H.pct(R.comp.complete), H.pct(R.comp.agentic) + ' agentic · ' + H.pct(Math.max(0, R.comp.validated)) + ' validated') + APP.kpi('Complexity', esc(R.overall.tier), R.overall.score + ' / 100') +
      APP.kpi('Capacity', 'F' + R.cap.sku.cu, H.money(R.cap.cost.monthly) + ' / month') + APP.kpi('Effort', H.fmt(R.eff.total) + ' d', H.fnum(R.plan.months, 0) + ' months · team ' + R.plan.fte) + '</div>' +
      '<p class="small" style="margin-top:12px">' + (so && so.status === 'confirmed' ? 'Signed off by ' + esc(so.by || 'reviewer') + ' on ' + H.date(so.at) + '.' : '<b>Draft:</b> not yet signed off. ' + APP.pendingCount() + ' validation items open.') + ' Generated by the Fabric Migration Assessment Accelerator (knowledge base ' + KB.VERSION + ').</p></header>';
    b += sec('s1', '1. Executive summary', R.summary.map((p) => '<p>' + esc(p) + '</p>').join('') + (nr ? '<h3>Narrative</h3><p style="white-space:pre-wrap">' + esc(nr.text) + '</p><div class="grid2"><div><h3>Recommendations</h3><ul>' + nr.recs.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div><div><h3>Questions to validate</h3><ul>' + nr.questions.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div></div>' : ''));
    const sysRows = [['System', 'Platform', 'Role', 'Data (TB)', 'Tables', 'Procedural objects', 'Lines of code', 'Complexity', 'Pattern']].concat(R.systems.map((x) => [x.name, x.f.p.label, x.f.role, U.round(x.f.tb, 1), Math.round(x.f.tables || 0), Math.round(x.f.codeObjs || 0), Math.round(x.f.loc || 0), x.cx.tier + ' (' + x.cx.score + ')', x.pattern.name]));
    b += sec('s2', '2. Current estate', tableHtml(sysRows, [3, 4, 5, 6]) + R.systems.map((x) => '<h3>' + esc(x.name) + ' · ' + esc(x.cx.tier) + ' complexity (' + x.cx.score + ')</h3><p><b>Pattern:</b> ' + esc(x.pattern.name) + '. <b>Target:</b> ' + esc(x.pattern.target) + '.</p><ul>' + x.pattern.ingest.concat(x.pattern.code ? [x.pattern.code] : [], x.pattern.prereqs, x.pattern.notes).map((y) => '<li>' + esc(y) + '</li>').join('') + '</ul>' +
      (x.gaps.length ? tableHtml([['Feature', 'Gap', 'Approach in Fabric']].concat(x.gaps.map((g) => [g.label, g.gap, g.fabric]))) : '')).join(''));
    b += sec('s3', '3. Target architecture', APP.archSvg(R));
    b += sec('s4', '4. Capacity & cost', '<p>Production <b>F' + R.cap.sku.cu + '</b>' + (R.cap.np ? ', dev/test <b>F' + R.cap.np.cu + '</b>' : '') + '; about ' + H.fnum(R.cap.required, 0) + ' CU needed including 30% headroom. ' + esc(R.cap.licenseNote || '') + '</p>' + tableHtml(t.cost, [1, 2]) + (R.roi ? '<p>Legacy run cost ' + H.money(R.roi.legacy) + ' per year versus ' + H.money(R.roi.fabricYear) + ' on Fabric: ' + H.money(R.roi.savings) + ' saved per year' + (R.roi.paybackMonths ? ', payback in about ' + H.fnum(R.roi.paybackMonths, 0) + ' months' : '') + '.</p>' : ''));
    b += sec('s5', '5. Effort & team', tableHtml(t.effort, [1, 2]) + tableHtml(t.roles, [1, 2]));
    b += sec('s6', '6. Roadmap', APP.gantt(R.plan) + tableHtml(t.roadmap, [1, 2, 3]));
    b += sec('s7', '7. Risks', tableHtml([['Severity', 'Risk', 'L', 'I', 'Mitigation', 'Owner']].concat(R.risks.map((r) => [r.sev, r.title + ': ' + r.detail, r.L, r.I, r.mitigation, r.owner])), [2, 3]));
    b += sec('s8', '8. Assumptions', '<ul>' + R.assumptions.map((a) => '<li>' + esc(a) + '</li>').join('') + '</ul>');
    b += sec('s9', '9. Validation status', tableHtml(t.activities, [1, 2, 3, 4, 5]) + tableHtml(t.validation));
    b += sec('a1', 'Appendix: inputs and their sources', tableHtml(t.inputs));
    const extra = '@page{margin:16mm 14mm}body{background:#fff;color:#12201e;max-width:1100px;margin:0 auto;padding:28px}section{margin-top:34px}section h2{border-bottom:2px solid var(--accent);padding-bottom:6px;margin-bottom:12px}section h3{margin:16px 0 6px}p{margin:6px 0;max-width:80ch}ul{margin:6px 0 10px}table.tbl{margin:10px 0;font-size:12px;width:100%}table.tbl th,table.tbl th.n{white-space:normal}table.tbl td{vertical-align:top}table.tbl tbody tr:last-child td{font-weight:inherit}.cover{border-bottom:1px solid var(--line);padding-bottom:18px}.chart{overflow:visible}.chart svg{width:100%;height:auto}@media print{section{break-before:page}.cover+section{break-before:auto}.kpi{break-inside:avoid}tr{break-inside:avoid}}';
    return '<!DOCTYPE html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(S.name || 'Fabric migration assessment') + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..100,500..800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono&display=swap" rel="stylesheet"><style>' + css + extra + '</style></head><body>' + b + '</body></html>';
  };
  APP.act.exportReport = () => APP.saveFile(slug() + '-report.html', APP.buildReport());

  /* ============ Export & save view ============ */
  APP.views.export = () => {
    const can = !!APP.caps.downloads; const S = APP.S;
    let h = APP.pageHead('Share', 'Export & save', 'Download the read-out, the workbook and the assessment file. The report opens in any browser and prints to PDF.', '');
    if (APP.caps.ready && !can) h += '<div class="callout warn" style="margin-bottom:14px">Downloads are not available in this view. Use the Copy buttons, or open this page in Claude.</div>';
    const d = can ? '' : ' disabled';
    const dl = (act, label, desc, primary) => '<div style="display:grid;grid-template-columns:210px minmax(0,1fr);gap:12px;align-items:center"><button class="btn' + (primary ? ' primary' : '') + '" style="justify-content:center" data-act="' + act + '"' + d + '>' + label + '</button><span class="small muted">' + desc + '</span></div>';
    h += '<div class="grid2"><div class="card"><h3>Downloads</h3><div class="stack" style="gap:10px;margin-top:10px">' +
      dl('exportReport', 'Assessment report (.html)', 'Print-ready read-out with diagrams, risks and the validation log. Open it in a browser and print to PDF.', true) +
      dl('exportXlsx', 'Workbook (.xlsx)', 'Twelve sheets: summary, systems, every input with its source, gaps, effort, team, cost, roadmap, risks, validation.') +
      dl('exportJson', 'Assessment file (.json)', 'Reopen later or hand to a colleague.') +
      dl('exportScripts', 'Discovery scripts (.zip)', 'All ' + APP.SCRIPT_ORDER.length + ' read-only scripts plus a README.') +
      '<div class="row" style="gap:6px"><span class="small muted" style="width:100%">CSV extracts</span>' + ['risks', 'effort', 'inputs', 'validation', 'systems', 'gaps'].map((k) => '<button class="btn sm" data-act="exportCsv" data-t="' + k + '"' + d + '>' + k + '.csv</button>').join('') + '</div>' +
      '<hr class="hr"><div class="row"><button class="btn" data-act="copySummary">Copy executive summary</button><button class="btn" data-act="copyJson">Copy assessment file</button></div></div></div>' +
      '<div class="card"><h3>Saved assessments</h3>' + savedBlock() + '<hr class="hr"><h4>Open an assessment file</h4><label class="btn" style="margin-top:8px;cursor:pointer">Choose .json file<input type="file" accept=".json,application/json" data-ch="importJson" hidden></label></div></div>';
    void S;
    return h;
  };
  function savedBlock() {
    if (!APP.caps.ready) return '<p class="sub" style="margin-top:6px">Connecting…</p>';
    if (!APP.caps.db || !APP.caps.uid) return '<p class="sub" style="margin-top:6px">' + (APP.caps.host === 'web'
      ? 'Your work saves automatically in this browser on this device. Download the assessment file (.json) to back it up, move it to another computer or hand it to a colleague.'
      : 'Saving to your Claude account is not available in this view. Work stays in this browser; export the assessment file to keep it safe.') + '</p>';
    const list = APP.ui.saved;
    let h = '<p class="sub" style="margin-top:6px">Private to you. The open assessment saves automatically' + (APP.S._demo ? ' once it is no longer the demo' : '') + '.</p><div class="row" style="margin:10px 0"><button class="btn sm primary" data-act="saveNow"' + (APP.S._demo ? ' disabled' : '') + '>Save now</button><button class="btn sm" data-act="loadSaved">' + (list ? 'Refresh list' : 'Show saved assessments') + '</button></div>';
    if (list === 'loading') return h + '<p class="thinking">Loading…</p>';
    if (Array.isArray(list)) {
      h += list.length ? '<div class="tblwrap"><table class="tbl"><thead><tr><th>Assessment</th><th>Updated</th><th class="n">Done</th><th></th></tr></thead><tbody>' + list.map((x) => '<tr><td><b>' + esc(x.name) + '</b><div class="small muted">' + esc(x.client || '') + ' · ' + (x.systems || 0) + ' systems</div></td><td class="small">' + H.date(x.updated) + '</td><td class="n">' + (x.complete || 0) + '%</td><td class="n"><button class="btn sm" data-act="openSaved" data-id="' + esc(x.id) + '">Open</button> <button class="btn sm ghost danger" data-act="delSaved" data-id="' + esc(x.id) + '">Delete</button></td></tr>').join('') + '</tbody></table></div>' : '<p class="small muted">Nothing saved yet.</p>';
    }
    return h;
  }
  APP.act.saveNow = async () => { await APP.dbSaveNow(); APP.toast(APP.saveMsg); };
  APP.act.loadSaved = async () => {
    if (!APP.caps.db || !APP.caps.uid) return; APP.ui.saved = 'loading'; APP.render();
    try { const snap = await APP.caps.db.collection('data/users/' + APP.caps.uid).orderBy('updated', 'desc').limit(100).get(); APP.ui.saved = snap.docs.map((d) => Object.assign({ id: d.id }, d.data(), { json: undefined })); }
    catch (e) { APP.ui.saved = []; APP.toast('Could not load saved assessments (' + (e && e.code || 'error') + ').'); }
    APP.render();
  };
  APP.act.openSaved = async (el) => {
    try { const d = await APP.caps.db.collection('data/users/' + APP.caps.uid).doc(el.dataset.id).get(); if (!d.exists) { APP.toast('That assessment no longer exists.'); return; } const st = JSON.parse(d.data().json); delete st._demo; APP.load(st, 'summary'); APP.toast('Opened ' + (st.name || 'assessment')); }
    catch (e) { APP.toast('Could not open it (' + (e && e.code || 'error') + ').'); }
  };
  APP.act.delSaved = async (el) => {
    const x = (Array.isArray(APP.ui.saved) ? APP.ui.saved : []).find((y) => y.id === el.dataset.id);
    if (!(await APP.confirm('Delete saved assessment?', 'Delete "' + ((x && x.name) || 'this assessment') + '" from your Claude account? This cannot be undone.', 'Delete'))) return;
    try { await APP.caps.db.collection('data/users/' + APP.caps.uid).doc(el.dataset.id).delete(); APP.ui.saved = APP.ui.saved.filter((y) => y.id !== el.dataset.id); APP.render(); }
    catch (e) { APP.toast('Could not delete it (' + (e && e.code || 'error') + ').'); }
  };

  /* ============ Rates & assumptions ============ */
  const RATE_FIELDS = [
    ['currency', 'Currency', 'select', ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'INR', 'JPY'], 'Labels only: enter prices in this currency.'],
    ['cuHourPayg', 'Fabric pay-as-you-go price', 'number', 'per CU-hour', 'US East list price in Nov 2026 is 0.18 USD.'],
    ['cuYearReserved', 'Fabric 1-year reservation price', 'number', 'per CU per year', 'About 41% below pay-as-you-go (938 USD per CU per year).'],
    ['storageGbMonth', 'OneLake storage price', 'number', 'per GB-month', 'Check the regional price for OneLake storage.'],
    ['proUserMonth', 'Power BI Pro price', 'number', 'per user-month', ''],
    ['gatewayVmMonth', 'Data gateway VM cost', 'number', 'per node-month', 'Two nodes per cluster for high availability.'],
    ['nonProdHoursMonth', 'Dev / test running hours', 'number', 'hours per month', 'Paused outside working hours (about 12 h × 22 days).'],
    ['blendedDayRate', 'Blended delivery day rate', 'number', 'per person-day', 'Role multipliers apply on top (architect 1.3×, SAP 1.35×, QA 0.8×…).'],
    ['aiConversionFactor', 'AI-assisted conversion factor', 'number', 'share of manual effort', '0.7 means AI-assisted conversion needs 70% of the manual effort.'],
    ['contingencyOverride', 'Contingency override', 'number', '%', 'Leave empty to use the calculated contingency.'],
    ['teamFteOverride', 'Team size override', 'number', 'FTE', 'Leave empty to size the team from the effort or the target duration.']
  ];
  APP.views.rates = () => {
    const Rt = APP.S.rates;
    let h = APP.pageHead('Share', 'Rates & assumptions', 'Prices and rates behind every cost and effort figure. Changes apply immediately to all results.', '<button class="btn" data-act="resetRates">Reset to defaults</button>');
    h += '<div class="qgrid">' + RATE_FIELDS.map(([k, label, type, unit, help]) => {
      const id = 'rate-' + k;
      const inp = type === 'select' ? '<select id="' + id + '" class="inp" data-ch="rate" data-r="' + k + '">' + unit.map((u) => '<option' + (Rt[k] === u ? ' selected' : '') + '>' + u + '</option>').join('') + '</select>'
        : '<input type="number" step="any" id="' + id + '" class="inp" data-ch="rate" data-r="' + k + '" value="' + (Rt[k] == null ? '' : esc(Rt[k])) + '"' + (k.indexOf('Override') > 0 ? ' placeholder="calculated"' : '') + '>';
      return '<div class="q"><div class="q-top"><label for="' + id + '">' + esc(label) + (type !== 'select' ? ' <span class="unit">(' + esc(unit) + ')</span>' : '') + '</label>' + (String(Rt[k]) !== String(KB.DEFAULT_RATES[k]) ? '<span class="chip src-user"><i></i>Changed</span>' : '') + '</div>' + inp + (help ? '<p class="help">' + esc(help) + '</p>' : '') + '</div>';
    }).join('') + '</div>';
    h += '<div class="card" style="margin-top:16px"><h3>Assumptions in force</h3><ul class="clean" style="margin-top:8px">' + APP.R.assumptions.map((a) => '<li>' + esc(a) + '</li>').join('') + '</ul></div>';
    return h;
  };
  APP.act.rate = (el) => {
    const k = el.dataset.r; let v = el.value;
    if (k !== 'currency') { v = v === '' ? (k.indexOf('Override') > 0 ? null : KB.DEFAULT_RATES[k]) : Number(v); if (v != null && (!isFinite(v) || v < 0)) { APP.toast('Enter a positive number'); return; } }
    APP.commit((S) => { S.rates[k] = v; });
  };
  APP.act.resetRates = () => { APP.commit((S) => { S.rates = Object.assign({}, KB.DEFAULT_RATES); }); APP.toast('Rates reset to defaults.'); };
})();
