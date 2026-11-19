// MIETTE skills. Basic combo = 3 brush hits: OVERHEAD CHOP, DAB (long poke), UPWARD FLING (splash). Press attack again to keep it going.
// Timings match art.js: CONTACT = [.5, .46, .56], chargeP = CHARGE_P = [.4, .4, .42]. Hit opens at p = 1 - hitFrom/time.
// HOLD ATK = CHARGE: she draws a glowing circle at the brush tip. chargeMin/chargeMax = seconds held for 0% / 100%.
// TUNE HERE: dmg is the main balance knob, reach = hit box length (px), kbx/kby = knockback side / up.
Characters.skills('miette', {
  basic: {time:.5, cd:.42, reach:46, root:true, chargeMin:.15, chargeMax:1, hitFrom:.25, hitTo:.08, dmg:.9, noSlash:true,
    combo: [
      {time:.50, cd:.42, hitFrom:.25, hitTo:.08, reach:46, dmg:.9,  kbx:.4, kby:.2, chargeP:.40, lunge:90,  lungeP:.42, shake:1,   hitstop:.06},   // 1 overhead chop
      {time:.44, cd:.40, hitFrom:.26, hitTo:.08, reach:52, dmg:.8,  kbx:.3, kby:.1, chargeP:.40, lunge:70,  lungeP:.38, shake:.8,  hitstop:.05},   // 2 dab / poke (longest reach)
      {time:.66, cd:.60, hitFrom:.30, hitTo:.10, reach:44, dmg:1.5, kbx:.5, kby:.9, chargeP:.42, lunge:110, lungeP:.46, shake:1.6, hitstop:.10}    // 3 upward fling (launches up)
    ]
  },
  skills: [],
  ultimate: null
});