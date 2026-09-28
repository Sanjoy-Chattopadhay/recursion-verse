/* RecursionVerse — 3-D state-space tree (dependency-free canvas renderer)
 *
 * Builds the permutation tree of an alphabet ("abcd" → 1 + 4 + 12 + 24 + 24 nodes) as a cone tree,
 * rotates it in 3-D and animates the three "where does the answer live?" ideas:
 *   leaf  — plain recursion: answers are produced at the leaves
 *   root  — DP: sub-answers flow upward and the answer is assembled at the root
 *   path  — backtracking: the answer is the root→leaf path of choices (choose ↓, un-choose ↑)
 */
(function () {
  'use strict';
  const RV = (window.RV = window.RV || {});
  const TAU = Math.PI * 2;

  function hexToRgb(c) {
    c = (c || '').trim();
    if (c.startsWith('#')) {
      let h = c.slice(1);
      if (h.length === 3) h = h.split('').map((x) => x + x).join('');
      const n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const m = c.match(/\d+(\.\d+)?/g);
    return m ? m.slice(0, 3).map(Number) : [150, 150, 200];
  }
  const rgba = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;

  class Tree3D {
    constructor(canvas, o = {}) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.o = Object.assign({ alphabet: 'abcd', mode: 'path', cycle: false, onCaption: null, pitch: -0.42 }, o);
      this.mode = this.o.mode;
      this.yaw = 0.6;
      this.pitch = this.o.pitch;
      this.t0 = performance.now();
      this.modeStart = this.t0;
      this.reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.build();
      this.readColors();
      this.resize();
      this.bind();
      this.pickPath();
      this.visible = true;
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((es) => { this.visible = es[0].isIntersecting; if (this.visible) this.loop(); }).observe(canvas);
      }
      document.addEventListener('rv:theme', () => this.readColors());
      this.loop();
    }

    build() {
      const A = this.o.alphabet.split('');
      const depthMax = A.length;
      const radii = [0, 1.75, 0.74, 0.3, 0.12, 0.05];
      const gapY = 3.8 / depthMax;
      const nodes = [];
      const add = (parent, ch, used, depth, ang) => {
        const id = nodes.length;
        const n = { id, parent, ch, depth, children: [], str: parent < 0 ? '' : nodes[parent].str + ch };
        if (parent < 0) { n.x = 0; n.y = 1.9; n.z = 0; }
        else {
          const p = nodes[parent];
          const r = radii[depth] || 0.05;
          n.x = p.x + r * Math.cos(ang);
          n.z = p.z + r * Math.sin(ang);
          n.y = 1.9 - depth * gapY;
        }
        nodes.push(n);
        if (parent >= 0) nodes[parent].children.push(id);
        const rest = A.filter((c) => !used.includes(c));
        rest.forEach((c, k) => {
          const a = (parent < 0 ? 0 : ang) + (k / rest.length) * TAU + (depth % 2 ? 0.4 : 0);
          add(id, c, used.concat(c), depth + 1, a);
        });
      };
      add(-1, '', [], 0, 0);
      this.nodes = nodes;
      this.leaves = nodes.filter((n) => !n.children.length);
      this.depthMax = depthMax;
    }

    readColors() {
      const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v);
      this.col = {
        path: hexToRgb(css('--accent')),
        leaf: hexToRgb(css('--accent-2')),
        root: hexToRgb(css('--amber')),
        pink: hexToRgb(css('--accent-3')),
        faint: hexToRgb(css('--text-faint')),
        text: hexToRgb(css('--text')),
        dark: document.documentElement.dataset.theme === 'dark' ||
          (!document.documentElement.dataset.theme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches),
      };
    }

    resize() {
      const r = this.cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = Math.max(10, r.width);
      this.h = Math.max(10, r.height);
      this.cv.width = Math.round(this.w * dpr);
      this.cv.height = Math.round(this.h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    bind() {
      let drag = null;
      this.cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch }; this.cv.setPointerCapture(e.pointerId); this.dragging = true; });
      this.cv.addEventListener('pointermove', (e) => {
        if (!drag) return;
        this.yaw = drag.yaw + (e.clientX - drag.x) * 0.01;
        this.pitch = Math.max(-1.2, Math.min(0.5, drag.pitch + (e.clientY - drag.y) * 0.006));
        if (this.reduced) this.draw(performance.now());
      });
      const end = () => { drag = null; this.dragging = false; this.lastDrag = performance.now(); };
      this.cv.addEventListener('pointerup', end);
      this.cv.addEventListener('pointercancel', end);
      let t;
      window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => this.resize(), 120); });
    }

    setMode(m, keepCycle) {
      this.mode = m;
      this.modeStart = performance.now();
      this.pathCycle = undefined;
      if (!keepCycle) this.o.cycle = false;
      if (m === 'path') this.pickPath();
    }

    pickPath() {
      const leaf = this.leaves[Math.floor(Math.random() * this.leaves.length)];
      const path = [];
      for (let x = leaf.id; x >= 0; x = this.nodes[x].parent) path.unshift(x);
      this.path = path;
    }

    caption(s) {
      if (s !== this.lastCap) { this.lastCap = s; if (this.o.onCaption) this.o.onCaption(s, this.mode); }
    }

    loop() {
      if (this.raf) return;
      const f = (t) => {
        this.raf = null;
        if (!this.visible) return;
        this.draw(t);
        if (!this.reduced) this.raf = requestAnimationFrame(f);
      };
      this.raf = requestAnimationFrame(f);
    }

    project(n) {
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      let x = n.x * cy - n.z * sy;
      let z = n.x * sy + n.z * cy;
      let y = n.y;
      const y2 = y * cp - z * sp;
      const z2 = y * sp + z * cp;
      const cam = 7.2;
      const f = Math.min(this.w, this.h) * 1.55;
      const p = f / (cam - z2);
      const k = this.o.scale || 0.64;
      return { sx: this.w / 2 + x * p * k, sy: this.h / 2 - y2 * p * k + this.h * 0.04, z: z2, s: p / (f / cam) };
    }

    draw(t) {
      const ctx = this.ctx, N = this.nodes, C = this.col;
      if (!this.dragging && !this.reduced && (!this.lastDrag || t - this.lastDrag > 1500)) this.yaw += 0.0042;
      ctx.clearRect(0, 0, this.w, this.h);
      const P = N.map((n) => this.project(n));
      const el = (t - this.modeStart) / 1000;

      // ----- per-mode highlight intensities -----
      const nodeGlow = new Float32Array(N.length); // 0..1
      const edgeGlow = new Float32Array(N.length); // edge into node id
      let tint = C.path;
      if (this.mode === 'leaf') {
        tint = C.leaf;
        const per = 0.16, span = this.leaves.length * per;
        const tt = el % (span + 1.4);
        this.leaves.forEach((lf, k) => {
          const d = tt - k * per;
          if (d >= 0) nodeGlow[lf.id] = Math.max(0.35, 1 - d * 0.5);
        });
        const k = Math.min(this.leaves.length - 1, Math.floor(tt / per));
        this.caption(`Recursion · the answer is produced at a LEAF → "${this.leaves[Math.max(0, k)].str}"`);
        if (el > span + 1.3 && this.o.cycle) this.setMode('root', true);
      } else if (this.mode === 'root') {
        tint = C.root;
        const per = 0.75;
        const tt = el % (per * (this.depthMax + 2) + 1);
        N.forEach((n) => {
          const d = tt - (this.depthMax - n.depth) * per;
          if (d >= 0) { nodeGlow[n.id] = n.depth === 0 ? 1 : Math.max(0.3, 1 - d * 0.35); edgeGlow[n.id] = Math.max(0, 1 - d * 0.8); }
        });
        const lvl = Math.max(0, this.depthMax - Math.floor(tt / per));
        this.caption(lvl > 0 ? `DP · sub-answers bubble up from depth ${lvl}…` : 'DP · the final answer is assembled at the ROOT');
        if (el > per * (this.depthMax + 2) + 0.9 && this.o.cycle) this.setMode('path', true);
      } else {
        tint = C.path;
        const step = 0.6;
        const L = this.path.length - 1;
        const total = L * step * 2 + 1.6;
        const tt = el % total;
        const cycleNo = Math.floor(el / total);
        if (cycleNo !== this.pathCycle) { if (this.pathCycle !== undefined) this.pickPath(); this.pathCycle = cycleNo; }
        let reach; // how far down the path we are (float)
        let phase;
        if (tt < L * step) { reach = tt / step; phase = 'choose'; }
        else if (tt < L * step + 1.6) { reach = L; phase = 'leaf'; }
        else { reach = L - (tt - L * step - 1.6) / step; phase = 'undo'; }
        const depthNow = Math.floor(reach + 1e-6);
        for (let k = 1; k <= depthNow; k++) { edgeGlow[this.path[k]] = 1; nodeGlow[this.path[k]] = 1; }
        nodeGlow[this.path[0]] = 1;
        if (reach % 1 > 0 && depthNow + 1 <= L) edgeGlow[this.path[depthNow + 1]] = reach % 1;
        const str = this.path.slice(1, depthNow + 1).map((id) => N[id].ch).join(' → ');
        if (phase === 'choose') this.caption(`Backtracking · choose ↓   path = [ ${str || '∅'} ]`);
        else if (phase === 'leaf') this.caption(`Backtracking · the answer IS the path: "${N[this.path[L]].str}"`);
        else this.caption(`Backtracking · un-choose ↑ (revert)   path = [ ${str || '∅'} ]`);
        if (el > total * 2 - 0.1 && this.o.cycle) this.setMode('leaf', true);
      }

      // ----- edges -----
      ctx.lineCap = 'round';
      for (const n of N) {
        if (n.parent < 0) continue;
        const a = P[n.parent], b = P[n.id];
        const depthFade = 0.35 + 0.65 * Math.max(0, Math.min(1, (b.z + 3) / 6));
        const g = edgeGlow[n.id];
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        if (g > 0 && g < 1) {
          // partially travelled edge
          ctx.lineTo(a.sx + (b.sx - a.sx) * g, a.sy + (b.sy - a.sy) * g);
          ctx.strokeStyle = rgba(tint, 0.95);
          ctx.lineWidth = 3.2;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(a.sx + (b.sx - a.sx) * g, a.sy + (b.sy - a.sy) * g);
          ctx.lineTo(b.sx, b.sy);
          ctx.strokeStyle = rgba(C.faint, 0.28 * depthFade);
          ctx.lineWidth = 1.1;
          ctx.stroke();
          continue;
        }
        ctx.lineTo(b.sx, b.sy);
        if (g >= 1 || (this.mode === 'root' && g > 0)) {
          ctx.strokeStyle = rgba(tint, this.mode === 'root' ? 0.25 + 0.7 * g : 0.95);
          ctx.lineWidth = this.mode === 'root' ? 1.2 + 2 * g : 3.2;
          ctx.shadowColor = rgba(tint, 0.8);
          ctx.shadowBlur = 10;
        } else {
          ctx.strokeStyle = rgba(C.faint, 0.3 * depthFade);
          ctx.lineWidth = 1.1;
          ctx.shadowBlur = 0;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // ----- nodes (painter's order) -----
      const order = N.map((n) => n.id).sort((i, j) => P[i].z - P[j].z);
      for (const id of order) {
        const n = N[id], p = P[id];
        const g = nodeGlow[id];
        const base = n.depth === 0 ? 7.5 : Math.max(2.6, 6.2 - n.depth * 0.9);
        const r = base * p.s * (1 + g * 0.5);
        const depthFade = 0.45 + 0.55 * Math.max(0, Math.min(1, (p.z + 3) / 6));
        let c = C.faint;
        let alpha = 0.55 * depthFade;
        if (g > 0) { c = tint; alpha = 0.55 + 0.45 * g; }
        else if (n.depth === 0) { c = C.pink; alpha = 0.9; }
        if (g > 0.05) {
          const halo = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * 3.2);
          halo.addColorStop(0, rgba(c, 0.45 * g));
          halo.addColorStop(1, rgba(c, 0));
          ctx.fillStyle = halo;
          ctx.beginPath(); ctx.arc(p.sx, p.sy, r * 3.2, 0, TAU); ctx.fill();
        }
        const sph = ctx.createRadialGradient(p.sx - r * 0.35, p.sy - r * 0.35, r * 0.1, p.sx, p.sy, r);
        sph.addColorStop(0, rgba([255, 255, 255], Math.min(1, alpha + 0.2)));
        sph.addColorStop(0.35, rgba(c, alpha));
        sph.addColorStop(1, rgba(c.map((v) => v * 0.55), alpha));
        ctx.fillStyle = sph;
        ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, TAU); ctx.fill();
        if (n.depth > 0 && n.depth <= 2 && p.s > 0.75) {
          ctx.font = `600 ${Math.round(10 * p.s)}px "JetBrains Mono", monospace`;
          ctx.fillStyle = rgba(C.text, 0.75 * depthFade);
          ctx.textAlign = 'left';
          ctx.fillText(n.ch, p.sx + r + 3, p.sy + 3);
        }
        if (this.mode === 'leaf' && !n.children.length && g > 0.6) {
          ctx.font = `700 ${Math.round(11 * p.s)}px "JetBrains Mono", monospace`;
          ctx.fillStyle = rgba(C.leaf, g);
          ctx.textAlign = 'center';
          ctx.fillText(n.str, p.sx, p.sy + r + 13 * p.s);
        }
      }
      if (this.mode === 'root') {
        const p = P[0];
        const g = nodeGlow[0];
        if (g > 0) {
          ctx.font = '700 13px "JetBrains Mono", monospace';
          ctx.fillStyle = rgba(C.root, g);
          ctx.textAlign = 'center';
          ctx.fillText('answer', p.sx, p.sy - 18);
        }
      }
      if (this.mode === 'path') {
        const leafId = this.path[this.path.length - 1];
        if (nodeGlow[leafId] >= 1) {
          const p = P[leafId];
          ctx.font = '700 13px "JetBrains Mono", monospace';
          ctx.fillStyle = rgba(C.path, 1);
          ctx.textAlign = 'center';
          ctx.fillText(`"${N[leafId].str}"`, p.sx, p.sy + 22);
        }
      }
    }
  }
  RV.Tree3D = Tree3D;
})();
