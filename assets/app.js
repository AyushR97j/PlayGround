/* DSA Prep Sheet — vanilla JS, no build step.
 * Progress lives in localStorage and can also auto-save to a file (File System Access API),
 * be downloaded/restored as JSON, or sync through a private GitHub Gist.
 * Every problem has one canonical key (e.g. "lc:two-sum"), so marking it in one section marks it everywhere. */
(() => {
  'use strict';

  // ------------------------------------------------------------------ constants
  const PKEY = 'dsaSheet.progress.v1';
  const SKEY = 'dsaSheet.settings.v1';
  const FKEY = 'dsaSheet.filters.v1';
  const APP_ID = 'dsa-prep-sheet';
  const SYNC_FILE = 'dsa-progress.json';
  const JSON_TYPES = [{ description: 'DSA progress (JSON)', accept: { 'application/json': ['.json'] } }];

  // Your sheet's codes. D and D/ND: solved by yourself (two tags). ND: solved after reading the solution.
  // All three count as done. (Stored values stay 'solved' / 'help' / 'attempted' so saved progress keeps working.)
  const STATUSES = [
    { s: '', label: 'Not solved yet', short: 'Not solved', code: '', sw: 'none' },
    { s: 'attempted', label: 'Solved after seeing the solution', short: 'ND', code: 'ND', sw: 'nd' },
    { s: 'help', label: 'Solved by yourself (D/ND tag)', short: 'D/ND', code: 'D/ND', sw: 'dnd' },
    { s: 'solved', label: 'Solved by yourself (D tag)', short: 'D', code: 'D', sw: 'ok' },
  ];
  const ST = Object.fromEntries(STATUSES.map((x) => [x.s, x]));
  const done = (s) => s === 'solved' || s === 'help' || s === 'attempted';
  const EMPTY = Object.freeze({});

  const X_LABELS = {
    lvl: "Striver level", pat: 'Pattern', pri: 'Priority', topic: 'Topic', lbl: 'Difficulty (list)',
    tgt: 'Targets in your sheet', why: "Why it's on the list", co: 'Companies / asked by', freq: 'Google frequency',
    num: '#', design: 'Design problem',
  };
  const PRI_HELP = {
    P1: 'P1 · highest-yield fix, before the first OAs', P2: 'P2 · during OA season', P3: 'P3 · stretch (2430+)',
    B1: 'B1 · breadth Hard rated < 2350', B2: 'B2 · breadth Hard rated 2350+',
    C1: 'C1 · reported in a company OA', C2: 'C2 · new technique',
  };

  // ------------------------------------------------------------------ helpers
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const z2 = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}`;
  const today = () => ymd(new Date());
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const fmtPct = (a, b) => { if (!b) return '0%'; const p = (a * 100) / b; return (p > 0 && p < 1 ? p.toFixed(1) : Math.round(p)) + '%'; };
  const fmtDate = (s, short) => {
    if (!s) return '';
    const d = new Date(s + 'T00:00:00');
    return d.toLocaleDateString(undefined, short ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  };
  function ago(ts) {
    if (!ts) return 'never';
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 45) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} d ago`;
  }

  const svg = (d, extra = '') => `<svg class="i" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
  const I = {
    check: svg('<path d="M3.5 8.5l3 3 6-7"/>', 'stroke-width="2.4"'),
    chev: svg('<path d="M4 6l4 4 4-4"/>', 'stroke-width="2"'),
    star: svg('<path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z"/>', 'stroke-width="1.4"'),
    note: svg('<path d="M3 2.5h7l3 3v8H3z"/><path d="M5.5 7.5h5M5.5 10h5M5.5 5h2.5"/>'),
    ext: svg('<path d="M9 3h4v4M13 3L7.5 8.5M11 9.5V13H3V5h3.5"/>'),
    play: svg('<path d="M5 3.5v9l7-4.5z"/>'),
    search: svg('<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>'),
    shuffle: svg('<path d="M2 4.5h2.5c3 0 4 7 7 7H14M2 11.5h2.5c1.2 0 2-1 2.7-2.3M9.3 6.8C10 5.5 10.8 4.5 12 4.5H14M12 2.5l2 2-2 2M12 9.5l2 2-2 2"/>'),
    sun: svg('<circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"/>'),
    moon: svg('<path d="M13.5 9.5A5.5 5.5 0 116.5 2.5a4.5 4.5 0 007 7z"/>'),
    x: svg('<path d="M4 4l8 8M12 4l-8 8"/>', 'stroke-width="1.8"'),
    download: svg('<path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10"/>'),
    upload: svg('<path d="M8 10.5v-8M4.5 6L8 2.5 11.5 6M3 13.5h10"/>'),
    file: svg('<path d="M4 1.5h5.5L13 5v9.5H4z"/><path d="M9.5 1.5V5H13"/>'),
    cloud: svg('<path d="M4.5 12.5a3 3 0 01-.3-6A4 4 0 0112 6a3.2 3.2 0 01-.5 6.5z"/>'),
    table: svg('<rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 6.5h12M6 6.5V13"/>'),
    browser: svg('<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M1.5 5.5h13"/>'),
    expand: svg('<path d="M4 6l4 4 4-4"/>'),
    reset: svg('<path d="M2.5 8a5.5 5.5 0 109.4-3.9M12.5 1.5v3h-3"/>'),
    lock: svg('<rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/>'),
  };

  // ------------------------------------------------------------------ state
  let DATA, SEED, PROB, SECS, SEC_BY_ID, IN_SECS, ROWS_BY_KEY, ALL_KEYS;
  let P; // progress { v, items: { key: {s, rv, n, sd, lr, rc, u} }, seedVer }
  let S; // settings
  let FILTERS;
  let CUR = { route: 'dash', sid: null, sec: null };
  const FILE = { supported: false, handle: null, perm: 'none', name: '', last: 0, err: '' };
  const GIST = { state: 'off', last: 0, err: '', busy: false };

  const view = $('#view');

  // ------------------------------------------------------------------ boot
  async function boot() {
    loadSettings();
    applyTheme();
    $('#themeBtn').addEventListener('click', toggleTheme);
    let vault;
    try {
      vault = await fetch('data/vault.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
      if (!window.crypto?.subtle || typeof DecompressionStream !== 'function') throw new Error('this browser is too old to open the sheet');
    } catch (e) {
      view.innerHTML = `<div class="empty">Could not load the sheet (${esc(e.message)}). If you opened index.html from disk, open the hosted site instead.</div>`;
      return;
    }
    const payload = (await openWithSavedKey(vault)) || (await lockScreen(vault));
    DATA = payload.sheet;
    SEED = payload.seed || {};
    document.body.classList.remove('locked');
    view.innerHTML = '';
    indexData();
    loadProgress();
    renderTabs();
    bindGlobal();
    route();
    window.addEventListener('hashchange', route);
    window.addEventListener('storage', (e) => {
      if (e.key === PKEY) { loadProgress(); rerender(); }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { refreshFromFile(); if (S.gist?.id) gistSafe(gistPull); }
    });
    new ResizeObserver(() => {
      document.documentElement.style.setProperty('--topbar-h', $('.topbar').offsetHeight + 'px');
    }).observe($('.topbar'));
    await fileInit();
    if (S.gist?.token && S.gist?.id) gistSafe(gistPull, true);
    updateSyncPill();
    renderBanner();
  }

  function indexData() {
    PROB = DATA.problems;
    SECS = DATA.sections;
    SEC_BY_ID = {};
    IN_SECS = {};
    ROWS_BY_KEY = {};
    for (const s of SECS) {
      SEC_BY_ID[s.id] = s;
      s.rows = [];
      const seen = new Set();
      s.groups.forEach((g, gi) => {
        g.keys = [...new Set(g.items.map((it) => it.k))];
        for (const it of g.items) {
          const row = { k: it.k, x: it.x || {}, gi };
          s.rows.push(row);
          if (!seen.has(it.k)) {
            seen.add(it.k);
            (ROWS_BY_KEY[it.k] ||= []).push({ sid: s.id, x: row.x, g });
          }
        }
      });
      s.keys = [...seen];
      for (const k of s.keys) (IN_SECS[k] ||= []).push(s.id);
    }
    ALL_KEYS = Object.keys(IN_SECS);
  }

  // ------------------------------------------------------------------ settings + progress
  function loadSettings() {
    try { S = JSON.parse(localStorage.getItem(SKEY)) || {}; } catch { S = {}; }
    S.collapsed ||= {};
    try { FILTERS = JSON.parse(sessionStorage.getItem(FKEY)) || {}; } catch { FILTERS = {}; }
  }
  function saveSettings() {
    try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch { /* storage full or blocked */ }
  }
  function saveFilters() {
    try { sessionStorage.setItem(FKEY, JSON.stringify(FILTERS)); } catch { /* ignore */ }
  }

  let localOK = true;
  function loadProgress() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(PKEY)); } catch { raw = null; }
    P = raw && typeof raw.items === 'object' ? raw : { v: 1, items: {}, seedVer: null };
    if (P.seedVer !== DATA.generated) {
      // First visit, or a newer import from your sheets. Problems never touched on the site take the sheet's values.
      // Problems you edited on the site keep your edits, unless the sheet changed them in this import (ch): then the
      // sheet's status wins and its note is added under yours.
      let changed = 0;
      for (const [k, { ch, ...e }] of Object.entries(SEED)) {
        const cur = P.items[k];
        if (!cur || (cur.u || 0) <= 1) { P.items[k] = { ...e, u: 1 }; continue; }
        if (!ch) continue;
        const next = { ...cur, u: Date.now() };
        if (e.s) { if (!done(cur.s)) next.sd = next.sd || today(); next.s = e.s; }
        if (e.rv) next.rv = 1;
        if (e.n && !(cur.n || '').includes(e.n)) next.n = cur.n ? `${cur.n}\n\n${e.n}` : e.n;
        P.items[k] = next;
        changed++;
      }
      P.seedVer = DATA.generated;
      saveLocal(changed > 0);
    }
  }
  function saveLocal(sync = true) {
    try { localStorage.setItem(PKEY, JSON.stringify(P)); localOK = true; } catch { localOK = false; }
    if (sync) { queueFileWrite(); queueGistPush(); }
    updateSyncPill();
  }
  const E = (k) => P.items[k] || EMPTY;

  function update(k, patch, opts = {}) {
    const prev = P.items[k] ? { ...P.items[k] } : null;
    const next = { ...(P.items[k] || {}), ...patch, u: Date.now() };
    if ('s' in patch) {
      if (done(patch.s) && !done(prev?.s)) next.sd = next.sd && prev?.sd ? next.sd : today();
      if (!done(patch.s)) delete next.sd;
    }
    for (const f of ['s', 'n', 'rv', 'sd', 'lr', 'rc']) if (!next[f]) delete next[f];
    P.items[k] = next;
    saveLocal();
    onChange(k);
    if (opts.undo && prev !== undefined) {
      toast(opts.undo, () => {
        P.items[k] = { ...(prev || {}), u: Date.now() };
        saveLocal();
        onChange(k);
      });
    }
  }

  function mergeItems(incoming) {
    let n = 0;
    for (const [k, e] of Object.entries(incoming || {})) {
      if (!e || typeof e !== 'object') continue;
      const cur = P.items[k];
      if (!cur || (e.u || 0) > (cur.u || 0)) { P.items[k] = e; n++; }
    }
    return n;
  }
  const exportObj = () => ({ app: APP_ID, version: 1, exported: new Date().toISOString(), items: P.items });
  const exportJSON = () => JSON.stringify(exportObj());
  function parseBackup(txt) {
    const o = JSON.parse(txt);
    if (o && o.items && typeof o.items === 'object' && !Array.isArray(o.items)) return o;
    throw new Error('This is not a DSA Prep Sheet progress file.');
  }

  // ------------------------------------------------------------------ counts
  function counts(keys) {
    const c = { solved: 0, help: 0, attempted: 0, none: 0, total: keys.length };
    for (const k of keys) {
      const s = E(k).s || '';
      if (s === 'solved') c.solved++;
      else if (s === 'help') c.help++;
      else if (s === 'attempted') c.attempted++;
      else c.none++;
    }
    c.done = c.solved + c.help + c.attempted;
    return c;
  }
  function barHTML(c) {
    const t = c.total || 1;
    return `<div class="bar" role="img" aria-label="${c.done} of ${c.total} solved"><i class="ok" style="width:${(c.solved * 100) / t}%"></i><i class="dnd" style="width:${(c.help * 100) / t}%"></i><i class="nd" style="width:${(c.attempted * 100) / t}%"></i></div>`;
  }
  const legendHTML = (c) => `<span><i class="sw ok"></i>D ${c.solved}</span><span><i class="sw dnd"></i>D/ND ${c.help}</span><span><i class="sw nd"></i>ND ${c.attempted}</span><span><i class="sw none"></i>${c.none} not solved</span>`;

  // ------------------------------------------------------------------ tabs + routing
  function renderTabs() {
    const cur = location.hash || '#/';
    const tab = (href, label, pct) => `<a class="tab" href="${href}"${cur === href || cur.startsWith(href + '/') ? ' aria-current="page"' : ''}>${esc(label)}${pct != null ? `<span class="pct">${pct}</span>` : ''}</a>`;
    let h = tab('#/', 'Dashboard');
    for (const s of SECS) { const c = counts(s.keys); h += tab(`#/s/${s.id}`, s.name, fmtPct(c.done, c.total)); }
    h += '<span class="tab-sep" aria-hidden="true"></span>';
    h += tab('#/all', 'All problems');
    h += tab('#/revise', `Revise (${ALL_KEYS.filter((k) => E(k).rv).length})`);
    h += tab('#/notes', 'Notes');
    $('#tabs').innerHTML = h;
    const a = $('#tabs [aria-current="page"]');
    if (a) a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function route() {
    closeMenu();
    const h = location.hash.replace(/^#\/?/, '');
    const parts = h.split('/');
    renderTabs();
    if (parts[0] === 's' && SEC_BY_ID[parts[1]]) {
      CUR = { route: 'sec', sid: parts[1], sec: SEC_BY_ID[parts[1]] };
      renderListPage(parts[2] ? decodeURIComponent(parts[2]) : null);
    } else if (parts[0] === 'all' || parts[0] === 'revise' || parts[0] === 'notes') {
      CUR = { route: parts[0], sid: parts[0], sec: virtualSection(parts[0]) };
      renderListPage(parts[1] ? decodeURIComponent(parts[1]) : null);
    } else {
      CUR = { route: 'dash', sid: null, sec: null };
      renderDashboard();
    }
    if (!parts[2] && !(parts[0] !== 's' && parts[1])) window.scrollTo(0, 0);
  }

  function rerender() {
    renderTabs();
    if (CUR.route === 'dash') renderDashboard();
    else {
      if (CUR.route !== 'sec') CUR.sec = virtualSection(CUR.route);
      renderStats();
      renderList();
    }
    if (DRAWER.k) renderDrawer();
    updateSyncPill();
  }

  function firstX(k) {
    const x = {};
    for (const r of ROWS_BY_KEY[k] || []) if (!x.pat && r.x.pat && r.sid !== 'striver') x.pat = r.x.pat;
    if (!x.pat) for (const r of ROWS_BY_KEY[k] || []) if (r.x.pat) { x.pat = r.x.pat; break; }
    return x;
  }

  function virtualSection(id) {
    if (id === 'all') {
      return {
        id, virtual: true, full: 'All problems', flat: true, extra: 'secs',
        desc: `Every unique problem across all ${SECS.length} sections (${ALL_KEYS.length}). A problem that appears in several lists shows up once here.`,
        rows: ALL_KEYS.map((k) => ({ k, x: firstX(k) })), keys: ALL_KEYS,
      };
    }
    if (id === 'revise') {
      const keys = ALL_KEYS.filter((k) => E(k).rv).sort((a, b) => (E(a).lr || '').localeCompare(E(b).lr || '') || (E(a).u || 0) - (E(b).u || 0));
      return {
        id, virtual: true, full: 'Revision list', flat: true, extra: 'lr', keepOrder: true,
        desc: 'Problems you starred for revision. Least recently revised first. Open one and press "Revised today" after you redo it.',
        rows: keys.map((k) => ({ k, x: firstX(k) })), keys,
      };
    }
    const keys = ALL_KEYS.filter((k) => E(k).n).sort((a, b) => (E(b).u || 0) - (E(a).u || 0));
    return {
      id, virtual: true, full: 'Notes', flat: true, extra: 'none', showNotes: true, keepOrder: true,
      desc: 'Every problem you have notes on, most recently edited first. Search looks inside notes too.',
      rows: keys.map((k) => ({ k, x: firstX(k) })), keys,
    };
  }

  // ------------------------------------------------------------------ dashboard
  function renderDashboard() {
    const all = counts(ALL_KEYS);
    const R = 54, C = 2 * Math.PI * R;
    const seg = (n, off, color) => `<circle cx="66" cy="66" r="${R}" fill="none" stroke="${color}" stroke-width="12" stroke-dasharray="${(n / (all.total || 1)) * C} ${C}" stroke-dashoffset="${-off}" stroke-linecap="butt"/>`;
    const solvedLen = (all.solved / (all.total || 1)) * C;
    const helpLen = (all.help / (all.total || 1)) * C;
    const dates = solvedDates();
    const streak = streakOf(dates);
    const todayN = dates.get(today()) || 0;
    const weekN = [...Array(7)].reduce((a, _, i) => a + (dates.get(ymd(addDays(new Date(), -i))) || 0), 0);
    const revN = ALL_KEYS.filter((k) => E(k).rv).length;
    const notesN = ALL_KEYS.filter((k) => E(k).n).length;

    let html = `
      <div class="hero">
        <div class="card hero-main">
          <div class="ring" aria-hidden="true">
            <svg viewBox="0 0 132 132">
              <circle cx="66" cy="66" r="${R}" fill="none" stroke="var(--surface-3)" stroke-width="12"/>
              ${seg(all.solved, 0, 'var(--ok)')}
              ${seg(all.help, solvedLen, 'var(--dnd)')}
              ${seg(all.attempted, solvedLen + helpLen, 'var(--nd)')}
            </svg>
            <div class="ring-label"><div class="big">${fmtPct(all.done, all.total)}</div><div class="small">overall</div></div>
          </div>
          <div class="hero-copy">
            <h1>${all.done} of ${all.total} problems solved</h1>
            <p>Counted once per problem across every section. D and D/ND: solved by yourself. ND: solved after seeing the solution. All three count as solved.</p>
            <div class="legend">${legendHTML(all)}</div>
          </div>
        </div>
        <div class="stats">
          <div class="card stat"><div class="k">Solved today</div><div class="v">${todayN}</div><div class="s">${weekN} in the last 7 days</div></div>
          <div class="card stat"><div class="k">Current streak</div><div class="v">${streak} day${streak === 1 ? '' : 's'}</div><div class="s">${streak ? 'Keep it going' : 'Solve one to start a streak'}</div></div>
          <a class="card stat" href="#/revise" style="color:inherit;text-decoration:none"><div class="k">Revision list</div><div class="v">${revN}</div><div class="s">Starred problems →</div></a>
          <a class="card stat" href="#/notes" style="color:inherit;text-decoration:none"><div class="k">Notes</div><div class="v">${notesN}</div><div class="s">Problems with notes →</div></a>
        </div>
      </div>

      <div class="section-title">Sections</div>
      <div class="sec-grid">`;
    for (const s of SECS) {
      const c = counts(s.keys);
      const d = { Easy: [0, 0], Medium: [0, 0], Hard: [0, 0] };
      for (const k of s.keys) { const p = PROB[k]; if (d[p.d]) { d[p.d][1]++; if (done(E(k).s)) d[p.d][0]++; } }
      html += `
        <a class="card sec-card" href="#/s/${s.id}">
          <div class="row1"><h3>${esc(s.name)}</h3><span class="pct-big">${fmtPct(c.done, c.total)}</span></div>
          <div class="meta">${c.done} / ${c.total} solved · D ${c.solved} · D/ND ${c.help} · ND ${c.attempted}</div>
          ${barHTML(c)}
          <div class="diffs">${[['Easy', 'e', 'Easy'], ['Medium', 'm', 'Med'], ['Hard', 'h', 'Hard']].filter(([n]) => d[n][1]).map(([n, c, l]) => `<span class="${c}">${l} <b>${d[n][0]}/${d[n][1]}</b></span>`).join('')}</div>
        </a>`;
    }
    html += `</div>

      <div class="section-title">Practice</div>
      <div class="two-col">
        <div class="card panel">
          <h3>Up next</h3>
          <p class="sub">The first open problem in each list, in sheet order.</p>
          <div class="next-list">${upNextHTML()}</div>
        </div>
        <div class="card panel">
          <h3>Activity</h3>
          <p class="sub">Problems marked solved per day, last 26 weeks.</p>
          ${heatmapHTML(dates)}
        </div>
      </div>

      <div class="section-title">By LeetCode contest rating</div>
      <div class="card panel">
        <h3>Solve rate by zerotrac rating</h3>
        <p class="sub">Rated LeetCode problems across all sections, in 100-point bands. Ratings come from zerotrac's contest-based model.</p>
        ${bandsHTML()}
      </div>`;
    view.innerHTML = html;
  }

  function upNextHTML() {
    const items = [];
    const first = (sid, pred, label) => {
      const s = SEC_BY_ID[sid];
      if (!s) return;
      const r = s.rows.find((r) => pred(r) && !done(E(r.k).s));
      if (r) items.push({ label, r, sid });
    };
    first('claude', (r) => r.x.pri === 'P1', "Claude 109 · next P1");
    first('company', (r) => true, 'Company OA set');
    first('google', (r) => r.gi === 0, 'Google · your list');
    first('striver', (r) => !PROB[r.k].ls, 'Striver A2Z · continue');
    first('master', () => true, 'DSA master set');
    first('cses', () => true, 'CSES · continue');
    const rev = ALL_KEYS.filter((k) => E(k).rv).sort((a, b) => (E(a).lr || '').localeCompare(E(b).lr || ''))[0];
    if (rev) items.push({ label: 'Revise · least recently revised', r: { k: rev, x: firstX(rev) }, sid: IN_SECS[rev][0] });
    if (!items.length) return '<div class="muted">Everything is solved. Impressive.</div>';
    return items.map(({ label, r, sid }) => {
      const p = PROB[r.k];
      return `<div class="next-item">
        <div class="grow"><div class="lab">${esc(label)}</div><div><a href="#" class="t" data-open="${esc(r.k)}" data-sid="${sid}">${esc(r.x.name || p.t)}</a> <span class="pid">${esc(idLabel(r.k, p))}</span></div></div>
        ${diffHTML(p, r.x)}
        <a class="btn sm" href="${esc(primaryUrl(r))}" target="_blank" rel="noopener">Solve ${I.ext}</a>
      </div>`;
    }).join('');
  }

  function solvedDates() {
    const m = new Map();
    for (const k of ALL_KEYS) { const e = E(k); if (done(e.s) && e.sd) m.set(e.sd, (m.get(e.sd) || 0) + 1); }
    return m;
  }
  function streakOf(m) {
    let d = new Date();
    if (!m.get(ymd(d))) d = addDays(d, -1);
    let n = 0;
    while (m.get(ymd(d))) { n++; d = addDays(d, -1); }
    return n;
  }
  function heatmapHTML(m) {
    const end = new Date();
    const start = addDays(end, -(7 * 25 + end.getDay()));
    let cells = '', total = 0, best = 0, active = 0;
    for (let d = new Date(start); ymd(d) <= ymd(addDays(end, 6 - end.getDay())); d = addDays(d, 1)) {
      const key = ymd(d);
      const n = m.get(key) || 0;
      const future = key > ymd(end);
      if (!future) { total += n; best = Math.max(best, n); if (n) active++; }
      const l = n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4;
      cells += `<i data-l="${l}" class="${future ? 'future' : ''}" title="${fmtDate(key)}: ${n} solved"></i>`;
    }
    return `<div class="heat-wrap"><div class="heat" role="img" aria-label="${total} problems solved in the last 26 weeks">${cells}</div></div>
      <div class="heat-meta"><span><b>${total}</b> solved</span><span><b>${active}</b> active days</span><span>Best day <b>${best}</b></span></div>
      <p class="fine" style="margin:8px 0 0">Problems imported from your workbooks have no solve date, so they are not shown here.</p>`;
  }
  function bandsHTML() {
    const bands = new Map();
    for (const k of ALL_KEYS) {
      const p = PROB[k];
      if (p.pl !== 'LeetCode' || !p.r) continue;
      const b = p.r < 1300 ? 1200 : p.r >= 3000 ? 3000 : Math.floor(p.r / 100) * 100;
      if (!bands.has(b)) bands.set(b, []);
      bands.get(b).push(k);
    }
    const keys = [...bands.keys()].sort((a, b) => a - b);
    let h = '<div class="bands">';
    for (const b of keys) {
      const c = counts(bands.get(b));
      const lbl = b === 1200 ? '< 1300' : b === 3000 ? '3000+' : `${b}–${b + 99}`;
      h += `<span class="lbl">${lbl}</span>${barHTML(c)}<span class="num" title="D ${c.solved} · D/ND ${c.help} · ND ${c.attempted}">${c.done}/${c.total}</span>`;
    }
    return h + '</div>';
  }

  // ------------------------------------------------------------------ list pages
  const defaultFilter = () => ({ q: '', st: 'all', diff: 'all', rmin: '', rmax: '', sort: 'sheet', tag: '', sec: 'all', lessons: true });
  const filt = () => (FILTERS[CUR.sid] ||= defaultFilter());

  function renderListPage(focusKey) {
    const sec = CUR.sec;
    const f = filt();
    const tags = new Map();
    for (const k of sec.keys) for (const t of PROB[k].tg || []) tags.set(t, (tags.get(t) || 0) + 1);
    const tagOpts = [...tags.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const stBtn = (v, l) => `<button type="button" data-st="${v}" aria-pressed="${f.st === v}">${l}</button>`;
    view.innerHTML = `
      <div class="sec-head">
        <div>
          <h1>${esc(sec.full)}</h1>
          <p>${esc(sec.desc)}</p>
          ${sec.src ? `<a class="src" href="${esc(sec.src)}" target="_blank" rel="noopener">Source ↗</a>` : ''}
        </div>
        <div class="card sec-stats" id="secStats"></div>
      </div>
      <div class="toolbar" id="toolbar">
        <label class="search">${I.search}<input class="input" id="q" type="search" placeholder="Search title, ID, pattern, tag, notes" value="${esc(f.q)}" aria-label="Search problems" autocomplete="off"><kbd>/</kbd></label>
        <div class="chipset" role="group" aria-label="Status filter">
          ${stBtn('all', 'All')}${stBtn('todo', 'Not solved')}${stBtn('done', 'Solved')}${stBtn('d', 'D')}${stBtn('dnd', 'D/ND')}${stBtn('nd', 'ND')}${stBtn('revise', '★ Revise')}${stBtn('notes', 'Notes')}
        </div>
        <select class="select" id="fDiff" aria-label="Difficulty">
          ${['all', 'Easy', 'Medium', 'Hard'].map((d) => `<option value="${d}"${f.diff === d ? ' selected' : ''}>${d === 'all' ? 'Any difficulty' : d}</option>`).join('')}
        </select>
        <span class="rating-filter"><input class="input" id="rmin" inputmode="numeric" placeholder="Rating ≥" value="${esc(f.rmin)}" aria-label="Minimum rating"><input class="input" id="rmax" inputmode="numeric" placeholder="≤" value="${esc(f.rmax)}" aria-label="Maximum rating"></span>
        <select class="select" id="fTag" aria-label="Topic tag">
          <option value="">Any topic</option>
          ${tagOpts.map(([t, n]) => `<option value="${esc(t)}"${f.tag === t ? ' selected' : ''}>${esc(t)} (${n})</option>`).join('')}
        </select>
        ${CUR.route === 'all' ? `<select class="select" id="fSec" aria-label="Section"><option value="all">All sections</option>${SECS.map((s) => `<option value="${s.id}"${f.sec === s.id ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select>` : ''}
        <select class="select" id="fSort" aria-label="Sort">
          <option value="sheet"${f.sort === 'sheet' ? ' selected' : ''}>${sec.virtual ? 'Default order' : 'Sheet order'}</option>
          <option value="r-asc"${f.sort === 'r-asc' ? ' selected' : ''}>Rating: low to high</option>
          <option value="r-desc"${f.sort === 'r-desc' ? ' selected' : ''}>Rating: high to low</option>
          <option value="recent"${f.sort === 'recent' ? ' selected' : ''}>Recently updated</option>
        </select>
        ${CUR.sid === 'striver' ? `<button type="button" class="btn sm ghost" id="fLessons" aria-pressed="${!f.lessons}">${f.lessons ? 'Hide lessons' : 'Show lessons'}</button>` : ''}
        <button type="button" class="btn sm" id="randomBtn" title="Open a random unsolved problem from this list">${I.shuffle} Random</button>
        ${!sec.flat ? `<button type="button" class="btn sm ghost" id="foldBtn">Collapse all</button>` : ''}
        <button type="button" class="btn sm ghost" id="clearBtn" hidden>Clear filters</button>
        <span class="count" id="count"></span>
      </div>
      <div id="list"></div>`;
    bindToolbar();
    renderStats();
    renderList();
    if (focusKey) focusRow(focusKey);
  }

  function renderStats() {
    const el = $('#secStats');
    if (!el) return;
    const c = counts(CUR.sec.keys);
    el.innerHTML = `
      <div class="row1"><span class="muted">${c.done} / ${c.total} solved</span><span class="pct-big">${fmtPct(c.done, c.total)}</span></div>
      ${barHTML(c)}
      <div class="legend" style="margin-top:10px;font-size:12.5px">${legendHTML(c)}</div>`;
  }

  function filterActive(f) {
    return f.q || f.st !== 'all' || f.diff !== 'all' || f.rmin || f.rmax || f.tag || (f.sec && f.sec !== 'all') || f.sort !== 'sheet' || !f.lessons;
  }

  function matches(r, f, terms) {
    const p = PROB[r.k], e = E(r.k), s = e.s || '';
    if (f.st === 'todo' && done(s)) return false;
    if (f.st === 'done' && !done(s)) return false;
    if (f.st === 'd' && s !== 'solved') return false;
    if (f.st === 'dnd' && s !== 'help') return false;
    if ((f.st === 'nd' || f.st === 'attempted') && s !== 'attempted') return false;
    if (f.st === 'revise' && !e.rv) return false;
    if (f.st === 'notes' && !e.n) return false;
    if (f.diff !== 'all' && p.d !== f.diff) return false;
    if (f.rmin && !(p.r >= +f.rmin)) return false;
    if (f.rmax && !(p.r <= +f.rmax)) return false;
    if (f.tag && !(p.tg || []).includes(f.tag)) return false;
    if (!f.lessons && p.ls) return false;
    if (CUR.route === 'all' && f.sec && f.sec !== 'all' && !IN_SECS[r.k].includes(f.sec)) return false;
    if (terms.length) {
      const hay = [r.x.name, p.t, p.id, p.pl === 'LeetCode' ? `lc ${p.id}` : '', p.pl, r.x.pat, r.x.topic, r.x.co, r.x.pri, (p.tg || []).join(' '), e.n].join(' ').toLowerCase();
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  }

  function sortRows(rows, f) {
    const by = {
      'r-asc': (a, b) => (PROB[a.k].r || 1e9) - (PROB[b.k].r || 1e9),
      'r-desc': (a, b) => (PROB[b.k].r || 0) - (PROB[a.k].r || 0),
      recent: (a, b) => (E(b.k).u || 0) - (E(a.k).u || 0),
    }[f.sort];
    return by ? [...rows].sort(by) : rows;
  }

  function listHead(sec) {
    const extra = { secs: 'Lists', lr: 'Revised', none: '' }[sec.extra] ?? ({ pri: 'Priority', lvl: 'Level', freq: 'Freq' }[sec.cols?.find((c) => c !== 'pat')] || '');
    return `<div class="list-head" aria-hidden="true"><span>Status</span><span>Problem</span><span>Difficulty</span><span class="r">Rating</span><span>${extra}</span><span></span></div>`;
  }

  function renderList() {
    const list = $('#list');
    if (!list) return;
    const sec = CUR.sec, f = filt();
    const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = sec.rows.filter((r) => matches(r, f, terms));
    $('#count').textContent = rows.length === sec.rows.length ? `${rows.length} problems` : `${rows.length} of ${sec.rows.length}`;
    $('#clearBtn').hidden = !filterActive(f);
    if (!rows.length) {
      list.innerHTML = `<div class="card empty">${sec.virtual && !sec.rows.length ? (CUR.route === 'revise' ? 'Nothing starred yet. Use the ☆ on any problem to add it here.' : 'No notes yet. Open any problem and write in its Notes box.') : 'No problems match these filters.'}</div>`;
      return;
    }
    if (sec.flat || f.sort !== 'sheet') {
      const sorted = sec.keepOrder && f.sort === 'sheet' ? rows : sortRows(rows, f);
      list.innerHTML = `<div class="card group">${listHead(sec)}<div class="rows">${sorted.map((r) => rowHTML(r, sec)).join('')}</div></div>`;
      return;
    }
    const byG = new Map();
    for (const r of rows) { if (!byG.has(r.gi)) byG.set(r.gi, []); byG.get(r.gi).push(r); }
    let html = '', lastStep = null;
    sec.groups.forEach((g, gi) => {
      const rs = byG.get(gi);
      if (!rs) return;
      if (g.step && g.step !== lastStep) {
        lastStep = g.step;
        const stepKeys = [...new Set(sec.groups.filter((x) => x.step === g.step).flatMap((x) => x.keys))];
        const c = counts(stepKeys);
        html += `<div class="step-h"><h2>${esc(g.step)}</h2><span class="line"></span><span class="cnt" data-step="${esc(g.step)}">${c.done}/${c.total}</span></div>`;
      }
      const c = counts(g.keys);
      const col = S.collapsed[`${sec.id}:${gi}`] && !terms.length ? 1 : 0;
      html += `<div class="card group" data-gi="${gi}" data-collapsed="${col}">
        <button type="button" class="group-h" aria-expanded="${!col}">
          <span class="chev">${I.chev}</span>
          <span class="gname">${esc(g.name)}${g.sub ? `<span class="gsub">${esc(g.sub)}</span>` : ''}</span>
          <span class="gprog"><span class="gcount">${c.done}/${c.total}</span>${barHTML(c)}</span>
        </button>
        <div class="rows">${rs.map((r) => rowHTML(r, sec)).join('')}</div>
      </div>`;
    });
    list.innerHTML = html;
    const fold = $('#foldBtn');
    if (fold) fold.textContent = $$('.group[data-collapsed="0"]', list).length ? 'Collapse all' : 'Expand all';
  }

  function refreshGroupCounts() {
    const sec = CUR.sec;
    if (!sec || sec.flat) return;
    $$('#list .group[data-gi]').forEach((el) => {
      const g = sec.groups[+el.dataset.gi];
      const c = counts(g.keys);
      $('.gcount', el).textContent = `${c.done}/${c.total}`;
      $('.gprog .bar', el).outerHTML = barHTML(c);
    });
    $$('#list .step-h .cnt').forEach((el) => {
      const keys = [...new Set(sec.groups.filter((x) => x.step === el.dataset.step).flatMap((x) => x.keys))];
      const c = counts(keys);
      el.textContent = `${c.done}/${c.total}`;
    });
  }

  // ------------------------------------------------------------------ rows
  function idLabel(k, p) {
    if (p.pl === 'LeetCode') return p.id ? `LC ${p.id}` : 'LC';
    if (p.pl === 'Codeforces') return `CF ${p.id || k.slice(3)}`;
    if (p.pl === 'CSES') return `CSES ${k.slice(5)}`;
    if (p.pl === 'SPOJ') return `SPOJ ${k.slice(5)}`;
    if (p.pl === 'takeUforward') return p.ls ? 'Lesson' : 'TUF';
    return p.pl || '';
  }
  function primaryUrl(r) {
    const p = PROB[r.k];
    return p.u || r.x.tuf || r.x.lc || '#';
  }
  function diffHTML(p, x) {
    if (x && x.lbl === 'Medium-Hard') return '<span class="diff Medium" title="LeetCode Medium rated about 1900+">Med-Hard</span>';
    if (!p.d) return '<span class="diff none">—</span>';
    return `<span class="diff ${esc(p.d)}">${esc(p.d === 'Medium' ? 'Medium' : p.d)}</span>`;
  }
  function ratingTitle(p) {
    if (!p.r) return 'No contest rating';
    return p.pl === 'LeetCode' ? `zerotrac contest rating ${p.r}` : `${p.pl} rating ${p.r}`;
  }
  function extraHTML(sec, x, k) {
    if (sec.extra === 'secs') return `<span class="pid">${IN_SECS[k].length}</span>`;
    if (sec.extra === 'lr') return `<span class="pid" title="${E(k).rc ? `Revised ${E(k).rc}×` : ''}">${E(k).lr ? fmtDate(E(k).lr, true) : 'never'}</span>`;
    if (sec.extra === 'none') return '';
    if (x.pri) return `<span class="badge pri ${esc(x.pri.toLowerCase())}" title="${esc(PRI_HELP[x.pri] || '')}">${esc(x.pri)}</span>`;
    if (x.lvl) return `<span class="badge" title="Striver's level">${esc(x.lvl)}</span>`;
    if (x.freq) return `<span class="freq" title="Google frequency on LeetCode">${esc(x.freq)}</span>`;
    return '';
  }
  function statusBadge(s) {
    if (s === 'help') return '<span class="badge st-help">D/ND</span>';
    if (s === 'attempted') return '<span class="badge st-attempted">ND</span>';
    return '';
  }

  function rowHTML(r, sec) {
    const p = PROB[r.k], x = r.x, e = E(r.k), s = e.s || '';
    const title = x.name || p.t;
    const others = (IN_SECS[r.k] || []).filter((id) => id !== sec.id);
    const sub = [];
    if (x.name && p.pl === 'LeetCode' && norm(x.name) !== norm(p.t)) sub.push(`<span title="Title on LeetCode">${esc(p.t)}</span>`);
    if (x.pat) sub.push(`<span class="pat" title="${esc(x.pat)}">${esc(x.pat)}</span>`);
    if (x.tuf && p.pl === 'LeetCode') sub.push(`<a href="${esc(x.tuf)}" target="_blank" rel="noopener">takeUforward</a>`);
    if (x.lc) sub.push(`<a href="${esc(x.lc)}" target="_blank" rel="noopener">LeetCode</a>`);
    if (x.yt) sub.push(`<a href="${esc(x.yt)}" target="_blank" rel="noopener" title="Striver's video">▶ Video</a>`);
    for (const id of others) sub.push(`<a class="chip" href="#/s/${id}/${encodeURIComponent(r.k)}" title="Also in ${esc(SEC_BY_ID[id].full)}">${esc(SEC_BY_ID[id].name)}</a>`);
    const extra = extraHTML(sec, x, r.k);
    return `<div class="prow${p.ls ? ' lesson' : ''}" data-k="${esc(r.k)}" data-st="${s}">
      <div class="c-status">
        <button type="button" class="chk" data-act="toggle" aria-label="${done(s) ? 'Unmark' : 'Mark'} solved: ${esc(title)}" title="${done(s) ? `${ST[s].code}: ${ST[s].label}. Click to unmark` : 'Mark solved (D)'}">${I.check}</button>
        <button type="button" class="caret" data-act="menu" aria-haspopup="menu" aria-label="Status options: ${esc(title)}" title="Choose D, D/ND or ND">${I.chev}</button>
      </div>
      <div class="c-title">
        <div class="tline"><a class="ptitle" href="${esc(primaryUrl(r))}" target="_blank" rel="noopener">${esc(title)}</a><span class="pid">${esc(idLabel(r.k, p))}</span>${p.pr ? '<span class="badge prem" title="LeetCode Premium">Premium</span>' : ''}${statusBadge(s)}</div>
        ${sub.length ? `<div class="sline">${sub.join('')}</div>` : ''}
      </div>
      <div class="c-diff">${diffHTML(p, x)}</div>
      <div class="c-rating${p.r ? '' : ' none'}" title="${esc(ratingTitle(p))}">${p.r || '—'}</div>
      <div class="c-extra">${extra}</div>
      <div class="mline">${diffHTML(p, x)}${p.r ? `<span class="pid" title="${esc(ratingTitle(p))}">${p.r}</span>` : ''}${extra}</div>
      <div class="c-actions">
        <button type="button" class="act star" data-act="revise" aria-pressed="${!!e.rv}" aria-label="Revise later: ${esc(title)}" title="${e.rv ? 'Remove from revision list' : 'Add to revision list'}">${I.star}</button>
        <button type="button" class="act note${e.n ? ' has' : ''}" data-act="open" aria-label="Notes and details: ${esc(title)}" title="Notes & details">${I.note}</button>
      </div>
      ${sec.showNotes && e.n ? `<div class="note-preview">${esc(e.n)}</div>` : ''}
    </div>`;
  }

  function rowFor(k) {
    return CUR.sec.rows.find((r) => r.k === k) || { k, x: firstX(k) };
  }

  function onChange(k) {
    if (CUR.route === 'dash') { renderDashboard(); renderTabs(); if (DRAWER.k === k) renderDrawer(); return; }
    const r = rowFor(k);
    const sel = `#list .prow[data-k="${CSS.escape(k)}"]`;
    $$(sel).forEach((el, i) => {
      const flash = el.classList.contains('flash');
      const act = el.contains(document.activeElement) ? document.activeElement.dataset.act : null;
      el.outerHTML = rowHTML(r, CUR.sec);
      const now = $$(sel)[i];
      if (flash) now?.classList.add('flash');
      if (act) $(`[data-act="${act}"]`, now)?.focus({ preventScroll: true }); // keep keyboard position
    });
    renderStats();
    refreshGroupCounts();
    renderTabs();
    if (DRAWER.k === k) renderDrawer();
  }

  function focusRow(k, open = false) {
    const f = filt();
    let el = $(`#list .prow[data-k="${CSS.escape(k)}"]`);
    if (!el && filterActive(f)) {
      FILTERS[CUR.sid] = defaultFilter();
      saveFilters();
      renderListPage();
      el = $(`#list .prow[data-k="${CSS.escape(k)}"]`);
    }
    if (!el) return;
    const g = el.closest('.group');
    if (g && g.dataset.collapsed === '1') { g.dataset.collapsed = '0'; $('.group-h', g).setAttribute('aria-expanded', 'true'); }
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.remove('flash');
      void el.offsetWidth;
      el.classList.add('flash');
    });
    if (open) openDrawer(k, CUR.sid);
  }

  // ------------------------------------------------------------------ toolbar
  function bindToolbar() {
    const f = filt();
    const apply = () => { saveFilters(); renderList(); };
    $('#q').addEventListener('input', debounce((e) => { f.q = e.target.value; apply(); }, 120));
    $('#toolbar .chipset').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-st]');
      if (!b) return;
      f.st = b.dataset.st;
      $$('#toolbar .chipset button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      apply();
    });
    $('#fDiff').addEventListener('change', (e) => { f.diff = e.target.value; apply(); });
    $('#fTag').addEventListener('change', (e) => { f.tag = e.target.value; apply(); });
    $('#fSort').addEventListener('change', (e) => { f.sort = e.target.value; apply(); });
    $('#fSec')?.addEventListener('change', (e) => { f.sec = e.target.value; apply(); });
    const num = (id, key) => $(id).addEventListener('input', debounce((e) => { f[key] = e.target.value.replace(/\D/g, ''); apply(); }, 250));
    num('#rmin', 'rmin');
    num('#rmax', 'rmax');
    $('#fLessons')?.addEventListener('click', (e) => {
      f.lessons = !f.lessons;
      e.currentTarget.textContent = f.lessons ? 'Hide lessons' : 'Show lessons';
      e.currentTarget.setAttribute('aria-pressed', String(!f.lessons));
      apply();
    });
    $('#clearBtn').addEventListener('click', () => { FILTERS[CUR.sid] = defaultFilter(); saveFilters(); renderListPage(); });
    $('#randomBtn').addEventListener('click', () => {
      const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
      const pool = CUR.sec.rows.filter((r) => matches(r, f, terms) && !done(E(r.k).s) && !PROB[r.k].ls);
      if (!pool.length) { toast('No unsolved problems match the current filters.'); return; }
      const r = pool[Math.floor(Math.random() * pool.length)];
      focusRow(r.k, true);
    });
    $('#foldBtn')?.addEventListener('click', (e) => {
      const groups = $$('#list .group[data-gi]');
      const collapse = groups.some((g) => g.dataset.collapsed === '0');
      for (const g of groups) {
        g.dataset.collapsed = collapse ? '1' : '0';
        $('.group-h', g).setAttribute('aria-expanded', String(!collapse));
        S.collapsed[`${CUR.sid}:${g.dataset.gi}`] = collapse ? 1 : undefined;
      }
      if (!collapse) for (const k of Object.keys(S.collapsed)) if (k.startsWith(CUR.sid + ':')) delete S.collapsed[k];
      saveSettings();
      e.currentTarget.textContent = collapse ? 'Expand all' : 'Collapse all';
    });
  }

  // ------------------------------------------------------------------ global events
  function bindGlobal() {
    view.addEventListener('click', (e) => {
      const opener = e.target.closest('[data-open]');
      if (opener) { e.preventDefault(); openDrawer(opener.dataset.open, opener.dataset.sid); return; }
      const gh = e.target.closest('.group-h');
      if (gh) {
        const g = gh.closest('.group');
        const col = g.dataset.collapsed === '1' ? '0' : '1';
        g.dataset.collapsed = col;
        gh.setAttribute('aria-expanded', String(col === '0'));
        const key = `${CUR.sid}:${g.dataset.gi}`;
        if (col === '1') S.collapsed[key] = 1; else delete S.collapsed[key];
        saveSettings();
        return;
      }
      const row = e.target.closest('.prow');
      if (!row) return;
      const k = row.dataset.k;
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'toggle') {
        const s = E(k).s || '';
        const title = rowFor(k).x.name || PROB[k].t;
        update(k, { s: done(s) ? '' : 'solved' }, { undo: done(s) ? `Unmarked “${title}”` : `Marked “${title}” solved` });
      } else if (act === 'menu') {
        openMenu(k, e.target.closest('[data-act]'));
      } else if (act === 'revise') {
        update(k, { rv: E(k).rv ? 0 : 1 });
      } else if (act === 'open') {
        openDrawer(k, CUR.sid);
      } else if (!e.target.closest('a, button')) {
        openDrawer(k, CUR.sid);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!$('#statusMenu').hidden) { closeMenu(true); return; }
        if (DRAWER.k) { closeDrawer(); return; }
      }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) && !document.activeElement?.isContentEditable) {
        const q = $('#q');
        if (q) { e.preventDefault(); q.focus(); q.select(); }
      }
    });
    document.addEventListener('click', (e) => {
      if (!$('#statusMenu').hidden && !e.target.closest('#statusMenu') && !e.target.closest('[data-act="menu"]')) closeMenu();
    });
    window.addEventListener('scroll', () => closeMenu(), { passive: true });

    $('#lockBtn').innerHTML = I.lock;
    $('#lockBtn').addEventListener('click', lockDevice);
    $('#syncPill').addEventListener('click', openSyncModal);
    $('#scrim').addEventListener('click', closeDrawer);
  }

  function toggleTheme() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    S.theme = dark ? 'light' : 'dark';
    saveSettings();
    applyTheme();
  }

  function applyTheme() {
    if (S.theme) document.documentElement.setAttribute('data-theme', S.theme);
    const dark = S.theme ? S.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    $('#themeBtn').innerHTML = dark ? I.sun : I.moon;
    $('#themeBtn').setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  }

  // ------------------------------------------------------------------ status menu
  let MENU = null;
  function openMenu(k, anchor) {
    const m = $('#statusMenu');
    if (MENU && MENU.k === k && !m.hidden) { closeMenu(); return; }
    MENU = { k, anchor };
    const cur = E(k).s || '';
    m.innerHTML = [...STATUSES].reverse().map((x) => `<button type="button" role="menuitemradio" aria-checked="${cur === x.s}" data-s="${x.s}"><i class="sw ${x.sw}"></i>${esc(x.label)}<span class="code">${x.code || '—'}</span></button>`).join('');
    m.hidden = false;
    const r = anchor.getBoundingClientRect();
    const w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
    m.style.top = (r.bottom + h + 8 > innerHeight ? r.top - h - 4 : r.bottom + 4) + 'px';
    (m.querySelector('[aria-checked="true"]') || m.firstElementChild).focus();
    m.onclick = (e) => {
      const b = e.target.closest('button[data-s]');
      if (!b) return;
      const title = rowFor(k).x.name || PROB[k].t;
      const s = b.dataset.s;
      closeMenu(true);
      update(k, { s }, { undo: `“${title}” → ${ST[s].label}` });
    };
    m.onkeydown = (e) => {
      const items = $$('button', m);
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      if (e.key === 'Tab') closeMenu();
    };
  }
  function closeMenu(refocus) {
    const m = $('#statusMenu');
    if (m.hidden) return;
    m.hidden = true;
    if (refocus && MENU?.anchor?.isConnected) MENU.anchor.focus();
    MENU = null;
  }

  // ------------------------------------------------------------------ drawer
  const DRAWER = { k: null, sid: null, opener: null };
  function openDrawer(k, sid) {
    if (!PROB[k]) return;
    DRAWER.opener = DRAWER.k ? DRAWER.opener : document.activeElement;
    DRAWER.k = k;
    DRAWER.sid = sid && SEC_BY_ID[sid] ? sid : IN_SECS[k][0];
    renderDrawer();
    $('#drawer').hidden = false;
    $('#scrim').hidden = false;
    $('#drawer .dr-close').focus();
  }
  function closeDrawer() {
    if (!DRAWER.k) return;
    flushNotes();
    DRAWER.k = null;
    $('#drawer').hidden = true;
    $('#scrim').hidden = true;
    if (DRAWER.opener?.isConnected) DRAWER.opener.focus();
  }

  function renderDrawer() {
    const ta0 = $('#drNotes');
    if (ta0 && ta0.dataset.k === DRAWER.k) flushNotes(); // never drop text that is still being typed
    const k = DRAWER.k, p = PROB[k], e = E(k), s = e.s || '';
    const rows = ROWS_BY_KEY[k] || [];
    const ctx = rows.find((r) => r.sid === DRAWER.sid) || rows[0] || { x: {} };
    const title = ctx.x.name || p.t;
    const links = [];
    links.push(`<a class="btn sm primary" href="${esc(p.u || ctx.x.tuf)}" target="_blank" rel="noopener">Open on ${esc(p.pl || 'site')} ${I.ext}</a>`);
    const seen = new Set([p.u]);
    for (const r of rows) {
      const add = (u, label) => { if (u && !seen.has(u)) { seen.add(u); links.push(`<a class="btn sm" href="${esc(u)}" target="_blank" rel="noopener">${label}</a>`); } };
      add(r.x.tuf, `takeUforward ${I.ext}`);
      add(r.x.lc, `LeetCode ${I.ext}`);
      add(r.x.yt, `${I.play} Video`);
      add(r.x.rep, `OA report ${I.ext}`);
    }
    const ta = $('#drawer textarea.notes');
    const keepNotes = ta && ta.dataset.k === k && document.activeElement === ta;

    const infoBlocks = rows.map((r) => {
      const sec = SEC_BY_ID[r.sid];
      const x = r.x;
      const kv = [];
      for (const f of ['pri', 'topic', 'lvl', 'pat', 'lbl', 'tgt', 'why', 'co', 'freq']) {
        if (!x[f]) continue;
        const v = f === 'pri' ? `${x.pri}${PRI_HELP[x.pri] ? ` <span class="muted">· ${esc(PRI_HELP[x.pri].split(' · ')[1])}</span>` : ''}` : esc(x[f]);
        kv.push(`<dt>${X_LABELS[f]}</dt><dd>${v}</dd>`);
      }
      if (x.design) kv.push('<dt>Design</dt><dd>Marked as a design problem in your sheet</dd>');
      if (x.rep) kv.push(`<dt>OA report</dt><dd><a href="${esc(x.rep)}" target="_blank" rel="noopener">${esc(x.repn || 'Report')}</a></dd>`);
      const gname = r.g ? `${r.g.step ? r.g.step + ' › ' : ''}${r.g.name}` : '';
      return `<div class="info-block">
        <h4><a href="#/s/${r.sid}/${encodeURIComponent(k)}" class="chip">${esc(sec.name)}</a><span class="muted" style="font-weight:400;font-size:12.5px">${esc(gname)}</span></h4>
        ${kv.length ? `<dl class="kv">${kv.join('')}</dl>` : ''}
        ${x.hint ? `<div class="dr-label" style="margin-top:12px">Hint</div><div class="spoiler hidden" tabindex="0" role="button" aria-label="Show hint"><span>${esc(x.hint)}</span></div>` : ''}
      </div>`;
    }).join('');

    $('#drawer').setAttribute('role', 'dialog');
    $('#drawer').setAttribute('aria-modal', 'true');
    $('#drawer').setAttribute('aria-labelledby', 'drTitle');
    $('#drawer').innerHTML = `
      <div class="dr-head">
        <div style="flex:1;min-width:0">
          <h2 id="drTitle">${esc(title)}</h2>
          <div class="meta">
            <span class="pid">${esc(idLabel(k, p))}</span>${diffHTML(p, ctx.x)}
            ${p.r ? `<span class="badge" title="${esc(ratingTitle(p))}">Rating ${p.r}</span>` : ''}
            ${p.pr ? '<span class="badge prem">Premium</span>' : ''}
            ${title !== p.t ? `<span class="muted" style="font-size:12.5px">${esc(p.t)}</span>` : ''}
          </div>
        </div>
        <button type="button" class="icon-btn dr-close" aria-label="Close details">${I.x}</button>
      </div>
      <div class="dr-body">
        <div class="dr-section"><div class="dr-links">${links.join('')}</div></div>
        <div class="dr-section">
          <div class="dr-label">Status <span class="saved-hint">${e.u > 1 ? `Updated ${ago(e.u)}` : e.u === 1 ? 'From your workbook' : ''}</span></div>
          <div class="seg" role="group" aria-label="Status">
            ${STATUSES.map((x) => `<button type="button" data-s="${x.s}" aria-pressed="${s === x.s}" title="${esc(x.label)}">${esc(x.short)}<small>${{ '': 'not yet', solved: 'by myself', help: 'by myself', attempted: 'saw solution' }[x.s]}</small></button>`).join('')}
          </div>
          <div class="dr-row" style="margin-top:10px">
            <button type="button" class="btn sm dr-rv" aria-pressed="${!!e.rv}">${e.rv ? '★ In revision list' : '☆ Add to revision list'}</button>
            <button type="button" class="btn sm dr-revised" title="Count one revision and stamp today's date">Revised today${e.rc ? ` (${e.rc}×)` : ''}</button>
            ${done(s) ? `<label class="fine" style="display:flex;gap:6px;align-items:center">Solved on <input type="date" class="input dr-sd" style="height:28px" value="${esc(e.sd || '')}" max="${today()}"></label>` : ''}
          </div>
          ${e.lr ? `<p class="fine" style="margin:6px 0 0">Last revised ${fmtDate(e.lr)}.</p>` : ''}
        </div>
        <div class="dr-section">
          <div class="dr-label"><label for="drNotes">Notes</label><span class="saved-hint" id="noteSaved"></span></div>
          <textarea class="notes" id="drNotes" data-k="${esc(k)}" placeholder="Approach, key idea, mistakes to remember, complexity…" spellcheck="false">${esc(e.n || '')}</textarea>
        </div>
        ${infoBlocks ? `<div class="dr-section"><div class="dr-label">In your lists (${rows.length})</div>${infoBlocks}</div>` : ''}
        ${(p.tg || []).length ? `<div class="dr-section"><div class="dr-label">Topic tags</div><div class="tags">${p.tg.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>` : ''}
      </div>`;

    const d = $('#drawer');
    $('.dr-close', d).onclick = closeDrawer;
    $('.seg', d).onclick = (ev) => {
      const b = ev.target.closest('button[data-s]');
      if (b) update(k, { s: b.dataset.s });
    };
    $('.dr-rv', d).onclick = () => update(k, { rv: E(k).rv ? 0 : 1 });
    $('.dr-revised', d).onclick = () => { update(k, { lr: today(), rc: (E(k).rc || 0) + 1 }); toast('Revision logged for today'); };
    const sd = $('.dr-sd', d);
    if (sd) sd.onchange = () => { if (sd.value) update(k, { sd: sd.value }); };
    $$('.spoiler', d).forEach((el) => {
      const reveal = () => { el.classList.remove('hidden'); el.removeAttribute('role'); el.removeAttribute('aria-label'); };
      el.onclick = reveal;
      el.onkeydown = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); reveal(); } };
    });
    const t = $('#drNotes', d);
    t.oninput = () => { $('#noteSaved').textContent = 'Saving…'; queueNotes(); };
    t.onblur = flushNotes;
    if (keepNotes) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
  }

  const queueNotes = debounce(() => flushNotes(), 500);
  function flushNotes() {
    const t = $('#drNotes');
    if (!t) return;
    const k = t.dataset.k;
    const v = t.value.replace(/\s+$/, '');
    if ((E(k).n || '') === v) { const h = $('#noteSaved'); if (h && h.textContent === 'Saving…') h.textContent = 'Saved'; return; }
    const prev = P.items[k] || {};
    P.items[k] = { ...prev, n: v, u: Date.now() };
    if (!v) delete P.items[k].n;
    saveLocal();
    const h = $('#noteSaved');
    if (h) h.textContent = 'Saved';
    // refresh the row without re-rendering the drawer (keeps the cursor where it is)
    if (CUR.route !== 'dash') {
      const r = rowFor(k);
      $$(`#list .prow[data-k="${CSS.escape(k)}"]`).forEach((el) => { el.outerHTML = rowHTML(r, CUR.sec); });
    }
  }

  // ------------------------------------------------------------------ toast
  let toastTimer;
  function toast(msg, undo) {
    const el = $('#toast');
    el.innerHTML = `${esc(msg)}${undo ? '<button type="button">Undo</button>' : ''}`;
    el.classList.add('show');
    if (undo) $('button', el).onclick = () => { el.classList.remove('show'); undo(); };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), undo ? 5000 : 2600);
  }

  // ------------------------------------------------------------------ file sync (Chrome / Edge)
  const idb = (() => {
    let dbp;
    const db = () => (dbp ||= new Promise((res, rej) => {
      const r = indexedDB.open('dsaSheet', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
    const op = async (mode, fn) => {
      const d = await db();
      return new Promise((res, rej) => {
        const tx = d.transaction('kv', mode);
        const req = fn(tx.objectStore('kv'));
        tx.oncomplete = () => res(req && req.result);
        tx.onerror = () => rej(tx.error);
      });
    };
    return { get: (k) => op('readonly', (s) => s.get(k)), set: (k, v) => op('readwrite', (s) => s.put(v, k)), del: (k) => op('readwrite', (s) => s.delete(k)) };
  })();

  async function fileInit() {
    FILE.supported = typeof window.showSaveFilePicker === 'function';
    if (!FILE.supported) return;
    try { FILE.handle = await idb.get('fileHandle'); } catch { FILE.handle = null; }
    if (!FILE.handle) return;
    FILE.name = FILE.handle.name;
    try { FILE.perm = await FILE.handle.queryPermission({ mode: 'readwrite' }); } catch { FILE.perm = 'prompt'; }
    if (FILE.perm === 'granted') await fileReadMerge(true);
  }
  async function setHandle(h) {
    FILE.handle = h;
    FILE.name = h.name;
    FILE.perm = 'granted';
    FILE.err = '';
    try { await idb.set('fileHandle', h); } catch { /* private window */ }
  }
  async function fileReadMerge(quiet) {
    try {
      const txt = await (await FILE.handle.getFile()).text();
      if (!txt.trim()) return 0;
      const n = mergeItems(parseBackup(txt).items);
      if (n) { saveLocal(false); rerender(); if (!quiet) toast(`Loaded ${n} newer entr${n === 1 ? 'y' : 'ies'} from ${FILE.name}`); }
      return n;
    } catch (e) {
      FILE.err = e.message;
      if (e.name === 'NotAllowedError') FILE.perm = 'prompt';
      return 0;
    } finally { updateSyncPill(); }
  }
  async function refreshFromFile() {
    if (FILE.handle && FILE.perm === 'granted') await fileReadMerge(false);
  }
  async function fileWrite() {
    if (!FILE.handle || FILE.perm !== 'granted') return;
    try {
      const w = await FILE.handle.createWritable();
      await w.write(JSON.stringify(exportObj(), null, 1));
      await w.close();
      FILE.last = Date.now();
      FILE.err = '';
      S.lastBackup = Date.now();
      saveSettings();
    } catch (e) {
      FILE.err = e.message;
      if (e.name === 'NotAllowedError' || e.name === 'SecurityError') FILE.perm = 'prompt';
    }
    updateSyncPill();
    renderBanner();
  }
  const queueFileWrite = debounce(fileWrite, 700);
  async function fileConnectNew() {
    try {
      const h = await window.showSaveFilePicker({ suggestedName: SYNC_FILE, types: JSON_TYPES });
      await setHandle(h);
      await fileWrite();
      toast(`Auto-saving to ${h.name}`);
    } catch (e) { if (e.name !== 'AbortError') toast(`Could not use that file: ${e.message}`); }
    renderSyncModal();
  }
  async function fileOpenExisting() {
    try {
      const [h] = await window.showOpenFilePicker({ types: JSON_TYPES });
      const perm = await h.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') { toast('Write permission is needed to keep the file up to date.'); return; }
      await setHandle(h);
      const n = await fileReadMerge(true);
      await fileWrite();
      toast(n ? `Loaded ${n} entr${n === 1 ? 'y' : 'ies'} from ${h.name}; auto-saving to it now` : `Auto-saving to ${h.name}`);
    } catch (e) { if (e.name !== 'AbortError') toast(`Could not open that file: ${e.message}`); }
    renderSyncModal();
  }
  async function fileResume() {
    try {
      FILE.perm = await FILE.handle.requestPermission({ mode: 'readwrite' });
      if (FILE.perm === 'granted') { await fileReadMerge(false); await fileWrite(); toast(`Auto-saving to ${FILE.name} again`); }
    } catch (e) { FILE.err = e.message; }
    updateSyncPill();
    renderBanner();
    renderSyncModal();
  }
  async function fileDisconnect() {
    FILE.handle = null; FILE.perm = 'none'; FILE.name = '';
    try { await idb.del('fileHandle'); } catch { /* ignore */ }
    updateSyncPill();
    renderSyncModal();
    renderBanner();
  }

  // ------------------------------------------------------------------ GitHub Gist sync
  async function gh(path, opts = {}) {
    const r = await fetch('https://api.github.com' + path, {
      ...opts,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${S.gist.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    if (!r.ok) {
      const msg = (await r.json().catch(() => ({}))).message || r.statusText;
      throw new Error(r.status === 401 ? 'GitHub rejected the token (401). Check it has the "gist" scope and has not expired.' : `GitHub ${r.status}: ${msg}`);
    }
    return r.status === 204 ? null : r.json();
  }
  async function gistPull() {
    const g = await gh(`/gists/${S.gist.id}`);
    const f = g.files && g.files[SYNC_FILE];
    if (!f) return 0;
    let txt = f.content;
    if (f.truncated) txt = await (await fetch(f.raw_url)).text();
    const n = mergeItems(parseBackup(txt).items);
    if (n) { saveLocal(false); rerender(); }
    // push back if this device has entries the gist lacks
    const remote = parseBackup(txt).items;
    const localNewer = Object.entries(P.items).some(([k, e]) => !remote[k] || (e.u || 0) > (remote[k].u || 0));
    if (localNewer) await gistPush();
    GIST.last = Date.now();
    return n;
  }
  async function gistPush() {
    await gh(`/gists/${S.gist.id}`, { method: 'PATCH', body: JSON.stringify({ files: { [SYNC_FILE]: { content: JSON.stringify(exportObj(), null, 1) } } }) });
    GIST.last = Date.now();
    S.lastBackup = Date.now();
    saveSettings();
  }
  async function gistSafe(fn, quiet) {
    if (!S.gist?.token || !S.gist?.id) return;
    if (GIST.busy) { GIST.again = fn; return; }
    GIST.busy = true; GIST.state = 'busy'; updateSyncPill();
    try {
      const n = await fn();
      GIST.state = 'ok'; GIST.err = '';
      if (fn === gistPull && n && !quiet) toast(`Pulled ${n} newer entr${n === 1 ? 'y' : 'ies'} from GitHub`);
    } catch (e) {
      GIST.state = 'err'; GIST.err = e.message;
    } finally {
      GIST.busy = false;
      updateSyncPill();
      renderBanner();
      if ($('#syncModal').open) renderSyncModal();
      if (GIST.again) { const f = GIST.again; GIST.again = null; gistSafe(f, true); }
    }
  }
  const queueGistPush = debounce(() => gistSafe(gistPush, true), 2000);
  async function gistConnect(token, id) {
    S.gist = { token: token.trim(), id: (id || '').trim().replace(/^.*\//, '') };
    GIST.state = 'busy'; GIST.err = ''; renderSyncModal();
    try {
      if (!S.gist.id) {
        const list = await gh('/gists?per_page=100');
        const found = list.find((g) => g.files && g.files[SYNC_FILE]);
        if (found) S.gist.id = found.id;
      }
      if (S.gist.id) {
        saveSettings();
        GIST.busy = false;
        await gistSafe(gistPull);
      } else {
        const g = await gh('/gists', { method: 'POST', body: JSON.stringify({ description: 'DSA Prep Sheet progress (synced by the site)', public: false, files: { [SYNC_FILE]: { content: JSON.stringify(exportObj(), null, 1) } } }) });
        S.gist.id = g.id;
        GIST.state = 'ok'; GIST.last = Date.now();
        S.lastBackup = Date.now();
        saveSettings();
        toast('Created a private gist and synced your progress');
      }
    } catch (e) {
      GIST.state = 'err'; GIST.err = e.message;
      if (!S.gist.id) delete S.gist;
      saveSettings();
    }
    updateSyncPill(); renderBanner(); renderSyncModal();
  }
  function gistDisconnect() {
    delete S.gist;
    GIST.state = 'off'; GIST.err = '';
    saveSettings();
    updateSyncPill(); renderBanner(); renderSyncModal();
  }

  // ------------------------------------------------------------------ backup files
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function downloadBackup() {
    download(`dsa-progress-${today()}.json`, JSON.stringify(exportObj(), null, 1), 'application/json');
    S.lastBackup = Date.now();
    S.lastExport = Date.now();
    saveSettings();
    updateSyncPill(); renderBanner();
  }
  function pickBackup(replace) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = async () => {
      const f = inp.files[0];
      if (!f) return;
      try {
        const obj = parseBackup(await f.text());
        if (replace) {
          if (!confirm(`Replace ALL progress in this browser with “${f.name}”? Anything not in that file will be lost here.`)) return;
          P.items = obj.items;
          saveLocal();
          rerender();
          toast(`Replaced progress with ${Object.keys(obj.items).length} entries from ${f.name}`);
        } else {
          const n = mergeItems(obj.items);
          saveLocal();
          rerender();
          toast(n ? `Merged ${n} newer entr${n === 1 ? 'y' : 'ies'} from ${f.name}` : `Nothing newer in ${f.name}; you are up to date`);
        }
        renderSyncModal();
      } catch (e) { toast(e.message); }
    };
    inp.click();
  }
  function exportCSV() {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Problem', 'Link', 'Status', 'REVISE', 'Notes', 'Lists', 'Difficulty', 'Rating', 'Solved on', 'Last revised'].map(q).join(',')];
    for (const k of ALL_KEYS) {
      const p = PROB[k], e = E(k);
      const name = p.pl === 'LeetCode' && p.id ? `${p.id}. ${p.t}` : (p.pl === 'Codeforces' ? `CF ${p.id}. ${p.t}` : p.t);
      lines.push([name, p.u, e.s ? ST[e.s].code : '', e.rv ? 'YES' : 'NO', e.n || '', IN_SECS[k].map((id) => SEC_BY_ID[id].name).join('; '), p.d || '', p.r || '', e.sd || '', e.lr || ''].map(q).join(','));
    }
    download(`dsa-sheet-${today()}.csv`, '﻿' + lines.join('\r\n'), 'text/csv');
  }
  function resetProgress() {
    if (!confirm('Reset progress in this browser back to what your workbooks had?\n\nA backup file of your current progress downloads first.')) return;
    downloadBackup();
    const now = Date.now();
    const items = {};
    for (const k of Object.keys(P.items)) items[k] = { u: now };
    for (const [k, e] of Object.entries(SEED)) items[k] = { ...e, u: now };
    P.items = items;
    saveLocal();
    rerender();
    renderSyncModal();
    toast('Progress reset to your workbook data');
  }

  // ------------------------------------------------------------------ sync pill / banner / modal
  function updateSyncPill() {
    const pill = $('#syncPill');
    if (!pill) return;
    let state = 'ok', text = 'Saved in this browser';
    const hasEdits = Object.values(P?.items || {}).some((e) => (e.u || 0) > 1);
    if (S.gist?.id) {
      if (GIST.state === 'busy') { state = 'busy'; text = 'Syncing with GitHub…'; }
      else if (GIST.state === 'err') { state = 'err'; text = 'GitHub sync error'; }
      else { state = 'ok'; text = `Synced to GitHub${GIST.last ? ' · ' + ago(GIST.last) : ''}`; }
    } else if (FILE.handle) {
      if (FILE.perm === 'granted' && !FILE.err) { state = 'ok'; text = `Auto-saving to ${FILE.name}`; }
      else { state = 'warn'; text = 'Click to resume file auto-save'; }
    } else if (!localOK) { state = 'err'; text = 'Browser storage is full or blocked'; }
    else if (hasEdits && (!S.lastBackup || Date.now() - S.lastBackup > 3 * 864e5)) { state = 'warn'; text = 'Only in this browser · back up'; }
    pill.dataset.state = state;
    $('.sync-text', pill).textContent = text;
    pill.title = 'Save & sync options';
  }

  function renderBanner() {
    const b = $('#banner');
    let html = '';
    if (FILE.handle && FILE.perm !== 'granted') {
      html = `<span class="grow">Your progress file <b>${esc(FILE.name)}</b> is connected, but the browser needs your OK to keep writing to it after a restart.</span><button class="btn sm primary" data-b="resume">Resume auto-save</button>`;
    } else if (S.gist?.id && GIST.state === 'err') {
      html = `<span class="grow">GitHub sync failed: ${esc(GIST.err)}</span><button class="btn sm" data-b="sync">Open sync settings</button>`;
    } else {
      const hasEdits = Object.values(P.items).some((e) => (e.u || 0) > 1);
      const snoozed = S.snooze && Date.now() < S.snooze;
      if (hasEdits && !S.gist?.id && !FILE.handle && !snoozed && (!S.lastBackup || Date.now() - S.lastBackup > 7 * 864e5)) {
        html = `<span class="grow">Your progress is saved only in this browser. Set up a progress file or GitHub sync so it is safe and you can open it on another computer.</span><button class="btn sm primary" data-b="sync">Set up saving</button><button class="btn sm ghost" data-b="snooze">Later</button>`;
      }
    }
    b.hidden = !html;
    b.innerHTML = html;
    b.onclick = (e) => {
      const a = e.target.closest('[data-b]')?.dataset.b;
      if (a === 'resume') fileResume();
      if (a === 'sync') openSyncModal();
      if (a === 'snooze') { S.snooze = Date.now() + 3 * 864e5; saveSettings(); renderBanner(); }
    };
  }

  function openSyncModal() {
    renderSyncModal();
    const m = $('#syncModal');
    if (!m.open) m.showModal();
  }

  function renderSyncModal() {
    const m = $('#syncModal');
    const entries = Object.values(P.items).filter((e) => e.s || e.n || e.rv).length;
    const fileTag = !FILE.supported ? '<span class="status-tag">Chrome / Edge only</span>'
      : FILE.handle ? (FILE.perm === 'granted' && !FILE.err ? `<span class="status-tag on">On · ${esc(FILE.name)}</span>` : '<span class="status-tag warn">Paused</span>')
        : '<span class="status-tag">Off</span>';
    const gistTag = S.gist?.id ? (GIST.state === 'err' ? '<span class="status-tag err">Error</span>' : GIST.state === 'busy' ? '<span class="status-tag warn">Syncing…</span>' : '<span class="status-tag on">On</span>') : '<span class="status-tag">Off</span>';
    m.innerHTML = `
      <div class="modal-head"><h2 id="syncTitle">Save &amp; sync your progress</h2><button type="button" class="icon-btn" data-m="close" aria-label="Close">${I.x}</button></div>
      <div class="modal-body">
        <div class="opt">
          <div class="ico">${I.browser}</div>
          <div>
            <h3>This browser <span class="status-tag on">Always on</span></h3>
            <p>Every change saves instantly in this browser (${entries} problems with a status, star or notes). Clearing site data or switching computers loses it, so also use one of the options below.</p>
          </div>
        </div>
        <div class="opt">
          <div class="ico">${I.file}</div>
          <div>
            <h3>Auto-save to a file on your computer ${fileTag}</h3>
            <p>Pick a file once and every change is written to it automatically. Put it in a OneDrive, Google Drive or Dropbox folder and it follows you to your other computers: there, choose <b>Open existing file</b>.</p>
            <div class="actions">
              ${FILE.supported ? (FILE.handle
                ? `${FILE.perm !== 'granted' ? '<button class="btn sm primary" data-m="file-resume">Resume auto-save</button>' : ''}<button class="btn sm" data-m="file-open">Switch file…</button><button class="btn sm ghost" data-m="file-off">Stop auto-saving</button>${FILE.last ? `<span class="fine">Last written ${ago(FILE.last)}</span>` : ''}`
                : '<button class="btn sm primary" data-m="file-new">Create progress file…</button><button class="btn sm" data-m="file-open">Open existing file…</button>')
                : '<span class="fine">Your browser cannot write files directly. Use the backup download below, or open this site in Chrome or Edge.</span>'}
            </div>
            ${FILE.err ? `<p class="fine" style="color:var(--bad);margin-top:6px">${esc(FILE.err)}</p>` : ''}
          </div>
        </div>
        <div class="opt">
          <div class="ico">${I.cloud}</div>
          <div>
            <h3>Sync through GitHub (any browser, any computer) ${gistTag}</h3>
            ${S.gist?.id
              ? `<p>Your progress is kept in a private gist on your GitHub account and syncs automatically: on every change, and whenever you come back to the tab. On another computer, paste the same token here.</p>
                 <div class="actions"><button class="btn sm primary" data-m="gist-sync">Sync now</button><a class="btn sm" href="https://gist.github.com/${esc(S.gist.id)}" target="_blank" rel="noopener">View gist ${I.ext}</a><button class="btn sm ghost" data-m="gist-off">Disconnect</button>${GIST.last ? `<span class="fine">Last sync ${ago(GIST.last)}</span>` : ''}</div>
                 ${GIST.err ? `<p class="fine" style="color:var(--bad);margin-top:6px">${esc(GIST.err)}</p>` : ''}`
              : `<p>Stores your progress in a private gist on your own GitHub account. Create a token with only the <b>gist</b> scope, paste it here, and do the same on every computer you use. The token stays in this browser.</p>
                 <div class="field"><label for="gTok">GitHub token (gist scope) · <a href="https://github.com/settings/tokens/new?scopes=gist&description=DSA%20Prep%20Sheet%20sync" target="_blank" rel="noopener">create one ↗</a></label><input class="input" id="gTok" type="password" autocomplete="off" spellcheck="false" placeholder="ghp_…"></div>
                 <div class="field"><label for="gId">Gist ID (optional: leave empty to find or create it)</label><input class="input" id="gId" autocomplete="off" spellcheck="false"></div>
                 <div class="actions"><button class="btn sm primary" data-m="gist-on">Connect</button>${GIST.state === 'busy' ? '<span class="fine">Connecting…</span>' : ''}</div>
                 ${GIST.err ? `<p class="fine" style="color:var(--bad);margin-top:6px">${esc(GIST.err)}</p>` : ''}`}
          </div>
        </div>
        <div class="opt">
          <div class="ico">${I.download}</div>
          <div>
            <h3>Backup file (works everywhere)</h3>
            <p>Download your progress as a .json file and load it on another computer. <b>Merge</b> keeps the newest version of each problem from both sides.</p>
            <div class="actions">
              <button class="btn sm primary" data-m="dl">${I.download} Download backup</button>
              <button class="btn sm" data-m="merge">${I.upload} Load backup (merge)</button>
              <button class="btn sm ghost" data-m="replace">Replace with backup…</button>
              ${S.lastExport ? `<span class="fine">Last download ${ago(S.lastExport)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="opt">
          <div class="ico">${I.table}</div>
          <div>
            <h3>Export to Excel</h3>
            <p>A CSV with every problem, its status (D, D/ND, ND), REVISE, notes and the lists it is in, in the same order as your Sheet2 columns.</p>
            <div class="actions"><button class="btn sm" data-m="csv">${I.table} Download CSV</button><button class="btn sm ghost danger" data-m="reset">${I.reset} Reset to workbook data…</button></div>
          </div>
        </div>
      </div>`;
    m.onclick = (e) => {
      if (e.target === m) { m.close(); return; }
      const a = e.target.closest('[data-m]')?.dataset.m;
      if (!a) return;
      if (a === 'close') m.close();
      if (a === 'file-new') fileConnectNew();
      if (a === 'file-open') fileOpenExisting();
      if (a === 'file-resume') fileResume();
      if (a === 'file-off') fileDisconnect();
      if (a === 'gist-on') {
        const tok = $('#gTok', m).value;
        if (!tok.trim()) { $('#gTok', m).focus(); return; }
        gistConnect(tok, $('#gId', m).value);
      }
      if (a === 'gist-sync') gistSafe(gistPull);
      if (a === 'gist-off') gistDisconnect();
      if (a === 'dl') { downloadBackup(); renderSyncModal(); }
      if (a === 'merge') pickBackup(false);
      if (a === 'replace') pickBackup(true);
      if (a === 'csv') exportCSV();
      if (a === 'reset') resetProgress();
    };
  }

  // ------------------------------------------------------------------ passphrase lock
  // data/vault.json = AES-256-GCM(gzip(JSON {sheet, seed})), key = PBKDF2-SHA256(passphrase). Written by tools/vault.mjs.
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function vaultKey(passphrase, vault) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(vault.salt), iterations: vault.iter },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  }
  async function openVault(vault, key) {
    const packed = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(vault.iv) }, key, unb64(vault.data));
    const text = await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    return JSON.parse(text);
  }
  async function openWithSavedKey(vault) {
    let saved;
    try { saved = await idb.get('vaultKey'); } catch { return null; }
    if (!saved || saved.salt !== vault.salt) return null;
    try { return await openVault(vault, saved.key); } catch {
      try { await idb.del('vaultKey'); } catch { /* ignore */ }
      return null;
    }
  }
  function lockScreen(vault) {
    return new Promise((resolve) => {
      view.innerHTML = `
        <div class="lock-wrap">
          <form class="card lock-card" id="lockForm">
            <div class="lock-icon">${I.lock}</div>
            <h1>This sheet is private</h1>
            <p class="muted">Enter the passphrase to open it.</p>
            <label for="lockPass" class="sr-only">Passphrase</label>
            <input class="input" id="lockPass" type="password" autocomplete="current-password" placeholder="Passphrase" required autofocus>
            <label class="check"><input type="checkbox" id="lockRemember" checked> Remember on this device</label>
            <button class="btn primary" type="submit" id="lockGo">Unlock</button>
            <p class="lock-err" id="lockErr" role="alert"></p>
          </form>
        </div>`;
      const form = $('#lockForm'), pass = $('#lockPass'), go = $('#lockGo'), err = $('#lockErr');
      pass.focus();
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!pass.value) return;
        go.disabled = true;
        go.textContent = 'Unlocking…';
        err.textContent = '';
        try {
          const key = await vaultKey(pass.value, vault);
          const payload = await openVault(vault, key);
          if ($('#lockRemember').checked) {
            try { await idb.set('vaultKey', { key, salt: vault.salt }); } catch { /* private window: unlock for this visit only */ }
          }
          resolve(payload);
        } catch {
          err.textContent = 'That passphrase is not right.';
          go.disabled = false;
          go.textContent = 'Unlock';
          pass.select();
        }
      });
    });
  }
  async function lockDevice() {
    if (!confirm('Lock the sheet on this device? You will need the passphrase to open it again. Your progress here is kept.')) return;
    flushNotes();
    try { await idb.del('vaultKey'); } catch { /* ignore */ }
    location.reload();
  }

  boot();
})();
