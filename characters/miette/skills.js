// MIETTE skills. Basic combo = 3 brush hits: OVERHEAD CHOP, DAB (long poke), UPWARD FLING (splash). Press attack again to keep it going.
// Timings match art.js: CONTACT = [.5, .46, .56], chargeP = CHARGE_P = [.4, .4, .42]. Hit opens at p = 1 - hitFrom/time.
// HOLD ATK = PAINT ROLLER (the old charge circle is gone, so the combo has no chargeP any more): see `hold:` below.
// PASSIVE: STICKY SITUATION (see `passive:` below).
// TUNE HERE: dmg is the main balance knob, reach = hit box length (px), kbx/kby = knockback side / up.
Characters.skills('miette', {
  basic: {time:.5, cd:.42, reach:46, root:true, hitFrom:.25, hitTo:.08, dmg:.9, noSlash:true,
    combo: [
      {time:.50, cd:.42, hitFrom:.25, hitTo:.08, reach:46, dmg:.9,  kbx:.4, kby:.2, lunge:90,  lungeP:.42, shake:1,   hitstop:.06},   // 1 overhead chop
      {time:.44, cd:.40, hitFrom:.26, hitTo:.08, reach:52, dmg:.8,  kbx:.3, kby:.1, lunge:70,  lungeP:.38, shake:.8,  hitstop:.05},   // 2 dab / poke (longest reach)
      {time:.66, cd:.60, hitFrom:.30, hitTo:.10, reach:44, dmg:1.5, kbx:.5, kby:.9, lunge:110, lungeP:.46, shake:1.6, hitstop:.10}    // 3 upward fling (launches up)
    ]
  },
  // PASSIVE - STICKY SITUATION: every landed BASIC hit = 1 Paint Stack on that enemy (each enemy has its own counter), max `max`. Each stack slows their movement by `slow` (x stacks);
  //   at `max` stacks they also jump only `jump` x as high. If she stops painting, 1 stack falls off every `decay` s; every hit (and every Paint Roller application) refreshes that timer.
  //   TUNE HERE: max, slow (0.09 x 5 = 45% slower at full stacks), jump (0.72 = 28% lower), decay.
  passive: {name:'STICKY SITUATION', kind:'paint', max:5, slow:.09, jump:.72, decay:3, cd:0,
    desc:'Every successful basic attack puts 1 Paint Stack on the enemy (max 5, counted per enemy). Each stack slows their movement more, and at 5 stacks they also jump lower. If she stops painting, 1 stack fades every 3 seconds; every hit she lands refreshes that timer.'},
  // HELD KEY - PAINT ROLLER: HOLD ATK for `after` s (a quicker tap is still the normal combo). She keeps WALKING (at `speed` x her normal speed) while the oversized brush drags along the floor and leaves sticky paint.
  //   The trail has a fixed length `maxLen` px: once it is full, new paint replaces the oldest part. Let go = she stops painting (the paint stays until it is replaced). An enemy standing on her paint gets
  //   +1 Paint Stack every `tick` s (max 5, refreshes the passive's decay timer). reach = fallback for how far in front of her the bristles touch the floor (art.js measures the real one).
  //   TUNE HERE: after, speed, maxLen, tick.
  hold: {name:'PAINT ROLLER', kind:'roller', after:.2, speed:.7, reach:34, maxLen:420, tick:.7,
    desc:'HOLD ATK: she walks (a bit slower) dragging her giant brush along the floor, leaving sticky paint. The trail has a maximum length: when it is full, new paint replaces the oldest. Let go to stop. Enemies standing on the paint get a Paint Stack every 0.7 seconds, up to 5.'},
  // SKILL I - COLORFUL SWEEP: no aim. She spins 360 degrees with the brush (rooted for `time` s); at `at` (0..1 of the swing) a circle of paint bursts around her.
  //   Every enemy inside `radius` px: damage, medium knockback AWAY from her (kbx / kby), +1 Paint Stack (Sticky Situation). Nothing extra at 5 stacks. A hit on her during the swing cancels it.
  //   TUNE HERE: cd, radius, dmg, kbx, kby, time, at.
  skills: [
    {name:'COLORFUL SWEEP', kind:'colorsweep', aim:false, cd:9, time:.55, at:.5, radius:82, dmg:1.1, kbx:.8, kby:.35, shake:1.2, hitstop:.06, type:'Area - 360 sweep',
      desc:'She spins around swinging her giant brush and splashes a circle of paint around her. Every enemy inside takes damage, is pushed back and gets 1 Paint Stack. Hits several enemies at once, great for breathing room when surrounded.'},
    // SKILL II - PAINTQUAKE: drag to aim (tap = the enemy's column if in `range`, else straight ahead). She stomps the brush (`stomp` s), hops along an arc to the spot, smashes the brush down on landing (`land` s)
    //   and a circle of paint (`radius` px) bursts at the impact: damage + a light pop-up (kbx / kby) + 1 Paint Stack (Sticky Situation) for every enemy inside. A hit on her before she lands cancels the hop.
    //   TUNE HERE: cd, range (how far she can hop), radius, dmg, kbx, kby, stomp, land.
    {name:'PAINTQUAKE', kind:'paintquake', aim:true, cd:11, range:430, stomp:.18, land:.32, radius:95, dmg:1.2, kbx:.25, kby:.5, shake:1.6, hitstop:.07, type:'Ground target - Hop + slam',
      desc:'Drag to aim. She stomps her giant brush on the ground and hops to the chosen spot, then smashes the brush down where she lands. A circle of paint bursts out: enemies inside take damage and get 1 Paint Stack. Reposition and hit at the same time.'}
  ],
  // ULTIMATE - MASTERPIECE: no aim. She hops up (`jump` s), hovers and paints a giant symbol on the floor under her (`paint` s), then the symbol EXPLODES (circle `radius` px around the symbol):
  //   heavy damage + big knockback AWAY from the middle + `stacks` Paint Stacks at once on every enemy it really hits (5 = Sticky Situation fully on). Then she drops back down (`land` s).
  //   ANY hit on her before the explosion cancels it (cooldown becomes `failCd` s instead of `cd`). She needs floor under her to cast it.
  //   TUNE HERE (not final, balance later): cd, failCd, paint (casting time), radius, dmg, kbx, kby, rise (how high she floats), jump, land, fade.
  ultimate: {name:'MASTERPIECE', kind:'masterpiece', aim:false, cd:45, failCd:15, jump:.35, paint:1.8, land:.3, rise:90, fade:.9, radius:200, dmg:3.4, kbx:1.4, kby:1.1, stacks:5, shake:2, hitstop:.1, failTxt:'NEED GROUND', type:'Area - Ultimate',
    desc:'She jumps up, lifts her giant brush and paints a huge colorful symbol on the ground under her. If she takes any damage while painting, it is canceled. When the symbol is finished it explodes in a big paint burst: heavy damage, strong knockback, and every enemy hit instantly gets 5 Paint Stacks (Sticky Situation fully on).'}
});