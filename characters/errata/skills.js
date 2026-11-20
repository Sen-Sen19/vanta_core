// ERRATA skills - The Broken Entity.
// Combat style: Telekinetic Glass Shards.
// Short-range organic shard attacks directed only where she faces (~72px reach).
//
// Normal Combo (every shard leaves from the hand that threw it, at that hand's height):
//   Step 0: LEFT jab          — near (left) hand, shoulder height, 2 shards.
//   Step 1: RIGHT cross       — far (right) hand, shoulder height, 2 shards.
//   Step 2: RIGHT low strike  — far (right) hand again, ELBOW / waist height, 3 shards.
//   Step 3: LEFT head strike  — near (left) hand, HEAD height, the big 10-shard volley.
//
// Skills: I = DIMENSIONAL IMPALE (mirror shard + portal), II = SHATTERED GRAVITY (pull zone), see `skills:` below.
//
// Held-Key Attack: REALITY COLLAPSE (basic.fan below)
//   CASTING TIME (castTime, seconds): the hold only becomes a REAL cast once the cast bar passes its tick mark. Let go before that = nothing is fired, only the normal combo hit comes out. So tapping / half-holding cannot be spammed for free shots.
//   Hold ATK: the power-up crouch, and the Reality Shards that revolve around her are GATHERED one after another once the cast is done (the longer the hold, the more shards; 10 is the most, she never makes more).
//   Aim with the ATK-button drag / stick (keys: W S tilt it). Let go: ONLY the gathered shards are thrown, together, in a fan toward the aim. Each shard has a short range and damages on its own,
//   so one enemy can be hit by several shards (up close, by all of them = a shotgun). A shard that is still out cannot be gathered: they fly back to her orbit.
//   fan = {shards: max shards, dmg: damage PER SHARD (x base), range: px a shard travels, angle: total fan width (radians) when all shards are thrown (fewer shards = narrower), speed: px/s, kbx / kby / stunx / hitstop: per-shard hit}
//   TUNE HERE: castTime (minimum cast; keep chargeMin equal to it), fan.dmg, fan.range, fan.angle, chargeMax (hold time at which all 10 shards are gathered).
//
// PASSIVE: ERROR CORRECTION. `chance` (0..1) is rolled once for every incoming attack (basic, skill or ultimate). On success the WHOLE attack misses, she takes no damage and glitches to a random spot on the map.
//   chance is a PLACEHOLDER: the design says it is not decided yet. TUNE HERE: chance.
Characters.skills('errata', {
  basic: {
    time: .55, cd: .45, reach: 0, root: true, noSlash: true, noShake: true,
    hitFrom: 0, hitTo: 0, dmg: .60,
    chargeP: .32, castTime: .45, chargeMin: .45, chargeMax: 1.3,   // chargeMin MUST equal castTime (arena.js turns hold time past chargeMin into the shard count)
    fan: {shards:10, dmg:.25, range:230, angle:.95, speed:950, kbx:.35, kby:.18, stunx:1, hitstop:.04},
    desc: 'Tap for the 4-hit shard combo (left, right, right low, left head-height). HOLD ATK (REALITY COLLAPSE): she must finish a short casting time first (letting go early only does the normal hit), then her revolving shards are gathered, one more the longer you hold, up to all 10. Aim with the ATK drag / stick, then let go: only the gathered shards are thrown in a fan toward the aim. Short range, each shard damages on its own, so close enemies can take every shard.',
    combo: [
      {time: .55, cd: .45, hitFrom: 0, hitTo: 0, dmg: .55, lunge:  0, hitstop: .05},   // Step 1: LEFT jab
      {time: .60, cd: .50, hitFrom: 0, hitTo: 0, dmg: .60, lunge:  0, hitstop: .05},   // Step 2: RIGHT cross
      {time: .65, cd: .55, hitFrom: 0, hitTo: 0, dmg: .70, lunge:  0, hitstop: .06},   // Step 3: RIGHT low strike (elbow height)
      {time: .95, cd: .95, hitFrom: 0, hitTo: 0, dmg: 1.50, lunge: 55, lungeP: .62, hitstop: .12} // Step 4: LEFT head-height strike + 10-shard volley (long recovery so the shards can return)
    ]
  },
  passive: {name:'ERROR CORRECTION', kind:'errorCorrection', chance:.25, cd:0, popTxt:'ERROR', cols:['#9d4edd', '#0c0614', '#e0c3ff'],
    desc:'Every incoming attack (basic, skill or ultimate) has a chance to simply fail: she glitches out of reality, takes no damage and reappears at a random spot on the map.'},
  // SKILL I - DIMENSIONAL IMPALE: ground-targeted (drag the button; a tap = the enemy's spot if in range, else ahead). A giant glitching mirror shard forms above the spot (fall s), crashes down (damage + launch to enemies under it, halfW = half its width)
  //   and stays embedded for `duration` s. While it stands, simply WALKING INTO its area (within enterR px) makes her step in automatically: she vanishes and reappears at a random valid spot on the map
  //   (she must step out of the area once before it can take her again; enterCd = pause after a use). Only she can use it. TUNE HERE: dmg, duration, halfW, range, cd, enterR.
  // SKILL II - SHATTERED GRAVITY: ground-targeted. A distortion forms (form s) at the spot and for `duration` s drifts every enemy inside `radius` toward its center at up to `pull` px/s (stronger near the middle, `pullAir` = vertical pull in the air).
  //   No damage. It is only a drift on top of their own movement (their walk is ~290 px/s), so they can still move and escape. TUNE HERE: pull, radius, duration, cd.
  skills: [
    {name:'DIMENSIONAL IMPALE', kind:'dimimpale', aim:true, cd:14, cast:.45, range:360, fall:.7, halfW:46, height:150, dmg:1.8, kbx:.35, kby:.75, stunx:1.2, shake:2.6, hitstop:.08, duration:8, enterR:50, enterCd:.8,
      desc:'Drag to aim. A huge glitching mirror shard forms above the spot and crashes down, hitting enemies under it, then stays embedded for 8 seconds. Errata can enter it just by walking into its area: she vanishes and reappears at a random spot on the map. The mirror disappears when its time runs out.'},
    {name:'SHATTERED GRAVITY', kind:'shatteredgravity', aim:true, cd:16, cast:.5, range:340, radius:130, form:.35, duration:5, pull:130, pullAir:520, lift:34,
      desc:'Drag to aim. A gravitational distortion appears at the spot and, for 5 seconds, steadily pulls every enemy inside it toward its center. It does no damage and enemies can still move, so they can fight the pull and walk out of it.'}
  ],
  ultimate: null
});