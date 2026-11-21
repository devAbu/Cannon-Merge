// Cannon Merge - rendering, input, screens. Game rules live in core.js, text in strings.js.
(function () {
  'use strict';
  const C = window.Core, G = window.G, Snd = window.Snd, Save = window.Save, Ad = window.AdService, T = window.T;
  const EV = C.EV, TAU = Math.PI * 2;
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d', { alpha: false });
  const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

  // ---------- layout / resize ----------
  let cw = 0, ch = 0, dpr = 1, scale = 1, W = 360, H = 640, seaImg = null;
  function resize() {
    cw = window.innerWidth; ch = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    scale = Math.min(cw / 360, ch / 640);
    W = cw / scale; H = ch / scale;
    seaImg = G.makeSea(cv.width, cv.height);
    if (s) C.setGeo(s, W, H);
  }

  // ---------- state ----------
  let screen = 'menu';          // menu | game | upgrades | settings
  let overlay = null;           // null | pause | result
  let s = null;                 // core state
  let T0 = 0, tAnim = 0;
  let sel = -1, dragFrom = -1, dragX = 0, dragY = 0, dragMoved = false, downX = 0, downY = 0;
  let hintData = null, hintT = 0;
  let banner = null;
  let result = null;
  let flash = 0, errShake = 0;
  let spinVis = 0;              // 0..PI while the ship turns
  const cang = new Float32Array(16), crec = new Float32Array(16);
  const btns = [];              // buttons drawn this frame: {id,x,y,w,h}
  let pressId = null;

  // ---------- particles (pooled) ----------
  const NP = 240;
  const P = { x: new Float32Array(NP), y: new Float32Array(NP), vx: new Float32Array(NP), vy: new Float32Array(NP),
    life: new Float32Array(NP), max: new Float32Array(NP), sz: new Float32Array(NP), col: new Uint8Array(NP), kind: new Uint8Array(NP), n: 0 };
  const PAL = ['#ffffff', '#ffd35a', '#ff8a3a', '#9aa4b0', '#6fe3ff', '#ffe94a', '#8b5a2b', '#ff4a4a', '#7be07b', '#c58cff', '#e8f6ff', '#3a2a22'];
  const NR = 14; const R = { x: new Float32Array(NR), y: new Float32Array(NR), r: new Float32Array(NR), mx: new Float32Array(NR), life: new Float32Array(NR), col: new Uint8Array(NR) };
  let pHead = 0, rHead = 0;
  function part(x, y, vx, vy, life, sz, col, kind) {
    const i = pHead; pHead = (pHead + 1) % NP;
    P.x[i] = x; P.y[i] = y; P.vx[i] = vx; P.vy[i] = vy; P.life[i] = life; P.max[i] = life; P.sz[i] = sz; P.col[i] = col; P.kind[i] = kind || 0;
  }
  function burst(x, y, n, speed, life, sz, col) {
    for (let k = 0; k < n; k++) { const a = Math.random() * TAU, v = speed * (0.4 + Math.random() * 0.8); part(x, y, Math.cos(a) * v, Math.sin(a) * v, life * (0.6 + Math.random() * 0.6), sz, col, 0); }
  }
  function ring(x, y, r, col, life) {
    const i = rHead; rHead = (rHead + 1) % NR;
    R.x[i] = x; R.y[i] = y; R.r[i] = 4; R.mx[i] = r; R.life[i] = life || 0.4; R.col[i] = col;
  }
  const coinHud = { x: 0, y: 25 };

  // ---------- helpers ----------
  function rrect(x, y, w, h, r) { G.rr(ctx, x, y, w, h, r); }
  function txt(str, x, y, size, color, align, weight) {
    ctx.font = (weight || 'bold') + ' ' + size + 'px ' + FONT;
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText(str, x + 1, y + 1.6);
    ctx.fillStyle = color || '#fff'; ctx.fillText(str, x, y);
  }
  function coinIcon(x, y, r) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = '#f0b429'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#a8740c'; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.58, 0, TAU); ctx.fillStyle = '#ffd96a'; ctx.fill();
  }
  function heart(x, y, r) {
    ctx.beginPath(); ctx.moveTo(x, y + r * 0.9);
    ctx.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.7, y - r * 1.2, x, y - r * 0.4);
    ctx.bezierCurveTo(x + r * 0.7, y - r * 1.2, x + r * 1.5, y - r * 0.1, x, y + r * 0.9);
    ctx.fillStyle = '#ff5a5a'; ctx.fill();
  }
  function playIcon(x, y, r, col) {
    ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x - r * 0.6, y + r); ctx.closePath(); ctx.fillStyle = col || '#fff'; ctx.fill();
  }
  const THEMES = {
    gold:  ['#ffcf4a', '#e0961a', '#8a5a08', '#3a2400'],
    green: ['#7be07b', '#3fae4a', '#1d6b27', '#06280b'],
    blue:  ['#6fc3ff', '#3a8fd8', '#1b568f', '#082540'],
    red:   ['#ff8a7a', '#d8473a', '#8f2018', '#3a0a06'],
    dark:  ['#5b6b80', '#3d4a5c', '#222c3a', '#0c1118'],
    grey:  ['#8a949f', '#69727c', '#4b535b', '#1d2227']
  };
  // draws a button and registers its hit area; o: {theme, disabled, sub, icon, shake}
  function btn(id, x, y, w, h, label, o) {
    o = o || {};
    btns.push({ id: id, x: x, y: y, w: w, h: h });
    const th = THEMES[o.disabled ? 'grey' : (o.theme || 'gold')];
    const pressed = pressId === id;
    const off = pressed ? 2 : 0;
    const sx = o.shake ? Math.sin(tAnim * 60) * 3 : 0;
    ctx.save(); ctx.translate(sx, 0);
    rrect(x, y + 4, w, h, 11); ctx.fillStyle = th[3]; ctx.fill();
    rrect(x, y + off, w, h, 11); ctx.fillStyle = th[2]; ctx.fill();
    rrect(x + 2, y + 2 + off, w - 4, h - 7, 9);
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, th[0]); g.addColorStop(1, th[1]);
    ctx.fillStyle = g; ctx.fill();
    ctx.globalAlpha = o.disabled ? 0.75 : 1;
    const cx = x + w / 2, cyy = y + (h - 4) / 2 + off;
    if (o.sub) { txt(label, cx, cyy - 8, 14, '#fff'); if (o.subCoin) { ctx.font = 'bold 13px ' + FONT; const tw = ctx.measureText(o.sub).width; coinIcon(cx - tw / 2 - 9, cyy + 10, 7); txt(o.sub, cx + 4, cyy + 10, 13, '#fff'); } else txt(o.sub, cx, cyy + 10, 12, '#fff3d0', 'center', 'normal'); }
    else txt(label, cx, cyy, o.size || 17, '#fff');
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  // rewarded-video button (simulated through AdService)
  function adBtn(id, place, x, y, w, h, label, sub, enabled) {
    const st = Ad.status(place);
    let theme = 'blue', subText = sub, dis = !enabled;
    if (st.state === 'playing') { subText = Math.ceil(st.remain) + 's'; theme = 'green'; dis = false; }
    else if (st.state === 'cooldown') { subText = Math.ceil(st.remain) + 's'; dis = true; }
    btns.push({ id: id, x: x, y: y, w: w, h: h });
    const th = THEMES[dis ? 'grey' : theme], pressed = pressId === id, off = pressed ? 2 : 0;
    rrect(x, y + 4, w, h, 10); ctx.fillStyle = th[3]; ctx.fill();
    rrect(x, y + off, w, h, 10); ctx.fillStyle = th[2]; ctx.fill();
    rrect(x + 2, y + 2 + off, w - 4, h - 7, 8);
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, th[0]); g.addColorStop(1, th[1]); ctx.fillStyle = g; ctx.fill();
    if (st.state === 'playing') { // countdown progress fill
      const p = 1 - st.remain / 3;
      ctx.save(); rrect(x + 2, y + 2, w - 4, h - 7, 8); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x, y, w * p, h); ctx.restore();
    }
    ctx.globalAlpha = dis ? 0.7 : 1;
    playIcon(x + 14, y + (h - 4) / 2 + off, 5, '#fff');
    txt(label, x + w / 2 + 6, y + (h - 4) / 2 + off - (subText ? 7 : 0), 13, '#fff');
    if (subText) {
      if (st.state === 'ready' && sub && sub.charAt(0) === '+') { ctx.font = 'bold 12px ' + FONT; const tw = ctx.measureText(sub).width; coinIcon(x + w / 2 + 6 - tw / 2 - 8, y + (h - 4) / 2 + off + 9, 6); txt(sub, x + w / 2 + 6 + 4, y + (h - 4) / 2 + off + 9, 12, '#fff'); }
      else txt(subText, x + w / 2 + 6, y + (h - 4) / 2 + off + 9, 12, '#fff', 'center', 'normal');
    }
    ctx.globalAlpha = 1;
  }
  function panel(x, y, w, h) {
    rrect(x, y + 5, w, h, 16); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
    rrect(x, y, w, h, 16); const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#2c4a66'); g.addColorStop(1, '#16293c'); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#7aa6c8'; ctx.stroke();
  }
  function pill(x, y, w, h) { rrect(x, y, w, h, h / 2); ctx.fillStyle = 'rgba(6,24,40,0.62)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke(); }

  // ---------- background ----------
  function drawSea(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(seaImg, 0, 0);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    const a = G.sprites.waveA, b = G.sprites.waveB, ts = 160;
    let ox = (t * 9) % ts, oy = (t * 5) % ts;
    for (let x = -ts + ox; x < W; x += ts) for (let y = -ts + oy; y < H; y += ts) ctx.drawImage(a.c, x, y, ts, ts);
    ox = (-t * 6) % ts; oy = (t * 11) % ts;
    for (let x = -ts + ox; x < W; x += ts) for (let y = -ts + oy; y < H; y += ts) ctx.drawImage(b.c, x, y, ts, ts);
  }

  // ---------- game flow ----------
  function startGame() {
    s = C.create({ W: W, H: H, ups: Save.d.ups });
    screen = 'game'; overlay = null; result = null; sel = -1; dragFrom = -1; hintData = null; hintT = 0; banner = null; spinVis = 0;
    flash = 0; pHead = 0; rHead = 0; P.life.fill(0); R.life.fill(0);
    for (let i = 0; i < 16; i++) { cang[i] = (i & 3) < 2 ? Math.PI : 0; crec[i] = 0; }
    Snd.setMode('play');
  }
  function toMenu() { screen = 'menu'; overlay = null; s = null; Snd.setMode('menu'); }
  function endRun(won) {
    if (result) return;
    const earned = Save.finishRun(s.wave, s.score, won);
    result = { won: won, earned: earned, wave: s.wave, kills: s.kills, score: s.score, best: Save.d.bestScore, canRevive: !won && !s.revived };
    overlay = 'result';
  }
  function say(text, sub, color, dur) { banner = { text: text, sub: sub || '', color: color || '#ffd35a', t: dur || 2.2, max: dur || 2.2 }; }

  // ---------- events from the core -> sound + effects ----------
  function cellOf(x, y) {
    if (!s) return -1;
    const c = Math.floor((x - (s.cx - 92)) / 46), r = Math.floor((y - (s.cy - 92)) / 46);
    return (c < 0 || c > 3 || r < 0 || r > 3) ? -1 : r * 4 + c;
  }
  function handleEvents() {
    for (let k = 0; k < s.evN; k++) {
      const e = s.ev[k];
      switch (e.t) {
        case EV.SHOT: {
          const lvl = e.b % 10, i = (e.b / 10) | 0;
          cang[i] = e.a; crec[i] = 1;
          Snd.play('shot' + (lvl === 2 ? 1 : lvl));
          if (lvl === 4) { /* flame handled in FLAME */ } else part(e.x + Math.cos(e.a) * 20, e.y + Math.sin(e.a) * 20, Math.cos(e.a) * 40, Math.sin(e.a) * 40, 0.3, 3.5, lvl === 5 ? 4 : lvl === 6 ? 5 : 3, 0);
          break;
        }
        case EV.FLAME: {
          const a = Math.atan2(e.b - e.y, e.a - e.x), d = Math.hypot(e.a - e.x, e.b - e.y);
          for (let q = 0; q < 5; q++) { const f = 0.2 + Math.random() * 0.8; part(e.x + Math.cos(a) * d * f, e.y + Math.sin(a) * d * f + (Math.random() - 0.5) * 8, Math.cos(a) * 30, -20 - Math.random() * 20, 0.35, 4 + Math.random() * 3, Math.random() < 0.5 ? 1 : 2, 0); }
          break;
        }
        case EV.HIT: burst(e.x, e.y, 4, 70, 0.3, 2.5, e.b === 5 ? 4 : 0); Snd.play('hit'); break;
        case EV.SPLASH: ring(e.x, e.y, e.a * 1.1, 10, 0.45); burst(e.x, e.y, 10, 90, 0.5, 3.2, 10); burst(e.x, e.y, 5, 70, 0.4, 3, 2); Snd.play('splash'); break;
        case EV.BOLT: burst(e.x, e.y, 6, 110, 0.3, 2.6, 5); break;
        case EV.KILL: {
          burst(e.x, e.y, e.b ? 40 : 12, e.b ? 170 : 90, e.b ? 1.0 : 0.55, e.b ? 5 : 3.2, 6);
          burst(e.x, e.y, e.b ? 24 : 5, 60, 0.6, 3, 11);
          if (e.a > 0) for (let q = 0; q < Math.min(4, 1 + (e.a / 8 | 0)); q++) part(e.x, e.y, (Math.random() - 0.5) * 70, -30 - Math.random() * 40, 0.9 + q * 0.08, 5, 1, 1);
          if (e.a > 0) { Snd.play(e.b ? 'bossKill' : 'kill'); Snd.play('coin'); if (e.b) { flash = 0.8; Snd.vibrate(120); } }
          break;
        }
        case EV.SHIPHIT: burst(e.x, e.y, 6, 80, 0.45, 3, 6); Snd.play('shipHit'); Snd.vibrate(e.a >= 8 ? 30 : 12); if (e.a >= 12) flash = Math.max(flash, 0.25); break;
        case EV.ENEMYSHOT: part(e.x, e.y, 0, 0, 0.25, 4, 3, 0); Snd.play('enemyShot'); break;
        case EV.BITE: Snd.play('bite'); break;
        case EV.BUY: burst(e.x, e.y, 10, 90, 0.5, 3, 1); ring(e.x, e.y, 26, 1, 0.35); Snd.play('buy'); break;
        case EV.MOVE: Snd.play('move'); break;
        case EV.MERGE: { burst(e.x, e.y, 18, 130, 0.6, 3.4, e.a >= 5 ? 5 : 1); ring(e.x, e.y, 34, 8, 0.45); Snd.play('merge', e.a); Snd.vibrate(15); break; }
        case EV.REPAIR: burst(e.x, e.y, 22, 110, 0.7, 3.2, 8); Snd.play('repair'); break;
        case EV.ERROR: Snd.play('error'); Snd.vibrate(10); errShake = 0.35; break;
        case EV.STORMWARN: say(T('stormWarn'), T('stormTip'), '#ffe94a', 3); Snd.play('stormWarn'); Snd.vibrate([40, 60, 40]); break;
        case EV.SPIN: say(T('stormHit'), '', '#ffffff', 1.8); Snd.play('thunder'); Snd.vibrate(100); flash = 1; sel = -1; dragFrom = -1; hintData = null; break;
        case EV.SHUFFLE: for (let i = 0; i < 16; i++) if (s.slots[i]) { ring(C.cellX(s, i), C.cellY(s, i), 22, 0, 0.35); cang[i] = (i & 3) < 2 ? Math.PI : 0; } Snd.play('shuffle'); Snd.vibrate(40); break;
        case EV.WAVESTART: Snd.play('wave'); break;
        case EV.WAVECLEAR:
          Snd.play('clear');
          if (!Save.d.tutDone) { Save.d.tutDone = true; Save.save(); }
          if (s.phase === 'prep') say(T('waveShort', e.a), '+' + e.b, '#7be07b', 1.8);
          break;
        case EV.BOSS: say(T('boss'), '', '#ff7a7a', 2.6); Snd.play('boss'); Snd.setMode('boss'); Snd.vibrate(150); break;
        case EV.SLAMWARN: break;
        case EV.SLAM: Snd.play('slam'); Snd.vibrate(120); flash = 0.7; burst(s.cx, s.cy, 30, 160, 0.8, 4, 9); break;
        case EV.WIN: Snd.play('win'); endRun(true); break;
        case EV.LOSE: Snd.play('lose'); Snd.vibrate(200); endRun(false); break;
        case EV.REVIVE: ring(s.cx, s.cy, 120, 8, 0.7); burst(s.cx, s.cy, 40, 160, 0.8, 4, 8); Snd.play('reward'); break;
        default: break;
      }
    }
    s.evN = 0;
  }

  // ---------- drawing the world ----------
  function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
  function drawWorld(t) {
    const st = s.storm;
    const baseTurn = (st.turns % 2) * Math.PI;
    const spinning = st.state === 2;
    const turn = baseTurn + (spinning ? ease(Math.min(1, st.t / C.SPIN)) * Math.PI : 0);
    const bob = Math.sin(t * 1.6) * 1.5;
    const sh = s.shake > 0 ? s.shake * 7 : 0;
    ctx.save();
    if (sh) ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);

    // enemies behind / around ship
    for (let k = 0; k < s.enemies.length; k++) {
      const e = s.enemies[k];
      const ey = e.y + Math.sin(t * 2 + e.ph) * 2.2, rot = Math.sin(t * 1.7 + e.ph) * 0.05;
      if (e.type === 'kraken') {
        const pulse = 1 + Math.sin(t * 2.4) * 0.03;
        G.put(ctx, G.sprites.kraken, e.x, ey, Math.sin(t * 0.8) * 0.06, false, pulse * 0.85);
      } else {
        if (e.slowT > 0) { ctx.beginPath(); ctx.ellipse(e.x, ey, e.r + 6, e.r * 0.6 + 5, 0, 0, TAU); ctx.fillStyle = 'rgba(150,230,255,0.45)'; ctx.fill(); }
        G.put(ctx, G.sprites[e.type], e.x, ey, rot, e.side > 0, 1);
      }
      if (e.flash > 0) { ctx.beginPath(); ctx.arc(e.x, ey, e.r * (e.boss ? 0.8 : 0.7), 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill(); }
      if (e.burnT > 0) { ctx.beginPath(); ctx.arc(e.x + Math.sin(t * 30 + e.ph) * 4, ey - 4, 3.5, 0, TAU); ctx.fillStyle = 'rgba(255,150,40,0.9)'; ctx.fill(); }
      if (e.hp < e.maxHp && !e.boss) {
        const bw = Math.max(20, e.r * 1.5), bx = e.x - bw / 2, by = ey - e.r - 7;
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
        ctx.fillStyle = e.hp / e.maxHp > 0.4 ? '#7be07b' : '#ff6a5a'; ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 3);
      }
    }

    // ship
    ctx.save();
    ctx.translate(s.cx, s.cy + bob);
    if (spinning) { const z = 1 + Math.sin(Math.min(1, st.t / C.SPIN) * Math.PI) * 0.06; ctx.scale(z, z); }
    ctx.rotate(turn);
    ctx.drawImage(G.sprites.hull.c, -G.sprites.hull.w / 2, -G.sprites.hull.h / 2, G.sprites.hull.w, G.sprites.hull.h);
    ctx.restore();
    drawDeckHints(t, bob);
    drawCannons(t, bob, spinning ? turn - baseTurn : 0);
    // kraken slam telegraph
    if (s.boss && s.boss.slam > 0) {
      const f = s.boss.slam / 1.2;
      ctx.beginPath(); ctx.arc(s.cx, s.cy, 40 + 130 * f, 0, TAU);
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(190,90,255,' + (0.9 - f * 0.5) + ')'; ctx.stroke();
      ctx.fillStyle = 'rgba(120,40,170,' + (0.32 - f * 0.2) + ')'; ctx.fill();
    }
    drawShots(t);
    ctx.restore();
  }

  function drawDeckHints(t, bob) {
    // dashed centre line + arrows show which side each half of the deck fires at
    const x = s.cx, y0 = s.cy - 92 + bob, y1 = s.cy + 92 + bob;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const ax = 92 + 8, p = Math.sin(t * 3) * 1.5;
    ctx.beginPath(); ctx.moveTo(s.cx - ax - 9 - p, s.cy + bob); ctx.lineTo(s.cx - ax + 1 - p, s.cy - 7 + bob); ctx.lineTo(s.cx - ax + 1 - p, s.cy + 7 + bob); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s.cx + ax + 9 + p, s.cy + bob); ctx.lineTo(s.cx + ax - 1 + p, s.cy - 7 + bob); ctx.lineTo(s.cx + ax - 1 + p, s.cy + 7 + bob); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  const LVL_COL = ['', '#c7ced8', '#6fb4e8', '#e0a84a', '#ff7a3a', '#7fd8f5', '#ffe94a'];
  function drawCannons(t, bob, spinAng) {
    const cs = Math.cos(spinAng), sn = Math.sin(spinAng);
    let matchLvl = 0;
    if (sel >= 0 && s.slots[sel]) matchLvl = s.slots[sel];
    else if (dragFrom >= 0 && s.slots[dragFrom]) matchLvl = s.slots[dragFrom];
    for (let i = 0; i < 16; i++) {
      const l = s.slots[i];
      let px = C.cellX(s, i), py = C.cellY(s, i) + bob;
      if (spinAng) { const dx = px - s.cx, dy = py - s.cy; px = s.cx + dx * cs - dy * sn; py = s.cy + dx * sn + dy * cs; }
      // highlights
      if (!spinAng) {
        if (l && l < C.MAXL && matchLvl === l && i !== sel && i !== dragFrom) { ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(120,255,140,' + (0.55 + Math.sin(t * 7) * 0.35) + ')'; rrect(px - 21, py - 21, 42, 42, 8); ctx.stroke(); }
        if (i === sel) { ctx.lineWidth = 3; ctx.strokeStyle = '#ffd35a'; rrect(px - 22, py - 22, 44, 44, 9); ctx.stroke(); }
        if (matchLvl && !l && (sel >= 0 || dragFrom >= 0)) { ctx.fillStyle = 'rgba(255,255,255,0.10)'; rrect(px - 20, py - 20, 40, 40, 8); ctx.fill(); }
      }
      if (!l || i === dragFrom && dragMoved) continue;
      ctx.fillStyle = LVL_COL[l]; ctx.globalAlpha = 0.16; rrect(px - 20, py - 20, 40, 40, 8); ctx.fill(); ctx.globalAlpha = 1;
      crec[i] = Math.max(0, crec[i] - 0.1);
      const want = (i & 3) < 2 ? Math.PI : 0;
      if (!spinAng) {
        // ease towards the last aimed angle; relax back to the side when idle
        crec[i] = Math.max(0, crec[i]);
      }
      let a = cang[i];
      if (spinAng) a += spinAng;
      const rec = crec[i] * 3;
      G.put(ctx, G.sprites.cannon[l], px - Math.cos(a) * rec, py - Math.sin(a) * rec, a, false, 1);
      // level pips
      ctx.fillStyle = LVL_COL[l];
      for (let k = 0; k < l; k++) ctx.fillRect(px - 17 + k * 5, py + 15, 3.4, 3.4);
      void want;
    }
    // relax aims back to rest side slowly
    if (!spinAng) for (let i = 0; i < 16; i++) { const want = (i & 3) < 2 ? Math.PI : 0; let d = want - cang[i]; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; if (crec[i] <= 0) cang[i] += d * 0.02; }
    // dragged cannon follows the finger
    if (dragFrom >= 0 && dragMoved && s.slots[dragFrom]) {
      const l = s.slots[dragFrom];
      G.put(ctx, G.sprites.cannon[l], dragX, dragY - 18, (dragFrom & 3) < 2 ? Math.PI : 0, false, 1.25);
    }
    // hint (rewarded)
    if (hintData && hintT > 0 && !hintData.buy) {
      const ax = C.cellX(s, hintData.a), ay = C.cellY(s, hintData.a), bx = C.cellX(s, hintData.b), by = C.cellY(s, hintData.b);
      const pulse = 0.5 + Math.sin(t * 8) * 0.5;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(120,255,140,' + (0.5 + pulse * 0.5) + ')';
      rrect(ax - 22, ay - 22, 44, 44, 9); ctx.stroke(); rrect(bx - 22, by - 22, 44, 44, 9); ctx.stroke();
      ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  function drawShots(t) {
    // friendly + hostile projectiles
    for (let k = 0; k < s.proj.length; k++) {
      const p = s.proj[k];
      if (!p.on) continue;
      if (p.kind === 3) {
        const d = Math.hypot(p.tx - p.x, p.ty - p.y), pr = 1 - d / p.d0, h = Math.sin(Math.max(0, Math.min(1, pr)) * Math.PI) * 46;
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 4, 2.5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e0a84a'; ctx.beginPath(); ctx.arc(p.x, p.y - h, 5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3a2a22'; ctx.beginPath(); ctx.arc(p.x - 1, p.y - h - 1, 2.5, 0, TAU); ctx.fill();
      } else if (p.kind === 5) {
        ctx.fillStyle = 'rgba(150,235,255,0.35)'; ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e8fbff'; ctx.beginPath(); ctx.arc(p.x, p.y, 4.2, 0, TAU); ctx.fill();
      } else if (p.kind === 10) {
        const a = Math.atan2(p.ty - p.sy, p.tx - p.sx);
        ctx.strokeStyle = '#e8d8b0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(a) * 9, p.y - Math.sin(a) * 9); ctx.stroke();
      } else {
        ctx.fillStyle = p.hostile ? '#2a2630' : '#4a4f58'; ctx.beginPath(); ctx.arc(p.x, p.y, p.hostile ? 4 : 3.4, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(p.x - 1, p.y - 1, 1.3, 0, TAU); ctx.fill();
      }
    }
    // lightning
    for (let k = 0; k < s.bolts.length; k++) {
      const b = s.bolts[k];
      if (!b.on) continue;
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? '#ffffff' : 'rgba(255,233,74,0.55)'; ctx.lineWidth = pass ? 2 : 6; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(b.x[0], b.y[0]);
        for (let q = 1; q < b.n; q++) {
          const x0 = b.x[q - 1], y0 = b.y[q - 1], x1 = b.x[q], y1 = b.y[q];
          for (let m = 1; m <= 4; m++) { const f = m / 4, j = m === 4 ? 0 : (Math.random() - 0.5) * 14; ctx.lineTo(x0 + (x1 - x0) * f + j, y0 + (y1 - y0) * f + j); }
        }
        ctx.stroke();
      }
    }
    // rings + particles
    for (let i = 0; i < NR; i++) {
      if (R.life[i] <= 0) continue;
      const f = 1 - R.life[i] / 0.45;
      ctx.globalAlpha = Math.max(0, Math.min(1, R.life[i] * 2.2)); ctx.lineWidth = 3; ctx.strokeStyle = PAL[R.col[i]];
      ctx.beginPath(); ctx.arc(R.x[i], R.y[i], R.r[i] + (R.mx[i] - R.r[i]) * Math.min(1, f * 1.3), 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function drawParticles(dt) {
    let lastCol = -1;
    for (let i = 0; i < NP; i++) {
      if (P.life[i] <= 0) continue;
      P.life[i] -= dt;
      if (P.kind[i] === 1) { // coin flying to the HUD counter
        const tx = coinHud.x, ty = coinHud.y, dx = tx - P.x[i], dy = ty - P.y[i];
        P.vx[i] += dx * 9 * dt; P.vy[i] += dy * 9 * dt; P.vx[i] *= 0.9; P.vy[i] *= 0.9;
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) { P.life[i] = 0; continue; }
        P.x[i] += P.vx[i] * dt * 3.2; P.y[i] += P.vy[i] * dt * 3.2;
        ctx.globalAlpha = 1; coinIcon(P.x[i], P.y[i], 4.5); lastCol = -1;
        continue;
      }
      P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.vx[i] *= 0.96; P.vy[i] *= 0.96;
      const a = Math.max(0, P.life[i] / P.max[i]);
      ctx.globalAlpha = a;
      if (P.col[i] !== lastCol) { ctx.fillStyle = PAL[P.col[i]]; lastCol = P.col[i]; }
      const r = P.sz[i] * (0.5 + a * 0.5);
      ctx.fillRect(P.x[i] - r, P.y[i] - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < NR; i++) if (R.life[i] > 0) R.life[i] -= dt;
  }

  function drawStormFx(t) {
    const st = s.storm;
    const active = st.state > 0 || (s.phase === 'wave' && st.done && s.waveT - st.at < 14 && C.STORM_WAVES[s.wave]);
    if (!active) return;
    const k = st.state === 2 ? 1 : st.state === 1 ? 0.6 : 0.4;
    ctx.fillStyle = 'rgba(10,20,40,' + (0.28 * k) + ')'; ctx.fillRect(0, 0, W, H - C.PANEL_H);
    ctx.strokeStyle = 'rgba(200,225,255,0.45)'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i < 46; i++) {
      const x = ((i * 53.7 + t * 90) % (W + 40)) - 20, y = ((i * 97.3 + t * 520) % (H - C.PANEL_H + 40)) - 20;
      ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 14);
    }
    ctx.stroke();
  }

  function drawPreview(t) {
    // incoming-side markers while preparing
    if (s.phase !== 'prep') return;
    const pv = s.preview, y = s.cy;
    [[-1, pv.nl], [1, pv.nr]].forEach(function (q) {
      if (!q[1]) return;
      const x = q[0] < 0 ? 16 : W - 16, p = Math.sin(t * 4) * 3 * -q[0];
      ctx.fillStyle = 'rgba(255,90,80,0.85)';
      for (let i = 0; i < 2; i++) {
        const xo = x + i * 9 * -q[0] * -1 + p; // chevron pointing at the ship
        ctx.beginPath();
        if (q[0] < 0) { ctx.moveTo(xo - 6, y - 12); ctx.lineTo(xo + 5, y); ctx.lineTo(xo - 6, y + 12); ctx.lineTo(xo - 2, y); }
        else { ctx.moveTo(xo + 6, y - 12); ctx.lineTo(xo - 5, y); ctx.lineTo(xo + 6, y + 12); ctx.lineTo(xo + 2, y); }
        ctx.closePath(); ctx.fill();
      }
      const bx = q[0] < 0 ? 24 : W - 24;
      ctx.beginPath(); ctx.arc(bx, y - 34, 12, 0, TAU); ctx.fillStyle = 'rgba(120,20,16,0.85)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#ffb0a8'; ctx.stroke();
      txt(String(q[1]), bx, y - 34, 13, '#fff');
    });
  }

  // ---------- HUD + bottom panel ----------
  function drawHud(t) {
    // top bar
    pill(10, 8, 118, 34);
    txt(T('wave', s.wave, C.TOTAL_WAVES), 69, 25.5, 15, '#fff');
    pill(W - 166, 8, 110, 34);
    coinHud.x = W - 166 + 22; coinHud.y = 25;
    coinIcon(coinHud.x, coinHud.y, 9);
    txt(String(s.coins), W - 166 + 70, 25.5, 17, '#ffe38a');
    btn('pause', W - 48, 6, 38, 38, '', { theme: 'dark' });
    ctx.fillStyle = '#fff'; rrect(W - 38, 17, 6, 16, 2); ctx.fill(); rrect(W - 26, 17, 6, 16, 2); ctx.fill();
    // ship health
    const hp = s.hp / s.maxHp, bx = 14, bw = W - 28, by = 52;
    rrect(bx - 2, by - 2, bw + 4, 14, 7); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
    rrect(bx, by, Math.max(10, bw * hp), 10, 5);
    ctx.fillStyle = hp > 0.5 ? '#5fd35f' : hp > 0.25 ? '#f0c24a' : '#ff5a4a'; ctx.fill();
    heart(bx + 8, by + 5, 4.5);
    txt(Math.ceil(s.hp) + '/' + s.maxHp, W / 2, by + 5.5, 10, '#fff');
    // forecast icons
    if (s.phase === 'prep') {
      if (s.preview.boss) { G.put(ctx, G.sprites.kraken, W / 2 - 20, 84, 0, false, 0.28); txt('!', W / 2 - 2, 84, 16, '#ff7a7a'); }
      if (s.preview.storm) stormIcon(W / 2 + (s.preview.boss ? 30 : 0), 84, t);
    }
    // boss bar
    if (s.boss) {
      const b = s.boss, w2 = W - 80, x2 = 40, y2 = 72;
      rrect(x2 - 2, y2 - 2, w2 + 4, 12, 6); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
      rrect(x2, y2, Math.max(8, w2 * b.hp / b.maxHp), 8, 4); ctx.fillStyle = '#b05ad8'; ctx.fill();
      txt(T('enemies').kraken || 'Kraken', W / 2, y2 + 4.5, 9, '#fff');
    }
  }
  function stormIcon(x, y, t) {
    ctx.fillStyle = '#9fb3c8'; ctx.beginPath(); ctx.arc(x - 8, y, 8, 0, TAU); ctx.arc(x + 2, y - 4, 10, 0, TAU); ctx.arc(x + 11, y + 1, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = (Math.sin(t * 6) > 0) ? '#ffe94a' : '#fff6a8';
    ctx.beginPath(); ctx.moveTo(x + 1, y + 4); ctx.lineTo(x - 5, y + 14); ctx.lineTo(x, y + 12); ctx.lineTo(x - 3, y + 20); ctx.lineTo(x + 6, y + 9); ctx.lineTo(x + 1, y + 10); ctx.closePath(); ctx.fill();
  }

  function drawPanel(t) {
    const pt = H - C.PANEL_H;
    rrect(0, pt, W, C.PANEL_H + 20, 18); const g = ctx.createLinearGradient(0, pt, 0, H); g.addColorStop(0, '#5a3820'); g.addColorStop(1, '#3a2412'); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#a06a3a'; ctx.stroke();
    const cost = C.buyCost(s), full = C.freeCell(s) < 0;
    const canBuy = s.coins >= cost && !full;
    btn('buy', 12, pt + 12, 140, 56, T('buy'), { theme: 'gold', disabled: !canBuy, sub: full ? T('full') : String(cost), subCoin: !full, shake: errShake > 0 });
    const rc = C.repairCost(s), canRep = s.phase === 'prep' && s.hp < s.maxHp && s.coins >= rc;
    btn('repair', 160, pt + 12, 88, 56, T('repair'), { theme: 'blue', disabled: !(s.phase === 'prep' && s.hp < s.maxHp), sub: s.hp >= s.maxHp ? T('full') : String(rc), subCoin: s.hp < s.maxHp, shake: false });
    void canRep;
    if (s.phase === 'prep') btn('start', 256, pt + 12, W - 268, 56, T('start'), { theme: 'green', size: 18 });
    else btn('start', 256, pt + 12, W - 268, 56, T('battle'), { theme: 'red', disabled: true, sub: T('left', s.enemies.length + Math.max(0, s.list.length - s.li)) });
    const bw = (W - 24 - 16) / 3, y = pt + 80;
    adBtn('ad_hint', 'hint', 12, y, bw, 46, T('hint'), '', true);
    adBtn('ad_undo', 'undo', 12 + bw + 8, y, bw, 46, T('undo'), '', C.canUndo(s));
    adBtn('ad_bonus', 'bonus', 12 + (bw + 8) * 2, y, bw, 46, T('bonus'), '+' + C.bonusCoins(s), true);
  }

  function drawHand(x, y, t, press) {
    const p = (Math.sin(t * 6) + 1) / 2;
    ctx.beginPath(); ctx.arc(x, y, 14 + p * 8, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,' + (0.8 - p * 0.6) + ')'; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, press ? 10 : 12, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(20,40,60,0.8)'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 3, y + 5); ctx.lineTo(x + 20, y + 14); ctx.lineTo(x + 14, y + 20); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill(); ctx.stroke();
  }
  function drawTutorial(t) {
    if (Save.d.tutDone || s.phase !== 'prep' || s.wave !== 1 || sel >= 0 || dragFrom >= 0) return;
    const pt = H - C.PANEL_H, h = C.hint(s);
    if (!h.buy) {
      const f = ((t * 0.55) % 1.6) / 1.6, e = ease(Math.min(1, f * 1.5));
      const ax = C.cellX(s, h.a), ay = C.cellY(s, h.a), bx = C.cellX(s, h.b), by = C.cellY(s, h.b);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(120,255,140,0.8)'; rrect(ax - 22, ay - 22, 44, 44, 9); ctx.stroke(); rrect(bx - 22, by - 22, 44, 44, 9); ctx.stroke();
      drawHand(ax + (bx - ax) * e, ay + (by - ay) * e, t, f < 0.7);
    } else if (s.coins >= C.buyCost(s) && C.freeCell(s) >= 0) drawHand(82, pt + 40, t, false);
    else drawHand(W - 62, pt + 40, t, false);
  }

  function drawBanner(dt) {
    if (!banner) return;
    banner.t -= dt;
    if (banner.t <= 0) { banner = null; return; }
    const a = Math.min(1, banner.t * 3, (banner.max - banner.t) * 4), pop = 1 + (1 - Math.min(1, (banner.max - banner.t) * 5)) * 0.3;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, 128); ctx.scale(pop, pop);
    txt(banner.text, 0, 0, 26, banner.color);
    if (banner.sub) txt(banner.sub, 0, 26, 14, '#fff', 'center', 'normal');
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---------- overlays + screens ----------
  function toggles(y, w) {
    const x = W / 2 - w / 2, d = Save.d.settings;
    btn('t_music', x, y, w, 44, T('music'), { theme: d.music ? 'green' : 'dark', sub: d.music ? T('on') : T('off') });
    btn('t_sfx', x, y + 56, w, 44, T('sfx'), { theme: d.sfx ? 'green' : 'dark', sub: d.sfx ? T('on') : T('off') });
    btn('t_vib', x, y + 112, w, 44, T('vibration'), { theme: d.vib ? 'green' : 'dark', sub: d.vib ? T('on') : T('off') });
  }
  function dim(a) { ctx.fillStyle = 'rgba(4,14,26,' + a + ')'; ctx.fillRect(0, 0, W, H); }

  function drawPause() {
    dim(0.62);
    const pw = 270, px = W / 2 - pw / 2, py = H / 2 - 190;
    panel(px, py, pw, 380);
    txt(T('paused'), W / 2, py + 34, 24, '#ffd35a');
    btn('resume', px + 20, py + 62, pw - 40, 50, T('resume'), { theme: 'green' });
    toggles(py + 128, pw - 40);
    btn('quit', px + 20, py + 304, pw - 40, 50, T('quit'), { theme: 'red' });
  }
  function drawResult() {
    dim(0.66);
    const pw = 288, px = W / 2 - pw / 2, ph = result.canRevive ? 392 : 330, py = H / 2 - ph / 2;
    panel(px, py, pw, ph);
    txt(result.won ? T('victory') : T('defeat'), W / 2, py + 38, 28, result.won ? '#ffd35a' : '#ff8a7a');
    txt(T('reached', result.wave), W / 2, py + 82, 16, '#fff', 'center', 'normal');
    txt(T('kills', result.kills), W / 2, py + 108, 15, '#cfe3f5', 'center', 'normal');
    txt(T('score', result.score), W / 2, py + 132, 15, '#cfe3f5', 'center', 'normal');
    txt(T('best', result.best), W / 2, py + 154, 13, '#9fb8cf', 'center', 'normal');
    ctx.font = 'bold 17px ' + FONT; const msg = T('earned', result.earned), tw = ctx.measureText(msg).width;
    coinIcon(W / 2 - tw / 2 - 12, py + 188, 9); txt(msg, W / 2 + 6, py + 188, 17, '#ffe38a');
    let y = py + 214;
    if (result.canRevive) { adBtn('ad_revive', 'revive', px + 20, y, pw - 40, 52, T('revive'), '50% HP', true); y += 64; }
    btn('again', px + 20, y, pw - 40, 50, T('again'), { theme: 'gold' }); y += 62;
    btn('menu', px + 20, y, pw - 40, 44, T('menu'), { theme: 'dark', size: 15 });
  }

  function drawMenu(t) {
    drawSea(t);
    const cx = W / 2;
    txt(T('title'), cx, 92, 38, '#ffd35a');
    txt(T('subtitle'), cx, 128, 15, '#e8f6ff', 'center', 'normal');
    const sp = G.sprites.hull;
    ctx.save(); ctx.translate(cx, 300 + Math.sin(t * 1.5) * 4); ctx.rotate(Math.sin(t * 1.1) * 0.03); ctx.scale(0.62, 0.62);
    ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h); ctx.restore();
    const demo = [[5, 1], [6, 2], [9, 3], [10, 5], [1, 4], [2, 6]];
    for (let i = 0; i < demo.length; i++) {
      const c = demo[i][0] & 3, r = demo[i][0] >> 2;
      const x = cx + (c - 1.5) * 46 * 0.62, y = 300 + (r - 1.5) * 46 * 0.62 + Math.sin(t * 1.5) * 4;
      G.put(ctx, G.sprites.cannon[demo[i][1]], x, y, (c < 2 ? Math.PI : 0) + Math.sin(t * 2 + i) * 0.25, false, 0.62);
    }
    G.put(ctx, G.sprites.sloop, 50 + Math.sin(t * 0.9) * 8, 220, Math.sin(t * 1.7) * 0.05, false, 0.9);
    G.put(ctx, G.sprites.shark, W - 56 + Math.sin(t * 1.1) * 8, 380, Math.sin(t * 1.9) * 0.06, true, 1);
    const by = Math.max(430, H - 210);
    btn('play', cx - 120, by, 240, 60, T('play'), { theme: 'gold', size: 24 });
    btn('upgrades', cx - 120, by + 74, 240, 48, T('upgrades'), { theme: 'blue', size: 16 });
    btn('settings', cx - 120, by + 134, 240, 44, T('settings'), { theme: 'dark', size: 15 });
    ctx.font = 'bold 14px ' + FONT;
    const m = String(Save.d.doubloons), tw = ctx.measureText(m).width;
    coinIcon(cx - tw / 2 - 10, H - 24, 8); txt(m, cx + 4, H - 24, 14, '#ffe38a');
    if (Save.d.bestWave) txt(T('bestWave', Save.d.bestWave), cx, H - 46, 12, '#cfe3f5', 'center', 'normal');
  }

  function drawUpgrades(t) {
    drawSea(t);
    txt(T('upgrades'), W / 2, 52, 26, '#ffd35a');
    ctx.font = 'bold 18px ' + FONT; const m = String(Save.d.doubloons), tw = ctx.measureText(m).width;
    coinIcon(W / 2 - tw / 2 - 12, 92, 10); txt(m, W / 2 + 6, 92, 18, '#ffe38a');
    const defs = [['hull', 'upHull', 'upHullDesc'], ['power', 'upPower', 'upPowerDesc'], ['loot', 'upLoot', 'upLootDesc']];
    for (let i = 0; i < 3; i++) {
      const k = defs[i][0], u = Save.UPS[k], lv = Save.d.ups[k], y = 122 + i * 108, x = 16, w = W - 32;
      panel(x, y, w, 96);
      txt(T(defs[i][1]), x + 14, y + 22, 17, '#fff', 'left');
      txt(T(defs[i][2], u.per * Math.max(1, lv)), x + 14, y + 46, 12, '#cfe3f5', 'left', 'normal');
      for (let p = 0; p < u.max; p++) { rrect(x + 14 + p * 22, y + 62, 18, 10, 3); ctx.fillStyle = p < lv ? '#ffd35a' : 'rgba(255,255,255,0.18)'; ctx.fill(); }
      const cost = Save.upCost(k);
      if (lv >= u.max) btn('up_' + k, x + w - 104, y + 22, 92, 50, T('maxed'), { theme: 'dark', disabled: true, size: 15 });
      else btn('up_' + k, x + w - 104, y + 22, 92, 50, '', { theme: 'gold', disabled: Save.d.doubloons < cost, sub: String(cost), subCoin: true, size: 15 });
      if (lv >= u.max) { /* label drawn by button */ } else { /* cost drawn by button sub */ }
      if (lv < u.max) { /* level label */ }
    }
    btn('back', W / 2 - 90, H - 76, 180, 50, T('back'), { theme: 'dark' });
  }
  function drawSettings(t) {
    drawSea(t);
    txt(T('settings'), W / 2, 70, 28, '#ffd35a');
    toggles(130, 240);
    btn('back', W / 2 - 90, 340, 180, 50, T('back'), { theme: 'dark' });
  }

  // ---------- input ----------
  function press(id) {
    Snd.play('click');
    switch (id) {
      case 'play': startGame(); break;
      case 'upgrades': screen = 'upgrades'; break;
      case 'settings': screen = 'settings'; break;
      case 'back': screen = 'menu'; break;
      case 'up_hull': case 'up_power': case 'up_loot': if (Save.buyUp(id.slice(3))) Snd.play('buy'); else Snd.play('error'); break;
      case 't_music': Save.d.settings.music = !Save.d.settings.music; applySettings(); break;
      case 't_sfx': Save.d.settings.sfx = !Save.d.settings.sfx; applySettings(); break;
      case 't_vib': Save.d.settings.vib = !Save.d.settings.vib; applySettings(); Snd.vibrate(30); break;
      case 'pause': overlay = 'pause'; break;
      case 'resume': overlay = null; break;
      case 'quit': Save.save(); toMenu(); break;
      case 'again': startGame(); break;
      case 'menu': toMenu(); break;
      case 'buy': { const i = C.buy(s); if (i >= 0) { sel = -1; if (!Save.d.tutDone) { /* tutorial advances on its own */ } } break; }
      case 'repair': C.repair(s); break;
      case 'start': if (C.startWave(s)) { sel = -1; hintData = null; } break;
      case 'ad_hint': Ad.show('hint', function () { hintData = C.hint(s); hintT = 8; Snd.play('reward'); }); break;
      case 'ad_undo': if (C.canUndo(s)) Ad.show('undo', function () { if (C.undo(s)) { sel = -1; Snd.play('move'); } }); break;
      case 'ad_bonus': Ad.show('bonus', function () { C.giveBonus(s); Snd.play('reward'); for (let q = 0; q < 6; q++) part(W / 2, H - 100, (Math.random() - 0.5) * 120, -80 - Math.random() * 60, 0.9, 5, 1, 1); }); break;
      case 'ad_revive': Ad.show('revive', function () { if (C.revive(s)) { overlay = null; result = null; Snd.setMode(s.boss ? 'boss' : 'play'); } }); break;
      default: break;
    }
  }
  function applySettings() { const d = Save.d.settings; Snd.config(d.sfx, d.music, d.vib); Save.save(); }

  function pos(e) { return { x: e.clientX / scale, y: e.clientY / scale }; }
  function hit(x, y) {
    for (let i = btns.length - 1; i >= 0; i--) { const b = btns[i]; if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h + 4) return b.id; }
    return null;
  }
  cv.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    Snd.unlock();
    const p = pos(e);
    const id = hit(p.x, p.y);
    if (id) { pressId = id; return; }
    if (screen === 'game' && !overlay && s && !Ad.isBusy() && (s.phase === 'prep' || s.phase === 'wave')) {
      const c = cellOf(p.x, p.y);
      downX = p.x; downY = p.y; dragX = p.x; dragY = p.y; dragMoved = false;
      if (c < 0) { sel = -1; return; }
      if (sel >= 0 && sel !== c) { C.tap(s, sel, c); sel = -1; hintData = null; return; }
      if (s.slots[c]) dragFrom = c; else sel = -1;
    }
  }, { passive: false });
  cv.addEventListener('pointermove', function (e) {
    if (dragFrom < 0) return;
    const p = pos(e); dragX = p.x; dragY = p.y;
    if (Math.hypot(p.x - downX, p.y - downY) > 10) dragMoved = true;
  });
  function up(e) {
    const p = pos(e);
    if (pressId) {
      const id = hit(p.x, p.y);
      const pid = pressId; pressId = null;
      if (id === pid && !(Ad.isBusy() && pid.indexOf('ad_') === 0)) press(pid);
      return;
    }
    if (dragFrom >= 0 && s) {
      const from = dragFrom; dragFrom = -1;
      if (dragMoved) {
        const c = cellOf(p.x, p.y);
        if (c >= 0 && c !== from) { C.tap(s, from, c); hintData = null; }
        sel = -1;
      } else sel = (sel === from) ? -1 : from;
    }
  }
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', function () { pressId = null; dragFrom = -1; });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (screen === 'game' && !overlay) overlay = 'pause'; Snd.suspend(); Save.saveNow(); } else Snd.resume();
  });
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  // ---------- main loop ----------
  let last = 0, acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    tAnim += dt;
    Ad.update();
    btns.length = 0;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    if (errShake > 0) errShake -= dt;
    if (screen === 'menu') drawMenu(tAnim);
    else if (screen === 'upgrades') drawUpgrades(tAnim);
    else if (screen === 'settings') drawSettings(tAnim);
    else if (screen === 'game' && s) {
      const run = !overlay && !Ad.isBusy();
      if (run) {
        const n = dt > 0.034 ? 2 : 1;
        for (let k = 0; k < n; k++) { C.update(s, dt / n); handleEvents(); }
        if (hintT > 0) hintT -= dt;
        if (flash > 0) flash = Math.max(0, flash - dt * 2.5);
        Snd.setMode(s.boss ? 'boss' : 'play');
      }
      drawSea(tAnim);
      drawWorld(tAnim);
      drawPreview(tAnim);
      drawStormFx(tAnim);
      drawParticles(run ? dt : 0);
      if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.7, flash * 0.6) + ')'; ctx.fillRect(0, 0, W, H); }
      drawHud(tAnim);
      drawPanel(tAnim);
      drawTutorial(tAnim);
      if (run) drawBanner(dt); else drawBanner(0);
      if (Ad.isBusy() && !overlay) dim(0.3);
      if (overlay === 'pause') drawPause();
      else if (overlay === 'result') drawResult();
      Snd.duck(!!overlay);
    }
  }

  // ---------- boot ----------
  G.init();
  Ad.init();
  resize();
  applySettings();
  Snd.setMode('menu');
  if (location.hash === '#debug') window.CM = { get s() { return s; }, startGame: startGame, C: C, press: press, set: function (k, v) { if (k === 'overlay') overlay = v; if (k === 'screen') screen = v; } };
  requestAnimationFrame(function (n) { last = n; frame(n); });
})();
