/* Backtracking concept page: leaf / root / path demo, controlled-recursion maze, pass-by-value vs reference */
(function () {
  'use strict';
  const RV = window.RV;
  const esc = RV.esc;

  /* ====================================================================
     1) Where does the answer live?
     ==================================================================== */
  const PSEUDO = {
    leaf: `
SUBSETS(ip, op)
    if ip is empty
        print op                     // a LEAF holds a finished answer
        return
    SUBSETS(ip[1 ..], op)            // choice 1: exclude ip[0]
    SUBSETS(ip[1 ..], op + ip[0])    // choice 2: include ip[0] (a new copy)`,
    root: `
FIB(n)
    if n ≤ 1
        return n                     // base case: a leaf value
    a ← FIB(n − 1)
    b ← FIB(n − 2)
    return a + b                     // combine → the answer bubbles up to the ROOT`,
    rootMemo: `
FIB(n)
    if n ≤ 1
        return n                     // base case: a leaf value
    if memo[n] ≠ NIL
        return memo[n]               // overlapping sub-problem: reuse it
    a ← FIB(n − 1)
    b ← FIB(n − 2)
    memo[n] ← a + b
    return a + b                     // combine → the answer bubbles up to the ROOT`,
    path: `
PERMUTE(s, path, used)               // path and used are SHARED (by reference)
    if path.length = n
        print path                   // the root→leaf PATH is the answer
        return
    for i ← 0 to n − 1
        if used[i] = TRUE            // isValid: letter already on the path
            continue
        used[i] ← TRUE               // choose
        APPEND(path, s[i])
        PERMUTE(s, path, used)       // explore
        REMOVE-LAST(path)            // un-choose (backtrack)
        used[i] ← FALSE`,
  };

  function traceLeaf(s) {
    const T = new RV.Tracer(() => ({ kind: 'leaf' }));
    function rec(ip, op, edge) {
      T.call('SUBSETS', [{ name: 'ip', value: ip }, { name: 'op', value: op }], {
        parts: [{ t: ip || '∅', c: 'd' }, { t: '|', c: 'd' }, { t: op || '""', c: 'a' }], edge, line: 1,
        note: `Call with ip = "${ip}", op = "${op}". This call owns <b>private copies</b> of both strings.`,
      });
      if (!ip.length) {
        T.emit(op ? `{${op.split('').join(',')}}` : '{ }');
        T.step({ kind: 'solution', line: 2, note: `ip is empty → we are at a <b>leaf</b>. op = "${op}" is already a complete answer — print it.`, mark: [[T.top.node, 'solution']] });
        T.ret({ status: 'solution', line: 4, note: 'Return. Nothing to undo: the parent never shared its op with us.' });
        return;
      }
      T.step({ kind: 'change', line: 5, note: `Choice 1 — <b>exclude</b> '${ip[0]}': recurse with op unchanged.` });
      rec(ip.slice(1), op, `−${ip[0]}`);
      T.step({ kind: 'change', line: 6, note: `Choice 2 — <b>include</b> '${ip[0]}': op + '${ip[0]}' creates a <b>new</b> string "${op + ip[0]}".` });
      rec(ip.slice(1), op + ip[0], `+${ip[0]}`);
      T.ret({ line: 6, note: `Both choices done for ip = "${ip}". Return to the parent.` });
    }
    rec(s, '', '');
    T.step({ kind: 'done', cur: 0, note: `Finished: <b>${T.out.length}</b> subsets, every one of them printed at a leaf.` });
    return T;
  }

  function traceRoot(n, useMemo) {
    const memo = new Array(n + 1).fill(null);
    const T = new RV.Tracer(() => ({ kind: 'root', memo: memo.slice(), useMemo }));
    function fib(k, edge) {
      T.call('FIB', [{ name: 'n', value: k }], { label: `fib(${k})`, edge, line: 1, note: `Call FIB(${k}). It cannot answer yet — it needs its children first.` });
      if (k <= 1) {
        T.ret({ val: k, line: 3, kind: 'base', note: `Base case: FIB(${k}) = <b>${k}</b>. This value travels <b>up</b> to the parent.` });
        return k;
      }
      if (useMemo && memo[k] !== null) {
        T.ret({ val: memo[k], status: 'memo', line: 5, kind: 'memo', note: `memo[${k}] = ${memo[k]} is already known — reuse it instead of re-growing the whole subtree.` });
        return memo[k];
      }
      const a = fib(k - 1, 'n−1');
      T.step({ line: useMemo ? 6 : 4, note: `Back in FIB(${k}): a = FIB(${k - 1}) = <b>${a}</b>. Now compute b.` });
      const b = fib(k - 2, 'n−2');
      if (useMemo) { memo[k] = a + b; }
      const isRoot = T.frames.length === 1;
      if (isRoot) {
        T.emit(`fib(${k}) = ${a + b}`);
        T.ret({ val: a + b, status: 'solution', kind: 'solution', line: useMemo ? 9 : 6, note: `The <b>root</b> combines ${a} + ${b} = <b>${a + b}</b>. The answer was assembled at the root from its sub-problems.` });
      } else {
        T.ret({ val: a + b, line: useMemo ? 9 : 6, note: `FIB(${k}) = ${a} + ${b} = <b>${a + b}</b> → returned to the parent.${useMemo ? ` Stored in memo[${k}].` : ''}` });
      }
      return a + b;
    }
    fib(n, '');
    return T;
  }

  function tracePath(s) {
    const n = s.length;
    const path = [], used = new Array(n).fill(false);
    const T = new RV.Tracer(() => ({ kind: 'path', s, path: path.slice(), used: used.slice() }));
    function rec(edgeChar) {
      T.call('PERMUTE', [{ name: 'path', ref: true }, { name: 'used', ref: true }], {
        label: edgeChar || '•', line: 1,
        note: edgeChar ? `Chose '${edgeChar}'. The shared path is now [${path.join(', ')}].` : 'Start with an empty shared path and all letters unused.',
      });
      if (path.length === n) {
        T.emit(path.join(''));
        T.step({ kind: 'solution', line: 3, note: `path.length = n. The <b>path</b> of choices root → here spells "${path.join('')}" — that is the answer.`, mark: [[T.top.node, 'solution']] });
        T.ret({ status: 'solution', line: 4, note: 'Return — the caller will now undo its last choice.' });
        return;
      }
      for (let i = 0; i < n; i++) {
        T.set('i', i);
        if (used[i]) {
          T.prune({ label: s[i], line: 6, note: `'${s[i]}' is already on the path (used[${i}] = TRUE) → <b>not valid</b>, skip it.` });
          continue;
        }
        used[i] = true;
        path.push(s[i]);
        T.step({ kind: 'change', line: 8, note: `Choose '${s[i]}': used[${i}] ← TRUE, APPEND → path = [${path.join(', ')}]. This <b>changes shared memory</b>.` });
        rec(s[i]);
        path.pop();
        used[i] = false;
        T.step({ kind: 'revert', line: 11, note: `Un-choose '${s[i]}': REMOVE-LAST, used[${i}] ← FALSE → path = [${path.join(', ')}]. Shared memory is exactly as before the choice.` });
      }
      T.ret({ line: 5, note: 'All choices at this level tried. Return.' });
    }
    rec('');
    T.step({ kind: 'done', cur: 0, note: `Finished: <b>${T.out.length}</b> permutations — each one read off a root → leaf path.` });
    return T;
  }

  function renderIdeaMem(mem, prev, st) {
    if (mem.kind === 'leaf') {
      if (!st.frames.length) return '<div class="faint">All frames popped — their copies are gone.</div>';
      return RV.block('Stack frames — each call owns its copies',
        '<div class="mem">' + st.frames.map((f, d) => {
          const ip = f.args[0].value, op = f.args[1].value;
          return `<div class="kv"><span class="chip">#${d}</span> ip = <b>"${esc(ip)}"</b> op = <b style="color:var(--accent)">"${esc(op)}"</b></div>`;
        }).join('') + '</div>', { val: true });
    }
    if (mem.kind === 'root') {
      return RV.block(mem.useMemo ? 'memo[0 … n]' : 'No memo (every sub-problem is recomputed)',
        mem.useMemo ? RV.cells(mem.memo, { prev: prev && prev.memo, cls: (v) => (v === null ? '' : 'good') }) : '<div class="faint" style="font-size:.86rem">Turn on memoisation to cache results — repeated sub-trees turn amber and stop growing.</div>',
        { tag: mem.useMemo ? 'shared table' : '' });
    }
    if (mem.kind === 'path') {
      const pathBody = mem.path.length ? RV.cells(mem.path, { prev: prev && prev.path }) : '<span class="faint">[ ] empty</span>';
      const usedTF = (u) => u.map((x) => (x ? 'T' : 'F'));
      return RV.block('path (shared)', pathBody, { ref: true }) +
        RV.block('used[ ]  (shared)', RV.cells(usedTF(mem.used), { prev: prev && prev.used && usedTF(prev.used), cls: (v) => (v === 'T' ? 't' : 'f') }) +
          `<div class="kv mt-1">letters: ${mem.s.split('').map((c, i) => `<span>${i}:<b>${c}</b></span>`).join(' ')}</div>`, { ref: true });
    }
    return '';
  }

  function initIdea() {
    const host = document.getElementById('viz-idea');
    if (!host) return;
    const player = new RV.TracePlayer(host, {
      title: 'Where does the answer live?', renderMem: renderIdeaMem, legend: ['active', 'path', 'sol', 'pruned', 'memo', 'done'],
      levelH: 70,
    });
    const ui = document.createElement('div');
    ui.className = 'viz-inputs';
    ui.innerHTML = `
      <div class="seg" role="group" aria-label="Technique">
        <button type="button" data-k="leaf" aria-pressed="false">Leaf · Recursion</button>
        <button type="button" data-k="root" aria-pressed="false">Root · DP</button>
        <button type="button" data-k="path" aria-pressed="true">Path · Backtracking</button>
      </div>
      <label class="field k-str">string <input type="text" maxlength="4" value="abc" aria-label="Input string"></label>
      <label class="field k-n" hidden>n <select aria-label="n"><option>3</option><option>4</option><option selected>5</option></select></label>
      <label class="toggle k-memo" hidden><input type="checkbox"> memoise</label>`;
    player.inputs.appendChild(ui);
    let kind = 'path';
    const strIn = ui.querySelector('.k-str input');
    const nSel = ui.querySelector('.k-n select');
    const memo = ui.querySelector('.k-memo input');
    function run() {
      ui.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === kind)));
      ui.querySelector('.k-str').hidden = kind === 'root';
      ui.querySelector('.k-n').hidden = kind !== 'root';
      ui.querySelector('.k-memo').hidden = kind !== 'root';
      let s = (strIn.value || 'abc').replace(/\s/g, '').slice(0, 4);
      if (kind === 'path') s = Array.from(new Set(s.split(''))).join('') || 'abc';
      player.cfg.gapX = kind === 'root' ? 40 : 14;
      if (kind === 'leaf') player.load(traceLeaf(s || 'abc'), PSEUDO.leaf);
      if (kind === 'root') player.load(traceRoot(+nSel.value, memo.checked), memo.checked ? PSEUDO.rootMemo : PSEUDO.root);
      if (kind === 'path') player.load(tracePath(s), PSEUDO.path);
    }
    ui.querySelector('.seg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { kind = b.dataset.k; run(); } });
    strIn.addEventListener('change', run);
    nSel.addEventListener('change', run);
    memo.addEventListener('change', run);
    run();
  }

  /* ====================================================================
     2) Controlled recursion — the maze
     ==================================================================== */
  const MAZE_PSEUDO = {
    all: `
WALK(r, c)                            // uncontrolled: try every direction
    if (r, c) = HOME
        paths ← paths + 1
        return
    visited[r][c] ← TRUE
    for each move in {N, E, S, W}
        if INSIDE(next) and visited[next] = FALSE
            WALK(next)
    visited[r][c] ← FALSE`,
    ctl: `
WALK(r, c)                            // controlled: only moves that can reach HOME
    if (r, c) = HOME
        paths ← paths + 1
        return
    for each move in {S, W}
        if INSIDE(next)
            WALK(next)`,
  };
  const R = 3, C = 3, SR = 0, SC = 2, HR = 2, HC = 0;
  function traceMaze(controlled) {
    const vis = Array.from({ length: R }, () => new Array(C).fill(false));
    const path = [];
    let calls = 0, paths = 0;
    const T = new RV.Tracer(() => ({ path: path.slice(), calls, paths, controlled }));
    const DIRS = controlled ? [['S', 1, 0], ['W', 0, -1]] : [['N', -1, 0], ['E', 0, 1], ['S', 1, 0], ['W', 0, -1]];
    function walk(r, c, edge) {
      calls++;
      path.push([r, c]);
      T.call('WALK', [{ name: 'r', value: r }, { name: 'c', value: c }], { label: `${r},${c}`, edge, line: 1, note: `Call #${calls}: at cell (${r}, ${c}).` });
      if (r === HR && c === HC) {
        paths++;
        T.emit(path.map(([a, b]) => `${a}${b}`).join('→'));
        T.step({ kind: 'solution', line: 3, note: `Reached <b>HOME</b>! Path #${paths}.`, mark: [[T.top.node, 'solution']] });
        path.pop();
        T.ret({ status: 'solution', line: 4, note: 'Return.' });
        return;
      }
      if (!controlled) vis[r][c] = true;
      for (const [d, dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= R || nc >= C) continue;
        if (!controlled && vis[nr][nc]) continue;
        walk(nr, nc, d);
      }
      if (!controlled) vis[r][c] = false;
      path.pop();
      T.ret({ line: controlled ? 5 : 9, note: `All moves from (${r}, ${c}) tried. Return.` });
    }
    walk(SR, SC, '');
    T.step({ kind: 'done', cur: 0, note: `Done: <b>${calls}</b> calls to find <b>${paths}</b> paths.` });
    return T;
  }
  function renderMaze(mem) {
    const order = {};
    mem.path.forEach(([r, c], k) => { order[`${r},${c}`] = k; });
    const cur = mem.path[mem.path.length - 1];
    let g = `<div class="maze" style="grid-template-columns:repeat(${C},52px)">`;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const k = `${r},${c}`;
      const cls = ['mc'];
      if (order[k] !== undefined) cls.push('vis');
      if (cur && cur[0] === r && cur[1] === c) cls.push('cur');
      if (r === SR && c === SC) cls.push('start');
      if (r === HR && c === HC) cls.push('home');
      const lab = r === SR && c === SC ? 'P' : r === HR && c === HC ? 'H' : `${r},${c}`;
      g += `<div class="${cls.join(' ')}">${lab}${order[k] !== undefined ? `<span class="ord">${order[k]}</span>` : ''}</div>`;
    }
    g += '</div>';
    return `<div class="split" style="align-items:center">${g}<div class="kv" style="flex-direction:column;gap:6px">
      <span>mode: <b>${mem.controlled ? 'controlled (S, W)' : 'uncontrolled (N, E, S, W)'}</b></span>
      <span>calls so far: <b>${mem.calls}</b></span>
      <span>paths found: <b style="color:var(--good)">${mem.paths}</b></span>
      <span class="faint">P = start · H = home · numbers = order on the current path</span></div></div>`;
  }
  function initMaze() {
    const host = document.getElementById('viz-maze');
    if (!host) return;
    const player = new RV.TracePlayer(host, { title: 'Controlled vs uncontrolled recursion', memTitle: 'The grid', renderMem: renderMaze, outTitle: 'Paths P → H', levelH: 62, speed: 7, minZoom: 0.4 });
    const ui = document.createElement('div');
    ui.className = 'viz-inputs';
    ui.innerHTML = `<div class="seg" role="group" aria-label="Recursion mode">
      <button type="button" data-m="all" aria-pressed="false">Uncontrolled · N E S W</button>
      <button type="button" data-m="ctl" aria-pressed="true">Controlled · S W only</button></div>`;
    player.inputs.appendChild(ui);
    let mode = 'ctl';
    function run() {
      ui.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === mode)));
      player.load(traceMaze(mode === 'ctl'), MAZE_PSEUDO[mode]);
    }
    ui.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { mode = b.dataset.m; run(); } });
    run();
  }

  /* ====================================================================
     3) Pass by value vs pass by reference
     ==================================================================== */
  const PB_PSEUDO = {
    val: `
BUILD(s, idx)                    // s passed BY VALUE: every call owns a copy
    if idx = n
        print s
        return
    for each ch in {a, b}
        BUILD(s + ch, idx + 1)   // s + ch is a NEW string; our s is untouched`,
    ref: `
BUILD(s, idx)                    // s passed BY REFERENCE: one shared string
    if idx = n
        print s
        return
    for each ch in {a, b}
        APPEND(s, ch)            // change the shared state
        BUILD(s, idx + 1)        // explore
        REMOVE-LAST(s)           // revert — siblings must see the old s`,
    bug: `
BUILD(s, idx)                    // BUG: shared string, never reverted
    if idx = n
        print s
        return
    for each ch in {a, b}
        APPEND(s, ch)            // change the shared state
        BUILD(s, idx + 1)        // explore
                                 // (missing) REMOVE-LAST(s)`,
  };
  function tracePB(mode, n) {
    let shared = '';
    let copies = 0, chars = 0;
    const T = new RV.Tracer(() => ({ mode, shared, copies, chars }));
    function rec(s, idx, edge) {
      const args = mode === 'val' ? [{ name: 's', value: s }, { name: 'idx', value: idx }] : [{ name: 's', ref: true }, { name: 'idx', value: idx }];
      const cur = mode === 'val' ? s : shared;
      T.call('BUILD', args, { label: cur || '""', edge, line: 1, note: mode === 'val' ? `BUILD("${s}", ${idx}) — a fresh copy "${s}" lives in this frame.` : `BUILD(&s, ${idx}) — this frame only holds a reference; the shared s is "${shared}".` });
      if (idx === n) {
        const v = mode === 'val' ? s : shared;
        const bad = v.length !== n;
        T.emit(v || '""', bad);
        T.step({ kind: 'solution', line: 3, note: bad ? `Printed "<b>${esc(v)}</b>" — wrong! Leftover characters from earlier branches were never removed.` : `idx = n → print "<b>${esc(v)}</b>".`, mark: [[T.top.node, bad ? 'dead' : 'solution']] });
        T.ret({ status: bad ? 'dead' : 'solution', line: 4, note: 'Return.' });
        return;
      }
      for (const ch of ['a', 'b']) {
        if (mode === 'val') {
          copies++; chars += s.length + 1;
          T.step({ kind: 'change', line: 6, note: `Build a <b>new</b> string "${s + ch}" (copy #${copies}, ${s.length + 1} chars copied) and pass it down.` });
          rec(s + ch, idx + 1, ch);
        } else {
          shared += ch;
          T.step({ kind: 'change', line: 6, note: `APPEND '${ch}' to the shared s → "${shared}". Every frame sees this change.` });
          rec(null, idx + 1, ch);
          if (mode === 'ref') {
            shared = shared.slice(0, -1);
            T.step({ kind: 'revert', line: 8, note: `REMOVE-LAST → shared s is back to "${shared}". Now the next sibling starts from the right state.` });
          } else {
            T.step({ kind: 'dead', line: 8, note: `No revert! shared s stays "${shared}" — the next choice will be appended to garbage.` });
          }
        }
      }
      T.ret({ line: 5, note: 'Both letters tried. Return.' });
    }
    rec('', 0, '');
    T.step({ kind: 'done', cur: 0, note: mode === 'val' ? `Done. Correct output, but it made <b>${copies}</b> copies (${chars} characters copied).` : mode === 'ref' ? 'Done. Correct output with <b>zero</b> copies — one string was modified and reverted.' : 'Done. The output is corrupted because changes were never reverted.' });
    return T;
  }
  function renderPB(mem, prev, st) {
    if (mem.mode === 'val') {
      const frames = st.frames.map((f, d) => `<div class="kv"><span class="chip">#${d}</span> s = <b>"${esc(f.args[0].value)}"</b></div>`).join('');
      return RV.block('Stack — every frame has its own copy of s', `<div class="mem">${frames || '<span class="faint">empty</span>'}</div>`, { val: true }) +
        `<div class="kv">copies made: <b>${mem.copies}</b> · characters copied: <b>${mem.chars}</b></div>`;
    }
    const arr = mem.shared.split('');
    return RV.block('Heap — ONE string s shared by all frames', arr.length ? RV.cells(arr, { prev: prev && prev.shared.split(''), cls: (v, i) => (mem.mode === 'bug' && i >= 3 ? 'bad' : '') }) : '<span class="faint">s = "" (empty)</span>', { ref: true }) +
      `<div class="kv">frames on the stack: <b>${st.frames.length}</b> — all pointing at the same s · copies made: <b>0</b></div>`;
  }
  function initPB() {
    const host = document.getElementById('viz-pb');
    if (!host) return;
    const player = new RV.TracePlayer(host, { title: 'Pass by value vs pass by reference', renderMem: renderPB, outTitle: 'Printed strings', levelH: 66, legend: ['active', 'path', 'sol', 'done'] });
    const ui = document.createElement('div');
    ui.className = 'viz-inputs';
    ui.innerHTML = `<div class="seg" role="group" aria-label="Parameter passing">
      <button type="button" data-m="val" aria-pressed="true">By value</button>
      <button type="button" data-m="ref" aria-pressed="false">By reference + undo</button>
      <button type="button" data-m="bug" aria-pressed="false">By reference, forgot undo 🐞</button></div>`;
    player.inputs.appendChild(ui);
    let mode = 'val';
    function run() {
      ui.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === mode)));
      player.load(tracePB(mode, 3), PB_PSEUDO[mode]);
    }
    ui.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { mode = b.dataset.m; run(); } });
    run();
  }

  /* ====================================================================
     4) Greedy trap mini-demo (4577, k = 2)
     ==================================================================== */
  function greedyFirst(s, k) {
    const a = s.split('');
    const swaps = [];
    for (let i = 0; i < a.length && k > 0; i++) {
      let mx = i;
      for (let j = i + 1; j < a.length; j++) if (a[j] > a[mx]) mx = j; // first occurrence of the max
      if (a[mx] !== a[i]) { [a[i], a[mx]] = [a[mx], a[i]]; swaps.push([i, mx]); k--; }
    }
    return { v: a.join(''), swaps };
  }
  function bestK(s, k) {
    let best = s;
    const a = s.split('');
    (function rec(k, idx) {
      if (k === 0 || idx === a.length) return;
      let mx = a[idx];
      for (let j = idx + 1; j < a.length; j++) if (a[j] > mx) mx = a[j];
      if (mx === a[idx]) { rec(k, idx + 1); return; }
      for (let j = a.length - 1; j > idx; j--) if (a[j] === mx) {
        [a[idx], a[j]] = [a[j], a[idx]];
        const v = a.join('');
        if (v > best) best = v;
        rec(k - 1, idx + 1);
        [a[idx], a[j]] = [a[j], a[idx]];
      }
    })(k, 0);
    return best;
  }
  function initGreedy() {
    const box = document.getElementById('greedy-demo');
    if (!box) return;
    const inS = box.querySelector('input[name="num"]');
    const inK = box.querySelector('input[name="k"]');
    const out = box.querySelector('.greedy-out');
    const digits = (s, cls) => `<span class="digits">${s.split('').map((d) => `<span class="${cls || ''}">${d}</span>`).join('')}</span>`;
    function run() {
      const s = (inS.value || '4577').replace(/\D/g, '').slice(0, 9) || '4577';
      const k = Math.max(1, Math.min(5, +inK.value || 2));
      const g = greedyFirst(s, k);
      const b = bestK(s, k);
      const same = g.v === b;
      out.innerHTML = `
        <div class="row"><span class="lbl faint">input</span>${digits(s)}<span class="faint mono">k = ${k}</span></div>
        <div class="row"><span class="lbl ${same ? 'good' : 'bad'}">greedy</span>${digits(g.v, same ? 'win' : 'lose')}<span class="faint mono">swaps: ${g.swaps.map(([i, j]) => `(${i},${j})`).join(' ') || 'none'}</span></div>
        <div class="row"><span class="lbl good">backtracking</span>${digits(b, 'win')}<span class="faint mono">tries every position of the max digit</span></div>
        <p class="${same ? 'muted' : 'bad'}" style="margin:4px 0 0">${same ? 'Here greedy happens to match — try 4577 with k = 2, or 3435335 with k = 3.' : `Greedy commits to the first ${g.swaps.length ? 'largest digit it sees' : 'choice'} and can never take it back → <b>${g.v}</b> &lt; <b>${b}</b>.`}</p>`;
    }
    inS.addEventListener('input', run);
    inK.addEventListener('input', run);
    run();
  }

  /* ====================================================================
     5) 3-D explorer on this page
     ==================================================================== */
  function init3D() {
    const cv = document.getElementById('bt3d');
    if (!cv || !RV.Tree3D) return;
    const cap = document.getElementById('bt3d-cap');
    const btns = document.querySelectorAll('#bt3d-modes button');
    const t = new RV.Tree3D(cv, {
      alphabet: 'abcd', mode: 'path', cycle: true,
      onCaption: (s, m) => { cap.textContent = s; btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === m))); },
    });
    btns.forEach((b) => b.addEventListener('click', () => t.setMode(b.dataset.m)));
  }

  RV.ready(() => { init3D(); initIdea(); initMaze(); initPB(); initGreedy(); });
})();
