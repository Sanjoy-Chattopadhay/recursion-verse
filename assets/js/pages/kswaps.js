/* Largest number in K swaps — brute template version and the optimised "every position of the max digit" version */
(function () {
  'use strict';
  const RV = window.RV;

  const PSEUDO = {
    opt: `
MAX-K-SWAPS(s, k, idx, best)          // s and best are shared (by reference)
    if k = 0 or idx = n
        return
    mx ← MAX(s[idx .. n − 1])
    if mx = s[idx]
        MAX-K-SWAPS(s, k, idx + 1, best)      // already the largest digit: keep k
        return
    for j ← n − 1 downto idx + 1
        if s[j] = mx                          // try EVERY position of the max digit
            exchange s[idx] ↔ s[j]            // choose
            if s > best
                best ← s
            MAX-K-SWAPS(s, k − 1, idx + 1, best)
            exchange s[idx] ↔ s[j]            // un-choose (backtrack)`,
    brute: `
TRY-SWAPS(s, k, best)                 // s and best are shared (by reference)
    if s > best
        best ← s
    if k = 0
        return
    for i ← 0 to n − 2
        for j ← i + 1 to n − 1
            if s[j] > s[i]                    // isValid: the swap must increase s
                exchange s[i] ↔ s[j]          // choose
                TRY-SWAPS(s, k − 1, best)     // explore
                exchange s[i] ↔ s[j]          // un-choose`,
  };

  function traceOpt(str, K) {
    const s = str.split('');
    const n = s.length;
    let best = str, bestNode = 0;
    const ptr = { a: -1, b: -1 };
    const T = new RV.Tracer(() => ({ s: s.slice(), best, a: ptr.a, b: ptr.b, labels: ['idx', 'j'] }));
    T.emit(`start ${best}`);
    function rec(k, idx, edge) {
      ptr.a = idx < n ? idx : -1; ptr.b = -1;
      T.call('MAX-K-SWAPS', [{ name: 's', ref: true }, { name: 'k', value: k }, { name: 'idx', value: idx }, { name: 'best', ref: true }], {
        label: s.join(''), sub: `k=${k} idx=${idx}`, edge, line: 1,
        note: `Now at position <b>${idx}</b> with <b>${k}</b> swap(s) left. s = "${s.join('')}".`,
      });
      if (k === 0 || idx === n) {
        T.ret({ line: 2, kind: 'base', note: k === 0 ? 'k = 0 — no swaps left. This path is finished.' : 'idx = n — every position is settled.' });
        return;
      }
      let mx = s[idx];
      for (let j = idx + 1; j < n; j++) if (s[j] > mx) mx = s[j];
      T.set('mx', mx);
      T.step({ kind: 'check', line: 3, note: `The largest digit in s[${idx}..${n - 1}] = "${s.slice(idx).join('')}" is <b>${mx}</b>.` });
      if (mx === s[idx]) {
        T.step({ kind: 'check', line: 4, note: `s[${idx}] = ${s[idx]} is already the largest possible here. Do <b>not</b> spend a swap — move to idx + 1 with k unchanged.` });
        rec(k, idx + 1, 'keep');
        T.ret({ line: 6, note: 'Return.' });
        return;
      }
      const positions = [];
      for (let j = n - 1; j > idx; j--) if (s[j] === mx) positions.push(j);
      if (positions.length > 1) T.step({ kind: 'check', line: 7, note: `<b>${mx}</b> appears at positions ${positions.join(', ')}. Greedy would pick one; we must <b>try each</b> — they lead to different numbers.` });
      for (let j = n - 1; j > idx; j--) {
        if (s[j] !== mx) continue;
        ptr.a = idx; ptr.b = j;
        T.set('j', j);
        [s[idx], s[j]] = [s[j], s[idx]];
        T.step({ kind: 'change', line: 9, note: `Swap s[${idx}] ↔ s[${j}] → "${s.join('')}".` });
        rec(k - 1, idx + 1, `${idx}↔${j}`);
        ptr.a = idx; ptr.b = j;
        [s[idx], s[j]] = [s[j], s[idx]];
        T.step({ kind: 'revert', line: 13, note: `Swap back s[${idx}] ↔ s[${j}] → "${s.join('')}" so the next choice starts from the same number.` });
      }
      T.ret({ line: 8, note: `All positions of ${mx} tried at idx = ${idx}. Return.` });
    }
    // wrap call() to update best right after entering a node created by a swap
    const origCall = T.call.bind(T);
    T.call = function (fn, args, o) {
      const id = origCall(fn, args, o);
      const v = s.join('');
      if (v > best) {
        best = v;
        const old = bestNode;
        bestNode = id;
        T.emit(best);
        T.step({ kind: 'solution', line: 11, note: `"${v}" &gt; best → <b>best ← "${v}"</b>. (Every node is a valid answer candidate; we keep the largest.)`, mark: [[old, T.frames.some((f) => f.node === old) ? 'active' : 'done'], [id, 'solution']] });
      }
      return id;
    };
    rec(K, 0, '');
    T.step({ kind: 'done', cur: bestNode, note: `Finished. Largest number with at most ${K} swap(s): <b>${best}</b>.` });
    return T;
  }

  function traceBrute(str, K) {
    const s = str.split('');
    const n = s.length;
    let best = str, bestNode = 0;
    const ptr = { a: -1, b: -1 };
    const T = new RV.Tracer(() => ({ s: s.slice(), best, a: ptr.a, b: ptr.b, labels: ['i', 'j'] }));
    T.emit(`start ${best}`);
    function rec(k, edge) {
      ptr.a = -1; ptr.b = -1;
      T.call('TRY-SWAPS', [{ name: 's', ref: true }, { name: 'k', value: k }, { name: 'best', ref: true }], {
        label: s.join(''), sub: `k=${k}`, edge, line: 1, note: `TRY-SWAPS with s = "${s.join('')}", k = ${k}.`,
      });
      const v = s.join('');
      if (v > best) {
        best = v;
        const old = bestNode;
        bestNode = T.top.node;
        T.emit(best);
        T.step({ kind: 'solution', line: 2, note: `"${v}" &gt; best → <b>best ← "${v}"</b>.`, mark: [[old, T.frames.some((f) => f.node === old && f.node !== bestNode) ? 'active' : 'done'], [bestNode, 'solution']] });
      }
      if (k === 0) { T.ret({ line: 4, kind: 'base', note: 'k = 0: no swaps left. Return.' }); return; }
      for (let i = 0; i < n - 1; i++) {
        for (let j = i + 1; j < n; j++) {
          ptr.a = i; ptr.b = j;
          T.set('i', i); T.set('j', j);
          if (!(s[j] > s[i])) {
            T.prune({ label: `${i},${j}`, line: 7, note: `s[${j}] = ${s[j]} is not larger than s[${i}] = ${s[i]} → swapping cannot help. <b>Rejected</b> by isValid.` });
            continue;
          }
          [s[i], s[j]] = [s[j], s[i]];
          T.step({ kind: 'change', line: 8, note: `Swap s[${i}] ↔ s[${j}] → "${s.join('')}".` });
          rec(k - 1, `${i}↔${j}`);
          ptr.a = i; ptr.b = j;
          [s[i], s[j]] = [s[j], s[i]];
          T.step({ kind: 'revert', line: 10, note: `Swap back → "${s.join('')}".` });
        }
      }
      T.ret({ line: 5, note: 'All (i, j) pairs tried. Return.' });
    }
    rec(K, '');
    T.step({ kind: 'done', cur: bestNode, note: `Finished. best = <b>${best}</b>. The brute version explored ${T.nodes.length} nodes — compare with the optimised version.` });
    return T;
  }

  function renderMem(mem, prev) {
    const [la, lb] = mem.labels;
    const p = RV.ptrs({ [la]: mem.a, [lb]: mem.b });
    return RV.block('s — shared digits', RV.cells(mem.s, { prev: prev && prev.s, ptr: p, hl: mem.a >= 0 ? [mem.a] : [], hl2: mem.b >= 0 ? [mem.b] : [] }), { ref: true }) +
      RV.block('best — shared', RV.cells(mem.best.split(''), { prev: prev && prev.best.split(''), cls: () => 'good' }), { ref: true });
  }

  /* greedy comparison */
  function greedyFirst(s, k) {
    const a = s.split('');
    const swaps = [];
    for (let i = 0; i < a.length && k > 0; i++) {
      let mx = i;
      for (let j = i + 1; j < a.length; j++) if (a[j] > a[mx]) mx = j;
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
      const s = (inS.value || '4577').replace(/\D/g, '').slice(0, 10) || '4577';
      const k = Math.max(1, Math.min(6, +inK.value || 2));
      const g = greedyFirst(s, k);
      const b = bestK(s, k);
      const same = g.v === b;
      out.innerHTML = `
        <div class="row"><span class="lbl faint">input</span>${digits(s)}<span class="faint mono">k = ${k}</span></div>
        <div class="row"><span class="lbl ${same ? 'good' : 'bad'}">greedy</span>${digits(g.v, same ? 'win' : 'lose')}<span class="faint mono">swaps ${g.swaps.map(([i, j]) => `(${i},${j})`).join(' ') || '—'}</span></div>
        <div class="row"><span class="lbl good">backtracking</span>${digits(b, 'win')}</div>
        <p class="${same ? 'muted' : 'bad'}" style="margin:4px 0 0">${same ? 'Same answer — greedy is safe when the maximum digit is unique at every step.' : `Greedy took the first maximum it found and could never undo that decision: ${g.v} &lt; ${b}.`}</p>`;
    }
    inS.addEventListener('input', run);
    inK.addEventListener('input', run);
    box.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => { const [x, y] = b.dataset.g.split(','); inS.value = x; inK.value = y; run(); }));
    run();
  }

  RV.ready(() => {
    initGreedy();
    const host = document.getElementById('viz-kswap');
    if (!host) return;
    const player = new RV.TracePlayer(host, { title: 'Largest number in K swaps', renderMem, outTitle: 'best — history', levelH: 76, outEmpty: '—' });
    const ui = document.createElement('div');
    ui.className = 'viz-inputs';
    ui.innerHTML = `
      <div class="seg" role="group" aria-label="Version">
        <button type="button" data-m="opt" aria-pressed="true">Optimised</button>
        <button type="button" data-m="brute" aria-pressed="false">Brute (template)</button>
      </div>
      <label class="field">number <input type="text" value="4577" inputmode="numeric" aria-label="Number"></label>
      <label class="field">k <input type="number" value="2" min="1" max="4" aria-label="k"></label>
      <span class="faint kswap-note" style="font-size:.78rem"></span>`;
    player.inputs.appendChild(ui);
    let mode = 'opt';
    const inS = ui.querySelector('input[type="text"]');
    const inK = ui.querySelector('input[type="number"]');
    const note = ui.querySelector('.kswap-note');
    function run() {
      ui.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === mode)));
      let s = (inS.value || '4577').replace(/\D/g, '') || '4577';
      let k = Math.max(1, Math.min(4, +inK.value || 1));
      note.textContent = '';
      if (mode === 'brute') {
        const full = s;
        s = s.slice(0, 5);
        const pairs = (s.length * (s.length - 1)) / 2;
        const k0 = k;
        while (k > 1 && Math.pow(pairs, k) > 160) k--;
        const notes = [];
        if (s !== full) notes.push(`using the first 5 digits (${s})`);
        if (k !== k0) notes.push(`k lowered to ${k}`);
        if (notes.length) note.textContent = `brute tree is huge — ${notes.join(', ')}`;
        player.load(traceBrute(s, k), PSEUDO.brute);
      } else {
        if (s.length > 10) note.textContent = 'using the first 10 digits';
        s = s.slice(0, 10);
        player.load(traceOpt(s, k), PSEUDO.opt);
      }
    }
    ui.querySelector('.seg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { mode = b.dataset.m; run(); } });
    inS.addEventListener('change', run);
    inK.addEventListener('change', run);
    document.querySelectorAll('[data-kpreset]').forEach((b) => b.addEventListener('click', () => {
      const [x, y, m] = b.dataset.kpreset.split(',');
      inS.value = x; inK.value = y; mode = m || mode; run();
      host.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    run();
  });
})();
