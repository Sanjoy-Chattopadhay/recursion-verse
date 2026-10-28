/* RecursionVerse — core: theme, nav, code tabs, syntax highlight, CLRS renderer, TOC, reveal */
(function () {
  'use strict';
  const RV = (window.RV = window.RV || {});
  const root = document.documentElement;

  /* ---------------- helpers ---------------- */
  RV.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  RV.$ = (sel, ctx = document) => ctx.querySelector(sel);
  RV.$$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  RV.store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  };

  /* ---------------- theme ---------------- */
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  RV.theme = () => root.dataset.theme || (mq && mq.matches ? 'dark' : 'light');
  RV.css = (name) => getComputedStyle(root).getPropertyValue(name).trim();
  function emitTheme() { document.dispatchEvent(new CustomEvent('rv:theme', { detail: RV.theme() })); }
  RV.toggleTheme = function () {
    const next = RV.theme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    RV.store.set('rv-theme', next);
    emitTheme();
  };
  if (mq && mq.addEventListener) mq.addEventListener('change', () => { if (!root.dataset.theme) emitTheme(); });

  /* ---------------- nav + footer ---------------- */
  const TABS = [
    { id: 'home', label: 'Home', href: 'index.html' },
    { id: 'recursion', label: 'Recursion', href: 'recursion.html', soon: true },
    { id: 'backtracking', label: 'Backtracking', href: 'backtracking/index.html' },
    { id: 'dp', label: 'Dynamic Programming', short: 'DP', href: 'dp/index.html' },
    { id: 'greedy', label: 'Greedy', href: 'greedy/index.html' },
    { id: 'bnb', label: 'Branch & Bound', short: 'B&B', href: 'branch-and-bound/index.html' },
  ];
  const LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.5" r="2.2"/><circle cx="5.5" cy="13" r="2.2"/><circle cx="18.5" cy="13" r="2.2"/><circle cx="9" cy="20" r="1.8"/><path d="M11 6.3 6.8 11.2M13 6.3l4.2 4.9M6.3 15.1 8.3 18.3"/></svg>';
  const MOON = '<svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  const SUN = '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/></svg>';

  function buildNav() {
    const host = RV.$('[data-nav]');
    if (!host) return;
    const base = host.dataset.base || '';
    const active = host.dataset.active || '';
    const wide = window.matchMedia('(min-width: 1200px)').matches;
    host.className = 'nav';
    host.innerHTML =
      '<div class="container nav-inner">' +
      `<a class="brand" href="${base}index.html" aria-label="RecursionVerse home"><span class="brand-mark">${LOGO}</span>RecursionVerse<small>by Sanjoy</small></a>` +
      '<nav class="tabs-nav" aria-label="Topics">' +
      TABS.map((t) => `<a href="${base}${t.href}" class="${t.id === active ? 'active' : ''}"${t.id === active ? ' aria-current="page"' : ''}>${wide || !t.short ? t.label : t.short}${t.soon ? '<span class="soon">soon</span>' : ''}</a>`).join('') +
      '</nav>' +
      `<button class="theme-toggle" type="button" aria-label="Toggle dark / light theme" title="Toggle theme">${MOON}${SUN}</button>` +
      '</div>';
    host.querySelector('.theme-toggle').addEventListener('click', RV.toggleTheme);
    const act = host.querySelector('.tabs-nav a.active');
    if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  function buildFooter() {
    const host = RV.$('[data-footer]');
    if (!host) return;
    const base = host.dataset.base || '';
    host.className = 'footer';
    host.innerHTML =
      '<div class="container footer-inner">' +
      `<div><strong style="color:var(--text)">RecursionVerse</strong> — Recursion · Backtracking · DP · Greedy · Branch &amp; Bound, one call at a time.</div>` +
      `<div class="flex wrap gap-2"><a href="${base}backtracking/index.html">Backtracking</a><a href="${base}dp/index.html">DP</a><a href="${base}greedy/index.html">Greedy</a><a href="${base}branch-and-bound/index.html">Branch &amp; Bound</a><a href="https://github.com/Sanjoy-Chattopadhay/recursion-verse" target="_blank" rel="noopener">Source on GitHub</a></div>` +
      '</div>';
  }

  /* ---------------- syntax highlighting ---------------- */
  const words = (s) => new Set(s.split(/\s+/).filter(Boolean));
  const LANGS = {
    cpp: {
      kw: words('if else for while do return break continue switch case default class struct public private protected const static auto new delete using namespace template typename true false nullptr this void sizeof inline'),
      types: words('int long short char bool double float string vector unordered_set set map unordered_map pair size_t std auto array'),
      line: '//',
    },
    java: {
      kw: words('if else for while do return break continue switch case default class public private protected static final new this true false null void import package extends implements interface var'),
      types: words('int long short char boolean double float String StringBuilder List ArrayList Set HashSet Map HashMap Integer Character Arrays Collections Math Object System'),
      line: '//',
    },
    python: {
      kw: words('def return if elif else for while in not and or is None True False class import from as pass break continue lambda nonlocal global yield with'),
      types: words('list set dict str int bool tuple len range max min sorted print enumerate self'),
      line: '#',
    },
  };

  function hlLine(line, lang) {
    const L = LANGS[lang];
    if (!L) return RV.esc(line);
    let out = '';
    let i = 0;
    const n = line.length;
    if (lang === 'cpp' && /^\s*#/.test(line)) return `<span class="tok-pre">${RV.esc(line)}</span>`;
    while (i < n) {
      const rest = line.slice(i);
      if (rest.startsWith(L.line)) { out += `<span class="tok-com">${RV.esc(rest)}</span>`; break; }
      const ch = line[i];
      if (ch === '"' || ch === "'") {
        let j = i + 1;
        while (j < n && line[j] !== ch) { if (line[j] === '\\') j++; j++; }
        out += `<span class="tok-str">${RV.esc(line.slice(i, j + 1))}</span>`;
        i = j + 1; continue;
      }
      let m = /^\d+(\.\d+)?[LlFf]?/.exec(rest);
      if (m && !/[A-Za-z_]/.test(line[i - 1] || '')) { out += `<span class="tok-num">${m[0]}</span>`; i += m[0].length; continue; }
      m = /^[A-Za-z_]\w*/.exec(rest);
      if (m) {
        const w = m[0];
        const after = line.slice(i + w.length);
        let cls = '';
        if (L.kw.has(w)) cls = 'tok-kw';
        else if (L.types.has(w)) cls = 'tok-type';
        else if (/^\s*\(/.test(after)) cls = 'tok-fn';
        out += cls ? `<span class="${cls}">${w}</span>` : w;
        i += w.length; continue;
      }
      if (/[=<>!+\-*/%&|^~?:]/.test(ch)) { out += `<span class="tok-op">${RV.esc(ch)}</span>`; i++; continue; }
      out += RV.esc(ch); i++;
    }
    return out;
  }

  /** returns {html, raw} for a code string; supports trailing `@@slot` markers */
  RV.highlight = function (code, lang) {
    const lines = code.replace(/\t/g, '    ').replace(/^\n+|\s+$/g, '').split('\n');
    const raw = [];
    const html = lines.map((ln) => {
      let slot = '', quiet = false;
      const m = /\s*@@(\w+)(-?)\s*$/.exec(ln);
      if (m) { slot = m[1]; quiet = m[2] === '-'; ln = ln.slice(0, m.index); }
      raw.push(ln);
      return `<span class="ln"${slot ? ` data-slot="${slot}"` : ''}${quiet ? ' data-quiet' : ''}>${hlLine(ln, lang) || ' '}</span>`;
    }).join('');
    return { html, raw: raw.join('\n') };
  };

  /* ---------------- CLRS pseudocode ---------------- */
  const CLRS_KW = words('for to downto if then else elseif while do return and or not each in repeat until break continue print exchange let of');
  const CLRS_CONST = words('TRUE FALSE NIL');
  function clrsInline(t) {
    // split off comment
    let comment = '';
    const ci = t.indexOf('//');
    if (ci >= 0) { comment = t.slice(ci + 2).trim(); t = t.slice(0, ci).replace(/\s+$/, ''); }
    let out = '';
    const re = /([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+|[A-Z]{4,}[A-Z0-9]*)|([A-Za-z_][A-Za-z0-9_]*)|([^A-Za-z_]+)/g;
    let m;
    while ((m = re.exec(t))) {
      if (m[1]) {
        out += CLRS_CONST.has(m[1])
          ? `<span class="const">${m[1]}</span>`
          : `<span class="proc">${m[1].toLowerCase().replace(/(^|-)([a-z])/g, (x, p, c) => p + c.toUpperCase())}</span>`;
      } else if (m[2]) {
        const w = m[2];
        if (CLRS_CONST.has(w)) out += `<span class="const">${w}</span>`;
        else if (CLRS_KW.has(w)) out += `<span class="kw">${w}</span>`;
        else if (/^[A-Z]$/.test(w)) out += `<span class="var">${w}</span>`;
        else out += `<span class="var">${w}</span>`;
      } else out += RV.esc(m[3]);
    }
    if (comment) out += `${out ? '    ' : ''}<span class="cm">// ${RV.esc(comment)}</span>`;
    return out;
  }
  /**
   * Render CLRS-style pseudocode.
   * Lines: header lines have no leading spaces and contain "(" (e.g. "HAM-CYCLE(A, k)").
   * Body lines are indented by 4 spaces per level. Line numbers restart per procedure.
   * Returns {el, lines: Map("PROC:n" -> element), procs: [names]}.
   */
  RV.renderCLRS = function (src) {
    const text = Array.isArray(src) ? src.join('\n') : src;
    const el = document.createElement('div');
    el.className = 'clrs';
    const map = new Map();
    const procs = [];
    let proc = '', num = 0;
    text.replace(/^\n+|\s+$/g, '').split('\n').forEach((line) => {
      if (!line.trim()) { const sp = document.createElement('div'); sp.style.height = '8px'; el.appendChild(sp); return; }
      const indentSpaces = /^ */.exec(line)[0].length;
      const body = line.trim();
      const row = document.createElement('div');
      if (indentSpaces === 0 && /^[A-Z][A-Z0-9-]*\(/.test(body)) {
        proc = body.slice(0, body.indexOf('('));
        procs.push(proc);
        num = 0;
        row.className = 'pl head';
        row.innerHTML = `<span class="n"></span><span class="t">${clrsInline(body)}</span>`;
      } else {
        num++;
        const level = Math.max(0, Math.round((indentSpaces - 4) / 4));
        row.className = 'pl';
        row.innerHTML = `<span class="n">${num}</span><span class="t">${'<span class="indent"></span>'.repeat(level)}${clrsInline(body)}</span>`;
        map.set(`${proc}:${num}`, row);
      }
      el.appendChild(row);
    });
    return { el, lines: map, procs };
  };

  /* ---------------- code tabs ---------------- */
  const COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
  const LABELS = { cpp: 'C++', java: 'Java', python: 'Python', clrs: 'CLRS pseudocode' };
  function buildCodeTabs(card) {
    const scripts = RV.$$('script[type="text/plain"]', card);
    if (!scripts.length) return;
    const tabs = document.createElement('div');
    tabs.className = 'code-tabs';
    tabs.setAttribute('role', 'tablist');
    const panels = [];
    scripts.forEach((s, k) => {
      const lang = s.dataset.lang;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.dataset.lang = lang;
      btn.textContent = s.dataset.label || LABELS[lang] || lang;
      tabs.appendChild(btn);
      const panel = document.createElement('div');
      panel.className = 'code-panel';
      panel.dataset.lang = lang;
      if (lang === 'clrs') {
        const r = RV.renderCLRS(s.textContent);
        r.el.style.cssText = 'border:0;box-shadow:none;border-radius:0;background:var(--surface)';
        panel.appendChild(r.el);
        panel._raw = s.textContent.replace(/^\n+|\s+$/g, '');
      } else {
        const { html, raw } = RV.highlight(s.textContent, lang);
        const pre = document.createElement('pre');
        pre.className = 'code';
        pre.innerHTML = html;
        panel.appendChild(pre);
        panel._raw = raw;
      }
      panels.push(panel);
      s.remove();
      btn.addEventListener('click', () => { select(lang); if (lang !== 'clrs') { RV.store.set('rv-lang', lang); syncAll(lang, card); } });
    });
    const sp = document.createElement('span'); sp.className = 'spacer'; tabs.appendChild(sp);
    const copy = document.createElement('button');
    copy.type = 'button'; copy.className = 'copy-btn'; copy.innerHTML = COPY_ICON + '<span>Copy</span>';
    copy.addEventListener('click', async () => {
      const p = panels.find((x) => x.classList.contains('active'));
      try { await navigator.clipboard.writeText(p._raw); copy.querySelector('span').textContent = 'Copied!'; }
      catch (e) { copy.querySelector('span').textContent = 'Select & copy'; }
      setTimeout(() => (copy.querySelector('span').textContent = 'Copy'), 1400);
    });
    tabs.appendChild(copy);
    card.prepend(tabs);
    panels.forEach((p) => card.appendChild(p));
    function select(lang) {
      if (!panels.some((p) => p.dataset.lang === lang)) lang = panels[0].dataset.lang;
      RV.$$('button[role="tab"]', tabs).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.lang === lang)));
      panels.forEach((p) => p.classList.toggle('active', p.dataset.lang === lang));
    }
    card._select = select;
    select(card.dataset.default || RV.store.get('rv-lang') || 'cpp');
  }
  function syncAll(lang, except) {
    RV.$$('.code-card').forEach((c) => { if (c !== except && c._select && !c.dataset.default) c._select(lang); });
  }

  /* ---------------- standalone CLRS blocks ---------------- */
  function buildCLRSBlocks() {
    RV.$$('script[type="text/plain"][data-clrs]').forEach((s) => {
      const r = RV.renderCLRS(s.textContent);
      s.replaceWith(r.el);
    });
  }

  /* ---------------- TOC + scrollspy ---------------- */
  function buildTOC() {
    const toc = RV.$('.toc[data-auto]');
    if (!toc) return;
    const secs = RV.$$('main section[id]').filter((s) => s.querySelector('h2'));
    toc.innerHTML = '<div class="toc-title">On this page</div>' + secs.map((s) => `<a href="#${s.id}">${RV.esc(s.dataset.toc || s.querySelector('h2').textContent)}</a>`).join('');
    const links = secs.map((s) => toc.querySelector(`a[href="#${s.id}"]`));
    let ticking = false, cur = -1;
    const spy = () => {
      ticking = false;
      const line = window.innerHeight * 0.3;
      let k = 0;
      secs.forEach((s, j) => { if (s.getBoundingClientRect().top <= line) k = j; });
      if (k !== cur) { if (links[cur]) links[cur].classList.remove('active'); links[k].classList.add('active'); cur = k; }
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
    spy();
  }

  /* ---------------- reveal ---------------- */
  function reveal() {
    const els = RV.$$('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach((e) => io.observe(e));
  }

  /* ---------------- mini trees for the leaf / root / path idea ---------------- */
  RV.miniTree = function (kind) {
    const P = { r: [110, 22], a: [60, 68], b: [160, 68], aa: [35, 114], ab: [85, 114], ba: [135, 114], bb: [185, 114] };
    const E = [['r', 'a', 'a'], ['r', 'b', 'b'], ['a', 'aa', 'a'], ['a', 'ab', 'b'], ['b', 'ba', 'a'], ['b', 'bb', 'b']];
    const pathE = new Set(['r-a', 'a-ab']);
    let s = '';
    E.forEach(([u, v, lab]) => {
      const [x1, y1] = P[u], [x2, y2] = P[v];
      const onPath = kind === 'path' && pathE.has(`${u}-${v}`);
      s += `<line class="me${onPath ? ' hl-path-e' : ''}${kind === 'root' ? ' hl-up' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${kind === 'root' ? ' stroke-dasharray="5 4"' : ''}/>`;
      if (kind === 'path') s += `<text class="ml" x="${(x1 + x2) / 2 + (x2 > x1 ? 6 : -12)}" y="${(y1 + y2) / 2}"${onPath ? ' style="fill:var(--path);font-weight:800"' : ''}>${lab}</text>`;
    });
    const vals = { aa: 2, ab: 3, ba: 1, bb: 4, a: 3, b: 4, r: 4 };
    Object.entries(P).forEach(([k, [x, y]]) => {
      const leaf = k.length === 2;
      let cls = 'mn';
      if (kind === 'leaf' && leaf) cls += ' hl-leaf';
      if (kind === 'root' && k === 'r') cls += ' hl-root';
      if (kind === 'path' && (k === 'r' || k === 'a' || k === 'ab')) cls += ' hl-path-n';
      s += `<circle class="${cls}" cx="${x}" cy="${y}" r="${k === 'r' ? 10 : 8}"/>`;
      if (kind === 'leaf' && leaf) s += `<text class="ans" x="${x}" y="${y + 24}" text-anchor="middle" style="fill:var(--leaf)">${k}</text>`;
      if (kind === 'root') s += `<text class="ans" x="${x + (k === 'r' ? 16 : 13)}" y="${y + 4}" style="fill:${k === 'r' ? 'var(--root)' : 'var(--text-faint)'}">${vals[k]}</text>`;
    });
    if (kind === 'root') s += '<text class="ans" x="134" y="18" style="fill:var(--root)">← max</text>';
    if (kind === 'path') s += '<text class="ans" x="100" y="138" text-anchor="middle" style="fill:var(--path)">answer = "ab"</text>';
    return `<svg class="mini" viewBox="0 0 220 142" role="img" aria-label="${kind} diagram">${s}</svg>`;
  };

  RV.ready = function (fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  };

  RV.ready(() => {
    buildNav();
    buildFooter();
    buildCLRSBlocks();
    RV.$$('[data-mini]').forEach((el) => { el.outerHTML = RV.miniTree(el.dataset.mini); });
    RV.$$('.code-card').forEach(buildCodeTabs);
    buildTOC();
    reveal();
  });
})();
