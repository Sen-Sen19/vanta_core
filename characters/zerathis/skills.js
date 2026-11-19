// ZERATHIS skills - the Frozen Monarch. Pure RANGE: every attack is ice that flies, there is no melee box. He stays planted (root) while casting.
// COMBO (press ATK again to keep it going): 1 ICE SHARD from the near hand   2 ICE SHARD from the far hand   3 FROST WAVE: both hands slam a big jagged crystal cluster out (knocks up, long stun).
// HOLD ATK = GLACIAL LANCE: after the coil he freezes (chargeP = .3, must match CP in art.js), both hands hold in front of his chest and an ice lance grows between them.
//   chargeMin / chargeMax = seconds held for 0% / 100% charge. Let go = he thrusts it out (chargeShot). A tap (hold shorter than ~.2 s) does the normal combo.
//   chargeShot = {p (when it leaves the hands, MUST stay > chargeP), hand, rMin..rMax (hit size at 0%..100% charge), speed, life, dmg (x (1 + dmgGrow x charge)), kbx, kby, stunx, shake, hitstop}.
// shot = {p, hand, r, speed, life}: p = swing progress when the ice leaves the hand (MUST match C in art.js: .5, .5, .56),
//   hand = 'N' near / 'F' far / 'B' both, r = hit size px, speed = px/s, life = seconds it flies (speed x life = range).
// hitFrom:0 hitTo:0 = no melee box, only the ice hits. dmg / kbx / kby / stunx work like a melee hit (stunx > 1 = "frozen" a bit longer).
// cd = time on every hit, so a cast always finishes before the next starts (no restart from mid-swing = no jitter when spamming). Lower cd for a faster, twitchier fire rate.
// TUNE HERE: dmg (main balance knob), speed + life (range), chargeShot.dmg / dmgGrow (how hard the lance hits).
Characters.skills('zerathis', {
  basic: {time:.55, cd:.55, root:true, noSlash:true, hitFrom:0, hitTo:0, dmg:.7, kbx:.3, kby:.2, stunx:1.2, shake:.4, hitstop:0,
    chargeP:.3, chargeMin:.2, chargeMax:1.3,
    chargeShot: {p:.5, hand:'B', rMin:8, rMax:16, speed:1000, life:1.2, dmg:1.1, dmgGrow:2.6, kbx:1.4, kby:.6, stunx:2.2, shake:2.5, hitstop:.12},
    combo: [
      {time:.55, cd:.55, hitFrom:0, hitTo:0, dmg:.7, kbx:.3,  kby:.2,  stunx:1.2, shot:{p:.5,  hand:'N', r:6,  speed:700, life:1.6}},   // 1 ice shard (near hand)
      {time:.55, cd:.55, hitFrom:0, hitTo:0, dmg:.7, kbx:.3,  kby:.2,  stunx:1.2, shot:{p:.5,  hand:'F', r:6,  speed:700, life:1.6}},   // 2 ice shard (far hand)
      {time:.8, cd:.8,  hitFrom:0, hitTo:0, dmg:1.7, kbx:.4, kby:1.0, stunx:1.8, shake:1.5, hitstop:.08,
        shot:{p:.56, hand:'B', r:16, speed:430, life:2.0}}                                                                              // 3 frost wave (both hands, big, knocks up)
    ]
  },
  skills: [],
  ultimate: null
});