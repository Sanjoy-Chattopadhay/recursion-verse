# RecursionVerse

An interactive course on **Recursion · Backtracking · Dynamic Programming · Greedy** — every call made visible.

**Live site:** https://sanjoy-chattopadhay.github.io/recursion-verse/

## The one big idea

| Technique | Where the answer lives | Memory model |
|-----------|------------------------|--------------|
| Recursion | at the **leaf** | each call gets copies (pass by value) |
| Dynamic Programming | at the **root** (built from sub-problems) | table of sub-answers |
| Backtracking | in the **path** from root to leaf | one shared state, changed then reverted (pass by reference) |

> Backtracking = Pass by Reference + Controlled Recursion

## What's inside

- `backtracking/index.html` — the concept lesson: leaf vs root vs path, controlled recursion (maze), pass by value vs reference (with a "forgot to undo" bug mode), when to use backtracking, the universal template (C++ / Java / Python / CLRS) and a pattern map.
- One page per problem, each with an animated state-space tree, 3-D call stack, memory view, CLRS pseudocode, code in three languages, dry run, complexity, pitfalls, exercises and similar problems on GFG, LeetCode, Codeforces, CodeChef, AtCoder and CSES:
  - `backtracking/permutations.html`
  - `backtracking/k-swaps.html`
  - `backtracking/hamiltonian-cycle.html`
  - `backtracking/graph-coloring.html`
- `greedy/` — 9 problems: fractional knapsack, activity selection, job sequencing, Huffman coding, Dijkstra, Prim, Kruskal, Bellman–Ford, optimal reliability allocation.
- `dp/` — 0/1 knapsack, Floyd's all-pairs shortest paths, Warshall's transitive closure, resource allocation.
- `backtracking/n-queens.html`, `backtracking/sum-of-subsets.html` — simple study pages (no animation).
- `branch-and-bound/` — travelling salesman by least-cost branch and bound.
- `recursion.html` — track coming soon.

## How it works

Plain HTML, CSS and JavaScript — no build step, no dependencies.

- `assets/js/tracer.js` — `Tracer` records a real run of an algorithm (tree nodes, stack frames, memory snapshots); `TracePlayer` replays it step by step.
- `assets/js/tree3d.js` — dependency-free canvas renderer for the rotating 3-D state-space tree.
- `assets/js/core.js` — theme toggle, navigation, syntax highlighting, CLRS pseudocode renderer.
- `assets/js/pages/*.js` — one trace per problem.

### Adding a new problem

1. Copy one of the problem pages in `backtracking/`.
2. Write a trace function in `assets/js/pages/` that runs the algorithm and calls `T.call`, `T.step`, `T.prune`, `T.ret`.
3. Pass it to `new RV.TracePlayer(host, { renderMem })` with its CLRS pseudocode.

Run locally with any static server, e.g. `python -m http.server`.
