// Cannon Merge - procedural sound (Web Audio, no files) + vibration. Works fully offline.
(function (root) {
  'use strict';
  let ctx = null, master = null, sfxBus = null, musBus = null, noiseBuf = null, delay = null;
  let sfxOn = true, musicOn = true, vibOn = true, mode = 'off', ducked = false;
  let timer = null, nextTime = 0, step = 0, active = 0;
  const last = {};
  const midi = function (n) { return 440 * Math.pow(2, (n - 69) / 12); };

  function init() {
    if (ctx) return true;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 1 : 0; sfxBus.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = musicOn ? 0.3 : 0; musBus.connect(master);
    delay = ctx.createDelay(1); delay.delayTime.value = 0.32;
    const fb = ctx.createGain(); fb.gain.value = 0.3; const dl = ctx.createGain(); dl.gain.value = 0.3;
    delay.connect(fb); fb.connect(delay); delay.connect(dl); dl.connect(musBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function tone(o) {
    const t = o.t !== undefined ? o.t : ctx.currentTime;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.gain, t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g);
    let out = g;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); out = f; }
    out.connect(o.dest || sfxBus);
    osc.start(t); osc.stop(t + o.dur + 0.05);
  }
  function noise(o) {
    const t = o.t !== undefined ? o.t : ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.filter || 'bandpass'; f.frequency.value = o.freq || 1000; f.Q.value = o.q || 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(o.gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(o.dest || sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + o.dur + 0.05);
  }
  function gate(name, gap) {
    const n = ctx.currentTime;
    if (last[name] && n - last[name] < gap) return false;
    last[name] = n; return true;
  }

  const SFX = {
    click: function () { tone({ type: 'triangle', f0: 1300, f1: 900, dur: 0.04, gain: 0.07 }); },
    error: function () { tone({ type: 'square', f0: 170, f1: 120, dur: 0.13, gain: 0.06, lp: 900 }); },
    buy: function () { const t = ctx.currentTime; tone({ type: 'triangle', f0: midi(72), dur: 0.1, gain: 0.12, t: t }); tone({ type: 'triangle', f0: midi(79), dur: 0.15, gain: 0.12, t: t + 0.07 }); },
    move: function () { tone({ type: 'sine', f0: 520, f1: 700, dur: 0.06, gain: 0.07 }); },
    merge: function (lvl) {
      const t = ctx.currentTime, base = 58 + (lvl || 2) * 2;
      [0, 4, 7, 12].forEach(function (n, i) {
        tone({ type: 'triangle', f0: midi(base + n), dur: 0.22, gain: 0.12, t: t + i * 0.055 });
        tone({ type: 'sine', f0: midi(base + n + 12), dur: 0.16, gain: 0.05, t: t + i * 0.055 });
      });
      noise({ t: t, dur: 0.16, gain: 0.05, filter: 'highpass', freq: 5000 });
    },
    repair: function () { const t = ctx.currentTime; [60, 64, 67].forEach(function (n, i) { tone({ type: 'sine', f0: midi(n), dur: 0.16, gain: 0.09, t: t + i * 0.07 }); }); noise({ dur: 0.1, gain: 0.05, filter: 'bandpass', freq: 1500 }); },
    coin: function () { if (!gate('coin', 0.05)) return; tone({ type: 'sine', f0: 1320, f1: 1780, dur: 0.08, gain: 0.04 }); },
    shot1: function () { if (!gate('s1', 0.06)) return; noise({ dur: 0.12, gain: 0.07, filter: 'lowpass', freq: 800 }); tone({ type: 'sine', f0: 140, f1: 55, dur: 0.14, gain: 0.13 }); },
    shot3: function () { if (!gate('s3', 0.1)) return; tone({ type: 'sine', f0: 110, f1: 38, dur: 0.3, gain: 0.2 }); noise({ dur: 0.2, gain: 0.1, filter: 'lowpass', freq: 600 }); },
    shot4: function () { if (!gate('s4', 0.09)) return; noise({ dur: 0.14, gain: 0.05, filter: 'bandpass', freq: 1400, q: 0.6 }); },
    shot5: function () { if (!gate('s5', 0.08)) return; tone({ type: 'sine', f0: 1500, f1: 700, dur: 0.14, gain: 0.07 }); tone({ type: 'triangle', f0: 2200, f1: 1200, dur: 0.1, gain: 0.03 }); },
    shot6: function () { if (!gate('s6', 0.1)) return; noise({ dur: 0.18, gain: 0.1, filter: 'highpass', freq: 3000 }); tone({ type: 'sawtooth', f0: 900, f1: 90, dur: 0.18, gain: 0.07, lp: 2500 }); },
    hit: function () { if (!gate('hit', 0.04)) return; noise({ dur: 0.06, gain: 0.06, filter: 'bandpass', freq: 900 }); },
    splash: function () { if (!gate('spl', 0.08)) return; noise({ dur: 0.35, gain: 0.12, filter: 'lowpass', freq: 700 }); tone({ type: 'sine', f0: 90, f1: 40, dur: 0.3, gain: 0.15 }); },
    kill: function () { if (!gate('kill', 0.04)) return; tone({ type: 'sine', f0: 700, f1: 260, dur: 0.12, gain: 0.07 }); noise({ dur: 0.1, gain: 0.04, filter: 'lowpass', freq: 1200 }); },
    bossKill: function () { tone({ type: 'sawtooth', f0: 220, f1: 35, dur: 1.1, gain: 0.2, lp: 700 }); noise({ dur: 0.9, gain: 0.16, filter: 'lowpass', freq: 800 }); },
    enemyShot: function () { if (!gate('es', 0.08)) return; noise({ dur: 0.09, gain: 0.04, filter: 'lowpass', freq: 600 }); },
    shipHit: function () { if (!gate('sh', 0.08)) return; tone({ type: 'sine', f0: 100, f1: 45, dur: 0.22, gain: 0.2 }); noise({ dur: 0.18, gain: 0.1, filter: 'lowpass', freq: 500 }); },
    bite: function () { if (!gate('bite', 0.1)) return; tone({ type: 'sawtooth', f0: 200, f1: 90, dur: 0.1, gain: 0.07, lp: 700 }); },
    wave: function () { const t = ctx.currentTime; tone({ type: 'sawtooth', f0: midi(50), dur: 0.5, gain: 0.07, lp: 700, attack: 0.05, t: t }); tone({ type: 'sawtooth', f0: midi(57), dur: 0.6, gain: 0.07, lp: 700, attack: 0.05, t: t + 0.25 }); },
    clear: function () { const t = ctx.currentTime; [62, 66, 69, 74].forEach(function (n, i) { tone({ type: 'triangle', f0: midi(n), dur: 0.25, gain: 0.1, t: t + i * 0.09 }); }); },
    stormWarn: function () { const t = ctx.currentTime; for (let i = 0; i < 3; i++) tone({ type: 'square', f0: i % 2 ? 480 : 360, dur: 0.22, gain: 0.06, lp: 1300, t: t + i * 0.27 }); },
    thunder: function () { noise({ dur: 1.6, gain: 0.25, filter: 'lowpass', freq: 380 }); tone({ type: 'sawtooth', f0: 60, f1: 30, dur: 1.4, gain: 0.15, lp: 300 }); },
    shuffle: function () { const t = ctx.currentTime; for (let i = 0; i < 5; i++) tone({ type: 'triangle', f0: 400 + Math.random() * 500, dur: 0.07, gain: 0.07, t: t + i * 0.05 }); },
    boss: function () { const t = ctx.currentTime; tone({ type: 'sawtooth', f0: 70, f1: 46, dur: 1.5, gain: 0.2, lp: 500, attack: 0.1, t: t }); tone({ type: 'sawtooth', f0: 74, f1: 49, dur: 1.5, gain: 0.15, lp: 500, attack: 0.1, t: t }); noise({ t: t, dur: 1.1, gain: 0.08, filter: 'lowpass', freq: 400 }); },
    slam: function () { tone({ type: 'sine', f0: 90, f1: 28, dur: 0.5, gain: 0.3 }); noise({ dur: 0.45, gain: 0.2, filter: 'lowpass', freq: 500 }); },
    win: function () { const t = ctx.currentTime; [60, 64, 67, 72, 76, 79].forEach(function (n, i) { tone({ type: 'triangle', f0: midi(n), dur: 0.35, gain: 0.11, t: t + i * 0.1 }); }); },
    lose: function () { const t = ctx.currentTime; [69, 65, 62, 57].forEach(function (n, i) { tone({ type: 'triangle', f0: midi(n), dur: 0.5, gain: 0.11, t: t + i * 0.3, lp: 1500 }); }); },
    reward: function () { const t = ctx.currentTime; [72, 76, 79, 84].forEach(function (n, i) { tone({ type: 'sine', f0: midi(n), dur: 0.2, gain: 0.09, t: t + i * 0.07 }); }); }
  };

  // ---- music: a rolling minor-key shanty feel (D minor, 4 bars) ----
  const BPM = 112, STEP = 60 / BPM / 4;
  const PROG = [{ r: 38, t: [57, 62, 65] }, { r: 34, t: [58, 62, 65] }, { r: 41, t: [57, 60, 65] }, { r: 33, t: [57, 61, 64] }];
  const MEL = (function () {
    const m = new Array(64).fill(0);
    [[0, 74], [4, 77], [6, 76], [8, 74], [12, 72], [16, 70], [20, 74], [22, 72], [24, 70], [28, 69], [32, 72], [36, 77], [38, 76], [40, 72], [44, 69], [48, 68], [52, 73], [54, 74], [56, 76], [60, 73]]
      .forEach(function (p) { m[p[0]] = p[1]; });
    return m;
  })();
  function sched(st, t) {
    const lvl = mode === 'menu' ? 0 : mode === 'boss' ? 2 : 1;
    const bar = st >> 4, b = st & 15, ch = PROG[bar];
    if (b === 0) ch.t.forEach(function (n, i) { tone({ type: 'sawtooth', f0: midi(n), dur: STEP * 16 + 0.4, gain: lvl ? 0.016 : 0.028, attack: 0.5, t: t, dest: musBus, lp: 600 }); void i; });
    if (b % 8 === 0 || (lvl && b % 8 === 4)) tone({ type: 'triangle', f0: midi(b % 8 === 0 ? ch.r : ch.r + 7), dur: STEP * 3, gain: 0.15, t: t, dest: musBus, lp: 450 });
    if (lvl) {
      if (b === 0 || b === 8) tone({ type: 'sine', f0: 130, f1: 42, dur: 0.15, gain: 0.26, t: t, dest: musBus });
      if (b === 4 || b === 12) noise({ t: t, dur: 0.1, gain: 0.05, filter: 'bandpass', freq: 1800, q: 0.9, dest: musBus });
      if (lvl === 2 && b % 2 === 0) noise({ t: t, dur: 0.03, gain: 0.03, filter: 'highpass', freq: 7000, dest: musBus });
    }
    if (b % 2 === 0 && lvl >= 0) {
      const g = ctx.createGain(); g.connect(musBus); g.connect(delay);
      tone({ type: 'triangle', f0: midi(ch.t[(b >> 1) % 3] + 12), dur: STEP * 1.8, gain: lvl ? 0.04 : 0.05, t: t, dest: g, lp: 2200 });
    }
    if (lvl && MEL[st]) {
      const g = ctx.createGain(); g.connect(musBus); g.connect(delay);
      tone({ type: 'sawtooth', f0: midi(MEL[st]), dur: STEP * 3, gain: 0.04, t: t, dest: g, attack: 0.02, lp: 1800 });
    }
  }
  function tick() {
    if (!ctx || !musicOn || mode === 'off' || ctx.state !== 'running') return;
    while (nextTime < ctx.currentTime + 0.3) { sched(step, nextTime); nextTime += STEP; step = (step + 1) % 64; }
  }
  function applyGains() {
    if (!ctx) return;
    const t = ctx.currentTime;
    sfxBus.gain.setTargetAtTime(sfxOn ? 1 : 0, t, 0.03);
    musBus.gain.setTargetAtTime(musicOn ? (ducked ? 0.1 : 0.3) : 0, t, 0.15);
  }
  function refreshMusic() {
    if (!ctx) return;
    if (musicOn && mode !== 'off') { if (!timer) { nextTime = ctx.currentTime + 0.08; timer = setInterval(tick, 50); } }
    else if (timer) { clearInterval(timer); timer = null; }
    applyGains();
  }

  const Snd = {
    config: function (sfx, music, vib) { sfxOn = sfx; musicOn = music; vibOn = vib; applyGains(); refreshMusic(); },
    unlock: function () { if (!init()) return; if (ctx.state !== 'running') { try { ctx.resume(); } catch (e) { /* ignore */ } } refreshMusic(); },
    play: function (name, a) {
      if (!sfxOn || !ctx || ctx.state !== 'running') return;
      if (active > 14) return;
      const f = SFX[name]; if (!f) return;
      active++; setTimeout(function () { active--; }, 300);
      f(a);
    },
    setMode: function (m) { if (m === mode) return; mode = m; refreshMusic(); },
    duck: function (d) { if (d !== ducked) { ducked = d; applyGains(); } },
    suspend: function () { if (ctx && ctx.state === 'running') { try { ctx.suspend(); } catch (e) { /* ignore */ } } },
    resume: function () { if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* ignore */ } } },
    vibrate: function (ms) { if (vibOn && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } } }
  };
  root.Snd = Snd;
})(this);
