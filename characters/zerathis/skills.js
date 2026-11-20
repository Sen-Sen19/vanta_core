// ZERATHIS skills - the Frozen Monarch. Pure RANGE: every basic attack is ice that flies, there is no melee box. He stays planted (root) while casting.
// COMBO (press ATK again to keep it going): 1 ICE SHARD from the near hand   2 ICE SHARD from the far hand   3 FROST WAVE: both hands slam a big jagged crystal cluster out (knocks up, long stun).
// shot = {p, hand, r, speed, life}: p = swing progress when the ice leaves the hand (MUST match C in art.js: .5, .5, .56),
//   hand = 'N' near / 'F' far / 'B' both, r = hit size px, speed = px/s, life = seconds it flies (speed x life = range).
// hitFrom:0 hitTo:0 = no melee box, only the ice hits. dmg / kbx / kby / stunx work like a melee hit (stunx > 1 = "frozen" a bit longer).
// cd = time on every hit, so a cast always finishes before the next starts (no restart from mid-swing = no jitter when spamming).
//
// PASSIVE - ABSOLUTE ZERO (kind 'frost'): every landed hit (basic, held shard, skills) = +1 FROST stack (max `max`). At max the passive is READY and never expires: his NEXT successful attack freezes that enemy for `freeze` s.
//   Stacks / READY are the ice diamonds over his head. Eternal Ice Age feeds it too (1 stack per second per enemy). Needs no tuning besides `max` and `freeze`. (arena.js: frostGain / frostHit / freezeFx)
// HELD KEY - ICE PROJECTILE: HOLD ATK (a quick tap is still the shard combo). He raises his near hand, a big ice shard grows in it and YOU aim it (joystick / drag ATK / W S A D, same as Caliber's sniper).
//   It is ready after `kneel` s (aim:0 = no extra aim time); let go = he throws it along the aim. Let go before that = nothing is thrown (`cancelCd` s before he can try again). Rooted while aiming.
//   Real projectile (dodgeable). On hit it SHATTERS: damage, FREEZES the enemy `shot.freeze` s and gives him +1 Frost stack (through the passive, like every hit). cd = its own cooldown, starts when he throws.
//   TUNE HERE: shot.dmg (damage), shot.freeze (freeze time), shot.speed / life (range + dodge window), cd, turn (how fast the aim swings).
// SKILL I - WINTER'S GRASP: ground-targeted (drag the button: drag length = distance, left / right = side; a tap = the enemy's column). The ground FREEZES for `warn` s (the warning, enemies can walk out),
//   then ice spikes erupt: damage + the enemy is launched into the air for `air` s (half gravity, cannot act) + 1 Frost stack per enemy hit. halfW = half width of the area, height = how high the spikes reach (a high jump clears them).
// SKILL II - CRYSTAL COFFIN: ground-targeted like Grasp. After `form` s every enemy inside `radius` px is walled in and IMMOBILIZED for `trap` s (no walking / jumping / dashing; they can still attack and use skills).
//   Then the coffin SHATTERS: fragment damage to every enemy within `shardR` px of a coffin (the prisoner too). A coffin whose prisoner is KO'd early does not shatter.
// ULTIMATE - ETERNAL ICE AGE: `cast` s of casting (rooted, can be interrupted by any hit: then only `failCd` s cooldown), then `duration` s: the arena freezes over, ALL enemies are slowed by `slow` and take `dps` x THEIR max HP per second
//   (no knockback). He gains 1 Frost stack per second for every enemy (max 1/s per enemy). He can move and attack normally while it lasts.
// TUNE HERE: dmg (main balance knob), cd, warn / trap / duration (timings), slow, dps.
Characters.skills('zerathis', {
  basic: {desc:'Tap ATK again to keep the combo going: an ice shard from each hand, then a frost wave from both hands that knocks the enemy up. Every hit gives him a Frost stack.', time:.55, cd:.55, root:true, noSlash:true, hitFrom:0, hitTo:0, dmg:.7, kbx:.3, kby:.2, stunx:1.2, shake:.4, hitstop:0,
    combo: [
      {time:.55, cd:.55, hitFrom:0, hitTo:0, dmg:.7, kbx:.3,  kby:.2,  stunx:1.2, shot:{p:.5,  hand:'N', r:6,  speed:700, life:1.6}},   // 1 ice shard (near hand)
      {time:.55, cd:.55, hitFrom:0, hitTo:0, dmg:.7, kbx:.3,  kby:.2,  stunx:1.2, shot:{p:.5,  hand:'F', r:6,  speed:700, life:1.6}},   // 2 ice shard (far hand)
      {time:.8, cd:.8,  hitFrom:0, hitTo:0, dmg:1.7, kbx:.4, kby:1.0, stunx:1.8, shake:1.5, hitstop:.08,
        shot:{p:.56, hand:'B', r:16, speed:430, life:2.0}}                                                                              // 3 frost wave (both hands, big, knocks up)
    ]
  },
  passive: {name:'ABSOLUTE ZERO', kind:'frost', max:5, freeze:1,
    desc:'Every hit he lands (attacks and skills) gives him 1 Frost stack, up to 5. At 5 the passive is READY and stays ready until used: his next successful attack freezes the enemy for 1 second.'},
  hold: {name:'ICE PROJECTILE', kind:'sniper', icon:'ice', lockTxt:'READY', type:'Held key - aimed projectile', after:.2, kneel:.3, aim:0, turn:3.2, cd:4, cancelCd:.8, recover:.45,
    shot:{r:9, speed:760, life:1.1, dmg:1.5, kbx:.15, kby:0, stunx:1, shake:1.6, hitstop:.08, freeze:.5, shatter:46, popTxt:'SHATTERED'},
    desc:'HOLD ATK: he raises a hand and a large ice shard grows in it. Aim it yourself (joystick / drag ATK / W S A D), let go to throw. The shard shatters on the first enemy it hits: damage, a 0.5 second freeze and 1 Frost stack. It can be dodged, and a miss is wasted. Let go too early and nothing is thrown.'},
  skills: [
    {name:"WINTER'S GRASP", kind:'wintergrasp', aim:true, cd:9, cast:.5, range:430, halfW:58, height:80, warn:1, linger:.7, air:1, dmg:1.4, shake:2, hitstop:.07,
      desc:'Drag to pick a spot on the ground (drag length = distance). The ground freezes for 1 second as a warning, then ice spikes erupt: damage, and enemies are launched into the air for 1 second. Every enemy hit gives him 1 Frost stack. Walk out of the frozen patch (or jump over it) to dodge.'},
    {name:'CRYSTAL COFFIN', kind:'crystalcoffin', aim:true, cd:12, cast:.45, range:430, form:.45, radius:54, trap:2, shardR:84, dmg:1.1, shake:1.5, hitstop:.06,
      desc:'Drag to pick a spot on the ground. Crystal prisons close around every enemy inside it and immobilize them for 2 seconds: they cannot walk, jump or dash, but they can still attack and use skills. Then the ice shatters, and the fragments damage every enemy near a coffin.'}
  ],
  ultimate: {name:'ETERNAL ICE AGE', kind:'iceage', aim:false, cd:60, failCd:25, cast:3, duration:5, fade:.8, slow:.45, dps:.05, type:'Arena - Ultimate',
    desc:'He spends 3 seconds calling down the cold (any hit interrupts it). Then for 5 seconds the whole battlefield is frozen: every enemy is slowed and takes continuous damage, and he gains 1 Frost stack per second for each enemy. He can still move and fight while it lasts.'}
});
