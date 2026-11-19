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
  skills: [],
  ultimate: null
});