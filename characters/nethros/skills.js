// NETHROS skills - The Eternal Dread. Pure RANGE: every attack is a DARK SOUL thrown from BOTH hands. No melee box, nothing comes from the chest.
// He stays planted (root) while casting. Press ATK again to keep the combo going: 1 small soul, 2 small soul, 3 BIG soul (knocks up, longer stun).
// shot = {p, hand, r, speed, life}: p = swing progress when the soul leaves the hands (MUST match C in art.js = .5), hand 'B' = both hands,
//   r = size px, speed = px/s, life = seconds it flies (speed x life = range).
// No hold-to-charge yet (no chargeP / chargeShot). Skills and ultimate are empty for now.
// TUNE HERE: dmg (main balance knob), speed + life (range), r (hit size), cd (fire rate).
Characters.skills('nethros', {
  basic: {time:.6, cd:.6, root:true, noSlash:true, hitFrom:0, hitTo:0, dmg:.8, kbx:.3, kby:.2, stunx:1.2, shake:.4, hitstop:0,
    combo: [
      {time:.6, cd:.6, hitFrom:0, hitTo:0, dmg:.8, kbx:.3, kby:.2, stunx:1.2, shot:{p:.5, hand:'B', r:7,  speed:620, life:1.7}},   // 1 dark soul
      {time:.6, cd:.6, hitFrom:0, hitTo:0, dmg:.8, kbx:.3, kby:.2, stunx:1.2, shot:{p:.5, hand:'B', r:7,  speed:620, life:1.7}},   // 2 dark soul
      {time:.8, cd:.8, hitFrom:0, hitTo:0, dmg:1.8, kbx:.4, kby:1.0, stunx:1.8, shake:1.5, hitstop:.08, shot:{p:.5, hand:'B', r:14, speed:440, life:2.0}}   // 3 big soul (knocks up)
    ]
  },
  // PASSIVE - DEATH'S EMBRACE: PROGRESSIVE EXECUTION. Every hit of his (basic, held key, skills, ultimate) does more damage the lower that enemy's HP is. Each enemy is checked on its own. Full HP = no bonus.
  //   curve = [[enemy HP share, bonus], ...] (1 = full HP). In between two points the bonus rises in a straight line. At or below the last point it stays at the last bonus. cap = the highest bonus allowed.
  //   TUNE HERE: curve, cap (0.3 = +30%).
  passive: {name:"DEATH'S EMBRACE", kind:'execute', cap:.3, curve:[[1, 0], [.75, .05], [.5, .1], [.25, .2], [.1, .3]], type:'Passive - Progressive Execution',
    desc:'The weaker the enemy is, the harder he hits. His damage grows as the enemy loses HP: +5% at 75% HP, +10% at 50%, +20% at 25%, and the most, +30%, at 10% HP or lower. It works on every attack he has, and every enemy is counted on its own. At full HP there is no bonus.'},
  // HELD KEY - DREAD RITUAL: HOLD ATK for `after` s to ACTIVATE it (a quicker tap is still the normal combo). After that you can let go: it runs by itself.
  //   CAST (`cast` s): he floats slowly (`speed` x his normal speed), can still change direction, cannot attack. His dark smoke aura grows from `r0` to `radius` px. A hit during the cast stops it.
  //   Then the aura STAYS on him until `dur` s have passed since the start (so cast 3 s + 2 s as a free-moving aura = 5 s). He fights normally, a hit does not remove it. After it, `cd` s before it can be used again
  //   (`cancelCd` if the cast was interrupted). The smoke never goes under the platform he stands on: only enemies at his level or above are inside it.
  //   Enemies inside the aura: FEAR is only a CHANCE, not a force field. Every `fearEvery` s an enemy is inside, it has `fearChance` to get scared: it walks away from him for `fearDur` s, then it is normal again (even if still inside).
  //   + ARMOR DOWN: grows with the time they stay inside, from 0 up to `armMax` armor after `armRamp` s, and it resets when they leave (`leaveGrace` = a tiny delay so the edge does not flicker).
  //   (Armor numbers: Nethros 2, Miette 3, Titan 10, Paladin 12. Armor can go below 0 = they take MORE damage.)
  //   TUNE HERE: after, cast, dur, cd, speed, radius, fearEvery, fearChance, fearDur, armMax, armRamp.
  hold: {name:'DREAD RITUAL', kind:'ritual', after:.22, cast:3, dur:5, cd:8, cancelCd:2, speed:.5, radius:190, r0:30, fearEvery:.7, fearChance:.35, fearDur:.45, armMax:6, armRamp:4, leaveGrace:.12, type:'Held key - Smoke aura',
    desc:'HOLD ATK to activate it, then let go. He casts for 3 seconds, floating slowly and unable to attack, while a cloud of dark smoke grows around him. The smoke stays on him for 5 seconds in total (the last 2 seconds he can move and fight freely). Enemies inside it sometimes get scared and walk away for a moment, and their armor gets lower the longer they stay inside. The smoke does not go under the platform he stands on.'},
  // SKILL I - GRAVEBOUND HANDS: no aim, straight ahead (the way he faces). He raises both arms (`time` s, rooted; a hit on him during the cast stops it). At `at` (0..1 of the cast) a horde of dark hands crawls out of the floor
  //   in front of him in `clusters` groups of `perCluster` hands, spread over `spread` px. They crawl forward slowly (`speed` px/s) for `dist` px (or to the edge of the platform), then stay there clawing for `linger` s
  //   and sink back down (`sink` s). While crawling, an enemy at floor level that touches them is hurt ONCE per cast (Death's Embrace counts) and knocked away in the crawl direction. `hh` = how high the hands reach (px of a
  //   jump above the floor that still gets hit). TUNE HERE: dmg (main balance knob), kbx / kby / stunx (knockback), dist + speed (range + how slow), linger, cd.
  skills: [
    {name:'GRAVEBOUND HANDS', kind:'gravebound', cd:8, time:.7, at:.55, clusters:6, perCluster:4, spread:110, dist:380, speed:170, linger:.8, sink:.5, hh:60, dmg:1.2, kbx:.5, kby:.35, stunx:1.2, shake:0, hitstop:0,
     failTxt:'ON THE GROUND', type:'Ground wave - crawling hands',
     desc:'He raises both arms and a horde of dark demonic hands claws its way out of the floor in front of him. They crawl forward slowly in clusters, hurting and throwing back every enemy they catch on the floor (each enemy only once per cast). Jump over them to avoid it. They stop after a fixed distance, linger for a moment still clawing, then sink back into the ground.'},
    // SKILL II - RISE OF THE DAMNED: summons 3 skeleton warriors from the ground surrounding Nethros.
    // 1. Swordsman: fast melee sword strikes.
    // 2. Spearman: longer-range spear thrusts.
    // 3. Axeman: slow, heavy axe swings with higher damage.
    // Each skeleton has individual HP and independently tracks down and attacks nearby enemies. When their target is eliminated, they search for another nearby enemy.
    // They disappear when their HP reaches zero or when their 16s summon duration expires. Skill cooldown starts immediately after summoning. Only 3 skeletons can exist at a time (resummoning replaces the previous group).
    {name:'RISE OF THE DAMNED', kind:'damned', aim:false, cd:16, time:.5, at:.35, dur:16, failTxt:'ON THE GROUND',
     type:'Summon - 3 Skeleton Warriors',
     desc:'He raises his arms and summons 3 skeleton warriors from the earth surrounding him: a fast Swordsman, a long-range Spearman, and a heavy-hitting Axeman. Each has individual HP and independently hunts nearby enemies. When their target is eliminated, they search for the next. Skeletons disappear when destroyed or when their timer expires. Resummoning replaces previous skeletons.'}
  ],
  // ULTIMATE - FALLEN DESCENT: Nethros launches himself extremely high above the arena, becoming completely invulnerable.
  // He disappears briefly into the dark heavens before descending like a fallen angel at blinding speed, crashing into the ground.
  // The impact creates a massive circular dark shockwave expanding outward in all directions, dealing heavy damage and knocking enemies back.
  // Fully benefits from Death's Embrace.
  ultimate: {name:'FALLEN DESCENT', kind:'fallendescent', aim:false, cd:42, failCd:15, time:1.8, ascend:.4, vanish:.35, descend:.4, recover:.45, radius:240, dmg:3.4, kbx:1.4, kby:1.0, stunx:1.5, shake:3, hitstop:.12,
    type:'Sky Dive - Dark Shockwave',
    desc:"He launches himself high above the arena, completely invulnerable. He vanishes briefly before descending like a dark fallen angel at extreme speed, crashing into the ground. A massive circular dark shockwave erupts outward in all directions, dealing heavy damage with strong knockback. Fully benefits from Death's Embrace."}
});