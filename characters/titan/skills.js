// TITAN skills. Combo: LEFT, LEFT, RIGHT, LEFT HOOK, RIGHT UPPERCUT. Press attack again to keep it going.
// Every punch has a slow LOAD (about half of the time = the "cast"), then a fast release. The hit lands in the second half.
// HOLD ATK = CHARGE: chargeP = the punch progress where it freezes (must match R in art.js); chargeMin/chargeMax = seconds held for 0% / 100% charge.
// A full charge = damage x3.6, knockback x3.2, stun x2.2, big hit-stop + shake (see endCharge in arena.js).
// root = feet stay planted while punching (no walking during the swing). lungeP = punch progress when the body drives in (before the fist lands = momentum).
// noShake / noHitstop = no screen shake / no freeze on hit (skills can turn them off). dmg = damage multiplier, kbx/kby = knockback multiplier (side / up), lunge = step in at release, hop = jump at release,
// shake/hitstop = heavy-hit feel, noSlash = no white slash arc. TUNE HERE: dmg is the main balance knob.
Characters.skills('titan', {
  basic: {time:.5, cd:.46, reach:26, root:true, chargeMin:.15, chargeMax:1, hitFrom:.25, hitTo:.08, dmg:.8, noSlash:true, noShake:true, noHitstop:true,
    combo: [
      {time:.50, cd:.46, hitFrom:.25, hitTo:.08, reach:26, dmg:.8,  kbx:.3, kby:.2,  lunge:190, lungeP:.38, chargeP:.36, shake:1,   hitstop:.07},                  // 1 left
      {time:.50, cd:.46, hitFrom:.25, hitTo:.08, reach:26, dmg:.8,  kbx:.3, kby:.2,  lunge:190, lungeP:.38, chargeP:.36, shake:1,   hitstop:.07},                  // 2 left
      {time:.62, cd:.56, hitFrom:.30, hitTo:.10, reach:28, dmg:1.3, kbx:.5, kby:.2,  lunge:230, lungeP:.40, chargeP:.38, shake:1.5, hitstop:.10},                  // 3 right cross
      {time:.62, cd:.56, hitFrom:.30, hitTo:.10, reach:27, dmg:1.3, kbx:.5, kby:.2,  lunge:210, lungeP:.40, chargeP:.38, shake:1.5, hitstop:.10},                  // 4 left hook
      {time:.95, cd:1.0, hitFrom:.42, hitTo:.16, reach:22, dmg:2.8, kbx:.3, kby:1.1, lunge:140, lungeP:.44, chargeP:.42, hop:380, stunx:1.6, shake:3, hitstop:.18}  // 5 right uppercut
    ]
  },
  // PASSIVE - Pain Is Fuel: every `hits` landed SKILLS (basic punches do not count) = +speed move speed and a barrier of `barrier` x max HP for `dur` seconds. Another activation refreshes (no stacking).
  passive: {desc:'Every 2 landed SKILLS (punches do not count) gives a burst of move speed and a small barrier for a few seconds. Landing more refreshes it, it does not stack.', name:'PAIN IS FUEL', hits:2, speed:.15, barrier:.05, dur:3},
  // SKILLS I + II. Shared fields: kind (what it does, see SKILLS in arena.js), aim:true = drag the button to aim (tap = straight ahead), dmg/kbx/kby/stunx/shake/hitstop = like a punch.
  skills: [
    // I - FORCEBREAKER: instant straight shockwave along the aim, stops at the first enemy. 3 charges, each recharges on its own (recharge s).
    //     speed x life = range (px). r = hit size.
    {desc:'Drag to aim a straight shockwave that stops at the first enemy. Holds 3 charges and each one recharges on its own.', name:'FORCEBREAKER', kind:'shockwave', aim:true, charges:3, recharge:5, time:.3, speed:1300, life:.55, r:10, dmg:1, kbx:.6, kby:.25, shake:.8, hitstop:.04},
    // II - SEISMIC RUSH: instant straight charge (left / right from the aim). dist = how far (px), speed = px/s. Stops at the first enemy (damage + knockback + interrupts them).
    //      Hits the side of a platform = he crashes and is stunned wallStun seconds, no damage. cd = cooldown (not given in the design yet).
    {desc:'Drag left or right to charge forward. Hitting an enemy knocks them back and interrupts them. Running into the side of a platform stuns HIM instead.', name:'SEISMIC RUSH', kind:'rush', aim:true, cd:8, dist:300, speed:1100, dmg:1.3, kbx:1.3, kby:.35, shake:1.5, hitstop:.06, wallStun:.9}
  ],
  // ULTIMATE - TOTAL EXTINCTION: no aim. Activation is still TBD, so for now it is a plain cooldown (cd s, ready at the start of a match). Wind-up `windup` s, the hit lands at `at` (0..1 of the wind-up).
  //   radius = area (px), dmg = massive. Hit during the wind-up = interrupted. Crowd control TBD (only a long stun for now).
  ultimate: {desc:'A slow wind-up, then a massive ground-shattering blast around him with huge knockback and a long stun. If he gets hit during the wind-up it is interrupted.', name:'TOTAL EXTINCTION', kind:'quake', aim:false, cd:40, windup:.8, at:.55, radius:200, dmg:4, kbx:2.2, kby:1.3, stunx:2.4, shake:4, hitstop:.15}
});