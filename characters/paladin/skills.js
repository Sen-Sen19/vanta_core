// PALADIN skills. Basic attack + held ATK (Aegis Stance) + skill I (Divine Impact) + skill II (Sacred Charge) + ultimate (Heaven's Verdict) + the passive: 3-HIT STOMP COMBO. No swinging, it is all weight.
// Press attack again to keep it going: 1 SHIELD STOMP (shield + front foot lift, then drop onto the ground) -> 2 KICK -> 3 POWER SMASH (leaps, shield overhead, crashes down: big knock-up + long stun).
// No screen shake (noShake:true). Remove it to get the shake back, the shake values per hit are still here.
// Miss the timing and the combo restarts at hit 1.
// time = swing length (s), cd = wait before the next swing, reach = hit box length px, root = feet stay planted,
// hitFrom/hitTo = the part of the swing that can hit (time left). !! art.js CS[i] = 1 - hitFrom/time of hit i, keep them matching:
//   hit1 1-.36/.8=.55   hit2 .55   hit3 1-.51/1.5=.66
// lunge/lungeP = the step in. hop = jump at lungeP (the smash leaps: 440 up at p=.40 lands right at contact). dmg = damage multiplier (main balance knob),
// kbx/kby = knockback multiplier (side / up), stunx = stun time multiplier.
Characters.skills('paladin', {
  basic: {time:.8, cd:.72, reach:40, root:true, noSlash:true, noShake:true, hitFrom:.36, hitTo:.14, dmg:1.2, kbx:.5, kby:.8, lunge:60, lungeP:.5, shake:3, hitstop:.15,
    combo: [
      {shield:true, time:.8,  cd:.72, hitFrom:.36, hitTo:.14, reach:40, dmg:1.2, kbx:.5,  kby:.8,  lunge:60,  lungeP:.5,  shake:3, hitstop:.15},                           // 1 shield stomp
      {time:.8,  cd:.72, hitFrom:.36, hitTo:.14, reach:36, dmg:1.5, kbx:1.1, kby:.25, lunge:230, lungeP:.5,  shake:3, hitstop:.17},                           // 2 kick (far foot)
      {shield:true, time:1.5, cd:1.35, hitFrom:.51, hitTo:.16, reach:46, dmg:3,  kbx:1,   kby:1.4, lunge:150, lungeP:.4,  hop:440, stunx:1.8, shake:6, hitstop:.3}        // 3 power smash (leap)
    ]
  },
  // PASSIVE - DIVINE RETRIBUTION: every enemy attack that damages him (melee, projectile or skill) = 1 Divine Charge (max `max`), one charge per ATTACK even if it hurts several times.
  //   At full charges the passive is READY: the NEXT attack of his that connects (basic or skill) also releases a holy shockwave on that same hit: `dmg` holy damage (x the usual damage) to enemies within
  //   `radius` px of him, knocked back away from him (kbx / kby / stunx like a hit), and all charges are spent. A miss keeps the charges. Charges show as golden pips over his head.
  passive: {name:'DIVINE RETRIBUTION', kind:'retribution', max:5, radius:110, dmg:1.6, kbx:2.2, kby:.6, stunx:1.4,
    desc:'Every enemy attack that damages you grants a Divine Charge (1 per attack, max 5). At 5 charges the next attack of yours that connects releases a holy shockwave: extra holy damage and a strong knockback around you, and all charges are spent.'},
  // I - DIVINE IMPACT: no aim. He raises the shield and smashes it into the ground (power-smash pose, no leap). At `at` (= the contact point, keep it = CS[2] in art.js) a holy shockwave hits enemies within `radius` px:
  //     `dmg` damage (kbx/kby/stunx = small pushback) + a slow of `slow` (0.4 = 40%) for `slowDur` s. Then his shield GLOWS for `glow` s.
  //     EMPOWERED SHIELD ATTACK: the first basic hit that connects with the shield (combo steps marked shield:true: stomp + power smash, NOT the kick) deals `bonus` x the usual damage as extra holy damage and ends the glow.
  //     A miss does nothing: the glow lasts until that first shield hit or until `glow` s run out (it flickers in the last second). Hurt during the cast = interrupted. cd = cooldown (not given in the design yet).
  // HELD KEY - AEGIS STANCE: HOLD the ATK button (about `after` s, a quick tap still does the normal combo). He plants the shield in the ground: `setup` s of setup (rooted, cannot turn or jump, NOT protected),
  //   then the shield is fully planted and every blow from the FRONT is blocked (no damage, no knockback, no stun). Blocking only: it does not reflect or counter. He stays planted while ATK is held;
  //   let go = the stance ends. Being hit during the setup, leaving the ground or casting a skill also ends it. Blows from behind still land.
  hold: {name:'AEGIS STANCE', type:'Held - Defensive stance', kind:'aegis', after:.3, setup:3,
    desc:'HOLD ATK: he plants his shield in the ground. For 3 seconds he is setting up, unable to move and NOT protected. Then the shield is fully planted and blocks every attack from the front while he stays still. Let go to end it. Blocking only.'},
  skills: [
    {name:'DIVINE IMPACT', desc:'He smashes his shield into the ground: a holy shockwave damages and slows nearby enemies, then the shield glows for 4 seconds. His first shield hit while it glows (stomp or power smash, not the kick) deals bonus holy damage and uses the glow up. A miss keeps it until it runs out.',
     kind:'divineimpact', aim:false, cd:10, time:1.0, at:.66, radius:120, dmg:1, kbx:.2, kby:.3, stunx:.5, slow:.4, slowDur:2.5, glow:4, bonus:1.5, shake:2, hitstop:.1},
    // II - SACRED CHARGE: no aim. `windup` s bracing behind the shield (rooted, body + shield vibrate), then he charges forward for `duration` s at `speed` px/s. The joystick only steers left / right, no jumping.
    //     The first enemy the shield touches (`reach` px in front of him) takes `dmg` once and is pushed along in contact until the charge ends. Pushed into a WALL (platform side): both stop, the enemy takes `wallDmg`
    //     and is knocked down for `wallStun` s. Getting hit cancels the charge. cd = cooldown from the cast (not given in the design yet).
    {name:'SACRED CHARGE', desc:'He braces behind his shield, then charges forward. Steer left or right, no jumping. The first enemy his shield hits is pushed along until the charge ends. Slam them into a wall and both stop: extra damage and a knockdown.',
     kind:'sacredcharge', aim:false, cd:14, windup:.55, duration:2.2, speed:330, reach:12, dmg:1.2, kbx:0, kby:0, stunx:.5, wallDmg:2.5, wallStun:1.6, shake:2, hitstop:.08}
  ],
  // ULTIMATE - HEAVEN'S VERDICT: no aim, needs an enemy within `range` px (else TOO FAR, cooldown kept). He raises the shield (`cast` s); a giant golden shield appears over the spot where the enemy STANDS and falls for `delay` s
  //   (the spot is fixed, so they can walk out of it; a golden ring on the floor shows the area). When it lands, enemies inside `radius` px take `dmg` (big), are blasted away from the center (kbx/kby/stunx) and get
  //   -`armorDown` armor for `armorDur` s (they take more damage). Anyone who left the area is not touched. cd = cooldown (not given in the design yet).
  ultimate: {name:"HEAVEN'S VERDICT", type:'Targeted area - Ultimate', desc:'Raise the shield to the sky: a giant golden shield appears over your target and falls. The spot is fixed, so they can run out of it before it lands. Anyone caught takes heavy holy damage, is blasted away and loses armor for a few seconds.',
    kind:'heavensverdict', aim:false, cd:60, cast:.9, range:480, delay:1.8, radius:170, height:380, dmg:4.5, kbx:2.2, kby:1.1, stunx:1.8, armorDown:25, armorDur:5, shake:6, hitstop:.2}
});