// ERRATA skills - The Broken Entity.
// Combat style: Telekinetic Glass Shards.
// Short-range organic shard attacks directed only where she faces (~72px reach).
//
// Normal Combo:
//   Step 0: Command Flick    — Near-hand sharp forward jab, 2 shards in tight high grouping.
//   Step 1: Arc Sweep        — Far-hand rising arc slash, 2 shards from above in a backhand.
//   Step 2: Crane Split      — Asymmetric high-low crane stance, 3 shards from two heights.
//   Step 3: GRAND SLAM       — BOTH hands sweep inward gathering all shards, then dual-thrust SLAMS 6 shards forward!
//
// Held-Key Attack: Super Saiyan Shard Focus & Long-Range Piercing Barrage
//   Holding ATK puts Errata into a Goku-style power-up crouch, shards spinning FAST around her!
//   Releasing snaps into an outstretched single-hand aim, launching ALL 10 shards in a long-range piercing stream!
Characters.skills('errata', {
  basic: {
    time: .55, cd: .45, reach: 0, root: true, noSlash: true, noShake: true,
    hitFrom: 0, hitTo: 0, dmg: .60,
    chargeP: .32, chargeMin: .14, chargeMax: .85,
    combo: [
      {time: .55, cd: .45, hitFrom: 0, hitTo: 0, dmg: .55, lunge:  0, hitstop: .05},   // Step 1: command flick
      {time: .60, cd: .50, hitFrom: 0, hitTo: 0, dmg: .60, lunge:  0, hitstop: .05},   // Step 2: arc sweep
      {time: .65, cd: .55, hitFrom: 0, hitTo: 0, dmg: .70, lunge:  0, hitstop: .06},   // Step 3: crane split
      {time: .95, cd: .95, hitFrom: 0, hitTo: 0, dmg: 1.50, lunge: 55, lungeP: .62, hitstop: .12} // Step 4: GRAND SLAM (long recovery so the shards can return)
    ]
  },
  skills: [],
  ultimate: null
});