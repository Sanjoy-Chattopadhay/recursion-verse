/* Hamiltonian cycle — CLRS-style HAM-CYCLE traced on an editable graph */
(function () {
  'use strict';
  const RV = window.RV;

  const fromEdges = (n, edges) => {
    const A = Array.from({ length: n }, () => new Array(n).fill(0));
    edges.forEach(([u, v]) => { A[u][v] = 1; A[v][u] = 1; });
    return A;
  };
  const PRESETS = {
    notesA: {
      name: 'Notes graph · 5 vertices (has cycles)',
      A: fromEdges(5, [[0, 1], [0, 2], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3], [3, 4]]),
      pos: [[70, 70], [220, 50], [330, 140], [220, 230], [70, 210]],
    },
    pentagon: {
      name: 'Pentagon · 5 vertices (one cycle)',
      A: fromEdges(5, [[0, 1], [0, 2], [1, 3], [2, 4], [3, 4]]),
      pos: [[190, 40], [80, 125], [300, 125], [120, 240], [260, 240]],
    },
    bowtie: {
      name: 'Articulation point · 6 vertices (no cycle)',
      A: fromEdges(6, [[0, 1], [1, 3], [3, 2], [0, 2], [2, 4], [4, 5], [2, 5]]),
      pos: [[120, 40], [40, 140], [190, 150], [110, 240], [320, 60], [310, 235]],
    },
    k4: {
      name: 'Complete graph K4',
      A: fromEdges(4, [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]),
      pos: [[90, 60], [290, 60], [290, 230], [90, 230]],
    },
  };

  const PSEUDO = {
    one: `
HAM-CYCLE(A, path, visited, k, n)
    if k = n
        if A[path[n − 1]][path[0]] = 1       // can we close the cycle?
            return TRUE
        else return FALSE
    u ← path[k − 1]                          // last vertex on the path
    for v ← 0 to n − 1
        if visited[v] = FALSE and A[u][v] = 1  // isValid
            path[k] ← v                        // choose
            visited[v] ← TRUE
            if HAM-CYCLE(A, path, visited, k + 1, n)
                return TRUE                    // stop at the first cycle
            visited[v] ← FALSE                 // un-choose
            path[k] ← NIL
    return FALSE`,
    all: `
ALL-HAM-CYCLES(A, path, visited, k, n)
    if k = n
        if A[path[n − 1]][path[0]] = 1
            print path + path[0]
        return
    u ← path[k − 1]
    for v ← 0 to n − 1
        if visited[v] = FALSE and A[u][v] = 1  // isValid
            path[k] ← v                        // choose
            visited[v] ← TRUE
            ALL-HAM-CYCLES(A, path, visited, k + 1, n)
            visited[v] ← FALSE                 // un-choose
            path[k] ← NIL`,
  };

  function traceHC(A, findAll) {
    const n = A.length;
    const path = new Array(n).fill(null);
    const visited = new Array(n).fill(false);
    path[0] = 0; visited[0] = true;
    let focus = {};
    const T = new RV.Tracer(() => Object.assign({ A, path: path.slice(), visited: visited.slice() }, focus));
    const Ln = findAll
      ? { base: 1, close: 2, ok: 3, fail: 4, u: 5, loop: 6, valid: 7, set: 8, rec: 10, undo: 11, end: 6 }
      : { base: 1, close: 2, ok: 3, fail: 4, u: 5, loop: 6, valid: 7, set: 8, rec: 10, retT: 11, undo: 12, end: 14 };
    let found = 0;
    function ham(k) {
      focus = { u: path[k - 1] };
      T.call(findAll ? 'ALL-HAM-CYCLES' : 'HAM-CYCLE', [{ name: 'path', ref: true }, { name: 'visited', ref: true }, { name: 'k', value: k }], {
        label: String(path[k - 1]), sub: `k=${k}`, line: Ln.base,
        note: k === 1 ? 'Start at vertex <b>0</b> (a cycle can be rotated to start anywhere). path = [0], visited[0] = TRUE.' : `Arrived at vertex <b>${path[k - 1]}</b>. path = [${path.slice(0, k).join(', ')}] (${k} of ${n} vertices).`,
      });
      if (k === n) {
        const a = path[n - 1], b = path[0];
        const ok = !!A[a][b];
        focus = { u: a, v: b, closing: true, closeOk: ok };
        if (ok) {
          found++;
          T.emit(path.join('→') + '→' + b);
          T.step({ kind: 'solution', line: Ln.ok, note: `All ${n} vertices are on the path and A[${a}][${b}] = 1 — the edge ${a}–${b} closes the cycle: <b>${path.join(' → ')} → ${b}</b>.`, mark: [[T.top.node, 'solution']] });
          T.ret({ status: 'solution', line: Ln.ok, note: findAll ? 'Record it and keep searching for more cycles.' : 'Return TRUE all the way up.' });
          return true;
        }
        T.step({ kind: 'dead', line: Ln.fail, note: `All ${n} vertices are used, but A[${a}][${b}] = 0 — no edge back to the start. This is a Hamiltonian <b>path</b>, not a cycle.`, mark: [[T.top.node, 'dead']] });
        T.ret({ status: 'dead', line: Ln.fail, note: 'Return FALSE — the caller will try another vertex.' });
        return false;
      }
      const u = path[k - 1];
      T.set('u', u);
      let anyValid = false;
      for (let v = 0; v < n; v++) {
        if (v === u) continue;
        T.set('v', v);
        focus = { u, v };
        if (!A[u][v]) continue; // not a neighbour — nothing to draw
        if (visited[v]) {
          T.prune({ label: String(v), line: Ln.valid, note: `${v} is a neighbour of ${u} but is already on the path (visited[${v}] = TRUE). <b>Rejected.</b>` });
          continue;
        }
        anyValid = true;
        path[k] = v; visited[v] = true;
        focus = { u, v };
        T.step({ kind: 'change', line: Ln.set, note: `A[${u}][${v}] = 1 and visited[${v}] = FALSE → choose it: path[${k}] ← ${v}, visited[${v}] ← TRUE.` });
        const ok = ham(k + 1);
        if (ok && !findAll) {
          focus = { u, v };
          T.ret({ line: Ln.retT, note: `The recursive call returned TRUE → return TRUE (path is kept as the answer).` });
          return true;
        }
        visited[v] = false; path[k] = null;
        focus = { u, v };
        T.step({ kind: 'revert', line: Ln.undo, note: `Back at ${u}: un-choose ${v} → visited[${v}] ← FALSE, path[${k}] ← NIL. Try the next neighbour.` });
      }
      focus = { u };
      T.ret({ status: anyValid ? 'done' : 'dead', line: Ln.end, note: anyValid ? `Every neighbour of ${u} has been tried. Return ${findAll ? '' : 'FALSE'}.` : `Dead end: every neighbour of ${u} is already visited. Return ${findAll ? '' : 'FALSE'}.` });
      return false;
    }
    ham(1);
    T.step({ kind: 'done', cur: 0, note: found ? (findAll ? `Finished: <b>${found}</b> Hamiltonian cycles starting at 0 (each undirected cycle appears twice — once per direction).` : 'Finished: a Hamiltonian cycle exists.') : 'Finished: <b>no Hamiltonian cycle</b> exists in this graph.' });
    return T;
  }

  function renderMem(mem, prev) {
    const n = mem.path.length;
    const p = RV.ptrs({ u: mem.u !== undefined ? mem.path.indexOf(mem.u) : -1 });
    return RV.block('path[ ] — shared', RV.cells(mem.path, { prev: prev && prev.path, ptr: p, fmt: (v) => (v === null ? 'NIL' : v), cls: (v) => (v === null ? 'f' : '') }), { ref: true }) +
      RV.block('visited[ ] — shared', RV.cells(mem.visited.map((x) => (x ? 'T' : 'F')), { prev: prev && prev.visited.map((x) => (x ? 'T' : 'F')), cls: (v) => (v === 'T' ? 't' : 'f'), hl: mem.v !== undefined ? [mem.v] : [] }), { ref: true }) +
      RV.block(`adjacency matrix A${mem.u !== undefined ? ` · row ${mem.u}` : ''}`, `<div style="overflow-x:auto">${RV.matrix(mem.A, { row: mem.u, cell: mem.v !== undefined ? [mem.u, mem.v] : null, bad: mem.closing && !mem.closeOk })}</div>`, { tag: n + ' × ' + n });
  }

  /* static mini graphs in the explanation */
  const MINI = {
    pentagon: { A: PRESETS.pentagon.A, pos: PRESETS.pentagon.pos, path: [0, 1, 3, 4, 2], closed: true },
    hex: {
      A: fromEdges(6, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 2], [1, 4]]),
      pos: [[60, 60], [190, 60], [320, 60], [320, 220], [190, 220], [60, 220]], path: [0, 1, 2, 3, 4, 5], closed: true,
    },
    bowtie: { A: PRESETS.bowtie.A, pos: PRESETS.bowtie.pos, path: [0, 1, 3, 2, 4, 5], closed: false },
  };
  function initMini() {
    document.querySelectorAll('[data-hmini]').forEach((el) => {
      const m = MINI[el.dataset.hmini];
      const g = new RV.GraphView(el, { A: m.A, pos: m.pos, w: 380, h: 280 });
      g.update({ path: m.path, closed: m.closed, showOrder: true, visited: m.path.map(() => true) });
    });
  }

  RV.ready(() => {
    initMini();
    const host = document.getElementById('viz-ham');
    if (!host) return;
    let preset = 'notesA';
    let A = PRESETS[preset].A.map((r) => r.slice());
    let graph;
    const player = new RV.TracePlayer(host, {
      title: 'Hamiltonian cycle — step by step', renderMem, extra: true, extraTitle: 'Graph', outTitle: 'Cycles found', levelH: 70,
      renderExtra: (mem) => {
        const path = mem.path.filter((x) => x !== null);
        graph.update({
          path, visited: mem.visited, cur: mem.u, cand: mem.closing ? undefined : mem.v, showOrder: true,
          tryEdge: !mem.closing && mem.v !== undefined && mem.u !== undefined ? [mem.u, mem.v] : null,
          goodEdge: mem.closing && mem.closeOk ? [mem.u, mem.v] : null,
          missingEdge: mem.closing && !mem.closeOk ? [mem.u, mem.v] : null,
          closed: mem.closing && mem.closeOk,
        });
      },
    });
    graph = new RV.GraphView(player.extraEl, { A, pos: PRESETS[preset].pos });

    const ui = document.createElement('div');
    ui.className = 'viz-inputs';
    ui.innerHTML = `
      <label class="field">graph <select aria-label="Graph preset">${Object.entries(PRESETS).map(([k, p]) => `<option value="${k}">${p.name}</option>`).join('')}</select></label>
      <div class="seg" role="group" aria-label="Mode"><button type="button" data-m="one" aria-pressed="true">First cycle</button><button type="button" data-m="all" aria-pressed="false">All cycles</button></div>`;
    player.inputs.appendChild(ui);
    let mode = 'one';
    const sel = ui.querySelector('select');
    const editor = document.getElementById('ham-editor');
    function drawEditor() {
      if (!editor) return;
      editor.innerHTML = RV.matrix(A, { editable: true });
    }
    function run() {
      ui.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === mode)));
      graph.setGraph(A, PRESETS[preset].pos);
      drawEditor();
      player.load(traceHC(A, mode === 'all'), PSEUDO[mode]);
    }
    sel.addEventListener('change', () => { preset = sel.value; A = PRESETS[preset].A.map((r) => r.slice()); run(); });
    ui.querySelector('.seg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { mode = b.dataset.m; run(); } });
    if (editor) {
      editor.addEventListener('click', (e) => {
        const td = e.target.closest('td[data-r]');
        if (!td) return;
        const r = +td.dataset.r, c = +td.dataset.c;
        if (r === c) return;
        A[r][c] = A[c][r] = A[r][c] ? 0 : 1;
        run();
      });
    }
    run();
  });
})();
