// Cannon Merge - pure game logic (no DOM). Runs in the browser and in Node (tools/sim.js).
(function (root) {
  'use strict';

  const CELLS = 16, GRID = 4, CELL = 46, MAXL = 6, TOTAL_WAVES = 10;
  const STORM_WAVES = { 3: 1, 6: 1, 9: 1 };       // storm hits mid-wave
  const BOSS_WAVES = { 5: 1, 10: 2 };             // value = kraken tier
  const BIAS = [0.5, 0.5, 0.8, 0.5, 0.35, 0.15, 0.5, 0.85, 0.25, 0.5]; // share of enemies on the left
  const CROSSFIRE = 0.4;                          // fire-rate multiplier when shooting the far side
  const SPIN = 1.8, WARN = 3.0;
  const PANEL_H = 150, TOP_H = 56;
  const HULL_HALF = 104;

  // level 1..6, dps roughly x2.3 per level
  const CANNON = [null,
    { id: 'ball',  dmg: 9,   rate: 1.25, range: 310, speed: 430 },
    { id: 'twin',  dmg: 12,  rate: 1.25, range: 310, speed: 450 },
    { id: 'mortar', dmg: 150, rate: 0.55, range: 340, speed: 250, splash: 50 },
    { id: 'flame', dmg: 30,  rate: 5.5,  range: 175, burn: 20, splash: 22 },
    { id: 'ice',   dmg: 260, rate: 1.3,  range: 330, speed: 380, slow: 0.5, slowT: 2.5 },
    { id: 'bolt',  dmg: 560, rate: 1.25, range: 340, chain: 2, chainR: 110, falloff: 0.6 }
  ];

  const EN = {
    row:    { hp: 28,  spd: 38, stop: 148, atk: 'arrow',  int: 2.0, dmg: 2,  val: 4,  r: 14, cost: 1 },
    shark:  { hp: 45,  spd: 64, stop: 118, atk: 'bite',   int: 0.9, dmg: 3,  val: 6,  r: 16, cost: 1.6 },
    sloop:  { hp: 70,  spd: 30, stop: 144, atk: 'ball',   int: 2.4, dmg: 5,  val: 9,  r: 20, cost: 2.4 },
    gal:    { hp: 260, spd: 17, stop: 136, atk: 'volley', int: 3.2, dmg: 8,  val: 30, r: 30, cost: 6 },
    kraken: { hp: 1200, spd: 40, stop: 0,   atk: 'boss',   int: 1.7, dmg: 6,  val: 150, r: 42, cost: 0 }
  };

  // event ids (pooled, read by the renderer / audio)
  const EV = { SHOT: 1, HIT: 2, SPLASH: 3, KILL: 4, SHIPHIT: 5, BUY: 6, MERGE: 7, STORMWARN: 8, SPIN: 9, SHUFFLE: 10,
    WAVESTART: 11, WAVECLEAR: 12, BOSS: 13, SLAMWARN: 14, SLAM: 15, WIN: 16, LOSE: 17, FLAME: 18, BOLT: 19, ERROR: 20,
    MOVE: 21, REPAIR: 22, ENEMYSHOT: 23, BITE: 24, REVIVE: 25 };
  const MAXEV = 256, MAXP = 128, MAXB = 12;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function hpMul(w) { return 1 + 0.22 * (w - 1) + 0.025 * (w - 1) * (w - 1); }

  // ---------- setup ----------
  function setGeo(s, W, H) {
    s.W = W; s.H = H;
    s.cx = W / 2;
    s.panelTop = H - PANEL_H;
    s.seaTop = TOP_H + 14;
    s.seaBottom = s.panelTop - 6;
    s.cy = (s.seaTop + s.seaBottom) / 2;
  }

  function create(opts) {
    opts = opts || {};
    const ups = opts.ups || {};
    const s = {
      rnd: mulberry32(opts.seed || ((Date.now() ^ 0x5bd1e995) & 0x7fffffff)),
      phase: 'prep', wave: 1, time: 0, waveT: 0,
      maxHp: 200 + 25 * (ups.hull || 0), hp: 0,
      dmgMul: 1 + 0.06 * (ups.power || 0),
      coinMul: 1 + 0.08 * (ups.loot || 0),
      coins: 110, bought: 0, score: 0, kills: 0, merges: 0, maxLvl: 1,
      slots: new Array(CELLS).fill(0), cd: new Array(CELLS).fill(0),
      enemies: [], boss: null,
      list: [], li: 0, nextList: [], preview: { l: 0, r: 0, boss: 0, storm: 0 },
      storm: { state: 0, t: 0, done: false, at: 0, shuffled: false, turns: 0 },
      undo: null, revived: false, ended: false,
      shake: 0,
      proj: [], bolts: [], ev: [], evN: 0
    };
    for (let i = 0; i < MAXP; i++) s.proj.push({ on: false, hostile: false, kind: 0, x: 0, y: 0, sx: 0, sy: 0, tx: 0, ty: 0, target: null, speed: 0, dmg: 0, splash: 0, slow: 0, slowT: 0, d0: 1 });
    for (let i = 0; i < MAXB; i++) s.bolts.push({ on: false, t: 0, n: 0, x: [0, 0, 0, 0], y: [0, 0, 0, 0] });
    for (let i = 0; i < MAXEV; i++) s.ev.push({ t: 0, x: 0, y: 0, a: 0, b: 0 });
    s.hp = s.maxHp;
    setGeo(s, opts.W || 360, opts.H || 640);
    prepareWave(s);
    return s;
  }

  function ev(s, t, x, y, a, b) {
    if (s.evN >= MAXEV) return;
    const e = s.ev[s.evN++];
    e.t = t; e.x = x || 0; e.y = y || 0; e.a = a || 0; e.b = b || 0;
  }

  function cellX(s, i) { return s.cx + ((i & 3) - 1.5) * CELL; }
  function cellY(s, i) { return s.cy + ((i >> 2) - 1.5) * CELL; }
  function cellSide(i) { return (i & 3) < 2 ? -1 : 1; }

  // ---------- waves ----------
  function buildWave(w) {
    const r = mulberry32(w * 7919 + 13);
    const avail = [['row', 3]];
    if (w >= 2) avail.push(['sloop', 2.5]);
    if (w >= 3) avail.push(['shark', 2]);
    if (w >= 4) avail.push(['gal', 0.9]);
    let budget = 7 + w * 4.5 + w * w * 0.35;
    if (BOSS_WAVES[w]) budget *= 0.55;
    const bias = BIAS[(w - 1) % BIAS.length];
    const list = [];
    for (let guard = 0; guard < 200; guard++) {
      const ok = avail.filter(a => EN[a[0]].cost <= budget);
      if (!ok.length) break;
      let tot = 0; for (const a of ok) tot += a[1];
      let x = r() * tot, pick = ok[0][0];
      for (const a of ok) { x -= a[1]; if (x <= 0) { pick = a[0]; break; } }
      budget -= EN[pick].cost;
      list.push({ type: pick, side: r() < bias ? -1 : 1, t: 0 });
    }
    const dur = Math.min(30, 10 + w * 1.8);
    for (let i = 0; i < list.length; i++) list[i].t = 1 + (i / list.length) * dur + r() * 0.7;
    if (BOSS_WAVES[w]) list.unshift({ type: 'kraken', side: 0, t: 1.5, tier: BOSS_WAVES[w] });
    list.sort((a, b) => a.t - b.t);
    return { list: list, dur: dur };
  }

  function prepareWave(s) {
    const b = buildWave(s.wave);
    s.nextList = b.list; s.nextDur = b.dur;
    let l = 0, rr = 0, boss = 0, nl = 0, nr = 0;
    for (const it of b.list) {
      if (it.type === 'kraken') boss = 1;
      else if (it.side < 0) { l += EN[it.type].cost; nl++; } else { rr += EN[it.type].cost; nr++; }
    }
    s.preview.l = Math.round(l * 10) / 10; s.preview.r = Math.round(rr * 10) / 10; s.preview.nl = nl; s.preview.nr = nr;
    s.preview.boss = boss; s.preview.storm = STORM_WAVES[s.wave] ? 1 : 0;
  }

  function startWave(s) {
    if (s.phase !== 'prep') return false;
    s.phase = 'wave'; s.list = s.nextList; s.li = 0; s.waveT = 0;
    s.storm.state = 0; s.storm.t = 0; s.storm.done = false; s.storm.shuffled = false;
    s.storm.at = STORM_WAVES[s.wave] ? (s.list.length ? s.list[Math.floor(s.list.length * 0.45)].t : 5) : 0;
    ev(s, EV.WAVESTART, 0, 0, s.wave);
    return true;
  }

  function spawn(s, it) {
    const d = EN[it.type];
    const isBoss = it.type === 'kraken';
    const lane = s.seaTop + 26 + s.rnd() * (s.seaBottom - s.seaTop - 60);
    const hp = isBoss ? 1200 * (it.tier === 2 ? 2.7 : 1) : d.hp * hpMul(s.wave);
    const e = {
      type: it.type, boss: isBoss, side: it.side, tier: it.tier || 0,
      x: isBoss ? s.cx : (it.side < 0 ? -40 : s.W + 40), y: isBoss ? -80 : lane, ly: lane,
      hp: hp, maxHp: hp, spd: d.spd, stop: d.stop, r: d.r, cd: 0.6 + s.rnd() * 0.8,
      slowT: 0, burnT: 0, burnD: 0, flash: 0, dead: false, arrived: false, ph: s.rnd() * 6.28,
      slam: 0, slamCd: 5, split: false
    };
    s.enemies.push(e);
    if (isBoss) { s.boss = e; ev(s, EV.BOSS, e.x, e.y); }
    return e;
  }

  // ---------- player actions ----------
  function buyCost(s) { return 15 + 3 * s.bought; }

  function freeCell(s) {
    // prefer central cells so a new cannon is easy to spot
    const order = [5, 6, 9, 10, 1, 2, 4, 7, 8, 11, 13, 14, 0, 3, 12, 15];
    for (const i of order) if (!s.slots[i]) return i;
    return -1;
  }

  function buy(s) {
    if (s.phase === 'won' || s.phase === 'lost') return -1;
    const c = buyCost(s), i = freeCell(s);
    if (i < 0 || s.coins < c) { ev(s, EV.ERROR); return -1; }
    s.undo = { slots: s.slots.slice(), refund: c, bought: 1 };
    s.coins -= c; s.bought++; s.slots[i] = 1; s.cd[i] = 0.3;
    ev(s, EV.BUY, cellX(s, i), cellY(s, i), i);
    return i;
  }

  // 0 nothing, 1 move, 2 merge, 3 swap
  function tap(s, a, b) {
    if (s.phase === 'won' || s.phase === 'lost') return 0;
    if (s.storm.state === 2) return 0;
    if (a === b || a < 0 || b < 0 || !s.slots[a]) return 0;
    const la = s.slots[a], lb = s.slots[b];
    s.undo = { slots: s.slots.slice(), refund: 0, bought: 0 };
    if (!lb) { s.slots[b] = la; s.slots[a] = 0; s.cd[b] = Math.max(s.cd[b], 0.2); ev(s, EV.MOVE, cellX(s, b), cellY(s, b), b); return 1; }
    if (la === lb && la < MAXL) {
      s.slots[b] = la + 1; s.slots[a] = 0; s.merges++; s.cd[b] = 0.2;
      if (la + 1 > s.maxLvl) s.maxLvl = la + 1;
      ev(s, EV.MERGE, cellX(s, b), cellY(s, b), la + 1, b);
      return 2;
    }
    s.slots[a] = lb; s.slots[b] = la; ev(s, EV.MOVE, cellX(s, b), cellY(s, b), b);
    return 3;
  }

  function canUndo(s) { return !!s.undo && s.storm.state !== 2 && s.phase !== 'lost' && s.phase !== 'won'; }
  function undo(s) {
    if (!canUndo(s)) return false;
    s.slots = s.undo.slots; s.coins += s.undo.refund; s.bought -= s.undo.bought; s.undo = null;
    return true;
  }

  function repairCost(s) { return 10 + 2 * s.wave; }
  function repair(s) {
    if (s.phase !== 'prep' || s.hp >= s.maxHp) { ev(s, EV.ERROR); return false; }
    const c = repairCost(s);
    if (s.coins < c) { ev(s, EV.ERROR); return false; }
    s.coins -= c; s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.25);
    ev(s, EV.REPAIR, s.cx, s.cy);
    return true;
  }

  // Suggest the best action: a mergeable pair, else "buy"
  function hint(s) {
    let best = null;
    for (let l = 1; l < MAXL; l++) {
      let first = -1;
      for (let i = 0; i < CELLS; i++) {
        if (s.slots[i] !== l) continue;
        if (first < 0) first = i; else { best = { a: first, b: i, buy: false }; break; }
      }
      if (best) break;
    }
    return best || { a: -1, b: -1, buy: true };
  }

  function bonusCoins(s) { return Math.round((60 + s.wave * 15) * s.coinMul); }
  function giveBonus(s) { s.coins += bonusCoins(s); }

  function revive(s) {
    if (s.phase !== 'lost' || s.revived) return false;
    s.revived = true; s.ended = false; s.phase = 'wave';
    s.hp = s.maxHp * 0.5;
    for (const e of s.enemies) {
      if (e.dead) continue;
      if (e.boss) { e.hp = Math.max(1, e.hp - e.maxHp * 0.15); } else { e.dead = true; ev(s, EV.KILL, e.x, e.y, 0, 0); }
    }
    for (const p of s.proj) if (p.hostile) p.on = false;
    ev(s, EV.REVIVE, s.cx, s.cy);
    return true;
  }

  // ---------- storm ----------
  function shuffleShip(s) {
    const old = s.slots, n = new Array(CELLS).fill(0);
    for (let i = 0; i < CELLS; i++) n[CELLS - 1 - i] = old[i];      // ship turned 180 degrees
    for (let k = 0; k < 3; k++) {                                   // waves toss cannons around
      const a = (s.rnd() * CELLS) | 0, b = (s.rnd() * CELLS) | 0;
      const t = n[a]; n[a] = n[b]; n[b] = t;
    }
    s.slots = n; s.undo = null;
    for (let i = 0; i < CELLS; i++) s.cd[i] = Math.max(s.cd[i], 0.5);
  }

  // ---------- combat ----------
  function killEnemy(s, e) {
    e.dead = true;
    const gain = Math.round(EN[e.type].val * (1 + 0.06 * s.wave) * s.coinMul);
    s.coins += gain; s.kills++; s.score += EN[e.type].val * 10;
    ev(s, EV.KILL, e.x, e.y, gain, e.boss ? 1 : 0);
  }
  function hurt(s, e, amount, flash) {
    if (e.dead) return;
    e.hp -= amount;
    if (flash !== false) e.flash = 0.1;
    if (e.hp <= 0) killEnemy(s, e);
  }
  function hurtShip(s, d, x, y) {
    if (s.phase !== 'wave') return;
    s.hp -= d; s.shake = Math.min(1, s.shake + d / 25);
    ev(s, EV.SHIPHIT, x, y, d);
    if (s.hp <= 0) { s.hp = 0; s.phase = 'lost'; s.ended = true; ev(s, EV.LOSE); }
  }

  function newProj(s) { for (let i = 0; i < MAXP; i++) if (!s.proj[i].on) return s.proj[i]; return null; }

  function enemyShot(s, e, kind, dmg, spread) {
    const p = newProj(s); if (!p) return;
    p.on = true; p.hostile = true; p.kind = kind; p.x = e.x; p.y = e.y; p.sx = e.x; p.sy = e.y;
    p.tx = s.cx + (e.x < s.cx ? -1 : 1) * (HULL_HALF - 8); p.ty = s.cy + (s.rnd() - 0.5) * (spread || 190);
    if (e.boss) { p.tx = s.cx + (s.rnd() - 0.5) * 120; }
    p.target = null; p.speed = kind === 10 ? 260 : 210; p.dmg = dmg; p.splash = 0; p.d0 = Math.max(1, dist(p.x, p.y, p.tx, p.ty));
    ev(s, EV.ENEMYSHOT, e.x, e.y, kind);
  }

  function findTargets(s, px, py, range, side) {
    let best = null, bs = 1e9, same = true;
    for (let k = 0; k < s.enemies.length; k++) {
      const e = s.enemies[k];
      if (e.dead || e.x < -5 || e.x > s.W + 5 || e.y < -5) continue;
      const d = dist(px, py, e.x, e.y) - e.r * 0.5;
      if (d > range) continue;
      const sm = e.side === 0 || e.side === side;
      const sc = d + (sm ? 0 : 1000);
      if (sc < bs) { bs = sc; best = e; same = sm; }
    }
    return best ? { e: best, same: same } : null;
  }

  function fireCannon(s, i, lvl, t) {
    const def = CANNON[lvl], px = cellX(s, i), py = cellY(s, i), e = t.e;
    const ang = Math.atan2(e.y - py, e.x - px);
    const dmg = def.dmg * s.dmgMul;
    ev(s, EV.SHOT, px, py, ang, i * 10 + lvl);
    if (def.id === 'ball' || def.id === 'twin' || def.id === 'ice' || def.id === 'mortar') {
      const n = def.id === 'twin' ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const p = newProj(s); if (!p) break;
        const off = n === 1 ? 0 : (k ? 5 : -5);
        p.on = true; p.hostile = false; p.kind = def.id === 'mortar' ? 3 : def.id === 'ice' ? 5 : 1;
        p.x = px + Math.cos(ang) * 14 - Math.sin(ang) * off; p.y = py + Math.sin(ang) * 14 + Math.cos(ang) * off;
        p.sx = p.x; p.sy = p.y; p.tx = e.x; p.ty = e.y; p.target = e; p.speed = def.speed; p.dmg = dmg;
        p.splash = def.splash || 0; p.slow = def.slow || 0; p.slowT = def.slowT || 0;
        p.d0 = Math.max(1, dist(p.x, p.y, e.x, e.y));
      }
    } else if (def.id === 'flame') {
      ev(s, EV.FLAME, px, py, e.x, e.y);
      for (let k = 0; k < s.enemies.length; k++) {
        const o = s.enemies[k];
        if (o.dead) continue;
        if (o === e || dist(o.x, o.y, e.x, e.y) <= def.splash + o.r * 0.5) {
          hurt(s, o, dmg, true);
          if (!o.dead) { o.burnT = 3; o.burnD = def.burn * s.dmgMul; }
        }
      }
    } else if (def.id === 'bolt') {
      let b = null;
      for (let k = 0; k < MAXB; k++) if (!s.bolts[k].on) { b = s.bolts[k]; break; }
      const hit = [e];
      let cur = e, d = dmg;
      if (b) { b.on = true; b.t = 0.18; b.n = 1; b.x[0] = px; b.y[0] = py; b.x[1] = e.x; b.y[1] = e.y; b.n = 2; }
      hurt(s, e, d, true);
      for (let c = 0; c < def.chain; c++) {
        let nb = null, nd = def.chainR;
        for (let k = 0; k < s.enemies.length; k++) {
          const o = s.enemies[k];
          if (o.dead || hit.indexOf(o) >= 0) continue;
          const dd = dist(cur.x, cur.y, o.x, o.y);
          if (dd < nd) { nd = dd; nb = o; }
        }
        if (!nb) break;
        d *= def.falloff; hit.push(nb);
        if (b && b.n < 4) { b.x[b.n] = nb.x; b.y[b.n] = nb.y; b.n++; }
        hurt(s, nb, d, true); cur = nb;
      }
      ev(s, EV.BOLT, e.x, e.y);
    }
  }

  function impact(s, p) {
    if (p.hostile) { hurtShip(s, p.dmg, p.tx, p.ty); return; }
    if (p.kind === 3) {
      ev(s, EV.SPLASH, p.tx, p.ty, p.splash);
      for (let k = 0; k < s.enemies.length; k++) {
        const e = s.enemies[k]; if (e.dead) continue;
        const d = dist(p.tx, p.ty, e.x, e.y) - e.r * 0.5;
        if (d <= p.splash) hurt(s, e, p.dmg * (1 - 0.5 * Math.max(0, d) / p.splash), true);
      }
      return;
    }
    const e = p.target;
    if (e && !e.dead) {
      hurt(s, e, p.dmg, true);
      if (p.slow) { e.slowT = p.slowT; }
      ev(s, EV.HIT, p.x, p.y, p.kind);
    }
  }

  function updateBoss(s, e, dt) {
    const by = s.seaTop + 30;
    if (e.y < by) { e.y += e.spd * dt; return; }
    e.arrived = true;
    e.cd -= dt;
    if (e.cd <= 0) { e.cd = 1.7; enemyShot(s, e, 11, 6 + 2 * e.tier, 150); }
    e.slamCd -= dt;
    if (e.slam > 0) {
      e.slam -= dt;
      if (e.slam <= 0) { hurtShip(s, 18 + 7 * e.tier, s.cx, s.cy); ev(s, EV.SLAM, s.cx, s.cy); }
    } else if (e.slamCd <= 0) { e.slamCd = 7; e.slam = 1.2; ev(s, EV.SLAMWARN, s.cx, s.cy); }
    if (!e.split && e.hp < e.maxHp * 0.5) {
      e.split = true;
      s.list.splice(s.li, 0, { type: 'shark', side: -1, t: s.waveT }, { type: 'shark', side: 1, t: s.waveT }, { type: 'shark', side: -1, t: s.waveT + 0.8 }, { type: 'shark', side: 1, t: s.waveT + 0.8 });
    }
  }

  function updateEnemy(s, e, dt) {
    if (e.dead) return;
    if (e.flash > 0) e.flash -= dt;
    if (e.burnT > 0) { e.burnT -= dt; hurt(s, e, e.burnD * dt, false); if (e.dead) return; }
    const slow = e.slowT > 0 ? 0.5 : 1;
    if (e.slowT > 0) e.slowT -= dt;
    if (e.boss) { updateBoss(s, e, dt * slow); return; }
    const tx = s.cx + e.side * e.stop;
    if (!e.arrived) {
      e.x += -e.side * e.spd * slow * dt;
      if (e.side * (e.x - tx) <= 0) { e.x = tx; e.arrived = true; }
      return;
    }
    e.cd -= dt * slow;
    if (e.cd > 0) return;
    const d = EN[e.type];
    e.cd = d.int * (0.85 + s.rnd() * 0.3);
    if (d.atk === 'bite') { hurtShip(s, d.dmg * (1 + 0.04 * s.wave), e.x + e.side * -8, e.y); ev(s, EV.BITE, e.x, e.y); }
    else if (d.atk === 'arrow') enemyShot(s, e, 10, d.dmg * (1 + 0.05 * s.wave));
    else if (d.atk === 'ball') enemyShot(s, e, 11, d.dmg * (1 + 0.05 * s.wave));
    else if (d.atk === 'volley') { enemyShot(s, e, 11, d.dmg * (1 + 0.05 * s.wave)); enemyShot(s, e, 11, d.dmg * (1 + 0.05 * s.wave)); }
  }

  // ---------- main update ----------
  function update(s, dt) {
    if (s.phase === 'won' || s.phase === 'lost') return;
    s.time += dt;
    if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 3);
    const st = s.storm;

    if (s.phase === 'wave') {
      s.waveT += dt;
      while (s.li < s.list.length && s.list[s.li].t <= s.waveT) { spawn(s, s.list[s.li]); s.li++; }
      // storm: warn -> spin (ship turns 180) -> shuffle
      if (STORM_WAVES[s.wave] && !st.done) {
        if (st.state === 0 && s.waveT >= st.at) { st.state = 1; st.t = 0; ev(s, EV.STORMWARN); }
        else if (st.state === 1) { st.t += dt; if (st.t >= WARN) { st.state = 2; st.t = 0; ev(s, EV.SPIN); } }
        else if (st.state === 2) {
          st.t += dt;
          if (st.t >= SPIN) { shuffleShip(s); st.state = 0; st.done = true; st.turns++; ev(s, EV.SHUFFLE); }
        }
      }
    }

    // cannons
    if (st.state !== 2) {
      for (let i = 0; i < CELLS; i++) {
        const lvl = s.slots[i];
        if (!lvl) continue;
        s.cd[i] -= dt;
        if (s.cd[i] > 0) continue;
        if (s.phase !== 'wave') { s.cd[i] = 0.2; continue; }
        const def = CANNON[lvl];
        const t = findTargets(s, cellX(s, i), cellY(s, i), def.range, cellSide(i));
        if (!t) { s.cd[i] = 0.1; continue; }
        fireCannon(s, i, lvl, t);
        s.cd[i] = (1 / def.rate) * (t.same ? 1 : 1 / CROSSFIRE);
      }
    }

    for (let k = 0; k < s.enemies.length; k++) updateEnemy(s, s.enemies[k], dt);

    for (let k = 0; k < MAXP; k++) {
      const p = s.proj[k];
      if (!p.on) continue;
      if (!p.hostile && p.kind !== 3 && p.target) {
        if (p.target.dead) { p.on = false; continue; }
        p.tx = p.target.x; p.ty = p.target.y;
      }
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.sqrt(dx * dx + dy * dy), step = p.speed * dt;
      if (d <= step + 3) { p.on = false; impact(s, p); }
      else { p.x += dx / d * step; p.y += dy / d * step; }
    }
    for (let k = 0; k < MAXB; k++) if (s.bolts[k].on) { s.bolts[k].t -= dt; if (s.bolts[k].t <= 0) s.bolts[k].on = false; }

    // remove dead
    let j = 0;
    for (let k = 0; k < s.enemies.length; k++) if (!s.enemies[k].dead) s.enemies[j++] = s.enemies[k];
    s.enemies.length = j;
    if (s.boss && s.boss.dead) s.boss = null;

    // wave cleared?
    if (s.phase === 'wave' && s.li >= s.list.length && s.enemies.length === 0 && st.state !== 2) {
      const bonus = Math.round((20 + 8 * s.wave) * s.coinMul);
      s.coins += bonus; s.score += 100 * s.wave;
      ev(s, EV.WAVECLEAR, 0, 0, s.wave, bonus);
      if (s.wave >= TOTAL_WAVES) { s.phase = 'won'; s.ended = true; ev(s, EV.WIN); }
      else { s.wave++; s.phase = 'prep'; st.state = 0; prepareWave(s); }
    }
  }

  // ---------- bots (balance sim) ----------
  function sidePower(s, side) {
    let p = 0;
    for (let i = 0; i < CELLS; i++) if (s.slots[i] && cellSide(i) === side) p += Math.pow(2.3, s.slots[i]);
    return p;
  }
  function mergeAll(s, smart) {
    let n = 0; for (let i = 0; i < CELLS; i++) if (s.slots[i]) n++;
    const needL = s.phase === 'prep' ? s.preview.l >= s.preview.r : sidePower(s, -1) <= sidePower(s, 1);
    for (let l = 1; l < MAXL; l++) {
      if (smart && freeCell(s) >= 0 && (n <= 3 || (l >= 3 && n < 6))) break;     // keep a few cannons to cover both sides
      let first = -1;
      for (let i = 0; i < CELLS; i++) {
        if (s.slots[i] !== l) continue;
        if (first < 0) first = i;
        else {
          let a = first, b = i;
          if (smart) { const wantSide = needL ? -1 : 1; if (cellSide(a) === wantSide && cellSide(b) !== wantSide) { const t = a; a = b; b = t; } }
          tap(s, a, b); return true;
        }
      }
    }
    return false;
  }
  function balance(s) {
    // move strong cannons to the side that faces more enemies
    const need = s.phase === 'prep' ? s.preview : { l: 1, r: 1 };
    const total = need.l + need.r || 1;
    for (let k = 0; k < 2; k++) {
      const pl = sidePower(s, -1), pr = sidePower(s, 1), tot = pl + pr || 1;
      const diff = pl / tot - need.l / total;
      if (Math.abs(diff) < 0.18) return;
      const from = diff > 0 ? -1 : 1;
      let a = -1, b = -1;
      for (let i = 0; i < CELLS; i++) if (s.slots[i] && cellSide(i) === from && (a < 0 || s.slots[i] > s.slots[a])) a = i;
      for (let i = 0; i < CELLS; i++) if (cellSide(i) === -from && (b < 0 || s.slots[i] < s.slots[b])) b = i;
      if (a < 0 || b < 0) return;
      if (s.slots[b] >= s.slots[a]) return;
      tap(s, a, b);
    }
  }
  function bot(s, smart) {
    for (let g = 0; g < 40; g++) {
      if (mergeAll(s, smart)) continue;
      if (s.coins >= buyCost(s) && freeCell(s) >= 0) { buy(s); continue; }
      break;
    }
    if (smart) balance(s);
    if (s.phase === 'prep') {
      while (s.hp < s.maxHp * 0.7 && s.coins >= repairCost(s) + 25) repair(s);
      startWave(s);
    }
  }

  const Core = {
    CELLS: CELLS, GRID: GRID, CELL: CELL, MAXL: MAXL, TOTAL_WAVES: TOTAL_WAVES, CANNON: CANNON, EN: EN, EV: EV,
    STORM_WAVES: STORM_WAVES, BOSS_WAVES: BOSS_WAVES, HULL_HALF: HULL_HALF, PANEL_H: PANEL_H, TOP_H: TOP_H, SPIN: SPIN, WARN: WARN,
    create: create, setGeo: setGeo, update: update, buy: buy, buyCost: buyCost, tap: tap, undo: undo, canUndo: canUndo,
    repair: repair, repairCost: repairCost, startWave: startWave, hint: hint, giveBonus: giveBonus, bonusCoins: bonusCoins,
    revive: revive, prepareWave: prepareWave, cellX: cellX, cellY: cellY, cellSide: cellSide, freeCell: freeCell, buildWave: buildWave, bot: bot
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
  root.Core = Core;
})(typeof window !== 'undefined' ? window : this);
