/* Graph colouring (m-colouring) — COLOR-UTIL + IS-SAFE traced on preset graphs */
(function () {
  'use strict';
  const RV = window.RV;
  const COLORS = [null, '#f472b6', '#38bdf8', '#fbbf24', '#34d399', '#a78bfa'];
  RV.GC_COLORS = COLORS;

  const fromEdges = (n, edges) => {
    const A = Array.from({ length: n }, () => new Array(n).fill(0));
    edges.forEach(([u, v]) => { A[u][v] = 1; A[v][u] = 1; });
    return A;
  };
  const ring = (k, cx, cy, r, off = -90) => Array.from({ length: k }, (_, i) => {
    const a = ((off + (360 / k) * i) * Math.PI) / 180;
    return [Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))];
  });
  const PRESETS = {
    notes: { name: 'Notes graph · 4 vertices', m: 3, A: fromEdges(4, [[0, 1], [0, 2], [1, 2], [1, 3], [2, 3]]), pos: [[190, 40], [90, 140], [290, 140], [190, 240]] },
    notes2: { name: 'Notes graph with m = 2 (impossible)', m: 2, A: fromEdges(4, [[0, 1], [0, 2], [1, 2], [1, 3], [2, 3]]), pos: [[190, 40], [90, 140], [290, 140], [190, 240]] },
    square: { name: 'Square C4 · bipartite (m = 2)', m: 2, A: fromEdges(4, [[0, 1], [1, 2], [2, 3], [3, 0]]), pos: [[90, 60], [290, 60], [290, 230], [90, 230]] },
    k4: { name: 'Complete graph K4 with m = 3 (impossible)', m: 3, A: fromEdges(4, [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]), pos: [[90, 60], [290, 60], [290, 230], [90, 230]] },
    petersen: {
      name: 'Petersen graph · 10 vertices (m = 3)', m: 3,
      A: fromEdges(10, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 5], [1, 6], [2, 7], [3, 8], [4, 9], [5, 7], [7, 9], [9, 6], [6, 8], [8, 5]]),
      pos: ring(5, 190, 145, 118).concat(ring(5, 190, 145, 56)),
    },
  };

  const PSEUDO = {
    one: `
COLOR-UTIL(A, color, v, n, m)
    if v = n
        return TRUE                           // every vertex is coloured
    for c ← 1 to m
        if IS-SAFE(A, color, v, c, n)         // isValid
            color[v] ← c                      // choose
            if COLOR-UTIL(A, color, v + 1, n, m)
                return TRUE
            color[v] ← 0                      // un-choose (backtrack)
    return FALSE

IS-SAFE(A, color, v, c, n)
    for u ← 0 to n − 1
        if A[v][u] = 1 and color[u] = c
            return FALSE                      // a neighbour already has c
    return TRUE`,
    all: `
ALL-COLORINGS(A, color, v, n, m)
    if v = n
        print color
        return
    for c ← 1 to m
        if IS-SAFE(A, color, v, c, n)
            color[v] ← c
            ALL-COLORINGS(A, color, v + 1, n, m)
            color[v] ← 0

IS-SAFE(A, color, v, c, n)
    for u ← 0 to n − 1
        if A[v][u] = 1 and color[u] = c
            return FALSE
    return TRUE`,
  };

  function traceGC(A, m, findAll) {
    const n = A.length;
    const color = new Array(n).fill(0);
    let focus = {};
    const T = new RV.Tracer(() => Object.assign({ A, color: color.slice(), m }, focus));
    const P = findAll ? 'ALL-COLORINGS' : 'COLOR-UTIL';
    const L = findAll
      ? { base: 1, ok: 2, set: 6, undo: 8, end: 4 }
      : { base: 1, ok: 2, set: 5, retT: 7, undo: 8, end: 9 };
    let found = 0;
    function rec(v, label, fill) {
      focus = v < n ? { v } : {};
      T.call(P, [{ name: 'color', ref: true }, { name: 'v', value: v }], {
        label, fill, line: `${P}:${L.base}`,
        note: v === 0 ? 'Start: no vertex has a colour yet (color[] is all 0).' : v < n ? `Vertex ${v - 1} is coloured. Now choose a colour for vertex <b>${v}</b>.` : 'The last vertex just got a colour.',
      });
      if (v === n) {
        found++;
        T.emit(`[${color.join(',')}]`);
        T.step({ kind: 'solution', line: `${P}:${L.ok}`, note: `v = n — every vertex is coloured and no edge joins equal colours: <b>color = [${color.join(', ')}]</b>.`, mark: [[T.top.node, 'solution']] });
        T.ret({ status: 'solution', line: `${P}:${L.ok}`, note: findAll ? 'Record it and keep searching.' : 'Return TRUE.' });
        return true;
      }
      let any = false;
      for (let c = 1; c <= m; c++) {
        T.set('c', c);
        const conflicts = [];
        for (let u = 0; u < n; u++) if (A[v][u] && color[u] === c) conflicts.push(u);
        focus = { v, c, conflicts };
        if (conflicts.length) {
          T.prune({ label: `v${v}=${c}`, fill: COLORS[c], line: 'IS-SAFE:3', note: `Colour ${c} for vertex ${v}? Neighbour${conflicts.length > 1 ? 's' : ''} <b>${conflicts.join(', ')}</b> already ha${conflicts.length > 1 ? 've' : 's'} colour ${c} → IS-SAFE returns FALSE.` });
          continue;
        }
        any = true;
        T.step({ kind: 'check', line: 'IS-SAFE:4', note: `Colour ${c} for vertex ${v}? No neighbour of ${v} has colour ${c} → IS-SAFE returns TRUE.` });
        color[v] = c;
        focus = { v, c };
        T.step({ kind: 'change', line: `${P}:${L.set}`, note: `color[${v}] ← ${c}.` });
        const ok = rec(v + 1, `v${v}=${c}`, COLORS[c]);
        if (ok && !findAll) {
          focus = { v, c };
          T.ret({ line: `${P}:${L.retT}`, note: 'The recursive call returned TRUE → return TRUE.' });
          return true;
        }
        color[v] = 0;
        focus = { v, c };
        T.step({ kind: 'revert', line: `${P}:${L.undo}`, note: `Backtrack: color[${v}] ← 0, try the next colour.` });
      }
      focus = { v };
      T.ret({ status: any ? 'done' : 'dead', line: `${P}:${L.end}`, note: any ? `All ${m} colours have been tried for vertex ${v}. Return${findAll ? '' : ' FALSE'}.` : `Dead end: none of the ${m} colours is safe for vertex ${v}. Return${findAll ? '' : ' FALSE'}.` });
      return false;
    }
    rec(0, 'start');
    T.step({ kind: 'done', cur: 0, note: found ? (findAll ? `Finished: <b>${found}</b> valid colourings with m = ${m}.` : `Finished: the graph <b>can</b> be coloured with ${m} colours.`) : `Finished: the graph <b>cannot</b> be coloured with ${m} colour${m > 1 ? 's' : ''}.` });
    return T;
  }

  function renderMem(mem, prev) {
    const cells = RV.cells(mem.color, {
      prev: prev && prev.color,
      ptr: RV.ptrs({ v: mem.v }),
      hl: mem.v !== undefined ? [mem.v] : [],
      cls: (c, i) => (mem.conflicts && mem.conflicts.includes(i) ? 'bad' : ''),
      style: (c) => (c ? `background:${COLORS[c]};color:#101322;border-color:transparent` : ''),
    });
    const legend = Array.from({ length: mem.m }, (_, k) => `<span><span style="display:inline-block;width:12px;height:12px;border-radius:4px;background:${COLORS[k + 1]};vertical-align:-1px"></span> ${k + 1}</span>`).join('');
    return RV.block('color[ ] — shared (0 = not coloured)', cells + `<div class="kv mt-1">${legend}${mem.c ? `<span>trying c = <b>${mem.c}</b></span>` : ''}</div>`, { ref: true }) +
      RV.block(`adjacency matrix${mem.v !== undefined ? ` · IS-SAFE scans row ${mem.v}` : ''}`, `<div style="overflow-x:auto">${RV.matrix(mem.A, { row: mem.v, cell: mem.conflicts && mem.conflicts.length ? [mem.v, mem.conflicts[0]] : null, bad: true })}</div>`);
  }

  function initMini() {
    document.querySelectorAll('[data-gcmini]').forEach((el) => {
      const p = PRESETS.notes;
      const g = new RV.GraphView(el, { A: p.A, pos: p.pos, w: 380, h: 280 });
      const col = el.dataset.gcmini.split(',').map(Number);
      g.update({ fills: col.map((c) => COLORS[c]), conflict: el.dataset.bad ? el.dataset.bad.split(',').map(Number) : [], badEdge: el.dataset.bad ? el.dataset.bad.split(',').map(Number) : null });
    });
  }

  RV.ready(() => {
    initMini();
    const host = document.getElementById('viz-gc');
    if (!host) return;
    let preset = 'notes';
    let graph;
    const player = new RV.TracePlayer(host, {
      title: 'Graph colouring — step by step', renderMem, extra: true, extraTitle: 'Graph', outTitle: 'Valid colourings', levelH: 70, proc: 'COLOR-UTIL',
      legend: ['active', 'path', 'sol', 'pruned', 'done'],
      renderExtra: (mem) => {
        graph.update({
          fills: mem.color.map((c) => (c ? COLORS[c] : null)),
          cur: mem.v, conflict: mem.conflicts || [],
          badEdge: mem.conflicts && mem.conflicts.length ? [mem.v, mem.conflicts[0]] : null,
        });
      },
    });
    graph = new RV.GraphView(player.extraEl, { A: PRESETS[preset].A, pos: PRESETS[preset].pos });
    const ui = document.createElement('div');
    ui.className = 'viz-inputs';
    ui.innerHTML = `
      <label class="field">graph <select class="gc-preset" aria-label="Graph preset">${Object.entries(PRESETS).map(([k, p]) => `<option value="${k}">${p.name}</option>`).join('')}</select></label>
      <label class="field">m <select class="gc-m" aria-label="Number of colours">${[1, 2, 3, 4].map((k) => `<option>${k}</option>`).join('')}</select></label>
      <div class="seg" role="group" aria-label="Mode"><button type="button" data-m="one" aria-pressed="true">First colouring</button><button type="button" data-m="all" aria-pressed="false">All colourings</button></div>`;
    player.inputs.appendChild(ui);
    const selP = ui.querySelector('.gc-preset');
    const selM = ui.querySelector('.gc-m');
    let mode = 'one';
    function run() {
      ui.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === mode)));
      const p = PRESETS[preset];
      graph.setGraph(p.A, p.pos);
      const m = +selM.value;
      const big = p.A.length > 6 && mode === 'all';
      player.load(traceGC(p.A, m, mode === 'all' && !big), PSEUDO[mode === 'all' && !big ? 'all' : 'one']);
      if (big) player.txt.innerHTML = 'The Petersen graph has too many colourings to animate them all — showing the first one. ' + player.txt.innerHTML;
    }
    selP.addEventListener('change', () => { preset = selP.value; selM.value = String(PRESETS[preset].m); run(); });
    selM.addEventListener('change', run);
    ui.querySelector('.seg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { mode = b.dataset.m; run(); } });
    selM.value = String(PRESETS[preset].m);
    run();
  });
})();
