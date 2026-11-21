// Cannon Merge - local progress + settings (localStorage, with a safe in-memory fallback).
(function (root) {
  'use strict';
  const KEY = 'cm_save_v1';
  const UPS = {
    hull:  { max: 5, costs: [30, 60, 100, 160, 240], per: 25 },   // +25 ship HP per level
    power: { max: 5, costs: [40, 80, 130, 200, 300], per: 6 },    // +6% cannon damage per level
    loot:  { max: 5, costs: [30, 60, 100, 160, 240], per: 8 }     // +8% coins per level
  };
  function fresh() {
    return {
      doubloons: 0, bestWave: 0, bestScore: 0, runs: 0, wins: 0, tutDone: false,
      ups: { hull: 0, power: 0, loot: 0 },
      settings: { music: true, sfx: true, vib: true }
    };
  }
  let d = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const j = JSON.parse(raw), f = fresh();
      d = Object.assign(f, j);
      d.ups = Object.assign(f.ups, j.ups || {});
      d.settings = Object.assign(f.settings, j.settings || {});
    }
  } catch (e) { /* ignore: fresh save */ }

  let timer = 0;
  function write() {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
  }
  const Save = {
    d: d, UPS: UPS,
    save: function () { clearTimeout(timer); timer = setTimeout(write, 150); },
    saveNow: write,
    upCost: function (k) { const u = UPS[k], l = d.ups[k]; return l >= u.max ? 0 : u.costs[l]; },
    buyUp: function (k) {
      const u = UPS[k], l = d.ups[k], c = Save.upCost(k);
      if (l >= u.max || d.doubloons < c) return false;
      d.doubloons -= c; d.ups[k] = l + 1; write(); return true;
    },
    // called once when a run ends; returns doubloons earned
    finishRun: function (wave, score, won) {
      const earned = Math.round(wave * 6 + score / 25 + (won ? 60 : 0));
      d.doubloons += earned; d.runs++; if (won) d.wins++;
      if (wave > d.bestWave) d.bestWave = wave;
      if (score > d.bestScore) d.bestScore = score;
      write();
      return earned;
    }
  };
  root.Save = Save;
})(this);
