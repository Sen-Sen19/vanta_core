// FULMINAR skills - The Stormforged. Agile lightning warrior wielding Dual Lightning Blades.
// 5-Hit Electrifying Chain Combo:
//   1 Volt Slash          - Fast diagonal downward strike with the near blade.
//   2 Storm Undercut      - Rising cut from low-rear with the far blade.
//   3 Twin Cross Cleave   - Both blades slice inward in a scissor cross, snapping electric arcs.
//   4 Tempest Flurry      - Rapid dual-wielding forward chain strikes.
//   5 Thunderfall Slam    - Aerial hop and downward plunge of both charged blades, detonating a thunderclap that launches the foe!
// HOLD ATK = THUNDER BURST: gather electricity (a hold shorter than `chargeMin` is a normal combo hit). Let go = an expanding shockwave around him that damages and pushes enemies away.
//   Two stages: released before full charge = `norm`, held to `chargeMax` = `full` (bigger radius, more damage). r = radius px; dmg / kbx / kby / stunx / shake / hitstop work like a melee hit.
//   TUNE HERE: r, dmg, chargeMin, chargeMax.
// PASSIVE STATIC CHARGE (kind 'static', see staticHit in arena.js): every landed attack (basic or skill, a multi-hit skill counts once) = 1 charge, max `max`. When full, the next landed attack
//   calls an extra lightning strike worth `bonus` x that attack's damage and spends all charges. Missed attacks give nothing.
// SKILL I LIGHTNING STEP (kind 'lightningstep', no aim): ball of lightning for `dur` s. Invulnerable, `speed` x move speed, can move any way the stick goes and JUMP, passes through the enemy (hurts them
//   every `rehit` s, small knockback), cannot attack or use other skills, cannot go through platforms. Press the skill again to turn back early. Counts as ONE skill for Static Charge.
// SKILL II SKYFALL (kind 'skyfall', drag to aim a ground spot within `range` px): `cast` s of calling it (the circle `radius` px is marked), then `strikes` bolts land `gap` s apart across the circle.
//   Each bolt hits a column `strikeW` px each side, damages and briefly stuns. One skill for Static Charge.
// ULTIMATE STORM OF RUIN (kind 'stormofruin', no aim): after `cast` s a typhoon covers the arena for `dur` s. Bolts hit random spots with no warning; `bias` of them land near the enemy (up to `spread` px
//   away, so moving works). The gap between bolts shrinks from `i0` to `i1` s: formation, intensification, maximum tempest. One ultimate for Static Charge.
// Exact numbers are open for balancing.
Characters.skills('fulminar', {
  basic: {
    time: .26, cd: .22, reach: 36, root: true, noSlash: true, noShake: true,
    chargeP: .30, chargeMin: .22, chargeMax: .90,
    hitFrom: .14, hitTo: .03, dmg: .55,
    burst: {
      name: 'THUNDER BURST',
      norm: {r: 95,  dmg: .9,  kbx: 1.3, kby: .45, stunx: 1.2, shake: 2, hitstop: .06},
      full: {r: 175, dmg: 2.1, kbx: 2.0, kby: .70, stunx: 1.8, shake: 4, hitstop: .12},
      desc: 'Hold the attack to gather electricity, let go to release a shockwave that damages nearby enemies and pushes them away. Holding to full charge makes it bigger and stronger.'
    },
    combo: [
      {time: .26, cd: .22, hitFrom: .14, hitTo: .03, reach: 36, dmg: .55, kbx: .25, kby: .15, lunge: 150, lungeP: .36, hitstop: .04},
      {time: .26, cd: .22, hitFrom: .14, hitTo: .03, reach: 36, dmg: .60, kbx: .25, kby: .20, lunge: 160, lungeP: .36, hitstop: .04},
      {time: .30, cd: .26, hitFrom: .16, hitTo: .04, reach: 38, dmg: .75, kbx: .35, kby: .20, lunge: 190, lungeP: .38, hitstop: .06},
      {time: .28, cd: .24, hitFrom: .15, hitTo: .03, reach: 40, dmg: .85, kbx: .40, kby: .25, lunge: 200, lungeP: .38, hitstop: .07},
      {time: .44, cd: .46, hitFrom: .22, hitTo: .06, reach: 44, dmg: 1.6, kbx: .65, kby: 1.20, lunge: 160, lungeP: .36, hop: 270, stunx: 1.5, hitstop: .14}
    ]
  },
  passive: {name: 'STATIC CHARGE', kind: 'static', max: 6, bonus: .3,
    desc: 'Every attack that lands (basic or skill) builds a Static Charge. At 6 charges the next attack that lands calls down an extra lightning strike for 30% of its damage, then all charges are spent. A skill that hits several enemies or several times counts once. Misses give nothing.'},
  skills: [
    {name: 'LIGHTNING STEP', kind: 'lightningstep', aim: false, cd: 8, dur: 2.4, speed: 2.6, rehit: .5, dmg: .5, kbx: .5, kby: .25,
     desc: 'Turn into a ball of lightning: invulnerable and much faster, you can move and jump freely and hurt enemies you pass through. No attacks or skills while transformed. Press again to turn back early.'},
    {name: 'SKYFALL', kind: 'skyfall', aim: true, cd: 11, range: 380, radius: 135, cast: .5, strikes: 7, gap: .2, strikeW: 38, height: 300, dmg: .5, kby: .1, stunx: 1.4, failTxt: 'NO GROUND',
     desc: 'Drag to choose a spot on the ground (a tap targets the enemy). Lightning strikes rain down one after another over the marked circle, damaging and briefly stunning anyone caught in it.'}
  ],
  ultimate: {name: 'STORM OF RUIN', kind: 'stormofruin', aim: false, cd: 60, cast: .8, dur: 10, i0: .9, i1: .2, bias: .55, spread: 160, strikeW: 34, dmg: .6, kby: .35, stunx: .8,
    desc: 'Summon a typhoon over the whole arena. Lightning strikes random spots with no warning, more often near enemies, and gets faster and faster. Keep moving to avoid it.'}
});