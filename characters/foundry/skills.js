// FOUNDRY skills. APPEARANCE + one tuned basic attack. No skill slots, passive, ultimate or hold attack yet.
// BASIC = the HEAVY SMASH. The swing is SLOW on purpose: time = 1.4 s. art.js attack() animates it by progress p (0..1 of `time`):
//   0 - .42 lift the hammer behind his back   .42 - .6 hold (the TURBO on the hammer back spools up)   .6 - .7 slam (turbo blasts)   .7 - .82 hammer in the floor   .82 - 1 drag it back up
// hitFrom / hitTo = seconds LEFT on the swing while it can hit:  1.4 x (1 - .62) = .53  ->  1.4 x (1 - .8) = .28  (the slam + the impact only)
// reach = hit box length in px.  root = feet stay planted while swinging.  dmg / kbx / kby = damage + knockback multipliers.
// noShake:true = NO screen shake (the earthquake is removed). To get shake back: delete noShake and add shake:2.5.
// TUNE HERE: time (speed), dmg (the main balance knob), reach.  If you change `time`, the animation scales with it, and hitFrom / hitTo must stay at the same % of it.
Characters.skills('foundry', {
  basic: {time:1.4, cd:.9, reach:78, root:true, hitFrom:.53, hitTo:.28, dmg:2, kbx:.8, kby:.35, noShake:true, hitstop:.12, noSlash:true}
});
