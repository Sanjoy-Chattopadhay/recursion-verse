/* RecursionVerse — trace engine
 *
 * Tracer      : records an algorithm run as a list of steps (tree nodes, call stack, memory snapshot, outputs).
 * TracePlayer : replays those steps — animated state-space tree, CLRS line highlight, 3-D call stack,
 *               memory panel, outputs, scrubber and keyboard control.
 * Helpers     : RV.cells (array cells), RV.matrix (adjacency matrix), RV.GraphView (graph drawing).
 */
(function () {
  'use strict';
  const RV = window.RV;
  const esc = RV.esc;
  const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));

  /* ======================================================================
     Tracer
     ====================================================================== */
  class Tracer {
    constructor(snap) {
      this.nodes = [];
      this.steps = [];
      this.frames = [];
      this.out = [];
      this.snap = snap || (() => ({}));
    }
    get top() { return this.frames[this.frames.length - 1]; }

    /** create a tree node under the current frame (or under o.parent) */
    node(o = {}) {
      const parent = o.parent !== undefined ? o.parent : this.top ? this.top.node : -1;
      const id = this.nodes.length;
      this.nodes.push({
        id, parent,
        depth: parent < 0 ? 0 : this.nodes[parent].depth + 1,
        children: [],
        born: this.steps.length,
        label: o.label !== undefined ? String(o.label) : '',
        parts: o.parts,
        edge: o.edge !== undefined ? String(o.edge) : '',
        sub: o.sub !== undefined ? String(o.sub) : '',
        fill: o.fill,
        pruned: !!o.pruned,
      });
      if (parent >= 0) this.nodes[parent].children.push(id);
      return id;
    }
    /** enter a recursive call: new node + new stack frame */
    call(fn, args, o = {}) {
      const id = this.node(o);
      this.frames.push({ node: id, fn, args: args.map((a) => ({ ...a })) });
      this.step({ kind: o.kind || 'call', line: o.line, note: o.note, mark: [[id, 'active']] });
      return id;
    }
    /** leave the current call */
    ret(o = {}) {
      const f = this.top;
      const step = { kind: o.kind || 'return', line: o.line, note: o.note, mark: [[f.node, o.status || 'done']] };
      if (o.val !== undefined) step.val = [[f.node, o.val]];
      this.step(step);
      this.frames.pop();
    }
    /** a choice rejected by isValid(): drawn as a red, crossed-out child */
    prune(o = {}) {
      const id = this.node(Object.assign({}, o, { pruned: true }));
      this.step({ kind: 'prune', line: o.line, note: o.note, mark: [[id, 'pruned']], cur: id });
      return id;
    }
    /** update a local variable / argument of the current frame */
    set(name, value, extra) {
      const f = this.top;
      if (!f) return;
      const a = f.args.find((x) => x.name === name);
      if (a) a.value = value;
      else f.args.push(Object.assign({ name, value }, extra || {}));
    }
    emit(v, bad) { this.out.push({ v: String(v), bad: !!bad }); }
    step(o = {}) {
      const top = this.top;
      this.steps.push({
        cur: o.cur !== undefined ? o.cur : top ? top.node : 0,
        line: o.line,
        note: o.note || '',
        kind: o.kind || 'info',
        mark: o.mark || [],
        val: o.val,
        frames: this.frames.map((f) => ({ node: f.node, fn: f.fn, args: f.args.map((a) => ({ ...a })) })),
        mem: clone(this.snap()),
        out: this.out.slice(),
        focus: o.focus,
      });
    }
  }
  RV.Tracer = Tracer;

  /* ======================================================================
     TracePlayer
     ====================================================================== */
  const SPEEDS = [1800, 1300, 980, 740, 560, 410, 290, 190, 115, 60];
  const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICON = {
    reset: I('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
    back: I('<path d="M15 18l-6-6 6-6"/>'),
    fwd: I('<path d="M9 18l6-6-6-6"/>'),
    end: I('<path d="M6 18l6-6-6-6M17 6v12"/>'),
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>',
  };
  const KIND = {
    call: 'call', return: 'return', prune: 'prune', solution: 'found ✓', change: 'choose', revert: 'undo',
    check: 'check', base: 'base case', info: 'step', dead: 'dead end', memo: 'memo hit', start: 'start', done: 'finished',
  };
  const LEGEND = {
    active: '<span><i class="l-active"></i>on the stack</span>',
    path: '<span><i class="l-path"></i>current path</span>',
    sol: '<span><i class="l-sol"></i>answer</span>',
    pruned: '<span><i class="l-pruned"></i>rejected by isValid</span>',
    done: '<span><i class="l-done"></i>returned</span>',
    memo: '<span><i class="l-memo"></i>memo hit</span>',
  };

  class TracePlayer {
    constructor(host, cfg = {}) {
      this.host = typeof host === 'string' ? document.querySelector(host) : host;
      this.cfg = Object.assign({
        title: 'Visualizer', treeTitle: 'State-space tree (recursion tree)', memTitle: 'Memory', outTitle: 'Answers found',
        extraTitle: '', code: true, stack: true, mem: true, out: true, extra: false,
        levelH: 74, gapX: 14, minNodeW: 30, legend: ['active', 'path', 'sol', 'pruned', 'done'], treeMaxH: 460,
      }, cfg);
      this.i = 0;
      this.prevI = -1;
      this.playing = false;
      this.speed = this.cfg.speed || 5;
      this.zoom = 1;
      this.build();
    }

    build() {
      const c = this.cfg;
      const el = document.createElement('div');
      el.className = 'viz';
      el.tabIndex = 0;
      el.setAttribute('aria-label', `${c.title} — interactive visualizer`);
      el.innerHTML = `
        <div class="viz-top">
          <div class="viz-title"><span class="live"></span>${c.title}</div>
          <div class="viz-inputs"></div>
        </div>
        <div class="narration" aria-live="polite"><span class="badge">ready</span><div class="txt">Press ▶ to start, or step with →.</div></div>
        <div class="viz-body">
          <div class="viz-main">
            <div class="vpanel vp-tree">
              <div class="vpanel-h"><h4>${c.treeTitle}</h4>
                <div class="tools"><button type="button" data-z="-" title="Zoom out">−</button><button type="button" data-z="fit" title="Fit to width">⤢</button><button type="button" data-z="+" title="Zoom in">+</button></div></div>
              <div class="tree-scroll" style="max-height:${c.treeMaxH}px"><svg class="tree-svg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Recursion tree"></svg></div>
              <div class="tree-legend">${c.legend.map((k) => LEGEND[k] || '').join('')}</div>
            </div>
            ${c.extra ? `<div class="vpanel vp-extra"><div class="vpanel-h"><h4>${c.extraTitle}</h4><div class="tools extra-tools"></div></div><div class="extra"></div></div>` : ''}
            ${c.mem ? `<div class="vpanel vp-mem"><div class="vpanel-h"><h4>${c.memTitle}</h4><span class="mem-note faint" style="font-size:.74rem"></span></div><div class="mem"></div></div>` : ''}
          </div>
          <div class="viz-side">
            ${c.code ? '<div class="vpanel vp-code"><div class="vpanel-h"><h4>Pseudocode · CLRS style</h4></div><div class="viz-code"></div></div>' : ''}
            ${c.stack ? '<div class="vpanel vp-stack"><div class="vpanel-h"><h4>Call stack</h4><span class="chip stack-depth">depth 0</span></div><div class="stack3d"><div class="stack3d-inner"></div></div><div class="stack-more"></div></div>' : ''}
            ${c.out ? `<div class="vpanel vp-out"><div class="vpanel-h"><h4>${c.outTitle}</h4><span class="chip accent out-count">0</span></div><div class="outputs"></div></div>` : ''}
          </div>
        </div>
        <div class="viz-controls">
          <div class="btns">
            <button type="button" class="btn btn-icon" data-a="reset" title="Restart (Home)" aria-label="Restart">${ICON.reset}</button>
            <button type="button" class="btn btn-icon" data-a="back" title="Step back (←)" aria-label="Step back">${ICON.back}</button>
            <button type="button" class="btn btn-icon btn-primary play" data-a="play" title="Play / pause (Space)" aria-label="Play">${ICON.play}</button>
            <button type="button" class="btn btn-icon" data-a="fwd" title="Step forward (→)" aria-label="Step forward">${ICON.fwd}</button>
            <button type="button" class="btn btn-icon" data-a="end" title="Jump to end (End)" aria-label="Jump to end">${ICON.end}</button>
            <button type="button" class="btn btn-sm" data-a="sol" title="Jump to the next answer">Next ✓</button>
          </div>
          <div class="scrub"><input type="range" min="0" max="0" value="0" aria-label="Step"><span class="count">0 / 0</span></div>
          <label class="speed">Speed <input type="range" min="1" max="10" value="${this.speed}" aria-label="Playback speed"></label>
        </div>
        <div class="viz-hint">Keyboard: <kbd>←</kbd> <kbd>→</kbd> step · <kbd>Space</kbd> play / pause · click any tree node to jump to the moment it was created.</div>`;
      this.host.appendChild(el);
      this.el = el;
      const q = (s) => el.querySelector(s);
      this.inputs = q('.viz-inputs');
      this.badge = q('.narration .badge');
      this.txt = q('.narration .txt');
      this.svg = q('.tree-svg');
      this.scroller = q('.tree-scroll');
      this.memEl = q('.mem');
      this.memNote = q('.mem-note');
      this.extraEl = q('.extra');
      this.extraTools = q('.extra-tools');
      this.codeEl = q('.viz-code');
      this.stackInner = q('.stack3d-inner');
      this.stackMore = q('.stack-more');
      this.stackDepth = q('.stack-depth');
      this.outEl = q('.outputs');
      this.outCount = q('.out-count');
      this.range = q('.scrub input');
      this.count = q('.scrub .count');
      this.playBtn = q('[data-a="play"]');
      if (!c.out && q('[data-a="sol"]')) q('[data-a="sol"]').remove();

      el.querySelector('.viz-controls').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-a]');
        if (!b) return;
        const a = b.dataset.a;
        if (a === 'play') this.toggle();
        else { this.stop(); if (a === 'reset') this.go(0); if (a === 'back') this.go(this.i - 1); if (a === 'fwd') this.go(this.i + 1); if (a === 'end') this.go(this.last); if (a === 'sol') this.nextSolution(); }
      });
      this.range.addEventListener('input', () => { this.stop(); this.go(+this.range.value); });
      q('.speed input').addEventListener('input', (e) => { this.speed = +e.target.value; });
      q('.vp-tree .tools').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-z]');
        if (!b) return;
        if (b.dataset.z === '+') this.zoom = Math.min(2, this.zoom * 1.2);
        if (b.dataset.z === '-') this.zoom = Math.max(0.25, this.zoom / 1.2);
        if (b.dataset.z === 'fit') this.fit(true);
        this.applyZoom();
        this.follow(true);
      });
      this.svg.addEventListener('click', (e) => {
        const g = e.target.closest('.g-node');
        if (!g || !this.T) return;
        this.stop();
        this.go(this.T.nodes[+g.dataset.id].born);
      });
      el.addEventListener('keydown', (e) => {
        if (e.target.closest('input, select, textarea')) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); this.stop(); this.go(this.i + 1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); this.stop(); this.go(this.i - 1); }
        else if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); this.toggle(); }
        else if (e.key === 'Home') { e.preventDefault(); this.stop(); this.go(0); }
        else if (e.key === 'End') { e.preventDefault(); this.stop(); this.go(this.last); }
      });
      let rz;
      window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (this.T) { this.fit(false); this.applyZoom(); } }, 200); });
    }

    get last() { return this.T ? this.T.steps.length - 1 : 0; }

    setPseudo(src) {
      if (!this.codeEl) return;
      const r = RV.renderCLRS(src);
      this.codeEl.innerHTML = '';
      this.codeEl.appendChild(r.el);
      this.pl = r.lines;
      this.proc = this.cfg.proc || r.procs[r.procs.length - 1];
      this.curLine = null;
    }

    load(T, pseudo) {
      this.stop();
      this.T = T;
      if (pseudo) this.setPseudo(pseudo);
      if (!T.steps.length) T.step({ note: 'Nothing to run.' });
      this.layout();
      this.drawTree();
      this.fit(false);
      this.applyZoom();
      this.range.max = String(this.last);
      this.lastOut = -1;
      this.prevI = -1;
      if (this.stackInner) this.stackInner.innerHTML = '';
      this.go(0);
    }

    /* ---------- layout: tidy tree with variable-width pills ---------- */
    layout() {
      const N = this.T.nodes;
      const c = this.cfg;
      const padX = 26, padY = 30;
      N.forEach((n) => {
        const len = n.parts ? n.parts.reduce((s, p) => s + p.t.length, 0) : n.label.length;
        n.w = Math.max(c.minNodeW, len * 7.6 + 18);
      });
      let cursor = padX, maxDepth = 0;
      const place = (id) => {
        const n = N[id];
        maxDepth = Math.max(maxDepth, n.depth);
        n.y = padY + n.depth * c.levelH;
        if (!n.children.length) { n.x = cursor + n.w / 2; cursor += n.w + c.gapX; return; }
        n.children.forEach(place);
        n.x = (N[n.children[0]].x + N[n.children[n.children.length - 1]].x) / 2;
        cursor = Math.max(cursor, n.x + n.w / 2 + c.gapX);
      };
      N.filter((n) => n.parent < 0).forEach((n) => place(n.id));
      this.W = Math.max(cursor - c.gapX + padX, 120);
      this.H = padY * 2 + maxDepth * c.levelH + 16;
    }

    drawTree() {
      const N = this.T.nodes;
      let edges = '', labels = '', nodes = '';
      for (const n of N) {
        if (n.parent >= 0) {
          const p = N[n.parent];
          const y1 = p.y + 14, y2 = n.y - 14, my = (y1 + y2) / 2;
          edges += `<path class="edge hidden" data-id="${n.id}" d="M${p.x},${y1} C${p.x},${my} ${n.x},${my} ${n.x},${y2}"/>`;
          if (n.edge !== '') {
            const right = n.x >= p.x;
            const t = 0.62;
            const lx = p.x + (n.x - p.x) * t + (Math.abs(n.x - p.x) < 4 ? 7 : right ? 6 : -6);
            const ly = y1 + (y2 - y1) * t + 4;
            labels += `<text class="elabel hidden" data-id="${n.id}" x="${lx}" y="${ly}" text-anchor="${Math.abs(n.x - p.x) < 4 || right ? 'start' : 'end'}" style="paint-order:stroke;stroke:var(--surface);stroke-width:4px;stroke-linejoin:round">${esc(n.edge)}</text>`;
          }
        }
        const w = n.w;
        const lab = n.parts ? n.parts.map((p) => `<tspan class="${p.c || ''}">${esc(p.t)}</tspan>`).join('') : esc(n.label);
        nodes += `<g class="g-node hidden" data-id="${n.id}" transform="translate(${n.x},${n.y})" style="cursor:pointer">` +
          `<rect class="ring" x="${-w / 2 - 4}" y="-18" width="${w + 8}" height="36" rx="18"/>` +
          `<rect class="body" x="${-w / 2}" y="-14" width="${w}" height="28" rx="14"${n.fill ? ` style="fill:${n.fill}"` : ''}/>` +
          `<text class="nlabel" text-anchor="middle" dy="0.35em"${n.fill ? ' style="fill:#101322"' : ''}>${lab}</text>` +
          (n.sub !== '' ? `<text class="nsub" text-anchor="middle" y="27">${esc(n.sub)}</text>` : '') +
          (n.pruned ? `<g transform="translate(${w / 2 - 3},-12)"><circle r="7" style="fill:var(--bad)"/><path d="M-2.8,-2.8 L2.8,2.8 M2.8,-2.8 L-2.8,2.8" style="stroke:#fff;stroke-width:1.8;stroke-linecap:round"/></g>` : '') +
          `<text class="nval" x="${w / 2 + 6}" y="4"></text></g>`;
      }
      this.svg.innerHTML = `<g>${edges}</g><g>${labels}</g><g>${nodes}</g>`;
      this.nodeEls = new Array(N.length);
      this.edgeEls = new Array(N.length);
      this.labelEls = new Array(N.length);
      this.valEls = new Array(N.length);
      this.svg.querySelectorAll('.g-node').forEach((g) => { this.nodeEls[+g.dataset.id] = g; this.valEls[+g.dataset.id] = g.querySelector('.nval'); });
      this.svg.querySelectorAll('.edge').forEach((e) => { this.edgeEls[+e.dataset.id] = e; });
      this.svg.querySelectorAll('.elabel').forEach((e) => { this.labelEls[+e.dataset.id] = e; });
    }

    fit(force) {
      const cw = this.scroller.clientWidth - 6;
      if (cw <= 0) return;
      const z = cw / this.W;
      this.zoom = force ? Math.max(0.25, Math.min(1.4, z)) : Math.max(this.cfg.minZoom || 0.55, Math.min(1.1, z));
    }
    applyZoom() {
      this.svg.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`);
      this.svg.setAttribute('width', Math.round(this.W * this.zoom));
      this.svg.setAttribute('height', Math.round(this.H * this.zoom));
    }

    /* ---------- playback ---------- */
    toggle() { this.playing ? this.stop() : this.play(); }
    play() {
      if (!this.T) return;
      if (this.i >= this.last) this.go(0);
      this.playing = true;
      this.playBtn.innerHTML = ICON.pause;
      this.playBtn.setAttribute('aria-label', 'Pause');
      const tick = () => {
        if (!this.playing) return;
        if (this.i >= this.last) { this.stop(); return; }
        this.go(this.i + 1);
        this.timer = setTimeout(tick, SPEEDS[this.speed - 1]);
      };
      this.timer = setTimeout(tick, Math.min(400, SPEEDS[this.speed - 1]));
    }
    stop() {
      this.playing = false;
      clearTimeout(this.timer);
      if (this.playBtn) { this.playBtn.innerHTML = ICON.play; this.playBtn.setAttribute('aria-label', 'Play'); }
    }
    nextSolution() {
      const S = this.T.steps;
      for (let k = this.i + 1; k < S.length; k++) if (S[k].kind === 'solution') return this.go(k);
      this.go(this.last);
    }
    go(i) {
      if (!this.T) return;
      this.i = Math.max(0, Math.min(this.last, i));
      this.render();
    }

    /* ---------- render one step ---------- */
    render() {
      const T = this.T, i = this.i, st = T.steps[i], N = T.nodes;
      if (!st) return;
      const status = new Array(N.length).fill('');
      const vals = {};
      for (let k = 0; k <= i; k++) {
        const s = T.steps[k];
        for (const [id, v] of s.mark) status[id] = v;
        if (s.val) for (const [id, v] of s.val) vals[id] = v;
      }
      const onPath = new Set();
      for (let x = st.cur; x >= 0 && N[x]; x = N[x].parent) onPath.add(x);
      const solPath = new Set();
      for (const n of N) if (n.born <= i && status[n.id] === 'solution') for (let x = n.id; x >= 0; x = N[x].parent) solPath.add(x);
      const stepping = this.prevI === i - 1;

      for (const n of N) {
        const vis = n.born <= i;
        const g = this.nodeEls[n.id];
        let cls = 'g-node';
        if (!vis) cls += ' hidden';
        if (status[n.id]) cls += ' ' + status[n.id];
        if (n.id === st.cur && vis) cls += ' cur';
        if (vis && stepping && n.born === i) cls += ' pop';
        g.setAttribute('class', cls);
        const v = vals[n.id];
        this.valEls[n.id].textContent = v !== undefined && vis ? `= ${v}` : '';
        const e = this.edgeEls[n.id];
        if (e) {
          let ec = 'edge';
          if (!vis) ec += ' hidden';
          else if (status[n.id] === 'pruned') ec += ' pruned';
          else if (onPath.has(n.id)) ec += ' onpath';
          else if (solPath.has(n.id)) ec += ' solpath';
          e.setAttribute('class', ec);
        }
        const l = this.labelEls[n.id];
        if (l) l.setAttribute('class', 'elabel' + (vis ? '' : ' hidden') + (vis && onPath.has(n.id) ? ' onpath' : ''));
      }

      // narration
      this.badge.textContent = KIND[st.kind] || st.kind;
      this.badge.className = 'badge k-' + st.kind;
      this.txt.innerHTML = st.note || '&nbsp;';

      // pseudocode line
      if (this.pl) {
        if (this.curLine) this.curLine.classList.remove('cur');
        const key = typeof st.line === 'number' ? `${this.proc}:${st.line}` : st.line;
        const le = key ? this.pl.get(key) : null;
        this.curLine = le || null;
        if (le) {
          le.classList.add('cur');
          const box = le.parentElement;
          const top = le.offsetTop, bottom = top + le.offsetHeight;
          if (top < box.scrollTop + 8 || bottom > box.scrollTop + box.clientHeight - 8) box.scrollTop = top - box.clientHeight / 2;
        }
      }

      if (this.stackInner) this.renderStack(st.frames);

      const prev = i > 0 ? T.steps[i - 1] : null;
      if (this.memEl && this.cfg.renderMem) this.memEl.innerHTML = this.cfg.renderMem(st.mem, prev ? prev.mem : null, st, this);
      if (this.extraEl && this.cfg.renderExtra) this.cfg.renderExtra(st.mem, prev ? prev.mem : null, st, this.extraEl, this);

      if (this.outEl && st.out.length !== this.lastOut) {
        this.outEl.innerHTML = st.out.length
          ? st.out.map((o) => `<span class="o${o.bad ? ' bad' : ''}">${esc(o.v)}</span>`).join('')
          : `<span class="none">${this.cfg.outEmpty || 'Nothing yet — answers appear here as the recursion finds them.'}</span>`;
        this.outCount.textContent = st.out.length;
        this.outEl.scrollTop = this.outEl.scrollHeight;
        this.lastOut = st.out.length;
      }

      this.range.value = String(i);
      this.count.textContent = `${i + 1} / ${T.steps.length}`;
      this.follow(false);
      this.prevI = i;
      if (this.cfg.onStep) this.cfg.onStep(st, this);
    }

    renderStack(frames) {
      const MAX = 7;
      const shown = frames.slice(-MAX);
      const want = shown.map((f) => String(f.node));
      const have = Array.from(this.stackInner.children);
      let k = 0;
      while (k < have.length && k < want.length && have[k].dataset.node === want[k]) k++;
      for (let j = have.length - 1; j >= k; j--) have[j].remove();
      for (let j = k; j < want.length; j++) {
        const d = document.createElement('div');
        d.dataset.node = want[j];
        this.stackInner.appendChild(d);
      }
      const fmt = this.cfg.fmtArg || fmtArg;
      Array.from(this.stackInner.children).forEach((el, j) => {
        const f = shown[j];
        const depth = frames.length - shown.length + j;
        el.className = 'frame' + (j === shown.length - 1 ? ' top' : '');
        el.innerHTML = `<span class="fn">${esc(f.fn)}</span><span class="depth">#${depth}</span><div class="args">${f.args.filter((a) => !a.hidden).map((a) => a.ref
          ? `<span class="arg ref">&amp;<b>${esc(a.name)}</b><span class="refchip">shared</span></span>`
          : `<span class="arg">${esc(a.name)}=<b>${esc(fmt(a.value))}</b></span>`).join('')}</div>`;
      });
      if (!frames.length) this.stackInner.innerHTML = '<div class="stack-empty">stack is empty — every call has returned</div>';
      this.stackMore.textContent = frames.length > MAX ? `+ ${frames.length - MAX} older frame(s) below` : '';
      this.stackDepth.textContent = `depth ${frames.length}`;
    }

    follow(force) {
      if (!this.T) return;
      const n = this.T.nodes[this.T.steps[this.i].cur];
      if (!n) return;
      const sc = this.scroller, z = this.zoom;
      const x = n.x * z, y = n.y * z, pad = 50;
      let left = sc.scrollLeft, top = sc.scrollTop;
      if (force || x < left + pad || x > left + sc.clientWidth - pad) left = x - sc.clientWidth / 2;
      if (force || y < top + pad || y > top + sc.clientHeight - pad) top = y - sc.clientHeight / 2;
      if (Math.abs(left - sc.scrollLeft) > 1 || Math.abs(top - sc.scrollTop) > 1) {
        sc.scrollTo({ left, top, behavior: this.playing && this.speed > 7 ? 'auto' : 'smooth' });
      }
    }
  }
  function fmtArg(v) {
    if (typeof v === 'string') return /^\{.*\}$/.test(v) ? v : `"${v}"`;
    if (Array.isArray(v)) return `[${v.join(',')}]`;
    if (v === null || v === undefined) return 'NIL';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }
  RV.TracePlayer = TracePlayer;
  RV.fmtArg = fmtArg;

  /* ======================================================================
     Memory helpers
     ====================================================================== */
  /** merge named pointers into {index: "a,b"} */
  RV.ptrs = function (obj) {
    const out = {};
    Object.entries(obj).forEach(([name, idx]) => {
      if (idx === undefined || idx === null || idx < 0) return;
      out[idx] = out[idx] ? `${out[idx]},${name}` : name;
    });
    return out;
  };
  /** array cells */
  RV.cells = function (arr, o = {}) {
    const prev = o.prev;
    return '<div class="cells">' + arr.map((v, i) => {
      const cls = ['cell'];
      if (o.hl && o.hl.includes(i)) cls.push('hl');
      if (o.hl2 && o.hl2.includes(i)) cls.push('hl2');
      if (o.fixed !== undefined && i < o.fixed) cls.push('fixed');
      if (o.cls) { const c = o.cls(v, i); if (c) cls.push(c); }
      if (prev && prev.length === arr.length && prev[i] !== v) cls.push('changed');
      const ptr = o.ptr && o.ptr[i] ? o.ptr[i] : '';
      const style = o.style ? o.style(v, i) : '';
      const shown = o.fmt ? o.fmt(v, i) : v === null || v === undefined ? '—' : v;
      return `<div class="${cls.join(' ')}">${o.ptr ? `<span class="ptr">${esc(ptr)}</span>` : ''}<span class="v"${style ? ` style="${style}"` : ''}>${esc(shown)}</span>${o.idx === false ? '' : `<span class="i">${i}</span>`}</div>`;
    }).join('') + '</div>';
  };
  /** memory block wrapper */
  RV.block = function (title, body, o = {}) {
    const tag = o.ref ? '<span class="tagref">by reference · one shared copy</span>' : o.val ? '<span class="tagval">by value · private copy</span>' : o.tag ? `<span>${o.tag}</span>` : '';
    return `<div class="mem-block${o.ref ? ' shared' : ''}"><div class="mh"><span>${title}</span>${tag}</div>${body}</div>`;
  };
  /** adjacency matrix */
  RV.matrix = function (A, o = {}) {
    const n = A.length;
    let h = `<table class="matrix${o.editable ? ' editable' : ''}"><tr><th></th>${A.map((_, j) => `<th>${j}</th>`).join('')}</tr>`;
    for (let r = 0; r < n; r++) {
      h += `<tr class="${o.row === r ? 'rowhl' : ''}"><th>${r}</th>`;
      for (let c = 0; c < n; c++) {
        const cls = [];
        if (A[r][c]) cls.push('one');
        if (r === c) cls.push('diag');
        if (o.cell && o.cell[0] === r && o.cell[1] === c) cls.push(o.bad ? 'cellbad' : 'cellhl');
        h += `<td class="${cls.join(' ')}" data-r="${r}" data-c="${c}">${A[r][c]}</td>`;
      }
      h += '</tr>';
    }
    return h + '</table>';
  };

  /* ======================================================================
     GraphView — small undirected graph renderer
     ====================================================================== */
  class GraphView {
    constructor(el, o) {
      this.el = el;
      this.o = Object.assign({ w: 380, h: 280, r: 21 }, o);
      this.setGraph(o.A, o.pos);
    }
    setGraph(A, pos) {
      this.A = A;
      this.pos = pos;
      const { w, h, r } = this.o;
      let edges = '', nodes = '';
      const n = A.length;
      for (let u = 0; u < n; u++) for (let v = u + 1; v < n; v++) if (A[u][v]) {
        edges += `<line class="gedge" data-e="${u}-${v}" x1="${pos[u][0]}" y1="${pos[u][1]}" x2="${pos[v][0]}" y2="${pos[v][1]}"/>`;
      }
      for (let u = 0; u < n; u++) {
        nodes += `<g class="gnode" data-v="${u}" transform="translate(${pos[u][0]},${pos[u][1]})"><circle class="halo" r="${r + 5}"/><circle class="b" r="${r}"/><text>${u}</text><text class="order" x="${r - 2}" y="${-r + 2}"></text></g>`;
      }
      this.el.innerHTML = `<svg class="graph-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Graph"><g class="edges-l"></g><g>${edges}</g><g class="virtual"></g><g>${nodes}</g></svg>`;
      this.svg = this.el.querySelector('svg');
      this.virtual = this.el.querySelector('.virtual');
      this.edgeEls = {};
      this.el.querySelectorAll('.gedge').forEach((e) => { this.edgeEls[e.dataset.e] = e; });
      this.nodeEls = Array.from(this.el.querySelectorAll('.gnode'));
    }
    key(u, v) { return u < v ? `${u}-${v}` : `${v}-${u}`; }
    update(s = {}) {
      const path = s.path || [];
      const pathEdges = new Set();
      for (let k = 1; k < path.length; k++) pathEdges.add(this.key(path[k - 1], path[k]));
      if (s.closed && path.length > 1) pathEdges.add(this.key(path[path.length - 1], path[0]));
      Object.entries(this.edgeEls).forEach(([k, e]) => {
        let c = 'gedge';
        if (s.badEdge && this.key(...s.badEdge) === k) c += ' bad';
        else if (s.goodEdge && this.key(...s.goodEdge) === k) c += ' good';
        else if (pathEdges.has(k)) c += ' path';
        else if (s.tryEdge && this.key(...s.tryEdge) === k) c += ' try';
        e.setAttribute('class', c);
      });
      // a "virtual" edge that does not exist in the graph (e.g. the missing closing edge)
      this.virtual.innerHTML = '';
      const ve = s.missingEdge;
      if (ve && !this.A[ve[0]][ve[1]]) {
        const [a, b] = [this.pos[ve[0]], this.pos[ve[1]]];
        this.virtual.innerHTML = `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" style="stroke:var(--bad);stroke-width:2.5;stroke-dasharray:3 6"/>`;
      }
      const visited = s.visited || [];
      const order = {};
      path.forEach((v, k) => { order[v] = k; });
      this.nodeEls.forEach((g, u) => {
        let c = 'gnode';
        if (visited[u]) c += ' visited';
        if (s.cur === u) c += ' cur';
        if (s.cand === u) c += ' cand';
        if (s.conflict && s.conflict.includes(u)) c += ' conflict';
        g.setAttribute('class', c);
        const b = g.querySelector('circle.b');
        b.style.fill = s.fills && s.fills[u] ? s.fills[u] : '';
        g.querySelector('text').style.fill = s.fills && s.fills[u] ? '#101322' : '';
        g.querySelector('.order').textContent = s.showOrder && order[u] !== undefined ? order[u] : '';
      });
    }
  }
  RV.GraphView = GraphView;
})();
