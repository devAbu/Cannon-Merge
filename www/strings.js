// All user-visible text lives here. To translate: copy this object, translate the values, switch STR.
// Placeholders: {0}, {1} ... are filled by T(key, a, b).
(function (root) {
  'use strict';
  const STR = {
    title: 'Cannon Merge',
    subtitle: 'Merge cannons. Rule the sea.',
    play: 'Play',
    upgrades: 'Hull Upgrades',
    settings: 'Settings',
    back: 'Back',
    resume: 'Resume',
    quit: 'Quit',
    paused: 'Paused',
    menu: 'Menu',
    again: 'Sail again',
    music: 'Music',
    sfx: 'Effects',
    vibration: 'Vibration',
    on: 'ON',
    off: 'OFF',
    wave: 'Wave {0}/{1}',
    waveShort: 'Wave {0}',
    buy: 'Cannon',
    repair: 'Repair',
    full: 'Full',
    start: 'Sail!',
    battle: 'Battle!',
    hint: 'Hint',
    undo: 'Undo',
    bonus: 'Coins',
    revive: 'Revive',
    watch: 'Ad',
    ready: 'Ready',
    left: '{0} left',
    stormWarn: 'STORM INCOMING!',
    stormHit: 'STORM!',
    stormTip: 'Cannons shoot their own side',
    boss: 'KRAKEN!',
    victory: 'Victory!',
    defeat: 'Ship Sunk',
    reached: 'Reached wave {0}',
    kills: 'Enemies sunk: {0}',
    score: 'Score: {0}',
    best: 'Best: {0}',
    earned: '+{0} doubloons',
    doubloons: 'Doubloons',
    maxed: 'MAX',
    lvl: 'Lv {0}/{1}',
    upHull: 'Hull Plating',
    upHullDesc: '+{0} ship HP',
    upPower: 'Powder Kegs',
    upPowerDesc: '+{0}% cannon damage',
    upLoot: 'Plunder',
    upLootDesc: '+{0}% coins',
    bestWave: 'Best wave: {0}',
    cannons: ['', 'Cannon', 'Twin Cannon', 'Mortar', 'Flamer', 'Frost Cannon', 'Storm Cannon'],
    enemies: { row: 'Rowboat', sloop: 'Sloop', shark: 'Shark', gal: 'Galleon', kraken: 'Kraken' }
  };
  function T(key) {
    let v = STR[key];
    if (typeof v !== 'string') return key;
    for (let i = 1; i < arguments.length; i++) v = v.split('{' + (i - 1) + '}').join(String(arguments[i]));
    return v;
  }
  root.STR = STR;
  root.T = T;
})(this);
