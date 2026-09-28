/* All permutations — Approach A (input/output copies, answer at the leaf) and B (swap in place, answer in the path) */
(function () {
  'use strict';
  const RV = window.RV;
  const esc = RV.esc;

  const PSEUDO = {
    swap: `
PERMUTE(s)
    PERMUTE-FROM(s, 0)

PERMUTE-FROM(s, idx)                 // s is shared (by reference)
    if idx = n
        print s                        // every position fixed: one arrangement
        return
    for i ← idx to n − 1
        exchange s[idx] ↔ s[i]         // choose: fix s[i] at position idx
        PERMUTE-FROM(s, idx + 1)       // explore
        exchange s[idx] ↔ s[i]         // un-choose (backtrack)`,
    swapDedupe: `
PERMUTE(s)
    PERMUTE-FROM(s, 0)

PERMUTE-FROM(s, idx)                 // s is shared (by reference)
    if idx = n
        print s
        return
    used ← ∅                           // letters already placed at idx
    for i ← idx to n − 1
        if s[i] ∈ used
            continue                   // same letter ⇒ same subtree: skip
        used ← used ∪ {s[i]}
        exchange s[idx] ↔ s[i]         // choose
        PERMUTE-FROM(s, idx + 1)       // explore
        exchange s[idx] ↔ s[i]         // un-choose`,
    ipop: `
PERMUTE(ip, op)                      // ip and op are COPIES (by value)
    if ip is empty
        print op                       // the answer is waiting at the LEAF
        return
    for i ← 0 to |ip| − 1
        newIp ← ip without ip[i]
        newOp ← op + ip[i]
        PERMUTE(newIp, newOp)          // nothing to undo`,
    ipopDedupe: `
PERMUTE(ip, op)                      // ip and op are COPIES (by value)
    if ip is empty
        print op
        return
    used ← ∅
    for i ← 0 to |ip| − 1
        if ip[i] ∈ used
            continue                   // duplicate letter at this level
        used ← used ∪ {ip[i]}
        newIp ← ip without ip[i]
        newOp ← op + ip[i]
        PERMUTE(newIp, newOp)          // nothing to undo`,
  };

  /* ---------------- Approach B: swap (by reference) ---------------- */
  function traceSwap(str, dedupe) {
    const s = str.split('');
    const n = s.length;
    const ptr = { idx: -1, i: -1 };
    const T = new RV.Tracer(() => ({ mode: 'swap', s: s.slice(), idx: ptr.idx, i: ptr.i }));
    const L = dedupe ? { base: 1, print: 2, ret: 3, loop: 5, skip: 6, sw: 9, rec: 10, back: 11 } : { base: 1, print: 2, ret: 3, loop: 4, sw: 5, rec: 6, back: 7 };
    const parts = (idx) => [{ t: s.slice(0, idx).join(''), c: 'a' }, { t: s.slice(idx).join(''), c: 'd' }];
    function rec(idx, edge) {
      ptr.idx = idx; ptr.i = -1;
      T.call('PERMUTE-FROM', [{ name: 's', ref: true }, { name: 'idx', value: idx }], {
        parts: parts(idx), edge, line: L.base,
        note: idx === 0 ? `Start: s = "${s.join('')}", nothing fixed yet.` : `Positions 0…${idx - 1} are fixed ("${s.slice(0, idx).join('')}"). Now choose the letter for position <b>${idx}</b>.`,
      });
      if (idx === n) {
        T.emit(s.join(''));
        T.step({ kind: 'solution', line: L.print, note: `idx = n — every position is fixed. The path of swaps produced "<b>${s.join('')}</b>".`, mark: [[T.top.node, 'solution']] });
        T.ret({ status: 'solution', line: L.ret, note: 'Return to the caller, which will swap back.' });
        return;
      }
      const used = new Set();
      for (let i = idx; i < n; i++) {
        ptr.idx = idx; ptr.i = i;
        T.set('i', i);
        if (dedupe) {
          if (used.has(s[i])) {
            T.prune({ label: s[i], edge: s[i], line: L.skip, note: `'${s[i]}' has already been placed at position ${idx} in this loop — it would grow an identical subtree. <b>Skip.</b>` });
            continue;
          }
          used.add(s[i]);
          T.set('used', `{${Array.from(used).join(',')}}`);
        }
        [s[idx], s[i]] = [s[i], s[idx]];
        T.step({ kind: 'change', line: L.sw, note: i === idx ? `i = idx = ${i}: keep '${s[idx]}' at position ${idx} (swap with itself).` : `Swap s[${idx}] ↔ s[${i}] → "${s.join('')}". '${s[idx]}' is now fixed at position ${idx}.` });
        rec(idx + 1, s[idx]);
        ptr.idx = idx; ptr.i = i;
        [s[idx], s[i]] = [s[i], s[idx]];
        T.step({ kind: 'revert', line: L.back, note: `Swap back s[${idx}] ↔ s[${i}] → "${s.join('')}". The shared string is restored before the next choice.` });
      }
      ptr.i = -1;
      T.ret({ line: L.loop, note: `Every letter has been tried at position ${idx}. Return.` });
    }
    rec(0, '');
    T.step({ kind: 'done', cur: 0, note: `Finished — <b>${T.out.length}</b> permutation(s). Notice: zero copies of s were made; one array was swapped and swapped back.` });
    return T;
  }

  /* ---------------- Approach A: input / output (by value) ---------------- */
  function traceIpOp(str, dedupe) {
    let copies = 0;
    const T = new RV.Tracer(() => ({ mode: 'ipop', copies }));
    const L = dedupe ? { base: 1, print: 2, ret: 3, loop: 5, skip: 6, mk: 9, rec: 11 } : { base: 1, print: 2, ret: 3, loop: 4, mk: 5, rec: 7 };
    function rec(ip, op, edge) {
      T.call('PERMUTE', [{ name: 'ip', value: ip }, { name: 'op', value: op }], {
        parts: [{ t: op || '·', c: 'a' }, { t: '|', c: 'd' }, { t: ip || '∅', c: 'd' }], edge, line: L.base,
        note: `PERMUTE(ip = "${ip}", op = "${op}") — this frame owns its own copies of ip and op.`,
      });
      if (!ip.length) {
        T.emit(op);
        T.step({ kind: 'solution', line: L.print, note: `ip is empty → we are at a <b>leaf</b> and op = "<b>${op}</b>" is complete. Print it.`, mark: [[T.top.node, 'solution']] });
        T.ret({ status: 'solution', line: L.ret, note: 'Return. The parent’s ip and op are untouched, so there is nothing to undo.' });
        return;
      }
      const used = new Set();
      for (let i = 0; i < ip.length; i++) {
        T.set('i', i);
        if (dedupe) {
          if (used.has(ip[i])) {
            T.prune({ label: ip[i], edge: ip[i], line: L.skip, note: `'${ip[i]}' already moved to op at this level → duplicate subtree. <b>Skip.</b>` });
            continue;
          }
          used.add(ip[i]);
          T.set('used', `{${Array.from(used).join(',')}}`);
        }
        const nip = ip.slice(0, i) + ip.slice(i + 1);
        const nop = op + ip[i];
        copies += 2;
        T.step({ kind: 'change', line: L.mk, note: `Pick ip[${i}] = '${ip[i]}': build <b>new</b> strings newIp = "${nip}", newOp = "${nop}".` });
        rec(nip, nop, ip[i]);
      }
      T.ret({ line: L.loop, note: `All letters of "${ip}" have been tried. Return.` });
    }
    rec(str, '', '');
    T.step({ kind: 'done', cur: 0, note: `Finished — <b>${T.out.length}</b> permutation(s), using <b>${copies}</b> string copies.` });
    return T;
  }

  function renderMem(mem, prev, st) {
    if (mem.mode === 'swap') {
      const p = RV.ptrs({ idx: mem.idx >= 0 && mem.idx < mem.s.length ? mem.idx : -1, i: mem.i });
      return RV.block('s — the ONLY copy of the string', RV.cells(mem.s, { prev: prev && prev.s, ptr: p, fixed: mem.idx >= 0 ? mem.idx : 0, hl: mem.i >= 0 ? [mem.i] : [], hl2: mem.idx >= 0 && mem.idx < mem.s.length ? [mem.idx] : [] }), { ref: true }) +
        '<div class="kv"><span><span class="accent">accent</span> cells = fixed prefix (positions &lt; idx)</span><span>pointers: <b>idx</b> = position being filled, <b>i</b> = candidate letter</span></div>';
    }
    const frames = st.frames.map((f, d) => {
      const ip = f.args.find((a) => a.name === 'ip').value, op = f.args.find((a) => a.name === 'op').value;
      return `<div class="kv"><span class="chip">#${d}</span> op = <b style="color:var(--accent)">"${esc(op)}"</b> ip = <b>"${esc(ip)}"</b></div>`;
    }).join('');
    return RV.block('Stack frames — every frame holds its own ip and op', `<div class="mem">${frames || '<span class="faint">all frames returned</span>'}</div>`, { val: true }) +
      `<div class="kv">string copies made so far: <b>${mem.copies}</b></div>`;
  }

  RV.ready(() => {
    const host = document.getElementById('viz-perm');
    if (!host) return;
    const player = new RV.TracePlayer(host, { title: 'Permutations — step by step', renderMem, outTitle: 'Permutations printed', levelH: 70 });
    const ui = document.createElement('div');
    ui.className = 'viz-inputs';
    ui.innerHTML = `
      <div class="seg" role="group" aria-label="Approach">
        <button type="button" data-m="swap" aria-pressed="true">B · swap (by reference)</button>
        <button type="button" data-m="ipop" aria-pressed="false">A · ip/op (by value)</button>
      </div>
      <label class="field">s <input type="text" maxlength="4" value="abc" aria-label="Input string (max 4 letters)"></label>
      <label class="toggle"><input type="checkbox"> skip duplicates</label>`;
    player.inputs.appendChild(ui);
    let mode = 'swap';
    const inp = ui.querySelector('input[type="text"]');
    const dd = ui.querySelector('input[type="checkbox"]');
    const presets = document.querySelectorAll('[data-perm-preset]');
    function run() {
      ui.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === mode)));
      const s = (inp.value || 'abc').replace(/\s/g, '').slice(0, 4) || 'abc';
      if (mode === 'swap') player.load(traceSwap(s, dd.checked), dd.checked ? PSEUDO.swapDedupe : PSEUDO.swap);
      else player.load(traceIpOp(s, dd.checked), dd.checked ? PSEUDO.ipopDedupe : PSEUDO.ipop);
    }
    ui.querySelector('.seg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { mode = b.dataset.m; run(); } });
    inp.addEventListener('change', run);
    dd.addEventListener('change', run);
    presets.forEach((b) => b.addEventListener('click', () => {
      inp.value = b.dataset.permPreset;
      dd.checked = b.dataset.dedupe === '1';
      mode = b.dataset.mode || mode;
      run();
      host.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    run();
  });
})();
