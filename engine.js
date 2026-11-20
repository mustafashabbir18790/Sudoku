/* Sudoku Squad puzzle engine.
   IMPORTANT: Level N is generated deterministically from N. Do NOT change this file's
   algorithm after friends start playing, or level numbers will map to different puzzles. */
(function (root) {
  'use strict';

  // tech: 1 = naked singles only, 2 = naked + hidden singles, 0 = any unique puzzle
  const TIERS = [
    { name: 'Beginner', from: 1,    to: 1500,  hi: 44, lo: 36, tech: 1, pts: 10,  par: 300,  color: '#34d399' },
    { name: 'Easy',     from: 1501, to: 3500,  hi: 38, lo: 32, tech: 2, pts: 20,  par: 480,  color: '#60a5fa' },
    { name: 'Medium',   from: 3501, to: 6000,  hi: 32, lo: 27, tech: 2, pts: 40,  par: 720,  color: '#fbbf24' },
    { name: 'Hard',     from: 6001, to: 8000,  hi: 28, lo: 25, tech: 0, pts: 70,  par: 1200, color: '#fb923c' },
    { name: 'Expert',   from: 8001, to: 9500,  hi: 26, lo: 23, tech: 0, pts: 100, par: 1800, color: '#f87171' },
    { name: 'Master',   from: 9501, to: 10000, hi: 24, lo: 21, tech: 0, pts: 150, par: 2700, color: '#c084fc' }
  ];
  const MAX_LEVEL = 10000;

  const R = [], C = [], B = [], UNITS = [];
  for (let i = 0; i < 81; i++) { R[i] = (i / 9) | 0; C[i] = i % 9; B[i] = ((R[i] / 3) | 0) * 3 + ((C[i] / 3) | 0); }
  for (let u = 0; u < 9; u++) {
    UNITS.push([...Array(9).keys()].map(k => u * 9 + k));
    UNITS.push([...Array(9).keys()].map(k => k * 9 + u));
    const br = ((u / 3) | 0) * 3, bc = (u % 3) * 3, box = [];
    for (let k = 0; k < 9; k++) box.push((br + ((k / 3) | 0)) * 9 + bc + (k % 3));
    UNITS.push(box);
  }
  const PC = new Uint8Array(1024);
  for (let m = 1; m < 1024; m++) PC[m] = PC[m >> 1] + (m & 1);

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function tierOf(n) { for (const t of TIERS) if (n <= t.to) return t; return TIERS[TIERS.length - 1]; }

  // Backtracking solver (bitmasks + fewest-candidates cell). Returns {count, sol}.
  function solve(g, limit, rnd) {
    const a = Int8Array.from(g), rw = new Int16Array(9), cl = new Int16Array(9), bx = new Int16Array(9);
    for (let i = 0; i < 81; i++) {
      const d = a[i];
      if (d) {
        const b = 1 << d;
        if ((rw[R[i]] | cl[C[i]] | bx[B[i]]) & b) return { count: 0, sol: null };
        rw[R[i]] |= b; cl[C[i]] |= b; bx[B[i]] |= b;
      }
    }
    let count = 0, sol = null;
    function rec() {
      let best = -1, bm = 0, bn = 10;
      for (let i = 0; i < 81; i++) {
        if (a[i] === 0) {
          const m = (~(rw[R[i]] | cl[C[i]] | bx[B[i]])) & 0x3FE, n = PC[m];
          if (n < bn) { bn = n; best = i; bm = m; if (n < 2) break; }
        }
      }
      if (best < 0) { count++; if (!sol) sol = Int8Array.from(a); return count >= limit; }
      if (bn === 0) return false;
      const ds = [];
      for (let d = 1; d <= 9; d++) if (bm & (1 << d)) ds.push(d);
      if (rnd) shuffle(ds, rnd);
      const r = R[best], c = C[best], b = B[best];
      for (const d of ds) {
        const bit = 1 << d;
        a[best] = d; rw[r] |= bit; cl[c] |= bit; bx[b] |= bit;
        if (rec()) return true;
        a[best] = 0; rw[r] &= ~bit; cl[c] &= ~bit; bx[b] &= ~bit;
      }
      return false;
    }
    rec();
    return { count, sol };
  }

  // Can the puzzle be solved using only singles (naked, and optionally hidden)?
  function singles(g, hidden) {
    const a = Int8Array.from(g), rw = new Int16Array(9), cl = new Int16Array(9), bx = new Int16Array(9);
    let empty = 0;
    for (let i = 0; i < 81; i++) {
      const d = a[i];
      if (d) { const b = 1 << d; rw[R[i]] |= b; cl[C[i]] |= b; bx[B[i]] |= b; } else empty++;
    }
    const place = (i, d) => { a[i] = d; const b = 1 << d; rw[R[i]] |= b; cl[C[i]] |= b; bx[B[i]] |= b; empty--; };
    let prog = true;
    while (empty > 0 && prog) {
      prog = false;
      for (let i = 0; i < 81; i++) {
        if (!a[i]) {
          const m = (~(rw[R[i]] | cl[C[i]] | bx[B[i]])) & 0x3FE;
          if (m === 0) return false;
          if ((m & (m - 1)) === 0) { place(i, 31 - Math.clz32(m)); prog = true; }
        }
      }
      if (!prog && hidden) {
        for (const u of UNITS) {
          for (let d = 1; d <= 9; d++) {
            const b = 1 << d; let cnt = 0, at = -1, has = false;
            for (const i of u) {
              if (a[i] === d) { has = true; break; }
              if (!a[i] && !((rw[R[i]] | cl[C[i]] | bx[B[i]]) & b)) { cnt++; at = i; }
            }
            if (!has && cnt === 1) { place(at, d); prog = true; }
          }
        }
      }
    }
    return empty === 0;
  }

  function build(n, t, salt) {
    const rnd = mulberry32((Math.imul(n, 2246822519) ^ 0x27d4eb2f ^ Math.imul(salt, 374761393)) >>> 0);
    const sol = solve(new Int8Array(81), 1, rnd).sol;
    const frac = (n - t.from) / Math.max(1, t.to - t.from);
    const target = Math.round(t.hi - frac * (t.hi - t.lo));
    const puz = Int8Array.from(sol);
    const order = shuffle([...Array(81).keys()], rnd);
    let clues = 81;
    for (const i of order) {
      if (clues <= target) break;
      const d = puz[i]; puz[i] = 0;
      // singles-solvable implies unique, so only run the full uniqueness check for free-form tiers
      const ok = t.tech ? singles(puz, t.tech === 2) : solve(puz, 2).count === 1;
      if (ok) clues--; else puz[i] = d;
    }
    return { n, tier: t, puz, sol, clues };
  }

  function generate(n) {
    n = Math.max(1, Math.min(MAX_LEVEL, n | 0));
    const t = tierOf(n);
    let L;
    // Hard/Expert/Master must NOT be solvable by singles alone (needs pairs/locked/chains/guessing)
    for (let salt = 0; salt < 60; salt++) {
      L = build(n, t, salt);
      if (t.tech || !singles(L.puz, true)) break;
    }
    return L;
  }

  root.SudokuEngine = { TIERS, MAX_LEVEL, tierOf, generate, solve, singles, R, C, B };
  if (typeof module !== 'undefined') module.exports = root.SudokuEngine;
})(typeof window !== 'undefined' ? window : globalThis);
