// CALIBER skills - sniper with TWO PISTOLS. Every attack is a bullet (no melee box), so he fights at range.
// COMBO (press ATK again to keep it going): 1 LEFT pistol   2 RIGHT pistol   3 LEFT pistol   4 BOTH pistols = one heavy slug (knocks up, he skids back from the recoil).
// HOLD ATK = DEADEYE SNIPER (see `hold` below). A quick tap is still the pistol combo.
// shot = {p, hand, r, speed, life}: p = swing progress when the bullet leaves the gun (MUST match C in art.js: .45, .45, .45, .5),
//   hand = 'N' left (near) / 'F' right (far) / 'B' both, r = hit size px, speed = px/s, life = seconds it flies.
// hitFrom:0 hitTo:0 = no melee box, only the bullet hits. dmg / kbx / kby / stunx work like a melee hit. root = feet stay planted.
// lunge = push at lungeP (negative = skid BACK from the recoil).
// TUNE HERE: dmg (main balance knob), speed, cd (fire rate).
Characters.skills('caliber', {
  basic: {time:.34, cd:.26, root:true, noSlash:true, hitFrom:0, hitTo:0, dmg:.3, kbx:.25, kby:.15, shake:.3, hitstop:0, lunge:-20, lungeP:.5,
    combo: [
      {time:.34, cd:.26, hitFrom:0, hitTo:0, dmg:.3,  kbx:.25, kby:.15, lunge:-20, lungeP:.5, shot:{p:.45, hand:'N', r:4, speed:900, life:.9}},   // 1 left pistol
      {time:.34, cd:.26, hitFrom:0, hitTo:0, dmg:.3,  kbx:.25, kby:.15, lunge:-20, lungeP:.5, shot:{p:.45, hand:'F', r:4, speed:900, life:.9}},   // 2 right pistol
      {time:.34, cd:.28, hitFrom:0, hitTo:0, dmg:.35, kbx:.3,  kby:.15, lunge:-20, lungeP:.5, shot:{p:.45, hand:'N', r:4, speed:950, life:.9}},   // 3 left pistol, a bit harder
      {time:.5,  cd:.5,  hitFrom:0, hitTo:0, dmg:1.0, kbx:.5,  kby:1.0, lunge:-110, lungeP:.55, stunx:1.4, shake:1, hitstop:.06,
        shot:{p:.5, hand:'B', r:7, speed:820, life:.9}}                                                                                           // 4 both pistols: heavy slug, knocks up
    ]
  },
  // SKILL I - EXPLOSIVE SHOT: ARC aiming. Drag the button: the drag LENGTH is how far the shell lands (minR..range px), left / right = which side. A dotted arc and a landing ring (size = blast) show the shot.
  //   A tap (or key 1) = the enemy's column if he is in front, else about half range ahead. Release = a short wind-up (`windup` s), then the shell is lobbed along the arc.
  //   It flies for ~`flight` s (shorter for near throws), so enemies can move out from under it. It explodes the instant it touches a platform top or an enemy: no fuse.
  //   Every enemy within `radius` px of the blast takes dmg + a slight push away from it. Outside = nothing. Friends are never hurt. Does NOT use the Bullet Chamber magazine.
  // TUNE HERE: dmg (blast power), radius (blast size), cd (cooldown), range / minR (how far he can land it), flight / grav (arc height and travel time = dodge window), kbx / kby (push).
  skills: [
    {name:'EXPLOSIVE SHOT', kind:'lobshot', aim:true, cd:8, cast:.4, windup:.18, range:520, minR:90, flight:.95, grav:1400, r:6, radius:70, dmg:1.6, kbx:.6, kby:.5, stunx:1, shake:2, hitstop:.08,
      desc:'Drag to aim an arc: the drag length sets where it lands, and a ring shows the blast. He lobs an explosive shell that flies slowly enough to dodge, and detonates the moment it touches the ground or an enemy. Everyone in the blast ring takes damage and is pushed slightly back. No delay, no friendly fire.'},
    // SKILL II - RECOIL ESCAPE: no aim. He hops backward (in the direction he is facing), fires a burst of bullets BEHIND him while airborne, then lands facing the enemy.
    //   wind = wind-up before the hop (s, rooted). hop = upward launch speed (px/s). dist = horizontal kick backward (px/s, negative lunge). burst = how many bullets fire while in the air.
    //   The face-flip happens at flipAt (0..1 of the air time): he spins 180° and lands looking the other way (now facing the enemy he just created distance from).
    //   Bullets fire at evenly-spaced intervals across the hop, starting at burstFrom (0..1) and ending at burstTo (0..1). Each bullet uses the same `shot` object.
    //   TUNE HERE: cd, wind, hop, dist, burst, shot.dmg, shot.speed (bullet range = speed x life).
    {name:'RECOIL ESCAPE', kind:'recoilescape', aim:false, cd:9, wind:.18, hop:680, dist:340, burst:4, burstFrom:.2, burstTo:.85, flipAt:.5,
      shot:{r:4, speed:860, life:.8, dmg:.7, kbx:.35, kby:.2, stunx:1, shake:.6, hitstop:.03},
      type:'Aerial repositioning - rear burst', desc:'He leaps backward and fires a burst of bullets behind him mid-air, then lands facing the enemy. Great escape tool that also punishes any enemy who chased him.'}
  ],
  // ULTIMATE - BULLET RAIN: drag to aim a wide target zone. He fires a burst upward (`cast` s, rooted), then after a short delay (`delay` s) dense shrapnel rains down across the whole zone.
  //   `bullets` individual bullet impacts land at random positions spread evenly across the zone (halfW = half-width of the zone). They land one after another every `gap` s, in random order.
  //   Each impact hits a column `strikeW` wide and `height` px tall above the ground. Enemies inside the zone CAN be hit multiple times if they stay inside.
  //   Like Skyfall: a hit during the cast (before any bullet lands) cancels the whole thing.
  //   TUNE HERE: cd, bullets (more = denser), gap (tighter spacing = harder to escape), halfW (zone width), dmg (per bullet), delay, strikeW (hit column width), height.
  ultimate: {name:'BULLET RAIN', kind:'bulletrain', aim:true, cd:40, cast:.5, delay:.6, bullets:16, gap:.12, halfW:160, strikeW:30, height:200, dmg:.9, kbx:.2, kby:.5, stunx:.8, shake:.8, hitstop:.02,
    type:'Ground target - Area denial', desc:'Drag to aim a wide danger zone. He fires a burst upward, then after a short delay a storm of shrapnel rains down across the whole area. Bullets land one by one in random order: enemies caught inside can be hit by multiple impacts. Dodge by exiting the zone before the rain hits.'},
  // PASSIVE - BULLET CHAMBER: a magazine of `max` bullets. EVERY pistol bullet that leaves a gun uses one (a miss still counts; the heavy slug counts as one).
  //   The LAST bullet (the 5th) is ALWAYS critical, even if the first 4 missed. Crit = damage x critMult and knockback x critKb.
  //   After the 5th bullet he reloads by himself for `reload` s: he can still move and jump, but he cannot use the pistols. Then the magazine is full again and the cycle repeats.
  //   The 5th bullet is red and bigger in the air, and the 5th bullet icon over his head is red too (arena.js: chamberFire / chamberStep, art.js: shot()).
  //   The DEADEYE SNIPER shot never touches the magazine (no bullet used, never critical) and is not blocked by the reload.
  // TUNE HERE: reload (how long he is helpless), critMult (crit power of pistol bullets), critKb (crit knockback).
  passive: {name:'BULLET CHAMBER', kind:'chamber', max:5, reload:1.6, critMult:3, critKb:1.4,
    desc:'His magazine holds 5 bullets. Every pistol shot uses one, hit or miss. The 5th bullet is always a CRITICAL (red), even if the first four missed. Then he reloads by himself (he can move, but cannot use the pistols) and the cycle starts again. The sniper shot does not use the magazine.'},
  // HELD KEY - DEADEYE SNIPER: HOLD the ATK button (about `after` s, a quick tap still does the pistol combo).
  //   1. He kneels and raises his sniper rifle (`kneel` s). He is rooted: no walking, no jumping, no pistols, no combo.
  //   2. MANUAL AIM: you steer the rifle. Joystick (up/down tilts, left/right turns), or drag the ATK button, or W / S (tilt) + A / D (turn) on a keyboard. `turn` = how fast the rifle swings (rad/s).
  //   3. He must aim for `aim` s (counted after the kneel). A red laser shows where he points: faint at first, bright and pulsing when the shot is READY.
  //   4. Let go of ATK = fire, only if READY. Let go too early = he stands up and nothing is fired (`cancelCd` s before he can try again).
  //   Being hit, knocked off the floor or caught also cancels the aim.
  //   The shot is its OWN bullet (`shot`): fast, but a real projectile, so the enemy can dodge it before it lands. A miss is wasted: the cooldown `cd` starts the moment he fires, hit or miss.
  //   `recover` = seconds he stays rooted after the shot (rifle kick). The magazine (Bullet Chamber) and its reload are NOT used and NOT blocked.
  // TUNE HERE: aim (how long he must aim), cd (own cooldown = the sniper's balance), shot.dmg (how hard it hits), shot.speed / life (dodge window and range = speed x life), recover.
  hold: {name:'DEADEYE SNIPER', kind:'sniper', after:.2, kneel:.35, aim:3, turn:2.6, cd:8, cancelCd:1.2, recover:.55,
    shot:{r:4, speed:2300, life:.6, dmg:4.5, kbx:2, kby:.6, stunx:2, shake:3, hitstop:.12},
    desc:'HOLD ATK: he kneels and raises his sniper rifle, and you aim it yourself (joystick / drag ATK / W S A D). After 3 seconds the laser locks on: let go to fire one huge bullet. Let go too early and nothing fires. He cannot move or use the pistols while aiming. The bullet is not instant: the enemy can dodge it, and a miss is wasted (long cooldown). It does not use the magazine.'}
});
