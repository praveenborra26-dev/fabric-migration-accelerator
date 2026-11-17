/* Fabric Migration Assessment Accelerator — UI core: state, persistence, capabilities, fields, nav. */
(function () {
  'use strict';
  const KB = window.FMA_KB; const E = window.FMA_ENGINE; const DEMO = window.FMA_DEMO; const U = E.util;
  const APP = { S: null, R: null, view: 'start', sel: null, ui: {}, caps: { sample: null, downloads: null, db: null, user: null, uid: null, ready: false, host: null }, views: {}, act: {}, saveMsg: 'Saved in this browser' };
  window.FMA_APP = APP;

  /* ---------- helpers ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const H = {
    esc, fmt: U.fmtInt, fnum: U.fmtNum,
    money: (v, d) => E.money(v, APP.S.rates.currency, d),
    pct: (v) => (v == null || !isFinite(v) ? '—' : Math.round(v * 100) + '%'),
    $: (s, r) => (r || document).querySelector(s),
    $$: (s, r) => Array.from((r || document).querySelectorAll(s)),
    sysById: (id) => APP.S.systems.find((s) => s.id === id),
    sevClass: (sev) => ({ Critical: 'crit', High: 'high', Medium: 'med', Low: 'low' }[sev] || 'none'),
    tierClass: (t) => ({ Low: 'low', Medium: 'med', High: 'high', 'Very high': 'vh' }[t] || 'none'),
    gapClass: (g) => ({ high: 'crit', medium: 'med', low: 'low', none: 'none' }[g] || 'none'),
    gapLabel: (g) => ({ high: 'High gap', medium: 'Medium gap', low: 'Low gap', none: 'No gap' }[g] || g),
    plural: (n, w, p) => (n === 1 ? w : (p || w + 's')),
    date: (iso) => { try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return iso; } }
  };
  APP.H = H;

  /* ---------- persistence (browser + Claude account) ---------- */
  const LS_KEY = 'fma.current.v1';
  const lsGet = (k) => { try { return window.localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  APP.lsGet = lsGet; APP.lsSet = lsSet;

  function loadInitial() {
    const raw = lsGet(LS_KEY);
    if (raw) { try { return E.migrate(JSON.parse(raw)); } catch (e) { /* fall through to demo */ } }
    const st = DEMO.build(E); st._demo = true; return st;
  }

  let persistT = null;
  function persist() {
    clearTimeout(persistT);
    persistT = setTimeout(() => {
      const ok = lsSet(LS_KEY, JSON.stringify(APP.S));
      if (!APP.caps.db || !APP.caps.uid) APP.saveMsg = ok ? 'Saved in this browser' : 'Not saved: export the file to keep it';
      scheduleDbSave(); renderTop();
    }, 350);
  }

  let dbT = null; let dbBusy = false; let dbDirty = false;
  function scheduleDbSave() {
    if (!APP.caps.db || !APP.caps.uid || APP.S._demo) return;
    dbDirty = true; clearTimeout(dbT); dbT = setTimeout(dbSaveNow, 3500);
    APP.saveMsg = 'Unsaved changes';
  }
  async function dbSaveNow() {
    if (dbBusy) { dbT = setTimeout(dbSaveNow, 1500); return; }
    if (!dbDirty || !APP.caps.db || !APP.caps.uid) return;
    dbBusy = true; dbDirty = false; APP.saveMsg = 'Saving…'; renderTop();
    try {
      const json = JSON.stringify(APP.S);
      if (json.length > 240000) throw { code: 'too_large' };
      await APP.caps.db.collection('data/users/' + APP.caps.uid).doc(APP.S.id).set({
        name: APP.S.name || 'Untitled assessment', client: (APP.S.g.org_name && APP.S.g.org_name.v) || '', updated: APP.S.updated,
        systems: APP.S.systems.length, agentic: Math.round(APP.R.comp.agentic * 100), complete: Math.round(APP.R.comp.complete * 100), json
      });
      APP.saveMsg = 'Saved to your Claude account';
    } catch (e) {
      APP.saveMsg = e && e.code === 'too_large' ? 'Too large to save online: export the file' : (e && e.code === 'quota_exceeded' ? 'Online storage is full: delete old assessments' : 'Saved in this browser only');
    }
    dbBusy = false; renderTop();
  }
  APP.dbSaveNow = () => { dbDirty = true; return dbSaveNow(); };

  /* ---------- capabilities (light up when the viewer provides them) ---------- */
  // Outside Claude (GitHub Pages, any web server, a local file) the browser saves files itself.
  const MIME = { html: 'text/html;charset=utf-8', json: 'application/json;charset=utf-8', csv: 'text/csv;charset=utf-8', txt: 'text/plain;charset=utf-8', md: 'text/markdown;charset=utf-8', zip: 'application/zip', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  const nativeDownloads = {
    save: ({ filename, data }) => new Promise((resolve, reject) => {
      try {
        const ext = String(filename).split('.').pop().toLowerCase();
        const blob = data instanceof Blob ? data : new Blob([data], { type: MIME[ext] || 'application/octet-stream' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = filename; a.rel = 'noopener'; a.style.display = 'none';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        resolve({ status: 'saved' });
      } catch (e) { reject({ code: 'unavailable', message: String((e && e.message) || e) }); }
    })
  };
  async function initCaps() {
    if (!window.claude || typeof window.claude.use !== 'function') { APP.caps.host = 'web'; APP.caps.downloads = nativeDownloads; APP.caps.ready = true; render(); return; }
    APP.caps.host = 'claude';
    const use = (n) => window.claude.use(n).catch(() => null);
    const [sample, downloads, user, db] = await Promise.all([use('sample'), use('downloads'), use('user'), use('db')]);
    APP.caps.sample = sample; APP.caps.downloads = downloads; APP.caps.user = user; APP.caps.db = db;
    if (user) { try { APP.caps.uid = await user.id(); } catch (e) { APP.caps.uid = null; } }
    APP.caps.ready = true;
    if (APP.caps.db && APP.caps.uid && !APP.S._demo) APP.saveMsg = 'Saved to your Claude account';
    render();
  }

  /* ---------- compute & commit ---------- */
  function recompute() { try { APP.R = E.compute(APP.S); } catch (e) { console.error(e); toast('Calculation problem: ' + e.message); } }
  APP.commit = (fn, opt) => {
    if (fn) fn(APP.S);
    APP.S.updated = new Date().toISOString();
    if (APP.S._demo && !(opt && opt.keepDemo)) { /* editing the demo keeps it marked as a demo */ }
    recompute(); persist();
    if (!opt || opt.render !== false) render();
  };
  APP.load = (st, view) => { APP.S = E.migrate(st); APP.sel = APP.S.systems[0] ? APP.S.systems[0].id : null; recompute(); persist(); go(view || 'summary'); };

  /* ---------- toast / modal / tooltip ---------- */
  let toastT = null;
  function toast(msg) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200); }
  APP.toast = toast;
  APP.modal = (title, bodyHtml, actions) => new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    root.innerHTML = '<div class="modal-bg" role="presentation"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mdl-t"><h2 id="mdl-t">' + esc(title) + '</h2><div>' + bodyHtml + '</div><div class="acts">' +
      actions.map((a, i) => '<button class="btn ' + (a.primary ? 'primary' : '') + (a.danger ? ' danger' : '') + '" data-mi="' + i + '">' + esc(a.label) + '</button>').join('') + '</div></div></div>';
    const close = (v) => { root.innerHTML = ''; resolve(v); };
    root.querySelectorAll('[data-mi]').forEach((b) => b.addEventListener('click', () => {
      const a = actions[Number(b.dataset.mi)];
      const vals = {}; root.querySelectorAll('[data-mf]').forEach((el) => { vals[el.dataset.mf] = el.value; });
      close(a.value === undefined ? vals : (a.value === 'form' ? vals : a.value));
    }));
    root.querySelector('.modal-bg').addEventListener('click', (e) => { if (e.target.classList.contains('modal-bg')) close(null); });
    const first = root.querySelector('input, select, textarea, .btn.primary'); if (first) first.focus();
    root.addEventListener('keydown', function onKey(e) { if (e.key === 'Escape') { root.removeEventListener('keydown', onKey); close(null); } });
  });
  APP.confirm = (title, text, label) => APP.modal(title, '<p>' + esc(text) + '</p>', [{ label: 'Cancel', value: false }, { label: label || 'Confirm', primary: true, value: true }]);

  function tipInit() {
    const tip = document.getElementById('tip');
    document.addEventListener('mouseover', (e) => { const el = e.target.closest('[data-tip]'); if (!el) { tip.classList.remove('on'); return; } tip.textContent = el.getAttribute('data-tip'); tip.classList.add('on'); });
    document.addEventListener('mousemove', (e) => { if (!tip.classList.contains('on')) return; const x = Math.min(window.innerWidth - tip.offsetWidth - 12, e.clientX + 14); tip.style.left = x + 'px'; tip.style.top = (e.clientY + 16) + 'px'; });
    document.addEventListener('focusin', (e) => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) { const r = el.getBoundingClientRect(); tip.textContent = el.getAttribute('data-tip'); tip.style.left = Math.max(8, r.left) + 'px'; tip.style.top = (r.bottom + 6) + 'px'; tip.classList.add('on'); } });
    document.addEventListener('focusout', () => tip.classList.remove('on'));
  }

  /* ---------- fields ---------- */
  function ansOf(scope, id) { return scope === 'g' ? APP.S.g[id] : (H.sysById(scope) || { a: {} }).a[id]; }
  function resOf(scope, id) { const c = APP.R.ctx; return scope === 'g' ? c.g(id) : c.s(H.sysById(scope), id); }
  function fieldDef(scope, id) { return scope === 'g' ? E.GF[id] : E.SF[id]; }
  APP.ansOf = ansOf; APP.resOf = resOf; APP.fieldDef = fieldDef;

  function displayVal(f, v, scope) {
    if (!U.has(v)) return '—';
    if (f.type === 'number') return (f.money ? H.money(v) : H.fnum(v, 2)) + (f.unit && !f.money && f.unit !== '%' ? ' ' + f.unit : f.unit === '%' ? '%' : '');
    if (f.type === 'select') return E.optLabel(f, v);
    if (f.type === 'multi') {
      const so = scope && typeof scope === 'object' ? scope : H.sysById(scope);
      const o = f.featureList ? (so ? E.featureOptions(so) : []) : f.opts;
      return (Array.isArray(v) ? v : [v]).map((k) => { const x = (o || []).find((y) => y.k === k); return x ? x.l : (KB.FEAT[k] ? KB.FEAT[k].label : k); }).join(', ');
    }
    if (f.type === 'month') return v === 'none' ? (f.id === 'org_deadline' ? 'No hard deadline' : 'None') : v;
    return String(v);
  }
  APP.displayVal = displayVal;
  const srcChip = (src) => '<span class="chip src-' + src + '" data-tip="' + esc(srcTip(src)) + '"><i></i>' + esc(KB.SOURCE_LABEL[src] || src) + '</span>';
  const srcTip = (src) => ({
    user: 'Provided by a person in the intake', disc: 'Measured by a discovery script', ai: 'Extracted from documents by the AI agent: confirm it in Validate',
    derived: 'Calculated from other known answers', default: 'Benchmark default used because the answer is unknown', val: 'Confirmed by a reviewer', missing: 'No answer yet'
  }[src] || '');
  APP.srcChip = srcChip;

  APP.renderField = (f, scope) => {
    const k = scope + ':' + f.id;
    const ans = ansOf(scope, f.id); const r = resOf(scope, f.id);
    const provided = !!(ans && !ans.ns && U.has(ans.v));
    const inferred = !provided;
    const id = 'f-' + k.replace(/[^a-zA-Z0-9_-]/g, '_');
    const opts = f.featureList ? E.featureOptions(H.sysById(scope)) : (f.opts || []);
    let input = '';
    if (f.type === 'number') {
      input = '<input type="number" inputmode="decimal" id="' + id + '" data-k="' + k + '" value="' + (provided ? esc(ans.v) : '') + '" placeholder="' + (U.has(r.v) ? '≈ ' + esc(H.fnum(r.v, 2)) : 'Enter a value') + '"' + (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') + ' step="' + (f.step || 'any') + '">';
    } else if (f.type === 'text') {
      input = '<input type="text" id="' + id + '" data-k="' + k + '" value="' + (provided ? esc(ans.v) : '') + '" placeholder="' + esc(f.ph || '') + '" maxlength="160">';
    } else if (f.type === 'month') {
      const none = provided && ans.v === 'none';
      input = '<div class="row" style="gap:8px"><input type="month" id="' + id + '" data-k="' + k + '" value="' + (provided && !none ? esc(ans.v) : '') + '" style="flex:1;min-width:150px">' +
        '<button type="button" class="opt" aria-pressed="' + none + '" data-act="monthnone" data-k="' + k + '">' + (f.id === 'org_deadline' ? 'No hard deadline' : 'None') + '</button></div>';
    } else if (f.type === 'select') {
      input = '<select id="' + id + '" data-k="' + k + '"><option value="">' + (inferred && U.has(r.v) ? '— Not sure · using ' + esc(E.optLabel(f, r.v)) + ' —' : '— Not sure —') + '</option>' +
        opts.map((o) => '<option value="' + esc(o.k) + '"' + (provided && ans.v === o.k ? ' selected' : '') + '>' + esc(o.l) + '</option>').join('') + '</select>';
    } else if (f.type === 'multi') {
      const cur = provided ? ans.v : (Array.isArray(r.v) ? r.v : []);
      input = '<div class="chips" role="group" aria-label="' + esc(f.label) + '">' + opts.map((o) => {
        const on = cur.indexOf(o.k) >= 0;
        return '<button type="button" class="opt' + (inferred && on ? ' sugg' : '') + '" aria-pressed="' + (provided && on) + '" data-act="multi" data-k="' + k + '" data-o="' + esc(o.k) + '"' + (inferred && on ? ' data-tip="Suggested: click to adjust"' : '') + '>' + esc(o.l) + '</button>';
      }).join('') + '</div>';
    }
    let why;
    if (inferred) why = U.has(r.v) ? 'Using <b>' + esc(displayVal(f, r.v, scope)) + '</b> · ' + esc(r.why) : esc(r.why === 'Not answered' ? 'Not answered yet' : r.why);
    else why = esc(r.why);
    const nsOn = !!(ans && ans.ns);
    return '<div class="q' + (f.type === 'multi' || f.wide ? ' wide' : '') + (inferred ? ' inferred' : '') + '" id="q-' + id + '">' +
      '<div class="q-top"><label for="' + id + '">' + esc(f.label) + (f.unit && f.type === 'number' ? ' <span class="unit">(' + esc(f.money ? APP.S.rates.currency + ' ' + f.unit : f.unit) + ')</span>' : '') + '</label>' + srcChip(r.src) + '</div>' +
      input +
      '<div class="q-meta"><button type="button" class="ns" aria-pressed="' + nsOn + '" data-act="ns" data-k="' + k + '">Not sure</button><span class="why">' + why + '</span>' +
      (inferred && U.has(r.v) ? '<button type="button" class="linkbtn" data-act="confirm" data-k="' + k + '" data-tip="Accept this value as validated">Confirm</button>' : '') +
      (provided && ans.src !== 'user' && ans.src !== 'val' ? '<button type="button" class="linkbtn" data-act="confirm" data-k="' + k + '">Confirm</button>' : '') + '</div>' +
      (f.help ? '<p class="help">' + esc(f.help) + '</p>' : '') + '</div>';
  };

  function splitKey(k) { const i = k.indexOf(':'); return [k.slice(0, i), k.slice(i + 1)]; }
  function target(scope) { return scope === 'g' ? APP.S.g : H.sysById(scope).a; }
  APP.setAnswer = (k, v, src, extra) => {
    const [scope, id] = splitKey(k); const t = target(scope);
    if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && !v.length)) delete t[id];
    else t[id] = Object.assign({ v, src: src || 'user', ts: Date.now() }, extra || {});
  };
  APP.splitKey = splitKey;

  function onFieldChange(el) {
    const k = el.dataset.k; if (!k) return;
    const [scope, id] = splitKey(k); const f = fieldDef(scope, id); if (!f) return;
    let v = el.value;
    if (f.type === 'number') { v = v === '' ? null : Number(v); if (v != null && !isFinite(v)) { toast('Enter a number'); return; } if (v != null && f.min != null && v < f.min) v = f.min; if (v != null && f.max != null && v > f.max) v = f.max; }
    if (f.type === 'text') v = v.trim();
    APP.commit(() => APP.setAnswer(k, v === '' ? null : v, 'user'));
  }

  /* default actions */
  APP.act.ns = (el) => {
    const [scope, id] = splitKey(el.dataset.k); const t = target(scope);
    APP.commit(() => { if (t[id] && t[id].ns) delete t[id]; else t[id] = { ns: true, ts: Date.now() }; });
  };
  APP.act.confirm = (el) => {
    const k = el.dataset.k; const [scope, id] = splitKey(k); const r = resOf(scope, id);
    if (!U.has(r.v)) return;
    APP.commit(() => { APP.setAnswer(k, r.v, 'val', { by: APP.S.reviewer || '' }); });
    toast('Confirmed: ' + fieldDef(scope, id).label);
  };
  APP.act.multi = (el) => {
    const k = el.dataset.k; const o = el.dataset.o; const [scope, id] = splitKey(k);
    const ans = ansOf(scope, id); const r = resOf(scope, id);
    const provided = ans && !ans.ns && U.has(ans.v);
    let cur = (provided ? ans.v : (Array.isArray(r.v) ? r.v : [])).slice();
    const i = cur.indexOf(o); if (i >= 0) cur.splice(i, 1); else cur.push(o);
    if (o === 'none' && i < 0) cur = ['none']; else cur = cur.filter((x) => x !== 'none' || cur.length === 1);
    APP.commit(() => APP.setAnswer(k, cur.length ? cur : null, 'user'));
  };
  APP.act.monthnone = (el) => {
    const k = el.dataset.k; const [scope, id] = splitKey(k); const ans = ansOf(scope, id);
    APP.commit(() => APP.setAnswer(k, ans && ans.v === 'none' ? null : 'none', 'user'));
  };

  /* ---------- navigation ---------- */
  const NAV = [
    { g: null, items: [['start', 'Start']] },
    { g: '1 · Capture', items: [['org', 'Organization & goals'], ['systems', 'Source systems'], ['etl', 'Integration & ETL'], ['bi', 'BI & consumption'], ['sec', 'Security & compliance'], ['ops', 'Operations & team'], ['tgt', 'Target preferences']] },
    { g: '2 · Automate', items: [['discovery', 'Discovery scripts'], ['agent', 'AI agent']] },
    { g: '3 · Results', items: [['summary', 'Executive summary'], ['estate', 'Estate & complexity'], ['architecture', 'Target architecture'], ['capacity', 'Capacity & cost'], ['effort', 'Effort & team'], ['roadmap', 'Roadmap'], ['risks', 'Risks & assumptions']] },
    { g: '4 · Validate & share', items: [['validate', 'Validation & sign-off'], ['export', 'Export & save'], ['rates', 'Rates & assumptions']] }
  ];
  APP.NAV = NAV;
  const VIEW_IDS = NAV.reduce((a, g) => a.concat(g.items.map((x) => x[0])), []);

  function sectionConf(sec) {
    const items = APP.R.items.filter((it) => (sec === 'systems' ? it.scope !== 'g' : it.scope === 'g' && it.field.sec === sec));
    const W = U.sum(items.map((x) => x.w)); return W ? U.sum(items.map((x) => x.w * x.r.cc)) / W : 0;
  }
  APP.sectionConf = sectionConf;
  function pendingCount() {
    const V = APP.S.validations;
    const d = APP.R.decisions.filter((x) => !(V[x.key] && V[x.key].status && V[x.key].status !== 'pending')).length;
    const i = APP.R.items.filter((x) => x.r.conf < 0.6 && x.w >= 2 && !(V['i:' + x.key] && V['i:' + x.key].status === 'confirmed')).length;
    return d + i;
  }
  APP.pendingCount = pendingCount;

  function renderNav() {
    const nav = document.getElementById('nav'); if (!nav) return;
    const capture = ['org', 'systems', 'etl', 'bi', 'sec', 'ops', 'tgt'];
    let h = '<div class="brand"><b>Fabric Migration Assessment Accelerator</b><span>28 platforms: warehouses, databases, SAP, Snowflake, Databricks, Hadoop and any SQL source → Microsoft Fabric</span></div>';
    NAV.forEach((grp) => {
      h += '<div class="nav-g">' + (grp.g ? '<h4>' + esc(grp.g) + '</h4>' : '');
      grp.items.forEach(([id, label]) => {
        let extra = '';
        if (capture.indexOf(id) >= 0) { const cf = sectionConf(id); extra = '<span class="mini" data-tip="Answer confidence ' + H.pct(cf) + '"><i style="width:' + Math.round(cf * 100) + '%"></i></span>'; }
        if (id === 'systems') label = 'Source systems (' + APP.S.systems.length + ')';
        if (id === 'validate') { const n = pendingCount(); extra = '<span class="cnt' + (n ? ' hot' : '') + '">' + (n ? n + ' open' : 'done') + '</span>'; }
        if (id === 'discovery') { const done = APP.S.systems.filter((s) => s.disc).length; extra = '<span class="cnt">' + done + '/' + APP.S.systems.length + '</span>'; }
        h += '<button class="nav-i" data-go="' + id + '"' + (APP.view === id ? ' aria-current="page"' : '') + '><span class="lbl">' + esc(label) + '</span>' + extra + '</button>';
      });
      h += '</div>';
    });
    h += '<div class="nav-foot">Knowledge base ' + KB.VERSION + '. Read-only discovery, labelled estimates, human sign-off. Fabric facts as documented by Microsoft in November 2026.</div>';
    nav.innerHTML = h;
    const sel = document.getElementById('navsel');
    if (sel) sel.innerHTML = NAV.map((g) => (g.g ? '<optgroup label="' + esc(g.g) + '">' : '') + g.items.map(([id, l]) => '<option value="' + id + '"' + (APP.view === id ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + (g.g ? '</optgroup>' : '')).join('');
  }

  function ring(ag, va, size) {
    size = size || 44; const r = size / 2 - 4; const C = 2 * Math.PI * r; const gap = 1.5;
    const a = Math.max(0, C * ag - gap); const v = Math.max(0, C * va - gap);
    const c = size / 2;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="' + Math.round((ag + va) * 100) + '% complete: ' + Math.round(ag * 100) + '% agentic, ' + Math.round(va * 100) + '% validated">' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="var(--track)" stroke-width="6"/>' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="var(--accent)" stroke-width="6" stroke-dasharray="' + a + ' ' + C + '" transform="rotate(-90 ' + c + ' ' + c + ')"/>' +
      (va > 0.002 ? '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="var(--good)" stroke-width="6" stroke-dasharray="' + v + ' ' + C + '" stroke-dashoffset="' + (-(C * ag)) + '" transform="rotate(-90 ' + c + ' ' + c + ')"/>' : '') +
      '<text x="' + c + '" y="' + (c + 4) + '" text-anchor="middle" font-size="' + (size > 60 ? 16 : 11.5) + '" font-weight="700" fill="var(--ink)" font-family="var(--font-display)">' + Math.round((ag + va) * 100) + '%</text></svg>';
  }
  APP.ring = ring;

  function renderTop() {
    const top = document.getElementById('topbar'); if (!top || !APP.R) return;
    const c = APP.R.comp;
    const nameEl = document.getElementById('nm');
    const focused = nameEl && document.activeElement === nameEl;
    if (!focused) {
      top.innerHTML = '<select id="navsel" aria-label="Go to section"></select>' +
        '<div class="title"><input id="nm" aria-label="Assessment name" value="' + esc(APP.S.name || '') + '" placeholder="Name this assessment"></div>' +
        '<button class="meter btn ghost" data-go="validate" style="padding:2px 6px" data-tip="Open Validation & sign-off">' + ring(c.agentic, Math.max(0, c.validated)) +
        '<span class="txt"><b>' + H.pct(c.complete) + ' complete</b><br>' + H.pct(c.agentic) + ' agentic · ' + H.pct(Math.max(0, c.validated)) + ' validated · ' + H.fnum(c.remainingDays, 0) + ' d to validate</span></button>' +
        '<span class="savestat" id="savestat">' + esc(APP.S._demo ? 'Demo data (fictional company)' : APP.saveMsg) + '</span>' +
        '<button class="btn sm" data-go="export">Export</button>';
      renderNavSelect();
    } else { const ss = document.getElementById('savestat'); if (ss) ss.textContent = APP.S._demo ? 'Demo data (fictional company)' : APP.saveMsg; }
  }
  function renderNavSelect() { const sel = document.getElementById('navsel'); if (sel) sel.innerHTML = NAV.map((g) => (g.g ? '<optgroup label="' + esc(g.g) + '">' : '') + g.items.map(([id, l]) => '<option value="' + id + '"' + (APP.view === id ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + (g.g ? '</optgroup>' : '')).join(''); }
  APP.renderTop = renderTop;

  function demoBanner() {
    return '<div class="demo-banner" role="note"><span><b>Demo assessment.</b> Harborview Retail Group is fictional: five platforms, four with discovery output imported. Explore it, then start your own.</span><span class="row" style="margin-left:auto;gap:8px"><button class="btn sm primary" data-act="newAssessment">Start a new assessment</button><button class="btn sm" data-act="keepDemo">Keep editing the demo</button></span></div>';
  }

  function render() {
    if (!APP.R) recompute();
    const ae = document.activeElement; const aeId = ae && ae.id && ae.id !== 'nm' ? ae.id : null;
    const sx = window.scrollY;
    renderNav(); renderTop();
    const v = APP.views[APP.view] || APP.views.start;
    let html = '';
    try { html = v(); } catch (e) { console.error(e); html = '<div class="callout crit">This view could not be drawn: ' + esc(e.message) + '</div>'; }
    document.getElementById('view').innerHTML = (APP.S._demo ? demoBanner() : '') + html;
    if (APP._scrollTop) { window.scrollTo(0, 0); APP._scrollTop = false; } else window.scrollTo(0, sx);
    if (aeId) { const el = document.getElementById(aeId); if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } } }
    if (APP.afterRender) APP.afterRender();
  }
  APP.render = render;

  function go(view, opt) {
    if (VIEW_IDS.indexOf(view) < 0) view = 'start';
    APP.view = view; APP._scrollTop = !(opt && opt.keepScroll);
    if (location.hash !== '#' + view) { try { location.hash = view; } catch (e) { /* hash routing unavailable */ } }
    lsSet('fma.view', view);
    render();
  }
  APP.go = go;

  /* ---------- events ---------- */
  function bind() {
    document.addEventListener('click', (e) => {
      const g = e.target.closest('[data-go]');
      if (g) { e.preventDefault(); if (g.dataset.sel) APP.sel = g.dataset.sel; go(g.dataset.go); return; }
      const a = e.target.closest('[data-act]');
      if (a && APP.act[a.dataset.act]) { e.preventDefault(); try { APP.act[a.dataset.act](a, e); } catch (err) { console.error(err); toast('Something went wrong: ' + err.message); } }
    });
    document.addEventListener('change', (e) => {
      const el = e.target;
      if (el.id === 'navsel') { go(el.value); return; }
      if (el.id === 'nm') { const v = el.value.trim(); APP.commit((s) => { s.name = v; }, { render: false }); renderNav(); return; }
      if (el.dataset && el.dataset.k && el.closest('.q')) { onFieldChange(el); return; }
      if (el.dataset && el.dataset.ch && APP.act[el.dataset.ch]) APP.act[el.dataset.ch](el, e);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'nm') e.target.blur(); });
    window.addEventListener('hashchange', () => { const h = location.hash.replace('#', ''); if (h && h !== APP.view && VIEW_IDS.indexOf(h) >= 0) go(h); });
  }

  APP.act.keepDemo = () => { APP.commit((s) => { delete s._demo; s.name = s.name.replace(' (demo)', '') + ''; }); toast('The demo is now your working copy.'); };

  APP.start = () => {
    APP.S = loadInitial();
    APP.sel = APP.S.systems[0] ? APP.S.systems[0].id : null;
    recompute();
    const h = location.hash.replace('#', '');
    APP.view = VIEW_IDS.indexOf(h) >= 0 ? h : (lsGet('fma.view') && VIEW_IDS.indexOf(lsGet('fma.view')) >= 0 ? lsGet('fma.view') : 'start');
    bind(); tipInit(); render();
    initCaps();
  };
})();
