// CALIBER skills - sniper with TWO PISTOLS. Every attack is a bullet (no melee box), so he fights at range.
// COMBO (press ATK again to keep it going): 1 LEFT pistol   2 RIGHT pistol   3 LEFT pistol   4 BOTH pistols = one heavy slug (knocks up, he skids back from the recoil).
// HOLD ATK = SNIPE: he freezes aiming BOTH pistols forward with a red laser. chargeP = the pose he freezes at (must match CP in art.js).
//   chargeMin / chargeMax = seconds held for 0% / 100% charge. RELEASE = one fast long-range bullet, harder the longer you held.
//   chargeShot = {p (when it leaves the guns, MUST stay > chargeP), hand, rMin..rMax (bullet size), speed, life (speed x life = range), dmg (x (1 + dmgGrow x charge)), kbx, kby, stunx, shake, hitstop}.
// shot = {p, hand, r, speed, life}: p = swing progress when the bullet leaves the gun (MUST match C in art.js: .45, .45, .45, .5),
//   hand = 'N' left (near) / 'F' right (far) / 'B' both, r = hit size px, speed = px/s, life = seconds it flies.
// hitFrom:0 hitTo:0 = no melee box, only the bullet hits. dmg / kbx / kby / stunx work like a melee hit. root = feet stay planted.
// lunge = push at lungeP (negative = skid BACK from the recoil). lungeP must stay >= chargeP + .15.
// TUNE HERE: dmg (main balance knob), speed, cd (fire rate), chargeShot.dmg / dmgGrow (how hard the sniper shot hits).
Characters.skills('caliber', {
  basic: {time:.34, cd:.26, root:true, noSlash:true, hitFrom:0, hitTo:0, dmg:.3, kbx:.25, kby:.15, shake:.3, hitstop:0,
    chargeP:.3, chargeMin:.2, chargeMax:1.1, lunge:-20, lungeP:.5,
    chargeShot: {p:.42, hand:'B', rMin:5, rMax:9, speed:1500, life:.75, dmg:1.2, dmgGrow:2.2, kbx:1.6, kby:.5, stunx:1.8, shake:2.5, hitstop:.1},
    combo: [
      {time:.34, cd:.26, hitFrom:0, hitTo:0, dmg:.3,  kbx:.25, kby:.15, lunge:-20, lungeP:.5, shot:{p:.45, hand:'N', r:4, speed:900, life:.9}},   // 1 left pistol
      {time:.34, cd:.26, hitFrom:0, hitTo:0, dmg:.3,  kbx:.25, kby:.15, lunge:-20, lungeP:.5, shot:{p:.45, hand:'F', r:4, speed:900, life:.9}},   // 2 right pistol
      {time:.34, cd:.28, hitFrom:0, hitTo:0, dmg:.35, kbx:.3,  kby:.15, lunge:-20, lungeP:.5, shot:{p:.45, hand:'N', r:4, speed:950, life:.9}},   // 3 left pistol, a bit harder
      {time:.5,  cd:.5,  hitFrom:0, hitTo:0, dmg:1.0, kbx:.5,  kby:1.0, lunge:-110, lungeP:.55, stunx:1.4, shake:1, hitstop:.06,
        shot:{p:.5, hand:'B', r:7, speed:820, life:.9}}                                                                                           // 4 both pistols: heavy slug, knocks up
    ]
  },
  skills: [],
  ultimate: null
});