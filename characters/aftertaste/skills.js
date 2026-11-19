// AFTERTASTE skills. 4-hit COMBO (press ATK again to keep going). Poses for each step live in STEPS in art.js (same order).
//   1 HOOK bash (side swing)   2 CLEAVER chop (overhead)   3 CLEAVER scoop (rising cut out of the floor)   4 HOOK slam (overhead finisher, big knockback)
// time = swing length, cd = wait before the next hit, hitFrom/hitTo = hit window (time left on the swing; p = 1 - hitFrom/time .. 1 - hitTo/time, keep it inside STEPS[n].snap).
// root = feet planted. lunge/lungeP = step in at that swing progress. dmg = damage multiplier, kbx/kby = knockback multiplier (hits 1-3 keep the enemy close for the next hit).
Characters.skills('aftertaste', {
  basic: {desc:'Tap ATK again to keep the combo going: hook bash, cleaver chop, cleaver scoop (pops them up a little), then a hook slam finisher with big knockback. Every hit steps him forward.', time: .5, cd: .36, reach: 46, root: true, noSlash: true, hitFrom: .21, hitTo: .08, dmg: 1, hitstop: .06, shake: 1,
    combo: [
      {time: .5,  cd: .36, reach: 46, hitFrom: .21, hitTo: .08, dmg: .9,  kbx: .45, kby: .25, lunge: 70, lungeP: .55, hitstop: .06, shake: 1},                  // 1 hook bash
      {time: .62, cd: .42, reach: 46, hitFrom: .21, hitTo: .07, dmg: 1.1, kbx: .5,  kby: .25, lunge: 50, lungeP: .55, hitstop: .08, shake: 1.2},                 // 2 cleaver chop
      {time: .55, cd: .38, reach: 48, hitFrom: .27, hitTo: .12, dmg: 1.0, kbx: .4,  kby: .9,  lunge: 50, lungeP: .55, hitstop: .07, shake: 1},                   // 3 cleaver scoop (pops the enemy up a little)
      {time: .8,  cd: .65, reach: 52, hitFrom: .28, hitTo: .1,  dmg: 1.7, kbx: 1.3, kby: 1.0, lunge: 90, lungeP: .55, hitstop: .13, shake: 1.9, stunx: 1.4}      // 4 hook slam
    ]
  },
  // PASSIVE - Fresh Meat: every landed hit (basic punches AND skills) puts 1 Meat Mark on that enemy (red pips over their head). At `marks` marks they are WOUNDED:
  //   they bleed `dps` x their max HP per second for `dur` seconds (hitting again while wounded refreshes the bleed). Marks are per enemy and do not fade.
  passive: {desc:'Every hit he lands puts a Meat Mark on the enemy. At full marks they are WOUNDED and bleed for a few seconds. Hitting them again refreshes the bleed.', name:'FRESH MEAT', kind:'marks', marks:5, dps:.03, dur:4},
  // HELD KEY - VILE OFFERING: HOLD the ATK button (about `after` s, a quick tap still does the normal combo). He gags, then vomits acid for `time` s. Keep holding = he vomits again and again.
  //   Every COMPLETED vomit leaves ONE puddle in front of him (let go early = nothing). `ranges` = how far in front of him each vomit of the same hold lands (px). All 22 = every puddle lands right under his mouth where he stands, so 3 vomits stack on ONE spot (each puddle does its own damage). Raise a value to spread that one out again. Max `max` puddles: a new one removes the oldest. They stay until replaced.
  //   An enemy standing in a puddle takes `dps` x THEIR max HP per second and moves `slow` slower (0.35 = 35%). A jump over a puddle is safe. His own puddles never hurt him. He is rooted while vomiting.
  hold: {desc:'HOLD ATK: he gags, then vomits acid at his feet. Each finished vomit leaves a puddle (he keeps 3, the oldest is replaced). Plant all three in the same spot to stack the damage. Enemies standing in it burn and are slowed; a jump over it is safe. Let go early and no puddle lands.', name:'VILE OFFERING', kind:'vomit', after:.22, time:.9, ranges:[22, 22, 22], w:96, max:3, dps:.025, slow:.35},
  skills: [
    // I - MEAT HOOK: aim:true (drag the button). Instant. The hook flies `speed` px/s up to `range` px along the aim and stops at the first enemy: damage + pulls them next to him (`pull` px/s,
    //     then `endStun` s stunned so he can follow up). kbx/kby stay 0 (the pull is the knockback). A miss goes to max range and comes back. cd = cooldown (not given in the design yet).
    {desc:'Drag to aim, release to throw. The hook stops at the first enemy and yanks them right next to him, stunned for a moment so he can follow up. A miss flies to full range and comes back.', name:'MEAT HOOK', kind:'hook', aim:true, cd:10, time:.3, range:380, speed:1500, pull:1100, r:10, dmg:.8, kbx:0, kby:0, endStun:.35, shake:.5, hitstop:.04},
    // II - PUTRID STENCH: a TOGGLE, no aim, no duration. Press = cloud ON (follows him), press again = OFF. Enemies inside `radius` px take `dps` x THEIR max HP per second and move `slow` slower (0.4 = 40%).
    //      He can move freely, but loses `selfDps` x HIS max HP per second while it is ON, and if that reaches 0 HP he dies. cd = cooldown that starts when he turns it OFF. cast = short cast pose (s).
    {desc:'Press to switch a rotting cloud on around him, press again to switch it off. Enemies inside take damage and are slowed. He can move freely, but the rot eats HIS health while it is on, and it can kill him. The cooldown starts when he turns it off.', name:'PUTRID STENCH', kind:'stench', toggle:true, aim:false, cd:8, cast:.45, radius:130, dps:.03, slow:.4, selfDps:.02}
  ],
  // ULTIMATE - SLAUGHTERHOUSE: only casts when the enemy is CLOSE (grab px). Too far = nothing happens and the cooldown is kept.
  // Animation: the hook chain flies out and wraps the enemy (deploy s), drags them in front of him (pull s), then he chops and bites them for `duration` s. Then he heals `heal` x max HP.
  // hits = damage beats. p = when it lands (0..1 of the whole animation; matches the poses in art.js: slam .18, chops .32 / .40 / .475, hook tear .64, bites .72 / .83).
  // dmg = damage multiplier (same formula as the basic attack). hold = how far in front of him the enemy is held (px).
  ultimate: {desc:'Only works when the enemy is close. The chain wraps them and drags them in, then he chops and bites for a few seconds and heals himself. Too far away = nothing happens and the cooldown is kept.', name:'SLAUGHTERHOUSE', kind:'slaughterhouse', aim:false, cd:55, grab:95, deploy:.24, pull:.38, hold:46, duration:3, heal:.30,
    hits:[
      {p:.18,  dmg:.5},                // hook yank / slam
      {p:.32,  dmg:.55}, {p:.40, dmg:.55}, {p:.475, dmg:.55},   // chop + chomp, chop + chomp, chop + chomp
      {p:.64,  dmg:.6},                // hook tear
      {p:.72,  dmg:.7}, {p:.83, dmg:.8, shake:2, hitstop:.08}   // the big bites
    ]}
});