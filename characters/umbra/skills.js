// UMBRA - The Abyssal Sovereign. Basic attack = VOID PROJECTILES (long range). He shoots dark energy spheres from his hands.
//   1 = LEFT hand sphere   2 = RIGHT hand sphere   3 = BOTH hands join into ONE BIGGER sphere (knocks up).
// Press ATK again to keep the combo going. He stays planted (root) while casting.
// HOLD ATK = VOID ORB (charge): after the coil he freezes (chargeP = .3, must match CP in art.js), both hands go above his head and a dark sphere grows. While charging he can still walk SLOWLY (chargeMove = fraction
//   of his move speed; 0 / missing = planted). chargeMin / chargeMax = seconds held for 0% / 100% charge (a hold shorter than ~.15 s is a tap = the normal combo; between that and chargeMin = a small weak orb).
//   Let go = he throws it (chargeShot). chargeShot = {p (when it leaves the hands, swing progress, .5), hand, rMin..rMax (radius at 0%..100% charge), speed, life, dmg (x (1 + dmgGrow x charge)), kbx, kby, stunx, shake, hitstop,
//   slow (0.4 = 40% slower), slowMin..slowMax (seconds of slow at 0%..100% charge), explode (explosion size: hit radius grows by r x explode x .5 and the burst is that big)}.
// shot = {p, hand, r, speed, life}: p = swing progress when the sphere leaves the hand (MUST match C in art.js: .50, .50, .525),
//   hand = 'N' left (near) / 'F' right (far) / 'B' both, r = sphere radius px, speed = px/s, life = seconds it flies (speed x life = range).
// hitFrom:0 hitTo:0 = no melee box, only the sphere hits. dmg / kbx / kby / stunx work like a melee hit. TUNE HERE: dmg, speed, r.
Characters.skills('umbra', {
  basic: {time:.5, cd:.4, root:true, noSlash:true, hitFrom:0, hitTo:0, dmg:.7,
    chargeP:.3, chargeMin:.2, chargeMax:1.2, chargeMove:.35,
    chargeShot: {p:.5, hand:'B', rMin:14, rMax:40, speed:480, life:2.1, dmg:1.2, dmgGrow:1.6, kbx:.6, kby:.9, stunx:1.6, shake:2.5, hitstop:.12, slow:.4, slowMin:1.0, slowMax:3.0, explode:1.2},
    combo: [
      {time:.5,  cd:.4,  hitFrom:0, hitTo:0, dmg:.7,  kbx:.3,  kby:.2,  shot:{p:.5,   hand:'N', r:9,  speed:560, life:1.5}},   // 1 left sphere
      {time:.5,  cd:.4,  hitFrom:0, hitTo:0, dmg:.7,  kbx:.3,  kby:.2,  shot:{p:.5,   hand:'F', r:9,  speed:560, life:1.5}},   // 2 right sphere
      {time:.8,  cd:.7,  hitFrom:0, hitTo:0, dmg:1.8, kbx:.35, kby:1.0, stunx:1.4, shake:1.5, hitstop:.08,
        shot:{p:.525, hand:'B', r:20, speed:430, life:1.9}}                                                                      // 3 BIG combined sphere
    ]
  },
  // PASSIVE - ABYSSAL HUNGER: every landed damaging hit (orbs, claw, ...) steals 1 Shadow Fragment (max `max`), a successful Shadow Step gives 1 too. At full fragments the passive is READY: the NEXT hit that lands
  //   (a basic orb or any skill) is empowered and eats all fragments: ABYSSAL SLAM = the enemy is lifted `liftH` px (in `lift` s), hangs there for `hover` s, then is slammed into the ground (`slamDmg` + knocked down `slamStun` s).
  //   A miss does not use the charge. One fragment per attack (multi-hit attacks count once). Fragments show as pips over his head.
  passive: {name:'ABYSSAL HUNGER', kind:'hunger', max:5, lift:.25, liftH:90, hover:1, slamDmg:1.6, slamStun:1,
    desc:'Every hit steals a Shadow Fragment from the enemy, and so does a successful Shadow Step. At 5 fragments the next hit that lands is empowered: the enemy is lifted, hangs for 1 second, then is slammed into the ground. Missing keeps the charge.'},
  skills: [
    // SKILL I - VOID CLAW: drag to aim a GROUND spot (drag sideways = how far, within `range` px; a tap = the enemy's spot if in range). He reaches out (`cast` s, the spot is marked on the ground = fair warning), then a giant
    //   shadow claw bursts out of the ground (`swipe` s) in a column `halfW` px each side and `height` px tall: dmg + the enemy is launched up (kby) and KNOCKED DOWN `kd` s when they land. The claw stays `linger` s.
    {name:'VOID CLAW', kind:'voidclaw', aim:true, cd:9, range:340, cast:.45, swipe:.18, linger:1, halfW:52, height:240, dmg:1.8, kbx:0, kby:2.6, stunx:2, kd:1, failTxt:'NO GROUND',
     desc:'Drag to pick a spot on the ground (a tap targets the enemy). A giant shadow claw bursts out of the ground and swipes upward, launching the enemy. When they land they are knocked down. The claw lingers for a second.'},
    // SKILL II - SHADOW STEP: drag to pick a spot (within `range` px; it snaps to the nearest ground), he dissolves into smoke and appears there at once, leaving a shadow afterimage for a moment. Cannot go through or into the
    //   enemy. `evade` s of dodge frames (not invulnerable afterwards). Failed = nothing happens (no cooldown, no fragment). Success = +1 Shadow Fragment.
    {name:'SHADOW STEP', kind:'shadowstep', aim:true, cd:6, range:300, evade:.3, failTxt:'BLOCKED',
     desc:'Drag to choose a spot nearby and dissolve into smoke, reappearing there instantly. You cannot step through or into the enemy. Gives a Shadow Fragment.'}
  ],
  // ULTIMATE - HAND OF THE ABYSS: no aim, needs the enemy within `range` px. A rift opens under them (`rift` s, it follows them), a giant shadow hand rises (`rise` s) and GRABS them (from here they cannot move, jump,
  //   attack or use skills), lifts them (`lift` s, `liftH` px), the fingers slowly close (`close` s, `ticks` squeezes of `tickDmg`), it CRUSHES (`crushDmg`), slams them into the ground (`slam` s, `slamDmg`, knocked down `kd` s)
  //   and sinks back into the rift (`sink` s). If Abyssal Hunger is READY at the grab it is spent once and the slam hits harder (+ the passive's slamDmg, longer knockdown) - no second lift or slam.
  ultimate: {name:'HAND OF THE ABYSS', kind:'abysshand', aim:false, cd:60, range:300, rift:.55, rise:.5, lift:.5, close:1, crush:.3, slam:.22, sink:.6, liftH:140, ticks:4, tickDmg:.2, crushDmg:1, slamDmg:2, kd:1.2, failTxt:'TOO FAR',
    desc:'Only works when the enemy is in range. A rift opens under them and a colossal shadow hand grabs them, lifts them, slowly closes its fingers, crushes them and slams them into the ground. They cannot escape once grabbed.'}
});
