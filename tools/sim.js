// Balance simulation: bots play full runs and report how far they get.
// usage: node tools/sim.js [runs]   (exits non-zero if the sanity bounds are broken)
const C = require('../www/core.js');
const runs = parseInt(process.argv[2] || '8', 10);

function play(smart, seed, ups) {
  const s = C.create({ seed: seed, ups: ups });
  let t = 0, k = 0;
  while (s.phase !== 'won' && s.phase !== 'lost' && t < 3000) {
    C.update(s, 0.05); t += 0.05; k++;
    s.evN = 0;
    if (k % 6 === 0) C.bot(s, smart);
  }
  return { wave: s.wave, won: s.phase === 'won', secs: Math.round(t), kills: s.kills, lvl: s.maxLvl, hp: Math.round(s.hp) };
}
const out = {};
for (const smart of [false, true]) {
  const res = [];
  for (let i = 0; i < runs; i++) res.push(play(smart, 1000 + i * 37));
  const wins = res.filter(r => r.won).length;
  const waves = res.map(r => r.wave).sort((a, b) => a - b);
  console.log((smart ? 'smart ' : 'simple') + ' waves:', waves.join(' '), '| wins', wins + '/' + runs, '| median time', res.map(r => r.secs).sort((a, b) => a - b)[runs >> 1] + 's', '| max lvl', Math.max.apply(null, res.map(r => r.lvl)));
  out[smart ? 'smart' : 'simple'] = { waves: waves, wins: wins };
}
// an upgraded hull should not be worse than a fresh one
const up = [];
for (let i = 0; i < runs; i++) up.push(play(true, 1000 + i * 37, { hull: 3, power: 3, loot: 3 }).wave);
console.log('smart + upgrades waves:', up.sort((a, b) => a - b).join(' '));

// sanity bounds: game must be neither trivial nor impossible for a decent player (the smart bot)
let bad = 0;
const med = a => a[a.length >> 1];
if (med(out.smart.waves) < 5) { console.log('FAIL: smart bot median below wave 5 (too hard)'); bad++; }
if (out.smart.wins === runs) { console.log('FAIL: too easy (smart bot always wins)'); bad++; }
if (out.smart.wins === 0 && up.filter(w => w >= 10).length === 0) { console.log('FAIL: nobody can win (too hard)'); bad++; }
if (med(up) < med(out.smart.waves)) { console.log('FAIL: upgrades make things worse'); bad++; }
process.exit(bad ? 1 : 0);
