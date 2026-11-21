// Cannon Merge - all art is drawn by code. Sprites are pre-rendered once to offscreen canvases (2x), so the
// per-frame cost is a handful of drawImage calls.
(function (root) {
  'use strict';
  const S = 2;                       // sprite resolution multiplier
  const TAU = Math.PI * 2;
  const sprites = {};

  function mk(w, h, fn) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * S); c.height = Math.ceil(h * S);
    const x = c.getContext('2d'); x.scale(S, S);
    fn(x, w, h);
    return { c: c, w: w, h: h };
  }
  function rr(x, px, py, w, h, r) {
    x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath();
  }
  function lin(x, x0, y0, x1, y1, stops) {
    const g = x.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
    return g;
  }

  // ---------- the ship (top view, bow points up) ----------
  function hullPath(x, w, h, inset) {
    const i = inset, cx = w / 2;
    x.beginPath();
    x.moveTo(cx, 2 + i);
    x.bezierCurveTo(w * 0.80 - i, 34 + i, w - 4 - i, 96, w - 5 - i, 168);
    x.bezierCurveTo(w - 5 - i, 226, w - 18 - i, h - 24, w - 44 - i, h - 8 - i);
    x.lineTo(44 + i, h - 8 - i);
    x.bezierCurveTo(18 + i, h - 24, 5 + i, 226, 5 + i, 168);
    x.bezierCurveTo(4 + i, 96, w * 0.20 + i, 34 + i, cx, 2 + i);
    x.closePath();
  }
  function makeHull() {
    const w = 224, h = 316;
    return mk(w, h, function (x) {
      x.shadowColor = 'rgba(255,255,255,0.75)'; x.shadowBlur = 16;
      hullPath(x, w, h, 0); x.fillStyle = '#4a2c18'; x.fill();
      x.shadowBlur = 0; x.shadowColor = 'transparent';
      hullPath(x, w, h, 0); x.fillStyle = lin(x, 0, 0, w, 0, [0, '#5a3820', 0.5, '#7a4c2a', 1, '#5a3820']); x.fill();
      x.lineWidth = 3; x.strokeStyle = '#a06a3a'; x.stroke();
      // deck
      hullPath(x, w, h, 9); x.fillStyle = lin(x, 0, 0, w, 0, [0, '#a97a48', 0.5, '#c79a62', 1, '#a97a48']); x.fill();
      x.save(); hullPath(x, w, h, 9); x.clip();
      x.strokeStyle = 'rgba(70,40,15,0.28)'; x.lineWidth = 1;
      for (let i = 0; i < 12; i++) { x.beginPath(); x.moveTo(w / 2 + (i - 5.5) * 17, 0); x.lineTo(w / 2 + (i - 5.5) * 17, h); x.stroke(); }
      x.strokeStyle = 'rgba(70,40,15,0.12)';
      for (let j = 0; j < 20; j++) { x.beginPath(); x.moveTo(0, 10 + j * 16); x.lineTo(w, 10 + j * 16); x.stroke(); }
      x.restore();
      hullPath(x, w, h, 9); x.lineWidth = 2; x.strokeStyle = '#6b4222'; x.stroke();
      // 4x4 cannon grid
      const gx = w / 2, gy = h / 2;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const px = gx + (c - 1.5) * 46 - 20, py = gy + (r - 1.5) * 46 - 20;
        rr(x, px, py, 40, 40, 7); x.fillStyle = 'rgba(40,22,8,0.30)'; x.fill();
        x.lineWidth = 1.5; x.strokeStyle = 'rgba(255,235,200,0.28)'; x.stroke();
      }
      // bow: mast stub with furled sail
      x.fillStyle = '#5a3820'; rr(x, w / 2 - 26, 40, 52, 7, 3); x.fill();
      x.fillStyle = '#e9dcc0'; rr(x, w / 2 - 22, 41, 44, 5, 2); x.fill();
      x.beginPath(); x.arc(w / 2, 43.5, 8, 0, TAU); x.fillStyle = '#4a2c18'; x.fill();
      x.beginPath(); x.arc(w / 2, 43.5, 4, 0, TAU); x.fillStyle = '#8a5a30'; x.fill();
      // stern: cabin + wheel
      x.fillStyle = '#6b4222'; rr(x, w / 2 - 44, h - 62, 88, 30, 6); x.fill();
      x.fillStyle = '#8a5a30'; rr(x, w / 2 - 40, h - 59, 80, 8, 4); x.fill();
      x.fillStyle = '#ffd35a'; rr(x, w / 2 - 26, h - 46, 12, 9, 2); x.fill(); rr(x, w / 2 + 14, h - 46, 12, 9, 2); x.fill();
      x.beginPath(); x.arc(w / 2, h - 24, 6, 0, TAU); x.strokeStyle = '#3a2412'; x.lineWidth = 2; x.stroke();
    });
  }

  // ---------- cannons (barrel points +x) ----------
  function makeCannon(l) {
    return mk(46, 46, function (x) {
      x.translate(23, 23);
      x.fillStyle = '#4a2c18'; rr(x, -15, -12, 22, 24, 5); x.fill();
      x.fillStyle = '#7a4c2a'; rr(x, -13, -10, 18, 20, 4); x.fill();
      x.beginPath(); x.arc(-4, -13, 4, 0, TAU); x.arc(-4, 13, 4, 0, TAU); x.fillStyle = '#2b1a0c'; x.fill();
      const steel = lin(x, 0, -6, 0, 6, [0, '#c7ced8', 0.5, '#8e98a6', 1, '#5c6572']);
      if (l === 1) {
        x.fillStyle = steel; rr(x, -4, -5, 25, 10, 3); x.fill();
        x.fillStyle = '#3a414d'; rr(x, 17, -6.5, 5, 13, 2); x.fill();
      } else if (l === 2) {
        x.fillStyle = lin(x, 0, -9, 0, 9, [0, '#cfe9fb', 0.5, '#6fb4e8', 1, '#3d7fb0']);
        rr(x, -4, -10, 25, 8, 3); x.fill(); rr(x, -4, 2, 25, 8, 3); x.fill();
        x.fillStyle = '#2f5f86'; rr(x, 17, -11, 5, 10, 2); x.fill(); rr(x, 17, 1, 5, 10, 2); x.fill();
      } else if (l === 3) {
        x.fillStyle = lin(x, 0, -10, 0, 10, [0, '#f0c878', 0.5, '#c28a3c', 1, '#7d5420']);
        rr(x, -6, -10, 22, 20, 6); x.fill();
        x.beginPath(); x.arc(15, 0, 7, 0, TAU); x.fillStyle = '#2a1a0a'; x.fill();
        x.beginPath(); x.arc(15, 0, 4, 0, TAU); x.fillStyle = '#000'; x.fill();
        x.fillStyle = '#7d5420'; rr(x, -6, -12, 5, 24, 2); x.fill();
      } else if (l === 4) {
        x.fillStyle = '#ff9a4a'; x.beginPath(); x.arc(-8, -10, 5, 0, TAU); x.arc(-8, 10, 5, 0, TAU); x.fill();
        x.fillStyle = lin(x, 0, -6, 0, 6, [0, '#ffb070', 0.5, '#c4552b', 1, '#7a2c14']);
        rr(x, -6, -6, 22, 12, 4); x.fill();
        x.beginPath(); x.moveTo(15, -6); x.lineTo(23, -10); x.lineTo(23, 10); x.lineTo(15, 6); x.closePath();
        x.fillStyle = '#ffcf5a'; x.fill();
        x.beginPath(); x.arc(22, 0, 3.5, 0, TAU); x.fillStyle = '#fff3b0'; x.fill();
      } else if (l === 5) {
        x.fillStyle = lin(x, 0, -6, 0, 6, [0, '#e8fbff', 0.5, '#7fd8f5', 1, '#3f9cc4']);
        rr(x, -6, -6, 22, 12, 5); x.fill();
        x.beginPath(); x.moveTo(14, 0); x.lineTo(21, -8); x.lineTo(28, 0); x.lineTo(21, 8); x.closePath();
        x.fillStyle = '#e8fbff'; x.fill(); x.strokeStyle = '#4fb4de'; x.lineWidth = 1.5; x.stroke();
      } else {
        x.fillStyle = lin(x, 0, -6, 0, 6, [0, '#5a6080', 0.5, '#3a3f55', 1, '#22253a']);
        rr(x, -6, -6, 24, 12, 4); x.fill();
        x.fillStyle = '#ffe94a'; for (let i = 0; i < 3; i++) { rr(x, -1 + i * 6, -8, 3, 16, 1.5); x.fill(); }
        x.beginPath(); x.arc(19, 0, 5, 0, TAU); x.fillStyle = '#fff6a8'; x.fill();
        x.beginPath(); x.arc(19, 0, 8, 0, TAU); x.strokeStyle = 'rgba(255,233,74,0.5)'; x.lineWidth = 2; x.stroke();
      }
    });
  }

  // ---------- enemies (bow points +x) ----------
  function makeRow() {
    return mk(34, 20, function (x) {
      x.translate(17, 10);
      x.beginPath(); x.moveTo(16, 0); x.quadraticCurveTo(8, -9, -12, -7); x.lineTo(-15, 0); x.lineTo(-12, 7); x.quadraticCurveTo(8, 9, 16, 0);
      x.fillStyle = '#7a4a28'; x.fill(); x.lineWidth = 1.5; x.strokeStyle = '#4a2c18'; x.stroke();
      x.strokeStyle = '#d8c8a0'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(-2, -7); x.lineTo(3, -14); x.moveTo(-2, 7); x.lineTo(3, 14); x.stroke();
      x.beginPath(); x.arc(0, 0, 4.5, 0, TAU); x.fillStyle = '#f0c9a0'; x.fill();
      x.fillStyle = '#c0392b'; x.beginPath(); x.arc(0, 0, 4.5, Math.PI * 0.9, Math.PI * 2.1); x.fill();
    });
  }
  function makeSloop() {
    return mk(52, 28, function (x) {
      x.translate(26, 14);
      x.beginPath(); x.moveTo(24, 0); x.quadraticCurveTo(14, -12, -16, -10); x.lineTo(-22, -6); x.lineTo(-22, 6); x.lineTo(-16, 10); x.quadraticCurveTo(14, 12, 24, 0);
      x.fillStyle = '#5c3419'; x.fill(); x.lineWidth = 2; x.strokeStyle = '#2f1a0c'; x.stroke();
      x.beginPath(); x.moveTo(20, 0); x.quadraticCurveTo(12, -8, -14, -6.5); x.lineTo(-14, 6.5); x.quadraticCurveTo(12, 8, 20, 0);
      x.fillStyle = '#a8763f'; x.fill();
      x.fillStyle = '#e8dcc0'; x.beginPath(); x.moveTo(2, -11); x.quadraticCurveTo(7, 0, 2, 11); x.quadraticCurveTo(0, 0, 2, -11); x.fill();
      x.beginPath(); x.arc(2, 0, 3.5, 0, TAU); x.fillStyle = '#2f1a0c'; x.fill();
      x.fillStyle = '#1d1d1d'; x.beginPath(); x.moveTo(-16, -1); x.lineTo(-24, -3); x.lineTo(-24, 3); x.lineTo(-16, 1); x.fill(); // flag
      x.fillStyle = '#d33'; x.beginPath(); x.arc(-8, 0, 2, 0, TAU); x.fill();
    });
  }
  function makeGal() {
    return mk(76, 38, function (x) {
      x.translate(38, 19);
      x.beginPath(); x.moveTo(36, 0); x.quadraticCurveTo(24, -17, -26, -15); x.lineTo(-35, -9); x.lineTo(-35, 9); x.lineTo(-26, 15); x.quadraticCurveTo(24, 17, 36, 0);
      x.fillStyle = '#3d2412'; x.fill(); x.lineWidth = 2.5; x.strokeStyle = '#1b0f06'; x.stroke();
      x.beginPath(); x.moveTo(31, 0); x.quadraticCurveTo(22, -12, -26, -10.5); x.lineTo(-26, 10.5); x.quadraticCurveTo(22, 12, 31, 0);
      x.fillStyle = '#8a5a30'; x.fill();
      x.strokeStyle = '#e0b84a'; x.lineWidth = 2; x.beginPath(); x.moveTo(-24, -14); x.quadraticCurveTo(10, -16, 28, -4); x.moveTo(-24, 14); x.quadraticCurveTo(10, 16, 28, 4); x.stroke();
      [14, -4, -20].forEach(function (mx, i) {
        x.fillStyle = i === 1 ? '#c9b8e0' : '#2a2a3a'; x.beginPath(); x.moveTo(mx, -16); x.quadraticCurveTo(mx + 6, 0, mx, 16); x.quadraticCurveTo(mx - 2, 0, mx, -16); x.fill();
        x.beginPath(); x.arc(mx, 0, 3.5, 0, TAU); x.fillStyle = '#1b0f06'; x.fill();
      });
      x.fillStyle = '#e0b84a'; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(-16 + i * 9, -13, 1.8, 0, TAU); x.arc(-16 + i * 9, 13, 1.8, 0, TAU); x.fill(); }
      x.fillStyle = '#b8272d'; x.beginPath(); x.moveTo(-30, -2); x.lineTo(-40, -4); x.lineTo(-40, 4); x.lineTo(-30, 2); x.fill();
    });
  }
  function makeShark() {
    return mk(48, 22, function (x) {
      x.translate(24, 11);
      x.beginPath(); x.moveTo(22, 0); x.bezierCurveTo(14, -9, -8, -8, -16, -2); x.lineTo(-23, -8); x.lineTo(-21, 0); x.lineTo(-23, 8); x.lineTo(-16, 2); x.bezierCurveTo(-8, 8, 14, 9, 22, 0);
      x.fillStyle = lin(x, 0, -9, 0, 9, [0, '#8b9bab', 0.5, '#6d7e8f', 1, '#c7d3de']); x.fill(); x.lineWidth = 1.5; x.strokeStyle = '#3f4c59'; x.stroke();
      x.fillStyle = '#4d5b69'; x.beginPath(); x.moveTo(2, -6); x.lineTo(-5, -12); x.lineTo(-7, -5); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(2, 6); x.lineTo(-5, 12); x.lineTo(-7, 5); x.closePath(); x.fill();
      x.beginPath(); x.arc(14, -2.5, 1.7, 0, TAU); x.arc(14, 2.5, 1.7, 0, TAU); x.fillStyle = '#111'; x.fill();
      x.strokeStyle = '#fff'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(20, -1); x.lineTo(17, 0); x.lineTo(20, 1); x.stroke();
    });
  }
  function makeKraken() {
    return mk(140, 140, function (x) {
      x.translate(70, 70);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU + 0.2;
        x.save(); x.rotate(a);
        x.beginPath(); x.moveTo(22, -9); x.bezierCurveTo(48, -26, 60, 14, 64, -6); x.lineTo(66, 2); x.bezierCurveTo(60, 26, 44, -2, 22, 9); x.closePath();
        x.fillStyle = '#6b2f8f'; x.fill(); x.lineWidth = 2; x.strokeStyle = '#3d1856'; x.stroke();
        x.fillStyle = '#d9a8f0'; for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(32 + k * 8, -2 + (k % 2) * 3, 1.8, 0, TAU); x.fill(); }
        x.restore();
      }
      const g = x.createRadialGradient(-8, -10, 4, 0, 0, 38);
      g.addColorStop(0, '#b06ad4'); g.addColorStop(1, '#5a2480');
      x.beginPath(); x.arc(0, 0, 36, 0, TAU); x.fillStyle = g; x.fill(); x.lineWidth = 3; x.strokeStyle = '#3d1856'; x.stroke();
      x.fillStyle = 'rgba(60,20,90,0.35)'; [[-14, 12, 5], [10, 18, 4], [18, -14, 5], [-4, -22, 4]].forEach(function (p) { x.beginPath(); x.arc(p[0], p[1], p[2], 0, TAU); x.fill(); });
      [-13, 13].forEach(function (ex) {
        x.beginPath(); x.arc(ex, -4, 9, 0, TAU); x.fillStyle = '#fff3a8'; x.fill(); x.lineWidth = 2; x.strokeStyle = '#3d1856'; x.stroke();
        x.beginPath(); x.ellipse(ex + 1, -4, 2.6, 6, 0, 0, TAU); x.fillStyle = '#1a0a24'; x.fill();
      });
      x.strokeStyle = '#2a0f3a'; x.lineWidth = 3; x.beginPath(); x.moveTo(-14, -16); x.lineTo(-5, -12); x.moveTo(14, -16); x.lineTo(5, -12); x.stroke();
      x.beginPath(); x.moveTo(-12, 16); x.quadraticCurveTo(0, 24, 12, 16); x.strokeStyle = '#2a0f3a'; x.stroke();
    });
  }

  function makeWaveTile(seed, alpha) {
    return mk(160, 160, function (x) {
      let a = seed;
      const r = function () { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
      x.strokeStyle = 'rgba(255,255,255,' + alpha + ')'; x.lineWidth = 1.6; x.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        const px = r() * 160, py = r() * 160, w = 12 + r() * 16;
        for (let ox = -160; ox <= 160; ox += 160) for (let oy = -160; oy <= 160; oy += 160) {
          x.beginPath(); x.moveTo(px + ox - w, py + oy); x.quadraticCurveTo(px + ox - w / 2, py + oy - 5, px + ox, py + oy); x.quadraticCurveTo(px + ox + w / 2, py + oy + 5, px + ox + w, py + oy); x.stroke();
        }
      }
    });
  }

  const G = {
    S: S, TAU: TAU, sprites: sprites, rr: rr,
    init: function () {
      sprites.hull = makeHull();
      sprites.cannon = [null]; for (let l = 1; l <= 6; l++) sprites.cannon.push(makeCannon(l));
      sprites.row = makeRow(); sprites.sloop = makeSloop(); sprites.gal = makeGal(); sprites.shark = makeShark(); sprites.kraken = makeKraken();
      sprites.waveA = makeWaveTile(11, 0.20); sprites.waveB = makeWaveTile(97, 0.12);
    },
    // background: pre-rendered sea gradient at device resolution
    makeSea: function (pw, ph) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const x = c.getContext('2d');
      x.fillStyle = lin(x, 0, 0, 0, ph, [0, '#1c86ad', 0.5, '#126d99', 1, '#0a4a74']); x.fillRect(0, 0, pw, ph);
      const g = x.createRadialGradient(pw / 2, ph * 0.45, 10, pw / 2, ph * 0.45, Math.max(pw, ph) * 0.7);
      g.addColorStop(0, 'rgba(120,225,240,0.28)'); g.addColorStop(1, 'rgba(0,20,50,0.25)');
      x.fillStyle = g; x.fillRect(0, 0, pw, ph);
      return c;
    },
    // draw a sprite centred at (px,py); rot in radians, flip mirrors horizontally
    put: function (ctx, sp, px, py, rot, flip, scale) {
      const w = sp.w * (scale || 1), h = sp.h * (scale || 1);
      if (!rot && !flip) { ctx.drawImage(sp.c, px - w / 2, py - h / 2, w, h); return; }
      ctx.save(); ctx.translate(px, py);
      if (rot) ctx.rotate(rot);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(sp.c, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  };
  root.G = G;
})(this);
