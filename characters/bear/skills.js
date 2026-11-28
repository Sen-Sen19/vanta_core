// BEAR#012123 skills - PHASE 5: 5-hit basic combo + PASSIVE Bouncy Bear + HELD KEY Belly Stomp + SKILL I Goo Punch + SKILL II Super Jump & Shicka Toss. Still no ultimate.
// COMBO: 1 LEFT punch -> 2 RIGHT punch -> 3 LEFT punch -> 4 RIGHT punch (a little harder) -> 5 DIVE (leaps forward and dives head first, launches the foe).
// Same rules as every other combo character: press ATK again in time to chain (a short pause resets it to hit 1). Knockback is the shared KB in arena.js, kbx / kby only scale it.
// REACH matches the big fist: the hit box starts at the body edge and `reach` ends about where the swollen fist ends (art.js FIST_R). Raise reach AND FIST_R together if you want longer punches.
// TUNE HERE: dmg, reach, time / cd (speed), lunge (small step in), hop + lunge on the dive.
Characters.skills('bear', {
  basic: {
    time: .28, cd: .24, reach: 14, root: true, noSlash: true, noShake: true,
    hitFrom: .15, hitTo: .04, dmg: .6,
    combo: [
      {time: .28, cd: .24, hitFrom: .15, hitTo: .04, reach: 14, dmg: .60, kbx: .25, kby: .15, lunge: 150, lungeP: .38, hitstop: .03},   // 1 left punch
      {time: .28, cd: .24, hitFrom: .15, hitTo: .04, reach: 14, dmg: .60, kbx: .25, kby: .15, lunge: 150, lungeP: .38, hitstop: .03},   // 2 right punch
      {time: .30, cd: .26, hitFrom: .16, hitTo: .04, reach: 15, dmg: .70, kbx: .30, kby: .18, lunge: 170, lungeP: .38, hitstop: .04},   // 3 left punch
      {time: .30, cd: .26, hitFrom: .16, hitTo: .04, reach: 16, dmg: .75, kbx: .35, kby: .20, lunge: 180, lungeP: .38, hitstop: .05},   // 4 right punch
      {time: .52, cd: .50, hitFrom: .27, hitTo: .02, reach: 20, dmg: 1.4, kbx: .70, kby: 1.0, lunge: 300, lungeP: .26, hop: 360, stunx: 1.4, hitstop: .10, noShake: false}   // 5 dive
    ]
  },

  // SKILL I GOO PUNCH (kind 'goo', code in arena.js SKILLS.goo / gooTransfer / gooTick): press = instant 50 / 50 roll, GREEN or PURPLE goo coats Bear (a goo-coloured border around his body).
  //   NO cooldown on the cast (toggle:true). The goo stays on him until a basic punch really LANDS (missing keeps it): it moves onto the enemy (same border on them) and only then the cooldown `cd` starts.
  //   GREEN = slow: the enemy moves `slow` (0.4 = 40%) slower for `slowDur` s.   PURPLE = damage over time: `dps` x their max HP per second for `dotDur` s (a barrier soaks it first).
  skills: [
    {name: 'GOO PUNCH', kind: 'goo', toggle: true, aim: false, cd: 8, failTxt: 'ALREADY COATED',
      slow: .40, slowDur: 3.5, dps: .025, dotDur: 4,
      desc: 'Bear coats himself in green or purple goo (50 / 50). The goo stays on him until a punch connects, then it jumps onto the enemy. Green goo slows them down, purple goo burns them over time. Missing keeps the goo, and the cooldown only starts once it has been passed on.'},

    // SKILL II SUPER JUMP & SHICKA TOSS (kind 'superjump', code in arena.js SKILLS.superjump / shkStep / shkThrow). Press + drag the button to pick the LANDING SPOT (dotted arc + marker; a tap = the enemy's column if in range), release = he crouches and launches.
    //   1) SUPER JUMP: high arc to the chosen ground spot (range = how far you can pick). 2) After landing ONLY: he takes Shicka off his backpack (grab) and stands still aiming (no moving, no jumping).
    //   3) AIM by dragging Skill II (or W S keys); LET GO (or tap skill II) = Shicka is thrown in a STRAIGHT line (no gravity, no arc) and hurts the first enemy it touches. After aimMax s he throws by himself.
    //   COOLDOWN (cd) starts when Shicka is THROWN (toggle:true = none on the cast). Shicka is gone from his back until the cooldown ends, then it returns. A hit on Bear before the throw cancels it: Shicka stays with him, only cancelCd is spent.
    //   TUNE HERE: range (landing reach), crouch / flight / height (the jump), grab (take Shicka), minAim / aimMax / turn (aiming), recover (after the throw), cd, cancelCd, shot {speed, life, r (hit radius), dmg, kbx, kby, stunx}.
    {name: 'SUPER JUMP & SHICKA TOSS', kind: 'superjump', toggle: true, aim: true, failTxt: 'NO GROUND', cd: 10, cancelCd: 0,
      range: 460, crouch: .18, flight: .5, height: 210, grab: .34, minAim: .12, aimMax: 5, turn: 6, recover: .28,
      shot: {speed: 1150, life: 1.0, r: 11, dmg: 1.7, kbx: .9, kby: .45, stunx: 1.2, shake: 1.3, hitstop: .07},
      desc: 'Bear leaps high to the spot you choose. Only after landing does he take Shicka off his backpack and stand still, aiming (he cannot move or jump). Drag Skill II to aim and release to throw Shicka in a straight line: no gravity, no curve, it hurts the first enemy it touches. The cooldown starts when Shicka is thrown, and Shicka returns to his backpack when it ends. A hit before the throw cancels it and Shicka stays with him.'}
  ],

  // PASSIVE BOUNCY BEAR (kind 'bouncy', code in arena.js bearAirStep / bearWave): every landing after a fall of at least `minFall` px = a 360 degree shockwave around him + a small bounce. He never hurts himself.
  //   Fall distance = how far below the highest point of the fall he lands (jumps, drops, knockback all count). NO CEILING: every number is  base + perPx x distance,  so a higher fall always hits harder.
  //   dmg = damage multiplier (like a basic hit), r = radius px, kbx / kby = knockback multipliers of the shared KB, bounce = upward speed after the landing (bounceMax only caps the BOUNCE, never the damage).
  passive: {name: 'BOUNCY BEAR', kind: 'bouncy', minFall: 150,
    dmg: 0, dmgPx: .0033, r: 40, rPx: .30, kbx: .25, kbxPx: .0025, kby: .30, kbyPx: .0020, stunx: 1.2,
    bounce: 210, bouncePx: .20, bounceMax: 420,
    desc: 'Bear lands harder the farther he falls. Any landing after a long fall (a double jump or more) sends out a 360 degree shockwave: the higher the fall, the bigger the shockwave, the more damage and the stronger the knockback, with no limit. He bounces a little and never hurts himself.'},

  // HELD KEY BELLY STOMP (kind 'stomp', code in arena.js stompStep): press ATK while jumping / falling = he flips belly-down and dives at once (no cast, no charge). Basic punches are ground-only, so ATK in the air is this.
  //   The dive speeds up from startVy by acc (px/s per s) up to vmax; steer = how much of his walking speed he keeps for steering. Enemies he touches on the way down are hit once (hitDmg / hitKbx / hitKby).
  //   Landing = shockwave with the SAME scaling as the passive (dmg + dmgPx x fall, r + rPx x fall ...), bigger numbers, then a bounce. No cooldown: after a stomp he must JUMP himself again (the bounce does not count) before the next one.
  //   It does not start with no platform under him (he would only fall out of the arena).
  hold: {name: 'BELLY STOMP', kind: 'stomp', type: 'Held key - air dive (press ATK in the air)',
    startVy: 700, acc: 4200, vmax: 2600, steer: .35,
    hitDmg: .5, hitKbx: .3, hitKby: .1,
    dmg: .20, dmgPx: .0042, r: 55, rPx: .34, kbx: .35, kbxPx: .0030, kby: .35, kbyPx: .0024, stunx: 1.3,
    bounce: 380, bouncePx: .35, bounceMax: 680,
    desc: 'Press the attack button while jumping or falling: Bear turns belly-down and dives straight down, faster and faster. Enemies he hits on the way down take damage, and the landing sends out a 360 degree shockwave that grows with the fall. He bounces up afterwards. No cooldown, but he has to jump again before the next stomp.'},

  // ULTIMATE GIANT SHICKA (kind 'giantshicka', code in arena.js giantShickaStep / drawGiantShicka):
  //   Phase 1 EMERGE (emerge s): a giant ice block appears at arena centre. Giant Shicka bursts out, ice cracks and chunks fly.
  //   Phase 2 RISE   (rise   s): Giant Shicka floats upward, out of frame above the arena.
  //   Phase 3 STOMP  (stomp  s): free-falls belly-down at high speed, slams the ground. Impact fires a massive shockwave along the floor.
  //   The shockwave (swSpd px/s, max radius swR) only hits GROUNDED enemies — a double-jump before it arrives avoids all damage.
  //   TUNE HERE: emerge / rise / stomp / linger (phases), swR (max wave radius), swSpd (wave speed), dmg / kbx / kby / stunx (hit), cd (cooldown).
  ultimate: {name: 'GIANT SHICKA', kind: 'giantshicka', cd: 28,
    emerge: 1.4, rise: 1.0, stomp: 1.1, linger: .6,
    swR: 500, swSpd: 520,
    dmg: 2.4, kbx: 1.2, kby: 1.6, stunx: 1.4,
    desc: 'Bear summons Giant Shicka, his enormous companion. A huge ice block erupts at centre stage — Shicka bursts free, rises high above the arena, then belly-stomps straight into the ground. A massive shockwave tears outward along the floor. DODGE: jump before the shockwave reaches you to avoid all damage — being airborne when it passes makes you completely safe.'}
});