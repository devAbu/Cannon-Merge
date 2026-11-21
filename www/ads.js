// Cannon Merge - AdService: the ONLY place that knows about ads.
// Right now it SIMULATES a rewarded video (countdown on the button -> reward -> cooldown).
// To use real AdMob later, keep this public API and replace the bodies of init(), show() and update():
//   init():  initialise the AdMob plugin and preload one rewarded ad per placement.
//   show():  call the plugin's showRewarded(); when it reports "rewarded" call the callback (once).
//   update(): not needed with a real SDK (events arrive from the plugin) - leave it empty.
// The game only uses: AdService.status(p), AdService.show(p, cb), AdService.update(), AdService.isBusy().
// Placements: 'hint', 'undo', 'bonus', 'revive'.
(function (root) {
  'use strict';
  const SIM_SECONDS = 3;                                    // length of the fake ad
  const COOLDOWN = { hint: 25, undo: 20, bonus: 90, revive: 0 }; // seconds between uses
  let cur = null;
  const readyAt = {};
  const now = function () { return (typeof performance !== 'undefined' ? performance.now() : Date.now()); };

  const AdService = {
    init: function () { /* real SDK: initialise here */ },
    isBusy: function () { return !!cur; },
    // -> { state: 'ready' | 'playing' | 'cooldown', remain: seconds }
    status: function (p) {
      if (cur) return cur.p === p ? { state: 'playing', remain: Math.max(0, SIM_SECONDS - (now() - cur.t0) / 1000) } : { state: 'cooldown', remain: 0 };
      const r = (readyAt[p] || 0) - now();
      return r > 0 ? { state: 'cooldown', remain: r / 1000 } : { state: 'ready', remain: 0 };
    },
    show: function (p, onReward) {
      if (cur || AdService.status(p).state !== 'ready') return false;
      cur = { p: p, t0: now(), cb: onReward };
      return true;
    },
    update: function () {
      if (cur && now() - cur.t0 >= SIM_SECONDS * 1000) {
        const c = cur; cur = null;
        readyAt[c.p] = now() + (COOLDOWN[c.p] || 0) * 1000;
        if (c.cb) c.cb();
      }
    }
  };
  root.AdService = AdService;
})(this);
