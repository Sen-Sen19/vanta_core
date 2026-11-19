// FULMINAR skills - The Stormforged. Agile lightning warrior wielding Dual Lightning Blades.
// 5-Hit Electrifying Chain Combo:
//   1 Volt Slash          - Fast diagonal downward strike with the near blade.
//   2 Storm Undercut      - Rising cut from low-rear with the far blade.
//   3 Twin Cross Cleave   - Both blades slice inward in a scissor cross, snapping electric arcs.
//   4 Tempest Flurry      - Rapid dual-wielding forward chain strikes.
//   5 Thunderfall Slam    - Aerial hop and downward plunge of both charged blades, detonating a thunderclap that launches the foe!
// HOLD ATK = OVERCHARGE:
//   Fulminar coils in an agile combat stance, channeling violent lightning between both blades.
//   Release delivers a thunderous high-speed strike with amplified damage, range, and shockwave!
Characters.skills('fulminar', {
  basic: {
    time: .26, cd: .22, reach: 36, root: true, noSlash: true, noShake: true,
    chargeP: .30, chargeMin: .14, chargeMax: .80,
    hitFrom: .14, hitTo: .03, dmg: .55,
    combo: [
      {time: .26, cd: .22, hitFrom: .14, hitTo: .03, reach: 36, dmg: .55, kbx: .25, kby: .15, lunge: 150, lungeP: .36, hitstop: .04},
      {time: .26, cd: .22, hitFrom: .14, hitTo: .03, reach: 36, dmg: .60, kbx: .25, kby: .20, lunge: 160, lungeP: .36, hitstop: .04},
      {time: .30, cd: .26, hitFrom: .16, hitTo: .04, reach: 38, dmg: .75, kbx: .35, kby: .20, lunge: 190, lungeP: .38, hitstop: .06},
      {time: .28, cd: .24, hitFrom: .15, hitTo: .03, reach: 40, dmg: .85, kbx: .40, kby: .25, lunge: 200, lungeP: .38, hitstop: .07},
      {time: .44, cd: .46, hitFrom: .22, hitTo: .06, reach: 44, dmg: 1.6, kbx: .65, kby: 1.20, lunge: 160, lungeP: .36, hop: 270, stunx: 1.5, hitstop: .14}
    ]
  },
  skills: [],
  ultimate: null
});
