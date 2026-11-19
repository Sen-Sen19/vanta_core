// PELLORIN skills - the String Master. He does not hit. His small PUPPET walks on the ground, tied to his near hand by a string, and the puppet hits.
// COMBO (press ATK again to keep it going): 1 JAB (puppet runs in and stabs)   2 SPIN (puppet whirls two blades)   3 LEAP SLAM (puppet jumps and smashes a mallet, knocks up).
// HOLD ATK = FOCUS: he freezes with his hand up, the puppet floats and starts to grow (chargeP = .3, must match CP in art.js).
//   Let go = the puppet becomes a MONSTER PUPPET for a short time: bigger, hits harder and reaches farther. The let-go hit is a big slam.
//   Size, beast time and power all follow how long you held: a short hold = a small, short beast, a full hold (chargeMax) = the full monster.
//   A tap (hold shorter than ~.2 s) does the normal combo.
// No melee box on his body (hitFrom:0 hitTo:0). The puppet makes the hit, art.js does the hit check (arena.js is not changed).
//
// string = {leash, follow, speed}: leash = longest string (px), follow = how far in front of him the puppet waits (px), speed = puppet walk speed (px/s).
// pup (on each combo hit) = {dash, hitFrom, hitTo, w, h}: dash = how far the puppet runs forward (px, it stops at the enemy),
//   hitFrom/hitTo = part of the swing where the puppet can hit (same idea as melee, but as progress 0..1 - MUST stay > chargeP),
//   w/h = puppet hit box size (px). Bigger beast = bigger box.
// beast = {min, max, scale, dmg, reach, cd, slam}: min..max = seconds of beast time (short focus = min, full focus = max), scale = how many times bigger at FULL focus (less focus = less),
//   dmg = damage multiplier on normal hits at full beast, reach = dash multiplier at full beast, cd = seconds before the next beast can start,
//   slam = the pup box of the let-go slam.
// TUNE HERE: dmg (main balance knob), string.leash (range), beast.min / beast.max / beast.cd (how often and how long he is a beast).
Characters.skills('pellorin', {
  basic: {time:.5, cd:.5, noSlash:true, noShake:true, hitFrom:0, hitTo:0, dmg:.6, kbx:.35, kby:.2, stunx:1, hitstop:0,
    chargeP:.3, chargeMin:.2, chargeMax:1.2,
    string: {leash:170, follow:46, speed:300},
    beast: {min:2, max:6, scale:2.6, dmg:1.35, reach:1.5, cd:4, slam:{dash:90, hitFrom:.52, hitTo:.78, w:36, h:34}},
    combo: [
      {time:.50, cd:.50, dmg:.6,  kbx:.35, kby:.2, pup:{dash:80,  hitFrom:.40, hitTo:.62, w:24, h:24}},                                    // 1 jab
      {time:.55, cd:.55, dmg:.7,  kbx:.4,  kby:.3, stunx:1.1, pup:{dash:55,  hitFrom:.40, hitTo:.74, w:38, h:26}},                        // 2 spin
      {time:.80, cd:.80, dmg:1.5, kbx:.4,  kby:1,  stunx:1.7, hitstop:.08, pup:{dash:105, hitFrom:.60, hitTo:.80, w:30, h:30}}  // 3 leap slam
    ]
  },
  skills: [],
  ultimate: null
});
