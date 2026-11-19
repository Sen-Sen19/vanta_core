// NOCTIS skills - ninja with a crescent blood-sickle arm blade on each arm.
// COMBO (press ATK again to keep going), every hit is a different move so it never looks like the same hop repeated:
//   1 "\" chop from above   2 "/" rising cut   3 wide double sweep   4 X finisher (both blades chop down into an X, knocks up). No hops: he stays on the ground.
// HOLD ATK = FOCUS: he freezes in a coil (chargeP = the pose he freezes at, must match R in art.js). chargeMin/chargeMax = seconds held for 0% / 100% focus.
// RELEASE = SHADOW STEP: blink:true makes arena.js teleport him right behind the enemy and strike, harder the longer he focused (see endCharge / blink in arena.js).
// time = swing length, cd = wait before the next hit, hitFrom/hitTo = hit window (time left on the swing), C in art.js = 1 - hitFrom/time (keep it ~.58).
// root = feet planted while swinging. lunge/lungeP = step in / hop at that swing progress. hop = jump power in px/s (not used by Noctis any more; keep under ~450 if you add it back so the hit still lands). dmg = damage multiplier, kbx/kby = knockback multiplier.
// !! lungeP MUST stay well above chargeP (.3): if the lunge / hop fires before the focus freeze, he leaves the ground and the freeze (needs gr) never happens = HOLD ATK stops working. Keep lungeP >= chargeP + .15.
// noSlash = don't draw the game's default white slash arc (his blades are the slash). noShake / noHitstop = no screen shake / no freeze on hit (remove them if you want that heavier feel back).
Characters.skills('noctis', {
  basic: {time:.34, cd:.3, reach:34, root:true, blink:true, chargeP:.3, chargeMin:.15, chargeMax:.9, noShake:true, noHitstop:true, noSlash:true,
    hitFrom:.14, hitTo:.03, dmg:.6,
    combo: [
      {time:.34, cd:.3,  hitFrom:.14, hitTo:.03, reach:36, dmg:.6,  kbx:.3, kby:.2,  lunge:170, lungeP:.5},                                  // 1 "\" chop
      {time:.34, cd:.3,  hitFrom:.14, hitTo:.03, reach:36, dmg:.6,  kbx:.3, kby:.2,  lunge:170, lungeP:.5},                                  // 2 "/" rising cut
      {time:.38, cd:.34, hitFrom:.16, hitTo:.04, reach:38, dmg:.8,  kbx:.4, kby:.2,  lunge:190, lungeP:.5},                                  // 3 wide sweep
      {time:.5,  cd:.5,  hitFrom:.21, hitTo:.05, reach:40, dmg:1.3, kbx:.3, kby:1.1, lunge:150, lungeP:.45, stunx:1.4}                        // 4 X finisher (grounded), knocks up
    ]
  },
  // PASSIVE - False Existence: the first enemy hit on him (basic attack OR skill) lands on an illusion instead. He takes NO damage and the whole attack is negated (every hit of that one skill),
  //   the illusion shatters, he reappears at a random spot on a random platform, then it is on cooldown for `cd` s. Bleed / puddles / aura ticks are not hits. Code: falseExistence() in arena.js.
  passive: {name:'FALSE EXISTENCE', kind:'falseExistence', cd:10, desc:'The first enemy attack that hits him lands on an illusion instead. He takes no damage, the whole attack is negated, and he reappears at a random spot in the arena. Then it needs time to come back.'},
  // SKILL I - SHADOW HOOK: drag to aim (a tap = straight ahead). A hook flies `range` px along the aim and stops at the first enemy. Hit = the enemy is latched, he pulls himself in at `pull` px/s,
  //   passes THROUGH them (`through` px past their centre), turns and kicks (`kick` s, the hit lands at 45% of it): dmg + knockback back the way he came. Then he backflips (`flip` px/s sideways, `flipUp` px/s up)
  //   and lands away from them. A miss reels the hook back and nothing else happens. The enemy can be hit-cancelled only by something that stuns HIM (his skill is cut). cd = cooldown.
  skills: [
    {name:'SHADOW HOOK', kind:'shadowhook', aim:true, cd:8, range:360, speed:1800, r:10, pull:1500, through:40, kick:.34, flip:340, flipUp:520, dmg:1.5, kbx:1.2, kby:.35, stunx:1, shake:1.5, hitstop:.08,
     desc:'Drag to aim, release to throw. If the hook connects he pulls himself in, passes through the enemy, kicks them back with a hard aerial kick, then backflips away and lands at a safe distance. A miss just reels the hook back.'},
    // SKILL II - SHADOW REPLICATION: press = `count` shadows appear at random spots on the platforms. They stand still and cannot be hurt. While shadows are left the SAME button teleports him:
    //   drag toward a shadow (the one closest to the aim is picked, a tap = the one ahead), release = instant teleport. That shadow is used up, the rest stay (up to `life` s each).
    //   cd = cooldown, it starts when the last shadow is gone. cast = summon pose (s).
    {name:'SHADOW REPLICATION', kind:'replicate', aim:true, toggle:true, cd:14, count:3, life:30, cast:.4,
     desc:'Press to scatter 3 shadows across the arena. They stand still and cannot be hurt. Then drag toward a shadow and release to teleport to it instantly. Each shadow vanishes after use, unused ones stay. The cooldown starts when the last one is gone.'}
  ],
  // ULTIMATE - PHANTOM ONSLAUGHT: no aim, needs an enemy within `range` px (else nothing happens and the cooldown is kept). Sequence: he appears BEHIND them (`appear` s, the enemy is locked from here:
  //   no move, attack or skills) -> `copies` shadows jump onto his back in a spread (`gather` s) -> they leap around the target and CHAIN it up (`chain` s) -> he slashes nonstop for `frenzy` s,
  //   one slash every `tick` s (`tickDmg` each, no knockback) while the shadows hold the chains -> `windup` s -> finishing slash (`finishDmg`, chains shatter, knocks them away) -> `recover` s.
  //   radius = how far the shadows stand from the target (px).
  ultimate: {name:'PHANTOM ONSLAUGHT', kind:'onslaught', aim:false, cd:60, range:300, radius:60, copies:5, appear:.25, gather:.45, chain:.3, frenzy:1.5, tick:.09, windup:.3, recover:.35, tickDmg:.15, finishDmg:1.7, kbx:1.3, kby:.9, stunx:1.5, shake:3, hitstop:.14,
    desc:'Only works when the enemy is in range. He appears behind them, his shadows jump onto his back, then leap out and chain the enemy down. The enemy cannot move, attack or use skills while he slashes nonstop, until the finishing slash breaks the chains.'}
});